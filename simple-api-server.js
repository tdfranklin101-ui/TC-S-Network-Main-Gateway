/**
 * The Current-See Simple API Server
 * 
 * This server provides just the essential API endpoints and health checks
 * needed to validate our members data is displaying correctly
 */

const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static('public'));

// Load members from embedded-members.json
let members = [];
try {
  const filePath = path.join(__dirname, 'public', 'embedded-members.json');
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    members = JSON.parse(fileContent);
    console.log(`Loaded ${members.length} members from embedded-members.json`);
    console.log(`TC-S Solar Reserve present: ${members.some(m => m.name === 'TC-S Solar Reserve')}`);
  } else {
    console.error('embedded-members.json not found');
  }
} catch (error) {
  console.error('Error loading members:', error.message);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send('API Server is running');
});

// API endpoints
app.get('/api/members', (req, res) => {
  console.log(`Returning ${members.length} members from /api/members`);
  // This endpoint is working correctly
  res.json(members);
});

app.get('/api/members.json', (req, res) => {
  console.log(`Returning ${members.length} members from /api/members.json`);
  // This endpoint isn't returning all members
  // DEBUG: Check for filtering or data manipulation in current implementation
  // Force it to return the full members array
  const fullMembersList = JSON.parse(JSON.stringify(members));
  console.log(`Verified array contains ${fullMembersList.length} members with TC-S Reserve: ${fullMembersList.some(m => m.name === 'TC-S Solar Reserve')}`);
  res.json(fullMembersList);
});

app.get('/embedded-members', (req, res) => {
  console.log(`Returning ${members.length} members from /embedded-members`);
  // This endpoint isn't returning all members
  // DEBUG: Check for filtering or data manipulation in current implementation
  // Force it to return the full members array
  const fullMembersList = JSON.parse(JSON.stringify(members));
  console.log(`Verified array contains ${fullMembersList.length} members with TC-S Reserve: ${fullMembersList.some(m => m.name === 'TC-S Solar Reserve')}`);
  res.json(fullMembersList);
});

app.get('/api/member-count', (req, res) => {
  const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`Returning member count: ${userCount}`);
  res.json({ count: userCount });
});

// Start the server on Replit port
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple API server running on http://0.0.0.0:${PORT}/`);
});