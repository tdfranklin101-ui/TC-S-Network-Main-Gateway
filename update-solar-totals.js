/**
 * The Current-See - Update SOLAR Totals
 * 
 * This script updates all members' SOLAR totals based on 1 SOLAR per day
 * since their join date (inclusive of join date).
 */

const fs = require('fs');
const path = require('path');

// Constants for SOLAR calculations
const SOLAR_CONSTANTS = {
  USD_PER_SOLAR: 136000, // $136,000 per SOLAR
  KWH_PER_SOLAR: 4913    // 4,913 kWh per SOLAR
};

// Path constants
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMBERS_FILE = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_FILE = path.join(PUBLIC_DIR, 'embedded-members');

// Calculate days between dates (inclusive)
function daysBetween(startDate, endDate) {
  // Parse dates if they are strings
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  // Reset time to midnight to count full days only
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate difference in days, then add 1 to make it inclusive
  const diffInTime = end.getTime() - start.getTime();
  const diffInDays = Math.floor(diffInTime / (1000 * 60 * 60 * 24));
  
  // Add 1 for inclusive counting (the join date counts as day 1)
  return diffInDays + 1;
}

// Format number with 4 decimal places
function formatAmount(amount) {
  return parseFloat(amount).toFixed(4);
}

// Update embedded members file
function updateEmbeddedMembersFile(members) {
  try {
    fs.writeFileSync(EMBEDDED_MEMBERS_FILE, 
      `const EMBEDDED_MEMBERS = ${JSON.stringify(members)};`);
    console.log('Updated embedded-members file');
  } catch (error) {
    console.error(`Error updating embedded-members file: ${error.message}`);
  }
}

// Main function to fix SOLAR amounts
function updateSolarTotals() {
  try {
    // Check if members file exists
    if (!fs.existsSync(MEMBERS_FILE)) {
      console.error(`Members file not found at ${MEMBERS_FILE}`);
      return;
    }
    
    // Read members data
    const membersData = fs.readFileSync(MEMBERS_FILE, 'utf8');
    const members = JSON.parse(membersData);
    console.log(`Loaded ${members.length} members from ${MEMBERS_FILE}`);
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Track members that need updates
    let updatedCount = 0;
    let unchangedCount = 0;
    let reserveCount = 0;
    
    // Process each member
    members.forEach(member => {
      // Skip the "You are next" placeholder and reserve accounts
      if (member.id === 'next' || member.name === 'You are next' || 
          member.is_placeholder === true || member.isPlaceholder === true ||
          member.is_reserve === true || member.isReserve === true) {
        
        if (member.is_reserve === true || member.isReserve === true) {
          reserveCount++;
        }
        
        return; // Skip this entry
      }
      
      // Get joined date (either camelCase or snake_case)
      const joinDateStr = member.joinedDate || member.joined_date;
      
      if (!joinDateStr) {
        console.warn(`Member ${member.name} has no join date, skipping`);
        return;
      }
      
      // Calculate days since joining
      const joinDate = new Date(joinDateStr);
      const daysSinceJoining = daysBetween(joinDate, today);
      
      // New total should be equal to number of days since joining (inclusive)
      const newTotal = daysSinceJoining;
      
      // Get current total
      const currentTotal = parseFloat(member.totalSolar || member.total_solar || 0);
      
      // Check if update is needed
      if (Math.abs(currentTotal - newTotal) < 0.0001) {
        unchangedCount++;
        return; // No update needed
      }
      
      // Update totals
      member.totalSolar = newTotal;
      member.total_solar = formatAmount(newTotal);
      
      // Update dollar values
      const dollarValue = newTotal * SOLAR_CONSTANTS.USD_PER_SOLAR;
      member.totalDollars = dollarValue;
      member.total_dollars = formatAmount(dollarValue);
      
      // Set last distribution date to today
      const todayStr = today.toISOString().split('T')[0];
      member.lastDistributionDate = todayStr;
      member.last_distribution_date = todayStr;
      
      updatedCount++;
      console.log(`Updated ${member.name}: ${currentTotal} -> ${newTotal} SOLAR (${daysSinceJoining} days since ${joinDateStr})`);
    });
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
    console.log(`Saved updated members to ${MEMBERS_FILE}`);
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    // Log summary
    console.log(`
=== SUMMARY ===
Updated members: ${updatedCount}
Unchanged members: ${unchangedCount}
Skipped reserve accounts: ${reserveCount}
Total members processed: ${members.length}
    `);
    
  } catch (error) {
    console.error(`Error updating SOLAR totals: ${error.message}`);
  }
}

// Run the update
updateSolarTotals();