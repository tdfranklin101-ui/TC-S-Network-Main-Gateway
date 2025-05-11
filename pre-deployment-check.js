/**
 * The Current-See Pre-Deployment Verification
 * 
 * This script runs a series of checks to ensure the application
 * is ready for deployment.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Files and directories to check
const criticalFiles = [
  'main.js',
  'public/api/members.json',
  'public/embedded-members',
  'public/solar-generator.html',
  'public/js/public-members-log.js'
];

// Members to ensure exist (ordered by join date)
const requiredMembers = [
  'TC-S Solar Reserve',
  'Solar Reserve', 
  'Terry D. Franklin',
  'Erin Lee'
];

// Display colored output
function log(message, type = 'info') {
  const date = new Date().toISOString();
  
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  console.log(`[${date}] ${colors[type]}${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'} ${type.toUpperCase()}: ${message}${colors.reset}`);
}

// Execute a command and return its output
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Check if critical files exist
async function checkCriticalFiles() {
  log('Checking critical files...');
  
  let allFilesExist = true;
  
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      log(`File exists: ${file}`, 'success');
    } else {
      log(`Missing critical file: ${file}`, 'error');
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Check members data
async function checkMembersData() {
  log('Checking members data...');
  
  try {
    const membersFilePath = 'public/api/members.json';
    const embeddedFilePath = 'public/embedded-members';
    
    if (!fs.existsSync(membersFilePath)) {
      log(`Members file not found: ${membersFilePath}`, 'error');
      return false;
    }
    
    if (!fs.existsSync(embeddedFilePath)) {
      log(`Embedded members file not found: ${embeddedFilePath}`, 'error');
      return false;
    }
    
    // Check API members.json
    const membersData = JSON.parse(fs.readFileSync(membersFilePath, 'utf8'));
    
    if (!Array.isArray(membersData) || membersData.length === 0) {
      log('Members data is empty or invalid', 'error');
      return false;
    }
    
    log(`Found ${membersData.length} members in members.json`, 'success');
    
    // Check embedded members
    const embeddedFileContent = fs.readFileSync(embeddedFilePath, 'utf8');
    const embeddedMembers = /const EMBEDDED_MEMBERS = (.+);/.exec(embeddedFileContent);
    
    if (!embeddedMembers || !embeddedMembers[1]) {
      log('Embedded members data is invalid', 'error');
      return false;
    }
    
    try {
      const parsedEmbeddedMembers = JSON.parse(embeddedMembers[1]);
      
      if (!Array.isArray(parsedEmbeddedMembers) || parsedEmbeddedMembers.length === 0) {
        log('Embedded members data is empty or invalid', 'error');
        return false;
      }
      
      log(`Found ${parsedEmbeddedMembers.length} members in embedded-members`, 'success');
      
      // Check if counts match
      if (parsedEmbeddedMembers.length !== membersData.length) {
        log(`Member count mismatch: members.json (${membersData.length}) vs embedded-members (${parsedEmbeddedMembers.length})`, 'warning');
      }
    } catch (err) {
      log(`Failed to parse embedded members: ${err.message}`, 'error');
      return false;
    }
    
    // Check required members
    const memberNames = membersData.map(member => member.name);
    const missingMembers = requiredMembers.filter(name => !memberNames.some(n => n === name));
    
    if (missingMembers.length > 0) {
      log(`Missing required members: ${missingMembers.join(', ')}`, 'error');
      return false;
    }
    
    // Verify Erin Lee exists in proper format
    const erinMember = membersData.find(m => m.name === 'Erin Lee');
    if (!erinMember) {
      log(`Erin Lee not found or not properly capitalized`, 'error');
      return false;
    }
    
    log('All required members found', 'success');
    return true;
  } catch (err) {
    log(`Error checking members data: ${err.message}`, 'error');
    return false;
  }
}

// Check database connection
async function checkDatabaseConnection() {
  log('Checking database connection...');
  
  try {
    const result = await runCommand('node check-currentsee-db.js');
    const connectionSuccessful = result.includes('Connection successful') || result.includes('✅');
    
    if (connectionSuccessful) {
      log('Database connection successful', 'success');
      return true;
    } else {
      log('Database connection failed', 'error');
      return false;
    }
  } catch (err) {
    log(`Error checking database: ${err.message}`, 'error');
    return false;
  }
}

// Run all deployment checks
async function runDeploymentChecks() {
  log('Running pre-deployment verification...');
  
  try {
    // Get application version
    const version = await runCommand('node -e "try { const { APP_VERSION } = require(\'./main.js\'); console.log(APP_VERSION.version + \' (Build \' + APP_VERSION.build + \')\'); } catch (e) { console.log(\'Unknown\'); }"');
    log(`Current application version: ${version}`);
    
    // Check critical files
    const filesOk = await checkCriticalFiles();
    
    // Check members data
    const membersOk = await checkMembersData();
    
    // Check database connection
    const dbOk = await checkDatabaseConnection();
    
    // Final assessment
    log('');
    log('Pre-deployment verification summary:', 'info');
    log(`Critical files check: ${filesOk ? 'PASSED' : 'FAILED'}`, filesOk ? 'success' : 'error');
    log(`Members data check: ${membersOk ? 'PASSED' : 'FAILED'}`, membersOk ? 'success' : 'error');
    log(`Database connection: ${dbOk ? 'PASSED' : 'FAILED'}`, dbOk ? 'success' : 'error');
    
    const allPassed = filesOk && membersOk && dbOk;
    
    if (allPassed) {
      log('All checks passed. Ready for deployment!', 'success');
    } else {
      log('Some checks failed. Please resolve the issues before deploying.', 'error');
    }
    
    return allPassed;
  } catch (err) {
    log(`Error running deployment checks: ${err.message}`, 'error');
    return false;
  }
}

// Execute all checks
runDeploymentChecks().then(result => {
  process.exit(result ? 0 : 1);
});