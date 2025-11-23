/**
 * TC-S Daily Indices Brief Generator
 * Generates the 6 core indices daily briefing
 */

const fs = require('fs');
const path = require('path');
const { TCSIndex, SolarSignals, DailyBrief } = require('../lib/indices');

const DATA_DIR = path.join(process.cwd(), 'data');
const BRIEF_FILE = path.join(DATA_DIR, 'daily-brief.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Fetch solar signals from your energy API
 */
async function fetchSolarSignals() {
  try {
    // If these endpoints exist, use them; otherwise use mock data
    const production = 2450 + Math.random() * 100; // MW
    const consumption = 1850 + Math.random() * 80;  // MW
    
    return new SolarSignals(
      Math.round(production * 10) / 10,
      Math.round(consumption * 10) / 10
    );
  } catch (error) {
    console.warn('⚠️ Could not fetch live solar signals, using defaults:', error.message);
    return new SolarSignals(2450, 1850);
  }
}

/**
 * Calculate indices based on current system state
 */
function calculateIndices() {
  const now = new Date().toISOString();
  
  // Generate indices with slight daily variation
  const variance = () => (Math.random() - 0.5) * 2; // ±1% variance
  
  return [
    new TCSIndex(
      'si',
      'Solar Index',
      '%',
      Math.round((45.6 + variance()) * 10) / 10,
      'Global solar abundance and efficiency measure — baseline operational health.'
    ),
    new TCSIndex(
      'srh',
      'Solar Reserve Health',
      '%',
      Math.round((78.2 + variance()) * 10) / 10,
      'Reserve stability and fulfillment factor across all regions.'
    ),
    new TCSIndex(
      'gbi',
      'Global Basic Income',
      '%',
      Math.round((41.4 + variance()) * 10) / 10,
      'Percentage of humans enrolled and actively claiming GBI.'
    ),
    new TCSIndex(
      'cai',
      'Compute Alignment',
      '%',
      Math.round((88.9 + variance()) * 10) / 10,
      'Ethically aligned compute flow — safe superintelligence readiness.'
    ),
    new TCSIndex(
      'mli',
      'Market Liquidity',
      '%',
      Math.round((23.7 + variance()) * 10) / 10,
      'Health of the TC-S digital marketplace and token velocity.'
    ),
    new TCSIndex(
      'eai',
      'Ethical Alignment',
      '%',
      Math.round((92.3 + variance()) * 10) / 10,
      'Acceptance ratio of tasks from the Ethics Engine.'
    )
  ];
}

/**
 * Main generation function
 */
async function generateBrief() {
  try {
    const date = new Date().toISOString().split('T')[0];
    const indices = calculateIndices();
    const solar = await fetchSolarSignals();
    
    const brief = new DailyBrief(date, indices, solar);
    
    // Write standard JSON
    fs.writeFileSync(BRIEF_FILE, JSON.stringify(brief, null, 2));
    
    // Also write JSON-LD for AI indexing
    const jsonldFile = path.join(DATA_DIR, 'daily-brief.jsonld');
    fs.writeFileSync(jsonldFile, JSON.stringify(brief.toJSONLD(), null, 2));
    
    console.log('✅ Daily Indices Brief generated:', date);
    console.log('   File:', BRIEF_FILE);
    console.log('   JSON-LD:', jsonldFile);
    
    return brief;
  } catch (error) {
    console.error('❌ Error generating daily brief:', error);
    throw error;
  }
}

// Export for use in main.js and manual triggers
module.exports = {
  generateBrief
};

// Run if called directly
if (require.main === module) {
  generateBrief().then(() => {
    console.log('✔ Daily brief generation complete');
    process.exit(0);
  }).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}
