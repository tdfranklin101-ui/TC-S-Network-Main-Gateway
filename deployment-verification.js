/**
 * The Current-See Deployment Verification Script
 * 
 * This script can be run after deployment to verify key functionality is working
 * Usage: node deployment-verification.js [hostname]
 */

const https = require('https');
const http = require('http');

// Get hostname from command line or use default
const input = process.argv[2] || 'thecurrentsee.org';
let hostname, port, useHttps;

// Handle different input formats (hostname:port or just hostname)
if (input.includes(':')) {
  [hostname, port] = input.split(':');
  useHttps = false;
} else {
  hostname = input;
  port = useHttps ? 443 : 3000;
  useHttps = !input.includes('localhost');
}

console.log(`\nStarting verification for ${hostname}${port ? ':'+port : ''} using ${useHttps ? 'HTTPS' : 'HTTP'}...`);

// Function to make a request
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: port || (useHttps ? 443 : 3000),
      path,
      method,
      headers: {
        'User-Agent': 'Current-See-Verification-Script/1.0',
        'Content-Type': 'application/json'
      }
    };

    const protocol = useHttps ? https : http;
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          };
          
          if (responseData && 
              (responseData.startsWith('{') || responseData.startsWith('['))) {
            result.json = JSON.parse(responseData);
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

// Main verification function
async function verifyDeployment() {
  try {
    // 1. Check health endpoint
    console.log('\nVerifying health endpoint...');
    const healthCheck = await makeRequest('/health');
    const healthStatus = healthCheck.statusCode === 200 ? 'OK' : 'FAILED';
    console.log(`Health check: ${healthStatus} (${healthCheck.statusCode})`);
    
    // 2. Check homepage loads
    console.log('\nVerifying homepage loads...');
    const homepage = await makeRequest('/');
    const homepageStatus = homepage.statusCode === 200 ? 'OK' : 'FAILED';
    console.log(`Homepage: ${homepageStatus} (${homepage.statusCode})`);
    
    // 3. Check member count API
    console.log('\nVerifying member count API...');
    try {
      const memberCount = await makeRequest('/api/member-count');
      if (memberCount.json && typeof memberCount.json.count === 'number') {
        console.log(`Member count API: OK - ${memberCount.json.count} members`);
      } else {
        console.log(`Member count API: FAILED - Invalid response format`);
      }
    } catch (error) {
      console.log(`Member count API: FAILED - ${error.message}`);
    }
    
    // 4. Check solar data API
    console.log('\nVerifying solar data API...');
    try {
      const solarData = await makeRequest('/api/solar-data');
      if (solarData.json && solarData.json.energy && solarData.json.solar) {
        console.log(`Solar data API: OK - Energy: ${solarData.json.energy.value} ${solarData.json.energy.unit}`);
        console.log(`                    Solar tokens: ${solarData.json.solar.formatted}`);
        console.log(`                    Value: ${solarData.json.money.formatted}`);
      } else {
        console.log(`Solar data API: FAILED - Invalid response format`);
      }
    } catch (error) {
      console.log(`Solar data API: FAILED - ${error.message}`);
    }
    
    console.log('\nVerification complete!');
    
  } catch (error) {
    console.error('Verification failed:', error);
  }
}

// Run the verification
verifyDeployment();