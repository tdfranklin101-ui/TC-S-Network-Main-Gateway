/**
 * Update Member Emails Utility
 * 
 * This script updates authentic emails for members in the database.
 * Specifically designed to fix placeholder emails for Alex and Kealani.
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
 * @returns {Promise<Object>} - Database result
 */
async function updateMemberEmail(memberId, email) {
  const result = await pool.query(
    'UPDATE members SET email = $1 WHERE id = $2 RETURNING *',
    [email, memberId]
  );
  return result.rows[0];
}

/**
 * Gets a member's current record from the database
 * @param {number} memberId - ID of the member
 * @returns {Promise<Object>} - Member record
 */
async function getMemberById(memberId) {
  const result = await pool.query(
    'SELECT * FROM members WHERE id = $1',
    [memberId]
  );
  return result.rows[0];
}

/**
 * Displays member information
 * @param {Object} member - Member record
 */
function displayMemberInfo(member) {
  console.log(`\nMember Details:`);
  console.log(`ID: ${member.id}`);
  console.log(`Name: ${member.name}`);
  console.log(`Email: ${member.email}`);
  console.log(`Joined Date: ${member.joined_date}`);
  console.log(`Username: ${member.username}`);
}

/**
 * Updates Alex and Kealani's email addresses in the database
 */
async function updateSpecificEmails() {
  try {
    // Get the current information for Alex (ID: 14)
    const alex = await getMemberById(14);
    console.log("Current information for Alex:");
    displayMemberInfo(alex);
    
    // Get the current information for Kealani (ID: 15)
    const kealani = await getMemberById(15);
    console.log("\nCurrent information for Kealani:");
    displayMemberInfo(kealani);
    
    // Prompt for new email addresses
    rl.question('\nEnter authentic email for Alex: ', async (alexEmail) => {
      if (!alexEmail.includes('@')) {
        console.log("Invalid email address. Please enter a valid email.");
        rl.close();
        return;
      }
      
      rl.question('Enter authentic email for Kealani Ventura: ', async (kealaniEmail) => {
        if (!kealaniEmail.includes('@')) {
          console.log("Invalid email address. Please enter a valid email.");
          rl.close();
          return;
        }
        
        try {
          // Update Alex's email
          const updatedAlex = await updateMemberEmail(14, alexEmail);
          console.log("\nAlex's email updated successfully:");
          displayMemberInfo(updatedAlex);
          
          // Update Kealani's email
          const updatedKealani = await updateMemberEmail(15, kealaniEmail);
          console.log("\nKealani's email updated successfully:");
          displayMemberInfo(updatedKealani);
          
          console.log("\nEmail updates completed successfully!");
        } catch (error) {
          console.error("Error updating emails:", error.message);
        } finally {
          rl.close();
          pool.end();
        }
      });
    });
  } catch (error) {
    console.error("Error:", error.message);
    rl.close();
    pool.end();
  }
}

// Main function
async function main() {
  try {
    console.log("Member Email Update Utility");
    console.log("==========================");
    await updateSpecificEmails();
  } catch (error) {
    console.error("Error in main function:", error.message);
    rl.close();
    pool.end();
  }
}

// Run the main function
main();