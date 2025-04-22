/**
 * The Current-See Main Application Server with Database Integration
 * This file handles both the health checks and serves the static website
 * with database storage for members
 */

// CommonJS imports
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const schedule = require('node-schedule');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'admin-token-2025';

// Solar Constants
const SOLAR_CONSTANTS = {
  TOTAL_SOLAR_KWH_PER_DAY: 4.176e+15,
  MONETIZED_PERCENTAGE: 0.01,
  GLOBAL_POPULATION: 8.5e+9,
  TEST_GROUP_POPULATION: 1000,
  USD_PER_SOLAR: 136000,
  monetizedKwh: 0,
  solarPerPersonKwh: 0,
  mkwhPerDay: 0,
  KWH_PER_SECOND: 0,
  DAILY_SOLAR_DISTRIBUTION: 1,
  DAILY_KWH_DISTRIBUTION: 0,
  DAILY_USD_DISTRIBUTION: 0
};

// Initialize solar constants
function initSolarConstants() {
  SOLAR_CONSTANTS.monetizedKwh = SOLAR_CONSTANTS.TOTAL_SOLAR_KWH_PER_DAY * SOLAR_CONSTANTS.MONETIZED_PERCENTAGE;
  SOLAR_CONSTANTS.solarPerPersonKwh = SOLAR_CONSTANTS.monetizedKwh / SOLAR_CONSTANTS.GLOBAL_POPULATION;
  SOLAR_CONSTANTS.mkwhPerDay = SOLAR_CONSTANTS.monetizedKwh / 1e6;
  SOLAR_CONSTANTS.KWH_PER_SECOND = SOLAR_CONSTANTS.mkwhPerDay * 1e6 / (24 * 60 * 60);
  SOLAR_CONSTANTS.DAILY_KWH_DISTRIBUTION = SOLAR_CONSTANTS.solarPerPersonKwh;
  SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION = SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * SOLAR_CONSTANTS.USD_PER_SOLAR;
}

// Initialize solar constants
initSolarConstants();

// Solar clock base date
const SOLAR_CLOCK_BASE_DATE = new Date('2025-04-07T00:00:00Z');

