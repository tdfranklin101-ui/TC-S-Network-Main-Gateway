/**
 * The Current-See Deployment Runner
 * 
 * This script launches the fixed deployment server
 * for Replit deployment with proper health checks.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_SCRIPT = path.join(__dirname, 'deploy-server-fixed.js');
const LOG_FILE = path.join(__dirname, 'deployment.log');

// Ensure the script exists
if (!fs.existsSync(SERVER_SCRIPT)) {
  console.error(`ERROR: Server script not found: ${SERVER_SCRIPT}`);
  process.exit(1);
}

// Start the server process
console.log(`Starting The Current-See deployment server from: ${SERVER_SCRIPT}`);
console.log(`Logs will be written to: ${LOG_FILE}`);

// Open log file stream
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Get current timestamp
const timestamp = new Date().toISOString();
logStream.write(`\n\n--- DEPLOYMENT STARTED AT ${timestamp} ---\n`);

// Spawn the server process
const server = spawn('node', [SERVER_SCRIPT], {
  env: {
    ...process.env,
    PORT: process.env.PORT || '3001' // Use environment PORT or default to 3001
  }
});

// Log process ID
logStream.write(`Server process ID: ${server.pid}\n`);

// Handle stdout
server.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  logStream.write(output);
});

// Handle stderr
server.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  logStream.write(`ERROR: ${output}`);
});

// Handle process exit
server.on('close', (code) => {
  const exitMessage = `Server process exited with code ${code}`;
  console.log(exitMessage);
  logStream.write(`${exitMessage}\n`);
  logStream.end();
});

// Log startup complete
console.log('Deployment runner started successfully');