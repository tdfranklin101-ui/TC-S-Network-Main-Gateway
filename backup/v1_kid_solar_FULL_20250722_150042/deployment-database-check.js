/**
 * Deployment Database Connection Checker
 * 
 * This file is specifically designed to help troubleshoot database
 * connection issues in the deployment environment.
 */

const { Pool } = require('pg');
const http = require('http');
const url = require('url');

// Helper function to log messages
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Create a basic HTTP server that reports DB connection status
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Create response headers
  res.setHeader('Content-Type', 'application/json');
  
  // Root path for basic health check
  if (parsedUrl.pathname === '/') {
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Deployment database check server is running',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Database check endpoint
  if (parsedUrl.pathname === '/check-db') {
    try {
      const result = await checkDatabaseConnection();
      res.statusCode = result.success ? 200 : 500;
      res.end(JSON.stringify(result));
    } catch (error) {
      log('Unhandled error during database check: ' + error.message, true);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: 'Unhandled exception',
        message: error.message,
        stack: error.stack
      }));
    }
    return;
  }
  
  // Environment variables check endpoint (redacted for security)
  if (parsedUrl.pathname === '/check-env') {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'set (redacted)' : 'not set',
      PGHOST: process.env.PGHOST ? 'set (redacted)' : 'not set',
      PGPORT: process.env.PGPORT || 'not set',
      PGUSER: process.env.PGUSER ? 'set (redacted)' : 'not set',
      PGPASSWORD: process.env.PGPASSWORD ? 'set (redacted)' : 'not set',
      PGDATABASE: process.env.PGDATABASE ? 'set (redacted)' : 'not set',
      PORT: process.env.PORT || '3000 (default)',
      MOBILE_APP_API_KEY: process.env.MOBILE_APP_API_KEY ? 'set (redacted)' : 'not set'
    };
    
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      environment: envVars
    }));
    return;
  }
  
  // Handle unknown paths
  res.statusCode = 404;
  res.end(JSON.stringify({
    success: false,
    error: 'Not found',
    availableEndpoints: ['/', '/check-db', '/check-env']
  }));
});

// Check database connection
async function checkDatabaseConnection() {
  log('Checking database connection...');
  
  // Check if database URL is defined
  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL environment variable is not set', true);
    return {
      success: false,
      error: 'DATABASE_URL environment variable is not set'
    };
  }
  
  let pool;
  try {
    // Create connection pool with SSL settings
    log('Creating database connection pool...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : undefined
    });

    // Try to connect to database
    log('Attempting to connect to database...');
    const client = await pool.connect();
    log('Successfully connected to database');
    
    // Test a simple query
    log('Testing simple query...');
    const res = await client.query('SELECT current_timestamp as time');
    log(`Query executed successfully. Database time: ${res.rows[0].time}`);
    
    // Check if members table exists and is accessible
    log('Testing members table access...');
    try {
      const membersRes = await client.query('SELECT COUNT(*) FROM members');
      log(`Members table accessible. Found ${membersRes.rows[0].count} members.`);
    } catch (err) {
      log(`Could not access members table: ${err.message}`, true);
      client.release();
      await pool.end();
      return {
        success: false,
        connected: true,
        tablesAccessible: false,
        error: `Could not access members table: ${err.message}`
      };
    }
    
    // Release client and end pool
    client.release();
    await pool.end();
    
    return {
      success: true,
      connected: true,
      tablesAccessible: true,
      message: 'Database connection and tables accessible'
    };
  } catch (err) {
    log(`Database connection failed: ${err.message}`, true);
    
    // Try to end pool if it was created
    if (pool) {
      try {
        await pool.end();
      } catch (endErr) {
        log(`Error ending pool: ${endErr.message}`, true);
      }
    }
    
    return {
      success: false,
      connected: false,
      error: `Database connection failed: ${err.message}`
    };
  }
}

// Start the server on the port specified by the environment or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`Deployment database check server running on port ${PORT}`);
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
  log('SIGTERM signal received. Shutting down gracefully...');
  server.close(() => {
    log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT signal received. Shutting down gracefully...');
  server.close(() => {
    log('HTTP server closed');
    process.exit(0);
  });
});