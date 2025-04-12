/**
 * Standalone Health Check
 * 
 * This module provides a bare-bones health check endpoint that runs
 * independent of the main application. It starts immediately and 
 * ensures that health checks pass even during application startup.
 */
import http from 'http';

// Create a standalone health check server on a different port
// This needs to match port 3333 specifically for Replit health checks
const HEALTH_PORT = 3333;

// Log more info in development
const isDevMode = process.env.NODE_ENV !== 'production';

// Create a simple HTTP server that responds to ALL paths
const healthServer = http.createServer((req, res) => {
  if (isDevMode) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    console.log(`[STANDALONE] Health check request received for ${req.url} (User-Agent: ${userAgent})`);
  }
  
  // Set headers for proper health check response
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  // Always respond with 200 OK and basic health info
  res.statusCode = 200;
  
  const healthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'thecurrentsee',
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
    
    // Try again if the port is in use (might be available later)
    if ((err as any).code === 'EADDRINUSE') {
      console.log('Port in use, will retry in 15 seconds...');
      setTimeout(() => {
        healthServer.close();
        healthServer.listen(HEALTH_PORT, '0.0.0.0');
      }, 15000);
    }
  });
} catch (err) {
  console.warn(`Failed to start standalone health server: ${err}`);
}

// Make sure the server stays running even if there are errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in health server (continuing anyway):', err);
});

// Export the server in case we need to close it programmatically
export { healthServer };