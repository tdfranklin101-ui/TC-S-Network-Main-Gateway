// Minimal CommonJS Server - No ESM imports at all
const http = require('http');
const path = require('path');
const fs = require('fs');

// Constants
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

// Simple file server - no ESM modules
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Root health check
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<html><body><h1>Server is running</h1></body></html>');
  }
  
  // Health check endpoint
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Parse URL to get the path
  let filePath = './public' + req.url;
  if (filePath.endsWith('/')) {
    filePath += 'index.html';
  }

  // Get the file extension
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'text/plain';

  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        fs.readFile('./public/index.html', (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Error: ' + err.code);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end('Error: ' + err.code);
      }
      return;
    }

    // Success
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});