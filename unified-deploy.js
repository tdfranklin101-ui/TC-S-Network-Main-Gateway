/**
 * Unified Deployment Server for The Current-See
 * 
 * This script handles both the website serving and health checks
 * in a single process to ensure deployment reliability.
 */

// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const serveStatic = require('serve-static');
const cors = require('cors');

// Configuration
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(__dirname, 'public', 'includes');

// Initialize express app
const app = express();

// Enable CORS
app.use(cors());

// Custom logging function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Function to inject header and footer
function injectHeaderAndFooter(html) {
  try {
    // Read header and footer
    const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
    const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
    
    // Replace placeholder comment with actual header/footer
    html = html.replace('<!-- HEADER_PLACEHOLDER -->', header);
    html = html.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    
    return html;
  } catch (error) {
    log(`Error injecting header/footer: ${error.message}`);
    return html;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Root health check for Replit deployments
app.get('/', (req, res, next) => {
  // If this is a health check from Replit (no user agent)
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  next();
});

// Middleware to handle HTML file includes
app.use((req, res, next) => {
  // Only intercept HTML files
  if (!req.path.endsWith('.html') && req.path !== '/') {
    return next();
  }
  
  // Store original send function
  const originalSend = res.send;
  
  // Override send method to inject includes for HTML responses
  res.send = function(body) {
    // Only process HTML content
    if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
      body = injectHeaderAndFooter(body);
    }
    
    // Call original send with modified body
    return originalSend.call(this, body);
  };
  
  next();
});

// Static file serving
app.use(serveStatic(PUBLIC_DIR, {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
}));

// Default route handler for SPA-like behavior
app.get('*', (req, res) => {
  // Check if the path has an extension
  if (path.extname(req.path) === '') {
    // No extension, try to serve the HTML file with the same name
    const htmlPath = path.join(PUBLIC_DIR, `${req.path}.html`);
    
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
    
    // If no matching HTML file, serve index.html
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  
  // 404 for files with extensions that don't exist
  res.status(404).send('Not found');
});

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(PORT, () => {
  log(`The Current-See server listening on port ${PORT}`);
  log(`Serving static files from: ${PUBLIC_DIR}`);
  log(`Including header/footer from: ${INCLUDES_DIR}`);
});

// Handle server errors
server.on('error', (error) => {
  log(`Server error: ${error.message}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    log('Server closed.');
    process.exit(0);
  });
});

// Make the server available for testing
module.exports = server;