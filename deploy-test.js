// Minimal deployment test server
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('Starting minimal deployment test...');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'Deployment test server running',
      timestamp: new Date().toISOString(),
      port: PORT
    }));
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`
      <html>
        <head><title>Current-See Deployment Test</title></head>
        <body>
          <h1>Current-See Platform - Deployment Test</h1>
          <p>Server is running on port ${PORT}</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <a href="/health">Health Check</a>
        </body>
      </html>
    `);
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Test server running on http://0.0.0.0:${PORT}`);
  console.log('Deployment test server ready');
});