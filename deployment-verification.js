/**
 * The Current-See Deployment Verification
 * 
 * This script verifies the deployed website is functioning correctly
 * by checking various endpoints and functionality.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

// Configuration
const BASE_URL = process.env.VERIFY_URL || 'http://localhost:3000';
const USE_HTTPS = BASE_URL.startsWith('https://');
const client = USE_HTTPS ? https : http;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Log a message with color
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let color = colors.reset;
  
  switch (type) {
    case 'success':
      color = colors.green;
      break;
    case 'error':
      color = colors.red;
      break;
    case 'warning':
      color = colors.yellow;
      break;
    case 'info':
      color = colors.blue;
      break;
  }
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Make a request to the specified endpoint
function makeRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    log(`Requesting ${method} ${url}`, 'info');
    
    const options = {
      method,
      timeout: 10000, // 10 second timeout
    };
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out`));
    });
    
    req.end();
  });
}

// Check if the main site is available
async function checkMainSite() {
  try {
    const response = await makeRequest('/');
    if (response.statusCode === 200) {
      log('✅ Main site is available', 'success');
      return true;
    } else {
      log(`❌ Main site returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking main site: ${error.message}`, 'error');
    return false;
  }
}

// Check if the health endpoint is working
async function checkHealthEndpoint() {
  try {
    const response = await makeRequest('/health');
    if (response.statusCode === 200) {
      log('✅ Health endpoint is working', 'success');
      return true;
    } else {
      log(`❌ Health endpoint returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking health endpoint: ${error.message}`, 'error');
    return false;
  }
}

// Check if the system status API is working
async function checkSystemStatusAPI() {
  try {
    const response = await makeRequest('/api/system/status');
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log(`✅ System status API working. Status: ${data.status}`, 'success');
      log(`   Database available: ${data.hasDatabase}`, data.hasDatabase ? 'success' : 'warning');
      log(`   OpenAI available: ${data.hasOpenAI}`, data.hasOpenAI ? 'success' : 'warning');
      return true;
    } else {
      log(`❌ System status API returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking system status API: ${error.message}`, 'error');
    return false;
  }
}

// Check if the member count API is working
async function checkMemberCountAPI() {
  try {
    const response = await makeRequest('/api/member-count');
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log(`✅ Member count API working. Count: ${data.count}`, 'success');
      return true;
    } else {
      log(`❌ Member count API returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking member count API: ${error.message}`, 'error');
    return false;
  }
}

// Run all checks
async function runVerification() {
  log('-------------------------------------------------', 'info');
  log(`🔍 Starting verification of ${BASE_URL}`, 'info');
  log('-------------------------------------------------', 'info');
  
  let success = true;
  
  success = await checkMainSite() && success;
  success = await checkHealthEndpoint() && success;
  success = await checkSystemStatusAPI() && success;
  success = await checkMemberCountAPI() && success;
  
  log('-------------------------------------------------', 'info');
  
  if (success) {
    log('✅ All verification checks passed!', 'success');
    log('The Current-See is deployed and working correctly', 'success');
  } else {
    log('❌ Some verification checks failed', 'error');
    log('Please check the logs above for details', 'error');
  }
  
  log('-------------------------------------------------', 'info');
  log('Next steps:', 'info');
  log('1. Visit the website to confirm functionality', 'info');
  log('2. Test the Solar Generator counter', 'info');
  log('3. Verify member data is displaying correctly', 'info');
  log('4. Visit the admin dashboard to confirm it\'s working', 'info');
  log('-------------------------------------------------', 'info');
  
  return success;
}

// Run the verification
runVerification().catch((error) => {
  log(`❌ Unhandled error during verification: ${error.message}`, 'error');
  process.exit(1);
});