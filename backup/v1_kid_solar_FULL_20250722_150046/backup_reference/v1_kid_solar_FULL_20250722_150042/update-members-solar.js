/**
 * The Current-See Member SOLAR Update Tool
 * 
 * This script manually updates SOLAR totals for all members
 * and ensures the correct display on the public members page.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Log message with color
function log(message, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

// Load members data
function loadMembers() {
  try {
    const membersFilePath = 'public/api/members.json';
    if (!fs.existsSync(membersFilePath)) {
      log(`Members file not found: ${membersFilePath}`, colors.red);
      return null;
    }
    
    const membersData = fs.readFileSync(membersFilePath, 'utf8');
    const members = JSON.parse(membersData);
    
    log(`Loaded ${members.length} members from ${membersFilePath}`, colors.green);
    return members;
  } catch (error) {
    log(`Error loading members: ${error.message}`, colors.red);
    return null;
  }
}

// Calculate SOLAR for a member based on join date
function calculateSolarForMember(member) {
  try {
    // Extract join date from either property
    const joinDateStr = member.joinedDate || member.joined_date;
    if (!joinDateStr) {
      log(`Member ${member.name} has no join date, skipping`, colors.yellow);
      return member;
    }
    
    // Parse dates
    const joinDate = new Date(joinDateStr);
    const today = new Date();
    
    // Calculate days since joining (including today)
    const daysSinceJoining = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate SOLAR (start with 1 + 1 for each day since joining)
    const solarAmount = Math.max(1, daysSinceJoining);
    
    // Update both formats of the property
    member.totalSolar = solarAmount;
    member.total_solar = solarAmount.toFixed(4);
    
    // Calculate dollar value ($136,000 per SOLAR)
    const dollarValue = solarAmount * 136000;
    member.totalDollars = dollarValue;
    member.total_dollars = dollarValue.toFixed(2);
    
    // Also update last distribution date to today
    const todayStr = today.toISOString().split('T')[0];
    member.lastDistributionDate = todayStr;
    member.last_distribution_date = todayStr;
    
    log(`Updated ${member.name}: ${solarAmount.toFixed(2)} SOLAR ($${dollarValue.toLocaleString()})`, colors.green);
    
    return member;
  } catch (error) {
    log(`Error calculating SOLAR for ${member.name}: ${error.message}`, colors.red);
    return member;
  }
}

// Update embedded-members file
function updateEmbeddedMembers(members) {
  try {
    const embeddedPath = 'public/embedded-members';
    fs.writeFileSync(embeddedPath, `const EMBEDDED_MEMBERS = ${JSON.stringify(members)};`);
    log(`Updated embedded-members with ${members.length} members`, colors.green);
    return true;
  } catch (error) {
    log(`Error updating embedded-members: ${error.message}`, colors.red);
    return false;
  }
}

// Save updated members data
function saveMembers(members) {
  try {
    const membersFilePath = 'public/api/members.json';
    fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2));
    log(`Saved ${members.length} members to ${membersFilePath}`, colors.green);
    return true;
  } catch (error) {
    log(`Error saving members: ${error.message}`, colors.red);
    return false;
  }
}

// Main function
async function updateMembersSolar() {
  log('=== The Current-See Member SOLAR Update Tool ===', colors.blue);
  
  // Step 1: Load members
  const members = loadMembers();
  if (!members) {
    log('Failed to load members data, aborting', colors.red);
    return false;
  }
  
  // Step 2: Update each member's SOLAR amount
  const updatedMembers = members.map(member => calculateSolarForMember(member));
  
  // Step 3: Save updated members data
  const saveSuccess = saveMembers(updatedMembers);
  if (!saveSuccess) {
    log('Failed to save updated members data', colors.red);
    return false;
  }
  
  // Step 4: Update embedded-members file
  const embeddedSuccess = updateEmbeddedMembers(updatedMembers);
  if (!embeddedSuccess) {
    log('Failed to update embedded-members file', colors.red);
    return false;
  }
  
  log('=== Member SOLAR update completed successfully ===', colors.green);
  return true;
}

// Run the update
updateMembersSolar().then(success => {
  if (success) {
    log('Member SOLAR amounts have been updated successfully!', colors.green);
    process.exit(0);
  } else {
    log('Failed to update member SOLAR amounts', colors.red);
    process.exit(1);
  }
});