// Solar clock data
const solarClockData = {
  timestamp: new Date().toISOString(),
  elapsedSeconds: (Date.now() - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000,
  totalKwh: 0,
  totalDollars: 0,
  kwhPerSecond: SOLAR_CONSTANTS.KWH_PER_SECOND,
  dollarPerKwh: SOLAR_CONSTANTS.USD_PER_SOLAR / (SOLAR_CONSTANTS.solarPerPersonKwh * 365),
  dailyKwh: SOLAR_CONSTANTS.monetizedKwh,
  dailyDollars: SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION * SOLAR_CONSTANTS.GLOBAL_POPULATION
};

// Update solar clock data
function updateSolarClockData() {
  const now = Date.now();
  solarClockData.timestamp = new Date().toISOString();
  solarClockData.elapsedSeconds = (now - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000;
  solarClockData.totalKwh = solarClockData.elapsedSeconds * SOLAR_CONSTANTS.KWH_PER_SECOND;
  solarClockData.totalDollars = solarClockData.totalKwh * solarClockData.dollarPerKwh;
}

// Initial update
updateSolarClockData();

// Import the database storage
let storage;
try {
  console.log('Loading database storage module...');
  
  // Try to import our database modules
  if (fs.existsSync('./storage.js')) {
    const { storage: dbStorage } = require('./storage.js');
    storage = dbStorage;
    console.log('Successfully loaded database storage module');
  } else {
    throw new Error('Database storage module not found');
  }
} catch (err) {
  console.error('Error loading database storage:', err);
  // If database module fails, fall back to in-memory storage
  console.log('Falling back to in-memory storage...');
  storage = null;
}

// Initialize Express app
const app = express();

// Import page includes system
const { createIncludesMiddleware } = require('./page-includes');
console.log('Page includes middleware loaded');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(createIncludesMiddleware()); // Add page includes middleware

// Function to get all members from database or in-memory
async function getAllMembers() {
  if (storage) {
    try {
      return await storage.getMembers();
    } catch (err) {
      console.error('Error fetching members from database:', err);
      return []; // Return empty array on error
    }
  } else {
    // In-memory fallback
    try {
      const membersFilePath = path.join(__dirname, 'public/api/members.json');
      if (fs.existsSync(membersFilePath)) {
        const data = fs.readFileSync(membersFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading members from file:', err);
    }
    return [];
  }
}

// Function to update member distributions
async function updateMemberDistributions() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Running daily SOLAR distribution update for ${today}`);
  
  let distributedCount = 0;
  
  try {
    // Get all members from database
    const members = await getAllMembers();
    
    for (const member of members) {
      if (member.isPlaceholder) {
        continue;
      }
      
      const totalSolar = parseFloat(member.totalSolar) + SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION;
      const totalDollars = totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
      
      if (storage) {
        // Update in database
        await storage.updateMember(member.id, {
          totalSolar: totalSolar.toString(),
          totalDollars: totalDollars.toString(),
          lastDistributionDate: today
        });
        
        // Log the distribution
        await storage.createDistributionLog({
          memberId: member.id,
          distributionDate: today,
          solarAmount: SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION.toString(),
          dollarValue: (SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * SOLAR_CONSTANTS.USD_PER_SOLAR).toString()
        });
      } else {
        // In-memory fallback - we'll need to save to file later
        member.totalSolar = totalSolar;
        member.totalDollars = totalDollars;
        member.lastDistributionDate = today;
      }
      
      distributedCount++;
      console.log(`Distributed ${SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION} SOLAR to member #${member.id} (${member.name})`);
    }
    
    // If no database, save to files
    if (!storage && members.length > 0) {
      const membersFilePath = path.join(__dirname, 'public/api/members.json');
      fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2));
      
      // Update embedded-members file
      const formattedMembers = members.map(member => ({
        ...member,
        totalSolar: typeof member.totalSolar === 'number' ? 
          member.totalSolar.toFixed(4) : 
          parseFloat(member.totalSolar).toFixed(4)
      }));
      
      fs.writeFileSync(
        path.join(__dirname, 'public/embedded-members'),
        `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`
      );
    }
    
    console.log(`Daily distribution completed: ${distributedCount} members updated`);
    return distributedCount;
  } catch (err) {
    console.error('Error updating member distributions:', err);
    return 0;
  }
}

// Function to add a "You are next" placeholder to the members list
function addYouAreNextPlaceholder(membersList) {
  // Create a copy of the members list
  const membersWithPlaceholder = [...membersList];
  
  // Create the "You are next" placeholder
  const today = new Date().toISOString().split('T')[0];
  const placeholder = {
    id: "next",
    username: "you.are.next",
    name: "You are next",
    email: "",
    joinedDate: today,
    totalSolar: 1,
    totalDollars: 136000,
    isAnonymous: false,
    isPlaceholder: true,
    lastDistributionDate: today
  };
  
  // Add the placeholder to the end of the list
  membersWithPlaceholder.push(placeholder);
  
  return membersWithPlaceholder;
}

