/**
 * The Current-See Deployment Server with Database Fallback
 * 
 * This production server includes enhanced error handling and fallback
 * mechanisms for database connection issues in deployment environments.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const schedule = require('node-schedule');
const cors = require('cors');
const bodyParser = require('body-parser');
const deploymentHelper = require('./deployment-helper');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(express.static('public'));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection state
let dbInitialized = false;
let dbPool = null;
let members = [];
let solarConstants = {
  startDate: new Date('2025-04-07T00:00:00Z'),
  solarValue: 136000, // $ per SOLAR
  solarToEnergy: 4913, // kWh per SOLAR
  reserveAmount: 10000000000 // 10 billion SOLAR
};

// Initialize database pool with error handling
function initializeDbPool() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    return null;
  }
  
  try {
    // Log the database connection attempt
    console.log('Attempting to connect to PostgreSQL database...');
    
    // Create pool with SSL settings
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : undefined,
      // Set reasonable timeouts
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20
    });
  } catch (err) {
    console.error(`❌ ERROR creating database pool: ${err.message}`);
    return null;
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
  
  // Approximate total energy over time
  const totalEnergyKwH = elapsedHours * hourlyKwH;
  
  // Convert to more readable format (MkWh with 6 decimal places)
  const totalEnergyMkWh = (totalEnergyKwH / 1000000).toFixed(6);
  
  // Calculate monetary value based on the energy
  const totalValue = ((totalEnergyKwH / solarConstants.solarToEnergy) * solarConstants.solarValue).toFixed(2);
  
  return {
    daysRunning: diffDays,
    hoursRunning: elapsedHours,
    totalEnergy: totalEnergyMkWh,
    totalValue: totalValue
  };
}

// Load members from database with fallback to file
async function loadMembers() {
  if (!dbPool) {
    console.log('No database connection. Attempting to initialize database pool...');
    dbPool = initializeDbPool();
    
    if (!dbPool) {
      console.error('Failed to initialize database pool. Trying backup files...');
      return loadMembersFromFiles();
    }
  }
  
  try {
    console.log('Loading members from database...');
    const result = await dbPool.query(`
      SELECT * FROM members
      ORDER BY id ASC
    `);
    
    if (result.rows.length === 0) {
      console.warn('Warning: No members found in database! Trying backup files...');
      return loadMembersFromFiles();
    }
    
    members = result.rows;
    console.log(`Successfully loaded ${members.length} members from database.`);
    dbInitialized = true;
    return members;
  } catch (err) {
    console.error(`❌ DATABASE ERROR: ${err.message}`);
    console.log('Falling back to file-based member data...');
    return loadMembersFromFiles();
  }
}

// Fallback: Load members from JSON files
function loadMembersFromFiles() {
  console.log('Loading members from backup files...');
  try {
    // Try different potential file locations
    const possiblePaths = [
      path.join(__dirname, 'members.json'),
      path.join(__dirname, 'public', 'data', 'members.json'),
      path.join(__dirname, 'data', 'members.json'),
      path.join(__dirname, 'backup', 'members.json')
    ];
    
    let loadedMembers = null;
    
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log(`Found members file at: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        loadedMembers = JSON.parse(fileContent);
        break;
      }
    }
    
    if (!loadedMembers) {
      console.error('❌ ERROR: Could not find any members backup files!');
      // Create a minimal members list with just the reserve
      return [{
        id: 0,
        name: "TC-S Solar Reserve",
        username: "reserve",
        email: "reserve@thecurrentsee.org",
        joined_date: "2025-04-07",
        total_solar: solarConstants.reserveAmount,
        last_distribution_date: new Date().toISOString().split('T')[0]
      }];
    }
    
    members = loadedMembers;
    console.log(`Successfully loaded ${members.length} members from backup file.`);
    return members;
  } catch (err) {
    console.error(`❌ ERROR loading members from file: ${err.message}`);
    
    // Last resort: Create a minimal members list with just the reserve
    return [{
      id: 0,
      name: "TC-S Solar Reserve",
      username: "reserve",
      email: "reserve@thecurrentsee.org",
      joined_date: "2025-04-07",
      total_solar: solarConstants.reserveAmount, 
      last_distribution_date: new Date().toISOString().split('T')[0]
    }];
  }
}

// ==================== API Routes ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'fallback mode',
    membersCount: members.length
  });
});

// Root path for deployment compatibility
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get solar clock data
app.get('/api/solar-clock', (req, res) => {
  const solarData = initSolarClockData();
  res.json(solarData);
});

// API endpoint to get members list (public fields only)
app.get('/api/members', async (req, res) => {
  try {
    if (members.length === 0) {
      await loadMembers();
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
    console.error(`Error serving /api/members: ${err.message}`);
    res.status(500).json({
      error: 'Server error when retrieving members',
      message: err.message
    });
  }
});

// Database status endpoint
app.get('/api/database/status', async (req, res) => {
  try {
    if (!dbPool) {
      dbPool = initializeDbPool();
    }
    
    if (!dbPool) {
      return res.status(500).json({
        status: 'error',
        connected: false,
        message: 'Database connection not configured'
      });
    }
    
    // Test database connection
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
    console.error(`Database status check error: ${err.message}`);
    res.status(500).json({
      status: 'error',
      connected: false,
      message: err.message
    });
  }
});

// Mobile API status endpoint (minimal version for deployment checks)
app.get('/mobile/status', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile API is running',
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'fallback mode'
  });
});

// Catchall for SPA routing
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
  console.log(`=== The Current-See Server (Deployment Version) ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check environment and database on startup
  await deploymentHelper.run();
  
  // Load members data
  try {
    await loadMembers();
  } catch (err) {
    console.error(`Error loading members: ${err.message}`);
  }
  
  // Log the solar constants
  const solarData = initSolarClockData();
  console.log('Solar Generator initialized:');
  console.log(`- Days running: ${solarData.daysRunning}`);
  console.log(`- Total energy: ${solarData.totalEnergy} MkWh`);
  console.log(`- Total value: $${solarData.totalValue}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully...');
  server.close(async () => {
    console.log('HTTP server closed.');
    
    if (dbPool) {
      try {
        console.log('Closing database pool...');
        await dbPool.end();
        console.log('Database connections closed.');
      } catch (err) {
        console.error(`Error closing database pool: ${err.message}`);
      }
    }
    
    process.exit(0);
  });
});

// Handle SIGINT
process.on('SIGINT', () => {
  console.log('SIGINT signal received. Shutting down gracefully...');
  server.close(async () => {
    console.log('HTTP server closed.');
    
    if (dbPool) {
      try {
        console.log('Closing database pool...');
        await dbPool.end();
        console.log('Database connections closed.');
      } catch (err) {
        console.error(`Error closing database pool: ${err.message}`);
      }
    }
    
    process.exit(0);
  });
});