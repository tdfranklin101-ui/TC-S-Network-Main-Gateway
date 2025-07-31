const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'CORRECT VERSION LOADED',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<h1>Current-See Platform - CORRECT VERSION LOADED</h1>');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TEST SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 CORRECT VERSION CONFIRMED LOADED`);
});