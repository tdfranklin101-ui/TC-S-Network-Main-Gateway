/**
 * The Current-See Health Check
 * 
 * This script performs a basic health check on the deployed server
 * to verify it is responding correctly.
 */

const http = require('http');

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = 'localhost';
const PATHS = ['/', '/health', '/healthz'];

console.log('Running health check for The Current-See server...');

// Check each health endpoint
async function runChecks() {
  for (const path of PATHS) {
    await checkEndpoint(path);
  }
  
  // Also check for the API endpoints
  await checkEndpoint('/api/solar-clock');
  await checkEndpoint('/api/distribution-ledger');
  
  console.log('\nHealth check complete!');
}

// Function to check a specific endpoint
function checkEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'GET',
      timeout: 5000
    };
    
    console.log(`Checking ${path}...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const status = res.statusCode;
        const statusText = status >= 200 && status < 300 ? 'OK' : 'FAILED';
        
        console.log(`  Status: ${status} (${statusText})`);
        if (data.length < 1000) {
          try {
            const parsed = JSON.parse(data);
            console.log(`  Response: ${JSON.stringify(parsed, null, 2)}`);
          } catch (e) {
            console.log(`  Response: ${data.substring(0, 150)}...`);
          }
        } else {
          console.log(`  Response: ${data.substring(0, 150)}... (truncated)`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error(`  ERROR: ${error.message}`);
      resolve();
    });
    
    req.on('timeout', () => {
      console.error('  ERROR: Request timed out');
      req.abort();
      resolve();
    });
    
    req.end();
  });
}

// Run the checks
runChecks();