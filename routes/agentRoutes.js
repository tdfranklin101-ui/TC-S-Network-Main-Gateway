const agentStorage = require('../agents/storage');

// Solar metering constants
const RAYS_PER_SOLAR = 10000;

function costForAction(actionType) {
  switch (actionType) {
    case 'create.artifact': return 200;
    case 'price.artifact': return 500;
    case 'analyze.risk': return 800;
    case 'access.compute': return 1000;
    case 'commission.project': return 10000;
    default: return 100;
  }
}

module.exports = async function(req, res, pathname, body) {
  try {
    // POST /api/agents/register-personal
    if (pathname === '/api/agents/register-personal' && req.method === 'POST') {
      const { walletAddress, displayName } = body || {};

      if (!walletAddress) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'walletAddress required' }));
        return true;
      }

      const agent = await agentStorage.createAgent({
        walletAddress,
        agentType: 'personal',
        displayName: displayName || `Agent-${walletAddress.slice(0, 6)}`,
        autonomyLevel: 'low',
        dailyLimitSolar: 1,
        maxPerActionRays: 10000
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agent }));
      return true;
    }

    // POST /api/agents/register-domain
    if (pathname === '/api/agents/register-domain' && req.method === 'POST') {
      const { serviceId, displayName, capabilities } = body || {};
      
      if (!serviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'serviceId required' }));
        return true;
      }

      const agent = await agentStorage.createAgent({
        walletAddress: `service:${serviceId}`,
        agentType: 'domain',
        displayName: displayName || serviceId,
        autonomyLevel: 'high',
        dailyLimitSolar: 1000,
        maxPerActionRays: 100000,
        capabilities: capabilities || []
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agent }));
      return true;
    }

    // GET /api/agents/:agentId
    const getAgentMatch = pathname.match(/^\/api\/agents\/([a-f0-9\-]+)$/);
    if (getAgentMatch && req.method === 'GET') {
      const agentId = getAgentMatch[1];
      const agent = await agentStorage.getAgent(agentId);
      
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agent }));
      return true;
    }

    // POST /api/agents/:agentId/settings
    const settingsMatch = pathname.match(/^\/api\/agents\/([a-f0-9\-]+)\/settings$/);
    if (settingsMatch && req.method === 'POST') {
      const agentId = settingsMatch[1];
      const agent = await agentStorage.getAgent(agentId);
      
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return true;
      }

      const { autonomyLevel, dailyLimitSolar, maxPerActionRays } = body || {};
      const updatedAgent = await agentStorage.updateAgent(agentId, {
        autonomyLevel,
        dailyLimitSolar,
        maxPerActionRays
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agent: updatedAgent }));
      return true;
    }

    // POST /api/agents/:agentId/actions
    const actionsMatch = pathname.match(/^\/api\/agents\/([a-f0-9\-]+)\/actions$/);
    if (actionsMatch && req.method === 'POST') {
      const agentId = actionsMatch[1];
      const { actionType, payload, targetAgentId } = body || {};

      // Get agent
      const agent = await agentStorage.getAgent(agentId);
      if (!agent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return true;
      }

      // Calculate cost
      const raysCost = costForAction(actionType);
      const solarCost = raysCost / RAYS_PER_SOLAR;

      // Check per-action limit
      if (raysCost > agent.maxPerActionRays) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Action exceeds max per-action Rays limit',
          details: { raysCost, maxPerActionRays: agent.maxPerActionRays }
        }));
        return true;
      }

      // Check balance
      const wallet = await agentStorage.getWalletBalance(agent.walletAddress);
      if (wallet.balanceSolar < solarCost) {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Insufficient Solar balance',
          details: { balanceSolar: wallet.balanceSolar, solarCost }
        }));
        return true;
      }

      // Deduct Solar
      const updatedWallet = await agentStorage.deductSolar(agent.walletAddress, solarCost);

      // Log action
      await agentStorage.logAction({
        agentId,
        targetAgentId,
        actionType,
        solarCost,
        raysCost,
        payload: payload || {}
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        result: {
          actionType,
          raysCost,
          solarCost,
          remainingSolar: updatedWallet.balanceSolar
        },
        payload
      }));
      return true;
    }

    // GET /api/wallets/:walletAddress/balance
    const walletMatch = pathname.match(/^\/api\/wallets\/([^\/]+)\/balance$/);
    if (walletMatch && req.method === 'GET') {
      const walletAddress = decodeURIComponent(walletMatch[1]);
      const wallet = await agentStorage.getWalletBalance(walletAddress);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(wallet));
      return true;
    }

  } catch (error) {
    console.error('❌ Agent route error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
    return true;
  }

  return false;
};
