/**
 * The Current-See Deployment Database Verification Script
 * 
 * This script verifies database connectivity in a deployed environment.
 * It makes HTTP requests to the deployment endpoints to check status.
 * 
 * Usage: node verify-deployment-db.js [deployment-url]
 * Example: node verify-deployment-db.js https://thecurrentsee.org
 */

const https = require('https');
const http = require('http');

// Helper function for logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let prefix = '✓ INFO';
  
  switch (type) {
    case 'error':
      prefix = '❌ ERROR';
      break;
    case 'warning':
      prefix = '⚠️ WARNING';
      break;
    case 'success':
      prefix = '✅ SUCCESS';
      break;
    default:
      prefix = 'ℹ INFO';
  }
  
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: jsonData
          });
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    // Set timeout for requests
    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

// Verify deployment
async function verifyDeployment(deploymentUrl) {
  log(`Starting verification of ${deploymentUrl}`, 'info');
  
  try {
    // Check basic health endpoint
    log('Checking /health endpoint...', 'info');
    try {
      const healthResponse = await makeRequest(`${deploymentUrl}/health`);
      
      if (healthResponse.statusCode === 200) {
        log('Health endpoint is accessible', 'success');
        log(`Database status: ${healthResponse.data.database}`);
        log(`Members count: ${healthResponse.data.membersCount}`);
      } else {
        log(`Health endpoint returned status ${healthResponse.statusCode}`, 'error');
      }
    } catch (err) {
      log(`Could not access health endpoint: ${err.message}`, 'error');
    }
    
    // Check database status endpoint
    log('Checking /api/database/status endpoint...', 'info');
    try {
      const dbStatusResponse = await makeRequest(`${deploymentUrl}/api/database/status`);
      
      if (dbStatusResponse.statusCode === 200) {
        log('Database status endpoint is accessible', 'success');
        log(`Database connected: ${dbStatusResponse.data.connected}`);
        if (dbStatusResponse.data.connected) {
          log(`Members count: ${dbStatusResponse.data.membersCount}`);
          log(`Environment: ${dbStatusResponse.data.environmentType}`);
        }
      } else {
        log(`Database status endpoint returned status ${dbStatusResponse.statusCode}`, 'error');
      }
    } catch (err) {
      log(`Could not access database status endpoint: ${err.message}`, 'error');
    }
    
    // Check members API endpoint
    log('Checking /api/members endpoint...', 'info');
    try {
      const membersResponse = await makeRequest(`${deploymentUrl}/api/members`);
      
      if (membersResponse.statusCode === 200) {
        log('Members endpoint is accessible', 'success');
        if (Array.isArray(membersResponse.data)) {
          log(`Members endpoint returned ${membersResponse.data.length} members`);
          // Check first member
          if (membersResponse.data.length > 0) {
            log(`First member: ${membersResponse.data[0].name} (ID: ${membersResponse.data[0].id})`);
          }
        } else {
          log('Members endpoint did not return an array', 'warning');
        }
      } else {
        log(`Members endpoint returned status ${membersResponse.statusCode}`, 'error');
      }
    } catch (err) {
      log(`Could not access members endpoint: ${err.message}`, 'error');
    }
    
    // Check solar clock API endpoint
    log('Checking /api/solar-clock endpoint...', 'info');
    try {
      const solarResponse = await makeRequest(`${deploymentUrl}/api/solar-clock`);
      
      if (solarResponse.statusCode === 200) {
        log('Solar clock endpoint is accessible', 'success');
        log(`Days running: ${solarResponse.data.daysRunning}`);
        log(`Total energy: ${solarResponse.data.totalEnergy} MkWh`);
        log(`Total value: $${solarResponse.data.totalValue}`);
      } else {
        log(`Solar clock endpoint returned status ${solarResponse.statusCode}`, 'error');
      }
    } catch (err) {
      log(`Could not access solar clock endpoint: ${err.message}`, 'error');
    }
    
    // Check mobile API status endpoint
    log('Checking /mobile/status endpoint...', 'info');
    try {
      const mobileStatusResponse = await makeRequest(`${deploymentUrl}/mobile/status`);
      
      if (mobileStatusResponse.statusCode === 200) {
        log('Mobile API status endpoint is accessible', 'success');
        log(`Database status: ${mobileStatusResponse.data.database}`);
        log(`Success: ${mobileStatusResponse.data.success}`);
      } else {
        log(`Mobile API status endpoint returned status ${mobileStatusResponse.statusCode}`, 'error');
      }
    } catch (err) {
      log(`Could not access mobile API status endpoint: ${err.message}`, 'error');
    }
    
    log('Deployment verification completed', 'info');
    
    // Final assessment
    log('\n=== DEPLOYMENT VERIFICATION SUMMARY ===', 'info');
    log('The verification process has checked the following endpoints:');
    log('1. /health - Basic health check');
    log('2. /api/database/status - Database status');
    log('3. /api/members - Members API');
    log('4. /api/solar-clock - Solar clock API');
    log('5. /mobile/status - Mobile API status');
    
    log('\nIf any endpoints failed, check that:');
    log('1. All environment variables are correctly set in the deployment environment');
    log('2. The database is accessible from the deployment environment');
    log('3. The server is correctly configured to handle database connections');
    
    log('\nFor more information, see DEPLOYMENT-DB-GUIDE.md');
    
  } catch (err) {
    log(`Verification failed: ${err.message}`, 'error');
  }
}

// Get deployment URL from command line argument or use default
const deploymentUrl = process.argv[2] || 'https://thecurrentsee.org';

// Run verification
verifyDeployment(deploymentUrl).catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
});