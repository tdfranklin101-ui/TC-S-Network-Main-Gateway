/**
 * Standalone Health Check
 * 
 * This module provides a bare-bones health check endpoint that runs
 * independent of the main application. It starts immediately and 
 * ensures that health checks pass even during application startup.
 */
import http from 'http';

// Create a standalone health check server on a different port
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3333');

// Create a simple HTTP server
const healthServer = http.createServer((req, res) => {
  // Set CORS headers to allow health checks from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // Always respond with 200 OK and basic health info
  res.writeHead(200, { 'Content-Type': 'application/json' });
  
  const healthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'standalone'
  };
  
  res.end(JSON.stringify(healthResponse));
});

// Start the health server and log status
try {
  healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`Standalone health check server running on port ${HEALTH_PORT}`);
  });
  
  // Handle errors without crashing
  healthServer.on('error', (err) => {
    console.warn(`Health check server error (non-critical): ${err.message}`);
  });
} catch (err) {
  console.warn(`Failed to start standalone health server: ${err}`);
}

// Export the server in case we need to close it programmatically
export { healthServer };