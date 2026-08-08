/**
 * TC-S Network — Era 21.1
 * Operations Agent — tcs-operations-agent-v1
 *
 * Class: OPERATIONS_AGENT
 * Principal: TC-S_NETWORK
 * Authority: POLICY_GOVERNED
 *
 * This is a deterministic operational identity and execution facade.
 * It is NOT an LLM agent. It performs Network work through UIM → Policy → Executor.
 *
 * INVARIANTS:
 *   - Never writes directly to PostgreSQL
 *   - Never bypasses the Policy Engine
 *   - Never bypasses approval requirements
 *   - Never mutates balances directly
 *   - Never invokes unsupported actions
 *   - All actions are audited
 */

'use strict';

const AGENT_ID   = 'tcs-operations-agent-v1';
const AGENT_NAME = 'TC-S Operations Agent';

// ──────────────────────────────────────────────────────────────────────────────
// PERMISSION ENVELOPE — Era 21.1 expansion
// TRANSFER_SOLAR, PURCHASE_ARTIFACT, AUDIT_TRANSACTION now live.
// SETTLEMENT.RUN remains tcs-scheduler-agent-v1 only (not general ops agent).
// Physical/factory capabilities excluded (security hardening complete but
// factory UIM exposure requires separate policy decision).
// ──────────────────────────────────────────────────────────────────────────────
const ALLOWED_ACTIONS = [
  // Era 21.0 — query + read
  'QUERY_NETWORK',
  'QUERY_MEMBER',
  'QUERY_BALANCE',
  'QUERY_MARKETPLACE',
  'CALCULATE_ENERGY',
  'GENERATE_REPORT',
  // Era 21.0 — marketplace creation
  'ASSET.CREATE',
  'ASSET.ENRICH',
  'ASSET.LIST',
  'ASSET.UNLIST',
  'ASSET.UPDATE',
  'PRICE.QUOTE',
  // Era 21.1 — economic capabilities (policy-governed, risk-rated)
  'TRANSFER_SOLAR',      // medium risk — policy approval may be required
  'PURCHASE_ARTIFACT',   // medium risk — full atomic lifecycle
  'AUDIT_TRANSACTION',   // low risk  — read + verify only
];

// Actions explicitly NOT in the envelope (for documentation and test assertions)
const DENIED_ACTIONS = [
  'MINT_SOLAR',          // admin-only, critical
  'UPDATE_MEMBER',       // admin domain
  'SUSPEND_MEMBER',      // admin domain
  'SETTLEMENT.RUN',      // scheduler-agent domain only (tcs-scheduler-agent-v1)
  'CREATE_NETWORK',      // requires approval, commissioning-agent domain
  'DELETE_NETWORK',      // critical
];

const AGENT_METADATA = {
  class: 'OPERATIONS_AGENT',
  principal: 'TC-S_NETWORK',
  authority: 'POLICY_GOVERNED',
  direct_database_access: false,
  direct_ledger_write: false,
  policy_bypass: false,
  audit_required: true,
  uim_capability_discovery: true,
  production_enabled: false,
  era: '21.1',
  gbi_exempt: true,            // does NOT receive member Solar distribution
  physical_execution: false,   // factory disabled pending auth hardening
  created_in: 'era21-operations-agent',
};

