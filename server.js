/**
 * The Current-See Minimal Server
 * 
 * This is a simplified server for deployment that only serves static files
 * and health checks. No complex route parameters that could cause path-to-regexp errors.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Constants
const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Set up middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a write stream for logging
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Log function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${isError ? 'ERROR:' : 'INFO:'} ${message}`;
  console.log(entry);
  logFile.write(entry + '\n');
}

// Health check at root path (for Replit deployment)
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ status: 'healthy' });
  }
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Members API endpoint (simple, no parameters)
app.get('/api/members.json', (req, res) => {
  try {
    const membersFile = path.join(__dirname, 'public/embedded-members');
    if (fs.existsSync(membersFile)) {
      const data = fs.readFileSync(membersFile, 'utf8');
      const membersMatch = data.match(/window\.embeddedMembers\s*=\s*(\[.*?\]);/s);
      if (membersMatch && membersMatch[1]) {
        const members = JSON.parse(membersMatch[1]);
        return res.json(members);
      }
    }
    
    // Fallback data if file doesn't exist or can't be parsed
    res.json([
      { id: 1, name: "Terry D. Franklin", joined_date: "2025-04-09", solar_amount: 19 },
      { id: 2, name: "JF", joined_date: "2025-04-10", solar_amount: 18 },
      { id: 3, name: "Davis", joined_date: "2025-04-18", solar_amount: 10 },
      { id: 4, name: "Miles Franklin", joined_date: "2025-04-18", solar_amount: 10 },
      { id: 5, name: "John D", joined_date: "2025-04-26", solar_amount: 2 }
    ]);
  } catch (err) {
    log(`Error in /api/members.json: ${err.message}`, true);
    res.status(500).json({ error: "Server error" });
  }
});

// Solar data API endpoint (simple, no parameters)
app.get('/api/solar-data', (req, res) => {
  try {
    const now = new Date();
    const startDate = new Date('2025-04-07T00:00:00Z');
    const diffSeconds = (now - startDate) / 1000;
    const kwhPerSecond = 483333333.5;
    const totalKwh = diffSeconds * kwhPerSecond;
    const totalMkwh = totalKwh / 1000000;
    const totalValue = (totalKwh / 4913) * 136000;
    
    res.json({
      startDate: startDate.toISOString(),
      currentDate: now.toISOString(),
      secondsRunning: diffSeconds,
      daysRunning: Math.floor(diffSeconds / 86400),
      totalKwh: totalKwh,
      totalMkwh: totalMkwh.toFixed(6),
      totalValue: totalValue.toFixed(2),
      formattedValue: new Intl.NumberFormat('en-US', {
        style: 'currency', 
        currency: 'USD'
      }).format(totalValue)
    });
  } catch (err) {
    log(`Error in /api/solar-data: ${err.message}`, true);
    res.status(500).json({ error: "Server error" });
  }
});

// Catchall route - serve index.html without route parameters
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`=== The Current-See Minimal Server ===`);
  log(`Server running on http://0.0.0.0:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export server for testing
module.exports = server;