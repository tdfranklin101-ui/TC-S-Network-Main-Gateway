/**
 * Super Simple Health Check for Replit Deployments
 * 
 * This minimal file does exactly ONE thing: responds with 200 OK to ANY request
 * It's designed to be the PRIMARY entry point for Replit deployments
 */

const http = require('http');

// Create a server that responds with 200 OK to any request
const server = http.createServer((req, res) => {
  // Log incoming requests
  console.log(`${new Date().toISOString()} - Health check request received at ${req.url}`);
  
  // Always respond with 200 OK to any request
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Start the server on port 3000 (Replit's expected port)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} - Super simple health check server running on port ${PORT}`);
});