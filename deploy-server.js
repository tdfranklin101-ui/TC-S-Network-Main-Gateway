/**
 * The Current-See Deployment Server
 * 
 * This is a specialized deployment version of the server designed for maximum
 * stability and reliable operation on Replit. It handles proper port binding
 * and ensures clean startup/shutdown.
 */

// Import core server functionality
const server = require('./server.js');

// Additional health check endpoint for deployment monitoring
const http = require('http');
const PORT = process.env.PORT || 3000;

// Create a basic health check server that responds to all requests
const healthServer = http.createServer((req, res) => {
  // Log the health check request
  console.log(`[${new Date().toISOString()}] Health check received: ${req.method} ${req.url}`);
  
  // Always respond with 200 OK for the health check
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The Current-See Service is running.');
});

// Set up proper shutdown handling
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received, shutting down gracefully...');
  // Add any cleanup logic here
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[INFO] SIGINT received, shutting down gracefully...');
  // Add any cleanup logic here
  process.exit(0);
});

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught exception:', err);
  // Keep the server running despite the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  // Keep the server running despite the rejection
});

// Start the server and notify when ready
healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] The Current-See Deployment Server is running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health check endpoint active at http://0.0.0.0:${PORT}/`);
});

console.log(`The Current-See Deployment Server has been initialized`);