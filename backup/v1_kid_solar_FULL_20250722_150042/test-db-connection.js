/**
 * Database Connection Test Script
 * 
 * This script attempts to connect to the PostgreSQL database and provides
 * detailed diagnostics about connection issues.
 */

const { Pool } = require('pg');
const dns = require('dns');
const net = require('net');
const url = require('url');

// Database URL
const dbUrl = process.env.DATABASE_URL;

// Parse the database URL
function parseDatabaseUrl(dbUrl) {
  if (!dbUrl) {
    return { error: 'DATABASE_URL is not defined in the environment' };
  }

  try {
    const parsed = new URL(dbUrl);
    const auth = parsed.username ? `${parsed.username}:***` : '';
    const dbInfo = {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : '',
      user: parsed.username || '',
      ssl: dbUrl.includes('sslmode=require'),
      connectionString: `${parsed.protocol}//${auth ? auth + '@' : ''}${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname || ''}${parsed.search || ''}`
    };
    return { success: true, dbInfo };
  } catch (error) {
    return { error: `Invalid DATABASE_URL format: ${error.message}` };
  }
}

// Resolve hostname
async function checkDns(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, address });
      }
    });
  });
}

// Check TCP connection
async function checkTcpConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    // Set a timeout for the connection attempt
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      resolved = true;
      socket.end();
      resolve({ success: true });
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        socket.destroy();
        resolve({ success: false, error: 'Connection timed out' });
      }
    });
    
    socket.on('error', (err) => {
      if (!resolved) {
        resolve({ success: false, error: err.message });
      }
    });
    
    socket.connect(port, host);
  });
}

// Test database connection
async function testDbConnection() {
  if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    return false;
  }
  
  // Create a new pool for testing
  const pool = new Pool({
    connectionString: dbUrl,
    // Try with and without SSL
    ssl: dbUrl.includes('sslmode=require') ? {
      rejectUnauthorized: false
    } : undefined,
    connectionTimeoutMillis: 5000
  });
  
  try {
    console.log('Attempting to connect to database...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const res = await client.query('SELECT current_timestamp as time');
    console.log(`✅ Query executed successfully. Database time: ${res.rows[0].time}`);
    
    // Check members table
    try {
      const membersRes = await client.query('SELECT COUNT(*) FROM members');
      console.log(`✅ Members table accessible. Found ${membersRes.rows[0].count} members.`);
    } catch (err) {
      console.error(`❌ Could not access members table: ${err.message}`);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.error(`❌ Database connection failed: ${err.message}`);
    await pool.end();
    return false;
  }
}

// Run all the tests
async function runDiagnostics() {
  console.log('=== Database Connection Diagnostics ===');
  console.log(`Node.js environment: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`Current directory: ${process.cwd()}`);
  
  // Parse DB URL and check for basic issues
  const parseResult = parseDatabaseUrl(dbUrl);
  if (parseResult.error) {
    console.error(`❌ ${parseResult.error}`);
    return;
  }
  
  const { dbInfo } = parseResult;
  console.log(`\nConnection Information:`);
  console.log(`Host: ${dbInfo.host}`);
  console.log(`Port: ${dbInfo.port}`);
  console.log(`Database: ${dbInfo.database}`);
  console.log(`User: ${dbInfo.user ? '[Provided]' : '[Missing]'}`);
  console.log(`SSL: ${dbInfo.ssl ? 'Enabled' : 'Disabled'}`);
  
  // DNS Resolution Test
  console.log('\nChecking DNS resolution...');
  const dnsResult = await checkDns(dbInfo.host);
  if (dnsResult.success) {
    console.log(`✅ DNS resolution successful: ${dbInfo.host} -> ${dnsResult.address}`);
  } else {
    console.error(`❌ DNS resolution failed: ${dnsResult.error}`);
    console.log('This indicates a network or DNS issue. Check if the hostname is correct and accessible from this environment.');
  }
  
  // TCP Connection Test
  console.log('\nChecking TCP connection...');
  const tcpResult = await checkTcpConnection(dbInfo.host, dbInfo.port);
  if (tcpResult.success) {
    console.log(`✅ TCP connection successful to ${dbInfo.host}:${dbInfo.port}`);
  } else {
    console.error(`❌ TCP connection failed: ${tcpResult.error}`);
    console.log('This indicates a network connectivity issue, firewall rule, or that the database server is not running.');
  }
  
  // Postgres Connection Test
  console.log('\nChecking PostgreSQL connection...');
  const pgSuccess = await testDbConnection();
  
  console.log('\n=== Diagnostics Summary ===');
  if (!pgSuccess) {
    console.log('Based on the tests, here are possible solutions:');
    
    if (!dbUrl) {
      console.log('1. Set the DATABASE_URL environment variable in your deployment environment');
    }
    
    if (parseResult.error) {
      console.log('1. Check the format of your DATABASE_URL - it appears to be invalid');
    } else {
      if (!dnsResult.success) {
        console.log('1. Verify the database hostname is correct');
        console.log('2. Ensure DNS resolution is working in your deployment environment');
      }
      
      if (!tcpResult.success) {
        console.log('1. Check if the database server is running');
        console.log('2. Verify there are no firewall rules blocking the connection');
        console.log('3. Ensure the database is configured to accept remote connections');
      }
      
      if (dnsResult.success && tcpResult.success) {
        console.log('1. Verify your database username and password are correct');
        console.log('2. Ensure the database exists and the user has access to it');
        console.log('3. Check if SSL is required but not configured correctly');
      }
    }
    
    console.log('\nFor Replit deployments, ensure that:');
    console.log('1. All environment variables (including DATABASE_URL) are transferred to the deployment');
    console.log('2. Your database allows connections from the deployment IP address');
    console.log('3. Your deployment is using the correct environment (production vs. development)');
  } else {
    console.log('✅ All tests passed! Your database connection is working properly.');
  }
}

// Run the diagnostics
runDiagnostics().catch(err => {
  console.error('Unhandled error during diagnostics:', err);
  process.exit(1);
});