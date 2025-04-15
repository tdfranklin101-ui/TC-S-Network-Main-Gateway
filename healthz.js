/**
 * Standalone Health Check for Replit Deployments
 * This is a minimal CommonJS file with NO ES module syntax
 */

const http = require('http');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3000;
const LOG_FILE = 'health.log';

// Log to file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Create a very simple HTTP server that always responds with 200 OK
const server = http.createServer((req, res) => {
  // Log all incoming requests
  log(`Health check request: ${req.method} ${req.url}`);
  
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.writeHead(204);
    res.end();
    return;
  }
  
  // All other requests get a 200 OK response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'The Current-See Health Check',
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`Health check server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down health check server...');
  server.close(() => {
    log('Health check server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down health check server...');
  server.close(() => {
    log('Health check server closed');
    process.exit(0);
  });
});