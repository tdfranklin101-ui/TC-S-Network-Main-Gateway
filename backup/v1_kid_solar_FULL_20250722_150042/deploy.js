/**
 * The Current-See Deployment Script
 * 
 * This script launches the pure-deployment.js server
 * with proper environment configuration.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_FILE = 'pure-deployment.js';
const LOG_FILE = 'deploy.log';
const ENV_FILES = [
  '.env',
  '.env.openai'
];

// Logger
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
  
  // Also write to log file
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${prefix}: ${message}\n`);
}

// Check if server file exists
if (!fs.existsSync(SERVER_FILE)) {
  log(`Server file not found: ${SERVER_FILE}`, true);
  process.exit(1);
}

// Log start
log('Starting The Current-See deployment process...');
log(`Server file: ${SERVER_FILE}`);
log(`Log file: ${LOG_FILE}`);
log(`Node version: ${process.version}`);
log(`Working directory: ${process.cwd()}`);

// Load environment variables
let env = { ...process.env };
for (const envFile of ENV_FILES) {
  if (fs.existsSync(envFile)) {
    log(`Loading environment from ${envFile}`);
    const content = fs.readFileSync(envFile, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          if (key && value) {
            // Remove quotes if present
            const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
            env[key] = cleanValue;
            log(`Set environment variable: ${key}=${key.includes('API') ? '***' : cleanValue}`);
          }
        }
      }
    }
  } else {
    log(`Environment file not found: ${envFile}`);
  }
}

// Set NODE_ENV to production
env.NODE_ENV = 'production';
log('Set NODE_ENV=production');

// Start server
log('Starting server...');
const server = spawn('node', [SERVER_FILE], { env, stdio: 'inherit' });

// Handle server events
server.on('error', (error) => {
  log(`Server error: ${error.message}`, true);
});

server.on('close', (code) => {
  if (code === 0) {
    log('Server exited normally');
  } else {
    log(`Server exited with code ${code}`, true);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  server.kill('SIGINT');
});