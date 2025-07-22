/**
 * Check Current-See Database Members
 * 
 * This script displays the current members in the database
 */

const { Pool } = require('pg');

async function main() {
  // Connect to database
  console.log('Connecting to database...');
  
  const pool = new Pool({
    connectionString: process.env.CURRENTSEE_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Get members from database
    console.log('Fetching members from database...');
    const { rows: members } = await pool.query('SELECT * FROM members ORDER BY id');
    console.log(`Found ${members.length} members in database.\n`);

    // Display member info
    console.log('Member Information:');
    console.log('===================\n');
    
    members.forEach((member, index) => {
      console.log(`${index+1}. ${member.name}`);
      console.log(`   Username: ${member.username}`);
      console.log(`   Joined: ${member.joined_date}`);
      console.log(`   SOLAR: ${member.total_solar}`);
      console.log(`   USD: $${member.total_dollars}`);
      console.log(`   Last Distribution: ${member.last_distribution_date}`);
      console.log('');
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);