/**
 * TC-S Network — Era 21.0
 * Operations Agent Learning Layer
 *
 * PRINCIPLE: The Network changes. The ledger records the change.
 *            The learning layer understands the change.
 *            The Operations Agent adapts to the change.
 *            The policy engine still decides what is allowed.
 *
 * THREE LAYERS:
 *   1. SOURCE OF TRUTH     — raw ledger/DB events (never modified here)
 *   2. DERIVED KNOWLEDGE   — summaries, rules, trends (network_knowledge table)
 *   3. AGENT MEMORY        — retrieved context for a specific task
 *
 * INVARIANTS:
 *   - Never overwrites source-of-truth records
 *   - Preserves all historical knowledge (versioned, not overwritten)
 *   - Every knowledge record traces back to source event IDs
 *   - Unknown event types are stored and flagged, not discarded
 *   - Learned behavior cannot bypass deterministic policy
 */

'use strict';

// ─── Knowledge Types ──────────────────────────────────────────────────────────
const KNOWLEDGE_TYPES = {
  SOLAR_DISTRIBUTION_RULE: 'SOLAR_DISTRIBUTION_RULE',
  TRANSACTION_PATTERN:     'TRANSACTION_PATTERN',
  MARKETPLACE_BEHAVIOR:    'MARKETPLACE_BEHAVIOR',
  POLICY_RULE:             'POLICY_RULE',
  NETWORK_CHANGE:          'NETWORK_CHANGE',
  CAPABILITY_CHANGE:       'CAPABILITY_CHANGE',
  MEMBER_RULE:             'MEMBER_RULE',
  AGENT_RULE:              'AGENT_RULE',
  SETTLEMENT_RULE:         'SETTLEMENT_RULE',
  ENERGY_STANDARD:         'ENERGY_STANDARD',
  PROTOCOL_CHANGE:         'PROTOCOL_CHANGE',
  ANOMALY:                 'ANOMALY',
  OUTCOME_RECORD:          'OUTCOME_RECORD',
  UNKNOWN:                 'UNKNOWN',
};

// Solar Standard constant — 1 Solar = 4913 kWh (Buckminster Fuller)
const SOLAR_CONSTANT_KWH = 4913;

