#!/usr/bin/env node

/**
 * Minimal Health Check Script
 * 
 * This is a dedicated health check script for Replit deployments.
 * It's intentionally bare-bones with no dependencies to ensure reliability.
 */

const http = require('http');

// Use port 3000 as required by Replit deployments
const PORT = 3000;
const HOST = '0.0.0.0';

console.log(`Starting minimal health check server on port ${PORT}...`);

const server = http.createServer((req, res) => {
  // Log request for debugging
  console.log(`[HEALTH CHECK] ${req.method} ${req.url}`);
  
  // Respond to ALL paths with 200 OK
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'close'
  });
  
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    path: req.url
  }));
});

// Start server and handle errors gracefully
server.listen(PORT, HOST, () => {
  console.log(`Health check server running at http://${HOST}:${PORT}/`);
});

// Handle potential errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});