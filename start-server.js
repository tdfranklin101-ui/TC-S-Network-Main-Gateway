/**
 * Startup script for The Current-See deployment server
 */

const { exec } = require('child_process');
const http = require('http');

console.log('Starting The Current-See deployment server...');

// Start the deploy-server.js in a child process
const serverProcess = exec('node deploy-server.js', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  
  console.log(`stdout: ${stdout}`);
});

// Log the process ID so we can track it
console.log(`Server process started with PID: ${serverProcess.pid}`);

// Create a simple HTTP server to verify the status
const statusServer = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      server_pid: serverProcess.pid,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(302, { 'Location': '/' });
    res.end();
  }
});

// Listen on a different port to avoid conflicts
statusServer.listen(3001, '0.0.0.0', () => {
  console.log('Status server running at http://0.0.0.0:3001/status');
});

// Handle cleanup when process exits
process.on('exit', () => {
  console.log('Shutting down servers...');
  
  // Kill the child process if it's still running
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  
  // Close the status server
  if (statusServer) {
    statusServer.close();
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  process.exit(0);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  process.exit(0);
});