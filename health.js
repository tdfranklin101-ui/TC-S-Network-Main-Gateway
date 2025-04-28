/**
 * Simple Health Check Server for Replit Deployments
 * 
 * This standalone server responds to health checks on port 3000
 * which is what Replit expects for deployments.
 */

const http = require('http');

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  // Log request details
  console.log(`Health check received: ${req.method} ${req.url}`);
  
  // Respond with 200 OK
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'The Current-See health check passed'
  }));
});

// Listen on port 3000 (Replit's default deployment port)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${PORT}`);
});