/**
 * The Current-See Main Deployment Script
 * 
 * This script is specifically built to handle database connectivity issues
 * in deployment environments. It includes fallback mechanisms and detailed
 * error reporting to make troubleshooting easier.
 */

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(express.static('public'));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Global variables
let dbPool = null;
let dbConnected = false;
let members = [];
let solarConstants = {
  startDate: new Date('2025-04-07T00:00:00Z'),
  solarValue: 136000, // $ per SOLAR
  solarToEnergy: 4913, // kWh per SOLAR
  reserveAmount: 10000000000 // 10 billion SOLAR
};

// Logger
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Initialize database connection
async function initializeDatabase() {
  // Check if DATABASE_URL is defined
  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL environment variable is not set.', true);
    
    // Try to build it from individual PG variables
    const pgHost = process.env.PGHOST;
    const pgPort = process.env.PGPORT || '5432';
    const pgUser = process.env.PGUSER;
    const pgPassword = process.env.PGPASSWORD;
    const pgDatabase = process.env.PGDATABASE;
    
    if (!pgHost || !pgUser || !pgPassword || !pgDatabase) {
      log('Missing required PG* environment variables. Cannot initialize database.', true);
      return false;
    }
    
    // Construct DATABASE_URL from individual variables
    process.env.DATABASE_URL = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
    log('Created DATABASE_URL from individual PG* variables.');
  }
  
  try {
    // Create database pool
    log('Initializing database connection pool...');
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    
    // Test connection
    const client = await dbPool.connect();
    log('Database connection successful!');
    
    // Get database info
    const dbInfoResult = await client.query('SELECT current_database() as db, current_user as user');
    log(`Connected to database: ${dbInfoResult.rows[0].db} as user: ${dbInfoResult.rows[0].user}`);
    
    // Check members table
    try {
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      log(`Found ${membersResult.rows[0].count} members in the database.`);
      
      // Load members data
      const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
      members = allMembersResult.rows;
      log(`Loaded ${members.length} members from database.`);
      
      dbConnected = true;
    } catch (tableErr) {
      log(`Error accessing members table: ${tableErr.message}`, true);
      log('The database exists but the members table might not be properly set up.', true);
      dbConnected = false;
    }
    
    client.release();
    return dbConnected;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    
    // Provide detailed error information
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
    
    dbConnected = false;
    return false;
  }
}

// Initialize solar clock data
function initSolarClockData() {
  const now = new Date();
  const startDate = solarConstants.startDate;
  const diffTime = Math.abs(now - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const hourlyKwH = 27777.778; // 2/3 of a million kWh per day, distributed hourly
  const elapsedHours = Math.floor(diffTime / (1000 * 60 * 60));
  
  // Calculate total energy
  const totalEnergyKwH = elapsedHours * hourlyKwH;
  
  // Format as MkWh with 6 decimal places
  const totalEnergyMkWh = (totalEnergyKwH / 1000000).toFixed(6);
  
  // Calculate monetary value
  const totalValue = ((totalEnergyKwH / solarConstants.solarToEnergy) * solarConstants.solarValue).toFixed(2);
  
  return {
    daysRunning: diffDays,
    hoursRunning: elapsedHours,
    totalEnergy: totalEnergyMkWh,
    totalValue: totalValue
  };
}

// ==================== API Routes ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'fallback mode',
    membersCount: members.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database status endpoint
app.get('/api/database/status', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(500).json({
        status: 'error',
        connected: false,
        message: 'Database connection not initialized'
      });
    }
    
    const client = await dbPool.connect();
    const result = await client.query('SELECT current_timestamp');
    const membersResult = await client.query('SELECT COUNT(*) FROM members');
    client.release();
    
    res.json({
      status: 'ok',
      connected: true,
      timestamp: result.rows[0].current_timestamp,
      membersCount: parseInt(membersResult.rows[0].count),
      environmentType: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    log(`Database status check error: ${err.message}`, true);
    res.status(500).json({
      status: 'error',
      connected: false,
      message: err.message
    });
  }
});

// Solar clock API endpoint
app.get('/api/solar-clock', (req, res) => {
  const solarData = initSolarClockData();
  res.json(solarData);
});

// Members API endpoint
app.get('/api/members', async (req, res) => {
  try {
    if (members.length === 0 && dbConnected) {
      // Try to load members from database again
      try {
        const client = await dbPool.connect();
        const result = await client.query('SELECT * FROM members ORDER BY id ASC');
        members = result.rows;
        client.release();
        log(`Reloaded ${members.length} members from database.`);
      } catch (err) {
        log(`Error reloading members: ${err.message}`, true);
      }
    }
    
    if (members.length === 0) {
      // If still no members, just return Solar Reserve
      members = [{
        id: 1,
        name: "TC-S Solar Reserve",
        joined_date: "2025-04-07",
        total_solar: solarConstants.reserveAmount
      }];
    }
    
    // Map to public fields only
    const publicMembers = members.map(member => ({
      id: member.id,
      name: member.name,
      joined_date: member.joined_date,
      total_solar: member.total_solar
    }));
    
    res.json(publicMembers);
  } catch (err) {
    log(`Error serving /api/members: ${err.message}`, true);
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
});

// Database connection fix endpoint
app.get('/fix-database', async (req, res) => {
  try {
    log('Attempting to fix database connection...');
    const result = await initializeDatabase();
    
    res.json({
      success: result,
      message: result ? 'Database connection fixed successfully' : 'Failed to fix database connection',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    log(`Error in fix-database: ${err.message}`, true);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Mobile API status endpoint
app.get('/mobile/status', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile API is running',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'fallback mode'
  });
});

// Root path for deployment compatibility
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catchall route for SPA
app.get('*', (req, res) => {
  // Skip API requests
  if (req.url.startsWith('/api/') || req.url.startsWith('/mobile/')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      path: req.url
    });
  }
  
  // Send index.html for all other routes (SPA support)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, async () => {
  log('=== The Current-See Deployment Server ===');
  log(`Server running on port ${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Database URL format: postgres://<username>:<password>@${process.env.PGHOST || new URL(process.env.DATABASE_URL).hostname}:${process.env.PGPORT || new URL(process.env.DATABASE_URL).port || '5432'}/${process.env.PGDATABASE || new URL(process.env.DATABASE_URL).pathname.substring(1)}`);
  
  // Initialize database
  await initializeDatabase();
  
  // Log solar data
  const solarData = initSolarClockData();
  log('Solar Generator initialized:');
  log(`- Days running: ${solarData.daysRunning}`);
  log(`- Total energy: ${solarData.totalEnergy} MkWh`);
  log(`- Total value: $${solarData.totalValue}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM signal received. Shutting down gracefully...');
  server.close(async () => {
    log('HTTP server closed.');
    
    if (dbPool) {
      try {
        log('Closing database pool...');
        await dbPool.end();
        log('Database connections closed.');
      } catch (err) {
        log(`Error closing database pool: ${err.message}`, true);
      }
    }
    
    process.exit(0);
  });
});

// Handle SIGINT
process.on('SIGINT', () => {
  log('SIGINT signal received. Shutting down gracefully...');
  server.close(async () => {
    log('HTTP server closed.');
    
    if (dbPool) {
      try {
        log('Closing database pool...');
        await dbPool.end();
        log('Database connections closed.');
      } catch (err) {
        log(`Error closing database pool: ${err.message}`, true);
      }
    }
    
    process.exit(0);
  });
});