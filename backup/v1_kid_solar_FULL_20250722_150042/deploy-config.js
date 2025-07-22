/**
 * The Current-See Deployment Configuration
 * 
 * This file contains deployment settings for the application.
 * It's used to configure the deployment behavior for Replit.
 */

module.exports = {
  // Main server file to run
  mainFile: 'deploy-ready.js',
  
  // Fallback health check file
  healthCheck: 'health-check.js',
  
  // Deployment type (static, dynamic, or hybrid)
  deploymentType: 'hybrid',
  
  // Port configuration
  port: process.env.PORT || 3000,
  
  // Files to include in deployment
  include: [
    'public/**/*',
    'deploy-ready.js',
    'health-check.js',
    'package.json'
  ],
  
  // Files to exclude from deployment
  exclude: [
    'node_modules',
    '.git',
    '*.zip',
    'minimal-deploy',
    'full-deployment'
  ]
};