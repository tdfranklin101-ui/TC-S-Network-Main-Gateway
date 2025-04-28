/**
 * The Current-See Deployment-Ready Server
 * 
 * This file is specifically designed for Replit deployments
 * with minimal dependencies and maximum reliability.
 */

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
const CURRENTSEE_DB_URL = process.env.CURRENTSEE_DB_URL;

// Solar Clock Data
let solarClockData = {
  startDate: '2025-04-07T00:00:00Z',
  totalKwh: 0,
  totalValue: 0,
  kwhPerSolar: 4913,
  valuePerSolar: 136000,
  lastUpdated: new Date().toISOString()
};

// Members Data
let members = [];
try {
  // Try to load members from embedded data
  const embeddedPath = path.join(__dirname, 'public/embedded-members/embedded.json');
  if (fs.existsSync(embeddedPath)) {
    members = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
    console.log(`Loaded ${members.length} members from embedded data file`);
  } else {
    // Fallback to the default members
    members = [
      {
        id: 1,
        name: "Terry D. Franklin",
        joinDate: "2025-04-09",
        solarBalance: 9.0000,
        lastDistributionDate: "2025-04-28"
      },
      {
        id: 2,
        name: "JF",
        joinDate: "2025-04-20",
        solarBalance: 8.0000,
        lastDistributionDate: "2025-04-28"
      }
    ];
    console.log("Using default members data");
  }
} catch (error) {
  console.error("Error loading members data:", error);
  // Default members as a fallback
  members = [
    {
      id: 1,
      name: "Terry D. Franklin",
      joinDate: "2025-04-09",
      solarBalance: 9.0000,
      lastDistributionDate: "2025-04-28"
    },
    {
      id: 2,
      name: "JF",
      joinDate: "2025-04-20",
      solarBalance: 8.0000,
      lastDistributionDate: "2025-04-28"
    }
  ];
}

// Create a function to update the solar clock data
function updateSolarClockData() {
  const now = new Date();
  const startDate = new Date('2025-04-07T00:00:00Z');
  
  // Calculate seconds since start date
  const diffSeconds = Math.floor((now - startDate) / 1000);
  
  // Calculate kWh (using 0.1 kWh per second as an approximation)
  const kwhPerSecond = 0.1;
  const totalKwh = diffSeconds * kwhPerSecond;
  
  // Calculate dollar value at $0.12 per kWh
  const valuePerKwh = 0.12;
  const totalValue = totalKwh * valuePerKwh;
  
  // Update the solar clock data
  solarClockData = {
    startDate: '2025-04-07T00:00:00Z',
    totalKwh: totalKwh,
    totalValue: totalValue,
    kwhPerSolar: 4913,
    valuePerSolar: 136000,
    lastUpdated: now.toISOString()
  };
  
  return solarClockData;
}

// Create Express app
const app = express();

// Basic configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple middleware for page includes
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string') {
      // Process header includes
      if (body.includes('<!-- HEADER_PLACEHOLDER -->')) {
        try {
          const headerPath = path.join(__dirname, 'public/includes/header.html');
          const header = fs.readFileSync(headerPath, 'utf8');
          body = body.replace('<!-- HEADER_PLACEHOLDER -->', header);
        } catch (err) {
          console.error('Error including header:', err);
        }
      }
      
      // Process footer includes
      if (body.includes('<!-- FOOTER_PLACEHOLDER -->')) {
        try {
          const footerPath = path.join(__dirname, 'public/includes/footer.html');
          const footer = fs.readFileSync(footerPath, 'utf8');
          body = body.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
        } catch (err) {
          console.error('Error including footer:', err);
        }
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Static files
app.use(express.static('public'));

// Health check routes (high priority)
app.get(['/health', '/healthz', '/_health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'The Current-See server is running'
  });
});

// Specific routes to ensure correct file serving for all pages from backup
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/my-solar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-features.html'));
});

// Main navigation pages
app.get('/account-info', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account-info.html'));
});

app.get('/business-plan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

app.get('/business_plan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

app.get('/dashboard-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-demo.html'));
});

app.get('/declaration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'declaration.html'));
});

app.get('/demo-features', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo-features.html'));
});

app.get('/founder-note', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/founder_note', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/merch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'merch.html'));
});

app.get('/merchandise', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'merch.html'));
});

app.get('/prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'prototype.html'));
});

app.get('/share', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/solar-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'solar-generator.html'));
});

app.get('/splash', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'splash.html'));
});

app.get('/transfer-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transfer-demo.html'));
});

app.get('/update-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'update-account.html'));
});

// Wallet pages
app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet.html'));
});

app.get('/wallet-ai-features', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-features.html'));
});

app.get('/wallet-ai-prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-prototype.html'));
});

app.get('/wallet-prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-prototype.html'));
});

// AI demo pages
app.get('/ai-assistant-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-assistant-demo.html'));
});

app.get('/voice-assistant-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voice-assistant-demo.html'));
});

// Test pages
app.get('/api-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-test.html'));
});

app.get('/test-language', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-language.html'));
});

app.get('/test-members', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-members.html'));
});

// White paper pages
app.get('/whitepapers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whitepapers.html'));
});

app.get('/white-paper-1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_1.html'));
});

app.get('/white-paper-2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_2.html'));
});

app.get('/white-paper-3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_3.html'));
});

app.get('/white-paper-4', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_4.html'));
});

app.get('/white-paper-5', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_5.html'));
});

app.get('/white-paper-6', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_6.html'));
});

app.get('/white-paper-7', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_7.html'));
});

app.get('/white-paper-9', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_9.html'));
});

app.get('/white-paper-10', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_10.html'));
});

app.get('/white_paper_1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_1.html'));
});

app.get('/white_paper_2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_2.html'));
});

app.get('/white_paper_3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_3.html'));
});

app.get('/white_paper_4', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_4.html'));
});

app.get('/white_paper_5', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_5.html'));
});

app.get('/white_paper_6', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_6.html'));
});

app.get('/white_paper_7', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_7.html'));
});

app.get('/white_paper_9', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_9.html'));
});

app.get('/white_paper_10', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_10.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/dashboard.html'));
});

app.get('/admin/member-roster', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/member-roster.html'));
});

// API Endpoints essential for website functionality
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

app.get('/api/members.json', (req, res) => {
  res.json(members);
});

// Serve the embedded members data with proper content type
app.get('/embedded-members', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(members);
});

app.get('/embedded-members/embedded.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(members);
});

app.get('/api/members-data', (req, res) => {
  // Alternative endpoint for JSONP callback support
  const callback = req.query.callback;
  if (callback) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(members)})`);
  } else {
    res.json(members);
  }
});

app.get('/api/members.js', (req, res) => {
  // JSONP endpoint for cross-domain support
  const callback = req.query.callback || 'updateMembers';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${callback}(${JSON.stringify(members)})`);
});

app.get('/api/member-count', (req, res) => {
  res.json({ count: members.length });
});

// Join form submission endpoint
app.post('/api/join', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Both name and email are required'
    });
  }
  
  // Log the join request
  console.log(`Join request received: ${name} (${email})`);
  
  // For deployment, we'll just acknowledge the request
  // In production, this would store the data in the database
  res.json({
    success: true,
    message: 'Thank you for joining The Current-See waitlist!'
  });
});

// Catch-all route for any other paths
app.use((req, res) => {
  // Check if the file exists in public directory
  const filePath = path.join(__dirname, 'public', req.path);
  
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
  console.log(`Deployment server running at http://${HOST}:${PORT}/`);
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