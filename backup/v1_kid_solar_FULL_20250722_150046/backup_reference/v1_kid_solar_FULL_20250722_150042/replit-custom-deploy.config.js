/**
 * The Current-See Replit Deployment Configuration
 * 
 * This file specifically handles the CURRENTSEE_DB_URL environment variable
 */

module.exports = {
  // The main entry point for your application using the custom DB script
  entrypoint: "deploy-currentsee-db.js",
  
  // Environment variables that should be transferred to deployment
  environmentVariables: [
    "CURRENTSEE_DB_URL", // Primary database URL
    "DATABASE_URL",      // Fallback database URL
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
    "deploy-currentsee-db.js",
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
    
    // Check if CURRENTSEE_DB_URL is set
    if (process.env.CURRENTSEE_DB_URL) {
      console.log('CURRENTSEE_DB_URL is set. Using this for database connection.');
      
      try {
        const pool = new Pool({
          connectionString: process.env.CURRENTSEE_DB_URL,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        const client = await pool.connect();
        const result = await client.query('SELECT current_database() as db, current_user as user');
        console.log(`Connected to database using CURRENTSEE_DB_URL: ${result.rows[0].db} as user: ${result.rows[0].user}`);
        
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
        console.error(`CURRENTSEE_DB_URL connection error: ${err.message}`);
        console.error('Falling back to DATABASE_URL if available');
        
        // Try DATABASE_URL as fallback
        if (process.env.DATABASE_URL) {
          try {
            const fallbackPool = new Pool({
              connectionString: process.env.DATABASE_URL,
              ssl: {
                rejectUnauthorized: false
              }
            });
            
            const fallbackClient = await fallbackPool.connect();
            console.log('Connected to database using DATABASE_URL fallback');
            fallbackClient.release();
            await fallbackPool.end();
            
            return true;
          } catch (fallbackErr) {
            console.error(`Fallback database connection error: ${fallbackErr.message}`);
            return false;
          }
        } else {
          console.error('No fallback DATABASE_URL available');
          return false;
        }
      }
    } else if (process.env.DATABASE_URL) {
      console.log('CURRENTSEE_DB_URL is not set. Using DATABASE_URL instead.');
      
      try {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        const client = await pool.connect();
        const result = await client.query('SELECT current_database() as db, current_user as user');
        console.log(`Connected to database using DATABASE_URL: ${result.rows[0].db} as user: ${result.rows[0].user}`);
        
        client.release();
        await pool.end();
        
        return true;
      } catch (err) {
        console.error(`DATABASE_URL connection error: ${err.message}`);
        return false;
      }
    } else {
      console.error('Neither CURRENTSEE_DB_URL nor DATABASE_URL is set');
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