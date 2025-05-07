/**
 * The Current-See Deployment-Ready Server
 * 
 * This file includes all the necessary components for a successful deployment:
 * 1. Health checks responding to the root path (/)
 * 2. Static file serving for the public directory
 * 3. API endpoints with proper CORS handling
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const serveStatic = require('serve-static');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(cors());
app.use(express.json());

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Health check endpoint for Replit deployments
app.get('/', (req, res) => {
  res.status(200).send('The Current-See Server is running correctly');
});

// Health check for Replit cloud
app.get('/health', (req, res) => {
  res.status(200).send('Healthy');
});

// Health check for additional compatibility
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the public directory
app.use(serveStatic(path.join(__dirname, 'public'), {
  index: ['index.html'],
  setHeaders: (res, filePath) => {
    // Set cache control headers for static assets
    if (filePath.endsWith('.html')) {
      // Don't cache HTML files
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      // Cache static assets for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// API endpoint to verify member data is accessible
app.get('/api/check-members', (req, res) => {
  try {
    const membersFilePath = path.join(__dirname, 'public', 'api', 'members.json');
    if (fs.existsSync(membersFilePath)) {
      const membersData = JSON.parse(fs.readFileSync(membersFilePath, 'utf8'));
      res.json({ 
        success: true, 
        memberCount: membersData.length,
        message: 'Members data is accessible'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Members file not found'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error accessing members data',
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  log(`Health check available at http://localhost:${PORT}/healthz`);
  log(`Main application at http://localhost:${PORT}/`);
});