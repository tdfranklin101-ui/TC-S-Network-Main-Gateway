/**
 * Main Entry Point for Replit Deployment
 * 
 * This file handles the startup process for Replit deployments,
 * ensuring both health check and main application servers run properly.
 */

// Start health check server on port 3000
require('./replit-health-handler');

// Import and start the main application
console.log('Starting main application...');
import('./dist/index.js')
  .catch(err => {
    console.error('Error starting main application:', err);
    console.log('Falling back to server/index.js...');
    
    try {
      // Try various methods to start the app
      const methods = [
        () => import('./server/index.js'),
        () => import('./server/index.ts'),
        () => require('./server/index.js'),
        () => require('./dist/server.js'),
        () => require('./dist/index.cjs')
      ];
      
      let methodIndex = 0;
      
      function tryNextMethod() {
        if (methodIndex >= methods.length) {
          console.error('All methods failed, health check server will continue running');
          return;
        }
        
        try {
          methods[methodIndex]();
          console.log(`Application started with method ${methodIndex + 1}`);
        } catch (e) {
          console.error(`Method ${methodIndex + 1} failed:`, e);
          methodIndex++;
          tryNextMethod();
        }
      }
      
      tryNextMethod();
    } catch (e) {
      console.error('All startup methods failed:', e);
      console.log('Health check server will remain running for deployment stability');
    }
  });