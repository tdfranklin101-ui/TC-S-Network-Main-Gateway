// Force Cache Clear - Replit Deployment
// This creates a fresh server instance with cache-busting

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CACHE_BUST = Date.now();

console.log(`🔄 FORCE CACHE CLEAR - ${new Date().toISOString()}`);
console.log(`Cache bust token: ${CACHE_BUST}`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Add cache-busting headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Cache-Bust', CACHE_BUST);
  
  console.log(`${new Date().toISOString()} - ${req.method} ${pathname} [CACHE-BUST: ${CACHE_BUST}]`);

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy - cache cleared',
      cacheBust: CACHE_BUST,
      timestamp: new Date().toISOString(),
      musicFunctions: 7,
      didAgent: 'v2_agt_vhYf_e_C'
    }));
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    try {
      const indexPath = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf8');
        
        // Verify content has music and D-ID
        const musicCount = (data.match(/function playMusic\d/g) || []).length;
        const hasDidAgent = data.includes('v2_agt_vhYf_e_C');
        
        console.log(`✅ Content verification: ${musicCount} music functions, D-ID agent: ${hasDidAgent}`);
        
        // Add cache-busting to the HTML
        const cachedData = data.replace(
          '<head>',
          `<head><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0"><!-- CACHE-BUST: ${CACHE_BUST} -->`
        );
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(cachedData);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Index file not found');
      }
    } catch (error) {
      console.error('Error serving homepage:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error: ' + error.message);
    }
    return;
  }

  // Static files with cache busting
  if (pathname.startsWith('/public/')) {
    const filePath = path.join(__dirname, pathname);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      };
      
      const contentType = contentTypes[ext] || 'text/plain';
      const data = fs.readFileSync(filePath);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CACHE-CLEARED SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔄 Cache bust token: ${CACHE_BUST}`);
  console.log(`🎵 Music functions: 7 expected`);
  console.log(`🤖 D-ID agent: v2_agt_vhYf_e_C expected`);
  console.log('📋 Access: http://localhost:3000');
});