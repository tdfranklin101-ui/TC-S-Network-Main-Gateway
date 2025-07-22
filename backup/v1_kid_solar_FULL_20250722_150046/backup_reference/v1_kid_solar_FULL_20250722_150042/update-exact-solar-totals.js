/**
 * The Current-See - Update SOLAR Totals to Exact Values
 * 
 * This script updates specific members' SOLAR totals to match exact values.
 */

const fs = require('fs');
const path = require('path');

// Constants for SOLAR calculations
const SOLAR_CONSTANTS = {
  USD_PER_SOLAR: 136000 // $136,000 per SOLAR
};

// Path constants
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMBERS_FILE = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_FILE = path.join(PUBLIC_DIR, 'embedded-members');

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

// Main function to update SOLAR amounts
function updateExactSolarTotals() {
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
    
    // Define the exact totals for each member by name
    const exactTotals = {
      "Terry D. Franklin": 30,
      "JF": 29,
      "TC-S Solar Reserve": 10000000004,
      "Solar Reserve": 10000000005,
      "Davis": 21,
      "Miles Franklin": 21,
      "Arden F": 20,
      "Marissa Hasseman": 20,
      "Kim": 20,
      "Jeff Elmore": 20,
      "Liam McKay": 20,
      "KJM": 19,
      "Brianna": 19,
      "John D": 19,
      "Alex": 18,
      "Kealani Ventura": 18,
      "Test User": 13,
      "Erin lee": 1
    };
    
    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Track members that need updates
    let updatedCount = 0;
    
    // Process each member
    members.forEach(member => {
      // Skip the "You are next" placeholder
      if (member.id === 'next' || member.name === 'You are next' || 
          member.is_placeholder === true || member.isPlaceholder === true) {
        return; // Skip this entry
      }
      
      // Get the exact total for this member
      const exactTotal = exactTotals[member.name];
      
      // Skip if no exact total defined
      if (exactTotal === undefined) {
        console.warn(`No exact total defined for member: ${member.name}`);
        return;
      }
      
      // Get current total
      const currentTotal = parseFloat(member.totalSolar || member.total_solar || 0);
      
      // Skip if already correct
      if (Math.abs(currentTotal - exactTotal) < 0.0001) {
        console.log(`Member ${member.name} already has correct total: ${exactTotal}`);
        return;
      }
      
      // Update totals
      member.totalSolar = exactTotal;
      member.total_solar = formatAmount(exactTotal);
      
      // Update dollar values
      const dollarValue = exactTotal * SOLAR_CONSTANTS.USD_PER_SOLAR;
      member.totalDollars = dollarValue;
      member.total_dollars = formatAmount(dollarValue);
      
      // Set last distribution date to today
      member.lastDistributionDate = todayStr;
      member.last_distribution_date = todayStr;
      
      updatedCount++;
      console.log(`Updated ${member.name}: ${currentTotal} -> ${exactTotal} SOLAR`);
    });
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
    console.log(`Saved updated members to ${MEMBERS_FILE}`);
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    // Log summary
    console.log(`=== SUMMARY ===
Updated members: ${updatedCount}
Total members processed: ${members.length}
    `);
    
  } catch (error) {
    console.error(`Error updating SOLAR totals: ${error.message}`);
  }
}

// Run the update
updateExactSolarTotals();