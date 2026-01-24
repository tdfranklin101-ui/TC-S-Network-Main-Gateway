/**
 * TC-S Network Foundation - Agentic Framework API Routes
 * Version: 1.0.1
 * 
 * Security Update: Added authentication and authorization checks
 */

const { ActionExecutor } = require('./executor');
const { CommissioningAgent } = require('./agents/commissioning-agent');
const { getAllActions, getHighRiskActions, getActionById, RISK_LEVELS } = require('./api-surface');

let executorInstance = null;
let commissioningAgentInstance = null;

const ADMIN_ROLES = ['admin', 'foundation', 'operator'];
const APPROVER_ROLES = ['admin', 'foundation', 'approver'];

async function initializeAgenticFramework(pool) {
  executorInstance = new ActionExecutor(pool);
  commissioningAgentInstance = new CommissioningAgent(pool);
  await commissioningAgentInstance.initialize();
  console.log('✅ Agentic Framework initialized');
  return { executor: executorInstance, commissioningAgent: commissioningAgentInstance };
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
  const userId = req.headers['x-user-id'];
  
  if (adminHeader === 'true' && adminKey === process.env.ADMIN_SECRET_KEY) {
    return { valid: true, role: 'admin', userId: 'system-admin' };
  }
  
  if (userId) {
    try {
      const result = await pool.query(
        'SELECT id, username, role FROM members WHERE id::text = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        const member = result.rows[0];
        const role = member.role || 'member';
        if (ADMIN_ROLES.includes(role)) {
          return { valid: true, role, userId: member.id };
        }
      }
    } catch (error) {
      console.error('Admin validation error:', error);
    }
  }
  
  return { valid: false, error: 'Admin access required' };
}

async function validateApproverAccess(req, pool) {
  const adminCheck = await validateAdminAccess(req, pool);
  if (adminCheck.valid && APPROVER_ROLES.includes(adminCheck.role)) {
    return adminCheck;
  }
  
  return { valid: false, error: 'Approver access required' };
}

async function handleAgenticRoutes(req, res, pathname, body, pool) {
  if (!executorInstance) {
    await initializeAgenticFramework(pool);
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

    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      const approverId = approverAuth.userId || body.approverId;
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

    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      const rejectorId = approverAuth.userId || body.rejectorId;
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

    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Executor access required' }));
      return true;
    }

    try {
      const executorId = approverAuth.userId || body.executorId || 'system';
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
    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      const approverId = approverAuth.userId || body?.approverId || 'admin';
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
    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Executor access required' }));
      return true;
    }

    try {
      const executorId = approverAuth.userId || body?.executorId || 'admin';
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
    const approverAuth = await validateApproverAccess(req, pool);
    if (!approverAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: approverAuth.error || 'Approver access required' }));
      return true;
    }

    try {
      const rejectorId = approverAuth.userId || body?.rejectorId || 'admin';
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
    try {
      const result = await executorInstance.submitAction({
        actionType: 'PRICE.PUBLISH',
        agentId: 'pricing-agent-v1',
        requesterId: body.userId || 'system',
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
    try {
      const result = await executorInstance.submitAction({
        actionType: 'ASSET.LIST',
        agentId: 'marketplace-agent-v1',
        requesterId: body.userId || 'system',
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
    if (!body?.buyerId || !body?.items || !Array.isArray(body.items)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing buyerId or items array' }));
      return true;
    }
    try {
      const result = await executorInstance.submitAction({
        actionType: 'ORDER.CREATE',
        agentId: 'order-agent-v1',
        requesterId: body.buyerId,
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

  if (pathname === '/api/agentic/marketplace/settlement' && req.method === 'POST') {
    const adminAuth = await validateAdminAccess(req, pool);
    if (!adminAuth.valid) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin access required for settlement' }));
      return true;
    }

    try {
      const result = await executorInstance.submitAction({
        actionType: 'SETTLEMENT.RUN',
        agentId: 'settlement-agent-v1',
        requesterId: adminAuth.userId || 'system',
        payload: {
          networkId: body.networkId || 'default',
          periodStart: body.periodStart || new Date(Date.now() - 24*60*60*1000).toISOString(),
          periodEnd: body.periodEnd || new Date().toISOString(),
          dryRun: body.dryRun || false
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

  return false;
}

module.exports = {
  handleAgenticRoutes,
  initializeAgenticFramework,
  getExecutor,
  getCommissioningAgent
};