// Health check routes (high priority)
app.get(['/health', '/healthz', '/_health'], (req, res) => {
  console.log(`[HEALTH] ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  
  // Enhanced health check response with server status
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbStatus: storage ? 'connected' : 'fallback',
    solarTracking: {
      startDate: '2025-04-07',
      currentTotal: solarClockData.totalKwh / 1000000
    }
  };
  
  res.status(200).json(status);
});

// Static file serving - key feature to serve all files in the public directory
app.use(express.static('public'));

// API Endpoints
app.get('/api/solar-clock', (req, res) => {
  updateSolarClockData();
  res.json(solarClockData);
});

app.get('/api/members', async (req, res) => {
  // First update the members with the latest SOLAR distributions
  await updateMemberDistributions();
  
  // Get members from database
  const members = await getAllMembers();
  
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

app.get('/api/solar-accounts/leaderboard', async (req, res) => {
  // First update the members with the latest SOLAR distributions
  await updateMemberDistributions();
  
  // Get members from database
  const members = await getAllMembers();
  
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

app.get('/api/members.json', async (req, res) => {
  // First update the members with the latest SOLAR distributions
  await updateMemberDistributions();
  
  // Get members from database
  const members = await getAllMembers();
  
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

// Serve the embedded members data with proper content type
app.get('/embedded-members', async (req, res) => {
  await updateMemberDistributions();
  
  // Get members from database
  const members = await getAllMembers();
  
  // Format members with 4 decimal places for SOLAR values
  const formattedMembers = members.map(member => {
    const formattedMember = {...member};
    if (typeof formattedMember.totalSolar !== 'undefined') {
      formattedMember.totalSolar = parseFloat(formattedMember.totalSolar).toFixed(4);
    }
    return formattedMember;
  });
  
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(formattedMembers);
  
  // Set the proper JavaScript content type
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.embeddedMembers = ${JSON.stringify(membersWithPlaceholder)};`);
});

// Admin routes for managing members
app.put('/api/admin/members/:id/email', async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers['x-admin-token'] || req.query.token;
    if (token !== ADMIN_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized - Invalid admin token' });
    }
    
    const memberId = parseInt(req.params.id);
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (storage) {
      // Use database
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Skip if it's the reserve account or placeholder
      if (member.isReserve || member.isPlaceholder) {
        return res.status(403).json({ error: 'Cannot modify this special account' });
      }
      
      // Store old email for logging
      const oldEmail = member.email;
      
      // Update email
      const updatedMember = await storage.updateMember(memberId, { email });
      
      console.log(`Admin updated member #${memberId} (${member.name}) email from ${oldEmail} to ${email}`);
      
      return res.status(200).json({ 
        success: true,
        message: 'Member information updated successfully',
        member: updatedMember
      });
    } else {
      return res.status(500).json({ error: 'Database storage not available' });
    }
  } catch (err) {
    console.error('Error updating member email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route for member signup/registration
app.post('/api/signup', async (req, res) => {
  try {
    console.log('[SIGNUP] Received signup request:', req.body);
    const userData = req.body;
    
    // Validate required fields with more detailed error messages
    if (!userData.name) {
      console.log('[SIGNUP] Validation failed: Missing name');
      return res.status(400).json({ 
        success: false, 
        error: 'Name is required' 
      });
    }
    
    if (!userData.email) {
      console.log('[SIGNUP] Validation failed: Missing email');
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      console.log('[SIGNUP] Validation failed: Invalid email format');
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid email address' 
      });
    }
    
    if (storage) {
      // Check for duplicate email in the database
      const existingMember = await storage.getMemberByEmail(userData.email);
      
      if (existingMember) {
        console.log('[SIGNUP] Validation failed: Email already exists');
        return res.status(409).json({ 
          success: false, 
          error: 'A member with this email already exists' 
        });
      }
      
      // Calculate username from email
      const username = userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.');
      
      // Calculate new member data
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();
      
      // Create member in database
      const newMember = await storage.createMember({
        username: username,
        name: userData.name.trim(),
        email: userData.email.trim(),
        joinedDate: today,
        totalSolar: '1.0000',
        totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR.toString(),
        isAnonymous: userData.isAnonymous || false,
        lastDistributionDate: today,
        signupTimestamp: new Date(timestamp)
      });
      
      console.log(`[SIGNUP] Created new member #${newMember.id} with name: ${newMember.name}, email: ${newMember.email}`);
      
      // Return success response
      res.status(201).json({ 
        success: true, 
        member: newMember
      });
    } else {
      // Fallback to file-based approach if database is not available
      // Get existing members from file
      const membersFilePath = path.join(__dirname, 'public/api/members.json');
      let members = [];
      
      try {
        if (fs.existsSync(membersFilePath)) {
          const data = fs.readFileSync(membersFilePath, 'utf8');
          members = JSON.parse(data);
        }
      } catch (err) {
        console.error('Error reading members file:', err);
      }
      
      // Check for duplicate email
      const existingMember = members.find(m => 
        m.email && m.email.toLowerCase() === userData.email.toLowerCase() && 
        !m.isPlaceholder
      );
      
      if (existingMember) {
        console.log('[SIGNUP] Validation failed: Email already exists');
        return res.status(409).json({ 
          success: false, 
          error: 'A member with this email already exists' 
        });
      }
      
      // Calculate new member data
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();
      const nextId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
      
      const newMember = {
        id: nextId,
        username: userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
        name: userData.name.trim(),
        email: userData.email.trim(),
        joinedDate: today,
        signupTimestamp: timestamp,
        totalSolar: 1.0000,
        totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
        isAnonymous: userData.isAnonymous || false,
        lastDistributionDate: today
      };
      
      // Add to members array
      members.push(newMember);
      
      // Save to file
      fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2));
      
      // Update embedded-members file
      const formattedMembers = members.map(member => ({
        ...member,
        totalSolar: typeof member.totalSolar === 'number' ? 
          member.totalSolar.toFixed(4) : 
          parseFloat(member.totalSolar).toFixed(4)
      }));
      
      fs.writeFileSync(
        path.join(__dirname, 'public/embedded-members'),
        `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`
      );
      
      console.log(`[SIGNUP] Created new member #${nextId} with name: ${newMember.name}, email: ${newMember.email}`);
      
      // Return success response
      res.status(201).json({ 
        success: true, 
        member: newMember
      });
    }
  } catch (e) {
    console.error('[SIGNUP] Critical error processing signup:', e);
    
    // Attempt to log detailed error info for debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: e.message,
        stack: e.stack,
        request: {
          body: req.body,
          headers: req.headers
        }
      };
      
      // Log to a dedicated error file
      fs.appendFileSync('signup-errors.log', JSON.stringify(errorLog) + '\n');
    } catch (logErr) {
      console.error('[SIGNUP] Failed to log error details:', logErr);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error - your signup has been logged and will be processed' 
    });
  }
});

