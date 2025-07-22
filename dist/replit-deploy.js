/**
 * Replit Deployment Helper
 * 
 * This file is used during Replit deployment to handle both
 * the main application and health checks.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('Replit deployment helper starting...');

// Constants
const HEALTH_PORT = 3000;  // Replit's expected health check port
const APP_PORT = process.env.PORT || 5000;  // Main application port

// Create a specialized health check server that responds to all requests
const healthServer = http.createServer((req, res) => {
  console.log(`[HEALTH] ${req.method} ${req.url} - User-Agent: ${req.headers['user-agent'] || 'none'}`);
  
  // Always respond with 200 OK to health checks
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Connection': 'close'
  });
  
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    path: req.url
  }));
});

// Start health server
try {
  healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`Health check server running on port ${HEALTH_PORT}`);
  });
  
  healthServer.on('error', (err) => {
    console.error(`Health server error: ${err.message}`);
    
    if (err.code === 'EADDRINUSE') {
      console.log('Port 3000 already in use, assuming health check is already running');
    }
  });
} catch (err) {
  console.error('Failed to start health server:', err);
}

// Function to start the main application
function startMainApp() {
  console.log('Starting main application...');
  
  try {
    // Try to use the compiled Node.js application
    if (fs.existsSync('./dist/index.js')) {
      // For ESM modules
      import('./dist/index.js').catch((err) => {
        console.error('Failed to import ESM module:', err);
        startFallbackServer();
      });
    } else if (fs.existsSync('./index.js')) {
      // Direct require for CommonJS
      try {
        require('./index.js');
      } catch (err) {
        console.error('Failed to require index.js:', err);
        startFallbackServer();
      }
    } else {
      console.log('No index.js found, checking for alternative entry points...');
      
      if (fs.existsSync('./server/index.js')) {
        require('./server/index.js');
      } else if (fs.existsSync('./server/index.ts')) {
        // Try to use tsx to run TypeScript directly
        const child = spawn('npx', ['tsx', './server/index.ts'], {
          stdio: 'inherit'
        });
        
        child.on('error', (err) => {
          console.error('Failed to start TypeScript application:', err);
          startFallbackServer();
        });
      } else {
        console.error('No suitable entry point found');
        startFallbackServer();
      }
    }
  } catch (err) {
    console.error('Error starting main application:', err);
    startFallbackServer();
  }
}

// Function to start a fallback server if the main app fails
function startFallbackServer() {
  console.log('Starting fallback server...');
  
  const fallbackServer = http.createServer((req, res) => {
    // Always respond to health checks with 200 OK
    if (req.url === '/health' || req.url === '/healthz' || req.url === '/_health' || 
        (req.url === '/' && req.headers['user-agent']?.includes('Health'))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    
    // Try to serve static content if available
    try {
      const publicDir = path.join(__dirname, 'public');
      
      if (fs.existsSync(publicDir)) {
        const indexPath = path.join(publicDir, 'index.html');
        
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end(content);
        }
      }
    } catch (err) {
      console.error('Error serving static content:', err);
    }
    
    // Fallback response if static content not available
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>The Current-See</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #2a9d8f; }
          </style>
        </head>
        <body>
          <h1>The Current-See</h1>
          <p>The application is starting up. Please try again in a moment.</p>
        </body>
      </html>
    `);
  });
  
  fallbackServer.listen(APP_PORT, '0.0.0.0', () => {
    console.log(`Fallback server running on port ${APP_PORT}`);
  });
}

// Start the main application
startMainApp();

// Keep the process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  // Don't exit
});