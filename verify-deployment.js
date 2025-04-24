/**
 * The Current-See Deployment Verification Script
 * 
 * This script checks if the deployment server is running correctly
 * and verifies database connectivity.
 */

const http = require('http');
const { Pool } = require('pg');

async function verifyServer() {
  console.log('=== The Current-See Deployment Verification ===');
  
  // Check if server is running
  try {
    const healthResponse = await makeRequest('/health');
    console.log('✅ Server is running');
    console.log(`Database status: ${healthResponse.database}`);
    console.log(`Members count: ${healthResponse.membersCount}`);
    console.log(`Using custom DB URL: ${healthResponse.usingCustomDbUrl}`);
    
    // Check solar clock
    const solarResponse = await makeRequest('/api/solar-clock');
    console.log('\n✅ Solar Generator is working');
    console.log(`Days running: ${solarResponse.daysRunning}`);
    console.log(`Total energy: ${solarResponse.totalEnergy} MkWh`);
    console.log(`Total value: $${solarResponse.totalValue}`);
    
    // Check members API
    const membersResponse = await makeRequest('/api/members');
    console.log(`\n✅ Members API is working (${membersResponse.length} members)`);
    console.log('First few members:');
    membersResponse.slice(0, 5).forEach(member => {
      console.log(`  ${member.id}: ${member.name} (${member.total_solar} SOLAR)`);
    });
    
    return true;
  } catch (err) {
    console.error(`❌ ERROR: ${err.message}`);
    return false;
  }
}

// Function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
            return;
          }
          
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });
    
    req.end();
  });
}

// Check database connection directly
async function verifyDatabase() {
  const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ No database URL found in environment');
    return false;
  }
  
  console.log(`\nVerifying direct database connection...`);
  console.log(`Using URL: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
  
  try {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log('✅ Direct database connection successful');
    
    const result = await client.query('SELECT current_database() as db, current_user as user');
    console.log(`Connected to: ${result.rows[0].db} as user: ${result.rows[0].user}`);
    
    const membersResult = await client.query('SELECT COUNT(*) FROM members');
    console.log(`Found ${membersResult.rows[0].count} members in database`);
    
    client.release();
    await pool.end();
    
    return true;
  } catch (err) {
    console.error(`❌ Database connection error: ${err.message}`);
    return false;
  }
}

// Wait for a specified time
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run verification
async function main() {
  console.log('Waiting for server to fully initialize...');
  // Wait 5 seconds for the server to fully initialize
  await delay(5000);
  
  const serverOk = await verifyServer();
  const dbOk = await verifyDatabase();
  
  if (serverOk && dbOk) {
    console.log('\n✅ DEPLOYMENT VERIFICATION PASSED');
    console.log('The Current-See is ready for deployment!');
  } else {
    console.log('\n❌ DEPLOYMENT VERIFICATION FAILED');
    console.log('Please fix the issues before deploying.');
  }
  
  process.exit(serverOk && dbOk ? 0 : 1);
}

main().catch(err => {
  console.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});