/**
 * The Current-See Database URL Checker
 * 
 * This script verifies that CURRENTSEE_DB_URL is working correctly
 */

const { Pool } = require('pg');

async function checkCustomDbUrl() {
  console.log('=== The Current-See Database URL Checker ===');
  
  const customDbUrl = process.env.CURRENTSEE_DB_URL;
  if (!customDbUrl) {
    console.error('❌ ERROR: CURRENTSEE_DB_URL is not set in the environment');
    return false;
  }
  
  console.log(`Using CURRENTSEE_DB_URL: ${customDbUrl.replace(/:[^:]*@/, ':***@')}`);
  
  try {
    // Try to connect with the custom URL
    console.log('Attempting to connect to database...');
    
    const pool = new Pool({
      connectionString: customDbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    // Check database info
    const dbInfoResult = await client.query('SELECT current_database() as db, current_user as user');
    console.log(`Connected to database: ${dbInfoResult.rows[0].db} as user: ${dbInfoResult.rows[0].user}`);
    
    // Check members table
    try {
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      console.log(`✅ Members table accessible. Found ${membersResult.rows[0].count} members.`);
      
      // Show first few members
      const firstMembersResult = await client.query('SELECT id, name, joined_date FROM members ORDER BY id ASC LIMIT 5');
      console.log('First members:');
      firstMembersResult.rows.forEach(member => {
        console.log(`  ${member.id}: ${member.name} (joined: ${member.joined_date})`);
      });
      
    } catch (tableErr) {
      console.error(`❌ Error accessing members table: ${tableErr.message}`);
      console.error('The database exists but the members table might not be properly set up.');
    }
    
    client.release();
    await pool.end();
    
    console.log('✅ CURRENTSEE_DB_URL is working correctly');
    return true;
  } catch (err) {
    console.error(`❌ Connection error: ${err.message}`);
    
    // Provide more detailed error info
    if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      console.error('DNS error: The database hostname cannot be resolved.');
      try {
        console.error(`Hostname: ${new URL(customDbUrl).hostname}`);
      } catch (e) {
        console.error('Invalid URL format in CURRENTSEE_DB_URL');
      }
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error('Connection refused: The database server is not accepting connections.');
    } else if (err.message.includes('password authentication failed')) {
      console.error('Authentication failed: Incorrect username or password.');
    } else if (err.message.includes('does not exist')) {
      console.error('Database not found: The specified database does not exist.');
    } else if (err.message.includes('ssl')) {
      console.error('SSL error: Try modifying the SSL settings.');
      console.error('For Neon databases, you need: ssl: { rejectUnauthorized: false }');
    }
    
    return false;
  }
}

// Run the check if this file is executed directly
if (require.main === module) {
  checkCustomDbUrl().then(success => {
    if (!success) {
      console.log('\nTrying fallback to DATABASE_URL...');
      
      // If CURRENTSEE_DB_URL failed, try DATABASE_URL as fallback
      if (process.env.DATABASE_URL) {
        const fallbackPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        fallbackPool.connect().then(client => {
          console.log('✅ Connected successfully using DATABASE_URL fallback');
          client.release();
          fallbackPool.end();
        }).catch(err => {
          console.error(`❌ Fallback connection also failed: ${err.message}`);
          process.exit(1);
        });
      } else {
        console.error('❌ No DATABASE_URL fallback available');
        process.exit(1);
      }
    }
  }).catch(err => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}

/**
 * Silent check if database is alive - returns true/false without logging
 * Used by check-version.js and other monitoring tools
 */
async function checkIsAlive() {
  try {
    const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
    if (!dbUrl) return false;
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    await client.query('SELECT 1'); // Simple query to check connection
    client.release();
    await pool.end();
    
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { checkCustomDbUrl, checkIsAlive };