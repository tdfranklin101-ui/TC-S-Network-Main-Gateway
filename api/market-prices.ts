import type { VercelRequest, VercelResponse } from '@vercel/node';

const SOLAR_KWH = 4913;
const ELECTRICITY_COST_PER_KWH = 0.12;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const solarUsdValue = SOLAR_KWH * ELECTRICITY_COST_PER_KWH;

    let btcPrice: number | null = null;
    try {
      const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (btcResponse.ok) {
        const btcData = await btcResponse.json();
        btcPrice = btcData?.bitcoin?.usd || null;
      }
    } catch (err) {
      console.warn('BTC price fetch failed');
    }

    let brentPrice = 73.50;
    const eiaApiKey = process.env.EIA_API_KEY;
    if (eiaApiKey) {
      try {
        const brentResponse = await fetch(
          `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${eiaApiKey}&frequency=daily&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&length=1`
        );
        if (brentResponse.ok) {
          const brentData = await brentResponse.json() as { response?: { data?: Array<{ value?: number }> } };
          brentPrice = brentData?.response?.data?.[0]?.value || 73.50;
        }
      } catch (err) {
        console.warn('Brent price fetch failed');
      }
    }

    const fiatIndex = 100;
    const btcIndex = btcPrice ? Math.round((btcPrice / 1000) * 1.2) : 117;
    const solarIndex = Math.round((solarUsdValue / 10) * 1.5);
    const brentIndex = Math.round(brentPrice * 1.3);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      prices: {
        btc: {
          price: btcPrice || 97500,
          currency: 'USD',
          symbol: 'BTC',
          name: 'Bitcoin'
        },
        brent: {
          price: brentPrice,
          currency: 'USD',
          unit: 'barrel',
          symbol: 'RBRTE',
          name: 'Brent Crude Oil'
        },
        solar: {
          kwhValue: SOLAR_KWH,
          usdValue: solarUsdValue.toFixed(2),
          name: 'Solar Token'
        }
      },
      indices: {
        fiat: { name: 'Fiat (USD)', value: fiatIndex, unit: '' },
        btc: { name: 'Crypto (BTC)', value: btcIndex, unit: '' },
        solar: { name: 'Solar Index', value: solarIndex, unit: '%' },
        brent: { name: 'Brent Crude', value: brentIndex, unit: '' }
      },
      disclaimer: 'Any Solar/Fiat value shown is for demonstration purposes only. Solar is not legal tender, security, or financial instrument.'
    });
  } catch (error) {
    console.error('Market prices error:', error);
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      prices: {
        btc: { price: 97500, currency: 'USD', symbol: 'BTC', name: 'Bitcoin' },
        brent: { price: 73.50, currency: 'USD', unit: 'barrel', symbol: 'RBRTE', name: 'Brent Crude Oil' },
        solar: { kwhValue: SOLAR_KWH, usdValue: '589.56', name: 'Solar Token' }
      },
      indices: {
        fiat: { name: 'Fiat (USD)', value: 100, unit: '' },
        btc: { name: 'Crypto (BTC)', value: 117, unit: '' },
        solar: { name: 'Solar Index', value: 88, unit: '%' },
        brent: { name: 'Brent Crude', value: 96, unit: '' }
      },
      disclaimer: 'Any Solar/Fiat value shown is for demonstration purposes only. Solar is not legal tender, security, or financial instrument.',
      fallback: true
    });
  }
}
