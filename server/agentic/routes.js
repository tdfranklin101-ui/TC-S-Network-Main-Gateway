/**
 * TC-S Network Foundation - Agentic Framework API Routes
 * Version: 1.1.0
 * 
 * Security Update v2: Scoped admin keys, intent logging, replay protection, RBAC
 */

const { ActionExecutor } = require('./executor');
const { CommissioningAgent } = require('./agents/commissioning-agent');
const { getAllActions, getHighRiskActions, getActionById, RISK_LEVELS } = require('./api-surface');
const { 
  initializeIntentLogger, 
  getIntentLogger, 
  createIntentLogTable,
  checkReplayProtection,
  validateScopedAdminAccess,
  hashPayload,
  ROLES,
  checkRolePermission,
  getRoutePermissions
} = require('./security');
const { Scheduler, JOB_TYPES } = require('./scheduler');

let executorInstance = null;
let commissioningAgentInstance = null;
let schedulerInstance = null;
let initializingPromise = null;

const ADMIN_ROLES = ['admin', 'foundation', 'operator', 'tcs_admin', 'commissioner_admin'];
const APPROVER_ROLES = ['admin', 'foundation', 'approver', 'tcs_admin', 'commissioner_admin'];

async function initializeAgenticFramework(pool) {
  if (executorInstance) return { executor: executorInstance, commissioningAgent: commissioningAgentInstance, scheduler: schedulerInstance };
  if (initializingPromise) return initializingPromise;
  
  initializingPromise = (async () => {
    try {
      executorInstance = new ActionExecutor(pool);
      commissioningAgentInstance = new CommissioningAgent(pool);
      await commissioningAgentInstance.initialize();
      
      await createIntentLogTable(pool);
      initializeIntentLogger(pool);
      
      schedulerInstance = new Scheduler(pool, executorInstance);
      await schedulerInstance.initialize();
      
      if (process.env.ENABLE_SCHEDULER !== 'false') {
        schedulerInstance.start(60000);
      }
      
      console.log('✅ Agentic Framework initialized with security module and scheduler');
      return { executor: executorInstance, commissioningAgent: commissioningAgentInstance, scheduler: schedulerInstance };
    } catch (error) {
      executorInstance = null;
      initializingPromise = null;
      throw error;
    }
  })();
  
  return initializingPromise;
}

function getScheduler() {
  return schedulerInstance;
}

function getExecutor() {
  return executorInstance;
}

function getCommissioningAgent() {
  return commissioningAgentInstance;
}

async function validateApiKey(req, pool) {
  const apiKey = req.headers['x-agent-api-key'];
  const agentId = req.headers['x-agent-id'];
  
  if (!apiKey || !agentId) {
    return { valid: false, error: 'Missing X-Agent-API-Key or X-Agent-Id header' };
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM agent_registry WHERE id = $1 AND is_active = true',
      [agentId]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Agent not found or inactive' };
    }
    
    const agent = result.rows[0];
    const expectedKey = agent.metadata?.apiKey || `agent-key-${agentId}`;
    
    if (apiKey !== expectedKey && apiKey !== process.env.AGENT_MASTER_KEY) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    return { valid: true, agent };
  } catch (error) {
    return { valid: false, error: 'Authorization check failed' };
  }
}

async function validateAdminAccess(req, pool) {
  const adminHeader = req.headers['x-admin'];
  const adminKey = req.headers['x-admin-key'];
  const sessionToken = req.headers['x-session-token'];
  const authHeader = req.headers['authorization'];
  
  if (adminHeader === 'true' && adminKey === process.env.ADMIN_SECRET_KEY) {
    return { valid: true, role: 'admin', userId: 'system-admin' };
  }
  
  const token = sessionToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
  
  if (token) {
    try {
      const result = await pool.query(
        `SELECT s.sess, m.id as user_id, m.username, m.role 
         FROM session s 
         LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
         WHERE s.sid = $1 AND s.expire > NOW()`,
        [token]
      );
      
      if (result.rows.length > 0 && result.rows[0].user_id) {
        const member = result.rows[0];
        const role = member.role || 'member';
        if (ADMIN_ROLES.includes(role)) {
          return { valid: true, role, userId: member.user_id };
        }
        return { valid: false, error: 'Admin role required' };
      }
    } catch (error) {
      console.error('Admin session validation error:', error);
    }
  }
  
  return { valid: false, error: 'Admin access requires valid session token' };
}

