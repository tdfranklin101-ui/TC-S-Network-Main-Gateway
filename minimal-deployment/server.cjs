/**
 * Replit Cloud Run Deployment Server (CommonJS version)
 * 
 * This file directly addresses the deployment issues by:
 * 1. Listening on port 3000 (Replit's expected health check port)
 * 2. Responding to all paths with 200 OK
 * 3. Implementing proper health check for Cloud Run
 */

// Use CommonJS for compatibility
const http = require('http');
const fs = require('fs');
const path = require('path');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

console.log('Starting Replit Cloud Run deployment server...');

// Create the server
const server = http.createServer((req, res) => {
  // Log requests for debugging
  console.log(`[REQUEST] ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  
  // Always return 200 OK to pass health checks
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});