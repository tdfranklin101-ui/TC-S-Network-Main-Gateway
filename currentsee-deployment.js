/**
 * The Current-See Minimal Deployment Server
 * 
 * This server is specifically designed to work with the CURRENTSEE_DB_URL environment
 * variable for database access.
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Global variables
let dbPool = null;
let dbConnected = false;
let members = [];
let solarConstants = {
  startDate: new Date('2025-04-07T00:00:00Z'),
  solarValue: 136000, // $ per SOLAR
  solarToEnergy: 4913, // kWh per SOLAR
  reserveAmount: 10000000000, // 10 billion SOLAR
  dailyDistribution: 1 // SOLAR per day per member
};

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// Logger function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Database connection using CURRENTSEE_DB_URL
async function initDb() {
  log('Initializing database connection...');
  
  const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    log('No database URL available', true);
    return false;
  }
  
  log(`Using database URL: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
  
  try {
    dbPool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20
    });
    
    const client = await dbPool.connect();
    log('Database connection successful!');
    
    const result = await client.query('SELECT current_database() as db, current_user as user');
    log(`Connected to database: ${result.rows[0].db} as user: ${result.rows[0].user}`);
    
    const membersResult = await client.query('SELECT COUNT(*) FROM members');
    log(`Found ${membersResult.rows[0].count} members in the database`);
    
    // Load members data
    const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
    members = allMembersResult.rows;
    log(`Loaded ${members.length} members from database`);
    
    client.release();
    dbConnected = true;
    return true;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    dbConnected = false;
    return false;
  }
}

// Calculate Solar Generator data
function calculateSolarData() {
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
    database: dbConnected ? 'connected' : 'disconnected',
    membersCount: members.length,
    environment: process.env.NODE_ENV || 'development',
    usingCustomDbUrl: !!process.env.CURRENTSEE_DB_URL
  });
});

// Root path for deployment compatibility 
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    const result = await client.query('SELECT NOW() as time');
    const membersResult = await client.query('SELECT COUNT(*) FROM members');
    client.release();
    
    res.json({
      status: 'ok',
      connected: true,
      timestamp: result.rows[0].time,
      membersCount: parseInt(membersResult.rows[0].count),
      environmentType: process.env.NODE_ENV || 'development',
      usingCustomDbUrl: !!process.env.CURRENTSEE_DB_URL
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
  const solarData = calculateSolarData();
  res.json(solarData);
});

// Members API endpoint
app.get('/api/members', async (req, res) => {
  try {
    if (members.length === 0 && dbConnected) {
      // Try to reload members from database
      try {
        const client = await dbPool.connect();
        const result = await client.query('SELECT * FROM members ORDER BY id ASC');
        members = result.rows;
        client.release();
        log(`Reloaded ${members.length} members from database`);
      } catch (err) {
        log(`Error reloading members: ${err.message}`, true);
      }
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

// Single member API endpoint
app.get('/api/member/:id', async (req, res) => {
  const memberId = parseInt(req.params.id);
  
  if (isNaN(memberId)) {
    return res.status(400).json({ error: 'Invalid member ID' });
  }
  
  try {
    if (dbConnected) {
      const client = await dbPool.connect();
      const result = await client.query('SELECT id, name, joined_date, total_solar FROM members WHERE id = $1', [memberId]);
      client.release();
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      res.json(result.rows[0]);
    } else {
      // Fallback to memory
      const member = members.find(m => m.id === memberId);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      res.json({
        id: member.id,
        name: member.name,
        joined_date: member.joined_date,
        total_solar: member.total_solar
      });
    }
  } catch (err) {
    log(`Error fetching member ${memberId}: ${err.message}`, true);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Catch-all route for SPA support
app.get('*', (req, res) => {
  // Skip API requests
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      path: req.path
    });
  }
  
  // Send index.html for all other routes (SPA support)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, async () => {
  log('=== The Current-See Minimal Deployment Server ===');
  log(`Server running on port ${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Using custom database URL: ${!!process.env.CURRENTSEE_DB_URL}`);
  
  // Initialize database
  await initDb();
  
  // Log solar data
  const solarData = calculateSolarData();
  log('Solar Generator initialized:');
  log(`- Days running: ${solarData.daysRunning}`);
  log(`- Total energy: ${solarData.totalEnergy} MkWh`);
  log(`- Total value: $${solarData.totalValue}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  server.close(() => {
    log('Server closed');
    if (dbPool) {
      dbPool.end()
        .then(() => log('Database pool closed'))
        .catch(err => log(`Error closing db pool: ${err.message}`, true))
        .finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
});