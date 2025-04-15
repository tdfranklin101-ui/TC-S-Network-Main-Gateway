/**
 * Unified Deployment Server for The Current-See
 * 
 * This script handles both the main application and health checks
 * in a single process to ensure deployment reliability.
 */

const http = require('http');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3000;
const APP_PORT = 8080;
const LOG_FILE = 'unified-deploy.log';

// Ensure log file exists
fs.writeFileSync(LOG_FILE, `=== Unified Deployment Server Started at ${new Date().toISOString()} ===\n`);

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Health check state
let isAppRunning = false;
let appProcess = null;
let startTime = Date.now();
let requestCount = 0;

// Create the proxy/health check server
const server = http.createServer((req, res) => {
  requestCount++;
  log(`Request #${requestCount}: ${req.method} ${req.url}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health check endpoints
  if (req.url === '/' || req.url === '/health' || req.url === '/healthz') {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'The Current-See',
      uptime: uptime,
      version: '1.0.0',
      appRunning: isAppRunning,
      timestamp: new Date().toISOString(),
      requestsServed: requestCount
    }));
    return;
  }
  
  // If the app is not yet running, return a "please wait" message
  if (!isAppRunning) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'starting',
      message: 'The application is starting, please try again in a moment.',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Proxy to the main app
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
    log(`Proxy error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Bad Gateway',
      message: 'Unable to reach application server',
      timestamp: new Date().toISOString()
    }));
  });
  
  req.pipe(proxyReq, { end: true });
});

// Start the application as a child process
function startApp() {
  log('Starting The Current-See application...');
  
  // Set the environment variables
  const env = { 
    ...process.env, 
    PORT: APP_PORT,
    NODE_ENV: process.env.NODE_ENV || 'production'
  };
  
  // Start the app as a detached child process
  appProcess = fork('server.js', [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    detached: false
  });
  
  // Capture and log stdout
  appProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    fs.appendFileSync(LOG_FILE, `[APP] ${message}\n`);
    
    // Set the app as running when we see the server started message
    if (message.includes('Server running at http://') || 
        message.includes('Server started.')) {
      isAppRunning = true;
      log('The Current-See application is now running');
    }
  });
  
  // Capture and log stderr
  appProcess.stderr.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, `[APP ERROR] ${data.toString().trim()}\n`);
  });
  
  // Handle process exit
  appProcess.on('exit', (code, signal) => {
    isAppRunning = false;
    log(`Application process exited with code ${code} and signal ${signal}`);
    
    // Restart the application if it crashes
    if (code !== 0) {
      log('Restarting application...');
      setTimeout(startApp, 5000);
    }
  });
  
  return appProcess;
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`Unified deployment server running on port ${PORT}`);
  log(`Will proxy to app on port ${APP_PORT}`);
  
  // Start the application
  startApp();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down...');
    
    // Close the server to stop accepting new connections
    server.close(() => {
      log('Server closed');
      
      // Terminate the application process
      if (appProcess) {
        log('Terminating application process...');
        appProcess.kill();
      }
      
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    log('SIGINT received, shutting down...');
    
    // Close the server to stop accepting new connections
    server.close(() => {
      log('Server closed');
      
      // Terminate the application process
      if (appProcess) {
        log('Terminating application process...');
        appProcess.kill();
      }
      
      process.exit(0);
    });
  });
});

log('Unified deployment server started');