// Production Deployment Server - The Current-See Platform
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
console.log(`🚀 PRODUCTION DEPLOYMENT STARTING - PORT ${PORT}`);

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  
  // Force no cache on everything
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  console.log(`${new Date().toISOString()} ${req.method} ${pathname}`);

  // Health check
  if (pathname === '/health') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let content = { musicFunctions: 0, didAgent: false };
    
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      content.musicFunctions = (html.match(/function playMusic\d/g) || []).length;
      content.didAgent = html.includes('v2_agt_vhYf_e_C');
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      content: content,
      deployment: 'production-ready'
    }));
    return;
  }

  // Homepage
  if (pathname === '/' || pathname === '/index.html') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Homepage not found');
    }
    return;
  }

  // Static files
  const staticPaths = ['/public/', '/css/', '/js/', '/images/', '/assets/'];
  if (staticPaths.some(p => pathname.startsWith(p)) || pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    let filePath = pathname.startsWith('/public/') 
      ? path.join(__dirname, pathname)
      : path.join(__dirname, 'public', pathname);
    
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
      };
      
      const contentType = mimeTypes[ext] || 'text/plain';
      const content = fs.readFileSync(filePath);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ PRODUCTION SERVER RUNNING ON ${PORT}`);
  console.log(`🌐 Ready for deployment`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});