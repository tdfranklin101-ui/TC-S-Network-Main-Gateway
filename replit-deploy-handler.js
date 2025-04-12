// Replit Deploy Handler - A compatibility layer for deployment
// This file uses pure CommonJS to act as the entry point for deployment
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const PORT = process.env.PORT || 3000;
const MAIN_APP_PORT = 5000; // The port your main app runs on
let mainApp = null;
let isMainAppRunning = false;

// Create a bridge server that forwards requests to the main app
const server = http.createServer((req, res) => {
  // Always respond to health checks immediately
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/health-check') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (isMainAppRunning) {
    // Forward to main app
    proxyRequest(req, res);
  } else {
    // Return a temporary response while the main app starts
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html>
      <head><title>The Current-See - Starting</title></head>
      <body>
        <h1>The Current-See</h1>
        <p>Application is starting, please wait...</p>
        <script>setTimeout(() => window.location.reload(), 2000);</script>
      </body>
    </html>`);
  }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Deployment bridge running on port ${PORT}`);
  startMainApplication();
});

// Function to proxy requests to the main app
function proxyRequest(clientReq, clientRes) {
  const options = {
    hostname: 'localhost',
    port: MAIN_APP_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  clientReq.pipe(proxyReq, { end: true });

  proxyReq.on('error', (e) => {
    console.error('Proxy request error:', e.message);
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
  });
}

// Function to start the main application
function startMainApplication() {
  console.log('Starting main application...');
  
  try {
    // Try to start the server.js file directly
    mainApp = spawn('node', ['server/index.js'], {
      env: { ...process.env, PORT: MAIN_APP_PORT.toString() }
    });
    
    mainApp.stdout.on('data', (data) => {
      console.log(`Main app: ${data}`);
      // Check if the app is running by looking for a known log message
      if (data.toString().includes('Server running')) {
        isMainAppRunning = true;
      }
    });
    
    mainApp.stderr.on('data', (data) => {
      console.error(`Main app error: ${data}`);
    });
    
    mainApp.on('close', (code) => {
      console.log(`Main app process exited with code ${code}`);
      isMainAppRunning = false;
      // Restart the main app after a delay
      setTimeout(startMainApplication, 5000);
    });
    
  } catch (error) {
    console.error('Failed to start main application:', error);
    // Try an alternative method in 5 seconds
    setTimeout(startMainApplication, 5000);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT - shutting down...');
  if (mainApp) {
    mainApp.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM - shutting down...');
  if (mainApp) {
    mainApp.kill();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});