// Database status endpoint
app.get('/api/database/status', async (req, res) => {
  if (storage) {
    try {
      const dbStatus = await require('./server/db').testConnection();
      res.json({
        status: dbStatus.success ? 'connected' : 'error',
        message: dbStatus.message
      });
    } catch (err) {
      res.json({
        status: 'error',
        message: 'Error checking database status: ' + err.message
      });
    }
  } else {
    res.json({
      status: 'fallback',
      message: 'Database storage not available, using file-based storage'
    });
  }
});

// Function to start the scheduled tasks
function setupScheduledTasks() {
  // Schedule distribution for midnight GMT (5pm Pacific Time)
  const distributionJob = schedule.scheduleJob('0 0 * * *', async () => {
    console.log('Running scheduled SOLAR distribution...');
    const distributedCount = await updateMemberDistributions();
    console.log(`Scheduled distribution completed: ${distributedCount} members updated`);
  });
  
  // Every hour, update the solar clock values
  const solarClockJob = schedule.scheduleJob('0 * * * *', () => {
    console.log('Updating solar clock values...');
    updateSolarClockData();
    console.log(`Solar clock updated: ${(solarClockData.totalKwh / 1000000).toFixed(6)} MkWh generated`);
  });
  
  console.log('Scheduled tasks set up successfully');
}

// Start the server
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  setupScheduledTasks();
  console.log('Current Unix timestamp:', Math.floor(Date.now() / 1000));
});

// Run initial distribution update
updateMemberDistributions().then(count => {
  console.log(`Initial distribution update affected ${count} members`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});