/**
 * The Current-See Deployment Launcher
 * 
 * This script is the main entry point for deploying the application
 * on Replit. It sets up proper environment and launches the server
 * with restart capability.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const RESTART_SCRIPT = 'server-restart.js';

// Log startup info
console.log('===========================================');
console.log('  THE CURRENT-SEE DEPLOYMENT LAUNCHER');
console.log('===========================================');
console.log(`Starting deployment using port ${PORT}...`);

// Check if we need to force kill an existing server
const pidFile = path.join(__dirname, 'deploy-server.pid');
if (fs.existsSync(pidFile)) {
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    console.log(`Found existing server process (PID: ${pid}), attempting to terminate...`);
    
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Successfully sent SIGTERM to process ${pid}`);
    } catch (killErr) {
      console.log(`Process ${pid} may not be running: ${killErr.message}`);
    }
    
    // Remove stale PID file
    fs.unlinkSync(pidFile);
  } catch (err) {
    console.error(`Error handling existing PID file: ${err.message}`);
  }
}

// Prepare environment variables
const envVars = {
  ...process.env,
  PORT,
  HOST,
  NODE_ENV: 'production'
};

// Start the restart monitor
console.log(`Starting server monitor with restart capability...`);
const monitor = spawn('node', [RESTART_SCRIPT], {
  env: envVars,
  stdio: 'inherit',
  detached: false
});

// Handle monitor process events
monitor.on('error', (err) => {
  console.error(`Failed to start server monitor: ${err.message}`);
  process.exit(1);
});

// Log success
console.log(`Server monitor started with PID ${monitor.pid}`);
console.log('===========================================');
console.log('Server is now running. Press Ctrl+C to stop.');
console.log('===========================================');

// Keep the process alive
process.stdin.resume();

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT (Ctrl+C). Stopping all processes...');
  if (monitor) {
    monitor.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Stopping all processes...');
  if (monitor) {
    monitor.kill('SIGTERM');
  }
  process.exit(0);
});