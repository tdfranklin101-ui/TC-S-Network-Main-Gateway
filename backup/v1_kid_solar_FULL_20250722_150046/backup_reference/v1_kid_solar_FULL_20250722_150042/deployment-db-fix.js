/**
 * The Current-See Deployment Database Fix
 * 
 * This script helps fix database connectivity issues in the deployment environment
 * by providing a simple verification and fallback mechanism.
 * 
 * Usage: 
 * 1. Add this file to your deployment
 * 2. Run it with: node deployment-db-fix.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Log with timestamp
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Main function
async function main() {
  log('=== The Current-See Database Deployment Fix ===');
  
  // Check if we have the DATABASE_URL environment variable
  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL environment variable is not set.', true);
    log('Setting up from individual PG* variables...');
    
    // Check if we have the individual PG* variables
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;
    const pgDatabase = process.env.PGDATABASE;
    
    if (!pgHost || !pgUser || !pgPassword || !pgDatabase) {
      log('Missing required PG* environment variables.', true);
      return false;
    }
    
    // Construct DATABASE_URL from individual variables
    process.env.DATABASE_URL = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
    log('Created DATABASE_URL from individual PG* variables.');
  }
  
  // Test the database connection
  log('Testing database connection...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Try to connect
    const client = await pool.connect();
    log('Successfully connected to the database.');
    
    // Test a simple query
    const dbInfoResult = await client.query('SELECT current_database() as db, current_user as user');
    log(`Connected to database: ${dbInfoResult.rows[0].db} as user: ${dbInfoResult.rows[0].user}`);
    
    // Check if the members table exists and has data
    try {
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      log(`Found ${membersResult.rows[0].count} members in the database.`);
      
      // Check the first few members
      const membersDetailsResult = await client.query('SELECT id, name, joined_date FROM members ORDER BY id ASC LIMIT 5');
      log('First few members:');
      membersDetailsResult.rows.forEach(member => {
        log(`  ${member.id}: ${member.name} (joined: ${member.joined_date})`);
      });
      
    } catch (tableErr) {
      log(`Error accessing members table: ${tableErr.message}`, true);
      log('The database exists but the members table might not be properly set up.', true);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    
    // Provide additional diagnostic information
    if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      log('DNS error: The database hostname cannot be resolved.', true);
      log(`Hostname: ${new URL(process.env.DATABASE_URL).hostname}`, true);
    } else if (err.message.includes('ECONNREFUSED')) {
      log('Connection refused: The database server is not accepting connections.', true);
    } else if (err.message.includes('password authentication failed')) {
      log('Authentication failed: Incorrect username or password.', true);
    } else if (err.message.includes('does not exist')) {
      log('Database not found: The specified database does not exist.', true);
    } else if (err.message.includes('ssl')) {
      log('SSL error: Try modifying the SSL settings.', true);
      log('For Neon databases, you need: ssl: { rejectUnauthorized: false }', true);
    }
    
    await pool.end();
    return false;
  }
}

// Create a simple HTTP server to report database status
function createStatusServer() {
  const http = require('http');
  const PORT = process.env.PORT || 3000;
  
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      try {
        const dbConnected = await main();
        res.end(JSON.stringify({
          status: dbConnected ? 'ok' : 'database_error',
          timestamp: new Date().toISOString(),
          message: dbConnected ? 'Database connection successful' : 'Database connection failed'
        }));
      } catch (err) {
        res.end(JSON.stringify({
          status: 'error',
          timestamp: new Date().toISOString(),
          message: err.message
        }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
    }
  });
  
  server.listen(PORT, () => {
    log(`Database fix status server running on port ${PORT}`);
  });
}

// Run the main function
if (require.main === module) {
  if (process.argv.includes('--server')) {
    createStatusServer();
  } else {
    main().then(success => {
      if (success) {
        log('✅ DATABASE CONNECTION SUCCESSFUL');
        log('Your database is properly configured.');
      } else {
        log('❌ DATABASE CONNECTION FAILED', true);
        log('Check the error messages above for more information.', true);
      }
    }).catch(err => {
      log(`Unexpected error: ${err.message}`, true);
      process.exit(1);
    });
  }
}

module.exports = { main };