async function validateApproverAccess(req, pool) {
  const adminCheck = await validateAdminAccess(req, pool);
  if (adminCheck.valid && APPROVER_ROLES.includes(adminCheck.role)) {
    return adminCheck;
  }
  
  return { valid: false, error: 'Approver access required' };
}

async function validateUserSession(req, pool) {
  const sessionToken = req.headers['x-session-token'];
  const authHeader = req.headers['authorization'];
  
  if (sessionToken) {
    try {
      const result = await pool.query(
        `SELECT s.sess, m.id as user_id, m.username 
         FROM session s 
         LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
         WHERE s.sid = $1 AND s.expire > NOW()`,
        [sessionToken]
      );
      if (result.rows.length > 0 && result.rows[0].user_id) {
        return { valid: true, userId: result.rows[0].user_id, username: result.rows[0].username };
      }
    } catch (error) {
      console.error('Session token validation error:', error);
    }
  }
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const result = await pool.query(
        `SELECT s.sess, m.id as user_id, m.username 
         FROM session s 
         LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
         WHERE s.sid = $1 AND s.expire > NOW()`,
        [token]
      );
      if (result.rows.length > 0 && result.rows[0].user_id) {
        return { valid: true, userId: result.rows[0].user_id, username: result.rows[0].username };
      }
    } catch (error) {
      console.error('Bearer token validation error:', error);
    }
  }

  const adminAuth = await validateAdminAccess(req, pool);
  if (adminAuth.valid) {
    return { valid: true, userId: adminAuth.userId, username: 'admin', isAdmin: true };
  }
  
  return { valid: false, error: 'Valid session token required (X-Session-Token or Authorization: Bearer)' };
}

async function validateOrderOwnership(pool, orderId, userId) {
  try {
    const result = await pool.query(
      'SELECT buyer_id FROM orders WHERE id = $1',
      [orderId]
    );
    if (result.rows.length === 0) {
      return { valid: false, error: 'Order not found' };
    }
    const buyerId = result.rows[0].buyer_id;
    if (String(buyerId) !== String(userId)) {
      return { valid: false, error: 'You do not own this order' };
    }
    return { valid: true };
  } catch (error) {
    console.error('Order ownership validation error:', error);
    return { valid: false, error: 'Failed to verify order ownership' };
  }
}

async function logPrivilegedCall(req, options = {}) {
  const logger = getIntentLogger();
  if (!logger) return null;
  
  const startTime = Date.now();
  const logId = await logger.log({
    userId: options.userId || 'unknown',
    role: options.role || 'unknown',
    actionType: options.actionType,
    route: options.route || req.url,
    method: req.method,
    reqId: req.headers['x-req-id'],
    payloadHash: options.payload ? hashPayload(options.payload) : null,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    success: options.success !== false,
    error: options.error,
    metadata: options.metadata
  });
  
  return { logId, startTime };
}

async function validateWithRBAC(req, pool, requiredAction) {
  const routePerms = getRoutePermissions(req.url?.split('?')[0], req.method);
  
  const scopedAuth = await validateScopedAdminAccess(req, pool, requiredAction);
  
  if (scopedAuth.valid) {
    if (routePerms && routePerms.requiredRoles) {
      const roleMatch = routePerms.requiredRoles.some(r => 
        r === scopedAuth.role || 
        (scopedAuth.role === 'admin' || scopedAuth.role === 'tcs_admin') ||
        (scopedAuth.role === 'commissioner_admin' && ['seller', 'staff', 'member'].includes(r))
      );
      if (roleMatch || checkRolePermission(scopedAuth.role, requiredAction)) {
        return scopedAuth;
      }
    } else {
      return scopedAuth;
    }
  }
  
  if (scopedAuth.role && routePerms?.requiredRoles) {
    return { valid: false, error: `Role '${scopedAuth.role}' not authorized for ${requiredAction}` };
  }
  
  return scopedAuth;
}

