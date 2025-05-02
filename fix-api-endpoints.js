/**
 * The Current-See API Endpoint Fix
 * 
 * This script specifically fixes all API endpoints to ensure they
 * consistently return the complete members list including the TC-S Solar Reserve.
 * 
 * Run with: node fix-api-endpoints.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Create Express application
const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Serve static files from public directory
app.use(express.static('public'));

console.log('Starting API endpoint fix');

// Load members from the embedded JSON file
const embeddedMembersPath = path.join(__dirname, 'public', 'embedded-members.json');
let allMembers = [];

try {
  const fileData = fs.readFileSync(embeddedMembersPath, 'utf8');
  allMembers = JSON.parse(fileData);
  console.log(`Successfully loaded ${allMembers.length} members from embedded-members.json`);
  
  const hasReserve = allMembers.some(m => m.name === 'TC-S Solar Reserve');
  console.log(`TC-S Solar Reserve present: ${hasReserve}`);
  
  if (!hasReserve) {
    console.warn('TC-S Solar Reserve is missing! Adding it manually.');
    allMembers.unshift({
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
  }
} catch (error) {
  console.error('Error loading embedded members:', error);
  process.exit(1);
}

// Basic endpoint to check if server is running
app.get('/', (req, res) => {
  res.send('The Current-See API Fix Server');
});

// Standard health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    membersCount: allMembers.length
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Primary API endpoint - returns all members including TC-S Solar Reserve
app.get('/api/members', (req, res) => {
  console.log(`[${new Date().toISOString()}] Serving /api/members (${allMembers.length} members)`);
  res.json(allMembers);
});

// Secondary API endpoint - also returns all members
app.get('/api/members.json', (req, res) => {
  console.log(`[${new Date().toISOString()}] Serving /api/members.json (${allMembers.length} members)`);
  res.json(allMembers);
});

// Embedded members endpoint - returns all members
app.get('/embedded-members', (req, res) => {
  console.log(`[${new Date().toISOString()}] Serving /embedded-members (${allMembers.length} members)`);
  res.json(allMembers);
});

// Member count endpoint - returns count of user members (excluding reserve account)
app.get('/api/member-count', (req, res) => {
  const userCount = allMembers.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`[${new Date().toISOString()}] Serving /api/member-count (${userCount} user members)`);
  res.json({ count: userCount });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fixed API server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  /api/members');
  console.log('  /api/members.json');
  console.log('  /embedded-members');
  console.log('  /api/member-count');
});