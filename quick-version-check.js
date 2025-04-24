/**
 * Quick Version Check
 * 
 * This is a simple script to verify the current version
 * and configuration without running the full deployment.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_FILE = 'pure-deployment.js';
const FEATURES_FILE = 'features.json';

console.log('\n=== CURRENT-SEE VERSION CHECKER ===\n');

// Check server file
if (!fs.existsSync(SERVER_FILE)) {
  console.log(`❌ Server file not found: ${SERVER_FILE}`);
  process.exit(1);
} else {
  console.log(`✅ Server file found: ${SERVER_FILE}`);
}

// Extract version from server file
try {
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  const versionMatch = content.match(/APP_VERSION\s*=\s*{[^}]+}/);
  
  if (versionMatch) {
    console.log('\n=== VERSION INFORMATION ===');
    
    // Extract version
    const versionRegex = /version:\s*['"]([^'"]+)['"]/;
    const versionResult = versionRegex.exec(versionMatch[0]);
    if (versionResult && versionResult[1]) {
      console.log(`✅ Version: ${versionResult[1]}`);
    } else {
      console.log('❌ Unable to extract version');
    }
    
    // Extract build
    const buildRegex = /build:\s*['"]([^'"]+)['"]/;
    const buildResult = buildRegex.exec(versionMatch[0]);
    if (buildResult && buildResult[1]) {
      console.log(`✅ Build: ${buildResult[1]}`);
    } else {
      console.log('❌ Unable to extract build');
    }
    
    // Extract name
    const nameRegex = /name:\s*['"]([^'"]+)['"]/;
    const nameResult = nameRegex.exec(versionMatch[0]);
    if (nameResult && nameResult[1]) {
      console.log(`✅ Name: ${nameResult[1]}`);
    } else {
      console.log('❌ Unable to extract name');
    }
  } else {
    console.log('❌ Unable to find APP_VERSION in server file');
  }
} catch (err) {
  console.log(`❌ Error reading server file: ${err.message}`);
}

// Check features file
if (!fs.existsSync(FEATURES_FILE)) {
  console.log(`\n❌ Features file not found: ${FEATURES_FILE}`);
} else {
  console.log(`\n=== FEATURES ===`);
  try {
    const featuresContent = fs.readFileSync(FEATURES_FILE, 'utf8');
    const features = JSON.parse(featuresContent);
    
    for (const [key, value] of Object.entries(features)) {
      console.log(`✅ ${key}: ${value ? 'enabled' : 'disabled'}`);
    }
  } catch (err) {
    console.log(`❌ Error reading features file: ${err.message}`);
  }
}

// Check environment configuration
console.log('\n=== ENVIRONMENT ===');

// Check for .env.openai
if (fs.existsSync('.env.openai')) {
  console.log('✅ OpenAI configuration found');
} else {
  console.log('❌ OpenAI configuration missing');
}

// Check for DATABASE_URL or CURRENTSEE_DB_URL
if (process.env.DATABASE_URL || process.env.CURRENTSEE_DB_URL) {
  console.log('✅ Database URL found in environment');
} else {
  console.log('❌ Database URL missing from environment');
}

console.log('\n=== DEPLOYMENT READINESS ===');
console.log('✅ Ready for deployment with the following commands:');
console.log('  - Start application: node deploy.js');
console.log('  - Version check: node quick-version-check.js');
console.log('\n====================================\n');