/**
 * Main Entry Point for Replit Deployment
 * 
 * This file handles the startup process for Replit deployments,
 * ensuring both health check and main application servers run properly.
 */

// Start health check server on port 3000
require('./replit-health-handler');

// Try to start the main application through various means
console.log('Starting main application...');

try {
  // First try loading the main application as an ESM module
  import('./dist/index.js')
    .catch(err => {
      console.error('Error starting main application as ESM module:', err);
      fallbackToAlternatives();
    });
} catch (e) {
  console.error('Error importing main application:', e);
  fallbackToAlternatives();
}

function fallbackToAlternatives() {
  console.log('Trying alternative startup methods...');
  
  const methods = [
    () => {
      console.log('Trying to run dist/server.js...');
      require('./dist/server.js');
    },
    () => {
      console.log('Trying to run server.js...');
      require('./server.js');
    },
    () => {
      console.log('Trying to run start.sh...');
      const { execSync } = require('child_process');
      execSync('./start.sh', { stdio: 'inherit' });
    }
  ];
  
  // Try each method in sequence
  for (let i = 0; i < methods.length; i++) {
    try {
      methods[i]();
      console.log(`Application started with method ${i + 1}`);
      return; // Stop if successful
    } catch (err) {
      console.error(`Method ${i + 1} failed:`, err);
    }
  }
  
  console.log('All methods failed, but health check server will remain running');
}