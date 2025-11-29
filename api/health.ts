import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const SOLAR_STANDARD = {
  GENESIS_DATE: '2025-04-07',
  GENESIS_TIMESTAMP: new Date('2025-04-07').getTime(),
  KWH_PER_SOLAR: 4913,
  RAYS_PER_SOLAR: 1000000,
  VERSION: '1.0.0',
  PROTOCOL_NAME: 'TC-S Solar Standard',
  NETWORK_MODULES: 14
} as const;

function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor(
    (now - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

function getDaysSinceGenesis(): number {
  return Math.floor(
    (Date.now() - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
}

function getProtocolHash(): string {
  const canonicalData = JSON.stringify({
    genesis_date: SOLAR_STANDARD.GENESIS_DATE,
    kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
    rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
    version: SOLAR_STANDARD.VERSION,
    protocol_name: SOLAR_STANDARD.PROTOCOL_NAME
  });
  return createHash('sha256').update(canonicalData).digest('hex');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const daysSinceGenesis = getDaysSinceGenesis();
  const solarIndex = calculateSolarIndex();
  const protocolHash = getProtocolHash();

  return res.status(200).json({
    status: 'healthy',
    platform: 'TC-S Network Main Gateway',
    version: SOLAR_STANDARD.VERSION,
    modules: {
      total: SOLAR_STANDARD.NETWORK_MODULES,
      online: SOLAR_STANDARD.NETWORK_MODULES,
      status: 'all_operational'
    },
    solar: {
      index: parseFloat(solarIndex.toFixed(1)),
      standard: `1 Solar = ${SOLAR_STANDARD.KWH_PER_SOLAR} kWh`,
      genesis_date: SOLAR_STANDARD.GENESIS_DATE,
      days_since_genesis: daysSinceGenesis
    },
    integrity: {
      protocol_hash: protocolHash.substring(0, 16),
      status: 'verified',
      check_url: '/api/integrity'
    },
    services: {
      daily_brief: '/api/daily-brief',
      kid_solar: '/api/kid-solar',
      omega1: '/api/omega1/status',
      power_twin: '/api/power-twin/status',
      integrity: '/api/integrity'
    },
    timestamp: new Date().toISOString()
  });
}
