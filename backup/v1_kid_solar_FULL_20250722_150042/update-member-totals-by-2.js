/**
 * The Current-See - Update Member Totals by 2
 * 
 * This script adds 2 to each member's SOLAR total
 */

const fs = require('fs');
const path = require('path');

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');
const SOLAR_DOLLAR_VALUE = 136000;

// Format with 4 decimal places
function formatAmount(amount) {
  return amount.toFixed(4);
}

// Update embedded members file
function updateEmbeddedMembersFile(members) {
  try {
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

// Main function to update SOLAR amounts
function addTwoToMemberTotals() {
  console.log('Adding 2 SOLAR to each member total...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    let updateCount = 0;
    
    // Process each member
    for (const member of members) {
      // Skip reserves and placeholders
      if (member.is_reserve || member.isReserve || member.isPlaceholder) {
        console.log(`Skipping reserve/placeholder account: ${member.name}`);
        continue;
      }
      
      // Get current SOLAR amount
      const currentSolar = parseFloat(member.total_solar || member.totalSolar || 0);
      
      // Add 2 SOLAR to the total
      const newSolar = currentSolar + 2;
      
      console.log(`Updating ${member.name} from ${currentSolar} to ${newSolar} SOLAR`);
      
      // Update SOLAR total
      member.total_solar = formatAmount(newSolar);
      member.totalSolar = newSolar;
      
      // Update dollar value
      const dollars = newSolar * SOLAR_DOLLAR_VALUE;
      member.total_dollars = formatAmount(dollars);
      member.totalDollars = dollars;
      
      updateCount++;
    }
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    console.log(`Added 2 SOLAR to ${updateCount} members.`);
    console.log('Updated members file saved successfully.');
    
    return { success: true, updated: updateCount };
  } catch (error) {
    console.error('Error updating SOLAR amounts:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the update
addTwoToMemberTotals();