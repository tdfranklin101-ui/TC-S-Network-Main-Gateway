/**
 * Current-See Server with Database Support
 * 
 * This wrapper script starts the server with database support
 * ensuring all user registrations are properly stored in the
 * PostgreSQL database.
 */

// Create a log entry showing we're starting the database-supported server
console.log('Starting Current-See server with database support...');
console.log(`Server start time: ${new Date().toISOString()}`);
console.log('Database-backed storage will be used for all member operations');

// Start the server
require('./server-db');