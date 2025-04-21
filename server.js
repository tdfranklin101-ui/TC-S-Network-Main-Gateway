/**
 * The Current-See Main Application Server (CommonJS Version)
 * This file handles both the health checks and serves the static website
 */

// CommonJS imports
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const schedule = require('node-schedule');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
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

// Member data
const members = [
  {
    id: 0,
    username: 'solar.reserve',
    name: 'Solar Reserve',
    email: 'admin@thecurrentsee.org',
    joinedDate: '2025-04-07',
    totalSolar: 10000000000,
    totalDollars: 1360000000000,
    isAnonymous: false,
    isReserve: true,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 1,
    username: 'terry.franklin',
    name: 'Terry D. Franklin',
    email: 'tdfranklin101@outlook.com',
    joinedDate: '2025-04-09',
    totalSolar: 11,
    totalDollars: 1496000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 2,
    username: 'j.franklin',
    name: 'JF',
    email: 'aunsun27@icloud.com',
    joinedDate: '2025-04-10',
    totalSolar: 10,
    totalDollars: 1360000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 3,
    username: 'davis',
    name: 'Davis',
    email: 'davis@example.com',
    joinedDate: '2025-04-18',
    totalSolar: 3,
    totalDollars: 408000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 4,
    username: 'miles.franklin',
    name: 'Miles Franklin',
    email: 'miles@example.com',
    joinedDate: '2025-04-18',
    totalSolar: 3,
    totalDollars: 408000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 5,
    username: 'arden.f',
    name: 'Arden F',
    email: 'arden@example.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 6,
    username: 'marissa.hasseman',
    name: 'Marissa Hasseman',
    email: 'marissa@example.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 7,
    username: 'kim',
    name: 'Kim',
    email: 'KIMBROWN9999@hotmail.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 8,
    username: 'jeff.elmore',
    name: 'Jeff Elmore',
    email: 'jeff@example.com',
    joinedDate: '2025-04-20',
    totalSolar: 1,
    totalDollars: 136000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 9,
    username: 'liam.mckay',
    name: 'Liam McKay',
    email: 'liam@example.com',
    joinedDate: '2025-04-20',
    totalSolar: 1,
    totalDollars: 136000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  }
];

// Function to create a backup of member data
function backupMembersData() {
  try {
    // Ensure the backup directory exists
    if (!fs.existsSync('backup')) {
      fs.mkdirSync('backup', { recursive: true });
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1); // YYYY-MM-DD_HH-MM-SS format
    
    // Create daily backup file
    const backupFilename = `backup/members_backup_${dateStr}.json`;
    fs.writeFileSync(
      backupFilename,
      JSON.stringify(members, null, 2)
    );
    
    // Create a timestamped backup to preserve multiple states
    const timestampedBackupFilename = `backup/members_backup_${timeStr}.json`;
    fs.writeFileSync(
      timestampedBackupFilename,
      JSON.stringify(members, null, 2)
    );
    
    console.log(`Created member data backup: ${backupFilename}`);
    return true;
  } catch (error) {
    console.error('Error creating member data backup:', error);
    console.log('ERROR: Failed to backup member data: ' + error.message);
    return false;
  }
}

// Function to update the static files that store member data
function updateMembersFiles() {
  try {
    // Ensure the directories exist
    if (!fs.existsSync('public/api')) {
      fs.mkdirSync('public/api', { recursive: true });
    }
    
    // Format the members data with 4 decimal places for SOLAR values
    const formattedMembers = members.map(member => {
      // Create a copy of the member
      const formattedMember = {...member};
      
      // Format totalSolar to 4 decimal places if it's a number
      if (typeof formattedMember.totalSolar !== 'undefined') {
        formattedMember.totalSolar = parseFloat(formattedMember.totalSolar).toFixed(4);
      }
      
      return formattedMember;
    });
    
    // Update the public API file
    fs.writeFileSync(
      'public/api/members.json',
      JSON.stringify(members, null, 2)
    );
    
    // Update the embedded members file with the correct JavaScript prefix
    fs.writeFileSync(
      'public/embedded-members',
      `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`
    );
    
    // Create a backup after each update
    backupMembersData();
    
    console.log('Updated static member files with new SOLAR totals');
    return true;
  } catch (error) {
    console.error('Error updating member files:', error);
    console.log('ERROR: Failed to update static member files: ' + error.message);
    return false;
  }
}

// Function to update member SOLAR distributions
function updateMemberDistributions() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Running daily SOLAR distribution update for ${today}`);
  
  let distributedCount = 0;
  
  members.forEach(member => {
    // Always distribute SOLAR when this function is called (during the scheduled time)
    // This ensures all members get their SOLAR at the designated time
    member.totalSolar += SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION;
    member.totalDollars = member.totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
    member.lastDistributionDate = today;
    distributedCount++;
    
    console.log(`Distributed ${SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION} SOLAR to member #${member.id} (${member.name})`);
  });
  
  // Update the HTML values directly for the client-side rendering
  // Update Terry's value (member #1)
  const terryIdx = members.findIndex(m => m.id === 1);
  if (terryIdx >= 0) {
    const terrySOLAR = members[terryIdx].totalSolar.toFixed(2);
    console.log(`Updating Terry's SOLAR value to ${terrySOLAR}`);
  }
  
  // Update JF's value (member #2)
  const jfIdx = members.findIndex(m => m.id === 2);
  if (jfIdx >= 0) {
    const jfSOLAR = members[jfIdx].totalSolar.toFixed(2);
    console.log(`Updating JF's SOLAR value to ${jfSOLAR}`);
  }
  
  // Ensure we always update the static files after modifying member data
  updateMembersFiles();
  
  console.log(`Daily distribution completed: ${distributedCount} members updated`);
  return distributedCount;
}

// Run distribution update immediately and then on a schedule
updateMemberDistributions();

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

// Database connection (if available)
let pool = null;
try {
  if (DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('Database connection initialized');
  } else {
    console.log('No DATABASE_URL provided, running in memory mode');
  }
} catch (err) {
  console.error('Database connection error:', err);
}

