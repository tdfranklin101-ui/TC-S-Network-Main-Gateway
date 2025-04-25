/**
 * The Current-See - Update SOLAR Totals for All Members
 * 
 * This script updates all member SOLAR totals based on the 1 SOLAR per day distribution rule
 * from their join date to the current date.
 */

const fs = require('fs');
const path = require('path');

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const TODAY = new Date('2025-04-25');
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

// Main function
function updateSolarTotals() {
  console.log('Updating SOLAR totals based on 1 SOLAR per day since join date...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    let updateCount = 0;
    
    // Process each member
    for (const member of members) {
      // Skip reserves
      if (member.is_reserve) {
        console.log(`Skipping reserve account: ${member.name}`);
        continue;
      }
      
      const joinDate = member.joined_date;
      if (!joinDate) {
        console.log(`Warning: Member ${member.name} has no join date. Skipping.`);
        continue;
      }
      
      // Calculate days from join date to today (inclusive)
      const days = daysBetween(joinDate, TODAY.toISOString().split('T')[0]);
      
      // Calculate correct SOLAR amount
      const correctSolar = days * SOLAR_PER_DAY;
      const currentSolar = parseFloat(member.total_solar || 0);
      
      if (currentSolar !== correctSolar) {
        console.log(`Updating ${member.name} - Joined: ${joinDate}, Days: ${days}`);
        console.log(`  Current: ${currentSolar} SOLAR, Correct: ${correctSolar} SOLAR`);
        
        // Update SOLAR total
        member.total_solar = formatAmount(correctSolar);
        member.totalSolar = correctSolar;
        
        // Update dollar value
        const dollars = correctSolar * SOLAR_DOLLAR_VALUE;
        member.total_dollars = formatAmount(dollars);
        member.totalDollars = dollars;
        
        // Update last distribution date
        member.last_distribution_date = TODAY.toISOString().split('T')[0];
        member.lastDistributionDate = TODAY.toISOString().split('T')[0];
        
        updateCount++;
      }
    }
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    console.log(`SOLAR totals updated for ${updateCount} members.`);
    console.log('Updated members file saved successfully.');
    
    return { success: true, updated: updateCount };
  } catch (error) {
    console.error('Error updating SOLAR totals:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the update
updateSolarTotals();