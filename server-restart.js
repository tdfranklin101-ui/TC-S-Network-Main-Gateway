/**
 * The Current-See Server Restart Handler
 * 
 * This script ensures the server stays running even if it crashes.
 * It's specifically designed for deployment on Replit.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_FILE = 'deploy-server.js';
const LOG_FILE = 'deploy-server.log';
const MAX_RESTARTS = 10;
const RESTART_DELAY = 5000; // 5 seconds

// Tracking
let restartCount = 0;
let lastRestartTime = Date.now();
let serverProcess = null;

// Create log file directory if it doesn't exist
const logDir = path.dirname(LOG_FILE);
if (logDir !== '.' && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log function with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(message);
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Start the server process
function startServer() {
  log(`Starting server (attempt ${restartCount + 1} of ${MAX_RESTARTS})...`);
  
  // Spawn Node.js process with the server file
  serverProcess = spawn('node', [SERVER_FILE], {
    stdio: 'pipe', // Capture stdout and stderr
    detached: false
  });
  
  // Save the process ID to a file for external management
  fs.writeFileSync('deploy-server.pid', serverProcess.pid.toString());
  
  // Log server output
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log(`SERVER: ${output}`);
    }
  });
  
  // Log server errors
  serverProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log(`SERVER ERROR: ${output}`);
    }
  });
  
  // Handle server exit
  serverProcess.on('exit', (code, signal) => {
    const exitReason = signal ? `signal ${signal}` : `code ${code}`;
    log(`Server exited with ${exitReason}`);
    
    // Remove PID file
    try {
      fs.unlinkSync('deploy-server.pid');
    } catch (err) {
      // Ignore if file doesn't exist
    }
    
    // Restart server if not explicitly killed
    if (code !== 0 && restartCount < MAX_RESTARTS) {
      // Check if we're restarting too quickly
      const now = Date.now();
      const timeSinceLastRestart = now - lastRestartTime;
      
      if (timeSinceLastRestart < RESTART_DELAY) {
        const waitTime = RESTART_DELAY - timeSinceLastRestart;
        log(`Waiting ${waitTime}ms before restart to prevent rapid cycling...`);
        setTimeout(restartServer, waitTime);
      } else {
        restartServer();
      }
    } else if (restartCount >= MAX_RESTARTS) {
      log('Maximum restart attempts reached. Server will not be restarted.');
    }
  });
  
  log(`Server started with PID ${serverProcess.pid}`);
}

// Restart the server
function restartServer() {
  restartCount++;
  lastRestartTime = Date.now();
  startServer();
}

// Handle process signals
process.on('SIGINT', () => {
  log('Received SIGINT (Ctrl+C). Stopping server...');
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM. Stopping server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// Handle uncaught exceptions in the monitor process
process.on('uncaughtException', (err) => {
  log(`MONITOR ERROR: Uncaught exception: ${err.message}`);
  log(err.stack);
  
  // Try to keep the server running even if the monitor has an issue
  if (!serverProcess || serverProcess.exitCode !== null) {
    restartServer();
  }
});

// Start the server initially
log('=== THE CURRENT-SEE SERVER MONITOR STARTED ===');
startServer();