// Health check routes (high priority)
app.get(['/health', '/healthz', '/_health'], (req, res) => {
  console.log(`[HEALTH] ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  
  // Enhanced health check response with server status
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memberCount: members.length,
    lastDistribution: members.length > 0 ? members[0].lastDistributionDate : null,
    solarTracking: {
      startDate: '2025-04-07',
      currentTotal: solarClockData.totalKwh / 1000000
    }
  };
  
  res.status(200).json(status);
});

// Special test route for language translator
app.get('/test-language-translator', (req, res) => {
  console.log('Serving language translator test page');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Language Translation Test</title>
  
  <style>
    .test-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 2rem;
      background-color: #f9f9f9;
      border-radius: 10px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.1);
    }
    
    .test-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    
    code {
      display: block;
      padding: 1rem;
      background-color: #f5f5f5;
      border-radius: 4px;
      margin: 1rem 0;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="test-container">
    <h1>Language Translation Test Page</h1>
    
    <p>This page is used to verify that the language translation component is working correctly across the website.</p>
    
    <div class="test-section">
      <h2>Sample Text in Multiple Languages</h2>
      
      <p>The following text should be translated when you select a different language:</p>
      
      <ul>
        <li>Welcome to The Current-See website.</li>
        <li>We are building a solar-backed global economic system.</li>
        <li>Join us in creating a more equitable financial future.</li>
        <li>Every day, solar energy creates new value.</li>
        <li>This value can be distributed to everyone on Earth.</li>
      </ul>
    </div>
    
    <div class="test-section">
      <h2>Testing Rich Content</h2>
      
      <p>Complex content with formatting should also translate correctly:</p>
      
      <h3>Our Mission</h3>
      <p>The Current-See aims to <strong>revolutionize global economics</strong> by creating a <em>solar-backed currency system</em> that distributes daily value to all participants.</p>
      
      <h3>How It Works</h3>
      <ol>
        <li>Solar panels generate electricity across the globe</li>
        <li>This electricity has a monetary value</li>
        <li>We track this value in real-time</li>
        <li>Every participant receives a daily distribution</li>
      </ol>
    </div>
    
    <a href="/" class="btn btn-primary">Return to Home Page</a>
  </div>
  
  <!-- No need to include the translator script manually as it should be added by the middleware -->
</body>
</html>`;
  
  res.send(html);
});

// Static file serving - key feature to serve all files in the public directory
app.use(express.static('public'));

// API Endpoints
app.get('/api/solar-clock', (req, res) => {
  updateSolarClockData();
  res.json(solarClockData);
});

app.get('/api/members', (req, res) => {
  // First update the members with the latest SOLAR distributions
  updateMemberDistributions();
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

app.get('/api/solar-accounts/leaderboard', (req, res) => {
  // First update the members with the latest SOLAR distributions
  updateMemberDistributions();
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

app.get('/api/members.json', (req, res) => {
  // First update the members with the latest SOLAR distributions
  updateMemberDistributions();
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  res.json(membersWithPlaceholder);
});

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

// Serve the embedded members data with proper content type
app.get('/embedded-members', (req, res) => {
  updateMemberDistributions();
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

app.get('/api/members-data', (req, res) => {
  // Alternative endpoint for JSONP callback support
  updateMemberDistributions();
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  const callback = req.query.callback;
  if (callback) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(membersWithPlaceholder)})`);
  } else {
    res.json(membersWithPlaceholder);
  }
});

app.get('/api/members.js', (req, res) => {
  // JSONP endpoint for cross-domain support
  updateMemberDistributions();
  // Add the "You are next" placeholder
  const membersWithPlaceholder = addYouAreNextPlaceholder(members);
  const callback = req.query.callback || 'updateMembers';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${callback}(${JSON.stringify(membersWithPlaceholder)})`);
});

app.get('/api/member-count', (req, res) => {
  res.json({ count: members.length });
});

// Load product-energy-service
let productService;
try {
  productService = require('./server/product-energy-service').default;
  console.log('Product energy service loaded successfully');
} catch (err) {
  console.error('Error loading product energy service:', err);
  productService = {
    getProductData: () => null,
    recommendAlternative: () => [],
    analyzeProduct: async () => ({ error: 'Product service unavailable' })
  };
}

// Load geolocation-service
let geolocationService;
try {
  geolocationService = require('./server/geolocation-service');
  console.log('Geolocation service loaded successfully');
  // Start the Python service
  geolocationService.startPythonService();
} catch (err) {
  console.error('Error loading geolocation service:', err);
  geolocationService = {
    getLocation: async (ip) => ({ 
      ip, 
      city: 'Unknown', 
      country: 'Unknown',
      source: 'fallback',
      reason: 'Service unavailable'
    })
  };
}

// Product energy data endpoints
app.get('/api/product/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({
        error: 'Missing productId parameter',
        message: 'Product ID is required'
      });
    }
    
    const productData = productService.getProductData(productId);
    
    if (!productData) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No energy data found for product: ${productId}`
      });
    }
    
    // Return the product energy data
    res.json(productData);
  } catch (error) {
    console.error('Error getting product data:', error);
    res.status(500).json({
      error: 'Failed to retrieve product data',
      message: error.message
    });
  }
});

// Analyze a product using AI if available
app.post('/api/analyze-product', async (req, res) => {
  try {
    const { productName, productDescription } = req.body;
    
    if (!productName) {
      return res.status(400).json({
        error: 'Missing product name',
        message: 'Product name is required'
      });
    }
    
    // Use the product service to analyze the product
    const productData = await productService.analyzeProduct(productName, productDescription || '');
    
    // Return the product energy data with recommendations
    const recommendations = productService.recommendAlternative(productName);
    
    res.json({
      ...productData,
      recommendations
    });
  } catch (error) {
    console.error('Error analyzing product:', error);
    res.status(500).json({
      error: 'Failed to analyze product',
      message: error.message
    });
  }
});

// Get product recommendations
app.get('/api/recommendations/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({
        error: 'Missing productId parameter',
        message: 'Product ID is required'
      });
    }
    
    const recommendations = productService.recommendAlternative(productId);
    
    res.json({
      productId,
      recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

// Get geolocation data
app.get('/api/geolocation', async (req, res) => {
  try {
    // Get the client IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Use the geolocation service to get location data
    const locationData = await geolocationService.getLocation(clientIp);
    
    res.json(locationData);
  } catch (error) {
    console.error('Error getting geolocation data:', error);
    res.status(500).json({
      error: 'Failed to get geolocation data',
      message: error.message
    });
  }
});

// Admin Routes with token authentication
const adminAuthMiddleware = (req, res, next) => {
  console.log('Admin auth middleware called');
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log('Auth header missing');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Missing Authorization header'
    });
  }
  
  // Simple token comparison - format should be "Bearer TOKEN"
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
  
  console.log(`Token received: "${token}"`);
  console.log(`Expected token: "${ADMIN_API_TOKEN}"`);
  
  // Check if the token matches the environment variable or the fallback
  if (token !== ADMIN_API_TOKEN) {
    console.log('Token mismatch');
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid API token'
    });
  }
  
  console.log('Admin authentication successful');
  // Token is valid, proceed to the route handler
  next();
};

// Helper function to verify admin token (standalone)
function verifyAdminToken(token) {
  if (!token) return false;
  
  // Remove Bearer prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
  
  return cleanToken === ADMIN_API_TOKEN;
}

// Verify admin token endpoint
app.post('/api/admin/verify-token', adminAuthMiddleware, (req, res) => {
  // If the middleware passed, the token is valid
  res.status(200).json({ 
    valid: true,
    message: 'Token is valid'
  });
});

// Alternative admin token verification with query parameter
app.get('/api/admin/validate', (req, res) => {
  const token = req.query.token;
  
  if (verifyAdminToken(token)) {
    res.status(200).json({ valid: true, message: 'Token is valid' });
  } else {
    res.status(403).json({ valid: false, message: 'Invalid token' });
  }
});

// Admin route to view system logs
app.get('/api/admin/logs', adminAuthMiddleware, (req, res) => {
  try {
    // In a real application, you would retrieve logs from a database
    // For this prototype, we'll return the members and some system info
    const logs = {
      members,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(logs);
  } catch (error) {
    console.error('Error getting admin logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// API endpoint to update member information
app.put('/api/admin/members/:memberId', adminAuthMiddleware, (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId, 10);
    const { email } = req.body;
    
    // Validate input
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Find member by ID
    const memberIndex = members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Skip if it's the reserve account or placeholder
    if (members[memberIndex].isReserve || members[memberIndex].name === 'You are next') {
      return res.status(403).json({ error: 'Cannot modify this special account' });
    }

    // Store old email for logging
    const oldEmail = members[memberIndex].email;
    
    // Update email
    members[memberIndex].email = email;
    
    // Update member files (both members.json and embedded-members)
    fs.writeFileSync(path.join(PUBLIC_DIR, 'api', 'members.json'), JSON.stringify(members, null, 2));
    
    // Update embedded-members file with formatted SOLAR values
    const formattedMembers = members.map(m => ({
      ...m,
      totalSolar: typeof m.totalSolar === 'number' ? m.totalSolar.toFixed(4) : m.totalSolar
    }));
    
    fs.writeFileSync(
      path.join(PUBLIC_DIR, 'embedded-members'),
      `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`
    );
    
    // Create a backup
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      path.join(backupDir, `members_backup_${timestamp}.json`), 
      JSON.stringify(members, null, 2)
    );
    
    console.log(`Admin updated member #${memberId} (${members[memberIndex].name}) email from ${oldEmail} to ${email}`);
    
    return res.status(200).json({ 
      success: true,
      message: 'Member information updated successfully',
      member: members[memberIndex]
    });
    
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member information' });
  }
});

// Admin route for system diagnostics
app.get('/api/admin/diagnostics', adminAuthMiddleware, async (req, res) => {
  try {
    // Database connection check
    let dbStatus = 'not_connected';
    if (pool) {
      try {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        dbStatus = 'error';
      }
    }
    
    res.json({
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV,
        nodeVersion: process.version
      },
      database: {
        status: dbStatus,
        timestamp: new Date().toISOString()
      },
      services: {
        productService: productService ? 'loaded' : 'not_loaded',
        geolocationService: geolocationService ? 'loaded' : 'not_loaded',
        pythonServiceRunning: geolocationService && geolocationService.pythonServiceRunning
      }
    });
  } catch (error) {
    console.error('Error getting system diagnostics:', error);
    res.status(500).json({ error: 'Failed to retrieve diagnostics' });
  }
});

