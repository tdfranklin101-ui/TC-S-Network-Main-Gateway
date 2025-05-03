/**
 * Ultra-Minimal Deployment Server for The Current-See
 * 
 * This is an extremely simplified server that avoids any potential channel conflicts.
 * It uses no external dependencies and only Node.js built-in modules.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Set port from environment or default to 3000 (Replit standard)
const PORT = process.env.PORT || 3000;

// Simple mime-type mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

// Create the server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Health checks
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Handle root path
  let filePath = req.url === '/' 
    ? path.join(process.cwd(), 'public', 'index.html')
    : path.join(process.cwd(), 'public', req.url);
    
  // Clean up the path to prevent directory traversal attacks
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  
  // Get file extension for content-type
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Send the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      // If not found, try as an API endpoint
      if (req.url.startsWith('/api/')) {
        try {
          // Handle API requests
          if (req.url.includes('/api/members.json')) {
            const membersPath = path.join(process.cwd(), 'public', 'api', 'members.json');
            fs.readFile(membersPath, (err, data) => {
              if (err) {
                res.writeHead(500);
                res.end('Error reading members data');
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
              }
            });
            return;
          }
          
          if (req.url.includes('/api/member-count')) {
            const membersPath = path.join(process.cwd(), 'public', 'api', 'members.json');
            fs.readFile(membersPath, (err, data) => {
              if (err) {
                res.writeHead(500);
                res.end('Error reading members data');
              } else {
                let count = 0;
                try {
                  const members = JSON.parse(data);
                  count = members.length || 0;
                } catch (e) {
                  console.error('Error parsing members JSON:', e);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ count }));
              }
            });
            return;
          }
          
          // Default API response if no specific handler
          res.writeHead(404);
          res.end('API endpoint not found');
        } catch (e) {
          console.error('API error:', e);
          res.writeHead(500);
          res.end('Server error processing API request');
        }
      } else {
        // For regular 404s
        res.writeHead(404);
        res.end(`File not found: ${req.url}`);
      }
    } else {
      // Success - return the file
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Ultra-minimal deployment server running on http://0.0.0.0:${PORT}`);
  console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log the port for documentation
  console.log(`[${new Date().toISOString()}] Listening on port ${PORT}`);

  // Try to load members file - useful for debugging
  try {
    const membersPath = path.join(process.cwd(), 'public', 'api', 'members.json');
    if (fs.existsSync(membersPath)) {
      console.log(`[${new Date().toISOString()}] Found members data file`);
    } else {
      console.log(`[${new Date().toISOString()}] Members data file not found at ${membersPath}`);
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Error checking members file:`, e.message);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down gracefully`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
});