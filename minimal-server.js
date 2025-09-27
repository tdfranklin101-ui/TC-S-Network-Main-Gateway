const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('Starting minimal server...');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.end(JSON.stringify({
    status: 'working',
    timestamp: new Date().toISOString(),
    url: req.url
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${PORT}`);
});