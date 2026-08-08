/**
 * TC-S Network — Era 21.2
 * Creation Provenance
 *
 * Records a canonical provenance index for workflows that produce artifacts.
 * Stored in network_knowledge (knowledge_type = 'CREATION_PROVENANCE').
 * Data lives in the `structured_facts` JSONB column; `summary` is human-readable.
 *
 * This is NOT a replacement for the ledger.
 * It is a provenance index pointing back to authoritative records.
 * Every reference must trace to existing Network data.
 */

'use strict';

const KNOWLEDGE_TYPE   = 'CREATION_PROVENANCE';
const KNOWLEDGE_SOURCE = 'provenance_recorder';

/**
 * Record a creation provenance index after a workflow completes.
 *
 * @param {object} pool
 * @param {object} provenance
 *   @param {string}   provenance.creation_id          - unique ID for this provenance record
 *   @param {string}   provenance.workflow_run_id
 *   @param {string}   [provenance.network_id]
 *   @param {string}   [provenance.principal_id]
 *   @param {string}   [provenance.initiator_agent_id]
 *   @param {string}   [provenance.intent]
 *   @param {string[]} [provenance.artifact_ids]
 *   @param {string[]} [provenance.capability_invocations]
 *   @param {string[]} [provenance.transaction_ids]
 *   @param {object[]} [provenance.energy_records]
 *   @param {object[]} [provenance.ownership_records]
 *   @param {object[]} [provenance.audit_records]
 *   @param {string[]} [provenance.knowledge_record_ids]
 *   @param {string}   [provenance.started_at]
 *   @param {string}   [provenance.completed_at]
 *   @param {string}   [provenance.status]
 *   @param {string[]} [provenance.content_hashes]
 *   @param {object}   [provenance.metadata]
 */
async function recordProvenance(pool, provenance) {
  if (!pool || !provenance?.workflow_run_id) return null;

  const networkId = provenance.network_id || 'default';
  const subject   = `creation_provenance:${provenance.workflow_run_id}`;
  const now       = new Date().toISOString();

  const record = {
    creation_id:             provenance.creation_id || provenance.workflow_run_id,
    workflow_run_id:         provenance.workflow_run_id,
    network_id:              networkId,
    principal_id:            provenance.principal_id    || null,
    initiator_agent_id:      provenance.initiator_agent_id || null,
    intent:                  provenance.intent          || null,
    artifact_ids:            provenance.artifact_ids    || [],
    capability_invocations:  provenance.capability_invocations || [],
    transaction_ids:         provenance.transaction_ids || [],
    energy_records:          provenance.energy_records  || [],
    ownership_records:       provenance.ownership_records || [],
    audit_records:           provenance.audit_records   || [],
    knowledge_record_ids:    provenance.knowledge_record_ids || [],
    started_at:              provenance.started_at      || now,
    completed_at:            provenance.completed_at    || now,
    status:                  provenance.status          || 'UNKNOWN',
    content_hashes:          provenance.content_hashes  || [],
    metadata:                provenance.metadata        || {},
    recorded_at:             now,
  };

  const summary = `Provenance for workflow ${provenance.workflow_run_id}: ${record.artifact_ids.length} artifacts, ${record.transaction_ids.length} transactions, status=${record.status}`;

  try {
    // Upsert (idempotent on workflow_run_id)
    const existing = await pool.query(
      `SELECT knowledge_id FROM network_knowledge WHERE subject = $1 AND knowledge_type = $2 LIMIT 1`,
      [subject, KNOWLEDGE_TYPE]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE network_knowledge
         SET structured_facts = $1::jsonb, summary = $2, updated_at = NOW()
         WHERE knowledge_id = $3`,
        [JSON.stringify(record), summary, existing.rows[0].knowledge_id]
      );
    } else {
      await pool.query(
        `INSERT INTO network_knowledge
         (subject, knowledge_type, summary, structured_facts, confidence, source_table, network_id, valid_from, created_at, updated_at, era)
         VALUES ($1, $2, $3, $4::jsonb, 1.0, $5, $6, NOW(), NOW(), NOW(), '21.2')`,
        [subject, KNOWLEDGE_TYPE, summary, JSON.stringify(record), KNOWLEDGE_SOURCE, networkId]
      );
    }
  } catch (err) {
    console.warn(`[Provenance] Failed to record provenance for ${provenance.workflow_run_id}: ${err.message}`);
    return null;
  }

  return record;
}

/**
 * Retrieve a provenance record by workflow_run_id.
 * @param {object} pool
 * @param {string} workflowRunId
 * @returns {object|null}
 */
async function getProvenance(pool, workflowRunId) {
  if (!pool || !workflowRunId) return null;
  try {
    const r = await pool.query(
      `SELECT structured_facts FROM network_knowledge
       WHERE subject = $1 AND knowledge_type = $2 LIMIT 1`,
      [`creation_provenance:${workflowRunId}`, KNOWLEDGE_TYPE]
    );
    return r.rows.length > 0 ? r.rows[0].structured_facts : null;
  } catch (err) {
    console.warn(`[Provenance] Read error: ${err.message}`);
    return null;
  }
}

/**
 * Verify that a provenance record's references point to real authoritative records.
 * If the record has NO artifact_ids and NO transaction_ids, it passes immediately
 * (nothing to check = nothing stale).
 *
 * @returns {{ verified: boolean, checks: object[] }}
 */
async function verifyProvenance(pool, workflowRunId) {
  const prov = await getProvenance(pool, workflowRunId);
  if (!prov) return { verified: false, checks: [{ code: 'PROVENANCE_NOT_FOUND', pass: false }] };

  const checks = [];

  // If there are no references to check, provenance is trivially verified
  const artifactIds    = prov.artifact_ids    || [];
  const transactionIds = prov.transaction_ids || [];
  if (artifactIds.length === 0 && transactionIds.length === 0) {
    return { verified: true, checks: [] };
  }

  // Check artifact_ids resolve to market_items
  for (const aid of artifactIds) {
    try {
      const r = await pool.query('SELECT id FROM market_items WHERE id = $1', [aid]);
      checks.push({ code: 'ARTIFACT_EXISTS', artifact_id: aid, pass: r.rows.length > 0 });
    } catch (e) {
      checks.push({ code: 'ARTIFACT_EXISTS', artifact_id: aid, pass: false, error: e.message });
    }
  }

  // Check transaction_ids resolve to transactions
  for (const txId of transactionIds) {
    try {
      const r = await pool.query('SELECT id FROM transactions WHERE id = $1', [txId]);
      checks.push({ code: 'TRANSACTION_EXISTS', transaction_id: txId, pass: r.rows.length > 0 });
    } catch (e) {
      checks.push({ code: 'TRANSACTION_EXISTS', transaction_id: txId, pass: false, error: e.message });
    }
  }

  const verified = checks.every(c => c.pass);
  return { verified, checks };
}

module.exports = {
  recordProvenance,
  getProvenance,
  verifyProvenance,
  KNOWLEDGE_TYPE,
};
