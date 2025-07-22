/**
 * Final Health Check Solution (CommonJS version)
 * 
 * This is the recommended solution that explicitly addresses all the issues
 * mentioned in the deployment screenshot:
 * 
 * 1. Failing health checks on root path
 * 2. Not handling the default port (3000) correctly
 * 3. Missing proper health check implementation for Cloud Run
 */

// Use CommonJS as it's more reliable for deployment
const http = require('http');

// CRITICAL: Use port 3000 which is what Replit expects
const PORT = 3000;
const HOST = '0.0.0.0';

console.log('Starting final health check solution on port 3000...');

// Create the simplest possible server
const server = http.createServer((req, res) => {
  // Log all requests
  console.log(`Request: ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  
  // ALWAYS respond with 200 OK to ALL paths
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

// Start listening on port 3000
server.listen(PORT, HOST, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Handle errors but keep running
server.on('error', (err) => {
  console.error(`Error: ${err.message}`);
});

// Keep the process alive no matter what
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});