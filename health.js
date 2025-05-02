/**
 * Standalone Health Check for The Current-See
 * 
 * This is a minimal health check module designed specifically for
 * Replit Cloud Run deployments. It responds to requests on port 3000
 * with a 200 OK status for successful health verification.
 */

// Simply require the main healthz.js file
require('./healthz');