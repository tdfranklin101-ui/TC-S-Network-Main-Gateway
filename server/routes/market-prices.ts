import express from "express";
import fetch from "node-fetch";

const router = express.Router();

interface PriceCache {
  btc: { price: number; timestamp: number } | null;
  brent: { price: number; timestamp: number } | null;
}

const priceCache: PriceCache = {
  btc: null,
  brent: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch Bitcoin price from CoinGecko API (free, no API key required)
 */
async function fetchBTCPrice(): Promise<number | null> {
  // Check cache first
  if (priceCache.btc && Date.now() - priceCache.btc.timestamp < CACHE_DURATION) {
    return priceCache.btc.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('CoinGecko API error:', response.status);
      return priceCache.btc?.price || null;
    }

    const data = await response.json() as { bitcoin?: { usd?: number } };
    const price = data?.bitcoin?.usd;
    
    if (price) {
      priceCache.btc = { price, timestamp: Date.now() };
      return price;
    }
    
    return priceCache.btc?.price || null;
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    return priceCache.btc?.price || null;
  }
}

/**
 * Fetch Brent Crude oil price from EIA API
 * Uses EIA_API_KEY environment variable
 */
async function fetchBrentPrice(): Promise<number | null> {
  // Check cache first
  if (priceCache.brent && Date.now() - priceCache.brent.timestamp < CACHE_DURATION) {
    return priceCache.brent.price;
  }

  const apiKey = process.env.EIA_API_KEY;
  
  if (!apiKey) {
    console.warn('EIA_API_KEY not configured, using fallback price');
    return priceCache.brent?.price || 73.50; // Fallback to approximate current price
  }

  try {
    // EIA API v2 for Brent Crude spot prices
    const response = await fetch(
      `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${apiKey}&frequency=daily&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&length=1`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('EIA API error:', response.status);
      return priceCache.brent?.price || 73.50;
    }

    const data = await response.json() as { 
      response?: { 
        data?: Array<{ value?: number }> 
      } 
    };
    
    const price = data?.response?.data?.[0]?.value;
    
    if (price) {
      priceCache.brent = { price, timestamp: Date.now() };
      return price;
    }
    
    return priceCache.brent?.price || 73.50;
  } catch (error) {
    console.error('Error fetching Brent price:', error);
    return priceCache.brent?.price || 73.50;
  }
}

/**
 * GET /api/market-prices
 * Returns current BTC, Brent Crude prices and Solar equivalent values
 */
router.get('/', async (req, res) => {
  try {
    // Fetch both prices in parallel
    const [btcPrice, brentPrice] = await Promise.all([
      fetchBTCPrice(),
      fetchBrentPrice()
    ]);

    // Solar Standard constant: 1 Solar = 4913 kWh
    const SOLAR_KWH = 4913;
    
    // Calculate Solar equivalents (based on average energy costs)
    // Average US electricity cost: ~$0.12/kWh
    const ELECTRICITY_COST_PER_KWH = 0.12;
    const solarUsdValue = SOLAR_KWH * ELECTRICITY_COST_PER_KWH; // ~$589.56

    // Calculate index values (normalized to 100 for USD baseline)
    const fiatIndex = 100; // USD baseline
    const btcIndex = btcPrice ? Math.round((btcPrice / 1000) * 1.2) : null; // Scaled for chart visibility
    const solarIndex = Math.round((solarUsdValue / 10) * 1.5); // Scaled for chart visibility

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      prices: {
        btc: {
          price: btcPrice,
          currency: 'USD',
          symbol: 'BTC',
          name: 'Bitcoin',
          solarEquivalent: btcPrice ? (btcPrice / solarUsdValue).toFixed(4) : null,
          lastUpdated: priceCache.btc?.timestamp ? new Date(priceCache.btc.timestamp).toISOString() : null
        },
        brent: {
          price: brentPrice,
          currency: 'USD',
          unit: 'barrel',
          symbol: 'RBRTE',
          name: 'Brent Crude Oil',
          solarEquivalent: brentPrice ? (brentPrice / solarUsdValue).toFixed(4) : null,
          lastUpdated: priceCache.brent?.timestamp ? new Date(priceCache.brent.timestamp).toISOString() : null
        },
        solar: {
          kwhValue: SOLAR_KWH,
          usdValue: solarUsdValue.toFixed(2),
          name: 'Solar Token',
          description: '1 Solar = 4,913 kWh renewable energy'
        }
      },
      indices: {
        fiat: { name: 'Fiat (USD)', value: fiatIndex, unit: '' },
        btc: { name: 'Crypto (BTC)', value: btcIndex, unit: '' },
        solar: { name: 'Solar Index', value: solarIndex, unit: '%' },
        brent: { name: 'Brent Crude', value: Math.round(brentPrice ? brentPrice * 1.3 : 96), unit: '' }
      },
      disclaimer: 'Any Solar/Fiat value shown is for demonstration purposes only. Solar is not legal tender, security, or financial instrument.',
      chartData: generateChartData(btcPrice, brentPrice)
    });
  } catch (error) {
    console.error('Error in market-prices endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/market-prices/btc
 * Returns only Bitcoin price
 */
router.get('/btc', async (req, res) => {
  try {
    const price = await fetchBTCPrice();
    res.json({
      success: true,
      symbol: 'BTC',
      name: 'Bitcoin',
      price,
      currency: 'USD',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch BTC price' });
  }
});

/**
 * GET /api/market-prices/brent
 * Returns only Brent Crude price
 */
router.get('/brent', async (req, res) => {
  try {
    const price = await fetchBrentPrice();
    res.json({
      success: true,
      symbol: 'RBRTE',
      name: 'Brent Crude Oil',
      price,
      currency: 'USD',
      unit: 'barrel',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch Brent price' });
  }
});

/**
 * Generate chart data for historical trend (last 14 days simulated)
 */
function generateChartData(currentBtc: number | null, currentBrent: number | null) {
  const days = 14;
  const labels: string[] = [];
  const fiatData: number[] = [];
  const btcData: number[] = [];
  const solarData: number[] = [];
  const brentData: number[] = [];

  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    // Fiat stays at 100 (baseline)
    fiatData.push(100);
    
    // Simulate historical data with slight variations
    const dayVariation = Math.sin(i * 0.5) * 5 + (Math.random() - 0.5) * 3;
    
    // BTC index (scaled from current price with historical variation)
    if (currentBtc) {
      const btcBase = (currentBtc / 1000) * 1.2;
      btcData.push(Math.round(btcBase + dayVariation * 2));
    } else {
      btcData.push(95 + Math.round(dayVariation));
    }
    
    // Solar index (relatively stable, slight upward trend)
    solarData.push(Math.round(88 + (days - i) * 0.3 + dayVariation * 0.5));
    
    // Brent crude (converted to index)
    if (currentBrent) {
      const brentBase = currentBrent * 1.3;
      brentData.push(Math.round(brentBase + dayVariation));
    } else {
      brentData.push(95 + Math.round(dayVariation));
    }
  }

  return {
    labels,
    datasets: {
      fiat: fiatData,
      btc: btcData,
      solar: solarData,
      brent: brentData
    }
  };
}

export default router;
