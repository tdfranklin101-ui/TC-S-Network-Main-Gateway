// Simple standalone server for deployment - NO ESM syntax, pure CommonJS
const http = require('http');
const fs = require('fs');
const path = require('path');

// Constants
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// MIME types
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
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Health check endpoints
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/health-check') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  
  // Normalize the URL
  let url = req.url;
  
  // Handle root path
  if (url === '/') {
    url = '/index.html';
  }
  
  // Remove query parameters
  url = url.split('?')[0];
  
  // Build the file path
  const filePath = path.join(__dirname, 'public', url);
  const extname = path.extname(filePath).toLowerCase();
  
  // Check if the file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // File not found, try to serve index.html
      if (url !== '/index.html') {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        fs.stat(indexPath, (err, stats) => {
          if (err || !stats.isFile()) {
            // If index.html not found, return 200 OK with a simple message
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end('<html><body><h1>The Current-See</h1><p>Welcome to the service.</p></body></html>');
          } else {
            // Serve index.html instead
            fs.readFile(indexPath, (err, content) => {
              if (err) {
                res.writeHead(500);
                return res.end('Server Error');
              }
              res.writeHead(200, { 'Content-Type': 'text/html' });
              return res.end(content);
            });
          }
        });
      } else {
        // If index.html was requested but not found
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body><h1>The Current-See</h1><p>Welcome to the service.</p></body></html>');
      }
      return;
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      
      // Get content type
      const contentType = MIME_TYPES[extname] || 'text/plain';
      
      // Send the response
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(content);
    });
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

// Handle server errors
server.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
});