async function handleApiMe(req, res, pool) {
  try {
    const sessionToken = req.headers['x-session-token'];
    const authHeader = req.headers['authorization'];
    const adminKey = req.headers['x-admin-key'];

    if (adminKey) {
      try {
        const scopedAuth = await validateScopedAdminAccess(req, pool, 'admin.full');
        if (scopedAuth.valid) {
          await logPrivilegedCall(req, {
            actionType: 'API_ME.ADMIN', route: '/api/me', userId: scopedAuth.userId,
            role: scopedAuth.role
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            memberId: scopedAuth.userId,
            username: 'System Admin',
            role: 'tcs_admin',
            networkId: 'default',
            permissions: ['*'],
            authMethod: scopedAuth.authMethod
          }));
          return true;
        }
      } catch (err) {
        console.error('Admin auth check failed in /api/me:', err.message);
      }
    }

    const token = sessionToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (token) {
      try {
        const result = await pool.query(
          `SELECT s.sess, m.id as member_id, m.username, m.role, m.email
           FROM session s
           LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
           WHERE s.sid = $1 AND s.expire > NOW()`,
          [token]
        );

        if (result.rows.length > 0 && result.rows[0].member_id) {
          const member = result.rows[0];
          const role = member.role || 'member';
          const roleInfo = ROLES[role] || ROLES.member;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            memberId: member.member_id,
            username: member.username,
            email: member.email,
            role: role,
            networkId: 'default',
            permissions: roleInfo.permissions || []
          }));
          return true;
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      memberId: null,
      username: 'Guest',
      role: 'member',
      networkId: 'default',
      permissions: ROLES.member.permissions
    }));
    return true;
  } catch (err) {
    console.error('Critical error in /api/me:', err);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      memberId: null,
      username: 'Guest',
      role: 'member',
      networkId: 'default',
      permissions: ['marketplace.browse', 'marketplace.buy']
    }));
    return true;
  }
}

