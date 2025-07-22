#!/usr/bin/env node

/**
 * Replit Health Check Handler
 * 
 * This is a standalone health check script that handles Replit Cloud Run health checks
 * by responding to ALL requests on port 3000 with a 200 OK status.
 */

const http = require('http');

// Use port 3000 as required by Replit deployments
const PORT = 3000;
const HOST = '0.0.0.0';

console.log('Starting Replit health check handler on port 3000...');

// Create a simple standalone health check server
const server = http.createServer((req, res) => {
  // Log the request for debugging
  const userAgent = req.headers['user-agent'] || 'unknown';
  console.log(`Health check request: ${req.method} ${req.url} (${userAgent})`);
  
  // Always respond with 200 OK regardless of path
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store'
  });
  
  // Send a simple JSON response
  res.end(JSON.stringify({
    status: 'ok',
    service: 'thecurrentsee',
    url: req.url,
    timestamp: new Date().toISOString()
  }));
});

// Start the server with error handling
server.listen(PORT, HOST, () => {
  console.log(`Replit health check handler running at http://${HOST}:${PORT}/`);
});

// Handle server errors gracefully
server.on('error', (err) => {
  console.error(`Health check server error: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use, health check may already be running elsewhere`);
    
    // Try a different port for diagnostic purposes only
    const diagnosticPort = PORT + 1000;
    const diagnosticServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Health check diagnostic server');
    });
    
    diagnosticServer.listen(diagnosticPort, HOST, () => {
      console.log(`Diagnostic server running on port ${diagnosticPort}`);
    });
  }
});

// Keep the process running under all circumstances
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${err.message}`);
  // Don't exit
});

process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${reason}`);
  // Don't exit
});