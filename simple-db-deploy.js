/**
 * The Current-See Production Deployment Server
 * 
 * This server is specifically designed to work with the CURRENTSEE_DB_URL environment
 * variable for database access. It includes all necessary API endpoints and
 * handles the Solar Generator clock calculations.
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const schedule = require('node-schedule');
const fs = require('fs');
const bodyParser = require('body-parser');

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
app.use(bodyParser.urlencoded({ extended: true }));
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
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
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
    
    // Create local backup
    try {
      fs.writeFileSync('members.json', JSON.stringify(members, null, 2));
      log('Created local backup of members data');
    } catch (backupErr) {
      log(`Failed to create backup: ${backupErr.message}`, true);
    }
    
    return true;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    dbConnected = false;
    
    // Try to load from local backup if available
    try {
      if (fs.existsSync('members.json')) {
        const backupData = fs.readFileSync('members.json', 'utf8');
        members = JSON.parse(backupData);
        log(`Loaded ${members.length} members from local backup`);
      }
    } catch (backupErr) {
      log(`Failed to load backup: ${backupErr.message}`, true);
    }
    
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
    totalValue: totalValue,
    formattedValue: formatCurrency(totalValue)
  };
}

// Format currency with commas
function formatCurrency(value) {
  return '$' + parseFloat(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Process daily distributions
async function processDailyDistribution() {
  if (!dbConnected || !dbPool) {
    log('Cannot process distribution: database not connected', true);
    return false;
  }
  
  const today = new Date().toISOString().split('T')[0];
  log(`Processing daily distribution for ${today}`);
  
  try {
    const client = await dbPool.connect();
    
    // Update distribution log
    await client.query(`
      INSERT INTO distribution_log (distribution_date, amount_per_member, members_count)
      VALUES ($1, $2, (SELECT COUNT(*) FROM members WHERE id > 2))
    `, [today, solarConstants.dailyDistribution]);
    
    // Update member balances excluding reserves (id <= 2)
    await client.query(`
      UPDATE members 
      SET total_solar = total_solar + $1
      WHERE id > 2
    `, [solarConstants.dailyDistribution]);
    
    // Get updated count
    const result = await client.query('SELECT COUNT(*) FROM members WHERE id > 2');
    const membersCount = parseInt(result.rows[0].count);
    
    // Reload members data
    const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
    members = allMembersResult.rows;
    
    client.release();
    
    log(`Daily distribution complete: ${solarConstants.dailyDistribution} SOLAR to ${membersCount} members`);
    return true;
  } catch (err) {
    log(`Distribution error: ${err.message}`, true);
    return false;
  }
}

// Schedule daily distribution at 00:00 GMT (5 PM Pacific)
function setupScheduledTasks() {
  log('Setting up scheduled distributions (00:00 GMT / 5 PM Pacific)');
  
  // Schedule daily distribution at midnight GMT
  schedule.scheduleJob('0 0 * * *', async () => {
    log('Running scheduled daily distribution');
    await processDailyDistribution();
  });
}

// ==================== API Routes ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'fallback mode',
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
    
    if (members.length === 0) {
      // If still no members, return Solar Reserve
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

// Signup API endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  if (!dbConnected || !dbPool) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }
  
  try {
    const client = await dbPool.connect();
    
    // Check if email already exists
    const existingResult = await client.query('SELECT id FROM members WHERE email = $1', [email]);
    
    if (existingResult.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'This email is already registered' });
    }
    
    // Create new member
    const today = new Date().toISOString().split('T')[0];
    const result = await client.query(`
      INSERT INTO members (name, email, joined_date, total_solar)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, joined_date, total_solar
    `, [name, email, today, solarConstants.dailyDistribution]);
    
    // Log signup for backup
    try {
      const signupLog = `${new Date().toISOString()},${name},${email},${result.rows[0].id}\n`;
      fs.appendFileSync('signups.log', signupLog);
    } catch (logErr) {
      log(`Error logging signup: ${logErr.message}`, true);
    }
    
    // Reload members
    const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
    members = allMembersResult.rows;
    
    client.release();
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    log(`Signup error: ${err.message}`, true);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Mobile API status endpoint
app.get('/mobile/status', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile API is running',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'fallback mode',
    usingCustomDbUrl: !!process.env.CURRENTSEE_DB_URL,
    membersCount: members.length
  });
});

// Mobile API members endpoint
app.get('/mobile/members', (req, res) => {
  // Verify API key if set
  const apiKey = req.header('X-API-KEY');
  if (process.env.MOBILE_APP_API_KEY && apiKey !== process.env.MOBILE_APP_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  try {
    // Return only the necessary fields
    const publicMembers = members.map(member => ({
      id: member.id,
      name: member.name,
      joined_date: member.joined_date,
      total_solar: member.total_solar
    }));
    
    res.json(publicMembers);
  } catch (err) {
    log(`Error serving mobile members: ${err.message}`, true);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mobile API single member endpoint
app.get('/mobile/member/:id', (req, res) => {
  // Verify API key if set
  const apiKey = req.header('X-API-KEY');
  if (process.env.MOBILE_APP_API_KEY && apiKey !== process.env.MOBILE_APP_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  const memberId = parseInt(req.params.id);
  
  if (isNaN(memberId)) {
    return res.status(400).json({ error: 'Invalid member ID' });
  }
  
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
});

// Catch-all route for SPA
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
  log(`Using custom database URL: ${!!process.env.CURRENTSEE_DB_URL}`);
  
  // Initialize database
  await initDb();
  
  // Setup scheduled tasks
  setupScheduledTasks();
  
  // Log solar data
  const solarData = calculateSolarData();
  log('Solar Generator initialized:');
  log(`- Days running: ${solarData.daysRunning}`);
  log(`- Total energy: ${solarData.totalEnergy} MkWh`);
  log(`- Total value: ${solarData.formattedValue}`);
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