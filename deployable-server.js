/**
 * The Current-See Cloud Run Ready Server
 * 
 * This is a specialized server implementation for Replit deployments.
 * It provides:
 * 1. Proper health checks needed for Replit cloud run (responding to / and /health)
 * 2. Port configuration that works with Replit deployments (using PORT env var)
 * 3. Static file serving for the website
 * 4. API endpoints with proper database connectivity
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Pool } = require('pg');
const ws = require('ws');

// Constants
const PORT = process.env.PORT || 3000;
const SOLAR_VALUE = 136000;
const KWH_PER_SOLAR = 4913;
const START_DATE = new Date('2025-04-07T00:00:00Z');

// Calculate energy production rate (kWh per second)
const kwhPerSecond = 483333333.5;

// Initialize Express app
const app = express();

// Set up middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a write stream for logging
const logFile = fs.createWriteStream(path.join(__dirname, 'deploy.log'), { flags: 'a' });

// Log function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${isError ? '✗ ERROR:' : '✓ INFO:'} ${message}`;
  console.log(entry);
  logFile.write(entry + '\n');
}

// Error handler
function handleError(err, req, res, next) {
  log(`Error: ${err.message}`, true);
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
}

// Database connection setup
let pool;
let members = [];
let useMemory = false;
const fallbackMembers = [
  {
    id: 1,
    name: "Terry D. Franklin",
    joined_date: "2025-04-09",
    solar_amount: 19
  },
  {
    id: 2,
    name: "JF",
    joined_date: "2025-04-10",
    solar_amount: 18
  },
  {
    id: 3,
    name: "Davis",
    joined_date: "2025-04-18",
    solar_amount: 10
  },
  {
    id: 4,
    name: "Miles Franklin",
    joined_date: "2025-04-18",
    solar_amount: 10
  },
  {
    id: 5,
    name: "John D",
    joined_date: "2025-04-26",
    solar_amount: 2
  }
];

// Initialize database connection
async function initDb() {
  try {
    if (!process.env.CURRENTSEE_DB_URL && !process.env.DATABASE_URL) {
      log('No database URL found. Using memory storage.', true);
      useMemory = true;
      members = fallbackMembers;
      updateEmbeddedMembersFile();
      return false;
    }

    const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
    log('Using database URL: ' + dbUrl.replace(/:[^:]*@/, ':***@'));

    // Create PostgreSQL pool with additional error handling
    pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection couldn't be established
    });

    // Add error handler to the pool
    pool.on('error', (err) => {
      log(`Unexpected database pool error: ${err.message}`, true);
      
      // Don't crash the entire application, just log the error
      if (!useMemory) {
        log('Switching to memory storage due to database error', true);
        useMemory = true;
        members = members.length > 0 ? members : fallbackMembers;
        updateEmbeddedMembersFile();
      }
    });

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    log('Database connection successful!');
    log(`Connected to database: ${result.rows[0].now}`);
    
    // Load members
    await loadMembers();
    
    return true;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    log('Using memory storage...', true);
    useMemory = true;
    members = fallbackMembers;
    updateEmbeddedMembersFile();
    return false;
  }
}

// Load members from database
async function loadMembers() {
  if (useMemory) {
    log('Using memory storage for members data');
    return members;
  }
  
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM members ORDER BY joined_date ASC');
    
    // Process members data - only show public members (hiding test users)
    members = result.rows.filter(member => {
      // Skip test users that should be hidden from public display
      const isTestUser = member.is_test_user || member.isTestUser;
      const name = member.name || '';
      return !isTestUser || (name === 'John D' && member.joined_date === '2025-04-26');
    });
    
    log(`Loaded ${members.length} members from database`);
    
    // Update embedded members file
    updateEmbeddedMembersFile();
    
    return members;
  } catch (err) {
    log(`Error loading members: ${err.message}`, true);
    
    // Switch to memory storage if we encounter database errors
    if (!useMemory) {
      log('Switching to memory storage for members data', true);
      useMemory = true;
      members = fallbackMembers;
      updateEmbeddedMembersFile();
    }
    
    return members;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseErr) {
        log(`Error releasing client: ${releaseErr.message}`, true);
      }
    }
  }
}

// Update embedded members file
function updateEmbeddedMembersFile() {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'public/embedded-members'),
      `window.embeddedMembers = ${JSON.stringify(members)};`
    );
    log('Updated embedded members file');
  } catch (err) {
    log(`Error updating embedded members file: ${err.message}`, true);
  }
}

// Calculate solar data
function calculateSolarData() {
  const now = new Date();
  const diffSeconds = (now - START_DATE) / 1000;
  
  // Calculate total energy and value
  const totalKwh = diffSeconds * kwhPerSecond;
  const totalMkwh = totalKwh / 1000000;
  const totalValue = (totalKwh / KWH_PER_SOLAR) * SOLAR_VALUE;
  
  return {
    startDate: START_DATE.toISOString(),
    currentDate: now.toISOString(),
    secondsRunning: diffSeconds,
    daysRunning: Math.floor(diffSeconds / 86400),
    totalKwh: totalKwh,
    totalMkwh: totalMkwh.toFixed(6),
    totalValue: totalValue.toFixed(2),
    formattedValue: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(totalValue)
  };
}

// Route: Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'The Current-See Cloud Run Server'
  });
});

// Route: Health check at root path for Replit Cloud Run
app.get('/', (req, res) => {
  // For API requests, return health check
  const accepts = req.headers.accept || '';
  if (accepts.includes('application/json')) {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'The Current-See Cloud Run Server'
    });
  }
  
  // For browser requests, serve the index.html file
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Route: Get members
app.get('/api/members.json', (req, res) => {
  res.json(members);
});

// Route: Get member count
app.get('/api/member-count', (req, res) => {
  const count = members.filter(m => !m.is_reserve && !m.isReserve).length;
  res.json({ count });
});

// Route: Get solar data
app.get('/api/solar-data', (req, res) => {
  res.json(calculateSolarData());
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Register error handler
app.use(handleError);

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, '0.0.0.0', async () => {
  log(`=== The Current-See Cloud Run Server v1.2.2 ===`);
  log(`Server running on http://0.0.0.0:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize database
  await initDb();
  
  // Initialize Solar Generator
  const solarData = calculateSolarData();
  log(`Solar Generator initialized:`);
  log(`- Days running: ${solarData.daysRunning}`);
  log(`- Total energy: ${solarData.totalMkwh} MkWh`);
  log(`- Total value: ${solarData.formattedValue}`);
});

// Export server for testing
module.exports = server;