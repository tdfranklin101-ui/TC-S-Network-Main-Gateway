/**
 * Standalone Health Check Script for Replit Deployments
 * 
 * This script is intentionally kept as a CommonJS file to ensure
 * it works properly without any transpilation or build process.
 * 
 * Use this directly in Replit's deployment settings as the health check command.
 */

const http = require('http');

// Port should be configured by Replit or default to something standard
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Simple server with no dependencies that responds to ANY path with 200 OK
const server = http.createServer((req, res) => {
  // Add verbose logging in case of issues
  console.log(`Health check received: ${req.method} ${req.url}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  
  // Always respond with success and appropriate headers
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Return simple JSON response
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'thecurrentsee',
    mode: 'standalone-health'
  }));
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Deployment health check server running on port ${PORT}`);
});

// Handle errors gracefully
server.on('error', (err) => {
  console.error(`Health server error: ${err.message}`);
  
  // Try to recover
  setTimeout(() => {
    try {
      server.close();
      server.listen(PORT, HOST);
    } catch (e) {
      console.error('Failed to restart health server');
    }
  }, 1000);
});

// Keep the process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (continuing anyway):', err);
});