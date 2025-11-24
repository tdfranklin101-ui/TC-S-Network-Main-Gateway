const { agents, walletBalances } = require('./index');

const RAYS_PER_SOLAR = 10000;

function raysToSolar(rays) {
  return rays / RAYS_PER_SOLAR;
}

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

function solarMetering(agentId, actionType) {
  const agent = agents[agentId];
  if (!agent) throw new Error('Agent not found');

  const wallet = walletBalances[agent.walletAddress];
  if (!wallet) throw new Error('Wallet not found');

  const rays = costForAction(actionType);
  const solarCost = raysToSolar(rays);

  if (wallet.balanceSolar < solarCost) {
    throw new Error(`Insufficient Solar. Required ${solarCost}, have ${wallet.balanceSolar}`);
  }

  wallet.balanceSolar -= solarCost;

  return {
    actionType,
    raysCost: rays,
    solarCost,
    remainingSolar: wallet.balanceSolar
  };
}

module.exports = { solarMetering };
