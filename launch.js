/**
 * The Current-See Launch Script
 * 
 * This script manages server deployment with restart capability
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Log utility
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also append to log file
  fs.appendFileSync('launch.log', logMessage + '\n');
}

// Kill any existing node processes
function killExistingProcesses() {
  try {
    const pids = [];
    
    // Check for PID files
    if (fs.existsSync('server.pid')) {
      const pid = fs.readFileSync('server.pid', 'utf8').trim();
      if (pid) pids.push(pid);
    }
    
    if (fs.existsSync('stable-server.pid')) {
      const pid = fs.readFileSync('stable-server.pid', 'utf8').trim();
      if (pid) pids.push(pid);
    }
    
    // Kill processes if any found
    if (pids.length > 0) {
      log(`Attempting to kill existing processes: ${pids.join(', ')}`);
      pids.forEach(pid => {
        try {
          process.kill(pid, 'SIGTERM');
          log(`Successfully terminated process ${pid}`);
        } catch (e) {
          log(`Failed to kill process ${pid}: ${e.message}`);
        }
      });
    } else {
      log('No existing server processes found');
    }
  } catch (error) {
    log(`Error killing existing processes: ${error.message}`);
  }
}

// Start the server
function startServer() {
  log('Starting Current-See server...');
  
  // Copy the current embedded-members.json to ensure it's up to date
  try {
    fs.copyFileSync('public/embedded-members.json', 'data/members.json');
    log('Copied embedded-members.json to data/members.json');
  } catch (error) {
    log(`Warning: Could not copy embedded members file: ${error.message}`);
  }
  
  // Launch the server process
  const server = spawn('node', ['deploy-stable.js'], {
    detached: true,
    stdio: ['ignore', 
      fs.openSync('server-output.log', 'a'),
      fs.openSync('server-error.log', 'a')]
  });
  
  // Save the PID
  fs.writeFileSync('current-server.pid', String(server.pid));
  log(`Server started with PID ${server.pid}`);
  
  // Detach the process
  server.unref();
  
  // Set up a monitor to check if the server is still running
  const monitorInterval = setInterval(() => {
    try {
      // Check if the process is still running
      process.kill(server.pid, 0);
      // No error means the process is still running
    } catch (e) {
      log(`Server process ${server.pid} is no longer running, restarting...`);
      clearInterval(monitorInterval);
      startServer();
    }
  }, 30000); // Check every 30 seconds
}

// Main execution
function main() {
  try {
    log('Current-See launch script starting...');
    
    // Kill any existing processes
    killExistingProcesses();
    
    // Make sure data directory exists
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', { recursive: true });
      log('Created data directory');
    }
    
    // Start the server
    startServer();
    
    log('Launch script completed successfully');
  } catch (error) {
    log(`Launch script error: ${error.message}`);
  }
}

// Execute the main function
main();