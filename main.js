/**
 * The Current-See Main Entry Point
 * 
 * This file is a compatibility wrapper that redirects to index.js
 * This ensures compatibility with existing Replit deploy configuration.
 */

// Import our actual implementation from index.js
// This allows us to keep the .replit config pointing to main.js
// while using our simplified deployment-friendly code in index.js
require('./index.js');