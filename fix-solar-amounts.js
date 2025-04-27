/**
 * The Current-See - Fix SOLAR Amounts
 * 
 * This script corrects the SOLAR amounts based on the proper day count
 * from join date to April 27, 2025
 */

const fs = require('fs');
const path = require('path');

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');
const FINAL_DATE = new Date('2025-04-27');
const SOLAR_PER_DAY = 1;
const SOLAR_DOLLAR_VALUE = 136000;

// Calculate days between two dates (inclusive)
function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set hours to 0 to avoid time zone issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Add 1 to include both start and end date
  return Math.round(Math.abs((end - start) / oneDay)) + 1;
}

// Format with 4 decimal places
function formatAmount(amount) {
  return amount.toFixed(4);
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

// Main function to fix SOLAR amounts
function fixSolarAmounts() {
  console.log('Fixing SOLAR amounts based on correct day count...');
  
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
      
      const joinDate = member.joined_date || member.joinedDate;
      if (!joinDate) {
        console.log(`Warning: Member ${member.name} has no join date. Skipping.`);
        continue;
      }
      
      // Calculate days from join date to end date (inclusive)
      const days = daysBetween(joinDate, FINAL_DATE.toISOString().split('T')[0]);
      
      // Calculate correct SOLAR amount
      const correctSolar = days * SOLAR_PER_DAY;
      const currentSolar = parseFloat(member.total_solar || member.totalSolar || 0);
      
      // If current SOLAR amount doesn't match what it should be
      if (currentSolar !== correctSolar) {
        console.log(`Updating ${member.name} - Joined: ${joinDate}`);
        console.log(`  Days since join: ${days} (inclusive)`);
        console.log(`  Current: ${currentSolar} SOLAR, Correct: ${correctSolar} SOLAR`);
        
        // Update SOLAR total
        member.total_solar = formatAmount(correctSolar);
        member.totalSolar = correctSolar;
        
        // Update dollar value
        const dollars = correctSolar * SOLAR_DOLLAR_VALUE;
        member.total_dollars = formatAmount(dollars);
        member.totalDollars = dollars;
        
        // Update last distribution date
        member.last_distribution_date = FINAL_DATE.toISOString().split('T')[0];
        member.lastDistributionDate = FINAL_DATE.toISOString().split('T')[0];
        
        updateCount++;
      } else {
        console.log(`${member.name} already has correct amount: ${correctSolar} SOLAR`);
      }
    }
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    console.log(`SOLAR amounts corrected for ${updateCount} members.`);
    console.log('Updated members file saved successfully.');
    
    return { success: true, updated: updateCount };
  } catch (error) {
    console.error('Error fixing SOLAR amounts:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the fix
fixSolarAmounts();