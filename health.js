/**
 * The Current-See Deployment Health Check
 * 
 * This file is a simple health check for the Replit deployment.
 * It will respond to HTTP requests with a 200 OK status.
 */

const http = require('http');

// Create health check server
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    app: 'The Current-See',
    api_endpoints: [
      '/api/members.json',
      '/api/distribution-ledger',
      '/api/solar-clock'
    ]
  }));
});

// Listen on the port provided by Replit or fallback to 3001
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Health check server running at http://${HOST}:${PORT}/`);
});

// Log any errors
server.on('error', (err) => {
  console.error('Health check server error:', err);
});