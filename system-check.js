/**
 * The Current-See Comprehensive System Check
 * 
 * This script performs a complete system check across all components:
 * - Version information
 * - Database connection
 * - OpenAI integration
 * - Member data
 * - Solar Generator calculations
 * 
 * Usage: node system-check.js [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { execSync } = require('child_process');

// Check for verbose flag
const verbose = process.argv.includes('--verbose');

// Utility function for consistent logging
function log(title, message, type = 'info') {
  const prefix = type === 'info' ? '✅' : type === 'warn' ? '⚠️' : '❌';
  console.log(`${prefix} ${title}: ${message}`);
  
  if (verbose && type === 'error') {
    console.error('  Detailed error:', message);
  }
}

async function runSystemCheck() {
  console.log('\n=== THE CURRENT-SEE COMPREHENSIVE SYSTEM CHECK ===\n');
  
  // 1. Check version information
  console.log('📌 VERSION INFORMATION:');
  
  try {
    const deploymentFile = path.join(__dirname, 'pure-deployment.js');
    const data = fs.readFileSync(deploymentFile, 'utf8');
    const versionRegex = /const APP_VERSION = \{[\s\S]*?version: ['"]([^'"]+)['"][\s\S]*?name: ['"]([^'"]+)['"][\s\S]*?build: ['"]([^'"]+)['"]/;
    const match = data.match(versionRegex);
    
    if (match) {
      log('Application', match[2]);
      log('Version', `${match[1]} (Build ${match[3]})`);
      
      // Extract feature flags
      const featuresRegex = /features: \{([\s\S]*?)\}/;
      const featuresMatch = data.match(featuresRegex);
      
      if (featuresMatch) {
        console.log('\n📋 FEATURE FLAGS:');
        
        const featureLines = featuresMatch[1].trim().split('\n');
        for (const line of featureLines) {
          const featureMatch = line.match(/([a-zA-Z]+):\s*(true|false)/);
          if (featureMatch) {
            const feature = featureMatch[1];
            const enabled = featureMatch[2] === 'true';
            log(feature, enabled ? 'ENABLED' : 'DISABLED', enabled ? 'info' : 'warn');
          }
        }
      }
    } else {
      log('Version', 'Could not find version information', 'error');
    }
  } catch (err) {
    log('Version Check', 'Failed', 'error');
    if (verbose) console.error(err);
  }
  
  // 2. Check for essential files
  console.log('\n🔍 ESSENTIAL FILES:');
  
  const essentialFiles = [
    'pure-deployment.js',
    'check-status.js',
    'check-currentsee-db.js',
    'openai-service.js',
    'openai-service-minimal.js',
    '.openai-feature-state.json',
    '.env.openai'
  ];
  
  for (const file of essentialFiles) {
    try {
      if (fs.existsSync(path.join(__dirname, file))) {
        log(file, 'Present');
      } else {
        log(file, 'Missing', 'error');
      }
    } catch (err) {
      log(file, 'Error checking', 'error');
    }
  }
  
  // 3. Check OpenAI integration
  console.log('\n🤖 OPENAI INTEGRATION:');
  
  try {
    const openaiStateFile = path.join(__dirname, '.openai-feature-state.json');
    if (fs.existsSync(openaiStateFile)) {
      const stateData = fs.readFileSync(openaiStateFile, 'utf8');
      const state = JSON.parse(stateData);
      const apiWorking = state.apiWorking === true;
      
      log('Feature State', apiWorking ? 'ENABLED' : 'DISABLED', apiWorking ? 'info' : 'warn');
      log('Last Updated', new Date(state.timestamp || 0).toLocaleString());
    } else {
      log('Feature State File', 'Missing', 'error');
    }
    
    // Check .env.openai file
    const envFile = path.join(__dirname, '.env.openai');
    if (fs.existsSync(envFile)) {
      const envData = fs.readFileSync(envFile, 'utf8');
      const keyMatch = envData.match(/OPENAI_API_KEY=(.*)/);
      
      if (keyMatch && keyMatch[1]) {
        const key = keyMatch[1].trim();
        if (key.startsWith('sk-')) {
          log('API Key', 'Present', 'info');
          
          // Check key type
          if (key.startsWith('sk-proj-')) {
            log('Key Type', 'Project-scoped key (sk-proj-*)', 'info');
          } else {
            log('Key Type', 'Standard key (sk-*)', 'info');
          }
        } else {
          log('API Key', 'Invalid format', 'error');
        }
      } else {
        log('API Key', 'Not found in .env.openai', 'error');
      }
    } else {
      log('OpenAI Env File', 'Missing', 'error');
    }
  } catch (err) {
    log('OpenAI Check', 'Failed', 'error');
    if (verbose) console.error(err);
  }
  
  // 4. Check database connection
  console.log('\n🗄️ DATABASE CONNECTION:');
  
  try {
    // Check for database URLs
    const hasCustomDbUrl = !!process.env.CURRENTSEE_DB_URL;
    const hasDefaultDbUrl = !!process.env.DATABASE_URL;
    
    log('CURRENTSEE_DB_URL', hasCustomDbUrl ? 'Present' : 'Missing', hasCustomDbUrl ? 'info' : 'warn');
    log('DATABASE_URL', hasDefaultDbUrl ? 'Present' : 'Missing', hasDefaultDbUrl ? 'info' : 'warn');
    
    if (!hasCustomDbUrl && !hasDefaultDbUrl) {
      log('Database URL', 'No database URL available', 'error');
      return;
    }
    
    // Try to connect to database
    const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    log('Connection', 'Successful');
    
    // Check database info
    const dbInfoResult = await client.query('SELECT current_database() as db, current_user as user');
    log('Database', dbInfoResult.rows[0].db);
    log('User', dbInfoResult.rows[0].user);
    
    // Check tables
    console.log('\n📋 DATABASE TABLES:');
    
    // Check members table
    try {
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      log('Members Table', `${membersResult.rows[0].count} records`);
      
      if (parseInt(membersResult.rows[0].count) === 0) {
        log('Members Table', 'Empty table', 'warn');
      } else if (membersResult.rows[0].count > 0) {
        // Show first member
        const firstMember = await client.query('SELECT id, name, joined_date, total_solar FROM members ORDER BY id ASC LIMIT 1');
        if (firstMember.rows.length > 0) {
          const member = firstMember.rows[0];
          log('First Member', `#${member.id}: ${member.name}, Joined: ${member.joined_date}, SOLAR: ${member.total_solar}`);
        }
      }
    } catch (err) {
      log('Members Table', 'Error accessing table', 'error');
      if (verbose) console.error(err);
    }
    
    client.release();
    await pool.end();
  } catch (err) {
    log('Database Check', 'Failed', 'error');
    if (verbose) console.error(err);
  }
  
  // 5. Check Solar Generator calculations
  console.log('\n☀️ SOLAR GENERATOR:');
  
  try {
    // Extract solar constants from deployment file
    const deploymentFile = path.join(__dirname, 'pure-deployment.js');
    const data = fs.readFileSync(deploymentFile, 'utf8');
    
    const startDateMatch = data.match(/startDate: new Date\(['"]([^'"]+)['"]\)/);
    const solarValueMatch = data.match(/solarValue: ([0-9]+)/);
    const solarToEnergyMatch = data.match(/solarToEnergy: ([0-9]+)/);
    
    if (startDateMatch && solarValueMatch && solarToEnergyMatch) {
      const startDate = new Date(startDateMatch[1]);
      const solarValue = parseInt(solarValueMatch[1]);
      const solarToEnergy = parseInt(solarToEnergyMatch[1]);
      
      log('Start Date', startDate.toISOString().split('T')[0]);
      log('SOLAR Value', `$${solarValue} per SOLAR`);
      log('Energy Conversion', `${solarToEnergy} kWh per SOLAR`);
      
      // Calculate current solar data
      const now = new Date();
      const diffTime = Math.abs(now - startDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const hourlyKwH = 27777.778; // 2/3 of a million kWh per day, distributed hourly
      const elapsedHours = Math.floor(diffTime / (1000 * 60 * 60));
      const totalEnergyKwH = elapsedHours * hourlyKwH;
      const totalEnergyMkWh = (totalEnergyKwH / 1000000).toFixed(6);
      const totalValue = ((totalEnergyKwH / solarToEnergy) * solarValue).toFixed(2);
      
      log('Days Running', diffDays.toString());
      log('Total Energy', `${totalEnergyMkWh} MkWh`);
      log('Total Value', `$${totalValue}`);
    } else {
      log('Solar Constants', 'Could not extract solar constants', 'error');
    }
  } catch (err) {
    log('Solar Generator Check', 'Failed', 'error');
    if (verbose) console.error(err);
  }
  
  console.log('\n=== SYSTEM CHECK COMPLETE ===\n');
}

// Run the system check
runSystemCheck().catch(err => {
  console.error('System check failed with an unhandled error:', err);
  process.exit(1);
});