// Admin route for viewing product database
app.get('/api/admin/products', adminAuthMiddleware, (req, res) => {
  try {
    const products = productService.getAllProducts ? productService.getAllProducts() : [];
    
    res.json({
      products,
      count: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting product database:', error);
    res.status(500).json({ error: 'Failed to retrieve product database' });
  }
});

// Load badge-service
let badgeService;
try {
  badgeService = require('./server/badge-service');
  console.log('Badge service loaded successfully');
  // Start the Python badge service
  badgeService.startBadgeService();
} catch (err) {
  console.error('Error loading badge service:', err);
  badgeService = null;
}

// Badge generation endpoint
app.get('/badge', async (req, res) => {
  try {
    if (!badgeService) {
      return res.status(503).json({
        error: 'Badge service unavailable',
        message: 'The badge generation service is currently unavailable'
      });
    }
    
    // Get parameters from query string
    const options = {
      name: req.query.name || 'Solar Hero',
      kwh: req.query.kwh || '0.0',
      type: req.query.type || 'offset',
      theme: req.query.theme || 'default',
      format: req.query.format || 'png'
    };
    
    // Generate the badge
    const badge = await badgeService.generateBadge(options);
    
    if (options.format === 'base64') {
      // Return JSON with base64 data
      res.json(badge);
    } else {
      // Return the PNG image
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `inline; filename="solar_badge_${options.name}.png"`);
      res.send(badge);
    }
  } catch (error) {
    console.error('Error generating badge:', error);
    res.status(500).json({
      error: 'Badge generation failed',
      message: error.message
    });
  }
});

// Solar achievement endpoint (for tracking and generating badges)
app.post('/api/achievement', (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to record achievements'
      });
    }
    
    const { type, value, description } = req.body;
    
    if (!type || !value) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Type and value are required'
      });
    }
    
    // For this prototype, we'll just return success
    // In a real application, this would save to the database
    
    // Generate achievement URL for sharing
    const username = req.user.username;
    const shareUrl = `/badge?name=${encodeURIComponent(username)}&kwh=${encodeURIComponent(value)}&type=${encodeURIComponent(type)}`;
    
    res.status(201).json({
      success: true,
      achievement: {
        type,
        value,
        description: description || `${type} achievement`,
        timestamp: new Date().toISOString(),
        shareUrl
      }
    });
    
  } catch (error) {
    console.error('Error recording achievement:', error);
    res.status(500).json({
      error: 'Failed to record achievement',
      message: error.message
    });
  }
});

// Voice Assistant API Endpoint
app.post('/api/voice-assistant', async (req, res) => {
  try {
    const { query, language = 'en', history = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Missing query',
        message: 'A query is required'
      });
    }
    
    console.log(`Voice assistant query (${language}): ${query}`);
    
    // Get client location
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let locationInfo = '';
    
    try {
      if (geolocationService) {
        const location = await geolocationService.getLocation(clientIp);
        if (location && location.city && location.country) {
          locationInfo = `User location: ${location.city}, ${location.country}.`;
        }
      }
    } catch (err) {
      console.error('Error getting geolocation for voice assistant:', err);
    }
    
    // In a real implementation with API keys, we would call OpenAI or Anthropic here
    // For this prototype, we'll use a simple local knowledge base
    
    // Check for energy conservation queries
    let response;
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('energy conservation') || 
        queryLower.includes('save energy') || 
        queryLower.includes('energy tips')) {
      response = `Here are some energy conservation tips:
      
1. Turning off lights when not in use can save up to 10% on your energy bills
2. Energy-efficient appliances can reduce your energy consumption by 30-50%
3. Smart thermostats can reduce heating and cooling costs by 10-15%
4. Unplug electronics when not in use to eliminate "phantom" energy usage
5. Using cold water for laundry can save up to 90% of the energy used per load`;

    } else if (queryLower.includes('solar benefit') || 
               queryLower.includes('why solar') || 
               queryLower.includes('solar energy')) {
      response = `Here are some benefits of solar energy:
      
1. Solar energy is renewable, abundant, and produces no harmful emissions
2. The sun delivers more energy to Earth in one hour than humanity uses in a year
3. Solar panel efficiency has improved dramatically while costs have decreased by 70% since 2010
4. Solar investments typically pay for themselves in 6-10 years and provide decades of clean energy
5. Solar energy creates jobs and economic opportunities in the green economy`;
               
    } else if (queryLower.includes('current-see') || 
               queryLower.includes('how does it work') || 
               queryLower.includes('solar token') ||
               queryLower.includes('system')) {
      response = `The Current-See is a revolutionary solar-backed global economic system:

1. It tracks solar energy production in real-time through the Solar Generator
2. Each user receives a daily SOLAR token allocation representing real energy value
3. SOLAR tokens are backed by the actual kilowatt-hours of energy produced globally
4. The system creates a more equitable distribution of energy value worldwide
5. Anyone can join and receive their share of the global solar energy economy`;
      
    } else if (queryLower.includes('my balance') || 
               queryLower.includes('my solar') || 
               queryLower.includes('my token')) {
      if (req.isAuthenticated()) {
        const user = req.user;
        response = `Your current SOLAR balance is ${user.totalSolar} SOLAR tokens. This represents your share of the global solar energy economy. You receive a daily distribution of 1 SOLAR token, which is backed by real solar energy production.`;
      } else {
        response = "To view your SOLAR balance, you need to log in to your Current-See wallet. You can access it by clicking on the 'Wallet Demo' button in the navigation menu. Once logged in, your balance will be displayed on your dashboard.";
      }
      
    } else if (queryLower.includes('solar counter') || 
               queryLower.includes('generator') || 
               queryLower.includes('solar clock')) {
      updateSolarClockData();
      const energyValue = (solarClockData.totalKwh / 1000000).toFixed(6);
      const moneyValue = Math.floor(solarClockData.totalDollars).toLocaleString();
      
      response = `The Current-See Solar Generator is currently tracking ${energyValue} MkWh of clean solar energy generated since April 7, 2025. This represents approximately $${moneyValue} in monetary value. The counter updates in real-time and powers the daily SOLAR token distributions to all members.`;
      
    } else if (queryLower.includes('join') || 
               queryLower.includes('sign up') || 
               queryLower.includes('register') ||
               queryLower.includes('become a member')) {
      response = `To join The Current-See, click on the "Sign Up" button in the navigation menu. Registration is free and takes just a minute. Once registered, you'll start receiving daily SOLAR token distributions and can track your balance in the wallet. ${locationInfo ? locationInfo + ' ' : ''}Welcome to the global solar economy!`;
      
    } else if (queryLower.includes('track energy') || 
               queryLower.includes('monitor usage') || 
               queryLower.includes('consumption')) {
      response = `The Current-See offers several ways to track energy:

1. The Solar Generator displays global solar production in real-time
2. Your personal wallet shows your SOLAR token balance and transaction history
3. Our product scanner lets you evaluate the energy impact of everyday items
4. Energy badges allow you to share your conservation achievements
5. The energy calculation tool helps you understand your personal impact

Would you like me to explain any of these features in more detail?`;
      
    } else if (queryLower.includes('buckminster fuller') || 
               queryLower.includes('bucky fuller') || 
               queryLower.includes('dymaxion') || 
               queryLower.includes('geodesic')) {
      
      response = `R. Buckminster Fuller (1895-1983) was a visionary systems theorist, architect, engineer, and inventor whose work deeply influences The Current-See philosophy.

Key Contributions:
• Fuller pioneered the concept of "ephemeralization" — doing more with less — which is central to our energy efficiency focus
• His "Operating Manual for Spaceship Earth" (1969) established the metaphor of Earth as a finite vessel with limited resources
• The geodesic dome exemplified his principle of achieving maximum structural strength with minimal material usage
• His Dymaxion™ concepts (houses, cars, maps) all focused on maximum efficiency with minimal energy inputs

Fuller's vision of "making the world work for 100% of humanity" through resource efficiency directly inspires The Current-See's approach to universal energy access and equitable distribution of solar resources.

His famous quote, "You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete," is essentially what we're accomplishing with The Current-See system.

The SOLAR token economy embodies Fuller's concept of "energy accounting" as the true basis for economic value, rather than artificial monetary systems.`;
    
    } else {
      // General fallback response
      response = `As your Current-See Energy Assistant, I can help you with:

- Information about The Current-See solar-backed economic system
- Energy conservation tips and sustainable practices
- Understanding solar energy benefits and technologies
- Tracking your SOLAR token balance and distributions
- Finding ways to reduce your energy consumption
- Information about visionaries like R. Buckminster Fuller who inspire our work

How else can I assist you with energy-related questions today?`;
    }
    
    // If we have location info, personalize the response
    if (locationInfo && !response.includes(locationInfo)) {
      // Only add location if it's not already mentioned
      response = `${response}\n\n${locationInfo}`;
    }
    
    // Log the response (in a real implementation, we would log to a database)
    console.log(`Voice assistant response: ${response.substring(0, 50)}...`);
    
    // Send the response
    res.json({
      response: response
    });
    
  } catch (error) {
    console.error('Error processing voice assistant query:', error);
    res.status(500).json({
      error: 'Failed to process voice assistant query',
      message: error.message
    });
  }
});

