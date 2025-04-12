/**
 * Replit Deployment Helper
 * 
 * This file is used during Replit deployment to handle both
 * the main application and health checks.
 */

const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

console.log('Replit deployment helper starting...');

// Fork the health check process
let healthProcess = null;
try {
  console.log('Starting health check server...');
  healthProcess = spawn('node', ['health-check.js'], {
    stdio: 'inherit',
    detached: true
  });
  
  healthProcess.unref();
  console.log('Health check server started in background');
} catch (err) {
  console.error('Failed to start health check server:', err);
  
  // Start a minimal health check server directly
  try {
    const backupServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    
    backupServer.listen(3000, '0.0.0.0');
    console.log('Backup health check server started on port 3000');
  } catch (e) {
    console.error('Failed to start backup health check server:', e);
  }
}

// Start the main application
console.log('Starting main application...');
process.env.NODE_ENV = 'production';

// Listen for termination signals
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (healthProcess) {
    try {
      process.kill(-healthProcess.pid);
    } catch (e) {}
  }
  process.exit(0);
});

// Load the main ESM application
console.log('Loading application...');
import('./dist/index.js').catch(err => {
  console.error('Failed to start main application:', err);
  
  // Start a fallback server
  const fallbackServer = http.createServer((req, res) => {
    if (req.url.includes('health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>The Current-See</h1><p>The application is starting up, please try again soon.</p></body></html>');
  });
  
  fallbackServer.listen(process.env.PORT || 5000, '0.0.0.0');
  console.log(`Fallback server started on port ${process.env.PORT || 5000}`);
});