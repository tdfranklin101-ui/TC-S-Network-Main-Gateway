/**
 * The Current-See Website Main Entry Point
 * 
 * This file serves as the primary entry point for The Current-See website
 * It launches the run-deployment.js script which manages the server with
 * automatic restart capability.
 */

console.log('Starting The Current-See deployment system...');

// Use require to execute the deployment script
require('./run-deployment.js');