/**
 * Deployment Runner
 * This script starts both the application and a health check server
 */
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Start the health check server
console.log('Starting health check server...');
const healthProcess = spawn('node', ['health.js'], {
  stdio: 'inherit',
  detached: true
});

// Don't wait for the health check server to exit
healthProcess.unref();

// Run the main application with the environment set correctly
console.log('Starting main application...');
const appProcess = spawn('node', ['index.js'], {
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  try {
    process.kill(-healthProcess.pid);
  } catch (e) {}
  appProcess.kill();
  process.exit(0);
});

// Keep the process running
appProcess.on('close', (code) => {
  console.log(`Main application exited with code ${code}`);
  try {
    process.kill(-healthProcess.pid);
  } catch (e) {}
  process.exit(code);
});
