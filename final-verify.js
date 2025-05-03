/**
 * The Current-See Final Deployment Verification Script
 * 
 * This script performs a comprehensive check of a deployed instance
 * of The Current-See website to verify all functionality is working.
 * 
 * Usage: 
 *   node final-verify.js [base-url]
 *   Example: node final-verify.js https://www.thecurrentsee.org
 */

const http = require('http');
const https = require('https');

// Get the base URL from command line arguments or default to production URL
const baseUrl = process.argv[2] || 'https://www.thecurrentsee.org';
console.log(`Verifying deployment at ${baseUrl}...`);

// Function to make an HTTP/HTTPS request
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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

// Check basic connectivity
async function checkBasicConnectivity() {
  try {
    const response = await makeRequest('/');
    if (response.statusCode === 200) {
      log('✅ Basic connectivity check passed', 'success');
      return true;
    } else {
      log(`❌ Basic connectivity check failed with status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Basic connectivity check failed: ${error.message}`, 'error');
    return false;
  }
}

// Check health endpoint
async function checkHealthEndpoint() {
  try {
    const response = await makeRequest('/health');
    if (response.statusCode === 200) {
      log('✅ Health endpoint is working', 'success');
      
      // Check healthz endpoint too for cloud platforms
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

// Check member count API
async function checkMemberCountAPI() {
  try {
    const cacheParam = new Date().getTime();
    const response = await makeRequest(`/api/member-count?cache=${cacheParam}`);
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

// Check if members.json is accessible
async function checkMembersJSON() {
  try {
    const cacheParam = Math.random();
    const response = await makeRequest(`/api/members.json?cache=${cacheParam}`);
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        if (Array.isArray(data) && data.length > 0) {
          log(`✅ Members JSON is accessible (${data.length} members)`, 'success');
          
          // Check if TC-S Solar Reserve is included
          const hasReserve = data.some(m => m.username === "tc-s.reserve" && m.name === "TC-S Solar Reserve");
          if (hasReserve) {
            log('✅ TC-S Solar Reserve found in members data', 'success');
          } else {
            log('⚠️ TC-S Solar Reserve not found in members data', 'warning');
          }
          
          return true;
        } else {
          log('❌ Members JSON returned empty array or invalid data', 'error');
          return false;
        }
      } catch (parseError) {
        log(`❌ Error parsing members JSON: ${parseError.message}`, 'error');
        return false;
      }
    } else {
      log(`❌ Members JSON returned status ${response.statusCode}`, 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking members JSON: ${error.message}`, 'error');
    return false;
  }
}

// Check SSL/HTTPS
async function checkSSL() {
  const url = new URL(baseUrl);
  if (url.protocol === 'https:') {
    try {
      const response = await makeRequest('/');
      if (response.statusCode === 200) {
        log('✅ HTTPS is configured properly', 'success');
        return true;
      } else {
        log('⚠️ HTTPS request returned non-200 status code', 'warning');
        return false;
      }
    } catch (error) {
      log(`❌ Error checking HTTPS: ${error.message}`, 'error');
      return false;
    }
  } else {
    log('⚠️ Site is not using HTTPS', 'warning');
    return false;
  }
}

// Check CORS headers
async function checkCorsHeaders() {
  try {
    const response = await makeRequest('/api/system/status', {
      headers: {
        'Origin': 'https://example.com'
      }
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      log(`✅ CORS headers are set: ${corsHeaders}`, 'success');
      return true;
    } else {
      log('⚠️ CORS headers are not set', 'warning');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking CORS headers: ${error.message}`, 'error');
    return false;
  }
}

// Run all checks
async function runTests() {
  // Essential connectivity checks
  const results = {
    basicConnectivity: await checkBasicConnectivity(),
    health: await checkHealthEndpoint(),
    
    // API checks
    systemStatus: await checkSystemStatusAPI(),
    memberCount: await checkMemberCountAPI(),
    membersJSON: await checkMembersJSON(),
    
    // Security and configuration checks
    ssl: await checkSSL(),
    cors: await checkCorsHeaders()
  };
  
  // Print summary
  log('\n----- VERIFICATION SUMMARY -----', 'info');
  const successCount = Object.values(results).filter(result => result).length;
  const totalChecks = Object.values(results).length;
  
  if (successCount === totalChecks) {
    log(`✅ All checks passed! (${successCount}/${totalChecks})`, 'success');
  } else {
    log(`⚠️ ${successCount}/${totalChecks} checks passed`, 'warning');
    
    // List failed checks
    const failedChecks = Object.entries(results)
      .filter(([_, success]) => !success)
      .map(([name]) => name);
    
    log(`❌ Failed checks: ${failedChecks.join(', ')}`, 'error');
  }
  
  return successCount === totalChecks;
}

// Run the verification tests
runTests().then(success => {
  if (!success) {
    process.exit(1);
  }
});