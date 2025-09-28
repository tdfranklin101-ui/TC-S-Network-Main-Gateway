/**
 * Current-See Account Viewer
 * 
 * This utility allows viewing and exporting member information
 * from the database, including all account details like email addresses.
 */

const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

// Command line args
const args = process.argv.slice(2);
const command = args[0] || 'list';
const outputFormat = args[1] || 'console';
const outputFile = args[2] || `member_export_${new Date().toISOString().replace(/:/g, '-')}.json`;

// Format members for display
function formatMember(member) {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    email: member.email,
    joinedDate: member.joined_date,
    totalSolar: parseFloat(member.total_solar).toFixed(4),
    totalDollars: parseInt(member.total_dollars).toLocaleString(),
    isReserve: member.is_reserve ? 'Yes' : 'No',
    lastDistribution: member.last_distribution_date,
    signupTime: member.signup_timestamp
  };
}

// List all members
async function listMembers() {
  try {
    const result = await pool.query(`
      SELECT * FROM members 
      ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} members in the database:`);
    console.log('-'.repeat(100));
    
    if (outputFormat === 'console') {
      // Display in console
      result.rows.forEach(member => {
        const formattedMember = formatMember(member);
        console.log(`ID: ${formattedMember.id}`);
        console.log(`Name: ${formattedMember.name} (${formattedMember.username})`);
        console.log(`Email: ${formattedMember.email}`);
        console.log(`Joined: ${formattedMember.joinedDate}`);
        console.log(`SOLAR: ${formattedMember.totalSolar}`);
        console.log(`USD Value: $${formattedMember.totalDollars}`);
        console.log(`Reserve Account: ${formattedMember.isReserve}`);
        console.log(`Last Distribution: ${formattedMember.lastDistribution}`);
        if (formattedMember.signupTime) {
          console.log(`Signup Timestamp: ${formattedMember.signupTime}`);
        }
        console.log('-'.repeat(100));
      });
    } else if (outputFormat === 'json') {
      // Export to JSON file
      const outputPath = path.join(__dirname, outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(result.rows, null, 2));
      console.log(`Exported ${result.rows.length} members to ${outputPath}`);
    } else if (outputFormat === 'csv') {
      // Export to CSV
      const outputPath = path.join(__dirname, outputFile.replace('.json', '.csv'));
      
      // CSV header
      let csvContent = 'id,username,name,email,joined_date,total_solar,total_dollars,is_anonymous,is_reserve,is_placeholder,last_distribution_date,notes,signup_timestamp\n';
      
      // Add each row
      result.rows.forEach(member => {
        csvContent += [
          member.id,
          `"${member.username}"`,
          `"${member.name}"`,
          `"${member.email}"`,
          `"${member.joined_date}"`,
          member.total_solar,
          member.total_dollars,
          member.is_anonymous,
          member.is_reserve,
          member.is_placeholder,
          `"${member.last_distribution_date}"`,
          member.notes ? `"${member.notes}"` : '',
          member.signup_timestamp ? `"${member.signup_timestamp}"` : ''
        ].join(',') + '\n';
      });
      
      fs.writeFileSync(outputPath, csvContent);
      console.log(`Exported ${result.rows.length} members to ${outputPath}`);
    }
  } catch (error) {
    console.error('Error retrieving members:', error);
  } finally {
    await pool.end();
  }
}

// Get a specific member
async function getMember(id) {
  try {
    const result = await pool.query(`
      SELECT * FROM members 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      console.log(`No member found with ID ${id}`);
      return;
    }
    
    const member = result.rows[0];
    const formattedMember = formatMember(member);
    
    console.log(`Member Details for ID ${formattedMember.id}:`);
    console.log('-'.repeat(50));
    console.log(`Name: ${formattedMember.name} (${formattedMember.username})`);
    console.log(`Email: ${formattedMember.email}`);
    console.log(`Joined: ${formattedMember.joinedDate}`);
    console.log(`SOLAR: ${formattedMember.totalSolar}`);
    console.log(`USD Value: $${formattedMember.totalDollars}`);
    console.log(`Reserve Account: ${formattedMember.isReserve}`);
    console.log(`Last Distribution: ${formattedMember.lastDistribution}`);
    
    // Show additional details
    console.log(`Anonymous: ${member.is_anonymous ? 'Yes' : 'No'}`);
    console.log(`Placeholder: ${member.is_placeholder ? 'Yes' : 'No'}`);
    if (member.notes) console.log(`Notes: ${member.notes}`);
    if (member.signup_timestamp) {
      console.log(`Signup Timestamp: ${member.signup_timestamp}`);
    }
  } catch (error) {
    console.error(`Error retrieving member ${id}:`, error);
  } finally {
    await pool.end();
  }
}

// Display usage instructions
function showHelp() {
  console.log('Current-See Account Viewer');
  console.log('Usage:');
  console.log('  node view-accounts.js [command] [output-format] [output-file]');
  console.log('\nCommands:');
  console.log('  list       - List all members (default)');
  console.log('  get <id>   - Get details for a specific member');
  console.log('  help       - Show this help message');
  console.log('\nOutput Formats:');
  console.log('  console    - Display in console (default)');
  console.log('  json       - Export to JSON file');
  console.log('  csv        - Export to CSV file');
  console.log('\nExamples:');
  console.log('  node view-accounts.js list json members.json');
  console.log('  node view-accounts.js get 3');
}

// Main function
async function main() {
  if (command === 'help') {
    showHelp();
    return;
  }
  
  if (command === 'get' && args[1]) {
    await getMember(args[1]);
    return;
  }
  
  await listMembers();
}

// Run the main function
main().catch(console.error);