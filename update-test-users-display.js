/**
 * Update test users display settings
 * 
 * This script marks the older test user record (April 20) as hidden from public display
 * while maintaining its SOLAR distribution in the system.
 */

const fs = require('fs');
const path = require('path');

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');

// Update embedded members file
function updateEmbeddedMembersFile(members) {
  try {
    // Create embedded-members file with the correct JavaScript prefix
    fs.writeFileSync(
      EMBEDDED_MEMBERS_PATH,
      `window.embeddedMembers = ${JSON.stringify(members)};`
    );
    console.log('Embedded members file updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating embedded members file:', error.message);
    return false;
  }
}

// Update test users visibility
function updateTestUsersDisplay() {
  console.log('Updating test users display settings...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Find the test user from April 20
    const oldTestUser = members.find(member => 
      member.notes === "Test User" && member.joinedDate === "2025-04-20");
    
    if (!oldTestUser) {
      console.log('April 20 test user not found with expected format. Trying alternate format...');
      // Try alternate format
      const oldTestUserAlt = members.find(member => 
        (member.name === "Test User" || member.notes === "Test User") && 
        (member.joined_date === "2025-04-20" || member.joinedDate === "2025-04-20"));
      
      if (!oldTestUserAlt) {
        console.error('April 20 test user not found in any format');
        return { success: false, error: 'April 20 test user not found' };
      }
      
      console.log('Found April 20 test user in alternate format');
      // Mark as hidden from public display
      oldTestUserAlt.hidden_from_public = true;
      oldTestUserAlt.hiddenFromPublic = true;
    } else {
      console.log('Found April 20 test user');
      // Mark as hidden from public display
      oldTestUser.hidden_from_public = true;
      oldTestUser.hiddenFromPublic = true;
    }
    
    // Find John D (April 26)
    const johnD = members.find(member => 
      member.name === "John D" && member.email === "johnd@example.com");
    
    if (johnD) {
      console.log('Found John D (April 26)');
      // Ensure visible
      johnD.hidden_from_public = false;
      johnD.hiddenFromPublic = false;
    } else {
      console.log('Note: John D record not found');
    }
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    console.log('Test users display settings updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Error updating test users display settings:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the update
updateTestUsersDisplay();