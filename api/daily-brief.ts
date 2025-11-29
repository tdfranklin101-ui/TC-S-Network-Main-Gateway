import type { VercelRequest, VercelResponse } from '@vercel/node';

const GENESIS_DATE = new Date('2025-04-07').getTime();
const SOLAR_KWH = 4913;

function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor((now - GENESIS_DATE) / (1000 * 60 * 60 * 24));
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

function generateDailyBrief() {
  const now = new Date();
  const si = calculateSolarIndex();
  
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
      value: 76.8 + (Math.random() * 4 - 2),
      unit: '%',
      description: 'Reserve stability and fulfillment factor across all regions.',
      trend: 'up'
    },
    {
      id: 'gbi',
      name: 'Global Basic Income',
      value: 41.8 + (Math.random() * 2 - 1),
      unit: '%',
      description: 'Percentage of humans enrolled and actively claiming GBI.',
      trend: 'up'
    },
    {
      id: 'cai',
      name: 'Compute Alignment',
      value: 89.3 + (Math.random() * 3 - 1.5),
      unit: '%',
      description: 'Ethically aligned compute flow — safe superintelligence readiness.',
      trend: 'stable'
    },
    {
      id: 'mli',
      name: 'Market Liquidity',
      value: 24.1 + (Math.random() * 5 - 2.5),
      unit: '%',
      description: 'Health of the TC-S digital marketplace and token velocity.',
      trend: 'up'
    },
    {
      id: 'eai',
      name: 'Ethical Alignment',
      value: 91.7 + (Math.random() * 2 - 1),
      unit: '%',
      description: 'Acceptance ratio of tasks from the Ethics Engine.',
      trend: 'stable'
    }
  ];

  indices.forEach(idx => {
    idx.value = parseFloat(idx.value.toFixed(1));
  });

  return {
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    indices,
    solar: {
      standard: `1 Solar = ${SOLAR_KWH} kWh`,
      genesis_date: '2025-04-07',
      days_since_genesis: Math.floor((now.getTime() - GENESIS_DATE) / (1000 * 60 * 60 * 24))
    },
    network: {
      status: 'operational',
      modules_online: 14,
      reserve_tracker: 'https://solarreserves.thecurrentsee.org'
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
