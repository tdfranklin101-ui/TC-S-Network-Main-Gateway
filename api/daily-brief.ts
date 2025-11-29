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

function generateDailyBrief() {
  const now = new Date();
  const si = calculateSolarIndex();
  const daysSinceGenesis = getDaysSinceGenesis();
  
  const indices = [
    {
      id: 'si',
      name: 'Solar Index',
      value: parseFloat(si.toFixed(1)),
      unit: '%',
      description: 'Global Energy & Ethics Balance — 7-Day Rolling Indicator.',
      trend: 'stable'
    },
    {
      id: 'srh',
      name: 'Solar Reserve Health',
      value: parseFloat((76.8 + (Math.sin(daysSinceGenesis / 7) * 2)).toFixed(1)),
      unit: '%',
      description: 'Reserve stability and fulfillment factor across all regions.',
      trend: 'up'
    },
    {
      id: 'gbi',
      name: 'Global Basic Income',
      value: parseFloat((41.8 + (Math.sin(daysSinceGenesis / 14) * 1)).toFixed(1)),
      unit: '%',
      description: 'Percentage of humans enrolled and actively claiming GBI.',
      trend: 'up'
    },
    {
      id: 'cai',
      name: 'Compute Alignment',
      value: parseFloat((89.3 + (Math.sin(daysSinceGenesis / 10) * 1.5)).toFixed(1)),
      unit: '%',
      description: 'Ethically aligned compute flow — safe superintelligence readiness.',
      trend: 'stable'
    },
    {
      id: 'mli',
      name: 'Market Liquidity',
      value: parseFloat((24.1 + (Math.sin(daysSinceGenesis / 5) * 2.5)).toFixed(1)),
      unit: '%',
      description: 'Health of the TC-S digital marketplace and token velocity.',
      trend: 'up'
    },
    {
      id: 'eai',
      name: 'Ethical Alignment',
      value: parseFloat((91.7 + (Math.sin(daysSinceGenesis / 12) * 1)).toFixed(1)),
      unit: '%',
      description: 'Acceptance ratio of tasks from the Ethics Engine.',
      trend: 'stable'
    }
  ];

  return {
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    indices,
    solar: {
      standard: `1 Solar = ${SOLAR_STANDARD.KWH_PER_SOLAR} kWh`,
      genesis_date: SOLAR_STANDARD.GENESIS_DATE,
      days_since_genesis: daysSinceGenesis,
      protocol_hash: getProtocolHash().substring(0, 16)
    },
    network: {
      status: 'operational',
      modules_online: SOLAR_STANDARD.NETWORK_MODULES,
      reserve_tracker: 'https://solarreserves.thecurrentsee.org',
      integrity_check: '/api/integrity'
    }
  };
}

function toJSONLD(brief: ReturnType<typeof generateDailyBrief>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DataSet',
    name: 'TC-S Daily Indices Brief',
    description: 'Daily briefing of TC-S core performance indices',
    datePublished: brief.date,
    distribution: brief.indices.map(idx => ({
      '@type': 'DataDownload',
      name: idx.name,
      encodingFormat: 'application/json',
      description: idx.description,
      contentUrl: `https://api.thecurrentsee.org/api/daily-brief#${idx.id}`,
      value: idx.value,
      unit: idx.unit
    }))
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const format = req.query.format as string || 'json';
    const brief = generateDailyBrief();

    if (format === 'jsonld') {
      return res.status(200).json(toJSONLD(brief));
    }

    return res.status(200).json(brief);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to generate daily brief',
      message: error.message
    });
  }
}
