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

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;

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
    // Check if member needs distribution for today
    if (!member.lastDistributionDate || member.lastDistributionDate < today) {
      // Add 1 SOLAR per day as specified
      member.totalSolar += SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION;
      member.totalDollars = member.totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
      member.lastDistributionDate = today;
      distributedCount++;
      
      console.log(`Distributed ${SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION} SOLAR to member #${member.id} (${member.name})`);
    }
  });
  
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
  res.status(200).send('OK');
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
      <div class="counter-label">Solar Energy Generated Since April 7, 2025</div>
      <div id="energy-counter" class="counter-value">${energyValue}</div>
      <div class="counter-label">Million kWh (MkWh)</div>
    </div>
    
    <div class="counter">
      <div class="counter-label">Equivalent Monetary Value</div>
      <div id="money-counter" class="counter-value">$${moneyValue}</div>
      <div class="counter-label">USD</div>
    </div>
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

// Catch-all route - serve files from public or fall back to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log('Solar Generator is tracking energy since April 7, 2025');
  console.log('Current-See member #1: Terry D. Franklin - Joined April 10, 2025');
  
  // Set up a daily schedule for distribution at midnight
  const DISTRIBUTION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  setInterval(() => {
    console.log('Running scheduled SOLAR distribution...');
    const updatedCount = updateMemberDistributions();
    console.log(`Scheduled distribution complete. Updated ${updatedCount} members.`);
  }, DISTRIBUTION_INTERVAL);
  
  console.log('SOLAR distribution scheduler is active. Will distribute 1 SOLAR per user every 24 hours.');
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