// Wallet AI Assistant API Endpoint - Enhanced with econometric and carbon footprint capabilities
app.post('/api/wallet-assistant', async (req, res) => {
  try {
    const { query, language = 'en', history = [], mode = 'general' } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Missing query',
        message: 'A query is required'
      });
    }
    
    console.log(`Wallet AI assistant query (${language}, ${mode}): ${query}`);
    
    // Get client location for personalized recommendations
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let locationInfo = '';
    
    try {
      if (geolocationService) {
        const location = await geolocationService.getLocation(clientIp);
        if (location && location.city && location.country) {
          locationInfo = `${location.city}, ${location.country}`;
        }
      }
    } catch (err) {
      console.error('Error getting geolocation for wallet assistant:', err);
    }
    
    // In a production implementation, we would use a more sophisticated AI model
    // For now, we'll demonstrate key capabilities with pattern matching
    
    // Determine the query type based on keywords
    const queryLower = query.toLowerCase();
    let response;
    
    if (mode === 'carbon_footprint' || 
        queryLower.includes('carbon') || 
        queryLower.includes('footprint') || 
        queryLower.includes('environmental') ||
        queryLower.includes('sustainable')) {
      
      // Extract product information from query
      const productInfo = extractProductInfo(queryLower);
      
      if (productInfo) {
        response = generateCarbonFootprintResponse(productInfo, locationInfo);
      } else {
        response = `I can analyze the carbon footprint and environmental impact of various products and activities. Please specify what you'd like me to analyze, such as a specific food item, electronic device, or transportation method.`;
      }
      
    } else if (mode === 'farm_to_table' || 
              queryLower.includes('farm') || 
              queryLower.includes('produce') || 
              queryLower.includes('food price') ||
              queryLower.includes('vegetable') ||
              queryLower.includes('fruit')) {
      
      // Extract produce information from query
      const produceInfo = extractProduceInfo(queryLower);
      
      if (produceInfo) {
        response = generateFarmToTableResponse(produceInfo, locationInfo);
      } else {
        response = `I can calculate energy-based pricing for farm-to-table produce, taking into account factors like seasonality, transportation distance, and production methods. Please specify the produce item you're interested in.`;
      }
      
    } else if (mode === 'supply_chain' || 
              queryLower.includes('supply chain') || 
              queryLower.includes('logistics') || 
              queryLower.includes('transportation') ||
              queryLower.includes('shipping')) {
      
      response = `Supply Chain Energy Analysis:

The energy consumption across modern supply chains can be divided into:
• Production energy (30-40%)
• Processing energy (10-20%)
• Transportation energy (15-30%)
• Storage energy (5-15%)
• End-use energy (10-20%)

For most consumer products, transportation represents between 5-15% of the total carbon footprint, while production often accounts for 30-60% depending on the product type.

${locationInfo ? `For products shipped to ${locationInfo}, international shipping typically adds 0.5-2 kWh of energy consumption per kg of product, equivalent to approximately 0.2-0.8 SOLAR tokens per kg in the Current-See system.` : ''}

Would you like me to analyze a specific product's supply chain energy usage?`;
      
    } else {
      // General wallet assistant response
      if (req.isAuthenticated()) {
        const user = req.user;
        response = `Welcome to your Enhanced AI Wallet Assistant, ${user.username}. 

Your current SOLAR balance is ${user.totalSolar} tokens.

I can help you with:
• Calculating the carbon footprint of products and activities
• Providing energy-based pricing for farm-to-table produce
• Analyzing supply chain energy consumption
• Converting traditional costs to SOLAR token value
• Making sustainability-focused purchase recommendations

What would you like assistance with today?`;
      } else {
        response = `Welcome to the Enhanced AI Wallet Assistant. 

I can help you with:
• Calculating the carbon footprint of products and activities
• Providing energy-based pricing for farm-to-table produce
• Analyzing supply chain energy consumption
• Converting traditional costs to SOLAR token value
• Making sustainability-focused purchase recommendations

For personalized recommendations and to access your SOLAR balance, please log in to your wallet.`;
      }
    }
    
    // Log and send the response
    console.log(`Wallet assistant response: ${response.substring(0, 50)}...`);
    
    res.json({
      response: response
    });
    
  } catch (error) {
    console.error('Error processing wallet assistant query:', error);
    res.status(500).json({
      error: 'Failed to process wallet assistant query',
      message: error.message
    });
  }
});

// Helper functions for the wallet assistant

function extractProductInfo(query) {
  // Simple keyword extraction for products
  const electronics = ['smartphone', 'phone', 'laptop', 'computer', 'tv', 'television'];
  const clothing = ['shirt', 't-shirt', 'tshirt', 'jeans', 'pants', 'jacket', 'dress'];
  const food = ['beef', 'chicken', 'rice', 'vegetable', 'fruit', 'meat', 'dairy'];
  const transportation = ['car', 'bus', 'train', 'plane', 'flight', 'bike', 'bicycle'];
  
  // Check for product type
  let productType = null;
  let category = null;
  
  for (const item of electronics) {
    if (query.includes(item)) {
      productType = item;
      category = 'electronics';
      break;
    }
  }
  
  if (!productType) {
    for (const item of clothing) {
      if (query.includes(item)) {
        productType = item;
        category = 'clothing';
        break;
      }
    }
  }
  
  if (!productType) {
    for (const item of food) {
      if (query.includes(item)) {
        productType = item;
        category = 'food';
        break;
      }
    }
  }
  
  if (!productType) {
    for (const item of transportation) {
      if (query.includes(item)) {
        productType = item;
        category = 'transportation';
        break;
      }
    }
  }
  
  if (!productType) return null;
  
  return {
    type: productType,
    category: category
  };
}

function extractProduceInfo(query) {
  // Simple keyword extraction for produce
  const produceTypes = {
    'leafy_greens': ['lettuce', 'spinach', 'kale', 'greens', 'leafy'],
    'root_vegetables': ['carrot', 'potato', 'onion', 'beet', 'root'],
    'tomatoes': ['tomato', 'tomatoes'],
    'berries': ['berry', 'berries', 'strawberry', 'blueberry', 'raspberry'],
    'tree_fruits': ['apple', 'orange', 'peach', 'pear', 'fruit'],
    'grains': ['wheat', 'rice', 'oat', 'grain', 'corn']
  };
  
  // Extract produce type
  let produceType = null;
  
  for (const [type, keywords] of Object.entries(produceTypes)) {
    for (const keyword of keywords) {
      if (query.includes(keyword)) {
        produceType = type;
        break;
      }
    }
    if (produceType) break;
  }
  
  if (!produceType) return null;
  
  // Extract other parameters
  const isLocal = query.includes('local');
  const isOrganic = query.includes('organic');
  const isSeasonal = !(query.includes('winter') || query.includes('off season') || query.includes('out of season'));
  
  return {
    type: produceType,
    isLocal: isLocal,
    isOrganic: isOrganic,
    isSeasonal: isSeasonal
  };
}

