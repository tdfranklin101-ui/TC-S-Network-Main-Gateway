/**
 * The Current-See May 19, 2025 Distribution Update
 * 
 * This script updates member SOLAR totals to match what they should be as of May 19, 2025
 */

const fs = require('fs');
const path = require('path');

// Constants
const TARGET_DATE = '2025-05-19';
const USD_PER_SOLAR = 136000;

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

// Calculate days between two dates (inclusive of start date)
function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Reset hours to ensure accurate day calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate difference in days
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Add 1 to include start date in the count (they get SOLAR on join date)
  return diffDays + 1;
}

// Calculate correct SOLAR for each member based on days since joining
function calculateCorrectSolar(members, targetDate) {
  for (const member of members) {
    // Get join date
    const joinDate = member.joinedDate || member.joined_date;
    if (!joinDate) {
      log(`Member ${member.name} has no join date, skipping`, colors.yellow);
      continue;
    }
    
    // If joined after target date, they should have 1 SOLAR
    if (new Date(joinDate) > new Date(targetDate)) {
      const newSolar = 1;
      
      // Update both formats
      member.totalSolar = newSolar;
      member.total_solar = newSolar.toFixed(4);
      
      // Calculate dollar value
      const newDollars = newSolar * USD_PER_SOLAR;
      member.totalDollars = newDollars;
      member.total_dollars = newDollars.toFixed(2);
      
      log(`${member.name} joined after target date, setting to ${newSolar} SOLAR`, colors.yellow);
      continue;
    }
    
    // Calculate days from join date to target date
    const days = daysBetween(joinDate, targetDate);
    
    // Calculate correct SOLAR (start with 1 SOLAR, plus 1 per day including join date)
    const newSolar = days;
    
    // Update both formats
    member.totalSolar = newSolar;
    member.total_solar = newSolar.toFixed(4);
    
    // Calculate dollar value
    const newDollars = newSolar * USD_PER_SOLAR;
    member.totalDollars = newDollars;
    member.total_dollars = newDollars.toFixed(2);
    
    // Update last distribution date
    member.lastDistributionDate = TARGET_DATE;
    member.last_distribution_date = TARGET_DATE;
    
    log(`Updated ${member.name}: ${days} days = ${newSolar} SOLAR ($${newDollars.toLocaleString()})`, colors.green);
  }
  
  return members;
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
    
    // Create a backup with today's date
    const backupDir = 'backup';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `members-${TARGET_DATE}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(members, null, 2));
    log(`Backup created at ${backupPath}`, colors.green);
    
    return true;
  } catch (error) {
    log(`Error saving members: ${error.message}`, colors.red);
    return false;
  }
}

// Main function to process distribution update
async function processMay19Distribution() {
  log(`=== The Current-See May 19, 2025 Distribution Update ===`, colors.blue);
  
  // Step 1: Load members
  const members = loadMembers();
  if (!members) {
    log('Failed to load members data, aborting', colors.red);
    return false;
  }
  
  // Step 2: Calculate correct SOLAR amounts
  const updatedMembers = calculateCorrectSolar(members, TARGET_DATE);
  
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
  
  log(`=== May 19, 2025 distribution update completed successfully ===`, colors.green);
  return true;
}

// Run the distribution
processMay19Distribution().then(success => {
  if (success) {
    log('May 19, 2025 SOLAR distribution has been processed successfully!', colors.green);
    
    // Create summary file
    try {
      const summary = {
        distributionDate: TARGET_DATE,
        distributionTime: new Date().toISOString(),
        status: 'SUCCESS'
      };
      
      fs.writeFileSync(`distribution-summary-${TARGET_DATE}.json`, JSON.stringify(summary, null, 2));
      log(`Distribution summary saved to distribution-summary-${TARGET_DATE}.json`, colors.green);
      
      process.exit(0);
    } catch (error) {
      log(`Error creating summary: ${error.message}`, colors.red);
      process.exit(1);
    }
  } else {
    log('Failed to process May 19, 2025 distribution', colors.red);
    process.exit(1);
  }
});