async function handleAgenticRoutes(req, res, pathname, body, pool) {
  if (pathname === '/api/me' && req.method === 'GET') {
    if (!executorInstance) {
      try {
        await initializeAgenticFramework(pool);
      } catch (error) {
        console.error('⚠️ Agentic Framework init deferred for /api/me:', error.message);
      }
    }
    return handleApiMe(req, res, pool);
  }

  if (!executorInstance) {
    try {
      await initializeAgenticFramework(pool);
    } catch (error) {
      console.error('❌ Agentic Framework initialization failed:', error.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agentic framework initializing, please retry' }));
      return true;
    }
  }
  
  const replayCheck = checkReplayProtection(req.headers['x-req-id']);
  if (!replayCheck.valid) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: replayCheck.error, reqId: replayCheck.reqId }));
    return true;
  }

  // ============================================================================
  // INTENT LOG / AUDIT TRAIL
  // ============================================================================

  if (pathname === '/api/audit' && req.method === 'GET') {
    const scopedAuth = await validateWithRBAC(req, pool, 'AUDIT.VIEW');
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required for audit logs' }));
      return true;
    }

    await logPrivilegedCall(req, {
      actionType: 'AUDIT.VIEW', route: pathname, userId: scopedAuth.userId,
      role: scopedAuth.role
    });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const userFilter = url.searchParams.get('user');
    const actionFilter = url.searchParams.get('action');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const cursor = url.searchParams.get('cursor');

    try {
      let query = 'SELECT * FROM intent_log WHERE 1=1';
      const params = [];
      let paramIdx = 1;

      if (userFilter) {
        query += ` AND who ILIKE $${paramIdx}`;
        params.push(`%${userFilter}%`);
        paramIdx++;
      }
      if (actionFilter) {
        query += ` AND action_type ILIKE $${paramIdx}`;
        params.push(`%${actionFilter}%`);
        paramIdx++;
      }
      if (fromDate) {
        query += ` AND timestamp >= $${paramIdx}`;
        params.push(fromDate);
        paramIdx++;
      }
      if (toDate) {
        query += ` AND timestamp <= $${paramIdx}`;
        params.push(toDate + 'T23:59:59Z');
        paramIdx++;
      }
      if (cursor) {
        query += ` AND timestamp < $${paramIdx}`;
        params.push(cursor);
        paramIdx++;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIdx}`;
      params.push(Math.min(limit, 500));

      const result = await pool.query(query, params);
      const logs = result.rows;
      const nextCursor = logs.length > 0 ? logs[logs.length - 1].timestamp : null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: logs.length,
        logs,
        nextCursor
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  // ============================================================================
  // MARKETPLACE ADMIN ENDPOINTS
  // ============================================================================

  if (pathname === '/api/admin/assets' && req.method === 'GET') {
    const scopedAuth = await validateWithRBAC(req, pool, 'ASSET.VIEW_ADMIN');
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    await logPrivilegedCall(req, {
      actionType: 'ASSET.VIEW_ADMIN', route: pathname, userId: scopedAuth.userId,
      role: scopedAuth.role
    });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const statusFilter = url.searchParams.get('status') || 'draft';

    try {
      const result = await pool.query(
        `SELECT id, name, title, category, status, created_at, updated_at
         FROM market_items
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [statusFilter.toUpperCase()]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, assets: result.rows }));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, assets: [] }));
    }
    return true;
  }

  if (pathname.match(/^\/api\/admin\/assets\/[^/]+\/approve$/) && req.method === 'POST') {
    const assetId = pathname.split('/')[4];
    const scopedAuth = await validateWithRBAC(req, pool, 'ASSET.APPROVE');
    
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, {
        actionType: 'ASSET.APPROVE', route: pathname, userId: scopedAuth.userId,
        role: scopedAuth.role, payload: { assetId }
      });

      await pool.query(
        `UPDATE market_items SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
        [assetId]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Asset approved' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname.match(/^\/api\/admin\/assets\/[^/]+\/reject$/) && req.method === 'POST') {
    const assetId = pathname.split('/')[4];
    const scopedAuth = await validateWithRBAC(req, pool, 'MODERATION.REJECT');
    
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, {
        actionType: 'ASSET.REJECT', route: pathname, userId: scopedAuth.userId,
        role: scopedAuth.role, payload: { assetId, reason: body?.reason }
      });

      await pool.query(
        `UPDATE market_items SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1`,
        [assetId]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Asset rejected' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/admin/settlements' && req.method === 'GET') {
    const scopedAuth = await validateWithRBAC(req, pool, 'SETTLEMENT.VIEW');
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    await logPrivilegedCall(req, {
      actionType: 'SETTLEMENT.VIEW', route: pathname, userId: scopedAuth.userId,
      role: scopedAuth.role
    });

    try {
      const result = await pool.query(
        `SELECT id, network_id, period_start, period_end, status, total_solar, created_at
         FROM settlements
         ORDER BY created_at DESC
         LIMIT 50`
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settlements: result.rows }));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settlements: [] }));
    }
    return true;
  }

  if (pathname.match(/^\/api\/admin\/settlements\/[^/]+$/) && req.method === 'GET') {
    const scopedAuth = await validateWithRBAC(req, pool, 'SETTLEMENT.VIEW');
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    const settlementId = pathname.split('/')[4];

    await logPrivilegedCall(req, {
      actionType: 'SETTLEMENT.VIEW_DETAIL', route: pathname, userId: scopedAuth.userId,
      role: scopedAuth.role, metadata: { settlementId }
    });

    try {
      const result = await pool.query(
        `SELECT * FROM settlements WHERE id = $1`,
        [settlementId]
      );

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Settlement not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settlement: result.rows[0] }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/actions' && req.method === 'GET') {
    const actions = getAllActions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      count: actions.length,
      actions: actions.map(a => ({
        id: a.id,
        description: a.description,
        riskLevel: a.riskLevel,
        requiresApproval: a.requiresApproval || false
      }))
    }));
    return true;
  }

  if (pathname === '/api/agentic/actions/high-risk' && req.method === 'GET') {
    const actions = getHighRiskActions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      count: actions.length,
      actions
    }));
    return true;
  }

  if (pathname === '/api/agentic/action' && req.method === 'POST') {
    if (!body || !body.actionType) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing actionType' }));
      return true;
    }

    const action = getActionById(body.actionType);
    if (!action) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown action type' }));
      return true;
    }
    
    const isHighRisk = action.riskLevel === 'high' || action.riskLevel === 'critical';
    const isMediumRisk = action.riskLevel === 'medium';
    const hasAgentId = !!body.agentId;
    const requiresApproval = action.requiresApproval;
    
    let verifiedAgentId = null;
    let isAuthenticated = false;
    
    if (hasAgentId || isHighRisk || isMediumRisk || requiresApproval) {
      const authResult = await validateApiKey(req, pool);
      
      if (authResult.valid) {
        verifiedAgentId = authResult.agent.id;
        isAuthenticated = true;
      } else if (isHighRisk || (hasAgentId && body.agentId !== 'anonymous-client')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: authResult.error || 'Agent authentication required',
          hint: 'Provide X-Agent-API-Key and X-Agent-Id headers'
        }));
        return true;
      }
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: body.actionType,
        agentId: verifiedAgentId || 'anonymous-client',
        agentName: isAuthenticated ? body.agentName : undefined,
        requesterId: body.requesterId,
        payload: body.payload || {},
        metadata: { 
          ...body.metadata, 
          authenticated: isAuthenticated,
          authSource: isAuthenticated ? 'api-key' : 'anonymous'
        }
      });

      res.writeHead(result.status === 'rejected' ? 400 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/action/status' && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const requestId = url.searchParams.get('requestId');
    
    if (!requestId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing requestId parameter' }));
      return true;
    }

    try {
      const status = await executorInstance.getActionStatus(requestId);
      if (!status) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Action request not found' }));
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...status }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/action/approve' && req.method === 'POST') {
    if (!body || !body.requestId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing requestId' }));
      return true;
    }
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }

    const scopedAuth = await validateWithRBAC(req, pool, 'actions.approve');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.approve', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.approve', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId: body.requestId } });
      const approverId = scopedAuth.userId || body.approverId;
      const result = await executorInstance.approveAction(body.requestId, approverId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...result, approvedBy: approverId }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/action/reject' && req.method === 'POST') {
    if (!body || !body.requestId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing requestId' }));
      return true;
    }
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }

    const scopedAuth = await validateWithRBAC(req, pool, 'actions.reject');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.reject', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.reject', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId: body.requestId, reason: body.reason } });
      const rejectorId = scopedAuth.userId || body.rejectorId;
      const result = await executorInstance.rejectAction(
        body.requestId, 
        rejectorId, 
        body.reason || 'Rejected by admin'
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...result, rejectedBy: rejectorId }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/action/execute' && req.method === 'POST') {
    if (!body || !body.requestId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing requestId' }));
      return true;
    }
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }

    const scopedAuth = await validateWithRBAC(req, pool, 'actions.execute');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.execute', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Executor access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.execute', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId: body.requestId } });
      const executorId = scopedAuth.userId || body.executorId || 'system';
      const result = await executorInstance.triggerExecution(body.requestId, executorId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result, executedBy: executorId }));
    } catch (error) {
      res.writeHead(error.message.includes('Cannot execute') ? 400 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  const actionsMatch = pathname.match(/^\/api\/agentic\/actions\/([^\/]+)$/);
  if (actionsMatch && req.method === 'GET') {
    const requestId = actionsMatch[1];
    try {
      const status = await executorInstance.getActionStatus(requestId);
      if (!status) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Action request not found' }));
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...status }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  const approveMatch = pathname.match(/^\/api\/agentic\/actions\/([^\/]+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const requestId = approveMatch[1];
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'actions.approve');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.approve', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.approve', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId } });
      const approverId = scopedAuth.userId || body?.approverId || 'admin';
      const result = await executorInstance.approveAction(requestId, approverId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result, approvedBy: approverId }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  const executeMatch = pathname.match(/^\/api\/agentic\/actions\/([^\/]+)\/execute$/);
  if (executeMatch && req.method === 'POST') {
    const requestId = executeMatch[1];
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'actions.execute');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.execute', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Executor access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.execute', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId } });
      const executorId = scopedAuth.userId || body?.executorId || 'admin';
      const result = await executorInstance.triggerExecution(requestId, executorId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result, executedBy: executorId }));
    } catch (error) {
      res.writeHead(error.message.includes('Cannot execute') ? 400 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  const rejectMatch = pathname.match(/^\/api\/agentic\/actions\/([^\/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const requestId = rejectMatch[1];
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'actions.reject');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'actions.reject', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { actionType: 'actions.reject', route: pathname, userId: scopedAuth.userId, role: scopedAuth.role, payload: { requestId, reason: body?.reason } });
      const rejectorId = scopedAuth.userId || body?.rejectorId || 'admin';
      const result = await executorInstance.rejectAction(requestId, rejectorId, body?.reason || 'Rejected by admin');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result, rejectedBy: rejectorId }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/pending' && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const agentId = url.searchParams.get('agentId');

    try {
      const pending = await executorInstance.getPendingActions(agentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: pending.length, actions: pending }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/actions/list' && req.method === 'GET') {
    const adminAuth = await validateAdminAccess(req, pool);
    if (!adminAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin access required', reason: adminAuth.error }));
      return true;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const status = url.searchParams.get('status');

    try {
      const actions = await executorInstance.getAllActions(limit, status);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: actions.length, actions }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/commissioning/capabilities' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      ...commissioningAgentInstance.getCapabilities()
    }));
    return true;
  }

  if (pathname === '/api/agentic/commissioning/start' && req.method === 'POST') {
    const sessionId = body?.sessionId || `session_${Date.now()}`;
    const result = commissioningAgentInstance.startConversation(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sessionId, ...result }));
    return true;
  }

  if (pathname === '/api/agentic/commissioning/input' && req.method === 'POST') {
    if (!body || !body.sessionId || !body.fieldName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing sessionId or fieldName' }));
      return true;
    }

    const result = commissioningAgentInstance.processInput(
      body.sessionId,
      body.fieldName,
      body.value
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
    return true;
  }

  if (pathname === '/api/agentic/commissioning/submit' && req.method === 'POST') {
    if (!body || !body.sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing sessionId' }));
      return true;
    }

    try {
      const result = await commissioningAgentInstance.submitNetworkCreation(
        body.sessionId,
        body.confirmed || false
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/commissioning/create-direct' && req.method === 'POST') {
    if (!body || !body.networkSpec) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing networkSpec' }));
      return true;
    }

    try {
      const result = await commissioningAgentInstance.createNetworkDirect(body.networkSpec);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/networks' && req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT * FROM network_specs ORDER BY created_at DESC LIMIT 50'
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: result.rows.length, networks: result.rows }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/agents' && req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT id, agent_name, agent_type, description, allowed_actions, max_risk_level, is_active, last_activity FROM agent_registry ORDER BY created_at DESC'
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: result.rows.length, agents: result.rows }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/audit-log' && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const actionRequestId = url.searchParams.get('actionRequestId');
    const limit = parseInt(url.searchParams.get('limit')) || 100;

    try {
      let query = 'SELECT * FROM action_audit_log';
      const params = [];
      
      if (actionRequestId) {
        query += ' WHERE action_request_id = $1';
        params.push(actionRequestId);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await pool.query(query, params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: result.rows.length, entries: result.rows }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  // ============================================================================
  // MARKETPLACE OPERATIONS - Autonomy Spine v2
  // ============================================================================

  if (pathname === '/api/agentic/marketplace/asset' && req.method === 'POST') {
    try {
      const result = await executorInstance.submitAction({
        actionType: 'ASSET.CREATE',
        agentId: 'marketplace-agent-v1',
        agentName: 'Marketplace Agent',
        requesterId: body.userId || 'anonymous',
        payload: body.asset || body
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/enrich' && req.method === 'POST') {
    if (!body?.assetId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing assetId' }));
      return true;
    }
    try {
      const result = await executorInstance.submitAction({
        actionType: 'ASSET.ENRICH',
        agentId: 'marketplace-agent-v1',
        requesterId: body.userId || 'system',
        payload: { assetId: body.assetId, forceRefresh: body.forceRefresh }
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/price/quote' && req.method === 'POST') {
    if (!body?.assetId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing assetId' }));
      return true;
    }
    try {
      const result = await executorInstance.submitAction({
        actionType: 'PRICE.QUOTE',
        agentId: 'pricing-agent-v1',
        requesterId: body.userId || 'system',
        payload: { assetId: body.assetId, networkId: body.networkId || 'default' }
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/price/publish' && req.method === 'POST') {
    if (!body?.assetId || body.priceSolar === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing assetId or priceSolar' }));
      return true;
    }
    
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }

    const scopedAuth = await validateWithRBAC(req, pool, 'PRICE.PUBLISH');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'PRICE.PUBLISH', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required for price publishing' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { 
        actionType: 'PRICE.PUBLISH', route: pathname, userId: scopedAuth.userId, 
        role: scopedAuth.role, payload: body 
      });
      const result = await executorInstance.submitAction({
        actionType: 'PRICE.PUBLISH',
        agentId: 'pricing-agent-v1',
        requesterId: scopedAuth.userId || 'system',
        payload: body
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/list' && req.method === 'POST') {
    if (!body?.assetId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing assetId' }));
      return true;
    }

    const adminAuth = await validateAdminAccess(req, pool);
    if (!adminAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin access required for asset listing' }));
      return true;
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: 'ASSET.LIST',
        agentId: 'marketplace-agent-v1',
        requesterId: adminAuth.userId || 'system',
        payload: { assetId: body.assetId }
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/order' && req.method === 'POST') {
    if (!body?.items || !Array.isArray(body.items)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing items array' }));
      return true;
    }

    const userAuth = await validateUserSession(req, pool);
    if (!userAuth.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required for orders' }));
      return true;
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: 'ORDER.CREATE',
        agentId: 'order-agent-v1',
        requesterId: userAuth.userId,
        payload: {
          ...body,
          buyerId: userAuth.userId
        }
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/capture-payment' && req.method === 'POST') {
    if (!body?.orderId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing orderId' }));
      return true;
    }

    const userAuth = await validateUserSession(req, pool);
    if (!userAuth.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: userAuth.error || 'Authentication required' }));
      return true;
    }

    if (!userAuth.isAdmin) {
      const ownershipCheck = await validateOrderOwnership(pool, body.orderId, userAuth.userId);
      if (!ownershipCheck.valid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: ownershipCheck.error || 'Access denied' }));
        return true;
      }
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: 'ORDER.CAPTURE_PAYMENT',
        agentId: 'order-agent-v1',
        requesterId: userAuth.userId,
        payload: {
          orderId: body.orderId,
          paymentIntentId: body.paymentIntentId,
          solarAmount: body.solarAmount
        }
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/fulfill' && req.method === 'POST') {
    if (!body?.orderId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing orderId' }));
      return true;
    }

    const adminAuth = await validateAdminAccess(req, pool);
    if (!adminAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin access required for fulfillment' }));
      return true;
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: 'ORDER.FULFILL',
        agentId: 'fulfillment-agent-v1',
        requesterId: adminAuth.userId || 'staff',
        payload: body
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/ledger' && req.method === 'POST') {
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'LEDGER.POST');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'LEDGER.POST', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required for ledger operations' }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { 
        actionType: 'LEDGER.POST', route: pathname, userId: scopedAuth.userId, 
        role: scopedAuth.role, payload: body 
      });
      const result = await executorInstance.submitAction({
        actionType: 'LEDGER.POST',
        agentId: 'settlement-agent-v1',
        requesterId: scopedAuth.userId || 'system',
        payload: body
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/settlement' && req.method === 'POST') {
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'SETTLEMENT.RUN');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'SETTLEMENT.RUN', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required for settlement' }));
      return true;
    }

    const settlementPayload = {
      networkId: body.networkId || 'default',
      periodStart: body.periodStart || new Date(Date.now() - 24*60*60*1000).toISOString(),
      periodEnd: body.periodEnd || new Date().toISOString(),
      dryRun: body.dryRun || false
    };

    try {
      await logPrivilegedCall(req, { 
        actionType: 'SETTLEMENT.RUN', route: pathname, userId: scopedAuth.userId, 
        role: scopedAuth.role, payload: settlementPayload 
      });
      const result = await executorInstance.submitAction({
        actionType: 'SETTLEMENT.RUN',
        agentId: 'settlement-agent-v1',
        requesterId: scopedAuth.userId || 'system',
        payload: settlementPayload
      });
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/marketplace/action-types' && req.method === 'GET') {
    const { getAllActions } = require('./api-surface');
    const actions = getAllActions();
    const marketplaceActions = actions.filter(a => 
      a.id.startsWith('ASSET.') || 
      a.id.startsWith('PRICE.') || 
      a.id.startsWith('ORDER.') ||
      a.id.startsWith('LEDGER.') ||
      a.id.startsWith('SETTLEMENT.') ||
      a.id.startsWith('MODERATION.') ||
      a.id.startsWith('SEARCH.')
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: marketplaceActions.length, actions: marketplaceActions }));
    return true;
  }

  // ============================================================================
  // SCHEDULER OPERATIONS
  // ============================================================================

  if (pathname === '/api/agentic/scheduler/status' && req.method === 'GET') {
    const scopedAuth = await validateWithRBAC(req, pool, 'SCHEDULER.STATUS');
    if (!scopedAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    try {
      const jobs = await schedulerInstance.getJobStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, jobs, isRunning: schedulerInstance.isRunning }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/scheduler/trigger' && req.method === 'POST') {
    if (!req.headers['x-req-id']) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-Req-Id header required for privileged operations' }));
      return true;
    }
    
    const scopedAuth = await validateWithRBAC(req, pool, 'SCHEDULER.TRIGGER');
    if (!scopedAuth.valid) {
      await logPrivilegedCall(req, { actionType: 'SCHEDULER.TRIGGER', route: pathname, success: false, error: scopedAuth.error });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: scopedAuth.error || 'Admin access required' }));
      return true;
    }

    if (!body?.jobType) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing jobType', validTypes: Object.values(JOB_TYPES) }));
      return true;
    }

    try {
      await logPrivilegedCall(req, { 
        actionType: 'SCHEDULER.TRIGGER', route: pathname, userId: scopedAuth.userId, 
        role: scopedAuth.role, payload: body 
      });
      const result = await schedulerInstance.triggerJob(body.jobType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, jobType: body.jobType, result }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (pathname === '/api/agentic/scheduler/job-types' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, jobTypes: JOB_TYPES }));
    return true;
  }

  return false;
}

module.exports = {
  handleAgenticRoutes,
  initializeAgenticFramework,
  getExecutor,
  getCommissioningAgent,
  getScheduler
};
