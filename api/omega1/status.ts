import type { VercelRequest, VercelResponse } from '@vercel/node';

const OMEGA1_CONFIG = {
  SOLAR_STANDARD: 4913,
  RESERVE_TRACKER: 'https://solarreserves.thecurrentsee.org',
  FOUNDATION_GOV_URL: 'https://foundation.thecurrentsee.org'
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  const genesisDate = new Date('2025-04-07').getTime();
  const daysSinceGenesis = Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24));
  
  return res.status(200).json({
    system: 'Ω-1 Cosmic Trajectory Engine',
    version: '1.0.0',
    status: 'operational',
    uptime_days: daysSinceGenesis,
    genesis_date: '2025-04-07',
    network: {
      solar_standard: `1 Solar = ${OMEGA1_CONFIG.SOLAR_STANDARD} kWh`,
      reserve_tracker: OMEGA1_CONFIG.RESERVE_TRACKER,
      foundation_gov: OMEGA1_CONFIG.FOUNDATION_GOV_URL
    },
    indices: {
      solar_index: 71.1,
      compute_alignment: 85.2,
      energy_budget_utilization: 68.7,
      rights_alignment: 92.3
    },
    last_updated: new Date().toISOString()
  });
}
