/**
 * The Current-See Deployment Server
 * 
 * Simplified server for deployment with robust error handling
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Setup middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR:' : '✓ INFO:';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  log('Health check requested');
  res.status(200).send('OK');
});

// Root path health check for deployment
app.get('/', (req, res, next) => {
  // If it's a health check (no user agent), just return OK
  if (!req.headers['user-agent']) {
    log('Root health check requested');
    return res.status(200).send('OK');
  }
  
  // For regular users, serve the index.html
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    log('Index file not found', true);
    res.status(404).send('Not Found');
  }
});

// Handle API requests for embedded members data
app.get('/embedded-members', (req, res) => {
  try {
    log('Embedded members data requested');
    const membersPath = path.join(PUBLIC_DIR, 'api', 'members.json');
    
    if (fs.existsSync(membersPath)) {
      const membersData = fs.readFileSync(membersPath, 'utf8');
      const members = JSON.parse(membersData);
      
      // Format the response as JavaScript 
      const formattedMembers = members.map(member => {
        const formatted = {...member};
        if (typeof formatted.totalSolar !== 'undefined') {
          formatted.totalSolar = parseFloat(formatted.totalSolar).toFixed(4);
        }
        return formatted;
      });
      
      res.set('Content-Type', 'application/javascript');
      res.send(`window.embeddedMembers = ${JSON.stringify(formattedMembers)};`);
    } else {
      log('Members data file not found', true);
      res.status(404).send('Not Found');
    }
  } catch (error) {
    log(`Error serving embedded members: ${error.message}`, true);
    res.status(500).send('Server Error');
  }
});

// Serve static files from the public directory
app.use(express.static(PUBLIC_DIR));

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  log(`=== The Current-See Deployment Server ===`);
  log(`Server running on http://0.0.0.0:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Serving files from: ${PUBLIC_DIR}`);
});