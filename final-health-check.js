/**
 * The Current-See Final Health Check
 * 
 * This script performs a final health check before deployment
 * to ensure all systems are functioning correctly.
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Log a message with color
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let colorCode = '';
  
  switch (type) {
    case 'success':
      colorCode = colors.green;
      break;
    case 'warning':
      colorCode = colors.yellow;
      break;
    case 'error':
      colorCode = colors.red;
      break;
    case 'info':
    default:
      colorCode = colors.cyan;
      break;
  }
  
  console.log(`${colorCode}[${timestamp}] ${message}${colors.reset}`);
}

// Check required files
function checkRequiredFiles() {
  log('Checking required files...', 'info');
  
  const requiredFiles = [
    'server.js',
    'deploy-ready.js',
    'solar-distribution-scheduler.js',
    'solar-distribution-integration.js',
    'solar-conversion-sync.js',
    'public/cache-timestamp.txt',
    'public/js/cache-buster.js',
    'public/js/solar-generator-refresh.js',
    'public/js/public-members-log.js',
    'public/api/members.json',
    'public/embedded-members',
    'deployment-ready.json'
  ];
  
  let missingFiles = [];
  for (const file of requiredFiles) {
    if (!fileExists(file)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length === 0) {
    log('All required files are present', 'success');
    return true;
  } else {
    log(`Missing ${missingFiles.length} files:`, 'error');
    missingFiles.forEach(file => log(`- ${file}`, 'error'));
    return false;
  }
}

// Check deployment marker
function checkDeploymentMarker() {
  log('Checking deployment marker...', 'info');
  
  try {
    const markerContent = fs.readFileSync('deployment-ready.json', 'utf8');
    const marker = JSON.parse(markerContent);
    
    if (marker.deployReady) {
      log('Deployment marker indicates system is ready', 'success');
      return true;
    } else {
      log('Deployment marker indicates system is NOT ready', 'error');
      return false;
    }
  } catch (error) {
    log(`Error reading deployment marker: ${error.message}`, 'error');
    return false;
  }
}

// Check OpenAI API key
function checkOpenAIApiKey() {
  log('Checking OpenAI API key...', 'info');
  
  if (process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY) {
    log('OpenAI API key is set', 'success');
    return true;
  } else {
    log('OpenAI API key is NOT set', 'error');
    return false;
  }
}

// Check database connection string
function checkDatabaseConnectionString() {
  log('Checking database connection string...', 'info');
  
  if (process.env.CURRENTSEE_DB_URL) {
    log('Database connection string is set', 'success');
    return true;
  } else {
    log('Database connection string is NOT set', 'warning');
    return false;
  }
}

// Check cache timestamp
function checkCacheTimestamp() {
  log('Checking cache timestamp...', 'info');
  
  try {
    const timestamp = fs.readFileSync('public/cache-timestamp.txt', 'utf8');
    const cacheDate = new Date(timestamp);
    const currentDate = new Date();
    const diffMinutes = (currentDate - cacheDate) / (1000 * 60);
    
    if (diffMinutes < 60) {
      log(`Cache timestamp is recent (${diffMinutes.toFixed(2)} minutes old)`, 'success');
      return true;
    } else {
      log(`Cache timestamp is stale (${diffMinutes.toFixed(2)} minutes old)`, 'warning');
      return false;
    }
  } catch (error) {
    log(`Error checking cache timestamp: ${error.message}`, 'error');
    return false;
  }
}

// Main check function
function runHealthCheck() {
  log('Starting final health check...', 'info');
  
  const checks = [
    { name: 'Required Files', check: checkRequiredFiles },
    { name: 'Deployment Marker', check: checkDeploymentMarker },
    { name: 'OpenAI API Key', check: checkOpenAIApiKey },
    { name: 'Database Connection', check: checkDatabaseConnectionString },
    { name: 'Cache Timestamp', check: checkCacheTimestamp }
  ];
  
  const results = [];
  
  for (const check of checks) {
    log(`Running check: ${check.name}`, 'info');
    const result = check.check();
    results.push({ name: check.name, passed: result });
  }
  
  // Print summary
  console.log('\n');
  log('Health Check Summary:', 'info');
  console.log('\n');
  
  let allPassed = true;
  
  for (const result of results) {
    const status = result.passed ? `${colors.green}PASSED${colors.reset}` : `${colors.red}FAILED${colors.reset}`;
    console.log(`  ${status} - ${result.name}`);
    
    if (!result.passed) {
      allPassed = false;
    }
  }
  
  console.log('\n');
  
  if (allPassed) {
    console.log(`${colors.green}${colors.bold}✓ All checks passed! The system is ready for deployment.${colors.reset}`);
    console.log(`${colors.cyan}You can now deploy The Current-See website to www.thecurrentsee.org using Replit Deploy.${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bold}⚠ Some checks failed. Deployment may be possible but could have issues.${colors.reset}`);
    console.log(`${colors.yellow}Review the results above and address any failures before deploying.${colors.reset}`);
  }
  
  return allPassed;
}

// Run the health check
runHealthCheck();