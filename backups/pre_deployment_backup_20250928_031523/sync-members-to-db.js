/**
 * The Current-See Database Sync Tool
 * 
 * This script syncs the members from members.json to the database
 */

const fs = require('fs');
const { Pool } = require('pg');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Log with colors
function log(message, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

// Generate a username from a member name
function generateUsername(name) {
  // Clean name, lowercase, replace spaces with dots
  const baseUsername = name.toLowerCase()
    .replace(/[^a-z0-9\s]/gi, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '.'); // Replace spaces with dots
  
  return baseUsername;
}

async function syncMembersToDb() {
  // Load members from file
  log('Loading members from members.json...', colors.cyan);
  const membersJson = fs.readFileSync('public/api/members.json', 'utf8');
  const members = JSON.parse(membersJson);
  log(`Loaded ${members.length} members from file`, colors.green);

  // Connect to database
  log('Connecting to database...', colors.cyan);
  const pool = new Pool({
    connectionString: process.env.CURRENTSEE_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Get existing members from database
    log('Fetching existing members from database...', colors.cyan);
    const { rows: existingMembers } = await pool.query('SELECT * FROM members');
    log(`Found ${existingMembers.length} members in database`, colors.blue);

    // Calculate differences
    const existingMemberNames = existingMembers.map(m => m.name);
    const fileOnlyMembers = members.filter(m => !existingMemberNames.includes(m.name));
    
    log(`Found ${fileOnlyMembers.length} members that need to be added to the database`, colors.yellow);
    
    // Add new members to database
    if (fileOnlyMembers.length > 0) {
      for (const member of fileOnlyMembers) {
        log(`Adding member to database: ${member.name}`, colors.magenta);
        
        const joinedDate = member.joinedDate || '2025-04-07'; // Default date if missing
        const totalSolar = typeof member.totalSolar === 'number' ? member.totalSolar : 
                          (typeof member.total_solar === 'number' ? member.total_solar : 0);
        const username = generateUsername(member.name);
        const email = member.email || `${username}@thecurrentsee.org`; // Default email if missing
        
        // Check for last distribution date, default to joined date
        const lastDistributionDate = member.lastDistributionDate || joinedDate;
        
        await pool.query(
          'INSERT INTO members (username, name, email, joined_date, total_solar, total_dollars, last_distribution_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [username, member.name, email, joinedDate, totalSolar, totalSolar * 136000, lastDistributionDate]
        );
        
        log(`✅ Added ${member.name} to database with username: ${username}`, colors.green);
      }
    } else {
      log('No new members to add', colors.green);
    }
    
    // Update solar amounts for existing members
    log('Updating SOLAR amounts for existing members...', colors.cyan);
    for (const fileMember of members) {
      const dbMember = existingMembers.find(m => m.name === fileMember.name);
      if (dbMember) {
        const fileSolar = typeof fileMember.totalSolar === 'number' ? fileMember.totalSolar : 
                         (typeof fileMember.total_solar === 'number' ? fileMember.total_solar : 0);
        
        if (Number(fileSolar) !== Number(dbMember.total_solar)) {
          log(`Updating ${fileMember.name} SOLAR from ${dbMember.total_solar} to ${fileSolar}`, colors.yellow);
          
          await pool.query(
            'UPDATE members SET total_solar = $1, total_dollars = $2 WHERE name = $3',
            [fileSolar, fileSolar * 136000, fileMember.name]
          );
          
          log(`✅ Updated ${fileMember.name} SOLAR amount`, colors.green);
        }
      }
    }
    
    log('Sync completed successfully! 🎉', colors.green);
  } catch (err) {
    log(`Error: ${err.message}`, colors.red);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

syncMembersToDb().catch(err => {
  log(`Unhandled error: ${err.message}`, colors.red);
  process.exit(1);
});