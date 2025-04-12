/**
 * Minimal Health Check Script
 * 
 * This is a dedicated health check script for Replit deployments.
 * It's intentionally bare-bones with no dependencies to ensure reliability.
 */

const http = require('http');
const PORT = process.env.PORT || 3333;

// Create the simplest possible server that responds with 200 to everything
const server = http.createServer((req, res) => {
  // Log the request for debugging
  console.log(`Health check request: ${req.method} ${req.url}`);
  
  // Set headers to indicate this is a JSON response
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  
  // Send the simplest valid JSON response
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on http://0.0.0.0:${PORT}`);
});

// Keep the process running
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (continuing anyway):', err);
});