/**
 * TC-S Network Foundation — Scheduler Operations Agent
 * Era 21.1: Economic Autonomy
 *
 * Idempotently seeds tcs-scheduler-agent-v1 in agent_registry.
 * The scheduler agent is the authorized identity for SETTLEMENT.RUN
 * and other scheduled maintenance operations.
 *
 * Architectural contract:
 *   - POLICY_GOVERNED: all actions go through the policy engine
 *   - gbi_exempt: does not receive member Solar distributions
 *   - production_enabled: false — dev/staging only until hardened
 *   - audit_required: every scheduled action creates an audit record
 */

'use strict';

const SCHEDULER_AGENT_ID = 'tcs-scheduler-agent-v1';
const SCHEDULER_AGENT_NAME = 'TC-S Scheduler Operations Agent';

const SCHEDULER_AGENT_DEFINITION = {
  id: SCHEDULER_AGENT_ID,
  agent_name: SCHEDULER_AGENT_NAME,
  agent_type: 'OPERATIONS_AGENT',
  description: 'Authorized identity for scheduled settlement, audit, and network maintenance jobs. Operates on a cron schedule. Actions are policy-governed and fully audited.',
  allowed_actions: JSON.stringify([
    'SETTLEMENT.RUN',
    'GENERATE_REPORT',
    'QUERY_NETWORK',
    'QUERY_MARKETPLACE',
    'LEDGER.POST',
    'LOG_ETHICS_EVENT',
    'MODERATION.REVIEW',
  ]),
  max_risk_level: 'medium', // settlement requires medium risk tolerance
  rate_limit: 50,
  rate_limit_window: 60, // integer minutes (DB column type: integer)
  is_active: true,
  metadata: JSON.stringify({
    class: 'OPERATIONS_AGENT',
    principal: 'TC-S_NETWORK',
    authority: 'POLICY_GOVERNED',
    production_enabled: false,
    gbi_exempt: true,
    policy_bypass: false,
    audit_required: true,
    version: '1.0.0',
    era: '21.1',
    explicitly_denied: [
      'TRANSFER_SOLAR',
      'MINT_SOLAR',
      'PURCHASE_ARTIFACT',
      'SUSPEND_MEMBER',
      'UPDATE_MEMBER',
    ],
    purpose: 'scheduled settlement, audit, maintenance jobs',
    schedule_owner: 'TC-S_NETWORK',
  }),
};

/**
 * Idempotently seed the scheduler agent into agent_registry.
 * Safe to call multiple times — will not create duplicates.
 */
async function initializeSchedulerAgent(pool) {
  try {
    // Check by agent id OR agent_name to prevent any duplicate
    const existing = await pool.query(
      'SELECT id, agent_name FROM agent_registry WHERE id = $1 OR agent_name = $2 LIMIT 1',
      [SCHEDULER_AGENT_ID, SCHEDULER_AGENT_NAME]
    );

    if (existing.rows.length > 0) {
      console.log(`⏱️ Scheduler agent already registered (${existing.rows[0].id})`);
      return { seeded: false, agent: existing.rows[0] };
    }

    const result = await pool.query(
      `INSERT INTO agent_registry (
        id, agent_name, agent_type, description,
        allowed_actions, max_risk_level, rate_limit, rate_limit_window,
        is_active, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
      RETURNING id, agent_name`,
      [
        SCHEDULER_AGENT_DEFINITION.id,
        SCHEDULER_AGENT_DEFINITION.agent_name,
        SCHEDULER_AGENT_DEFINITION.agent_type,
        SCHEDULER_AGENT_DEFINITION.description,
        SCHEDULER_AGENT_DEFINITION.allowed_actions,
        SCHEDULER_AGENT_DEFINITION.max_risk_level,
        SCHEDULER_AGENT_DEFINITION.rate_limit,
        SCHEDULER_AGENT_DEFINITION.rate_limit_window,
        SCHEDULER_AGENT_DEFINITION.is_active,
        SCHEDULER_AGENT_DEFINITION.metadata,
      ]
    );

    console.log(`⏱️ Scheduler agent registered: ${result.rows[0].id}`);
    return { seeded: true, agent: result.rows[0] };
  } catch (err) {
    console.error('⏱️ Scheduler agent seeding error:', err.message);
    throw err;
  }
}

module.exports = {
  SCHEDULER_AGENT_ID,
  SCHEDULER_AGENT_NAME,
  initializeSchedulerAgent,
};
