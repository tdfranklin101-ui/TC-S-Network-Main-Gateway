// Simple Deployment Server - The Current-See Platform
const http = require('http');
const fs = require('fs');
const path = require('path');

// Use PORT from environment or default to 3000
const PORT = process.env.PORT || 3000;
const TIMESTAMP = Date.now();

console.log(`Starting deployment server on port ${PORT}`);
console.log(`Cache-bust timestamp: ${TIMESTAMP}`);

// Create server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Aggressive cache clearing
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Timestamp', TIMESTAMP);
  
  console.log(`${new Date().toISOString()} ${req.method} ${pathname}`);

  // Health check
  if (pathname === '/health') {
    // Check content
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let musicFunctions = 0;
    let didAgent = false;
    
    try {
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        musicFunctions = (content.match(/function playMusic\d/g) || []).length;
        didAgent = content.includes('v2_agt_vhYf_e_C');
      }
    } catch (e) {
      console.error('Health check error:', e);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cacheBust: TIMESTAMP,
      content: {
        musicFunctions,
        didAgent
      }
    }));
    return;
  }

  // Homepage
  if (pathname === '/' || pathname === '/index.html') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    try {
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        
        // Verify content
        const musicCount = (content.match(/function playMusic\d/g) || []).length;
        const hasAgent = content.includes('v2_agt_vhYf_e_C');
        
        console.log(`Serving homepage - Music: ${musicCount}, Agent: ${hasAgent}`);
        
        // Add cache-busting
        const enhanced = content.replace(
          '<head>',
          `<head>
          <meta http-equiv="Cache-Control" content="no-cache">
          <meta http-equiv="Pragma" content="no-cache">
          <meta http-equiv="Expires" content="0">
          <!-- DEPLOY: ${TIMESTAMP} Music:${musicCount} Agent:${hasAgent} -->`
        );
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(enhanced);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Homepage not found');
      }
    } catch (error) {
      console.error('Homepage error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
    return;
  }

  // Static files
  if (pathname.startsWith('/public/') || pathname.match(/\.(css|js|png|jpg|gif|ico)$/)) {
    let filePath = pathname.startsWith('/public/') 
      ? path.join(__dirname, pathname)
      : path.join(__dirname, 'public', pathname);
    
    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon'
        };
        
        const contentType = mimeTypes[ext] || 'text/plain';
        const content = fs.readFileSync(filePath);
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      }
    } catch (error) {
      console.error('Static file error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('File error');
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Deployment server running on port ${PORT}`);
  console.log(`🎵 Checking for music functions...`);
  console.log(`🤖 Checking for D-ID agent...`);
  console.log(`🔄 Cache-bust active: ${TIMESTAMP}`);
});