class OperationsAgent {
  constructor(pool, executor) {
    this.pool     = pool;
    this.executor = executor;  // ActionExecutor instance (passed in, not owned)
    this.agentId   = AGENT_ID;
    this.agentName = AGENT_NAME;
    this._initialized = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZATION — idempotent
  // ──────────────────────────────────────────────────────────────────────────
  async initialize() {
    if (this._initialized) return this;

    try {
      const existing = await this.pool.query(
        'SELECT id FROM agent_registry WHERE id = $1 OR agent_name = $2 LIMIT 1',
        [AGENT_ID, AGENT_NAME]
      );

      if (existing.rows.length === 0) {
        await this.pool.query(`
          INSERT INTO agent_registry
            (id, agent_name, agent_type, description, allowed_actions,
             max_risk_level, rate_limit, rate_limit_window, is_active, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        `, [
          AGENT_ID,
          AGENT_NAME,
          'operations',
          'TC-S Network Operations Agent (Era 21). ' +
          'Performs Network functions through UIM → Policy → Executor. ' +
          'POLICY_GOVERNED — no direct DB access, no policy bypass.',
          JSON.stringify(ALLOWED_ACTIONS),
          'low',        // max_risk_level: LOW-risk only in Era 21.0
          60,           // rate_limit: 60 actions
          3600,         // rate_limit_window: per hour
          JSON.stringify(AGENT_METADATA),
        ]);
        console.log(`✅ Registered ${AGENT_NAME} (${AGENT_ID}) in agent_registry`);
      } else {
        console.log(`ℹ️  ${AGENT_NAME} already registered (${existing.rows[0].id})`);
      }

      this._initialized = true;
    } catch (err) {
      console.error(`❌ Failed to initialize ${AGENT_NAME}:`, err.message);
      throw err;
    }

    return this;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAPABILITY DISCOVERY
  // Returns the agent's authorized capability subset from the registry.
  // ──────────────────────────────────────────────────────────────────────────
  async discoverCapabilities(registry) {
    const live = (registry.capabilities || []).filter(
      c => c.status === 'live' && c.uim_exposable === true
    );
    const authorized = live.filter(c => ALLOWED_ACTIONS.includes(c.action_type));
    return {
      agent_id:   this.agentId,
      agent_name: this.agentName,
      total_platform_capabilities: live.length,
      agent_authorized: authorized.length,
      capabilities: authorized,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INVOKE — thin facade over executor
  // Does NOT implement capabilities. Routes through Policy → Executor.
  // ──────────────────────────────────────────────────────────────────────────
  async invoke({ capability_id, action_type, parameters, intent, request_context }) {
    if (!action_type) {
      return this._reject(null, capability_id, 'NO_ACTION_TYPE', 'capability_id could not be resolved to an action_type');
    }

    // Validate the action is in the permission envelope BEFORE submitting
    if (!ALLOWED_ACTIONS.includes(action_type)) {
      return this._reject(null, capability_id, 'NOT_AUTHORIZED',
        `Action '${action_type}' is not in the Operations Agent permission envelope`);
    }

    const actionRequest = {
      actionType:  action_type,
      agentId:     this.agentId,
      agentName:   this.agentName,
      requesterId: request_context?.requesterId || null,
      payload:     parameters || {},
      metadata: {
        uim_capability_id: capability_id,
        intent: intent || null,
        request_context: request_context || {},
        invoked_via: 'POST /api/uim/invoke',
        era: '21.0',
        submitted_at: new Date().toISOString(),
      },
    };

    try {
      const raw = await this.executor.submitAction(actionRequest);
      return this._normalize(raw, capability_id);
    } catch (err) {
      console.error(`[OperationsAgent] Executor error for ${action_type}:`, err.message);
      return this._reject(null, capability_id, 'EXECUTOR_ERROR', err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // NORMALIZE — standard UIM response envelope
  // ──────────────────────────────────────────────────────────────────────────
  _normalize(raw, capability_id) {
    // Map executor status values to UIM status codes
    const statusMap = {
      completed:        'SUCCEEDED',
      pending:          'PENDING_APPROVAL',
      approved:         'RUNNING',
      rejected:         'REJECTED',
      failed:           'FAILED',
      awaiting_approval:'PENDING_APPROVAL',
    };

    const uimStatus = statusMap[raw.status] || raw.status?.toUpperCase() || 'UNKNOWN';

    return {
      request_id:    raw.requestId || raw.id || null,
      agent_id:      this.agentId,
      capability_id: capability_id || null,
      status:        uimStatus,
      result:        raw.result || raw.executionResult || null,
      policy: {
        risk_level:       raw.riskLevel || null,
        approval_required: uimStatus === 'PENDING_APPROVAL',
        policy_checks:    raw.policyChecks || null,
      },
      audit: {
        action_request_id: raw.requestId || null,
        audit_log_id:      raw.auditLogId || null,
      },
      error:         raw.error || null,
      _raw_status:   raw.status,
    };
  }

  _reject(request_id, capability_id, code, message) {
    return {
      request_id:    request_id,
      agent_id:      this.agentId,
      capability_id: capability_id || null,
      status:        'REJECTED',
      result:        null,
      policy: {
        risk_level:       null,
        approval_required: false,
        rejection_code:   code,
        rejection_reason: message,
      },
      audit: { action_request_id: null, audit_log_id: null },
      error: message,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STATUS QUERY — wraps executor.getActionStatus
  // ──────────────────────────────────────────────────────────────────────────
  async getStatus(requestId) {
    const raw = await this.executor.getActionStatus(requestId);
    if (!raw) return null;
    return this._normalize(raw, null);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IDENTITY
  // ──────────────────────────────────────────────────────────────────────────
  getIdentity() {
    return {
      agent_id:       this.agentId,
      agent_name:     this.agentName,
      class:          AGENT_METADATA.class,
      principal:      AGENT_METADATA.principal,
      authority:      AGENT_METADATA.authority,
      allowed_actions: ALLOWED_ACTIONS,
      denied_examples: DENIED_ACTIONS,
      metadata:       AGENT_METADATA,
    };
  }
}

module.exports = {
  OperationsAgent,
  AGENT_ID,
  AGENT_NAME,
  ALLOWED_ACTIONS,
  DENIED_ACTIONS,
  AGENT_METADATA,
};
