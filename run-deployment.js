/**
 * The Current-See Deployment Runner
 * 
 * This is the main entry point for the Replit deployment.
 * It handles starting the server and setting up necessary environment.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const SERVER_SCRIPT = 'deploy-server.js';
const HEALTH_SCRIPT = 'health.js';
const LOG_FILE = 'deployment-server.log';
const PORT = process.env.PORT || 3001;

// Helper function to log messages
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Also append to log file
  fs.appendFileSync(LOG_FILE, `${logMessage}\n`);
}

// Main function to run the deployment
async function runDeployment() {
  log('Starting The Current-See deployment...');
  
  // Check if necessary files exist
  if (!fs.existsSync(SERVER_SCRIPT)) {
    log(`Error: ${SERVER_SCRIPT} not found`, true);
    process.exit(1);
  }
  
  // Check if data directory exists, create if not
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    log('Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Ensure the public directory and embedded-members.json exist
  const publicDir = path.join(__dirname, 'public');
  const embeddedPath = path.join(publicDir, 'embedded-members.json');
  
  if (!fs.existsSync(publicDir)) {
    log('Error: public directory not found', true);
    process.exit(1);
  }
  
  // Log environment information
  log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  log(`Server port: ${PORT}`);
  
  try {
    // Start the main server
    log('Starting deployment server...');
    
    const server = spawn('node', [SERVER_SCRIPT], {
      env: { ...process.env, PORT },
      stdio: 'inherit'
    });
    
    server.on('error', (err) => {
      log(`Server error: ${err.message}`, true);
    });
    
    server.on('exit', (code, signal) => {
      if (code !== 0) {
        log(`Server exited with code ${code} and signal ${signal}`, true);
        
        // Try to restart the server after a delay
        log('Attempting to restart server in 5 seconds...');
        setTimeout(() => {
          runDeployment();
        }, 5000);
      }
    });
    
    // Log successful start
    log('Deployment server started successfully');
    
    // Use health check script as fallback
    if (fs.existsSync(HEALTH_SCRIPT)) {
      // Start health check as a separate process (only if main server fails)
      server.on('exit', () => {
        log('Starting health check server as fallback...');
        
        const healthServer = spawn('node', [HEALTH_SCRIPT], {
          env: { ...process.env, PORT },
          stdio: 'inherit'
        });
        
        healthServer.on('error', (err) => {
          log(`Health server error: ${err.message}`, true);
        });
      });
    }
  } catch (error) {
    log(`Failed to start deployment: ${error.message}`, true);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('Received SIGINT signal, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM signal, shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.stack}`, true);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`, true);
});

// Start the deployment
runDeployment();