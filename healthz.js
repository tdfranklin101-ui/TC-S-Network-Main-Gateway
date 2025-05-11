/**
 * Standalone Health Check for Replit Deployments
 * This is a minimal CommonJS file with NO ES module syntax
 */

const http = require('http');
const port = process.env.PORT || 8080;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const server = http.createServer((req, res) => {
  log(`Health check received at ${req.url}`);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('OK');
});

server.listen(port, () => {
  log(`Health check server running on port ${port}`);
});
