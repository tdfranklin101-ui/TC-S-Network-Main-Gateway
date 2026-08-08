/**
 * TC-S Network — Era 21.3
 * Seed TCS-OAFR-001 (TC-S Open-Weight Frontier Replicator)
 *
 * Idempotent. Safe to call multiple times.
 *
 * AUTHORITY CONSTRAINTS (enforced by agent_registry):
 *   - authority: UIM_ONLY (cannot call internal handlers directly)
 *   - production_enabled: false
 *   - policy_bypass: false
 *   - direct_database_access: false
 *   - direct_ledger_write: false
 *   - physical_execution: false
 *
 * CREDENTIAL:
 *   The agent API key is stored in metadata.apiKey.
 *   It comes from process.env.OAFR_AGENT_KEY (development default used if absent).
 *   The MODEL NEVER SEES THIS KEY — the orchestrator shell attaches it to HTTP headers
 *   outside all prompt context.
 */

'use strict';

const AGENT_ID   = 'TCS-OAFR-001';
const AGENT_NAME = 'TC-S Open-Weight Frontier Replicator';

// Development fallback key — safe only in non-production environments
const DEV_DEFAULT_KEY = 'dev-oafr-001-key-do-not-use-in-production';

const AGENT_DEFINITION = {
  id:          AGENT_ID,
  agent_name:  AGENT_NAME,
  agent_type:  'SYSTEM_ORCHESTRATOR',
  description: 'TC-S Open-Weight Frontier Replicator. Runs gpt-oss-120b on RunPod. ' +
                'Interprets human intent, discovers capabilities, creates plans, validates, ' +
                'and invokes through UIM only. NEVER has direct DB/ledger/policy access. ' +
                'Dev-only (production_enabled: false). Era 21.3.',
  allowed_actions: [
    // UIM operations only — no direct handler invocations
    'DISCOVER_CAPABILITIES',
    'GET_NETWORK_KNOWLEDGE',
    'VALIDATE_PLAN',
    'INVOKE_CAPABILITY',
    'GET_REQUEST_STATUS',
    'GET_WORKFLOW',
    'GET_SYSTEM_MANIFEST',
    'GET_ORCHESTRATOR_READINESS',
  ],
  max_risk_level:      'low',   // orchestrator operates within low-risk ceiling
  rate_limit:          20,      // 20 invocations per window (conservative for dev)
  rate_limit_window:   3600,    // per hour
  metadata: {
    authority:               'UIM_ONLY',
    production_enabled:      false,
    gbi_exempt:              true,
    policy_bypass:           false,
    direct_database_access:  false,
    direct_ledger_write:     false,
    physical_execution:      false,
    audit_required:          true,
    capability_discovery:    true,
    plan_creation:           true,
    plan_validation:         true,
    capability_invocation:   true,
    workflow_observation:    true,
    network_knowledge_read:  true,
    era:                     '21.3',
    model:                   'gpt-oss-120b',
    provider:                'runpod',
    forbidden: [
      'direct_database_access', 'direct_ledger_write', 'policy_bypass',
      'permission_mutation', 'risk_mutation', 'physical_execution', 'invent_capability',
    ],
    // apiKey is set at seed time from environment
    apiKey: null, // populated below
  },
};

/**
 * Seed TCS-OAFR-001 idempotently.
 *
 * @param {object} pool — pg Pool
 * @returns {Promise<{ seeded: boolean, agent_id: string }>}
 */
async function seedOrchestratorAgent(pool) {
  if (!pool) return { seeded: false, agent_id: AGENT_ID, error: 'no pool' };

  const agentKey = process.env.OAFR_AGENT_KEY || DEV_DEFAULT_KEY;

  try {
    const existing = await pool.query(
      'SELECT id FROM agent_registry WHERE id = $1 OR agent_name = $2 LIMIT 1',
      [AGENT_ID, AGENT_NAME]
    );

    if (existing.rows.length > 0) {
      // Already registered — update the API key in case it changed
      await pool.query(
        `UPDATE agent_registry
         SET metadata = metadata || $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ apiKey: agentKey }), AGENT_ID]
      );
      console.log(`ℹ️  TCS-OAFR-001 already registered — API key refreshed`);
      return { seeded: false, agent_id: AGENT_ID };
    }

    const meta = { ...AGENT_DEFINITION.metadata, apiKey: agentKey };

    await pool.query(`
      INSERT INTO agent_registry
        (id, agent_name, agent_type, description, allowed_actions,
         max_risk_level, rate_limit, rate_limit_window, is_active, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
    `, [
      AGENT_DEFINITION.id,
      AGENT_DEFINITION.agent_name,
      AGENT_DEFINITION.agent_type,
      AGENT_DEFINITION.description,
      JSON.stringify(AGENT_DEFINITION.allowed_actions),
      AGENT_DEFINITION.max_risk_level,
      AGENT_DEFINITION.rate_limit,
      AGENT_DEFINITION.rate_limit_window,
      JSON.stringify(meta),
    ]);

    console.log(`✅ Registered ${AGENT_NAME} (${AGENT_ID}) — Era 21.3`);
    return { seeded: true, agent_id: AGENT_ID };
  } catch (err) {
    console.error(`❌ Failed to seed TCS-OAFR-001:`, err.message);
    return { seeded: false, agent_id: AGENT_ID, error: err.message };
  }
}

module.exports = { seedOrchestratorAgent, AGENT_ID, AGENT_NAME, DEV_DEFAULT_KEY };
