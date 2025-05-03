/**
 * The Current-See Quick Deployment Helper
 * 
 * This script automatically creates a deployment without
 * relying on any dependencies or channels, avoiding the
 * "Channel already opened" error.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting The Current-See Quick Deployment Helper...');
console.log(`Current Date: ${new Date().toISOString()}`);
console.log('This script will help you deploy without channel conflicts.');

// Check for required files
const requiredFiles = [
  { path: './deploy-fixed.js', name: 'Fixed Deployment Script' },
  { path: './Procfile', name: 'Process File' },
  { path: './run', name: 'Run Script' },
  { path: './deploy-launch.sh', name: 'Launch Script' },
  { path: './public/index.html', name: 'Homepage' }
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (!fs.existsSync(file.path)) {
    console.log(`❌ Missing required file: ${file.path} (${file.name})`);
    allFilesExist = false;
  } else {
    console.log(`✅ Found required file: ${file.path}`);
  }
}

if (!allFilesExist) {
  console.error('Some required files are missing. Please fix before continuing.');
  process.exit(1);
}

// Check environment variables
console.log('\nChecking environment variables:');

if (process.env.CURRENTSEE_DB_URL) {
  console.log('✅ CURRENTSEE_DB_URL is set');
} else {
  console.log('⚠️ CURRENTSEE_DB_URL is not set - database features may not work');
}

if (process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY) {
  console.log('✅ OPENAI_API_KEY or NEW_OPENAI_API_KEY is set');
} else {
  console.log('⚠️ OPENAI_API_KEY is not set - AI features may not work');
}

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';
console.log('✅ NODE_ENV set to production');

// Kill any existing Node.js processes
try {
  console.log('\nKilling any existing Node.js processes...');
  execSync('pkill -f node || echo "No existing Node.js processes"');
  console.log('✅ Cleared any existing Node.js processes');
} catch (error) {
  console.log('⚠️ Unable to kill processes, but continuing anyway');
}

// Wait for channels to clear
console.log('\nWaiting 2 seconds for channels to clear...');
setTimeout(() => {
  console.log('Starting the deployment server...\n');
  
  // Start the deployment server
  require('./deploy-fixed.js');
  
}, 2000);