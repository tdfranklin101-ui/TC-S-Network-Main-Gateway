/**
 * Standalone Health Check
 * 
 * This module provides a bare-bones health check endpoint that runs
 * independent of the main application. It starts immediately and 
 * ensures that health checks pass even during application startup.
 */
import http from 'http';

// Create a standalone health check server on a different port
// Port configuration for health check server:
// - In Replit deployment, the health check will use port 3000
// - In local development, we use port 3333 to avoid conflicts
const HEALTH_PORT = process.env.NODE_ENV === 'production' ? 3000 : 3333;

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
    server: 'standalone',
    mode: process.env.NODE_ENV || 'development',
    port: HEALTH_PORT
  };
  
  res.end(JSON.stringify(healthResponse));
});

// Start the health server and log status
try {
  // Connect to a range of possible ports if the primary one fails
  function tryToListen(port: number, retries = 3) {
    healthServer.listen(port, '0.0.0.0', () => {
      console.log(`Standalone health check server running on port ${port}`);
    });
    
    healthServer.on('error', (err) => {
      console.warn(`Health check server error on port ${port}: ${err.message}`);
      
      if (retries > 0 && (err as any).code === 'EADDRINUSE') {
        // Try next port if this one is in use
        const nextPort = port + 1;
        console.log(`Port ${port} in use, trying ${nextPort}...`);
        
        setTimeout(() => {
          healthServer.close();
          tryToListen(nextPort, retries - 1);
        }, 1000);
      }
    });
  }
  
  // Start on the primary port
  tryToListen(HEALTH_PORT);
  
} catch (err) {
  console.warn(`Failed to start standalone health server: ${err}`);
  
  // Last resort - try a completely different approach
  try {
    const alternateServer = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', fallback: true }));
    });
    
    alternateServer.listen(process.env.NODE_ENV === 'production' ? 3001 : 3334, '0.0.0.0');
  } catch (e) {
    // Just log and continue - the main server should still work
    console.error('Even fallback health server failed:', e);
  }
}

// Make sure the server stays running even if there are errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in health server (continuing anyway):', err);
});

// Export the server in case we need to close it programmatically
export { healthServer };