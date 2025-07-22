/**
 * The Current-See Deployment Helper
 * 
 * This script helps ensure proper environment setup during deployment.
 * It handles:
 * 1. Database connection verification
 * 2. Creating fallback strategies for database access
 * 3. Setting up proper error logging
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Helper function for logging
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
  
  // Also log to deployment-helper.log
  try {
    fs.appendFileSync(
      path.join(__dirname, 'deployment-helper.log'),
      `[${timestamp}] ${prefix}: ${message}\n`
    );
  } catch (err) {
    console.error(`Error writing to log file: ${err.message}`);
  }
}

// Verify environment variables and log status
function checkEnvironmentVariables() {
  log('Checking environment variables...');
  
  const requiredVars = [
    'DATABASE_URL',
    'PGHOST',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'PGPORT'
  ];
  
  const optional = [
    'NODE_ENV',
    'PORT',
    'MOBILE_APP_API_KEY'
  ];
  
  let missingRequired = [];
  let missingOptional = [];
  
  // Check required variables
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }
  
  // Check optional variables
  for (const envVar of optional) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }
  
  // Log results
  if (missingRequired.length > 0) {
    log(`Missing required environment variables: ${missingRequired.join(', ')}`, true);
  } else {
    log('All required environment variables are set.');
  }
  
  if (missingOptional.length > 0) {
    log(`Missing optional environment variables: ${missingOptional.join(', ')}`);
  } else {
    log('All optional environment variables are set.');
  }
  
  return {
    missingRequired,
    missingOptional
  };
}

// Create fallbacks for database connection if needed
function setupDatabaseFallbacks() {
  log('Setting up database fallbacks (if needed)...');
  
  // If we don't have a DATABASE_URL but have individual PG* vars
  if (!process.env.DATABASE_URL && 
      process.env.PGHOST && 
      process.env.PGUSER && 
      process.env.PGPASSWORD && 
      process.env.PGDATABASE) {
    
    const port = process.env.PGPORT || '5432';
    const ssl = process.env.NODE_ENV === 'production' ? 'sslmode=require' : '';
    
    // Construct DATABASE_URL from components
    process.env.DATABASE_URL = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${port}/${process.env.PGDATABASE}${ssl ? '?' + ssl : ''}`;
    
    log('Created DATABASE_URL from individual PG* environment variables.');
  }
  
  // If we have DATABASE_URL but no individual PG* vars, try to parse them
  if (process.env.DATABASE_URL && 
      (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD || !process.env.PGDATABASE)) {
    
    try {
      const url = new URL(process.env.DATABASE_URL);
      
      // Extract components from DATABASE_URL
      if (!process.env.PGHOST) process.env.PGHOST = url.hostname;
      if (!process.env.PGUSER) process.env.PGUSER = url.username;
      if (!process.env.PGPASSWORD) process.env.PGPASSWORD = url.password;
      if (!process.env.PGDATABASE) process.env.PGDATABASE = url.pathname.slice(1); // Remove leading slash
      if (!process.env.PGPORT) process.env.PGPORT = url.port || '5432';
      
      log('Extracted individual PG* environment variables from DATABASE_URL.');
    } catch (err) {
      log(`Error parsing DATABASE_URL: ${err.message}`, true);
    }
  }
}

// Test database connection
async function testDatabaseConnection() {
  log('Testing database connection...');
  
  if (!process.env.DATABASE_URL) {
    log('No DATABASE_URL set, cannot test connection.', true);
    return false;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined,
    connectionTimeoutMillis: 5000
  });
  
  try {
    const client = await pool.connect();
    log('Database connection successful!');
    
    // Test a simple query
    const res = await client.query('SELECT current_timestamp as time');
    log(`Query executed successfully. Database time: ${res.rows[0].time}`);
    
    // Check members table
    try {
      const membersRes = await client.query('SELECT COUNT(*) FROM members');
      log(`Members table accessible. Found ${membersRes.rows[0].count} members.`);
    } catch (err) {
      log(`Could not access members table: ${err.message}`, true);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    log(`Database connection failed: ${err.message}`, true);
    
    // Additional diagnostic information for common errors
    if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      log('DNS resolution error: The database hostname could not be resolved.', true);
    } else if (err.message.includes('ECONNREFUSED')) {
      log('Connection refused: The database server is not accepting connections on the specified host and port.', true);
    } else if (err.message.includes('timeout')) {
      log('Connection timeout: The database server did not respond within the timeout period.', true);
    } else if (err.message.includes('password authentication')) {
      log('Authentication failed: Incorrect username or password.', true);
    }
    
    try {
      await pool.end();
    } catch {
      // Ignore errors on pool end
    }
    return false;
  }
}

// Run the helper functions
async function run() {
  try {
    log('=== The Current-See Deployment Helper ===');
    log(`Node.js version: ${process.version}`);
    log(`Environment: ${process.env.NODE_ENV || 'not set (defaulting to development)'}`);
    
    // Check environment variables
    const envCheck = checkEnvironmentVariables();
    
    // Setup fallbacks if needed
    setupDatabaseFallbacks();
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    
    // Final status
    log('\n=== Deployment Helper Summary ===');
    if (envCheck.missingRequired.length > 0) {
      log(`Missing required environment variables: ${envCheck.missingRequired.join(', ')}`, true);
    }
    
    if (!dbConnected) {
      log('Database connection failed. Check the logs for details.', true);
    } else {
      log('Database connection successful.');
    }
    
    // Output deployment readiness
    if (envCheck.missingRequired.length === 0 && dbConnected) {
      log('✅ DEPLOYMENT READY: Environment is correctly configured.');
    } else {
      log('❌ DEPLOYMENT NOT READY: Please fix the issues above.', true);
    }
  } catch (err) {
    log(`Unhandled error in deployment helper: ${err.message}`, true);
    console.error(err);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  checkEnvironmentVariables,
  setupDatabaseFallbacks,
  testDatabaseConnection,
  run
};