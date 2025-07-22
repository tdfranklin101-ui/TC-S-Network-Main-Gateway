/**
 * Update Alex and Kealani's Emails
 * 
 * Simple utility script to update the authentic emails for Alex and Kealani.
 * This script updates their emails directly in the database.
 */

const { Pool } = require('pg');
const readline = require('readline');

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Updates a member's email in the database
 * @param {number} memberId - ID of the member
 * @param {string} email - New authentic email address
 * @returns {Promise<Object>} - Member data
 */
async function updateEmail(memberId, email) {
  const result = await pool.query(
    'UPDATE members SET email = $1 WHERE id = $2 RETURNING *',
    [email, memberId]
  );
  return result.rows[0];
}

/**
 * Gets member information
 * @param {number} memberId - ID of the member
 * @returns {Promise<Object>} - Member data
 */
async function getMember(memberId) {
  const result = await pool.query(
    'SELECT * FROM members WHERE id = $1',
    [memberId]
  );
  return result.rows[0];
}

/**
 * Display member information
 * @param {Object} member - Member data
 */
function displayMember(member) {
  console.log(`\nMember ID: ${member.id}`);
  console.log(`Name: ${member.name}`);
  console.log(`Email: ${member.email}`);
  console.log(`Username: ${member.username}`);
  console.log(`Joined Date: ${member.joined_date}`);
  console.log(`Total SOLAR: ${member.total_solar}`);
  console.log(`Last Distribution: ${member.last_distribution_date}`);
}

// Main function
async function main() {
  try {
    console.log('Update Alex and Kealani Email Utility');
    console.log('====================================');
    
    // Alex has ID 14
    const alex = await getMember(14);
    console.log('\nAlex\'s current information:');
    displayMember(alex);
    
    // Kealani has ID 15
    const kealani = await getMember(15);
    console.log('\nKealani\'s current information:');
    displayMember(kealani);
    
    console.log('\nReady to update their authentic email addresses.');
    rl.question('\nEnter Alex\'s authentic email: ', async (alexEmail) => {
      if (!alexEmail || !alexEmail.includes('@')) {
        console.log('Invalid email format. Alex\'s email not updated.');
      } else {
        const updatedAlex = await updateEmail(14, alexEmail);
        console.log('\nAlex\'s information updated:');
        displayMember(updatedAlex);
      }
      
      rl.question('\nEnter Kealani\'s authentic email: ', async (kealaniEmail) => {
        if (!kealaniEmail || !kealaniEmail.includes('@')) {
          console.log('Invalid email format. Kealani\'s email not updated.');
        } else {
          const updatedKealani = await updateEmail(15, kealaniEmail);
          console.log('\nKealani\'s information updated:');
          displayMember(updatedKealani);
        }
        
        console.log('\nEmail update process complete.');
        await pool.end();
        rl.close();
      });
    });
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    rl.close();
  }
}

// Run the main function
main();