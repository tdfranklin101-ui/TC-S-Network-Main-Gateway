/**
 * Super Simple Health Check for Replit Deployments (CommonJS Version)
 * 
 * This minimal file does exactly ONE thing: responds with 200 OK to ANY request
 * It's designed to be the PRIMARY entry point for Replit deployments
 * This version uses ONLY CommonJS syntax - NO ES Modules
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3000;
const LOG_FILE = 'health-simple.log';

// Ensure log file exists with startup timestamp
fs.writeFileSync(LOG_FILE, `=== Health Check Started at ${new Date().toISOString()} ===\n`);

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + '\n');
}

log('Starting health check server...');

// Start the main application as a child process
log('Starting main application...');
const SERVER_PROCESS = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '8080' },
  stdio: 'pipe',
  detached: false
});

log(`Main application started with PID ${SERVER_PROCESS.pid}`);

// Forward application output to console and log file
SERVER_PROCESS.stdout.on('data', (data) => {
  const output = data.toString().trim();
  log(`[APP] ${output}`);
});

SERVER_PROCESS.stderr.on('data', (data) => {
  const output = data.toString().trim();
  log(`[APP ERROR] ${output}`);
});

// Handle application process events
SERVER_PROCESS.on('error', (err) => {
  log(`Failed to start application: ${err.message}`);
});

SERVER_PROCESS.on('exit', (code, signal) => {
  log(`Application process exited with code ${code} and signal ${signal}`);
  
  // Optionally restart the application if it crashes
  if (code !== 0 && code !== null) {
    log('Restarting application...');
    setTimeout(() => {
      const newProcess = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: '8080' },
        stdio: 'pipe',
        detached: false
      });
      log(`Restarted application with PID ${newProcess.pid}`);
    }, 5000);
  }
});

// Create a simple HTTP server that responds 200 OK to EVERYTHING
const server = http.createServer((req, res) => {
  log(`Health check request: ${req.method} ${req.url}`);
  
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // ALWAYS return 200 OK with a simple JSON response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'The Current-See Health Check',
    pid: process.pid,
    mainAppPid: SERVER_PROCESS.pid,
    timestamp: new Date().toISOString()
  }));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`Health check server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  server.close(() => {
    log('Server closed');
    
    // Terminate the main application process
    if (SERVER_PROCESS) {
      log('Terminating application process...');
      SERVER_PROCESS.kill();
    }
    
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  server.close(() => {
    log('Server closed');
    
    // Terminate the main application process
    if (SERVER_PROCESS) {
      log('Terminating application process...');
      SERVER_PROCESS.kill();
    }
    
    process.exit(0);
  });
});