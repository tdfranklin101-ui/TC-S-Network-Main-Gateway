/**
 * The Current-See Status Check Utility
 * 
 * This script performs a comprehensive status check of the application's
 * critical components, including database connectivity and OpenAI integration.
 * 
 * Usage: node check-status.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

console.log(`\n${colors.magenta}===== The Current-See Status Check =====\n${colors.reset}`);

// Check OpenAI feature state
const OPENAI_STATE_FILE = path.join(__dirname, '.openai-feature-state.json');
console.log(`${colors.cyan}Checking OpenAI feature state:${colors.reset}`);

let openAIFeaturesEnabled = false;
try {
  if (fs.existsSync(OPENAI_STATE_FILE)) {
    const stateData = fs.readFileSync(OPENAI_STATE_FILE, 'utf8');
    const state = JSON.parse(stateData);
    openAIFeaturesEnabled = state.apiWorking === true;
    console.log(`OpenAI features: ${openAIFeaturesEnabled ? colors.green + 'ENABLED' : colors.yellow + 'DISABLED'}${colors.reset}`);
  } else {
    console.log(`${colors.yellow}No OpenAI feature state file found. Features are DISABLED by default.${colors.reset}`);
  }
} catch (stateError) {
  console.error(`${colors.red}Error reading OpenAI feature state file: ${stateError.message}${colors.reset}`);
}

// Check OpenAI API key
console.log(`\n${colors.cyan}Checking OpenAI API key:${colors.reset}`);
let apiKey = process.env.OPENAI_API_KEY;
let apiKeySource = 'environment variable';

if (!apiKey) {
  try {
    const envFilePath = path.join(__dirname, '.env.openai');
    if (fs.existsSync(envFilePath)) {
      const envFileContent = fs.readFileSync(envFilePath, 'utf8');
      const match = envFileContent.match(/OPENAI_API_KEY=(.+)/);
      if (match && match[1]) {
        apiKey = match[1].trim();
        apiKeySource = '.env.openai file';
      }
    }
  } catch (err) {
    console.error(`${colors.red}Error reading .env.openai file: ${err.message}${colors.reset}`);
  }
}

if (apiKey) {
  console.log(`API key found in ${apiKeySource}`);
  console.log(`API key first 10 characters: ${apiKey.substring(0, 10)}...`);
  
  if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-')) {
    console.log(`API key format: Traditional (starts with sk-)`);
  } else if (apiKey.startsWith('sk-proj-')) {
    console.log(`API key format: Project-scoped (starts with sk-proj-)`);
  } else {
    console.log(`${colors.yellow}API key format: Unknown format${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}No OpenAI API key found.${colors.reset}`);
}

// Check database connection
console.log(`\n${colors.cyan}Checking database connection:${colors.reset}`);
async function checkDatabase() {
  try {
    const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
    
    if (!dbUrl) {
      console.log(`${colors.yellow}No database URL available. Set CURRENTSEE_DB_URL or DATABASE_URL environment variable.${colors.reset}`);
      return;
    }
    
    console.log(`Database URL found: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log(`${colors.green}✓ Database connection successful!${colors.reset}`);
    
    const result = await client.query('SELECT current_database() as db, current_user as user');
    console.log(`Connected to database: ${result.rows[0].db} as user: ${result.rows[0].user}`);
    
    // Check members table
    try {
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      console.log(`${colors.green}✓ Members table exists with ${membersResult.rows[0].count} records${colors.reset}`);
      
      // Get first few members
      const sampleMembers = await client.query('SELECT id, name, joined_date FROM members ORDER BY id ASC LIMIT 3');
      console.log(`Sample members:`);
      sampleMembers.rows.forEach(member => {
        console.log(`  ${member.id}: ${member.name} (joined: ${member.joined_date})`);
      });
    } catch (tableErr) {
      console.error(`${colors.red}Error: Members table not found or cannot be queried: ${tableErr.message}${colors.reset}`);
    }
    
    client.release();
  } catch (err) {
    console.error(`${colors.red}Database connection error: ${err.message}${colors.reset}`);
  }
}

// Check system info
console.log(`\n${colors.cyan}System information:${colors.reset}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Current directory: ${__dirname}`);

// Check current time and solar calculation
const startDate = new Date('2025-04-07T00:00:00Z');
const now = new Date();
const diffTime = Math.abs(now - startDate);
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

console.log(`\n${colors.cyan}Solar Generator data:${colors.reset}`);
console.log(`Current time: ${now.toISOString()}`);
console.log(`Start date: ${startDate.toISOString()}`);
console.log(`Days running: ${diffDays}`);
console.log(`Hours running: ${diffHours}`);

const hourlyKwH = 27777.778; // 2/3 of a million kWh per day, distributed hourly
const totalEnergyKwH = diffHours * hourlyKwH;
const totalEnergyMkWh = (totalEnergyKwH / 1000000).toFixed(6);
const totalValue = ((totalEnergyKwH / 4913) * 136000).toFixed(2);

console.log(`Total energy: ${totalEnergyMkWh} MkWh`);
console.log(`Total value: $${totalValue}`);

// Run the database check
checkDatabase().then(() => {
  console.log(`\n${colors.magenta}===== Status Check Complete =====\n${colors.reset}`);
});