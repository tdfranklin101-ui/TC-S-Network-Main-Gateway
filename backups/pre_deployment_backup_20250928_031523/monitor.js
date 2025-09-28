/**
 * The Current-See Server Monitor
 * 
 * This service continuously monitors the main server and health check processes
 * and automatically restarts them if they go down.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http');

// Configuration
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const MAIN_SERVER_PORT = 8080;
const HEALTH_SERVER_PORT = 3000;
const MAIN_SERVER_PID_FILE = 'server.pid';
const HEALTH_SERVER_PID_FILE = 'health.pid';
const MAX_RESTART_ATTEMPTS = 10;

// State tracking
let restartAttempts = 0;
let mainServerProcess = null;
let healthServerProcess = null;

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('monitor.log', logMessage + '\n');
}

// Check if a process is running
function isProcessRunning(pid) {
  try {
    return process.kill(pid, 0);
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Start the main server
function startMainServer() {
  log('Starting main server...');
  
  const env = { ...process.env, PORT: MAIN_SERVER_PORT };
  
  mainServerProcess = spawn('node', ['server.js'], { 
    env,
    stdio: 'inherit',
    detached: true
  });
  
  mainServerProcess.on('error', (err) => {
    log(`Failed to start main server: ${err.message}`);
  });
  
  mainServerProcess.on('exit', (code, signal) => {
    log(`Main server exited with code ${code} and signal ${signal}`);
    mainServerProcess = null;
  });
  
  // Write PID to file
  fs.writeFileSync(MAIN_SERVER_PID_FILE, mainServerProcess.pid.toString());
  log(`Main server started with PID ${mainServerProcess.pid}`);
  
  return mainServerProcess;
}

// Start the health check server
function startHealthServer() {
  log('Starting health check server...');
  
  const env = { ...process.env, PORT: HEALTH_SERVER_PORT };
  
  // Use healthz.js directly to avoid conflicts with shell script
  healthServerProcess = spawn('node', ['healthz.js'], { 
    env,
    stdio: 'inherit',
    detached: true
  });
  
  healthServerProcess.on('error', (err) => {
    log(`Failed to start health check server: ${err.message}`);
  });
  
  healthServerProcess.on('exit', (code, signal) => {
    log(`Health check server exited with code ${code} and signal ${signal}`);
    healthServerProcess = null;
  });
  
  // Write PID to file
  fs.writeFileSync(HEALTH_SERVER_PID_FILE, healthServerProcess.pid.toString());
  log(`Health check server started with PID ${healthServerProcess.pid}`);
  
  return healthServerProcess;
}

// Check main server status
function checkMainServer() {
  return new Promise((resolve) => {
    // First check if we can connect to the server
    const req = http.request({
      hostname: 'localhost',
      port: MAIN_SERVER_PORT,
      path: '/api/solar-clock',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('Main server is responding properly');
          resolve(true);
        } else {
          log(`Main server returned unexpected status code: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      log('Main server is not responding');
      
      // Check if process is running via PID file
      if (fs.existsSync(MAIN_SERVER_PID_FILE)) {
        const pid = parseInt(fs.readFileSync(MAIN_SERVER_PID_FILE, 'utf8'), 10);
        if (isProcessRunning(pid)) {
          log(`Main server process is running (PID: ${pid}) but not responding to requests`);
          try {
            process.kill(pid);
            log(`Terminated unresponsive main server process (PID: ${pid})`);
          } catch (err) {
            log(`Failed to terminate main server process: ${err.message}`);
          }
        }
      }
      
      resolve(false);
    });
    
    req.on('timeout', () => {
      log('Main server connection timed out');
      req.abort();
    });
    
    req.end();
  });
}

// Check health server status
function checkHealthServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: HEALTH_SERVER_PORT,
      path: '/healthz',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('Health server is responding properly');
          resolve(true);
        } else {
          log(`Health server returned unexpected status code: ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      log('Health server is not responding');
      
      // Check if process is running via PID file
      if (fs.existsSync(HEALTH_SERVER_PID_FILE)) {
        const pid = parseInt(fs.readFileSync(HEALTH_SERVER_PID_FILE, 'utf8'), 10);
        if (isProcessRunning(pid)) {
          log(`Health server process is running (PID: ${pid}) but not responding to requests`);
          try {
            process.kill(pid);
            log(`Terminated unresponsive health server process (PID: ${pid})`);
          } catch (err) {
            log(`Failed to terminate health server process: ${err.message}`);
          }
        }
      }
      
      resolve(false);
    });
    
    req.on('timeout', () => {
      log('Health server connection timed out');
      req.abort();
    });
    
    req.end();
  });
}

// Main monitoring function
async function monitorServers() {
  log('Checking server status...');
  
  const mainServerOk = await checkMainServer();
  const healthServerOk = await checkHealthServer();
  
  if (!mainServerOk) {
    log('Main server needs to be restarted');
    startMainServer();
    restartAttempts++;
  }
  
  if (!healthServerOk) {
    log('Health server needs to be restarted');
    startHealthServer();
    restartAttempts++;
  }
  
  if (mainServerOk && healthServerOk) {
    log('All servers are running correctly');
    restartAttempts = 0;
  } else if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    log(`Exceeded maximum restart attempts (${MAX_RESTART_ATTEMPTS}). Please investigate the server issues.`);
    process.exit(1);
  }
  
  // Schedule next check
  setTimeout(monitorServers, CHECK_INTERVAL);
}

// Clean up any stale PID files
if (fs.existsSync(MAIN_SERVER_PID_FILE)) {
  const pid = parseInt(fs.readFileSync(MAIN_SERVER_PID_FILE, 'utf8'), 10);
  if (!isProcessRunning(pid)) {
    log(`Removing stale main server PID file for PID ${pid}`);
    fs.unlinkSync(MAIN_SERVER_PID_FILE);
  }
}

if (fs.existsSync(HEALTH_SERVER_PID_FILE)) {
  const pid = parseInt(fs.readFileSync(HEALTH_SERVER_PID_FILE, 'utf8'), 10);
  if (!isProcessRunning(pid)) {
    log(`Removing stale health server PID file for PID ${pid}`);
    fs.unlinkSync(HEALTH_SERVER_PID_FILE);
  }
}

// Start monitoring
log('The Current-See Server Monitor started');
monitorServers();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('Monitor received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Monitor received SIGINT, shutting down...');
  process.exit(0);
});