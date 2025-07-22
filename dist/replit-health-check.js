#!/usr/bin/env node

/**
 * Standalone Health Check for Replit Deployments
 * 
 * This is a minimal, dedicated health check script designed
 * to provide maximum reliability for Replit Cloud Run deployments.
 * It specifically handles port 3000 and responds to the root path.
 */

const http = require('http');

// Use port 3000 which is required by Replit Cloud Run
const PORT = 3000;
const HOST = '0.0.0.0';

// Create a simple server that responds to ALL requests with 200 OK
console.log(`Starting Replit Cloud Run health check server on port ${PORT}...`);

const server = http.createServer((req, res) => {
  console.log(`Health check request received: ${req.method} ${req.url}`);
  
  // Set proper headers for health check response
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'close'
  });
  
  // Send a simple JSON response
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    path: req.url
  }));
});

// Start server and handle errors gracefully
server.listen(PORT, HOST, () => {
  console.log(`Replit Cloud Run health check server running at http://${HOST}:${PORT}/`);
});

// Handle server errors without crashing
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});

// Keep the process running no matter what
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});