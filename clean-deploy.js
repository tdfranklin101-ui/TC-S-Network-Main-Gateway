/**
 * Clean Deployment Server for The Current-See
 * 
 * A minimal server implementation for clean deployment
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'The Current-See',
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add health check for deployment verification
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Add API endpoint just to test endpoint routing
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Fallback handler for SPA routing
app.get('*', (req, res) => {
  // Check if the request is for an HTML file or a URL path
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // If the file exists, serve it directly
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    // Otherwise, serve index.html for client-side routing
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // For non-HTML requests (like API calls), return 404
    res.status(404).json({ error: 'Not found' });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Current date: ${new Date().toISOString()}`);
});