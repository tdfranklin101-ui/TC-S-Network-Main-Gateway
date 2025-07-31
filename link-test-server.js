const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Define all the required routes
const routes = {
  '/': 'public/index.html',
  '/wallet.html': 'public/wallet.html',
  '/declaration.html': 'public/declaration.html',
  '/founder_note.html': 'public/founder_note.html',
  '/whitepapers.html': 'public/whitepapers.html',
  '/business_plan.html': 'public/business_plan.html',
  '/private-network': 'public/private-network.html',
  '/qa-meaning-purpose': 'public/qa-meaning-purpose.html',
  '/analytics-dashboard': 'public/analytics-dashboard.html',
  '/ai-memory-review': 'public/ai-memory-review.html'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname;

  // Health check
  if (filePath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      routes: Object.keys(routes),
      consoleSolar: 'active'
    }));
    return;
  }

  // Route handling
  if (routes[filePath]) {
    const fullPath = path.join(__dirname, routes[filePath]);
    
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }

  // Serve static files from public directory
  if (filePath.startsWith('/')) {
    const staticPath = path.join(__dirname, 'public', filePath);
    
    if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
      const ext = path.extname(staticPath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      const content = fs.readFileSync(staticPath);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html>
<html>
<head><title>404 - Page Not Found</title></head>
<body>
<h1>404 - Page Not Found</h1>
<p>The requested page "${filePath}" was not found.</p>
<p>Available routes:</p>
<ul>
${Object.keys(routes).map(route => `<li><a href="${route}">${route}</a></li>`).join('')}
</ul>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔗 Link Test Server running on http://localhost:${PORT}`);
  console.log('📋 Available routes:');
  Object.keys(routes).forEach(route => {
    console.log(`   ${route} -> ${routes[route]}`);
  });
});