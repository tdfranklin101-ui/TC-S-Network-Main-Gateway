#!/usr/bin/env node

/**
 * Standalone Health Check for Replit Deployments
 * This is a minimal CommonJS file with NO ES module syntax
 */

const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - Request received at ${req.url}`);
  
  // Always respond with 200 OK
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} - Health check server running on port ${PORT}`);
});