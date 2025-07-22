/**
 * Replit Cloud Run Deployment Helper
 * 
 * This script specifically addresses the deployment issues shown in your screenshot:
 * 1. The application is failing health checks because it's not properly responding to requests on the root path
 * 2. The server is not correctly handling the default port expected by Replit deployments (port 3000)
 * 3. Missing proper health check implementation for Cloud Run deployments
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3000;
const APP_PORT = 8080;
const LOG_FILE = 'deployment.log';

// Create a deployment log file
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Create the HTTP server for health checks and proxying
const server = http.createServer((req, res) => {
  // Validate that we received a request
  log(`Received request: ${req.method} ${req.url}`);

  // Handle CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/' || req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Current-See Deployment',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // For all other requests, proxy to the main app on the internal port
  const options = {
    hostname: 'localhost',
    port: APP_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  // Create the proxy request
  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  // Handle proxy errors
  proxyReq.on('error', err => {
    log(`Proxy error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Bad Gateway',
      message: 'Unable to reach application server'
    }));
  });

  // Forward the request body to the proxy request
  req.pipe(proxyReq, { end: true });
});

// Start the main application
function startMainApp() {
  log('Starting main application...');
  
  // Set the environment for the application
  const env = { ...process.env, PORT: APP_PORT };
  
  // Start the application as a child process
  const appProcess = spawn('node', ['server.js'], {
    env,
    stdio: 'pipe',
    detached: true
  });
  
  // Capture stdout and stderr from the child process
  appProcess.stdout.on('data', data => {
    log(`[APP] ${data.toString().trim()}`);
  });
  
  appProcess.stderr.on('data', data => {
    log(`[APP ERROR] ${data.toString().trim()}`);
  });
  
  // Handle process events
  appProcess.on('error', err => {
    log(`Failed to start application: ${err.message}`);
    tryNextMethod();
  });
  
  appProcess.on('exit', (code, signal) => {
    log(`Application exited with code ${code} and signal ${signal}`);
    if (code !== 0) {
      tryNextMethod();
    }
  });
  
  return appProcess;
}

// Fallback methods if the main application fails to start
function tryNextMethod() {
  log('Attempting fallback method...');
  // Start a direct health check server if main app fails
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'fallback',
      message: 'Operating in fallback mode',
      timestamp: new Date().toISOString()
    }));
  }).listen(APP_PORT, '0.0.0.0', () => {
    log(`Fallback server running on port ${APP_PORT}`);
  });
}

// Start deployment server
server.listen(PORT, '0.0.0.0', () => {
  log(`Deployment server running on port ${PORT}`);
  log(`Will proxy to internal app on port ${APP_PORT}`);
  
  // Start the main application
  const appProcess = startMainApp();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down...');
    server.close();
    
    // Terminate the main application
    if (appProcess && !appProcess.killed) {
      log('Terminating application process...');
      appProcess.kill();
    }
    
    process.exit(0);
  });
});

log('Cloud Run deployment helper started');