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
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

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
    id: 1,
    username: 'terry.franklin',
    name: 'Terry D. Franklin',
    joinedDate: '2025-04-10',
    totalSolar: 5.00,
    totalDollars: 680000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-14' // Track last distribution date
  },
  {
    id: 2,
    username: 'j.franklin',
    name: 'JF',
    joinedDate: '2025-04-11',
    totalSolar: 4.00,
    totalDollars: 544000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-14' // Track last distribution date
  }
];

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
  
  console.log(`Daily distribution completed: ${distributedCount} members updated`);
  return distributedCount;
}

// Run distribution update immediately and then on a schedule
updateMemberDistributions();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Static file serving - key feature to serve all files in the public directory
app.use(express.static('public'));

// API Endpoints
app.get('/api/solar-clock', (req, res) => {
  updateSolarClockData();
  res.json(solarClockData);
});

app.get('/api/members', (req, res) => {
  res.json(members);
});

app.get('/api/solar-accounts/leaderboard', (req, res) => {
  res.json(members);
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Missing Authorization header'
    });
  }
  
  // Check if the token matches the environment variable
  if (!ADMIN_API_TOKEN) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Admin API token not configured'
    });
  }
  
  // Simple token comparison - format should be "Bearer TOKEN"
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
  
  if (token !== ADMIN_API_TOKEN) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid API token'
    });
  }
  
  // Token is valid, proceed to the route handler
  next();
};

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

app.post('/api/signup', (req, res) => {
  try {
    console.log('Received signup request:', req.body);
    const userData = req.body;
    
    // Validate required fields
    if (!userData.name || !userData.email) {
      console.log('Validation failed: Missing name or email');
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
    }
    
    // Calculate new member data
    const today = new Date().toISOString().split('T')[0];
    const newMember = {
      id: members.length + 1,
      username: userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
      name: userData.name,
      joinedDate: today,
      totalSolar: 1.00, // Initial allocation
      totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
      isAnonymous: userData.isAnonymous || false,
      lastDistributionDate: today // Set initial distribution date
    };
    
    console.log('Creating new member:', newMember);
    
    // Add to members array
    members.push(newMember);
    
    console.log('Current member count:', members.length);
    
    // Return success response
    res.status(201).json({ 
      success: true, 
      member: newMember
    });
  } catch (e) {
    console.error('Error processing signup:', e);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
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
  const runDistribution = () => {
    logDistribution('Running scheduled SOLAR distribution...');
    const updatedCount = updateMemberDistributions();
    
    // Log detailed distribution results
    const distributionTime = new Date().toISOString();
    const pacificTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    logDistribution(`Distribution completed at ${distributionTime} (${pacificTime} Pacific Time). Updated ${updatedCount} members.`);
    
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