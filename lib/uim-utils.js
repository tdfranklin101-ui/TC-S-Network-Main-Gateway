const crypto = require('crypto');

const SOLAR_CONSTANT = 4913;

function generateHandshakeSignature(system1, system2, timestamp) {
  const signatureData = `${system1}:${system2}:${timestamp}`;
  return crypto
    .createHash('sha256')
    .update(signatureData)
    .digest('hex');
}

function calculateSolarCost(kWh) {
  const kWhValue = parseFloat(kWh);
  if (isNaN(kWhValue) || kWhValue < 0) {
    return '0.0000';
  }
  
  const solarValue = kWhValue / SOLAR_CONSTANT;
  
  if (solarValue === 0) return '0.0000';
  
  let formatted = solarValue.toFixed(4);
  if (parseFloat(formatted) === 0 && solarValue > 0) {
    for (let decimals = 5; decimals <= 10; decimals++) {
      formatted = solarValue.toFixed(decimals);
      if (parseFloat(formatted) > 0) break;
    }
  }
  return formatted;
}

function calculateEthicsScore(geniusActCompliance, renewableSource) {
  let baseScore = 0;
  
  if (geniusActCompliance === 'FULL') {
    baseScore = 80;
  } else if (geniusActCompliance === 'PARTIAL') {
    baseScore = 50;
  } else if (geniusActCompliance === 'MINIMAL') {
    baseScore = 30;
  } else {
    baseScore = 0;
  }
  
  const renewableBonus = {
    'SOLAR': 20,
    'WIND': 15,
    'HYDRO': 10,
    'UNKNOWN': 0
  };
  
  const bonus = renewableBonus[renewableSource] || 0;
  const finalScore = Math.min(100, baseScore + bonus);
  
  return finalScore;
}

function selectRenewableSource() {
  const sources = ['SOLAR', 'WIND', 'HYDRO'];
  const weights = [0.6, 0.3, 0.1];
  
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (let i = 0; i < sources.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      return sources[i];
    }
  }
  
  return 'SOLAR';
}

function routeQueryByEthicsEnergy(systems) {
  if (!systems || systems.length === 0) {
    return null;
  }
  
  let bestSystem = null;
  let bestScore = -Infinity;
  
  for (const system of systems) {
    const ethicsScore = system.ethicsScore || 0;
    const solarCost = parseFloat(system.solarCost) || 0;
    
    const score = ethicsScore / (solarCost + 0.1);
    
    if (score > bestScore) {
      bestScore = score;
      bestSystem = system;
    }
  }
  
  return {
    system: bestSystem,
    score: bestScore,
    reasoning: `Selected ${bestSystem?.systemName} with ethics score ${bestSystem?.ethicsScore} and solar cost ${bestSystem?.solarCost} (efficiency: ${bestScore.toFixed(2)})`
  };
}

module.exports = {
  generateHandshakeSignature,
  calculateSolarCost,
  calculateEthicsScore,
  selectRenewableSource,
  routeQueryByEthicsEnergy,
  SOLAR_CONSTANT
};
