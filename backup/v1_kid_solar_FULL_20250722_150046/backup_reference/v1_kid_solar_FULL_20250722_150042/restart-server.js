/**
 * The Current-See Server Restart Utility
 * 
 * This script safely restarts the Current-See server with proper shutdown
 * procedures and environment variable preservation.
 * 
 * Usage: node restart-server.js
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

// Configuration
const SERVER_PID_FILE = 'server.pid';
const SERVER_LOG_FILE = 'server.log';
const SERVER_SCRIPT = 'pure-deployment.js';
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds timeout for graceful shutdown

/**
 * Log a message with timestamp
 */
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

/**
 * Get the current server PID if running
 */
function getCurrentPid() {
  if (fs.existsSync(SERVER_PID_FILE)) {
    try {
      return parseInt(fs.readFileSync(SERVER_PID_FILE, 'utf8').trim(), 10);
    } catch (err) {
      log(`Error reading PID file: ${err.message}`, true);
    }
  }
  return null;
}

/**
 * Check if a process with the given PID is running
 */
function isProcessRunning(pid) {
  try {
    if (os.platform() === 'win32') {
      // Windows - use tasklist
      const result = require('child_process').spawnSync('tasklist', ['/FI', `PID eq ${pid}`], { encoding: 'utf8' });
      return result.stdout.includes(pid.toString());
    } else {
      // Unix-like systems - use kill -0
      process.kill(pid, 0);
      return true;
    }
  } catch (err) {
    // If process.kill throws, the process is not running
    return false;
  }
}

/**
 * Stop the current server if running
 */
async function stopServer(pid) {
  if (!pid) {
    log('No PID provided, skipping server stop');
    return true;
  }

  if (!isProcessRunning(pid)) {
    log(`Process with PID ${pid} is not running`);
    return true;
  }

  log(`Stopping server with PID ${pid}...`);
  
  // Try graceful shutdown
  try {
    if (os.platform() === 'win32') {
      exec(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGTERM');
    }

    // Wait for the process to terminate gracefully
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT / 10));
      if (!isProcessRunning(pid)) {
        log('Server stopped gracefully');
        return true;
      }
    }

    // If still running after timeout, force kill
    log('Graceful shutdown timeout, forcing kill...', true);
    if (os.platform() === 'win32') {
      exec(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGKILL');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    if (isProcessRunning(pid)) {
      log(`Failed to kill process with PID ${pid}`, true);
      return false;
    }
    
    log('Server force stopped');
    return true;
  } catch (err) {
    log(`Error stopping server: ${err.message}`, true);
    return false;
  }
}

/**
 * Start the server
 */
function startServer() {
  log(`Starting server using ${SERVER_SCRIPT}...`);

  try {
    // Preserve environment variables
    const env = { ...process.env };
    
    // Start the process
    const serverProcess = spawn('node', [SERVER_SCRIPT], {
      detached: true,
      stdio: ['ignore', 
        fs.openSync(SERVER_LOG_FILE, 'a'),
        fs.openSync(SERVER_LOG_FILE, 'a')
      ],
      env
    });
    
    // Write PID to file
    fs.writeFileSync(SERVER_PID_FILE, serverProcess.pid.toString());
    
    // Detach the process to run independently
    serverProcess.unref();
    
    log(`Server started with PID ${serverProcess.pid}`);
    log(`Server logs writing to ${SERVER_LOG_FILE}`);
    
    return true;
  } catch (err) {
    log(`Error starting server: ${err.message}`, true);
    return false;
  }
}

/**
 * Restart the server
 */
async function restartServer() {
  log('========================');
  log('SERVER RESTART INITIATED');
  log('========================');
  
  // Get current server PID
  const currentPid = getCurrentPid();
  
  if (currentPid) {
    log(`Current server running with PID ${currentPid}`);
    
    // Stop the current server
    const stopResult = await stopServer(currentPid);
    if (!stopResult) {
      log('Failed to stop the current server, aborting restart', true);
      return false;
    }
  } else {
    log('No running server detected');
  }
  
  // Backup the server log if it exists
  if (fs.existsSync(SERVER_LOG_FILE)) {
    const backupFile = `${SERVER_LOG_FILE}.${Date.now()}.bak`;
    try {
      fs.copyFileSync(SERVER_LOG_FILE, backupFile);
      log(`Server log backed up to ${backupFile}`);
    } catch (err) {
      log(`Warning: Failed to backup server log: ${err.message}`, true);
    }
  }
  
  // Start the new server
  const startResult = startServer();
  if (startResult) {
    log('Server restart completed successfully');
    
    // Wait a moment and display recent logs
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      const recentLogs = fs.readFileSync(SERVER_LOG_FILE, 'utf8')
        .split('\n')
        .slice(-15)
        .join('\n');
      
      log('Recent server logs:');
      console.log('-'.repeat(50));
      console.log(recentLogs);
      console.log('-'.repeat(50));
    } catch (err) {
      log(`Error reading recent logs: ${err.message}`, true);
    }
    
    return true;
  } else {
    log('Failed to start the server', true);
    return false;
  }
}

// Run the restart process
restartServer().then(success => {
  if (!success) {
    process.exit(1);
  }
});