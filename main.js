// The Current-See Production Server - Deployment Ready
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

console.log('🚀 Starting The Current-See Production Server...');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Current-See Production',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      port: PORT
    }));
    return;
  }

  // Homepage
  if (pathname === '/') {
    try {
      const indexPath = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Current-See Platform</h1><p>Production server running</p>');
      }
    } catch (error) {
      console.error('Homepage error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
    }
    return;
  }

  // Member API
  if (pathname === '/api/members') {
    try {
      const membersPath = path.join(__dirname, 'api', 'members.json');
      if (fs.existsSync(membersPath)) {
        const data = fs.readFileSync(membersPath, 'utf8');
        const members = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          members: members,
          totalMembers: members.length,
          status: 'operational'
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ members: [], totalMembers: 0 }));
      }
    } catch (error) {
      console.error('Members API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Members API unavailable' }));
    }
    return;
  }

  // Static file serving
  try {
    let filePath = path.join(__dirname, 'public', pathname);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg'
      }[ext] || 'application/octet-stream';
      
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
      return;
    }
  } catch (error) {
    console.error('Static file error:', error);
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

// Start server
server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  
  console.log('🚀 THE CURRENT-SEE PRODUCTION SERVER');
  console.log(`📡 Server: http://0.0.0.0:${PORT}`);
  console.log('🤖 Console Solar: Ready for deployment');
  console.log('✅ DEPLOYMENT READY');
});