function generateCarbonFootprintResponse(productInfo, locationInfo) {
  // Sample carbon footprint data by category
  const carbonData = {
    electronics: {
      smartphone: {
        production: 60, // kg CO2e
        usage: 8.5,     // kg CO2e per year
        lifespan: 2.5,  // years
        energy: 5.5     // kWh per year
      },
      laptop: {
        production: 330,
        usage: 44,
        lifespan: 4,
        energy: 65
      },
      television: {
        production: 400,
        usage: 110,
        lifespan: 7,
        energy: 150
      }
    },
    clothing: {
      shirt: {
        production: 5.5,
        water: 2700, // liters
        lifespan: 2,
        washing: 0.3 // kg CO2e per wash
      },
      jeans: {
        production: 33.4,
        water: 8000,
        lifespan: 4,
        washing: 0.4
      },
      jacket: {
        production: 17,
        water: 900,
        lifespan: 3,
        washing: 0.5
      }
    },
    food: {
      beef: {
        perKg: 60,
        water: 15400,
        land: 326
      },
      chicken: {
        perKg: 6,
        water: 4325,
        land: 12
      },
      rice: {
        perKg: 4,
        water: 2500,
        land: 2.5
      }
    },
    transportation: {
      car: {
        perKm: 0.21,
        perPassengerKm: 0.14,
        energy: 0.8
      },
      bus: {
        perKm: 0.105,
        perPassengerKm: 0.03,
        energy: 0.4
      },
      train: {
        perKm: 0.041,
        perPassengerKm: 0.02,
        energy: 0.15
      }
    }
  };
  
  // Get data for the specific product
  const category = productInfo.category;
  const type = productInfo.type;
  
  // Handle specific product types or return general category info
  if (category === 'electronics') {
    // Map similar terms
    const typeMap = {
      'phone': 'smartphone',
      'computer': 'laptop',
      'tv': 'television'
    };
    const mappedType = typeMap[type] || type;
    
    const data = carbonData.electronics[mappedType] || carbonData.electronics.smartphone;
    const totalFootprint = data.production + (data.usage * data.lifespan);
    const solarTokens = ((data.production / 3) + (data.energy * data.lifespan / 2.5)).toFixed(2); // Conversion to SOLAR tokens
    
    return `Carbon Footprint Analysis: ${type.toUpperCase()}

• Manufacturing: ${data.production} kg CO2e (${Math.round(data.production/totalFootprint*100)}% of lifecycle emissions)
• Usage over ${data.lifespan} years: ${data.usage * data.lifespan} kg CO2e (${Math.round(data.usage*data.lifespan/totalFootprint*100)}% of lifecycle emissions)
• Total lifecycle emissions: ${totalFootprint} kg CO2e
• Energy consumption: ${data.energy * data.lifespan} kWh over product lifetime

This is equivalent to approximately ${(totalFootprint / 60).toFixed(1)} kg of beef or ${(totalFootprint / 0.21 / 1000).toFixed(0)} kilometers driven by car.

In the Current-See SOLAR economy, offsetting this carbon footprint would require approximately ${solarTokens} SOLAR tokens.

${locationInfo ? `Based on your location in ${locationInfo}, extending this device's lifespan by 1 year could save approximately ${(data.production / data.lifespan).toFixed(1)} kg CO2e, with local recycling options available to recover valuable materials.` : 'Extending your device lifespan and proper recycling are the most effective ways to reduce its environmental impact.'}`;
  } else if (category === 'clothing') {
    const typeMap = {
      't-shirt': 'shirt',
      'tshirt': 'shirt',
      'pants': 'jeans'
    };
    const mappedType = typeMap[type] || type;
    
    const data = carbonData.clothing[mappedType] || carbonData.clothing.shirt;
    const washingFootprint = 30 * data.lifespan * data.washing; // Assuming 30 washes per year
    const totalFootprint = data.production + washingFootprint;
    const solarTokens = (totalFootprint / 3).toFixed(2); // Simple conversion to SOLAR tokens
    
    return `Carbon Footprint Analysis: ${type.toUpperCase()}

• Production: ${data.production} kg CO2e
• Water usage in production: ${(data.water / 1000).toFixed(1)} cubic meters
• Washing over ${data.lifespan} years: ${washingFootprint.toFixed(1)} kg CO2e
• Total lifecycle emissions: ${totalFootprint.toFixed(1)} kg CO2e

Fast fashion has a significant environmental impact. Choosing organic materials can reduce water usage by 30-50%, while extending garment life reduces production emissions.

In the Current-See SOLAR economy, this garment represents approximately ${solarTokens} SOLAR tokens worth of energy.

${locationInfo ? `In ${locationInfo}, considering secondhand options could reduce your fashion footprint by up to 80%, and local textile recycling programs are available for end-of-life management.` : 'Consider secondhand options, repair garments instead of replacing them, and recycle textiles at end-of-life to minimize environmental impact.'}`;
  } else {
    // Generic response for other categories
    return `I can analyze the carbon footprint and environmental impact of various products and activities. For ${category} like ${type}, the main environmental considerations include:

• Production emissions
• Energy consumption during use
• Lifespan and disposal impact
• Alternative lower-impact options

Would you like me to provide more specific data about the environmental impact of ${type}? I can calculate its carbon footprint and convert this to equivalent SOLAR tokens in the Current-See economy.`;
  }
}

function generateFarmToTableResponse(produceInfo, locationInfo) {
  // Base energy required to grow 1kg of produce (kWh)
  const baseGrowingEnergy = {
    leafy_greens: 0.5,
    root_vegetables: 0.7,
    tomatoes: 2.1,
    berries: 3.0,
    tree_fruits: 1.2,
    grains: 1.8
  };
  
  // Transportation energy cost multipliers by distance
  const transportMultipliers = {
    local: 1.0,      // < 50 miles
    regional: 2.5,   // 50-500 miles
    national: 6.0,   // 500-2000 miles
    international: 15.0 // > 2000 miles
  };
  
  // Seasonal adjustment factors
  const seasonalFactors = {
    in_season: 1.0,
    off_season: 2.2
  };
  
  // Calculate energy costs based on produce information
  const type = produceInfo.type;
  const displayName = type.replace('_', ' ');
  const baseEnergy = baseGrowingEnergy[type] || 1.5;
  const transportType = produceInfo.isLocal ? 'local' : 'regional';
  const transportMultiplier = transportMultipliers[transportType];
  const seasonalFactor = produceInfo.isSeasonal ? seasonalFactors.in_season : seasonalFactors.off_season;
  const organicFactor = produceInfo.isOrganic ? 0.8 : 1.0; // Organic often uses less energy but more land
  
  // Total energy in kWh per kg
  const growingEnergy = baseEnergy * seasonalFactor * organicFactor;
  const transportEnergy = baseEnergy * transportMultiplier * 0.3;
  const processingEnergy = 0.5; // Simple processing
  const totalEnergy = growingEnergy + transportEnergy + processingEnergy;
  
  // Convert to SOLAR tokens (1 SOLAR = approx 2.5 kWh)
  const solarTokens = (totalEnergy / 2.5).toFixed(2);
  
  // Base price per kg in USD (simplified model)
  const basePricePerKg = {
    leafy_greens: 3.50,
    root_vegetables: 1.80,
    tomatoes: 3.20,
    berries: 5.50,
    tree_fruits: 3.00,
    grains: 1.20
  }[type] || 3.00;
  
  // Adjust for organic, seasonal, and local factors
  const organicPriceFactor = produceInfo.isOrganic ? 1.3 : 1.0;
  const localPriceFactor = produceInfo.isLocal ? 1.2 : 1.0;
  const seasonalPriceFactor = produceInfo.isSeasonal ? 0.8 : 1.2;
  
  // Energy-adjusted price (combining traditional pricing with energy costs)
  const energyCost = totalEnergy * 0.12; // USD per kWh
  const marketPrice = basePricePerKg * organicPriceFactor * localPriceFactor * seasonalPriceFactor;
  const energyAdjustedPrice = marketPrice + energyCost;
  
  return `Energy-Based Pricing Analysis: ${displayName.toUpperCase()}
${produceInfo.isLocal ? 'Local' : 'Non-local'}, ${produceInfo.isSeasonal ? 'In-Season' : 'Off-Season'}, ${produceInfo.isOrganic ? 'Organic' : 'Conventional'}

Energy Requirements:
• Growing: ${growingEnergy.toFixed(2)} kWh/kg
• Transportation: ${transportEnergy.toFixed(2)} kWh/kg
• Processing: ${processingEnergy.toFixed(2)} kWh/kg
• Total Energy Footprint: ${totalEnergy.toFixed(2)} kWh/kg

Market Price: $${marketPrice.toFixed(2)}/kg
Energy Cost Component: $${energyCost.toFixed(2)}/kg
Energy-Adjusted Fair Price: $${energyAdjustedPrice.toFixed(2)}/kg

In the Current-See SOLAR economy, this represents ${solarTokens} SOLAR tokens per kg.

${locationInfo ? `Based on your location in ${locationInfo}, ${produceInfo.isLocal ? 'you\'re making an energy-efficient choice with local produce' : 'switching to local options could reduce transportation energy by up to 60%'}.` : ''}

${produceInfo.isSeasonal ? 'Seasonal produce typically requires 50-70% less energy than off-season alternatives.' : 'Off-season produce often requires energy-intensive greenhouse growing or long-distance transportation.'}

${produceInfo.isOrganic ? 'Organic farming practices typically use 30-50% less energy but may require more land area.' : 'Conventional farming often uses more energy for synthetic fertilizers and pesticides.'}`;
}

