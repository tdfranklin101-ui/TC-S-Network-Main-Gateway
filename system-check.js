/**
 * The Current-See System Check Utility
 * 
 * This script performs a comprehensive check of the system components
 * including version information, feature flags, essential files,
 * OpenAI integration, database connection, and Solar Generator status.
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const openaiService = require('./openai-service');

// Configuration
const TIMEOUT = 10000; // 10 seconds timeout for async operations

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Check results counter
let passCount = 0;
let failCount = 0;
let warnCount = 0;

/**
 * Log a message with optional color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Log a section header
 */
function logSection(title) {
  console.log('\n' + colors.bright + colors.blue + '▓▒░ ' + title + ' ░▒▓' + colors.reset);
  console.log(colors.dim + '─'.repeat(60) + colors.reset);
}

/**
 * Log a check result
 */
function logCheck(name, status, message) {
  let statusSymbol = '';
  let statusColor = '';
  
  if (status === 'pass') {
    statusSymbol = '✓';
    statusColor = colors.green;
    passCount++;
  } else if (status === 'fail') {
    statusSymbol = '✗';
    statusColor = colors.red;
    failCount++;
  } else if (status === 'warn') {
    statusSymbol = '⚠';
    statusColor = colors.yellow;
    warnCount++;
  } else {
    statusSymbol = 'ℹ';
    statusColor = colors.blue;
  }
  
  console.log(`${statusColor}${statusSymbol} ${colors.bright}${name}${colors.reset}`);
  if (message) {
    console.log(`  ${message}`);
  }
}

/**
 * Check version information
 */
async function checkVersion() {
  logSection('Version Information');
  
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    logCheck('Package Version', 'pass', `${packageJson.name} v${packageJson.version}`);
    
    // Check for version constant in code files
    const files = ['index.js', 'server.js', 'pure-deployment.js'];
    let versionConstFound = false;
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const versionMatch = content.match(/APP_VERSION[^{]*{[^}]*version:\s*['"]([^'"]+)['"]/);
        if (versionMatch) {
          logCheck('App Version', 'pass', `${versionMatch[1]} (from ${file})`);
          versionConstFound = true;
          break;
        }
      }
    }
    
    if (!versionConstFound) {
      logCheck('App Version', 'warn', 'Could not find APP_VERSION constant in code files');
    }
  } catch (err) {
    logCheck('Version Check', 'fail', `Error: ${err.message}`);
  }
}

/**
 * Check feature flags
 */
async function checkFeatureFlags() {
  logSection('Feature Flags');
  
  try {
    // Check if features.json exists
    if (!fs.existsSync('features.json')) {
      logCheck('Features Configuration', 'warn', 'features.json file not found');
      return;
    }
    
    const features = JSON.parse(fs.readFileSync('features.json', 'utf8'));
    
    // List all features
    Object.entries(features).forEach(([key, value]) => {
      logCheck(
        `Feature: ${key}`, 
        value ? 'pass' : 'warn',
        value ? 'Enabled' : 'Disabled'
      );
    });
    
    // Check critical features
    const criticalFeatures = ['solarClock', 'database', 'openai', 'distributionSystem'];
    for (const feature of criticalFeatures) {
      if (features[feature] === undefined) {
        logCheck(`Critical Feature: ${feature}`, 'warn', 'Not defined in features.json');
      }
    }
  } catch (err) {
    logCheck('Feature Flags', 'fail', `Error: ${err.message}`);
  }
}

/**
 * Check essential files
 */
async function checkEssentialFiles() {
  logSection('Essential Files');
  
  const essentialFiles = [
    { path: 'pure-deployment.js', description: 'Main deployment server' },
    { path: 'openai-service.js', description: 'OpenAI integration service' },
    { path: 'openai-service-minimal.js', description: 'Fallback OpenAI service' },
    { path: 'db.js', description: 'Database module' },
    { path: 'server-db.js', description: 'Database functions for server' },
    { path: 'public/index.html', description: 'Main homepage' },
    { path: 'public/wallet-ai-features.html', description: 'Wallet & AI features page' }
  ];
  
  for (const file of essentialFiles) {
    try {
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        logCheck(
          file.path, 
          'pass', 
          `${file.description} - ${(stats.size / 1024).toFixed(1)} KB, modified ${stats.mtime.toLocaleString()}`
        );
      } else {
        logCheck(file.path, 'warn', `${file.description} - File not found`);
      }
    } catch (err) {
      logCheck(file.path, 'fail', `Error: ${err.message}`);
    }
  }
}

