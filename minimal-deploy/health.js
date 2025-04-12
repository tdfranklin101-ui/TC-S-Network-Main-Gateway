// Super simple health check - pure CommonJS
const http = require('http');
const PORT = process.env.PORT || 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});
server.listen(PORT, '0.0.0.0');
console.log('Health check server running on port ' + PORT);
