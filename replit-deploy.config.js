/**
 * The Current-See Replit Deployment Configuration
 * 
 * This file specifies how the application should be deployed on Replit.
 */

module.exports = {
  // The main entry point for your application
  entrypoint: "deployment-main.js",
  
  // Environment variables that should be transferred to deployment
  environmentVariables: [
    "DATABASE_URL",
    "PGHOST",
    "PGPORT",
    "PGUSER",
    "PGPASSWORD",
    "PGDATABASE",
    "MOBILE_APP_API_KEY",
    "NODE_ENV"
  ],
  
  // Files that should be included in the deployment
  includeFiles: [
    "public/**/*",
    "deployment-main.js",
    "deployment-db-fix.js",
    "server/**/*",
    "package.json",
    "package-lock.json"
  ],
  
  // Run this script before deployment
  beforeDeploy: async () => {
    const fs = require('fs');
    const { Pool } = require('pg');
    
    console.log('Running pre-deployment checks...');
    
    // Check database connection
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      const client = await pool.connect();
      const result = await client.query('SELECT current_database() as db, current_user as user');
      console.log(`Connected to database: ${result.rows[0].db} as user: ${result.rows[0].user}`);
      
      // Check members
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      console.log(`Found ${membersResult.rows[0].count} members in the database.`);
      
      // Create backup
      const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
      fs.writeFileSync('members.json', JSON.stringify(allMembersResult.rows, null, 2));
      console.log(`Created members backup with ${allMembersResult.rows.length} members.`);
      
      client.release();
      await pool.end();
      
      return true;
    } catch (err) {
      console.error(`Database connection error: ${err.message}`);
      return false;
    }
  },
  
  // Run health check after deployment
  healthCheck: {
    path: "/health",
    expectedStatus: 200,
    expectedResponse: {
      status: "ok"
    }
  },
  
  // SSL configuration
  ssl: {
    enabled: true,
    forceRedirect: true
  }
};