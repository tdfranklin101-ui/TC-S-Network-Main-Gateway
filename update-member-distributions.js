/**
 * The Current-See - April 27 Distribution Update
 * 
 * This script updates distribution amounts for specific members to include the 4/27/2025 distribution
 * and restores the John D test user to the system
 */

const fs = require('fs');
const path = require('path');

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');
const TODAY = new Date('2025-04-27');
const SOLAR_PER_DAY = 1;
const SOLAR_DOLLAR_VALUE = 136000;

// Function to restore the John D test user
function restoreJohnDTestUser() {
  console.log('Restoring John D test user to the system...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Check if John D already exists
    const johnDExists = members.some(member => 
      member.name === 'John D' || 
      (member.username && member.username.toLowerCase().includes('johnd'))
    );
    
    if (johnDExists) {
      console.log('John D user already exists, no need to restore');
      return false;
    }
    
    // Find placeholder index
    const placeholderIndex = members.findIndex(m => m.name === 'You are next' || m.isPlaceholder);
    
    // Find the max ID to ensure we use a unique one
    const maxId = members.reduce((max, member) => 
      typeof member.id === 'number' && member.id > max ? member.id : max, 0);
    
    // Create John D test user
    const johnDUser = {
      id: maxId + 1,
      username: "john.d",
      name: "John D",
      email: "johnd@example.com",
      joined_date: "2025-04-20",
      total_solar: "7.0000",
      total_dollars: "952000.0000",
      is_anonymous: false,
      is_reserve: false,
      is_placeholder: false,
      last_distribution_date: "2025-04-27",
      notes: "Test User",
      signup_timestamp: "2025-04-20T12:00:00.000Z",
      totalSolar: 7,
      totalDollars: 952000,
      joinedDate: "2025-04-20",
      lastDistributionDate: "2025-04-27"
    };
    
    console.log(`Adding John D test user with ID: ${johnDUser.id}`);
    
    // Remove placeholder if it exists
    if (placeholderIndex !== -1) {
      members.splice(placeholderIndex, 1);
    }
    
    // Add John D user
    members.push(johnDUser);
    
    // Add placeholder back at the end
    members.push({
      id: "next",
      username: "you.are.next",
      name: "You are next",
      email: "you.are.next@thecurrentsee.org",
      joinedDate: TODAY.toISOString().split('T')[0],
      totalSolar: 1.00,
      totalDollars: SOLAR_DOLLAR_VALUE,
      isAnonymous: false,
      isPlaceholder: true,
      lastDistributionDate: TODAY.toISOString().split('T')[0]
    });
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    console.log('John D test user successfully added.');
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    return true;
  } catch (error) {
    console.error('Error restoring John D test user:', error.message);
    return false;
  }
}

// Function to update distribution amounts
function updateDistributions() {
  console.log('Updating distribution amounts for April 27, 2025...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    let updateCount = 0;
    
    // Range of users to update (Terry D Franklin to Liam McKay)
    const targetUsers = [
      "Terry D. Franklin",
      "JF",
      "Davis",
      "Miles Franklin",
      "Arden F",
      "Marissa Hasseman",
      "Chris Bently",
      "Liam McKay"
    ];
    
    // Process each member
    for (const member of members) {
      // Skip reserves
      if (member.is_reserve) {
        continue;
      }
      
      // Check if this member is in our target list
      if (targetUsers.includes(member.name)) {
        // Check if already updated for 4/27
        if (member.last_distribution_date === "2025-04-27" || member.lastDistributionDate === "2025-04-27") {
          console.log(`Member ${member.name} already updated for 4/27/2025`);
          continue;
        }
        
        console.log(`Updating ${member.name} to include 4/27/2025 distribution`);
        
        // Get current SOLAR amount
        const currentSolar = parseFloat(member.total_solar || member.totalSolar || 0);
        
        // Add 1 SOLAR for the additional day
        const newSolar = currentSolar + SOLAR_PER_DAY;
        
        // Update SOLAR total
        member.total_solar = newSolar.toFixed(4);
        member.totalSolar = newSolar;
        
        // Update dollar value
        const dollars = newSolar * SOLAR_DOLLAR_VALUE;
        member.total_dollars = dollars.toFixed(4);
        member.totalDollars = dollars;
        
        // Update last distribution date
        member.last_distribution_date = TODAY.toISOString().split('T')[0];
        member.lastDistributionDate = TODAY.toISOString().split('T')[0];
        
        console.log(`  Updated from ${currentSolar} SOLAR to ${newSolar} SOLAR`);
        updateCount++;
      }
    }
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    console.log(`Distribution amounts updated for ${updateCount} members.`);
    console.log('Updated members file saved successfully.');
    
    return { success: true, updated: updateCount };
  } catch (error) {
    console.error('Error updating distribution amounts:', error.message);
    return { success: false, error: error.message };
  }
}

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

// Run the updates
console.log('=== Starting Member Distribution Update ===');
updateDistributions();
console.log('\n=== Restoring John D Test User ===');
restoreJohnDTestUser();
console.log('\n=== Update Complete ===');