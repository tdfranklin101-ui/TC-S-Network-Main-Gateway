/**
 * TC-S Network — Era 21.2
 * Capability Performance Observations
 *
 * Records operational metrics per capability from learning events.
 *
 * IMPORTANT CONSTRAINT:
 *   These are OBSERVATIONS only. They do NOT change:
 *   - risk_level
 *   - permissions
 *   - policy rules
 *   - authority
 *
 * Metrics are stored in network_knowledge (knowledge_type = 'CAPABILITY_METRICS')
 * so they leverage existing schema without a new table.
 * Data lives in the `structured_facts` JSONB column; `summary` is human-readable.
 *
 * NO LLM. All metric computation is deterministic.
 */

'use strict';

const KNOWLEDGE_TYPE = 'CAPABILITY_METRICS';
const KNOWLEDGE_SOURCE = 'capability_metrics_observer';

// ── Record one invocation outcome ─────────────────────────────────────────────
/**
 * @param {object} pool       - pg Pool
 * @param {string} capabilityId
 * @param {object} outcome
 *   @param {boolean} outcome.success
 *   @param {number}  outcome.latency_ms
 *   @param {string}  [outcome.error_class]
 *   @param {string}  [outcome.network_id]
 */
async function recordCapabilityOutcome(pool, capabilityId, outcome) {
  if (!pool || !capabilityId) return;

  const networkId = outcome.network_id || 'default';
  const subject   = `capability_metrics:${capabilityId}`;
  const now       = new Date().toISOString();

  try {
    // Read existing metrics (if any)
    const existing = await pool.query(
      `SELECT knowledge_id, structured_facts FROM network_knowledge
       WHERE subject = $1 AND knowledge_type = $2 AND network_id = $3
       LIMIT 1`,
      [subject, KNOWLEDGE_TYPE, networkId]
    );

    let metrics;
    if (existing.rows.length > 0) {
      metrics = existing.rows[0].structured_facts;
    } else {
      metrics = _empty(capabilityId);
    }

    // Update metrics (all deterministic arithmetic — no policy change)
    metrics.invocation_count += 1;
    if (outcome.success) {
      metrics.success_count += 1;
      metrics.last_success_at = now;
    } else {
      metrics.failure_count += 1;
      metrics.last_failure_at = now;
      if (outcome.error_class) {
        if (!metrics.common_error_classes.includes(outcome.error_class)) {
          metrics.common_error_classes.push(outcome.error_class);
          if (metrics.common_error_classes.length > 10) metrics.common_error_classes.shift();
        }
      }
    }
    metrics.success_rate = metrics.invocation_count > 0
      ? metrics.success_count / metrics.invocation_count
      : 0;

    // Running average latency
    if (typeof outcome.latency_ms === 'number' && outcome.latency_ms >= 0) {
      metrics.total_latency_ms += outcome.latency_ms;
      metrics.median_latency_ms = metrics.total_latency_ms / metrics.invocation_count;
    }
    metrics.updated_at = now;

    const summary = `Capability metrics for ${capabilityId}: ${metrics.invocation_count} invocations, ${(metrics.success_rate * 100).toFixed(1)}% success`;

    // Upsert into network_knowledge (structured_facts = JSONB payload)
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE network_knowledge
         SET structured_facts = $1::jsonb, summary = $2, updated_at = NOW()
         WHERE knowledge_id = $3`,
        [JSON.stringify(metrics), summary, existing.rows[0].knowledge_id]
      );
    } else {
      await pool.query(
        `INSERT INTO network_knowledge
         (subject, knowledge_type, summary, structured_facts, confidence, source_table, network_id, valid_from, created_at, updated_at, era)
         VALUES ($1, $2, $3, $4::jsonb, 1.0, $5, $6, NOW(), NOW(), NOW(), '21.2')`,
        [subject, KNOWLEDGE_TYPE, summary, JSON.stringify(metrics), KNOWLEDGE_SOURCE, networkId]
      );
    }
  } catch (err) {
    // Metrics recording must never crash the main execution path
    console.warn(`[CapabilityMetrics] Failed to record outcome for ${capabilityId}: ${err.message}`);
  }
}

// ── Retrieve metrics for one or all capabilities ──────────────────────────────
/**
 * @param {object} pool
 * @param {string|null} capabilityId  - null → all capabilities
 * @returns {object[]} array of metric objects
 */
async function getCapabilityMetrics(pool, capabilityId = null) {
  if (!pool) return [];
  try {
    let query, params;
    if (capabilityId) {
      query  = `SELECT structured_facts FROM network_knowledge WHERE subject = $1 AND knowledge_type = $2 LIMIT 1`;
      params = [`capability_metrics:${capabilityId}`, KNOWLEDGE_TYPE];
    } else {
      query  = `SELECT structured_facts FROM network_knowledge WHERE knowledge_type = $1 ORDER BY (structured_facts->>'updated_at') DESC`;
      params = [KNOWLEDGE_TYPE];
    }
    const r = await pool.query(query, params);
    if (capabilityId) return r.rows.length > 0 ? [r.rows[0].structured_facts] : [];
    return r.rows.map(row => row.structured_facts);
  } catch (err) {
    console.warn(`[CapabilityMetrics] Read error: ${err.message}`);
    return [];
  }
}

// ── Empty metric template ─────────────────────────────────────────────────────
function _empty(capabilityId) {
  return {
    capability_id:        capabilityId,
    invocation_count:     0,
    success_count:        0,
    failure_count:        0,
    success_rate:         0,
    total_latency_ms:     0,
    median_latency_ms:    0,
    last_success_at:      null,
    last_failure_at:      null,
    common_error_classes: [],
    updated_at:           new Date().toISOString(),
  };
}

module.exports = {
  recordCapabilityOutcome,
  getCapabilityMetrics,
  KNOWLEDGE_TYPE,
};
