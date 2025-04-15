/**
 * Replit Deployment Helper
 * 
 * This file is used during Replit deployment to handle both
 * the main application and health checks.
 */

const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;
const APP_PORT = 8080;

// Handle all incoming requests with a health check response
const healthServer = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] Health request: ${req.method} ${req.url}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Current-See',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Proxy other requests to the app server
  const options = {
    hostname: 'localhost',
    port: APP_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  
  proxyReq.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Proxy error:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway', message: 'Unable to reach application server' }));
  });
  
  req.pipe(proxyReq, { end: true });
});

// Start the main application
function startMainApp() {
  console.log(`[${new Date().toISOString()}] Starting main application...`);
  
  // Set environment variables for the child process
  const env = { ...process.env, PORT: APP_PORT };
  
  // Start the app as a child process
  const app = spawn('node', ['server.js'], { 
    env,
    stdio: 'inherit'
  });
  
  app.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Failed to start application:`, err);
    setTimeout(() => startMainApp(), 5000); // Retry after 5 seconds
  });
  
  app.on('exit', (code, signal) => {
    console.log(`[${new Date().toISOString()}] Application exited with code ${code} and signal ${signal}`);
    if (code !== 0) {
      setTimeout(() => startMainApp(), 5000); // Restart if crashed
    }
  });
  
  return app;
}

// Start health check server
healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Health check server running on port ${PORT}`);
  
  // Start the main application
  const app = startMainApp();
  
  // Handle clean shutdown
  process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down gracefully`);
    
    // Close the servers
    healthServer.close(() => {
      console.log(`[${new Date().toISOString()}] Health check server closed`);
      process.exit(0);
    });
  });
});

console.log(`[${new Date().toISOString()}] Current-See Deployment Manager started`);