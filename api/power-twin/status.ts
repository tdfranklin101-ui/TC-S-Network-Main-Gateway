import type { VercelRequest, VercelResponse } from '@vercel/node';

const SOLAR_KWH = 4913.0;
const RAYS_PER_SOLAR = 10000.0;
const OSS_SIMULATOR_URL = 'https://open-source-eda-tdfranklin101.replit.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const powerTwinInfo = {
    version: 'tcs-power-twin-v1',
    status: 'operational',
    description: 'Converts chip power traces into Solar energy costs using left Riemann integration',
    constants: {
      solar_kwh: SOLAR_KWH,
      rays_per_solar: RAYS_PER_SOLAR,
      solar_standard: `1 Solar = ${SOLAR_KWH} kWh`,
      rays_standard: '1 Solar = 10,000 Solar Rays'
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
    timestamp: new Date().toISOString()
  });
}
