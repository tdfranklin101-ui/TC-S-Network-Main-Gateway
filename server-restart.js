/**
 * The Current-See Server Restart Utility
 * 
 * This script helps manage the deployment server process.
 * It can start, stop, and restart the server.
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

// Configuration
const SERVER_SCRIPT = 'deploy-server.js';
const PID_FILE = 'deploy-server.pid';
const LOG_FILE = 'deploy-server.log';

// Helper function to log messages
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  // Also append to log file
  fs.appendFileSync('deployment-helper.log', `[${timestamp}] ${message}\n`);
}

// Check if server is running
function isServerRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }
  
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
  
  try {
    // Send signal 0 to check if process exists
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // Process doesn't exist
    return false;
  }
}

// Start the server
function startServer() {
  if (isServerRunning()) {
    log('Server is already running');
    return;
  }
  
  log('Starting server...');
  
  // Open log file for writing
  const out = fs.openSync(LOG_FILE, 'a');
  const err = fs.openSync(LOG_FILE, 'a');
  
  // Spawn server process
  const child = spawn('node', [SERVER_SCRIPT], {
    detached: true,
    stdio: ['ignore', out, err]
  });
  
  // Write PID to file
  fs.writeFileSync(PID_FILE, child.pid.toString());
  
  // Detach the child process
  child.unref();
  
  log(`Server started with PID ${child.pid}`);
}

// Stop the server
function stopServer() {
  if (!isServerRunning()) {
    log('Server is not running');
    return;
  }
  
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
  
  log(`Stopping server with PID ${pid}...`);
  
  try {
    process.kill(pid);
    fs.unlinkSync(PID_FILE);
    log('Server stopped');
  } catch (e) {
    log(`Error stopping server: ${e.message}`);
    
    // Clean up PID file if process doesn't exist
    if (e.code === 'ESRCH') {
      fs.unlinkSync(PID_FILE);
      log('Removed stale PID file');
    }
  }
}

// Restart the server
function restartServer() {
  log('Restarting server...');
  stopServer();
  
  // Wait a moment for the server to stop
  setTimeout(() => {
    startServer();
  }, 2000);
}

// Process command line arguments
function processCommand() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startServer();
      break;
    case 'stop':
      stopServer();
      break;
    case 'restart':
      restartServer();
      break;
    case 'status':
      if (isServerRunning()) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
        log(`Server is running with PID ${pid}`);
      } else {
        log('Server is not running');
      }
      break;
    default:
      log('Usage: node server-restart.js [start|stop|restart|status]');
  }
}

// Execute command
processCommand();