/**
 * Standalone Health Check for Replit Deployments
 * This is a minimal CommonJS file with NO ES module syntax
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  console.log(`[HEALTH] ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

server.listen(PORT, HOST, () => {
  console.log(`Health check server running on http://${HOST}:${PORT}/`);
});