// API endpoint for product database access
app.get('/api/products', (req, res) => {
  // In a real implementation, this would access a database of products with energy and carbon data
  // For now, we'll return a simple sample of products
  
  const products = [
    {
      id: 'smartphone_standard',
      name: 'Smartphone (Standard)',
      category: 'electronics',
      carbonFootprint: 60,
      energyConsumption: 5.5,
      lifespan: 2.5,
      waterUsage: 13000,
      solarTokenValue: 24.0
    },
    {
      id: 'smartphone_eco',
      name: 'Smartphone (Eco)',
      category: 'electronics',
      carbonFootprint: 45,
      energyConsumption: 4.5,
      lifespan: 3.5,
      waterUsage: 10000,
      solarTokenValue: 18.0
    },
    {
      id: 'beef_kg',
      name: 'Beef (1kg)',
      category: 'food',
      carbonFootprint: 60,
      energyConsumption: 25.0,
      waterUsage: 15400,
      landUse: 326,
      solarTokenValue: 10.0
    },
    {
      id: 'vegetables_local_kg',
      name: 'Vegetables - Local (1kg)',
      category: 'food',
      carbonFootprint: 0.3,
      energyConsumption: 0.5,
      waterUsage: 300,
      landUse: 0.3,
      solarTokenValue: 0.2
    }
  ];
  
  // Filter by category or search term if provided
  const { category, search } = req.query;
  
  let filteredProducts = products;
  
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.category.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    products: filteredProducts,
    count: filteredProducts.length
  });
});

// Energy pricing API endpoint
app.get('/api/energy-pricing', (req, res) => {
  // Get current energy pricing data
  const currentDate = new Date();
  
  // Basic model for energy pricing (simplified)
  const energyPricing = {
    timestamp: currentDate.toISOString(),
    baseKwhPrice: 0.12, // USD per kWh
    solarKwhPrice: 0.08, // USD per kWh from solar
    carbonPrice: 25.00, // USD per ton CO2
    solarTokenValue: 2.5, // kWh per SOLAR token
    solarTokenPrice: 0.30, // USD per SOLAR token
    regionalModifiers: {
      northAmerica: 1.0,
      europe: 1.2,
      asia: 0.9,
      africa: 0.8,
      southAmerica: 0.85,
      oceania: 1.1
    },
    seasonalFactors: {
      winter: 1.2,
      spring: 0.9,
      summer: 1.0,
      fall: 0.95
    }
  };
  
  res.json(energyPricing);
});

// Wallet App Connectivity Endpoints
// These are proxy endpoints for the wallet applications accessed through the wallet-prototype.html page

// Ping endpoint for Cross Platform Mobile (Full AI Wallet)
app.get('/ping', (req, res) => {
  console.log('Received ping request from wallet app');
  res.status(200).json({ status: 'ok', message: 'Full AI Wallet is ready' });
});

// Root endpoint for handling POST wake requests for Full AI Wallet
app.post('/', (req, res) => {
  console.log('Received wake request for wallet app:', req.body);
  res.status(200).json({ status: 'ok', message: 'Wallet app is awake' });
});

// Mock wallet data endpoints to provide fallback functionality
app.get('/wallets', (req, res) => {
  console.log('Serving wallet data');
  res.status(200).json({
    user1: { balance: 123.45 },
    user2: { balance: 67.89 }
  });
});

app.get('/transfers', (req, res) => {
  console.log('Serving transfers data');
  res.status(200).json([
    { from: "User1", to: "User2", amount: 10.0, timestamp: "2025-04-16T12:34:56Z" },
    { from: "User2", to: "User1", amount: 5.0, timestamp: "2025-04-16T10:30:00Z" },
    { from: "User1", to: "Admin", amount: 2.5, timestamp: "2025-04-15T15:45:22Z" }
  ]);
});

// Endpoints for 2-Wallet Demo
app.get('/wallet-demo/ping', (req, res) => {
  console.log('Received ping request from 2-wallet demo');
  res.status(200).json({ status: 'ok', message: '2-Wallet Demo is ready' });
});

app.post('/wallet-demo', (req, res) => {
  console.log('Received wake request for 2-wallet demo:', req.body);
  res.status(200).json({ status: 'ok', message: '2-Wallet Demo is awake' });
});

// Transfer demo endpoints
app.get('/transfer-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transfer-demo.html'));
});

// AI Wallet Prototype endpoints
app.get('/wallet-ai-prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-prototype.html'));
});

// Mock AI services for wallet prototype
app.post('/wallet-ai/analyze', (req, res) => {
  console.log('Received AI analysis request:', req.body);
  
  const { query, type } = req.body;
  let response = '';
  
  if (type === 'carbon_footprint') {
    response = `Carbon Footprint Analysis:\n\nBased on your query about "${query}", here's the environmental impact breakdown:\n\n• Manufacturing: 45 kg CO2e (65% of emissions)\n• Usage: 18 kg CO2e (25% of emissions)\n• Disposal: 7 kg CO2e (10% of emissions)\n• Total: 70 kg CO2e\n\nThis is equivalent to approximately 280 km driven by an average car.\n\nOffetting this footprint would require 21 SOLAR tokens.`;
  } else if (type === 'energy_pricing') {
    response = `Energy-Based Pricing Analysis:\n\nFor ${query}:\n\n• Production energy: 1.2 kWh/unit\n• Transportation: 0.7 kWh/unit\n• Storage: 0.2 kWh/unit\n• Total energy input: 2.1 kWh/unit\n\nThis represents an energy cost component of $0.25/unit.\n\nIn the Current-See system, this would be valued at 0.9 SOLAR tokens per unit.`;
  } else {
    response = `Your question about "${query}" requires a comprehensive analysis. I'd be happy to explore this topic in depth when the full AI wallet feature is available. This prototype demonstrates the interface, but the complete analysis engine is coming soon.`;
  }
  
  setTimeout(() => {
    res.json({ response });
  }, 1200); // Add slight delay to simulate processing
});

