/**
 * TC-S Network — Era 21.0
 * UIM Router — GET /api/uim/capabilities
 *              POST /api/uim/invoke
 *              GET  /api/uim/requests/:id/status
 *              GET  /api/uim/network-knowledge
 *
 * This is a thin adapter layer over the existing Agentic Framework.
 * It does NOT implement capabilities — it routes through Policy → Executor.
 *
 * Auth model:
 *   - /api/uim/capabilities  → public (no sensitive data exposed)
 *   - /api/uim/invoke        → requires X-Agent-API-Key + X-Agent-Id  OR  admin key
 *   - /api/uim/requests/:id  → requires same auth as invoke
 *   - /api/uim/network-knowledge → public read of derived knowledge (no secrets)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const { OperationsAgent, AGENT_ID, ALLOWED_ACTIONS } = require('./agents/operations-agent');
const { OperationsLearning } = require('./operations-learning');

// ─── Singleton instances (initialized once) ──────────────────────────────────
let _operationsAgent  = null;
let _learning         = null;
let _capabilityRegistry = null;
let _initPromise      = null;

const REGISTRY_PATH = path.join(__dirname, '../../docs/capability-registry.json');

// ─── Capability ID → action_type map (built from registry at init) ────────────
let _capMap = {};  // { 'tcs.network.query': 'QUERY_NETWORK', ... }

// ─── Physical capabilities blocked pending factory auth hardening ─────────────
const FACTORY_CAPABILITY_IDS = new Set([
  'tcs.factory.submit_print',
  'tcs.factory.queue_status',
  'tcs.factory.pickup',
  'tcs.3d.generate',
  'tcs.3d.mint',
]);

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZE
// Called once from main.js alongside initializeAgenticFramework.
// ─────────────────────────────────────────────────────────────────────────────
async function initializeUimRouter(pool, executor) {
  if (_operationsAgent) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Load capability registry
    try {
      const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
      _capabilityRegistry = JSON.parse(raw);
    } catch (err) {
      console.error('[UIM] Failed to load capability-registry.json:', err.message);
      _capabilityRegistry = { _meta: {}, capabilities: [] };
    }

    // Build capability_id → action_type map
    _capMap = {};
    for (const cap of (_capabilityRegistry.capabilities || [])) {
      if (cap.id && cap.action_type) {
        _capMap[cap.id] = cap.action_type;
      }
    }

    // Initialize Operations Agent
    _operationsAgent = new OperationsAgent(pool, executor);
    await _operationsAgent.initialize();

    // Initialize Learning Layer
    _learning = new OperationsLearning(pool);
    await _learning.initialize();

    console.log('✅ UIM Router initialized (Operations Agent + Learning Layer)');
  })();

  return _initPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function authenticateInvoker(req, pool) {
  // 1. Agent API key (agent-to-agent calls)
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

  // 2. Admin key (development / testing)
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_KEY) {
    return { valid: true, caller: 'admin', agentId: 'admin' };
  }

  // 3. Session bearer (admin user)
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
// ROUTE HANDLER
// Returns true if the route was handled.
// ─────────────────────────────────────────────────────────────────────────────
async function handleUimRoutes(req, res, pathname, body, pool) {
  if (!pathname.startsWith('/api/uim')) return false;

  const json = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'X-TC-S-Era': '21.0' });
    res.end(JSON.stringify(data));
  };

  // ── GET /api/uim/capabilities ─────────────────────────────────────────────
  if (pathname === '/api/uim/capabilities' && req.method === 'GET') {
    return handleCapabilities(req, res, json, pool);
  }

  // ── POST /api/uim/invoke ──────────────────────────────────────────────────
  if (pathname === '/api/uim/invoke' && req.method === 'POST') {
    return handleInvoke(req, res, body, json, pool);
  }

  // ── GET /api/uim/requests/:id/status ─────────────────────────────────────
  if (pathname.startsWith('/api/uim/requests/') && pathname.endsWith('/status') && req.method === 'GET') {
    return handleRequestStatus(req, res, pathname, json, pool);
  }

  // ── GET /api/uim/network-knowledge ───────────────────────────────────────
  if (pathname === '/api/uim/network-knowledge' && req.method === 'GET') {
    return handleNetworkKnowledge(req, res, json, pool);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/capabilities
// ─────────────────────────────────────────────────────────────────────────────
async function handleCapabilities(req, res, json, pool) {
  try {
    if (!_capabilityRegistry) {
      json(503, { error: 'UIM Router not yet initialized' });
      return true;
    }

    const url       = new URL(req.url, 'http://localhost');
    const includeStubs = url.searchParams.get('include_stubs') === 'true';

    // include_stubs requires admin auth
    if (includeStubs) {
      const auth = await authenticateInvoker(req, pool);
      if (!auth.valid) {
        json(401, { error: auth.error });
        return true;
      }
    }

    const caps = (_capabilityRegistry.capabilities || []).filter(c => {
      if (includeStubs) return true;
      return c.status === 'live' && c.uim_exposable === true;
    });

    // Annotate factory capabilities with their disabled status
    const annotated = caps.map(c => {
      const out = {
        capability_id:   c.id,
        name:            c.name,
        domain:          c.category,
        description:     c.description,
        risk_level:      c.risk_level,
        approval_required: c.approval_required,
        async:           c.async || false,
        status:          c.status,
        uim_exposable:   c.uim_exposable,
        auth_required:   c.auth_for_uim || 'agent_api_key',
        params_required: c.params_required || [],
        params_optional: c.params_optional || [],
        outputs:         c.outputs || [],
        action_type:     c.action_type,
      };

      if (FACTORY_CAPABILITY_IDS.has(c.id)) {
        out.uim_operations_enabled = false;
        out.available_in_platform  = true;
        out.blocked_reason         = 'factory authentication hardening required';
      }

      return out;
    });

    json(200, {
      registry_version:    _capabilityRegistry._meta?.registry_version || '0.1.0',
      era:                 '21.0',
      platform:            'TC-S Network',
      platform_url:        _capabilityRegistry._meta?.platform_url,
      uim_handshake:       _capabilityRegistry._meta?.uim_handshake,
      total_capabilities:  annotated.length,
      filter_applied:      includeStubs ? 'all' : 'live+uim_exposable',
      capabilities:        annotated,
      _timestamp:          new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UIM /capabilities]', err);
    json(500, { error: 'Internal error loading capabilities' });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/uim/invoke
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoke(req, res, body, json, pool) {
  try {
    // 1. Authenticate caller
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) {
      json(401, {
        status: 'REJECTED',
        error:  auth.error,
        policy: { rejection_code: 'UNAUTHENTICATED' },
      });
      return true;
    }

    if (!_operationsAgent) {
      json(503, { status: 'FAILED', error: 'Operations Agent not initialized' });
      return true;
    }

    const {
      agent_id        = AGENT_ID,
      capability_id,
      intent,
      parameters      = {},
      request_context = {},
    } = body || {};

    // 2. Require capability_id
    if (!capability_id) {
      json(400, {
        status: 'REJECTED',
        error:  'capability_id is required',
        policy: { rejection_code: 'MISSING_CAPABILITY_ID' },
      });
      return true;
    }

    // 3. Resolve capability from registry
    const cap = (_capabilityRegistry?.capabilities || []).find(c => c.id === capability_id);

    if (!cap) {
      json(404, {
        request_id:    null,
        agent_id:      AGENT_ID,
        capability_id,
        status:        'REJECTED',
        result:        null,
        policy:        { rejection_code: 'CAPABILITY_NOT_FOUND', rejection_reason: `Capability '${capability_id}' does not exist in the TC-S registry` },
        audit:         { action_request_id: null, audit_log_id: null },
        error:         `Unknown capability: '${capability_id}'. No fallback execution, no hallucinated capability.`,
      });
      return true;
    }

    // 4. Confirm capability is live + uim_exposable
    if (cap.status !== 'live') {
      json(422, {
        request_id:    null,
        agent_id:      AGENT_ID,
        capability_id,
        status:        'REJECTED',
        result:        null,
        policy:        { rejection_code: 'CAPABILITY_NOT_LIVE', rejection_reason: `Capability '${capability_id}' has status '${cap.status}' — not live` },
        audit:         { action_request_id: null, audit_log_id: null },
        error:         `Capability '${capability_id}' is not live (status: ${cap.status})`,
      });
      return true;
    }

    if (!cap.uim_exposable) {
      json(422, {
        request_id:    null,
        agent_id:      AGENT_ID,
        capability_id,
        status:        'REJECTED',
        result:        null,
        policy:        { rejection_code: 'NOT_UIM_EXPOSABLE' },
        audit:         { action_request_id: null, audit_log_id: null },
        error:         `Capability '${capability_id}' is not UIM-exposable`,
      });
      return true;
    }

    // 5. Block factory capabilities
    if (FACTORY_CAPABILITY_IDS.has(capability_id)) {
      json(403, {
        request_id:    null,
        agent_id:      AGENT_ID,
        capability_id,
        status:        'REJECTED',
        result:        null,
        policy:        { rejection_code: 'FACTORY_AUTH_REQUIRED', rejection_reason: 'factory authentication hardening required' },
        audit:         { action_request_id: null, audit_log_id: null },
        error:         'Physical factory capabilities are not yet UIM-enabled. Awaiting factory authentication hardening.',
      });
      return true;
    }

    // 6. Resolve action_type
    const action_type = cap.action_type || _capMap[capability_id];

    // 7. Invoke through Operations Agent → Policy → Executor
    const result = await _operationsAgent.invoke({
      capability_id,
      action_type,
      parameters,
      intent,
      request_context: { ...request_context, caller: auth.caller, callerAgentId: auth.agentId },
    });

    // 8. Record outcome in learning layer (non-blocking)
    if (_learning && result.request_id) {
      _learning.recordOutcome(result.request_id, cap, result).catch(() => {});
    }

    const httpStatus = {
      SUCCEEDED:        200,
      PENDING_APPROVAL: 202,
      RUNNING:          202,
      FAILED:           500,
      REJECTED:         403,
    }[result.status] || 200;

    json(httpStatus, result);
  } catch (err) {
    console.error('[UIM /invoke]', err);
    json(500, {
      status: 'FAILED',
      error:  err.message,
      policy: {},
      audit:  {},
    });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/uim/requests/:id/status
// ─────────────────────────────────────────────────────────────────────────────
async function handleRequestStatus(req, res, pathname, json, pool) {
  try {
    // Auth required
    const auth = await authenticateInvoker(req, pool);
    if (!auth.valid) {
      json(401, { status: 'REJECTED', error: auth.error });
      return true;
    }

    // Parse :id from /api/uim/requests/:id/status
    const parts = pathname.split('/');
    const requestId = parts[parts.length - 2];  // [..., 'requests', ':id', 'status']

    if (!requestId || requestId === 'requests') {
      json(400, { error: 'request_id is required in path: /api/uim/requests/:id/status' });
      return true;
    }

    if (!_operationsAgent) {
      json(503, { error: 'Operations Agent not initialized' });
      return true;
    }

    const result = await _operationsAgent.getStatus(requestId);

    if (!result) {
      json(404, {
        request_id:    requestId,
        agent_id:      AGENT_ID,
        capability_id: null,
        status:        'NOT_FOUND',
        result:        null,
        policy:        {},
        audit:         { action_request_id: requestId },
        error:         `No action request found with id '${requestId}'`,
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
    if (!_learning) {
      json(503, { error: 'Learning layer not initialized' });
      return true;
    }

    const url       = new URL(req.url, 'http://localhost');
    const subject   = url.searchParams.get('subject') || null;
    const ktype     = url.searchParams.get('knowledge_type') || null;
    const networkId = url.searchParams.get('network_id') || null;
    const asOf      = url.searchParams.get('as_of') || null;

    const records = await _learning.getNetworkKnowledge({ subject, knowledge_type: ktype, network_id: networkId, as_of: asOf });

    json(200, {
      era:     '21.0',
      subject: subject || 'all',
      count:   records.length,
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
  getOperationsAgent: () => _operationsAgent,
  getLearningLayer:   () => _learning,
};
