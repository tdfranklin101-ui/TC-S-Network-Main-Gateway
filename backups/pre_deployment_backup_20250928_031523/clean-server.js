const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf'
};

function serveFile(res, filePath, contentType) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Current-See Clean Server',
      version: '1.0.0',
      port: PORT
    }));
    return;
  }

  // Homepage route
  if (pathname === '/') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    serveFile(res, indexPath, 'text/html');
    return;
  }

  // API endpoints
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/members') {
      try {
        const membersDataPath = path.join(__dirname, 'api', 'members.json');
        const membersData = JSON.parse(fs.readFileSync(membersDataPath, 'utf8'));
        
        const response = {
          members: membersData,
          totalMembers: membersData.length,
          lastUpdated: new Date().toISOString()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unable to load member data' }));
        return;
      }
    }
    
    if (pathname === '/api/solar-clock') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        solarGeneration: Math.floor(Math.random() * 1000000),
        solarTokens: Math.floor(Math.random() * 500) + 100
      }));
      return;
    }
  }

  // Static file serving
  const staticPath = pathname.startsWith('/public/') ? 
    path.join(__dirname, pathname) : 
    path.join(__dirname, 'public', pathname);
  
  const ext = path.extname(staticPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  serveFile(res, staticPath, contentType);
});

server.listen(PORT, () => {
  console.log('🚀 CLEAN CURRENT-SEE SERVER');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🌐 Ready for testing');
  console.log('========================================');
  console.log('✅ CLEAN SERVER OPERATIONAL');
});