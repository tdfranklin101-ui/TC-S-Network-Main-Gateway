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

const OSS_SIMULATOR_URL = 'https://open-source-eda-tdfranklin101.replit.app';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const protocolHash = getProtocolHash();

  const powerTwinInfo = {
    version: 'tcs-power-twin-v1',
    status: 'operational',
    description: 'Converts chip power traces into Solar energy costs using left Riemann integration',
    constants: {
      solar_kwh: SOLAR_STANDARD.KWH_PER_SOLAR,
      rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
      solar_standard: `1 Solar = ${SOLAR_STANDARD.KWH_PER_SOLAR} kWh`,
      rays_standard: `1 Solar = ${SOLAR_STANDARD.RAYS_PER_SOLAR.toLocaleString()} Solar Rays`,
      genesis_date: SOLAR_STANDARD.GENESIS_DATE,
      protocol_hash: protocolHash.substring(0, 16)
    },
    endpoints: {
      analyze: '/api/power-twin/analyze',
      calculate: '/api/power-twin/calculate',
      constants: '/api/power-twin/constants',
      simulator_status: '/api/power-twin/simulator/status',
      simulator_info: '/api/power-twin/simulator/info'
    },
    input_format: {
      csv: {
        required_columns: ['time_s', 'power_w'],
        description: 'CSV file with time in seconds and power in watts'
      },
      json: {
        required_fields: ['samples'],
        sample_format: { time_s: 'number', power_w: 'number' }
      }
    },
    integration_method: 'left_riemann',
    assumptions: [
      'Power value held constant until next timestamp',
      'Timestamps are monotonically increasing'
    ]
  };

  let simulatorStatus = 'unknown';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(OSS_SIMULATOR_URL, {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    simulatorStatus = response.ok ? 'online' : 'degraded';
  } catch {
    simulatorStatus = 'offline';
  }

  return res.status(200).json({
    success: true,
    power_twin: powerTwinInfo,
    simulator: {
      name: 'Open Silicon Stack',
      url: OSS_SIMULATOR_URL,
      status: simulatorStatus,
      features: [
        'VexRiscv RISC-V Core Simulation',
        'OpenRAM Memory Generator',
        'Skywater 130nm PDK',
        'OpenLane RTL-to-GDSII Flow'
      ]
    },
    integrity: {
      protocol_hash: protocolHash.substring(0, 16),
      check_url: '/api/integrity'
    },
    timestamp: new Date().toISOString()
  });
}
