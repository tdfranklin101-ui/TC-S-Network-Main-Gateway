/**
 * The Current-See Deployment Verification Script
 * 
 * This script verifies that a deployment of The Current-See is working correctly
 * by checking all critical endpoints and functionality.
 * 
 * Usage: 
 *  node verify-deployment.js [base-url]
 *  Example: node verify-deployment.js https://www.thecurrentsee.org
 */

const http = require('http');
const https = require('https');

// Get the base URL from command line arguments
const baseUrl = process.argv[2] || 'http://localhost:3000';
console.log(`Verifying deployment at ${baseUrl}...`);

// Function to make an HTTP/HTTPS request
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Log with color
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m' // Red
  };
  
  const color = colors[type] || colors.info;
  console.log(`${color}${message}\x1b[0m`);
}

// Check if the health endpoint is working
async function checkHealthEndpoint() {
  try {
    const response = await makeRequest('/health');
    if (response.statusCode === 200) {
      log('✅ Health endpoint is working', 'success');
      
      // Also check the healthz endpoint for cloud platforms
      try {
        const healthzResponse = await makeRequest('/healthz');
        if (healthzResponse.statusCode === 200) {
          log('✅ Healthz endpoint is working', 'success');
        } else {
          log(`⚠️ Healthz endpoint returned status ${healthzResponse.statusCode}`, 'warning');
        }
      } catch (healthzError) {
        log(`⚠️ Warning checking healthz endpoint: ${healthzError.message}`, 'warning');
      }
      
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

// Check if the homepage is loading
async function checkHomepage() {
  try {
    const response = await makeRequest('/');
    if (response.statusCode === 200) {
      log('✅ Homepage is loading', 'success');
      return true;
    } else {
      log(`❌ Homepage returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking homepage: ${error.message}`, 'error');
    return false;
  }
}

// Check if the member count API is working
async function checkMemberCountAPI() {
  try {
    const response = await makeRequest('/api/member-count');
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        log(`✅ Member count API is working (count: ${data.count})`, 'success');
        return true;
      } catch (parseError) {
        log(`❌ Error parsing member count response: ${parseError.message}`, 'error');
        return false;
      }
    } else {
      log(`❌ Member count API returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking member count API: ${error.message}`, 'error');
    return false;
  }
}

// Check if the system status API is working
async function checkSystemStatusAPI() {
  try {
    const response = await makeRequest('/api/system/status');
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        log(`✅ System status API is working (status: ${data.status})`, 'success');
        log(`   Environment: ${data.environment}`, 'info');
        log(`   Has Database: ${data.hasDatabase}`, 'info');
        log(`   Has OpenAI: ${data.hasOpenAI}`, 'info');
        return true;
      } catch (parseError) {
        log(`❌ Error parsing system status response: ${parseError.message}`, 'error');
        return false;
      }
    } else {
      log(`❌ System status API returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking system status API: ${error.message}`, 'error');
    return false;
  }
}

// Run all checks
async function runChecks() {
  const results = {
    health: await checkHealthEndpoint(),
    homepage: await checkHomepage(),
    memberCount: await checkMemberCountAPI(),
    systemStatus: await checkSystemStatusAPI()
  };
  
  // Print summary
  log('\n----- VERIFICATION SUMMARY -----', 'info');
  const successCount = Object.values(results).filter(result => result).length;
  const totalChecks = Object.values(results).length;
  
  if (successCount === totalChecks) {
    log(`✅ All checks passed! (${successCount}/${totalChecks})`, 'success');
  } else {
    log(`⚠️ ${successCount}/${totalChecks} checks passed`, 'warning');
  }
  
  return successCount === totalChecks;
}

// Run the verification
runChecks().then(success => {
  if (!success) {
    process.exit(1);
  }
});