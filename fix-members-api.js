/**
 * Quick fix for The Current-See API endpoints
 * Focusing on fixing the endpoints that need to return all members
 */

// Import required modules
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

// Configure
const PORT = 3001;
const HOST = '0.0.0.0';

// Create Express app
const app = express();

// Configure CORS
app.use(cors());

// Configure body parsing and static file serving
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Get all members directly from embedded-members.json file
function loadMembersFromFile() {
  try {
    console.log('Loading members from embedded-members.json file');
    const membersData = fs.readFileSync('./public/embedded-members.json', 'utf8');
    const members = JSON.parse(membersData);
    console.log(`Successfully loaded ${members.length} members from file`);
    
    // Verify TC-S Solar Reserve is present
    const hasReserve = members.some(m => m.name === 'TC-S Solar Reserve');
    console.log(`TC-S Solar Reserve is ${hasReserve ? 'present' : 'missing'}`);
    
    return members;
  } catch (error) {
    console.error(`Error loading members: ${error.message}`);
    return [];
  }
}

// Load members once at startup
const members = loadMembersFromFile();

// API endpoints that return all members
app.get('/api/members.json', (req, res) => {
  console.log(`Returning all ${members.length} members from /api/members.json endpoint`);
  res.json(members);
});

app.get('/api/members', (req, res) => {
  console.log(`Returning all ${members.length} members from /api/members endpoint`);
  res.json(members);
});

app.get('/embedded-members', (req, res) => {
  console.log(`Returning all ${members.length} members from /embedded-members endpoint`);
  res.json(members);
});

// Member count endpoint
app.get('/api/member-count', (req, res) => {
  // Count only non-reserve members (historical behavior)
  const count = members.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`Returning member count: ${count}`);
  res.json({ count });
});

// Health check endpoints
app.get('/', (req, res) => {
  res.send('The Current-See Server is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Members API server running at http://${HOST}:${PORT}/`);
});