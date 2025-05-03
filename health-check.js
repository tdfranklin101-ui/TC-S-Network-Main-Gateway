/**
 * Health Check for The Current-See Deployment
 * 
 * This is a minimal health check script specifically designed for
 * Replit Cloud Run deployments.
 */

const http = require('http');

const PORT = process.env.PORT || 3000;

// Create a simple HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // For any other route, return a 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${PORT}`);
});