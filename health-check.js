/**
 * Standalone Health Check for Replit Deployments
 * This is a minimal health check that always returns 200 OK
 */

const http = require('http');
const PORT = process.env.PORT || 3000;

console.log(`Health check running on port ${PORT}...`);

// Create a minimal HTTP server that responds 200 OK to ALL requests
http.createServer((req, res) => {
  console.log(`Health check received: ${req.method} ${req.url}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Always respond with 200 OK
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'The Current-See',
    timestamp: new Date().toISOString()
  }));
}).listen(PORT, '0.0.0.0');