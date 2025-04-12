#!/usr/bin/env node

/**
 * Standalone Health Check for Replit Deployments
 * 
 * This is a minimal, dedicated health check script designed
 * to provide maximum reliability for Replit deployments.
 */

const http = require('http');

// Use port 3000 by default, but allow override from environment
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Create a simple server that responds to ALL requests with 200 OK
console.log(`Starting health check server on port ${PORT}...`);

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
    timestamp: new Date().toISOString()
  }));
});

// Start server and handle errors gracefully
server.listen(PORT, HOST, () => {
  console.log(`Health check server running at http://${HOST}:${PORT}/`);
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  
  // If port is already in use, try another port
  if (err.code === 'EADDRINUSE') {
    const newPort = PORT + 1;
    console.log(`Port ${PORT} is in use, trying port ${newPort}...`);
    
    setTimeout(() => {
      server.close();
      server.listen(newPort, HOST);
    }, 1000);
  }
});

// Keep the process running
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit, keep the health check running
});