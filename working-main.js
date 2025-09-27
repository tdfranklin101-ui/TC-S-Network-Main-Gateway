// Working Deployment Server - The Current-See Platform
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

console.log('🚀 Starting The Current-See Server...');
console.log(`📡 Port: ${PORT}`);
console.log(`📁 Directory: ${__dirname}`);

// Verify files exist
const indexPath = path.join(__dirname, 'public', 'index.html');
console.log(`📄 Index file: ${fs.existsSync(indexPath) ? 'EXISTS' : 'MISSING'}`);

if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const musicCount = (content.match(/function playMusic\d/g) || []).length;
  const hasAgent = content.includes('v2_agt_vhYf_e_C');
  console.log(`🎵 Music functions found: ${musicCount}`);
  console.log(`🤖 D-ID agent found: ${hasAgent}`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Clear cache headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  console.log(`${new Date().toISOString()} ${req.method} ${pathname}`);

  // Health endpoint
  if (pathname === '/health') {
    let healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'working-deployment',
      content: { musicFunctions: 0, didAgent: false }
    };
    
    try {
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        healthData.content.musicFunctions = (html.match(/function playMusic\d/g) || []).length;
        healthData.content.didAgent = html.includes('v2_agt_vhYf_e_C');
      }
    } catch (e) {
      console.error('Health check error:', e);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData, null, 2));
    return;
  }

  // Root path
  if (pathname === '/') {
    try {
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        console.log(`📤 Serving homepage (${html.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else {
        console.error('❌ Index file not found');
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Index file not found at: ' + indexPath);
      }
    } catch (error) {
      console.error('❌ Homepage error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error: ' + error.message);
    }
    return;
  }

  // Static files from public directory
  if (pathname.startsWith('/') && pathname !== '/') {
    const filePath = path.join(__dirname, 'public', pathname);
    
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
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
          '.ico': 'image/x-icon'
        };
        
        const contentType = mimeTypes[ext] || 'text/plain';
        const fileContent = fs.readFileSync(filePath);
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fileContent);
        console.log(`📤 Served static file: ${pathname}`);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found: ' + pathname);
        console.log(`❌ File not found: ${pathname}`);
      }
    } catch (error) {
      console.error('❌ Static file error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('File error: ' + error.message);
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found: ' + pathname);
});

server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Ready for deployment`);
  console.log('📋 Available endpoints:');
  console.log('  - / (homepage)');
  console.log('  - /health (server status)');
  console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});