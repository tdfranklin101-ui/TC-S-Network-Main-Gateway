/**
 * The Current-See Fixed Deployment Entry Point
 * 
 * This file is specifically designed to fix the
 * "Channel already opened" error during deployment.
 */

// Import required modules without using channels
const http = require('http');
const fs = require('fs');
const path = require('path');

// Define the port to listen on
const PORT = process.env.PORT || 3000;

// MIME types for serving static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Log information to the console
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Create the HTTP server
const server = http.createServer((req, res) => {
  log(`${req.method} ${req.url}`);

  // Special handling for root path - serve index.html
  if (req.url === '/') {
    serveFile(res, './public/index.html');
    return;
  }

  // Special handling for health check
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // API endpoint for system status
  if (req.url === '/api/system/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'operational',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      hasDatabase: !!process.env.CURRENTSEE_DB_URL,
      hasOpenAI: !!(process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY)
    }));
    return;
  }
  
  // API endpoint for member count
  if (req.url.startsWith('/api/member-count')) {
    // Check if we can access the members.json file
    fs.readFile('./public/api/members.json', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: 1, timestamp: new Date().toISOString() }));
        return;
      }
      
      try {
        const members = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          count: Array.isArray(members) ? members.length : 1,
          timestamp: new Date().toISOString()
        }));
      } catch (parseError) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: 1, timestamp: new Date().toISOString() }));
      }
    });
    return;
  }

  // Try to serve the file from the public directory
  const filePath = path.join('./public', req.url);
  
  // Check if the file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If the file doesn't exist, try to serve index.html for client-side routing
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        serveFile(res, './public/index.html');
      } else {
        // Return 404 for non-HTML requests
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
      return;
    }

    // Serve the file
    serveFile(res, filePath);
  });
});

// Helper function to serve a file
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    // Set cache control headers for better performance
    const headers = {
      'Content-Type': contentType
    };
    
    // Add cache control for non-JS files
    if (!ext.includes('.js') && !ext.includes('.json')) {
      headers['Cache-Control'] = 'public, max-age=86400'; // 1 day
    } else {
      // No caching for JS and JSON files
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    
    res.writeHead(200, headers);
    res.end(data);
  });
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`Fixed deployment server running on http://0.0.0.0:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});