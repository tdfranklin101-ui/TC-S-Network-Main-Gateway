/**
 * Email Restore Utility
 * 
 * This utility script helps recover and restore authentic email addresses
 * from the email logger system and updates them in the database.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Logger paths
const LOG_DIR = path.join(__dirname, 'logs');
const EMAIL_LOG_FILE = path.join(LOG_DIR, 'signup-emails.log');
const EMAIL_REGISTRY_FILE = path.join(LOG_DIR, 'email-registry.json');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Find an email address for a member by name
 * @param {string} name - Member name to search for
 * @returns {string|null} - Found email address or null
 */
function findEmailByName(name) {
  try {
    if (!fs.existsSync(EMAIL_LOG_FILE)) {
      console.log('Email log file does not exist yet.');
      return null;
    }
    
    const logContent = fs.readFileSync(EMAIL_LOG_FILE, 'utf8');
    const lines = logContent.trim().split('\n');
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.name.toLowerCase() === name.toLowerCase()) {
          console.log(`Found email for ${name}: ${entry.email}`);
          return entry.email;
        }
      } catch (e) {
        // Skip invalid lines
        continue;
      }
    }
    
    console.log(`No email found for ${name}`);
    return null;
  } catch (error) {
    console.error('Error searching email logs:', error);
    return null;
  }
}

/**
 * Updates a member's email in the database
 * @param {number} memberId - ID of the member to update
 * @param {string} email - New email address
 * @returns {Promise<Object>} - Updated member record
 */
async function updateMemberEmail(memberId, email) {
  try {
    const result = await pool.query(
      'UPDATE members SET email = $1 WHERE id = $2 RETURNING *',
      [email, memberId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating member ID ${memberId}:`, error);
    throw error;
  }
}

/**
 * Gets a member record by ID
 * @param {number} memberId - ID of the member
 * @returns {Promise<Object|null>} - Member record or null
 */
async function getMemberById(memberId) {
  try {
    const result = await pool.query(
      'SELECT * FROM members WHERE id = $1',
      [memberId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching member ID ${memberId}:`, error);
    return null;
  }
}

/**
 * Gets a member record by name
 * @param {string} name - Name of the member
 * @returns {Promise<Object|null>} - Member record or null
 */
async function getMemberByName(name) {
  try {
    const result = await pool.query(
      'SELECT * FROM members WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching member by name "${name}":`, error);
    return null;
  }
}

/**
 * Display member information
 * @param {Object} member - Member record
 */
function displayMember(member) {
  console.log('\nMember Information:');
  console.log(`ID: ${member.id}`);
  console.log(`Name: ${member.name}`);
  console.log(`Email: ${member.email}`);
  console.log(`Username: ${member.username}`);
  console.log(`Joined Date: ${member.joined_date}`);
  console.log(`Last Distribution: ${member.last_distribution_date}`);
  console.log(`Total SOLAR: ${member.total_solar}`);
}

/**
 * Restore Alex and Kealani's emails explicitly
 */
async function restoreSpecificEmails() {
  try {
    console.log('\nChecking for Alex in database...');
    const alex = await getMemberByName('Alex');
    
    if (alex) {
      console.log('Found Alex in the database:');
      displayMember(alex);
      
      rl.question('\nEnter authentic email for Alex (or press Enter to skip): ', async (alexEmail) => {
        if (alexEmail && alexEmail.includes('@')) {
          const updatedAlex = await updateMemberEmail(alex.id, alexEmail);
          console.log('\nUpdated Alex with new email:');
          displayMember(updatedAlex);
        } else if (alexEmail) {
          console.log('Invalid email format, skipping Alex update.');
        } else {
          console.log('Skipping Alex update.');
        }
        
        console.log('\nChecking for Kealani in database...');
        const kealani = await getMemberByName('Kealani Ventura');
        
        if (kealani) {
          console.log('Found Kealani in the database:');
          displayMember(kealani);
          
          rl.question('\nEnter authentic email for Kealani (or press Enter to skip): ', async (kealaniEmail) => {
            if (kealaniEmail && kealaniEmail.includes('@')) {
              const updatedKealani = await updateMemberEmail(kealani.id, kealaniEmail);
              console.log('\nUpdated Kealani with new email:');
              displayMember(updatedKealani);
            } else if (kealaniEmail) {
              console.log('Invalid email format, skipping Kealani update.');
            } else {
              console.log('Skipping Kealani update.');
            }
            
            console.log('\nEmail update process complete.');
            rl.close();
            pool.end();
          });
        } else {
          console.log('Could not find Kealani in the database.');
          rl.close();
          pool.end();
        }
      });
    } else {
      console.log('Could not find Alex in the database.');
      
      console.log('\nChecking for Kealani in database...');
      const kealani = await getMemberByName('Kealani Ventura');
      
      if (kealani) {
        console.log('Found Kealani in the database:');
        displayMember(kealani);
        
        rl.question('\nEnter authentic email for Kealani (or press Enter to skip): ', async (kealaniEmail) => {
          if (kealaniEmail && kealaniEmail.includes('@')) {
            const updatedKealani = await updateMemberEmail(kealani.id, kealaniEmail);
            console.log('\nUpdated Kealani with new email:');
            displayMember(updatedKealani);
          } else if (kealaniEmail) {
            console.log('Invalid email format, skipping Kealani update.');
          } else {
            console.log('Skipping Kealani update.');
          }
          
          console.log('\nEmail update process complete.');
          rl.close();
          pool.end();
        });
      } else {
        console.log('Could not find Kealani in the database.');
        rl.close();
        pool.end();
      }
    }
  } catch (error) {
    console.error('Error during email restoration:', error);
    rl.close();
    pool.end();
  }
}

/**
 * Check all members for placeholder emails and attempt to recover them
 */
async function checkAllPlaceholderEmails() {
  try {
    const result = await pool.query(
      "SELECT * FROM members WHERE email LIKE '%example.com'"
    );
    
    const placeholderMembers = result.rows;
    console.log(`\nFound ${placeholderMembers.length} members with placeholder emails:`);
    
    for (const member of placeholderMembers) {
      console.log(`\n${member.id}. ${member.name} - ${member.email}`);
      
      // Check if we can find their email in our logs
      const recoveredEmail = findEmailByName(member.name);
      
      if (recoveredEmail) {
        const response = await new Promise(resolve => {
          rl.question(`Recovered email ${recoveredEmail} for ${member.name}. Update database? (Y/n): `, answer => {
            resolve(answer.toLowerCase() !== 'n');
          });
        });
        
        if (response) {
          const updatedMember = await updateMemberEmail(member.id, recoveredEmail);
          console.log(`✅ Updated ${member.name}'s email to ${updatedMember.email}`);
        }
      } else {
        console.log(`No email found in logs for ${member.name}`);
      }
    }
    
    console.log('\nPlaceholder email check complete.');
    rl.close();
    pool.end();
  } catch (error) {
    console.error('Error checking placeholder emails:', error);
    rl.close();
    pool.end();
  }
}

// Main function
async function main() {
  console.log('Email Restore Utility');
  console.log('====================');
  
  rl.question(
    'Choose an option:\n1. Restore Alex and Kealani emails\n2. Check all placeholder emails\nEnter choice (1 or 2): ',
    choice => {
      if (choice === '1') {
        restoreSpecificEmails();
      } else if (choice === '2') {
        checkAllPlaceholderEmails();
      } else {
        console.log('Invalid choice, exiting.');
        rl.close();
        pool.end();
      }
    }
  );
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
  pool.end();
  process.exit(1);
});