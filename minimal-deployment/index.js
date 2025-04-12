// Ultra-minimal health check server
// This uses ONLY CommonJS syntax and has NO file dependencies

const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - Request received at ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} - Server running on port ${PORT}`);
});