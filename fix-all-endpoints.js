/**
 * The Current-See Comprehensive API Fix
 * 
 * This server fixes all API endpoints to ensure they consistently
 * return the complete members list including the TC-S Solar Reserve.
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Create Express application
const app = express();

// Enable CORS for API requests
app.use(cors());

// Serve static files from 'public' directory
app.use(express.static('public'));

// Global members array to store all member data
let members = [];

/**
 * Load members from embedded-members.json
 */
function loadMembers() {
  try {
    const filePath = path.join(__dirname, 'public', 'embedded-members.json');
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      members = JSON.parse(fileContent);
      console.log(`Loaded ${members.length} members from embedded-members.json`);
      
      // Verify presence of important accounts
      const hasReserve = members.some(m => m.name === 'TC-S Solar Reserve');
      console.log(`TC-S Solar Reserve present: ${hasReserve}`);
      
      // Create a hardcoded backup if reserve is missing
      if (!hasReserve) {
        console.log('TC-S Solar Reserve is missing from the data, adding it manually');
        
        // Reserve should be first with ID 0
        members.unshift({
          "id": 0,
          "username": "tcs.reserve",
          "name": "TC-S Solar Reserve",
          "joinedDate": "2025-04-07",
          "totalSolar": "10000000000",
          "totalDollars": "1360000000000000",
          "isAnonymous": false,
          "lastDistributionDate": "2025-05-02",
          "isReserve": true
        });
        
        console.log(`After adding reserve: ${members.length} members`);
      }
      
      return true;
    } else {
      console.error('embedded-members.json not found');
      return false;
    }
  } catch (error) {
    console.error('Error loading members:', error.message);
    return false;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send('The Current-See API Server is running');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/members', '/api/members.json', '/embedded-members', '/api/member-count'],
    memberCount: members.length
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// API endpoint for members
app.get('/api/members', (req, res) => {
  console.log(`[/api/members] Returning ${members.length} members (including TC-S Solar Reserve)`);
  res.json(members);
});

// API endpoint for members.json
app.get('/api/members.json', (req, res) => {
  console.log(`[/api/members.json] Returning ${members.length} members (including TC-S Solar Reserve)`);
  res.json(members);
});

// API endpoint for embedded-members
app.get('/embedded-members', (req, res) => {
  console.log(`[/embedded-members] Returning ${members.length} members (including TC-S Solar Reserve)`);
  res.json(members);
});

// API endpoint for member count (this one correctly counts only actual users)
app.get('/api/member-count', (req, res) => {
  const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`[/api/member-count] Returning count: ${userCount}`);
  res.json({ count: userCount });
});

// Make sure all endpoints use the same member data
function ensureConsistentData() {
  if (members.length === 0) {
    console.error('No members loaded. This will cause all endpoints to return empty data.');
    return false;
  }
  
  return true;
}

// Load members data first
if (!loadMembers()) {
  console.error('Failed to load members data');
  process.exit(1);
}

// Make sure all endpoints will return consistent data
if (!ensureConsistentData()) {
  console.error('Data consistency check failed');
  process.exit(1);
}

// Port configuration - use environment variable PORT or default to 3001
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Fixed API server running at http://${HOST}:${PORT}/`);
});