/**
 * The Current-See Version Check Utility
 * 
 * This script provides a quick overview of the application version,
 * database connection status, and OpenAI integration.
 * 
 * Usage: node check-version.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read deployment file to get version info
const deploymentFile = path.join(__dirname, 'pure-deployment.js');
const openaiStateFile = path.join(__dirname, '.openai-feature-state.json');

console.log('\n🔍 THE CURRENT-SEE VERSION CHECK 🔍\n');

// Parse version information
try {
  const data = fs.readFileSync(deploymentFile, 'utf8');
  const versionRegex = /const APP_VERSION = \{[\s\S]*?version: ['"]([^'"]+)['"][\s\S]*?name: ['"]([^'"]+)['"][\s\S]*?build: ['"]([^'"]+)['"]/;
  const match = data.match(versionRegex);
  
  if (match) {
    console.log(`📌 Application: ${match[2]}`);
    console.log(`📌 Version: ${match[1]} (Build ${match[3]})\n`);
  } else {
    console.log('❌ Could not find version information in the deployment file.\n');
  }
  
  // Extract feature flags
  const featuresRegex = /features: \{([\s\S]*?)\}/;
  const featuresMatch = data.match(featuresRegex);
  
  if (featuresMatch) {
    console.log('📋 FEATURE STATUS:');
    
    const featureLines = featuresMatch[1].trim().split('\n');
    for (const line of featureLines) {
      const featureMatch = line.match(/([a-zA-Z]+):\s*(true|false)/);
      if (featureMatch) {
        const feature = featureMatch[1];
        const enabled = featureMatch[2] === 'true';
        console.log(`   ${enabled ? '✅' : '❌'} ${feature}`);
      }
    }
    console.log('');
  }
} catch (err) {
  console.error(`❌ Error reading deployment file: ${err.message}\n`);
}

// Check OpenAI state
try {
  if (fs.existsSync(openaiStateFile)) {
    const stateData = fs.readFileSync(openaiStateFile, 'utf8');
    const state = JSON.parse(stateData);
    const apiWorking = state.apiWorking === true;
    
    console.log('🤖 OPENAI INTEGRATION:');
    console.log(`   ${apiWorking ? '✅ ENABLED' : '❌ DISABLED'} (according to feature state file)`);
    console.log('');
  } else {
    console.log('❓ OPENAI INTEGRATION: Status unknown (no state file found)\n');
  }
} catch (err) {
  console.error(`❌ Error checking OpenAI state: ${err.message}\n`);
}

// Check database connectivity
console.log('🗄️  DATABASE STATUS:');
try {
  const dbStatus = execSync('node -e "require(\'./check-currentsee-db.js\').checkIsAlive()"', { timeout: 5000 });
  console.log('   ✅ CONNECTED');
  console.log('');
} catch (err) {
  console.log('   ❌ DISCONNECTED');
  console.log('');
}

// Check deployed version if possible
console.log('🌐 DEPLOYED VERSION:');
try {
  const deployedVersion = execSync('curl -s https://www.thecurrentsee.org/api/version || curl -s http://localhost:3000/api/version', { timeout: 3000 });
  try {
    const versionInfo = JSON.parse(deployedVersion);
    console.log(`   ✅ ${versionInfo.name} v${versionInfo.version} (Build ${versionInfo.build})`);
    console.log(`   🔗 Database: ${versionInfo.dbConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`   🤖 OpenAI: ${versionInfo.openaiEnabled ? 'ENABLED' : 'DISABLED'}`);
  } catch (e) {
    console.log('   ⚠️  Could not parse version information from response');
  }
} catch (err) {
  console.log('   ❌ Could not connect to deployed application');
}

console.log('\n📊 For more detailed status information, run:');
console.log('   node check-status.js');
console.log('\n🔄 To update version number, run:');
console.log('   node update-version.js <version> <build>');
console.log('\n🔧 To toggle features, run:');
console.log('   node set-feature.js <feature> <true|false>');
console.log('');