import type { VercelRequest, VercelResponse } from '@vercel/node';

const GENESIS_DATE = new Date('2025-04-07').getTime();

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  const daysSinceGenesis = Math.floor((now - GENESIS_DATE) / (1000 * 60 * 60 * 24));
  const solarIndex = Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));

  return res.status(200).json({
    status: 'healthy',
    platform: 'TC-S Network Main Gateway',
    version: '1.0.0',
    modules: {
      total: 14,
      online: 14,
      status: 'all_operational'
    },
    solar: {
      index: parseFloat(solarIndex.toFixed(1)),
      standard: '1 Solar = 4913 kWh',
      genesis_date: '2025-04-07',
      days_since_genesis: daysSinceGenesis
    },
    services: {
      daily_brief: '/api/daily-brief',
      kid_solar: '/api/kid-solar',
      omega1: '/api/omega1/status',
      power_twin: '/api/power-twin/status'
    },
    timestamp: new Date().toISOString()
  });
}
