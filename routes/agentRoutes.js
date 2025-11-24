const { agents, walletBalances } = require('../agents');
const { solarMetering } = require('../agents/solarMetering');
const { randomUUID } = require('crypto');

module.exports = async function(req, res, pathname, body) {
  // POST /api/agents/register-personal
  if (pathname === '/api/agents/register-personal' && req.method === 'POST') {
    const { walletAddress, displayName } = body;

    if (!walletAddress) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'walletAddress required' }));
      return true;
    }

    const id = randomUUID();

    agents[id] = {
      id,
      agentType: 'personal',
      walletAddress,
      displayName: displayName || `Agent-${id.slice(0, 6)}`,
      autonomyLevel: 'low',
      dailyLimitSolar: 1,
      maxPerActionRays: 10000,
      createdAt: new Date().toISOString()
    };

    walletBalances[walletAddress] = walletBalances[walletAddress] || { balanceSolar: 1 };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agent: agents[id] }));
    return true;
  }

  // POST /api/agents/register-domain
  if (pathname === '/api/agents/register-domain' && req.method === 'POST') {
    const { serviceId, displayName, capabilities } = body;
    const id = randomUUID();

    agents[id] = {
      id,
      agentType: 'domain',
      walletAddress: `service:${serviceId}`,
      displayName: displayName || serviceId,
      capabilities: capabilities || [],
      autonomyLevel: 'high',
      dailyLimitSolar: 1000,
      maxPerActionRays: 100000,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agent: agents[id] }));
    return true;
  }

  // GET /api/agents/:agentId
  const getAgentMatch = pathname.match(/^\/api\/agents\/([a-f0-9\-]+)$/);
  if (getAgentMatch && req.method === 'GET') {
    const agentId = getAgentMatch[1];
    const agent = agents[agentId];
    
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
    const agent = agents[agentId];
    
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return true;
    }

    const { autonomyLevel, dailyLimitSolar, maxPerActionRays } = body;

    if (autonomyLevel) agent.autonomyLevel = autonomyLevel;
    if (dailyLimitSolar) agent.dailyLimitSolar = dailyLimitSolar;
    if (maxPerActionRays) agent.maxPerActionRays = maxPerActionRays;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agent }));
    return true;
  }

  // POST /api/agents/:agentId/actions
  const actionsMatch = pathname.match(/^\/api\/agents\/([a-f0-9\-]+)\/actions$/);
  if (actionsMatch && req.method === 'POST') {
    const agentId = actionsMatch[1];
    const { actionType, payload } = body;

    try {
      const result = solarMetering(agentId, actionType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result, payload }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // GET /api/wallets/:walletAddress/balance
  const walletMatch = pathname.match(/^\/api\/wallets\/([^\/]+)\/balance$/);
  if (walletMatch && req.method === 'GET') {
    const walletAddress = decodeURIComponent(walletMatch[1]);
    const bal = walletBalances[walletAddress];
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(bal || { balanceSolar: 0 }));
    return true;
  }

  return false;
};
