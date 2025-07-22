// Root path health check handler
const http = require('http');
const PORT = 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
});
server.listen(PORT, '0.0.0.0');
console.log('Root health check server running on port ' + PORT);
