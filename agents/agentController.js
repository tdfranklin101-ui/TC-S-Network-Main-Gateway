const { agents, walletBalances } = require('./index');
const { solarMetering } = require('./solarMetering');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  registerPersonal(req, res) {
    const { walletAddress, displayName } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const id = uuidv4();

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

    return res.json({ agent: agents[id] });
  },

  registerDomain(req, res) {
    const { serviceId, displayName, capabilities } = req.body;
    const id = uuidv4();

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

    return res.json({ agent: agents[id] });
  },

  getAgent(req, res) {
    const agent = agents[req.params.agentId];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent });
  },

  updateSettings(req, res) {
    const agent = agents[req.params.agentId];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { autonomyLevel, dailyLimitSolar, maxPerActionRays } = req.body;

    if (autonomyLevel) agent.autonomyLevel = autonomyLevel;
    if (dailyLimitSolar) agent.dailyLimitSolar = dailyLimitSolar;
    if (maxPerActionRays) agent.maxPerActionRays = maxPerActionRays;

    res.json({ agent });
  },

  async performAction(req, res) {
    const sourceId = req.params.agentId;
    const { actionType, payload } = req.body;

    try {
      const result = solarMetering(sourceId, actionType);
      res.json({ ok: true, result, payload });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};