// Sign up endpoint with enhanced data reliability
app.post('/api/signup', (req, res) => {
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
    
    // Check if placeholder exists
    const placeholderIndex = members.findIndex(m => m.name === 'You are next' || m.isPlaceholder);
    let nextId = members.length;
    
    if (placeholderIndex !== -1) {
      // Remove placeholder, but we'll add it back later
      members.splice(placeholderIndex, 1);
      console.log('[SIGNUP] Removing existing placeholder to ensure it goes at the end');
    }
    
    // Make sure we have a unique ID by checking the maximum existing ID
    const maxId = members.reduce((max, member) => 
      typeof member.id === 'number' && member.id > max ? member.id : max, 0);
    nextId = maxId + 1;
    
    const newMember = {
      id: nextId,
      username: userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
      name: userData.name.trim(),
      email: userData.email.trim(), // Store email and trim whitespace
      joinedDate: today,
      signupTimestamp: timestamp,
      totalSolar: 1.00, // Initial allocation
      totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
      isAnonymous: userData.isAnonymous || false,
      lastDistributionDate: today // Set initial distribution date
    };
    
    console.log(`[SIGNUP] Creating new member #${nextId} with name: ${newMember.name}, email: ${newMember.email}`);
    
    // Create a backup before making changes
    backupMembersData();
    
    // Add to members array
    members.push(newMember);
    
    // Add back the placeholder at the end with proper identification
    members.push({
      id: "next",
      username: "you.are.next",
      name: "You are next",
      email: "",
      joinedDate: today,
      totalSolar: 1.00,
      totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
      isAnonymous: false,
      isPlaceholder: true,
      lastDistributionDate: today
    });
    
    // IMMEDIATELY save to persistent storage to ensure emails are preserved
    const saveResult = updateMembersFiles();
    console.log('[SIGNUP] Save result after adding new member:', saveResult ? 'Success' : 'Failed');
    
    // Multi-level verification for data persistence
    let verificationSuccess = false;
    let verificationMessage = '';
    
    try {
      // Verify members.json
      const membersFile = fs.readFileSync('public/api/members.json', 'utf8');
      const savedMembers = JSON.parse(membersFile);
      const savedMember = savedMembers.find(m => m.id === newMember.id);
      
      // Verify embedded-members
      const embeddedFile = fs.readFileSync('public/embedded-members', 'utf8');
      const embeddedMatch = embeddedFile.includes(newMember.email);
      
      if (savedMember && savedMember.email === newMember.email && embeddedMatch) {
        console.log('[SIGNUP] ✅ Verification successful: Member data correctly saved to all storage locations');
        verificationSuccess = true;
        verificationMessage = 'Member data successfully verified in all storage locations';
        
        // Create a post-signup backup
        backupMembersData();
      } else {
        console.warn('[SIGNUP] ⚠️ Warning: Verification issues detected:');
        if (!savedMember) console.warn('- Member not found in members.json');
        if (savedMember && savedMember.email !== newMember.email) console.warn('- Email mismatch in members.json');
        if (!embeddedMatch) console.warn('- Member not found in embedded-members');
        
        verificationMessage = 'Partial verification - some storage locations may not be updated';
        
        // Retry save to recover from partial failure
        console.log('[SIGNUP] Attempting recovery by re-saving member data...');
        updateMembersFiles();
      }
    } catch (verifyErr) {
      console.error('[SIGNUP] Error during verification:', verifyErr);
      verificationMessage = 'Verification error: ' + verifyErr.message;
      
      // Emergency recovery: force rewrite all data
      try {
        console.log('[SIGNUP] Attempting emergency recovery...');
        // Force update all storage files
        updateMembersFiles();
        // Create emergency backup
        backupMembersData();
      } catch (recoveryErr) {
        console.error('[SIGNUP] Recovery failed:', recoveryErr);
      }
    }
    
    console.log(`[SIGNUP] Process complete. Current member count: ${members.length - 1} (excluding placeholder)`);
    
    // Return success response with verification info
    res.status(201).json({ 
      success: true, 
      member: newMember,
      totalMembers: members.length - 1, // Subtract one to exclude the placeholder
      verification: {
        success: verificationSuccess,
        message: verificationMessage
      }
    });
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

// Landing page generation
function generateLandingPage() {
  updateSolarClockData();
  const energyValue = (solarClockData.totalKwh / 1000000).toFixed(6);
  const moneyValue = Math.floor(solarClockData.totalDollars).toLocaleString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Current-See</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #ffeb99, #96c93d);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    header {
      background-color: rgba(255, 255, 255, 0.9);
      padding: 1rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .logo-container {
      display: flex;
      align-items: center;
    }
    
    .logo-text {
      font-size: 1.5rem;
      font-weight: bold;
      margin-left: 10px;
      color: #333;
    }
    
    nav ul {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    
    nav li {
      margin-left: 1.5rem;
    }
    
    nav a {
      color: #333;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.3s;
    }
    
    nav a:hover {
      color: #7bc144;
    }
    
    .hero {
      text-align: center;
      padding: 3rem 1rem;
    }
    
    h1 {
      color: #333;
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    
    .subtitle {
      color: #555;
      font-size: 1.2rem;
      margin-bottom: 2rem;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .counter-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2rem;
      margin: 2rem auto;
      max-width: 1200px;
      padding: 0 1rem;
    }
    
    .counter {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 10px;
      padding: 2rem;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    
    .counter-value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #7bc144;
      margin: 1rem 0;
    }
    
    .counter-label {
      font-size: 1.1rem;
      color: #666;
    }
    
    .solar-equation {
      text-align: center;
      padding: 1rem;
      margin: 0 auto 2rem;
      max-width: 900px;
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    .solar-equation p {
      font-size: 1.1rem;
      color: #333;
      font-weight: 600;
      margin: 0;
    }
    
    .members-section {
      background-color: rgba(255, 255, 255, 0.8);
      padding: 3rem 1rem;
      text-align: center;
    }
    
    .members-header {
      margin-bottom: 2rem;
    }
    
    .members-table {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border-collapse: collapse;
    }
    
    .members-table th {
      text-align: left;
      padding: 0.8rem;
      background-color: rgba(123, 193, 68, 0.1);
      border-bottom: 2px solid #7bc144;
    }
    
    .members-table td {
      padding: 0.8rem;
      border-bottom: 1px solid #ddd;
    }
    
    .member-id {
      font-weight: bold;
      color: #7bc144;
    }
    
    .member-name {
      font-weight: bold;
    }
    
    .cta-section {
      text-align: center;
      padding: 3rem 1rem;
      background-color: rgba(123, 193, 68, 0.2);
    }
    
    .cta-button {
      display: inline-block;
      background-color: #7bc144;
      color: white;
      font-weight: bold;
      padding: 1rem 2rem;
      border-radius: 5px;
      text-decoration: none;
      margin-top: 1rem;
      transition: background-color 0.3s;
    }
    
    .cta-button:hover {
      background-color: #669f33;
    }
    
    footer {
      background-color: #222;
      color: white;
      padding: 2rem;
      text-align: center;
      margin-top: auto;
    }
    
    .copyright {
      margin-top: 1rem;
    }
    
    @media (max-width: 768px) {
      header {
        flex-direction: column;
        padding: 1rem;
      }
      
      nav {
        margin-top: 1rem;
      }
      
      nav ul {
        flex-wrap: wrap;
        justify-content: center;
      }
      
      nav li {
        margin: 0.5rem;
      }
      
      .counter-container {
        flex-direction: column;
        align-items: center;
      }
      
      .members-table {
        display: block;
        overflow-x: auto;
      }
    }
  </style>
  
  <script>
    function updateCounters() {
      fetch('/api/solar-clock')
        .then(response => response.json())
        .then(data => {
          document.getElementById('energy-counter').textContent = 
            (data.totalKwh / 1000000).toFixed(6);
          document.getElementById('money-counter').textContent = 
            '$' + Math.floor(data.totalDollars).toLocaleString();
        })
        .catch(error => {
          console.error('Error fetching solar data:', error);
        });
    }
    
    document.addEventListener('DOMContentLoaded', function() {
      // Update immediately and then every second
      setInterval(updateCounters, 1000);
    });
  </script>
</head>
<body>
  <header>
    <div class="logo-container">
      <div class="logo-text">The Current-See</div>
    </div>
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/solar">My Solar</a></li>
        <li><a href="/join">Join</a></li>
      </ul>
    </nav>
  </header>
  
  <section class="hero">
    <h1>The Current-See: Solar Generator</h1>
    <p class="subtitle">Prototype of a solar-backed global economic system - Making the power of the sun accessible to everyone</p>
  </section>
  
  <div class="counter-container">
    <div class="counter">
      <div class="counter-label">Solar Energy Generated Since April 7, 2025 (12:00 AM GMT)</div>
      <div id="energy-counter" class="counter-value">${energyValue}</div>
      <div class="counter-label">Million kWh (MkWh)</div>
    </div>
    
    <div class="counter">
      <div class="counter-label">Equivalent Monetary Value</div>
      <div id="money-counter" class="counter-value">$${moneyValue}</div>
      <div class="counter-label">USD</div>
    </div>
  </div>
  
  <div class="solar-equation">
    <p>1 Solar = 4,913 kWh (based on 1% of Earth's solar input divided among 8.5B people)</p>
  </div>
  
  <section class="members-section">
    <div class="members-header">
      <h2>Public Members</h2>
      <p>Join our community of solar innovators around the world</p>
    </div>
    
    <table class="members-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Member</th>
          <th>Joined</th>
          <th>SOLAR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="member-id">#1</td>
          <td class="member-name">Terry D. Franklin</td>
          <td>April 10, 2025</td>
          <td>5.00</td>
        </tr>
        <tr>
          <td class="member-id">#2</td>
          <td class="member-name">JF</td>
          <td>April 11, 2025</td>
          <td>4.00</td>
        </tr>
      </tbody>
    </table>
  </section>
  
  <section class="cta-section">
    <h2>Ready to be part of the solar revolution?</h2>
    <p>Sign up today to secure your daily solar allocation and track your personal solar generation.</p>
    <a href="/join" class="cta-button">Join The Current-See</a>
  </section>
  
  <footer>
    <div>The Current-See PBC, Inc.</div>
    <div>A Public Benefit Corporation</div>
    <div class="copyright">&copy; 2025 The Current-See PBC, Inc. All rights reserved.</div>
  </footer>
</body>
</html>`;
}

// Root route that serves index.html or generates one
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(generateLandingPage());
  }
});

// Define a specific route for the solar generator page
app.get('/solar-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'solar-generator.html'));
});

// Catch-all route - first try to serve the file from public directory,
// and if it doesn't exist, fall back to index.html
app.use((req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  
  // Check if the file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    // Fall back to index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log('Solar Generator is tracking energy since April 7, 2025');
  console.log('Current-See member #1: Terry D. Franklin - Joined April 10, 2025');
  
  // Set up a daily schedule for distribution at midnight GMT (5:00 PM Pacific Time)
  const DISTRIBUTION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Create a monitoring log file
  const logDistribution = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    
    // Also log to a file for permanent record
    try {
      fs.appendFileSync('distribution_log.txt', logMessage);
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  };
  
  // Log server start
  logDistribution('Server started. SOLAR distribution scheduler initialized.');
  
  // Helper function to run a distribution with proper logging
  // Function to update the static files that store member data
  const updateMembersFiles = () => {
    try {
      // Update the public API file
      fs.writeFileSync(
        'public/api/members.json',
        JSON.stringify(members, null, 2)
      );
      
      // Update the embedded members file
      fs.writeFileSync(
        'public/embedded-members',
        JSON.stringify(members, null, 2)
      );
      
      logDistribution('Updated static member files with new SOLAR totals');
      return true;
    } catch (error) {
      console.error('Error updating member files:', error);
      logDistribution('ERROR: Failed to update static member files: ' + error.message);
      return false;
    }
  };

  const runDistribution = () => {
    logDistribution('Running scheduled SOLAR distribution...');
    const updatedCount = updateMemberDistributions();
    
    // Log detailed distribution results
    const distributionTime = new Date().toISOString();
    const pacificTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    logDistribution(`Distribution completed at ${distributionTime} (${pacificTime} Pacific Time). Updated ${updatedCount} members.`);
    
    // Files are already updated inside updateMemberDistributions()
    
    // Save a backup of the current members data
    try {
      fs.writeFileSync(
        `members_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        JSON.stringify(members, null, 2)
      );
      logDistribution('Members data backup created successfully.');
    } catch (error) {
      console.error('Error creating members backup:', error);
    }
  };
  
  // Set up a precise scheduler for 5:00 PM Pacific Time (00:00 GMT) using node-schedule
  // This runs every day at exactly 5:00 PM Pacific Time (12h format = 5PM)
  const distributionJob = schedule.scheduleJob('0 17 * * *', function() {
    logDistribution('Scheduled SOLAR distribution triggered at 5:00 PM Pacific Time (00:00 GMT)');
    runDistribution();
  });
  
  // Check if we need to run distribution immediately
  const now = new Date();
  const pstHour = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false });
  const pstMinute = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', minute: 'numeric' });
  
  if (pstHour === '17' && parseInt(pstMinute) < 5) {
    logDistribution('Server started within 5 minutes of distribution time - running immediate distribution');
    runDistribution();
  } else {
    // Format next distribution time
    const nextDistribution = new Date();
    if (parseInt(pstHour) >= 17) {
      // Move to next day
      nextDistribution.setDate(nextDistribution.getDate() + 1);
    }
    
    // Get the next distribution time (we need to create a temporary job just to check the next time)
    const tempJob = schedule.scheduleJob('0 17 * * *', function() {
      // This is just a dummy function that won't actually run
      // We only need this job to get the next invocation time
    });
    
    const nextDistText = tempJob.nextInvocation().toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    
    // Cancel the temporary job since we only needed it to get the next time
    tempJob.cancel();
    
    logDistribution(`Next SOLAR distribution scheduled for ${nextDistText} Pacific Time`);
  }
  
  // Set up health check logging using node-schedule (runs every 6 hours)
  const healthCheckJob = schedule.scheduleJob('0 */6 * * *', function() {
    logDistribution(`Health check: Server up and running. ${members.length} members in system.`);
  });
  
  console.log('SOLAR distribution scheduler is active using node-schedule. Will distribute 1 SOLAR per user daily at 00:00 GMT (5:00 PM Pacific Time).');

  // Alternative email update API with query string token (more robust against authentication issues)
  app.get('/api/members/update', (req, res) => {
    try {
      const { token, id, email } = req.query;
      
      // Verify the token directly without using middleware
      if (!verifyAdminToken(token)) {
        console.log('Invalid token for direct email update API');
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      const memberId = parseInt(id, 10);
      
      console.log(`Direct email update API called for member ID ${memberId}, new email: ${email}`);
      
      // Validate input
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      // Find member by ID
      const memberIndex = members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Skip if it's the reserve account or placeholder
      if (members[memberIndex].isReserve || members[memberIndex].name === 'You are next') {
        return res.status(403).json({ error: 'Cannot modify this special account' });
      }

      // Store old email for logging
      const oldEmail = members[memberIndex].email;
      
      // Update email
      members[memberIndex].email = email;
      
      // Update member files
      updateMembersFiles();
      
      // Create a backup with timestamp
      const backupDir = path.join(__dirname, 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      fs.writeFileSync(
        path.join(backupDir, `members_backup_direct_update_${timestamp}.json`), 
        JSON.stringify(members, null, 2)
      );
      
      console.log(`Member ${memberId} email updated from "${oldEmail}" to "${email}" via direct query API`);
      
      res.json({ 
        success: true, 
        message: 'Email updated successfully',
        memberId,
        oldEmail,
        newEmail: email
      });
    } catch (error) {
      console.error('Error in direct email update API:', error);
      res.status(500).json({ error: 'Failed to update email' });
    }
  });
  
  // Create a fallback API for member email updates
  app.post('/api/members/:memberId/update-email', adminAuthMiddleware, (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      const { email } = req.body;
      
      console.log(`Fallback email update API called for member ID ${memberId}, new email: ${email}`);
      
      // Validate input
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      // Find member by ID
      const memberIndex = members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Skip if it's the reserve account or placeholder
      if (members[memberIndex].isReserve || members[memberIndex].name === 'You are next') {
        return res.status(403).json({ error: 'Cannot modify this special account' });
      }

      // Store old email for logging
      const oldEmail = members[memberIndex].email;
      
      // Update email
      members[memberIndex].email = email;
      
      // Update member files
      updateMembersFiles();
      
      // Create a backup with timestamp
      const backupDir = path.join(__dirname, 'backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      fs.writeFileSync(
        path.join(backupDir, `members_backup_email_update_${timestamp}.json`), 
        JSON.stringify(members, null, 2)
      );
      
      console.log(`Member ${memberId} email updated from "${oldEmail}" to "${email}" via fallback API`);
      
      res.json({ 
        success: true, 
        message: 'Email updated successfully',
        memberId,
        oldEmail,
        newEmail: email
      });
    } catch (error) {
      console.error('Error in fallback email update API:', error);
      res.status(500).json({ error: 'Failed to update email' });
    }
  });
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});