/**
 * Check OpenAI integration
 */
async function checkOpenAIIntegration() {
  logSection('OpenAI Integration');
  
  try {
    // Check if OpenAI service is available
    if (!openaiService) {
      logCheck('OpenAI Service', 'fail', 'OpenAI service module not available');
      return;
    }
    
    // Check for .env.openai file
    if (fs.existsSync('.env.openai')) {
      logCheck('.env.openai File', 'pass', 'File exists');
    } else {
      logCheck('.env.openai File', 'warn', 'File not found');
    }
    
    // Check if API key is available
    const keySource = openaiService.getKeySource ? openaiService.getKeySource() : 'unknown';
    logCheck('OpenAI API Key Source', 'info', keySource);
    
    // Check if isApiWorking function exists
    if (typeof openaiService.isApiWorking === 'function') {
      // Wait a moment for the async test to complete if it's still null
      if (openaiService.isApiWorking() === null) {
        logCheck('OpenAI API Status', 'info', 'Testing API connection, please wait...');
        
        // Wait up to 5 seconds for the connection test to complete
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (openaiService.isApiWorking() !== null) break;
        }
      }
      
      const isWorking = openaiService.isApiWorking();
      if (isWorking === null) {
        logCheck('OpenAI API Status', 'warn', 'API connection test did not complete in time');
      } else {
        logCheck(
          'OpenAI API Status', 
          isWorking ? 'pass' : 'warn',
          isWorking ? 'API is working' : 'API is not working (fallback mode)'
        );
      }
    } else {
      logCheck('OpenAI API Status', 'warn', 'Cannot determine API status (isApiWorking function not found)');
    }
    
    // Test a simple API call if we think the API is working
    const isApiWorking = openaiService.isApiWorking ? openaiService.isApiWorking() : false;
    if (isApiWorking) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), TIMEOUT);
        });
        
        const response = await Promise.race([
          openaiService.getEnergyAssistantResponse('What is solar energy?'),
          timeoutPromise
        ]);
        
        if (response && typeof response === 'string' && response.length > 50) {
          logCheck('OpenAI Test Query', 'pass', 'Successfully received response');
        } else {
          logCheck('OpenAI Test Query', 'warn', 'Received unexpected response format');
        }
      } catch (err) {
        logCheck('OpenAI Test Query', 'fail', `Error: ${err.message}`);
      }
    }
  } catch (err) {
    logCheck('OpenAI Integration', 'fail', `Error: ${err.message}`);
  }
}

/**
 * Check database connection
 */
async function checkDatabaseConnection() {
  logSection('Database Connection');
  
  try {
    // Check if database URL is available
    const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      logCheck('Database URL', 'warn', 'No database URL found in environment variables');
    } else {
      logCheck('Database URL', 'pass', 'Database URL is defined in environment variables');
    }
    
    // Try to connect to the database
    let dbPool;
    try {
      dbPool = new Pool({
        connectionString: dbUrl,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timed out')), TIMEOUT);
      });
      
      const client = await Promise.race([
        dbPool.connect(),
        timeoutPromise
      ]);
      
      logCheck('Database Connection', 'pass', 'Successfully connected to database');
      
      // Check database version
      const versionResult = await client.query('SELECT version()');
      logCheck('Database Version', 'pass', versionResult.rows[0].version.split(',')[0]);
      
      // Check tables
      const tablesResult = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      
      const tables = tablesResult.rows.map(row => row.table_name);
      logCheck('Database Tables', 'pass', `Found ${tables.length} tables: ${tables.join(', ')}`);
      
      // Check members table specifically
      if (tables.includes('members')) {
        const membersResult = await client.query('SELECT COUNT(*) FROM members');
        logCheck('Members Table', 'pass', `Contains ${membersResult.rows[0].count} records`);
        
        // Check for specific key members
        const reserveResult = await client.query("SELECT * FROM members WHERE name LIKE '%Reserve%' LIMIT 1");
        if (reserveResult.rows.length > 0) {
          logCheck('Solar Reserve Account', 'pass', `Found: ${reserveResult.rows[0].name}`);
        } else {
          logCheck('Solar Reserve Account', 'warn', 'No Solar Reserve account found in members table');
        }
      } else {
        logCheck('Members Table', 'warn', 'Members table not found in database');
      }
      
      client.release();
    } catch (err) {
      logCheck('Database Connection', 'fail', `Error: ${err.message}`);
    } finally {
      if (dbPool) {
        await dbPool.end();
      }
    }
  } catch (err) {
    logCheck('Database Check', 'fail', `Error: ${err.message}`);
  }
}