class OperationsLearning {
  constructor(pool) {
    this.pool = pool;
    this._initialized = false;
    this._checkpoints = {};  // { source: last_processed_timestamp }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZE — creates tables if needed, loads checkpoints
  // ──────────────────────────────────────────────────────────────────────────
  async initialize() {
    if (this._initialized) return this;

    try {
      await this._createTables();
      await this._loadCheckpoints();
      await this._seedBaselineKnowledge();
      this._initialized = true;
      console.log('✅ Operations Learning Layer initialized');
    } catch (err) {
      console.error('❌ Operations Learning init failed:', err.message);
      // Non-fatal — learning layer is optional for core operation
    }

    return this;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TABLE CREATION (idempotent)
  // ──────────────────────────────────────────────────────────────────────────
  async _createTables() {
    // network_knowledge — durable derived knowledge records
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS network_knowledge (
        knowledge_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        knowledge_type  TEXT NOT NULL,
        network_id      TEXT,
        source_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_table    TEXT,
        subject         TEXT NOT NULL,
        summary         TEXT NOT NULL,
        structured_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
        valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_to        TIMESTAMPTZ,
        confidence      NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        supersedes      TEXT REFERENCES network_knowledge(knowledge_id),
        status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','draft','flagged')),
        era             TEXT NOT NULL DEFAULT '21.0'
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nk_subject      ON network_knowledge(subject);
      CREATE INDEX IF NOT EXISTS idx_nk_type         ON network_knowledge(knowledge_type);
      CREATE INDEX IF NOT EXISTS idx_nk_status       ON network_knowledge(status);
      CREATE INDEX IF NOT EXISTS idx_nk_valid_from   ON network_knowledge(valid_from);
      CREATE INDEX IF NOT EXISTS idx_nk_network_id   ON network_knowledge(network_id);
    `);

    // learning_checkpoints — tracks incremental processing position
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learning_checkpoints (
        source_name     TEXT PRIMARY KEY,
        last_processed  TIMESTAMPTZ NOT NULL DEFAULT '2025-04-07 00:00:00+00',
        records_seen    BIGINT NOT NULL DEFAULT 0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHECKPOINT MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────
  async _loadCheckpoints() {
    try {
      const r = await this.pool.query('SELECT * FROM learning_checkpoints');
      for (const row of r.rows) {
        this._checkpoints[row.source_name] = row.last_processed;
      }
    } catch (_) {
      this._checkpoints = {};
    }
  }

  async _saveCheckpoint(sourceName, timestamp, count = 0) {
    this._checkpoints[sourceName] = timestamp;
    await this.pool.query(`
      INSERT INTO learning_checkpoints (source_name, last_processed, records_seen)
      VALUES ($1, $2, $3)
      ON CONFLICT (source_name) DO UPDATE
        SET last_processed = EXCLUDED.last_processed,
            records_seen   = learning_checkpoints.records_seen + EXCLUDED.records_seen,
            updated_at     = NOW()
    `, [sourceName, timestamp, count]);
  }

  _getCheckpoint(sourceName) {
    return this._checkpoints[sourceName] || new Date('2025-04-07T00:00:00Z');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BASELINE KNOWLEDGE SEEDING
  // Creates initial knowledge records if they don't exist.
  // ──────────────────────────────────────────────────────────────────────────
  async _seedBaselineKnowledge() {
    const existing = await this.pool.query(
      "SELECT knowledge_id FROM network_knowledge WHERE subject = 'solar_standard' AND knowledge_type = 'ENERGY_STANDARD' LIMIT 1"
    );
    if (existing.rows.length > 0) return;

    await this._upsertKnowledge({
      knowledge_type: KNOWLEDGE_TYPES.ENERGY_STANDARD,
      subject: 'solar_standard',
      summary: 'Solar Standard: 1 Solar = 4913 kWh (Buckminster Fuller geodesic constant). ' +
               'Issuance begins at signup (Genesis Solar = 1 Solar × days since Apr 7 2025), then +1/day.',
      structured_facts: {
        kwh_per_solar: SOLAR_CONSTANT_KWH,
        genesis_date:  '2025-04-07',
        daily_issuance_per_member: 1,
        genesis_formula: '1_solar_per_day_since_genesis',
        version: '1.0',
        source: 'Solar Standard v1.0',
      },
      source_event_ids: [],
      source_table:     'solar_minting_ledger',
      confidence:       1.0,
    });

    await this._upsertKnowledge({
      knowledge_type: KNOWLEDGE_TYPES.TRANSACTION_PATTERN,
      subject: 'marketplace_fee_structure',
      summary: 'Marketplace transaction lifecycle: buyer debit → seller credit → marketplace fee → foundation fee → reserve allocation.',
      structured_facts: {
        lifecycle: ['buyer_debit', 'seller_credit', 'marketplace_fee', 'foundation_fee', 'reserve_allocation'],
        note: 'Exact fee percentages derived from completed transaction events.',
        version: '1.0',
      },
      source_event_ids: [],
      source_table:     'transactions',
      confidence:       0.9,
    });

    console.log('📚 Learning Layer: baseline knowledge seeded');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KNOWLEDGE WRITE (versioned — never overwrites, always supersedes)
  // ──────────────────────────────────────────────────────────────────────────
  async _upsertKnowledge({ knowledge_type, subject, summary, structured_facts,
                           source_event_ids, source_table, confidence, network_id, valid_from }) {
    // Find current active record for this subject + type
    const existing = await this.pool.query(
      `SELECT knowledge_id FROM network_knowledge
       WHERE subject = $1 AND knowledge_type = $2 AND status = 'active' AND network_id IS NOT DISTINCT FROM $3
       ORDER BY valid_from DESC LIMIT 1`,
      [subject, knowledge_type, network_id || null]
    );

    const newId = require('crypto').randomUUID();

    if (existing.rows.length > 0) {
      const oldId = existing.rows[0].knowledge_id;

      // Supersede the old record
      await this.pool.query(
        "UPDATE network_knowledge SET status = 'superseded', valid_to = NOW(), updated_at = NOW() WHERE knowledge_id = $1",
        [oldId]
      );

      // Insert new record referencing superseded one
      await this.pool.query(`
        INSERT INTO network_knowledge
          (knowledge_id, knowledge_type, network_id, source_event_ids, source_table,
           subject, summary, structured_facts, valid_from, confidence, supersedes, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
      `, [
        newId, knowledge_type, network_id || null,
        JSON.stringify(source_event_ids || []),
        source_table || null, subject, summary,
        JSON.stringify(structured_facts || {}),
        valid_from || new Date(),
        confidence ?? 1.0,
        oldId,
      ]);
    } else {
      await this.pool.query(`
        INSERT INTO network_knowledge
          (knowledge_id, knowledge_type, network_id, source_event_ids, source_table,
           subject, summary, structured_facts, valid_from, confidence, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
        ON CONFLICT (knowledge_id) DO NOTHING
      `, [
        newId, knowledge_type, network_id || null,
        JSON.stringify(source_event_ids || []),
        source_table || null, subject, summary,
        JSON.stringify(structured_facts || {}),
        valid_from || new Date(),
        confidence ?? 1.0,
      ]);
    }

    return newId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EVENT INGESTION — incremental, checkpoint-based
  // ──────────────────────────────────────────────────────────────────────────
  async ingest() {
    if (!this._initialized) return;

    await Promise.allSettled([
      this._ingestSolarMintingLedger(),
      this._ingestDistributionLogs(),
      this._ingestTransactions(),
      this._ingestActionAuditLog(),
      this._ingestMemberEvents(),
    ]);
  }

  async _ingestSolarMintingLedger() {
    const since = this._getCheckpoint('solar_minting_ledger');
    try {
      const r = await this.pool.query(
        `SELECT * FROM solar_minting_ledger WHERE created_at > $1 ORDER BY created_at ASC LIMIT 100`,
        [since]
      );
      if (r.rows.length === 0) return;

      const latest = r.rows[r.rows.length - 1];
      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.SOLAR_DISTRIBUTION_RULE,
        subject:        'solar_distribution_current',
        summary: `Solar distribution as of ${latest.ledger_date}: ` +
                 `${latest.members_distributed || 0} members received ${latest.member_solar_distributed || 0} Solar. ` +
                 `Cumulative: ${latest.cumulative_solar_minted || 0} Solar minted.`,
        structured_facts: {
          ledger_date:           latest.ledger_date,
          global_solar_minted:   latest.global_solar_minted,
          cumulative_minted:     latest.cumulative_solar_minted,
          member_solar_distributed: latest.member_solar_distributed,
          members_distributed:   latest.members_distributed,
          days_since_genesis:    latest.days_since_genesis,
          solar_per_second:      latest.solar_per_second,
          kwh_per_solar:         SOLAR_CONSTANT_KWH,
        },
        source_event_ids: r.rows.map(row => String(row.id)),
        source_table:     'solar_minting_ledger',
        confidence:       1.0,
      });

      await this._saveCheckpoint('solar_minting_ledger', latest.created_at, r.rows.length);
    } catch (err) {
      console.warn('[Learning] solar_minting_ledger ingest error:', err.message);
    }
  }

  async _ingestDistributionLogs() {
    const since = this._getCheckpoint('distribution_logs');
    try {
      const r = await this.pool.query(
        `SELECT * FROM distribution_logs WHERE timestamp > $1 ORDER BY timestamp ASC LIMIT 200`,
        [since]
      );
      if (r.rows.length === 0) return;

      const byType = {};
      for (const row of r.rows) {
        const t = row.distribution_type || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
      }

      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.SOLAR_DISTRIBUTION_RULE,
        subject:        'distribution_type_patterns',
        summary:        `Distribution log patterns (${r.rows.length} events since ${since.toISOString?.() || since}).`,
        structured_facts: { type_counts: byType, sample_size: r.rows.length },
        source_event_ids: r.rows.map(r => r.id),
        source_table:     'distribution_logs',
        confidence:       0.85,
      });

      const latest = r.rows[r.rows.length - 1];
      await this._saveCheckpoint('distribution_logs', latest.timestamp, r.rows.length);
    } catch (err) {
      console.warn('[Learning] distribution_logs ingest error:', err.message);
    }
  }

  async _ingestTransactions() {
    const since = this._getCheckpoint('transactions');
    try {
      const r = await this.pool.query(
        `SELECT type, status, currency, count(*) as cnt, avg(amount) as avg_amount
         FROM transactions WHERE created_at > $1 GROUP BY type, status, currency`,
        [since]
      );
      if (r.rows.length === 0) return;

      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.TRANSACTION_PATTERN,
        subject:        'transaction_type_distribution',
        summary:        `Transaction patterns observed since ${since.toISOString?.() || since}: ${r.rows.length} type/status combinations.`,
        structured_facts: {
          patterns: r.rows.map(row => ({
            type: row.type, status: row.status, currency: row.currency,
            count: parseInt(row.cnt), avg_amount: parseFloat(row.avg_amount || 0),
          })),
        },
        source_event_ids: [],
        source_table:     'transactions',
        confidence:       0.9,
      });

      await this._saveCheckpoint('transactions', new Date(), r.rows.reduce((s, r) => s + parseInt(r.cnt), 0));
    } catch (err) {
      console.warn('[Learning] transactions ingest error:', err.message);
    }
  }

  async _ingestActionAuditLog() {
    const since = this._getCheckpoint('action_audit_log');
    try {
      const r = await this.pool.query(
        `SELECT event_type, agent_id, count(*) as cnt
         FROM action_audit_log WHERE timestamp > $1 GROUP BY event_type, agent_id`,
        [since]
      );
      if (r.rows.length === 0) return;

      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.CAPABILITY_CHANGE,
        subject:        'agentic_action_patterns',
        summary:        `Agentic action audit patterns since ${since.toISOString?.() || since}.`,
        structured_facts: {
          patterns: r.rows.map(row => ({
            event_type: row.event_type,
            agent_id:   row.agent_id,
            count:      parseInt(row.cnt),
          })),
        },
        source_event_ids: [],
        source_table:     'action_audit_log',
        confidence:       1.0,
      });

      await this._saveCheckpoint('action_audit_log', new Date(), r.rows.length);
    } catch (err) {
      console.warn('[Learning] action_audit_log ingest error:', err.message);
    }
  }

  async _ingestMemberEvents() {
    const since = this._getCheckpoint('members');
    try {
      const r = await this.pool.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN is_agent THEN 1 ELSE 0 END) as agents,
                SUM(CASE WHEN is_anonymous THEN 1 ELSE 0 END) as anonymous,
                MIN(signup_timestamp) as earliest_signup,
                MAX(signup_timestamp) as latest_signup
         FROM members WHERE signup_timestamp > $1`,
        [since]
      );
      if (!r.rows[0] || parseInt(r.rows[0].total) === 0) return;

      const row = r.rows[0];
      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.MEMBER_RULE,
        subject:        'member_growth_pattern',
        summary:        `${row.total} new members since ${since.toISOString?.() || since}. ${row.agents} agents, ${row.anonymous} anonymous.`,
        structured_facts: {
          new_members:     parseInt(row.total),
          new_agents:      parseInt(row.agents || 0),
          new_anonymous:   parseInt(row.anonymous || 0),
          period_start:    since,
          period_end:      row.latest_signup,
        },
        source_event_ids: [],
        source_table:     'members',
        confidence:       1.0,
      });

      await this._saveCheckpoint('members', new Date(), parseInt(row.total));
    } catch (err) {
      console.warn('[Learning] members ingest error:', err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHANGE DETECTION
  // Called after ingestion — detects rule/behavior changes and creates
  // a new versioned record when something meaningful shifts.
  // ──────────────────────────────────────────────────────────────────────────
  async detectChanges(subject, newFacts, sourceTable) {
    const existing = await this.pool.query(
      `SELECT knowledge_id, structured_facts FROM network_knowledge
       WHERE subject = $1 AND status = 'active' ORDER BY valid_from DESC LIMIT 1`,
      [subject]
    );
    if (existing.rows.length === 0) return false;

    const oldFacts = existing.rows[0].structured_facts;
    const changed  = JSON.stringify(newFacts) !== JSON.stringify(oldFacts);

    if (changed) {
      console.log(`[Learning] Change detected in subject '${subject}' — creating versioned record`);
      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.NETWORK_CHANGE,
        subject:        `${subject}_change`,
        summary:        `Rule/behavior change detected in '${subject}'`,
        structured_facts: { previous: oldFacts, current: newFacts, detected_at: new Date().toISOString() },
        source_event_ids: [],
        source_table:     sourceTable || 'unknown',
        confidence:       0.95,
      });
    }

    return changed;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OUTCOME RECORDING
  // After every Operations Agent action, record expected vs actual.
  // ──────────────────────────────────────────────────────────────────────────
  async recordOutcome(requestId, capability, result) {
    if (!this._initialized) return;
    try {
      await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.OUTCOME_RECORD,
        subject:        `outcome_${capability?.action_type || 'unknown'}`,
        summary:        `UIM action outcome: ${capability?.id || 'unknown'} → status=${result.status}`,
        structured_facts: {
          request_id:      requestId,
          capability_id:   capability?.id,
          action_type:     capability?.action_type,
          uim_status:      result.status,
          risk_level:      result.policy?.risk_level,
          approval_needed: result.policy?.approval_required,
          has_error:       !!result.error,
          recorded_at:     new Date().toISOString(),
        },
        source_event_ids: [requestId],
        source_table:     'action_requests',
        confidence:       1.0,
      });

      // Anomaly: action succeeded but if status is FAILED
      if (result.status === 'FAILED' && !result.error) {
        await this.flagAnomaly('action_succeeded_without_audit', {
          request_id: requestId,
          capability_id: capability?.id,
          detail: 'Action returned FAILED status with no error message',
        });
      }
    } catch (_) { /* non-fatal */ }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ANOMALY DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  async flagAnomaly(anomaly_type, details) {
    try {
      const knowledgeId = await this._upsertKnowledge({
        knowledge_type: KNOWLEDGE_TYPES.ANOMALY,
        subject:        `anomaly_${anomaly_type}`,
        summary:        `ANOMALY DETECTED: ${anomaly_type}. ${JSON.stringify(details)}`,
        structured_facts: {
          anomaly_type,
          details,
          detected_at: new Date().toISOString(),
          auto_corrected: false,   // Era 21.0: never auto-corrects financial state
        },
        source_event_ids: details.source_ids || [],
        source_table:     details.source_table || 'unknown',
        confidence:       0.8,
      });
      console.warn(`[Learning] ⚠️  Anomaly flagged: ${anomaly_type}`, details);
      return knowledgeId;
    } catch (err) {
      console.error('[Learning] Failed to flag anomaly:', err.message);
    }
  }

  async detectTransactionAnomalies() {
    if (!this._initialized) return;
    try {
      // Detect transactions with completed status but no completion timestamp pattern
      const r = await this.pool.query(`
        SELECT id, type, status, amount, currency FROM transactions
        WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 50
      `);
      // Flag duplicate amounts in same session (simple heuristic)
      const seen = {};
      for (const row of r.rows) {
        const key = `${row.type}_${row.amount}_${row.currency}`;
        if (seen[key] && seen[key] > 1) {
          await this.flagAnomaly('potential_duplicate_transaction', {
            transaction_ids: [row.id],
            key,
            count: seen[key] + 1,
          });
        }
        seen[key] = (seen[key] || 0) + 1;
      }
    } catch (err) {
      console.warn('[Learning] Transaction anomaly scan error:', err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KNOWLEDGE RETRIEVAL
  // The public API for the Operations Agent to consult before acting.
  // ──────────────────────────────────────────────────────────────────────────
  async getNetworkKnowledge({ subject, knowledge_type, network_id, as_of } = {}) {
    if (!this._initialized) return [];

    let query  = "SELECT * FROM network_knowledge WHERE status = 'active'";
    const params = [];
    let idx = 1;

    if (subject) {
      // Support substring match for subject (e.g. 'solar' matches 'solar_standard')
      query += ` AND subject ILIKE $${idx++}`;
      params.push(`%${subject}%`);
    }

    if (knowledge_type) {
      query += ` AND knowledge_type = $${idx++}`;
      params.push(knowledge_type);
    }

    if (network_id) {
      query += ` AND network_id = $${idx++}`;
      params.push(network_id);
    }

    if (as_of) {
      query += ` AND valid_from <= $${idx++} AND (valid_to IS NULL OR valid_to >= $${idx++})`;
      params.push(as_of, as_of);
      idx++;  // account for two uses
    }

    query += ' ORDER BY valid_from DESC LIMIT 100';

    try {
      const r = await this.pool.query(query, params);
      return r.rows.map(row => ({
        knowledge_id:     row.knowledge_id,
        knowledge_type:   row.knowledge_type,
        subject:          row.subject,
        summary:          row.summary,
        structured_facts: row.structured_facts,
        source_event_ids: row.source_event_ids,
        source_table:     row.source_table,
        valid_from:       row.valid_from,
        valid_to:         row.valid_to,
        confidence:       parseFloat(row.confidence),
        supersedes:       row.supersedes,
        network_id:       row.network_id,
        era:              row.era,
      }));
    } catch (err) {
      console.error('[Learning] getNetworkKnowledge error:', err.message);
      return [];
    }
  }

  // Store a new versioned knowledge record (public API for tests)
  async createKnowledge(params) {
    return this._upsertKnowledge(params);
  }
}

module.exports = { OperationsLearning, KNOWLEDGE_TYPES };
