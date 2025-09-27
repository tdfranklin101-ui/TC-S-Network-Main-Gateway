#!/usr/bin/env node

/**
 * Standalone Health Check for Replit Cloud Run
 * 
 * This is a minimal health check script specifically designed for
 * Replit Cloud Run deployments to address the issues shown in your screenshot:
 * 1. Responding to requests on the root path
 * 2. Handling port 3000 properly
 * 3. Implementing proper health check for Cloud Run
 */

const http = require('http');

// Explicitly use port 3000 as required by Replit Cloud Run
const PORT = 3000;
const HOST = '0.0.0.0';

console.log(`Starting Cloud Run health check server on port ${PORT}...`);

const server = http.createServer((req, res) => {
  console.log(`[CLOUD RUN HEALTH] ${req.method} ${req.url}`);
  
  // Set required headers for Cloud Run health checks
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'close'
  });
  
  // Send a simple OK response
  res.end(JSON.stringify({
    status: 'ok',
    service: 'thecurrentsee',
    timestamp: new Date().toISOString()
  }));
});

// Start server with specific error handling for Cloud Run
server.listen(PORT, HOST, () => {
  console.log(`Cloud Run health check server running at http://${HOST}:${PORT}/`);
});

// Handle potential errors without crashing
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  
  // If the port is already in use, try to handle gracefully
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use, health check may be running elsewhere`);
  }
});

// Keep the process running no matter what
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});