/**
 * Check Solar Generator status
 */
async function checkSolarGenerator() {
  logSection('Solar Generator Status');
  
  try {
    // Calculate days since launch (April 7, 2025)
    const launchDate = new Date('2025-04-07T00:00:00Z');
    const now = new Date();
    const daysRunning = Math.floor((now - launchDate) / (24 * 60 * 60 * 1000));
    
    logCheck('Days Running', 'pass', `${daysRunning} days since launch (April 7, 2025)`);
    
    // Calculate total energy (in MkWh)
    // 8 billion kWh per day
    const dailyEnergy = 8;
    const totalEnergyMkWh = (dailyEnergy * daysRunning) / 1000;
    logCheck('Total Energy', 'pass', `${totalEnergyMkWh.toFixed(6)} MkWh (${(totalEnergyMkWh * 1000).toFixed(2)} billion kWh)`);
    
    // Calculate total dollar value
    // $136,000 per SOLAR, 1 SOLAR = 4,913 kWh
    const kWhPerSolar = 4913;
    const dollarsPerSolar = 136000;
    const totalSolar = (totalEnergyMkWh * 1000 * 1000 * 1000) / kWhPerSolar;
    const totalValue = totalSolar * dollarsPerSolar;
    
    logCheck('Total Value', 'pass', `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  } catch (err) {
    logCheck('Solar Generator Check', 'fail', `Error: ${err.message}`);
  }
}

/**
 * Run all checks
 */
async function runAllChecks() {
  console.log(colors.bright + colors.cyan + '\n■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■' + colors.reset);
  console.log(colors.bright + colors.cyan + '■     THE CURRENT-SEE SYSTEM CHECK UTILITY                ■' + colors.reset);
  console.log(colors.bright + colors.cyan + '■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■' + colors.reset);
  console.log(`\nRunning system check on ${new Date().toLocaleString()}`);
  
  try {
    await checkVersion();
    await checkFeatureFlags();
    await checkEssentialFiles();
    await checkOpenAIIntegration();
    await checkDatabaseConnection();
    await checkSolarGenerator();
    
    // Print summary
    logSection('Summary');
    console.log(`${colors.green}✓ Passed: ${passCount}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Warnings: ${warnCount}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${failCount}${colors.reset}`);
    
    // Final status
    console.log('\n' + colors.bright + colors.blue + '▓▒░ SYSTEM STATUS ░▒▓' + colors.reset);
    console.log(colors.dim + '─'.repeat(60) + colors.reset);
    
    if (failCount === 0 && warnCount === 0) {
      console.log(colors.bright + colors.green + '✓ ALL SYSTEMS NOMINAL' + colors.reset);
    } else if (failCount === 0) {
      console.log(colors.bright + colors.yellow + '⚠ SYSTEMS OPERATIONAL WITH WARNINGS' + colors.reset);
    } else {
      console.log(colors.bright + colors.red + '✗ SYSTEM ISSUES DETECTED' + colors.reset);
    }
    
  } catch (err) {
    console.error(`\n${colors.red}Error running system check: ${err.message}${colors.reset}`);
    console.error(err.stack);
  }
}

// Run all checks
runAllChecks();