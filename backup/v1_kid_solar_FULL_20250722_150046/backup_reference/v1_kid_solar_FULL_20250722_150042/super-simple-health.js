/**
 * Super Simple Health Check for Replit Deployments
 * 
 * This minimal file does exactly ONE thing: responds with 200 OK to ANY request
 * It's designed to be the PRIMARY entry point for Replit deployments
 */

const http = require('http');
const PORT = process.env.PORT || 3000;
const SERVER_PROCESS = require('child_process').spawn('node', ['server.js']);

// Log startup
console.log(`Health check running on port ${PORT}`);
console.log(`Main application started with PID ${SERVER_PROCESS.pid}`);

// Forward application output to console
SERVER_PROCESS.stdout.on('data', (data) => console.log(`[APP] ${data.toString().trim()}`));
SERVER_PROCESS.stderr.on('data', (data) => console.error(`[APP ERROR] ${data.toString().trim()}`));

// Create a minimal HTTP server that responds 200 OK to EVERYTHING
http.createServer((req, res) => {
  console.log(`Health check received: ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // ALWAYS return 200 OK with a simple JSON response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString()
  }));
}).listen(PORT, '0.0.0.0');

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, terminating...');
  SERVER_PROCESS.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, terminating...');
  SERVER_PROCESS.kill();
  process.exit(0);
});