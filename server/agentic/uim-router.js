/**
 * TC-S Network — Era 21.2
 * UIM Router
 *
 * Routes:
 *   GET  /api/uim/capabilities            → public capability registry
 *   POST /api/uim/invoke                  → authenticated capability invocation
 *   GET  /api/uim/requests/:id/status     → request status
 *   GET  /api/uim/network-knowledge       → public derived knowledge
 *   GET  /api/uim/system                  → sanitized runtime manifest (21.2)
 *   GET  /api/uim/orchestrator-readiness  → orchestrator readiness report (21.2)
 *   POST /api/uim/plan/validate           → dry-run plan validator (21.2)
 *   GET  /api/uim/workflow-runs/:id       → workflow observability (21.2)
 *
 * Auth model:
 *   - /api/uim/capabilities  → public
 *   - /api/uim/system        → public (sanitized)
 *   - /api/uim/network-knowledge → public
 *   - all others             → X-Agent-API-Key + X-Agent-Id  OR  X-Admin-Key
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const { OperationsAgent, AGENT_ID, ALLOWED_ACTIONS } = require('./agents/operations-agent');
const { OperationsLearning }  = require('./operations-learning');
const { uimRateLimitCheck }   = require('./rate-limiter');
const { saiUimBreaker }       = require('./circuit-breaker');
const { validateOrchestrationPlan, PHYSICAL_BLOCKED_IDS } = require('./orchestrator/plan-validator');
const { getCapabilityMetrics }                = require('./orchestrator/capability-metrics');

// ─── Singleton instances ──────────────────────────────────────────────────────
let _operationsAgent    = null;
let _learning           = null;
let _capabilityRegistry = null;
let _initPromise        = null;

const REGISTRY_PATH = path.join(__dirname, '../../docs/capability-registry.json');

// ─── Capability ID → action_type map ─────────────────────────────────────────
let _capMap = {};

// ─── Factory capability IDs (physical execution blocked) ──────────────────────
const FACTORY_CAPABILITY_IDS = PHYSICAL_BLOCKED_IDS;

// ─── Era 21.2 system info (does NOT expose secrets) ──────────────────────────
const ERA = '21.2';
const UIM_VERSION = '1.0';

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZE
// ─────────────────────────────────────────────────────────────────────────────
async function initializeUimRouter(pool, executor) {
  if (_operationsAgent) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
      _capabilityRegistry = JSON.parse(raw);
    } catch (err) {
      console.error('[UIM] Failed to load capability-registry.json:', err.message);
      _capabilityRegistry = { _meta: {}, capabilities: [] };
    }

    _capMap = {};
    for (const cap of (_capabilityRegistry.capabilities || [])) {
      if (cap.id && cap.action_type) _capMap[cap.id] = cap.action_type;
    }

    _operationsAgent = new OperationsAgent(pool, executor);
    await _operationsAgent.initialize();

    _learning = new OperationsLearning(pool);
    await _learning.initialize();

    console.log(`✅ UIM Router initialized (Era ${ERA} — Operations Agent + Learning Layer + Orchestrator Readiness)`);
  })();

  return _initPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function authenticateInvoker(req, pool) {
  const apiKey  = req.headers['x-agent-api-key'];
  const agentId = req.headers['x-agent-id'];

  if (apiKey && agentId) {
    try {
      const r = await pool.query(
        'SELECT id, metadata, is_active FROM agent_registry WHERE id = $1',
        [agentId]
      );
      if (r.rows.length > 0 && r.rows[0].is_active) {
        const agent = r.rows[0];
        const expectedKey = agent.metadata?.apiKey || `agent-key-${agentId}`;
        if (apiKey === expectedKey || apiKey === process.env.AGENT_MASTER_KEY) {
          return { valid: true, caller: 'agent', agentId };
        }
      }
    } catch (_) { /* fall through */ }
  }

  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) {
    return { valid: true, caller: 'admin', agentId: 'admin' };
  }

  const sessionToken = req.headers['x-session-token'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].substring(7)
      : null);
  if (sessionToken) {
    try {
      const r = await pool.query(
        `SELECT m.id, m.role FROM session s
         LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
         WHERE s.sid = $1 AND s.expire > NOW()`,
        [sessionToken]
      );
      if (r.rows.length > 0 && ['tcs_admin','commissioner_admin','staff','admin'].includes(r.rows[0].role)) {
        return { valid: true, caller: 'session', agentId: String(r.rows[0].id) };
      }
    } catch (_) { /* fall through */ }
  }

  return { valid: false, error: 'Unauthorized: provide X-Agent-API-Key + X-Agent-Id, X-Admin-Key, or a valid admin session' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
async function handleUimRoutes(req, res, pathname, body, pool) {
  if (!pathname.startsWith('/api/uim')) return false;

  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'X-TC-S-Era': ERA });
    res.end(JSON.stringify(data));
  };

  if (pathname === '/api/uim/capabilities'           && req.method === 'GET')  return handleCapabilities(req, res, json, pool);
  if (pathname === '/api/uim/invoke'                 && req.method === 'POST') return handleInvoke(req, res, body, json, pool);
  if (pathname === '/api/uim/system'                 && req.method === 'GET')  return handleSystem(req, res, json, pool);
  if (pathname === '/api/uim/orchestrator-readiness' && req.method === 'GET')  return handleOrchestratorReadiness(req, res, json, pool);
  if (pathname === '/api/uim/plan/validate'          && req.method === 'POST') return handlePlanValidate(req, res, body, json, pool);
  if (pathname === '/api/uim/network-knowledge'      && req.method === 'GET')  return handleNetworkKnowledge(req, res, json, pool);

  if (pathname.startsWith('/api/uim/requests/') && pathname.endsWith('/status') && req.method === 'GET') {
    return handleRequestStatus(req, res, pathname, json, pool);
  }
  if (pathname.startsWith('/api/uim/workflow-runs/') && req.method === 'GET') {
    return handleWorkflowRun(req, res, pathname, json, pool);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/capabilities
// ─────────────────────────────────────────────────────────────────────────────
async function handleCapabilities(req, res, json, pool) {
  try {
    if (!_capabilityRegistry) { json(503, { error: 'UIM Router not yet initialized' }); return true; }

    const url = new URL(req.url, 'http://localhost');
    const includeStubs = url.searchParams.get('include_stubs') === 'true';

    if (includeStubs) {
      const auth = await authenticateInvoker(req, pool);
      if (!auth.valid) { json(401, { error: auth.error }); return true; }
    }

    const caps = (_capabilityRegistry.capabilities || []).filter(c =>
      includeStubs ? true : c.status === 'live' && c.uim_exposable === true
    );

    const annotated = caps.map(c => {
      const out = {
        capability_id:       c.id,
        version:             c.version || '1.0',
        name:                c.name,
        domain:              c.category,
        title:               c.name,
        description:         c.description,
        risk_level:          c.risk_level,
        approval_required:   c.approval_required,
        execution_mode:      c.execution_mode   || 'SYNC',
        side_effect_class:   c.side_effect_class || 'READ_ONLY',
        idempotency_supported: c.idempotency_supported !== undefined ? c.idempotency_supported : false,
        async:               c.async || false,
        status:              c.status,
        uim_exposable:       c.uim_exposable,
        platform_available:  c.platform_available !== undefined ? c.platform_available : true,
        uim_operations_enabled: !FACTORY_CAPABILITY_IDS.has(c.id),
        auth_required:       c.auth_for_uim || 'agent_api_key',
        params_required:     c.params_required || [],
        params_optional:     c.params_optional || [],
        outputs:             c.outputs || [],
        action_type:         c.action_type,
        input_schema:        c.input_schema  || null,
        output_schema:       c.output_schema || null,
        learning_events:     c.learning_events || [],
        required_permissions: c.required_permissions || [],
        dependencies:        c.dependencies || [],
        deprecated:          c.deprecated || false,
        replacement_capability_id: c.replacement_capability_id || null,
      };

      if (FACTORY_CAPABILITY_IDS.has(c.id)) {
        out.uim_operations_enabled = false;
        out.blocked_reason         = 'PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL';
      }

      return out;
    });

    json(200, {
      registry_version: _capabilityRegistry._meta?.registry_version || '0.2.0',
      era:              ERA,
      platform:         'TC-S Network',
      platform_url:     _capabilityRegistry._meta?.platform_url,
      uim_handshake:    _capabilityRegistry._meta?.uim_handshake,
      total_capabilities: annotated.length,
      filter_applied:   includeStubs ? 'all' : 'live+uim_exposable',
      capabilities:     annotated,
      _timestamp:       new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /capabilities]', err);
    json(500, { error: 'Internal error loading capabilities' });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/system  (Era 21.2 — sanitized runtime manifest)
// ─────────────────────────────────────────────────────────────────────────────
async function handleSystem(req, res, json, pool) {
  try {
    const liveCaps = (_capabilityRegistry?.capabilities || []).filter(c => c.status === 'live' && c.uim_exposable);
    const physCaps = liveCaps.filter(c => FACTORY_CAPABILITY_IDS.has(c.id));

    json(200, {
      system:                      'TC-S Network',
      era:                         ERA,
      network_protocol_version:    '1.0',
      uim_version:                 UIM_VERSION,
      capability_registry_version: _capabilityRegistry?._meta?.registry_version || '0.2.0',
      operations_agent_version:    'tcs-operations-agent-v1',
      interfaces: {
        'GET /api/uim/capabilities':           { description: 'List available capabilities', auth: 'public' },
        'POST /api/uim/invoke':                { description: 'Invoke a capability',         auth: 'agent_api_key or admin' },
        'GET /api/uim/requests/:id/status':    { description: 'Poll request status',         auth: 'agent_api_key or admin' },
        'GET /api/uim/network-knowledge':      { description: 'Query derived knowledge',     auth: 'public' },
        'GET /api/uim/system':                 { description: 'Runtime system manifest',     auth: 'public' },
        'GET /api/uim/orchestrator-readiness': { description: 'Orchestrator readiness check',auth: 'public' },
        'POST /api/uim/plan/validate':         { description: 'Dry-run plan validation',     auth: 'agent_api_key or admin' },
        'GET /api/uim/workflow-runs/:id':      { description: 'Workflow run observability',  auth: 'agent_api_key or admin' },
      },
      component_status: {
        learning_layer:         _learning          ? 'ACTIVE' : 'NOT_INITIALIZED',
        policy_engine:          'ACTIVE',
        executor:               'ACTIVE',
        operations_agent:       _operationsAgent   ? 'ACTIVE' : 'NOT_INITIALIZED',
        physical_execution:     'DISABLED',
        factory_uim_execution:  'DISABLED',
      },
      supported_workflow_types: ['ARTIFACT_COMMERCE_LOOP_V1'],
      supported_orchestration_formats: ['ORCHESTRATION_PLAN_V1', 'ORCHESTRATION_TASK_V1'],
      live_capability_count:    liveCaps.length,
      physical_capability_count: physCaps.length,
      physical_capabilities_uim_enabled: false,
      production_enabled:       false,
      _timestamp:               new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /system]', err);
    json(500, { error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/orchestrator-readiness  (Era 21.2)
// ─────────────────────────────────────────────────────────────────────────────
async function handleOrchestratorReadiness(req, res, json, pool) {
  try {
    // Check each Era 21.2 interface
    const interfaces = {
      capability_discovery: !!_capabilityRegistry,
      plan_validation:      true,
      invoke:               !!_operationsAgent,
      status:               !!_operationsAgent,
      workflow_observability: true,
      learning:             !!_learning,
    };

    // ready_for_external_orchestrator = true only when all interfaces are up
    const allReady = Object.values(interfaces).every(Boolean);

    json(200, {
      era:                           ERA,
      ready_for_external_orchestrator: allReady,
      interfaces,
      constraints: {
        physical_execution:  false,
        production_enabled:  false,
        factory_uim_enabled: false,
      },
      orchestrator_can: [
        'DISCOVER capabilities via GET /api/uim/capabilities',
        'DESCRIBE intent using ORCHESTRATION_TASK_V1',
        'CONSTRUCT a plan using ORCHESTRATION_PLAN_V1',
        'VALIDATE the plan via POST /api/uim/plan/validate (no mutations)',
        'INVOKE authorized capabilities via POST /api/uim/invoke',
        'OBSERVE progress via GET /api/uim/requests/:id/status',
        'VERIFY outcomes via GET /api/uim/workflow-runs/:id',
        'TRACE provenance via GET /api/uim/network-knowledge?knowledge_type=CREATION_PROVENANCE',
        'LEARN from outcomes via GET /api/uim/network-knowledge?knowledge_type=CAPABILITY_METRICS',
      ],
      orchestrator_cannot: [
        'Write directly to the database',
        'Bypass the Policy Engine',
        'Grant itself new permissions',
        'Invent capabilities not in the registry',
        'Activate physical/factory execution without explicit era approval',
        'Alter Network rules through learned inference',
        'Escalate its own authority',
      ],
      _timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /orchestrator-readiness]', err);
    json(500, { error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/uim/plan/validate  (Era 21.2 — dry run, zero mutations)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePlanValidate(req, res, body, json, pool) {
  try {
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) {
      json(401, { status: 'REJECTED', error: auth.error });
      return true;
    }

    if (!_capabilityRegistry) {
      json(503, { status: 'FAILED', error: 'UIM Router not yet initialized' });
      return true;
    }

    const plan = body?.plan || body;
    if (!plan || typeof plan !== 'object') {
      json(400, { status: 'INVALID', error: 'Request body must be { plan: ORCHESTRATION_PLAN_V1 } or an ORCHESTRATION_PLAN_V1 directly' });
      return true;
    }

    // Retrieve caller's allowed actions from agent_registry (if agent caller)
    let callerAllowedActions = null;
    if (auth.caller === 'agent' && auth.agentId) {
      try {
        const r = await pool.query(
          'SELECT allowed_actions, max_risk_level FROM agent_registry WHERE id = $1',
          [auth.agentId]
        );
        if (r.rows.length > 0) {
          const aa = r.rows[0].allowed_actions;
          callerAllowedActions = Array.isArray(aa) ? aa : JSON.parse(aa || '[]');
        }
      } catch (_) { /* non-fatal */ }
    }

    const caps = _capabilityRegistry.capabilities || [];

    // THIS ENDPOINT PERFORMS ZERO MUTATIONS.
    // validateOrchestrationPlan is a pure function with no side effects.
    const validation = validateOrchestrationPlan(plan, caps, {
      callerAgentId:       auth.agentId,
      callerAllowedActions,
      riskCeiling:         plan.constraints?.max_risk_level || 'medium',
      maxSolarSpend:       plan.constraints?.max_solar_spend || 10,
    });

    const httpCode = validation.result === 'VALID' ? 200 : validation.result === 'REQUIRES_APPROVAL' ? 200 : 422;

    json(httpCode, {
      plan_validation: {
        workflow_run_id:   plan.workflow_run_id || null,
        workflow_type:     plan.workflow_type   || null,
        step_count:        plan.steps?.length   || 0,
        result:            validation.result,
        findings:          validation.findings,
        estimated_effects: validation.estimated_effects,
      },
      dry_run: true,
      mutations_performed: 0,
      era:        ERA,
      _timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /plan/validate]', err);
    json(500, { status: 'FAILED', error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/workflow-runs/:id  (Era 21.2 — workflow observability)
// ─────────────────────────────────────────────────────────────────────────────
async function handleWorkflowRun(req, res, pathname, json, pool) {
  try {
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) { json(401, { error: auth.error }); return true; }

    // /api/uim/workflow-runs/:id
    const parts = pathname.split('/');
    const runId = parts[parts.length - 1];
    if (!runId || runId === 'workflow-runs') {
      json(400, { error: 'workflow_run_id required in path: /api/uim/workflow-runs/:id' });
      return true;
    }

    // Query workflow_runs table
    let run = null;
    try {
      const r = await pool.query('SELECT * FROM workflow_runs WHERE workflow_run_id = $1', [runId]);
      run = r.rows[0] || null;
    } catch (_) { /* table may not exist yet */ }

    // Fallback: query network_knowledge for WORKFLOW_RUN records
    if (!run && pool) {
      try {
        const r = await pool.query(
          `SELECT value FROM network_knowledge WHERE subject = $1 AND knowledge_type = 'WORKFLOW_RUN' LIMIT 1`,
          [`workflow:${runId}`]
        );
        if (r.rows.length > 0) run = r.rows[0].value;
      } catch (_) { /* ignore */ }
    }

    if (!run) {
      json(404, { error: `Workflow run '${runId}' not found` });
      return true;
    }

    // Query steps
    let steps = [];
    try {
      const r = await pool.query(
        'SELECT * FROM workflow_run_steps WHERE workflow_run_id = $1 ORDER BY sequence',
        [runId]
      );
      steps = r.rows;
    } catch (_) {
      // Fallback: steps embedded in run record (if from network_knowledge)
      steps = run.steps || [];
    }

    // Query provenance
    let provenance = null;
    try {
      const r = await pool.query(
        `SELECT value FROM network_knowledge
         WHERE subject = $1 AND knowledge_type = 'CREATION_PROVENANCE' LIMIT 1`,
        [`creation_provenance:${runId}`]
      );
      provenance = r.rows.length > 0 ? r.rows[0].value : null;
    } catch (_) { /* ignore */ }

    json(200, {
      workflow_run_id:    run.workflow_run_id || run.workflow_run_id,
      workflow_type:      run.workflow_type   || 'ARTIFACT_COMMERCE_LOOP_V1',
      initiator_agent_id: run.initiator_agent_id || null,
      status:             run.status || run.state,
      intent:             run.intent || null,
      principal_id:       run.principal_id  || null,
      started_at:         run.started_at,
      finished_at:        run.finished_at   || null,
      step_count:         run.step_count    || steps.length,
      success_count:      run.success_count || null,
      failure_count:      run.failure_count || null,
      result_summary:     run.result_summary|| null,
      error_summary:      run.error_summary || null,
      steps,
      provenance,
      era:        ERA,
      _timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /workflow-runs/:id]', err);
    json(500, { error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/uim/invoke
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoke(req, res, body, json, pool) {
  try {
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) {
      json(401, { status: 'REJECTED', error: auth.error, policy: { rejection_code: 'UNAUTHENTICATED' } });
      return true;
    }

    if (!_operationsAgent) {
      json(503, { status: 'FAILED', error: 'Operations Agent not initialized' });
      return true;
    }

    const invokerAgentId = auth.agentId || null;
    const sessionKey     = req.headers['x-session-token'] || req.socket?.remoteAddress || null;
    const rlResult       = uimRateLimitCheck(invokerAgentId, sessionKey);
    if (!rlResult.allowed) {
      json(429, {
        status: 'REJECTED',
        error:  `Rate limit exceeded. Retry after ${Math.ceil(rlResult.resetMs / 1000)}s.`,
        policy: { rejection_code: 'RATE_LIMIT_EXCEEDED', reset_ms: rlResult.resetMs },
      });
      return true;
    }

    const {
      agent_id        = AGENT_ID,
      capability_id,
      version         = '1.0',
      intent,
      parameters      = {},
      request_context = {},
      task_id         = null,
      workflow_run_id = null,
    } = body || {};

    if (!capability_id) {
      json(400, { status: 'REJECTED', error: 'capability_id is required', policy: { rejection_code: 'MISSING_CAPABILITY_ID' } });
      return true;
    }

    const cap = (_capabilityRegistry?.capabilities || []).find(c => c.id === capability_id);

    if (!cap) {
      json(404, {
        request_id: null, agent_id: AGENT_ID, capability_id, status: 'REJECTED', result: null,
        policy: { rejection_code: 'CAPABILITY_NOT_FOUND',
          rejection_reason: `Capability '${capability_id}' does not exist in the TC-S registry` },
        audit: { action_request_id: null, audit_log_id: null },
        error: `Unknown capability: '${capability_id}'. No fallback execution, no hallucinated capability.`,
      });
      return true;
    }

    if (cap.status !== 'live') {
      json(422, {
        request_id: null, agent_id: AGENT_ID, capability_id, status: 'REJECTED', result: null,
        policy: { rejection_code: 'CAPABILITY_NOT_LIVE',
          rejection_reason: `Capability '${capability_id}' has status '${cap.status}' — not live` },
        audit: { action_request_id: null, audit_log_id: null },
        error: `Capability '${capability_id}' is not live (status: ${cap.status})`,
      });
      return true;
    }

    if (!cap.uim_exposable) {
      json(422, {
        request_id: null, agent_id: AGENT_ID, capability_id, status: 'REJECTED', result: null,
        policy: { rejection_code: 'NOT_UIM_EXPOSABLE' },
        audit: { action_request_id: null, audit_log_id: null },
        error: `Capability '${capability_id}' is not UIM-exposable`,
      });
      return true;
    }

    if (FACTORY_CAPABILITY_IDS.has(capability_id)) {
      json(403, {
        request_id: null, agent_id: AGENT_ID, capability_id, status: 'REJECTED', result: null,
        policy: {
          rejection_code:   'PHYSICAL_EXECUTION_DISABLED',
          rejection_reason: 'PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL',
        },
        audit: { action_request_id: null, audit_log_id: null },
        error:  'Physical/factory capabilities are UIM-blocked in Era 21.2. Awaiting explicit era approval.',
      });
      return true;
    }

    // Version check
    const capVersion = cap.version || '1.0';
    const [reqMaj] = version.split('.').map(Number);
    const [capMaj] = capVersion.split('.').map(Number);
    if (reqMaj !== capMaj) {
      json(422, {
        request_id: null, agent_id: AGENT_ID, capability_id, status: 'REJECTED', result: null,
        policy: { rejection_code: 'VERSION_MISMATCH',
          rejection_reason: `Requested version '${version}' incompatible with capability version '${capVersion}'` },
        audit: { action_request_id: null, audit_log_id: null },
        error:  `Version mismatch for '${capability_id}': requested ${version}, available ${capVersion}`,
      });
      return true;
    }

    const action_type = cap.action_type || _capMap[capability_id];

    // Structured log with request correlation
    console.log(JSON.stringify({
      ts: new Date().toISOString(), event: 'UIM_INVOKE',
      capability_id, action_type, agent_id: auth.agentId,
      task_id, workflow_run_id, era: ERA,
    }));

    const result = await _operationsAgent.invoke({
      capability_id, action_type, parameters, intent,
      request_context: {
        ...request_context,
        caller: auth.caller, callerAgentId: auth.agentId,
        task_id, workflow_run_id, era: ERA,
      },
    });

    if (_learning && result.request_id) {
      _learning.recordOutcome(result.request_id, cap, result).catch(() => {});
    }

    // Record capability metrics
    const { recordCapabilityOutcome } = require('./orchestrator/capability-metrics');
    recordCapabilityOutcome(pool, capability_id, {
      success: result.status === 'SUCCEEDED',
      latency_ms: 0, // executor doesn't expose latency yet
      error_class: result.status !== 'SUCCEEDED' ? result.status : undefined,
    }).catch(() => {});

    const httpStatus = {
      SUCCEEDED: 200, PENDING_APPROVAL: 202, RUNNING: 202, FAILED: 500, REJECTED: 403,
    }[result.status] || 200;

    json(httpStatus, result);
  } catch (err) {
    console.error('[UIM /invoke]', err);
    json(500, { status: 'FAILED', error: err.message, policy: {}, audit: {} });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/requests/:id/status
// ─────────────────────────────────────────────────────────────────────────────
async function handleRequestStatus(req, res, pathname, json, pool) {
  try {
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) { json(401, { status: 'REJECTED', error: auth.error }); return true; }

    const parts     = pathname.split('/');
    const requestId = parts[parts.length - 2];

    if (!requestId || requestId === 'requests') {
      json(400, { error: 'request_id is required in path: /api/uim/requests/:id/status' });
      return true;
    }

    if (!_operationsAgent) { json(503, { error: 'Operations Agent not initialized' }); return true; }

    const result = await _operationsAgent.getStatus(requestId);
    if (!result) {
      json(404, {
        request_id: requestId, agent_id: AGENT_ID, capability_id: null,
        status: 'NOT_FOUND', result: null, policy: {},
        audit: { action_request_id: requestId },
        error: `No action request found with id '${requestId}'`,
      });
      return true;
    }

    json(200, { ...result, request_id: requestId });
  } catch (err) {
    console.error('[UIM /requests/:id/status]', err);
    json(500, { status: 'FAILED', error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/network-knowledge
// ─────────────────────────────────────────────────────────────────────────────
async function handleNetworkKnowledge(req, res, json, pool) {
  try {
    if (!_learning) { json(503, { error: 'Learning layer not initialized' }); return true; }

    const url       = new URL(req.url, 'http://localhost');
    const subject   = url.searchParams.get('subject')        || null;
    const ktype     = url.searchParams.get('knowledge_type') || null;
    const networkId = url.searchParams.get('network_id')     || null;
    const asOf      = url.searchParams.get('as_of')          || null;

    const records = await _learning.getNetworkKnowledge({ subject, knowledge_type: ktype, network_id: networkId, as_of: asOf });

    json(200, {
      era:        ERA,
      subject:    subject || 'all',
      count:      records.length,
      records,
      _timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /network-knowledge]', err);
    json(500, { error: err.message });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  initializeUimRouter,
  handleUimRoutes,
  getOperationsAgent:    () => _operationsAgent,
  getLearningLayer:      () => _learning,
  getCapabilityRegistry: () => _capabilityRegistry,
};
