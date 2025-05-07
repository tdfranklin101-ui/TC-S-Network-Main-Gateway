/**
 * Update SOLAR Totals Script
 * 
 * This script updates SOLAR totals for all members based on their join date
 * calculating 1 SOLAR per day from join date to current date.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMBERS_FILE = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_FILE = path.join(PUBLIC_DIR, 'embedded-members');

// Constants
const SOLAR_VALUE_USD = 136000; // $136,000 per SOLAR

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Calculate days between two dates (inclusive)
function daysBetween(startDate, endDate) {
  // Convert dates to Date objects if they are strings
  if (typeof startDate === 'string') {
    startDate = new Date(startDate);
  }
  if (typeof endDate === 'string') {
    endDate = new Date(endDate);
  }
  
  // Reset time part for accurate day calculation
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  // Calculate difference in days (add 1 for inclusive count)
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Return days + 1 for inclusive count (the day they joined counts as a day)
  return diffDays + 1;
}

// Format amount to 4 decimal places
function formatAmount(amount) {
  return parseFloat(amount).toFixed(4);
}

// Update members file with accurate SOLAR totals
function updateMembersFile() {
  try {
    // Read members from backup
    const backupMembersPath = path.join(__dirname, 'pre_restore_backup_20250507_190621', 'public', 'api', 'members.json');
    const backupMembersData = fs.readFileSync(backupMembersPath, 'utf8');
    let members = JSON.parse(backupMembersData);

    // Current date
    const currentDate = new Date();
    const currentDateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Update SOLAR totals for each member
    members.forEach(member => {
      if (member.is_reserve || member.isReserve) {
        // Skip reserve accounts - keep their original values
        log(`Skipping reserve account: ${member.name}`);
        return;
      }
      
      // Get join date
      const joinDate = member.joined_date || member.joinedDate;
      if (!joinDate) {
        log(`Member ${member.name} has no join date, skipping`, true);
        return;
      }
      
      // Calculate days since join date (inclusive)
      const days = daysBetween(joinDate, currentDate);
      
      // Each day is 1 SOLAR
      const totalSolar = days;
      
      // Calculate dollar value
      const totalDollars = totalSolar * SOLAR_VALUE_USD;
      
      // Update values for both formats (some entries use different property names)
      member.totalSolar = totalSolar;
      member.total_solar = formatAmount(totalSolar);
      member.totalDollars = totalDollars;
      member.total_dollars = formatAmount(totalDollars);
      member.lastDistributionDate = currentDateStr;
      member.last_distribution_date = currentDateStr;
      
      log(`Updated ${member.name}: ${days} days = ${totalSolar} SOLAR = $${totalDollars.toLocaleString()}`);
    });
    
    // Sort members by join date (earliest first)
    members.sort((a, b) => {
      // Keep reserves at the top
      if ((a.is_reserve || a.isReserve) && !(b.is_reserve || b.isReserve)) return -1;
      if (!(a.is_reserve || a.isReserve) && (b.is_reserve || b.isReserve)) return 1;
      
      // Keep placeholder at the bottom
      if ((a.is_placeholder || a.isPlaceholder) && !(b.is_placeholder || b.isPlaceholder)) return 1;
      if (!(a.is_placeholder || a.isPlaceholder) && (b.is_placeholder || b.isPlaceholder)) return -1;
      
      // Sort by join date for regular members
      const dateA = a.joined_date || a.joinedDate || '9999-99-99';
      const dateB = b.joined_date || b.joinedDate || '9999-99-99';
      
      return dateA.localeCompare(dateB);
    });
    
    log('Sorted members by join date (earliest first)');
    members.forEach((member, index) => {
      const joinDate = member.joined_date || member.joinedDate || 'No Date';
      log(`${index + 1}. ${member.name} - Joined: ${joinDate}`);
    });

    // Create api directory if it doesn't exist
    const apiDir = path.join(PUBLIC_DIR, 'api');
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
      log(`Created API directory: ${apiDir}`);
    }

    // Write updated members back to file
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
    log(`Updated ${members.length} members in ${MEMBERS_FILE}`);

    // Update embedded-members file
    const embeddedData = `const EMBEDDED_MEMBERS = ${JSON.stringify(members, null, 2)};`;
    fs.writeFileSync(EMBEDDED_MEMBERS_FILE, embeddedData);
    log(`Updated embedded members file: ${EMBEDDED_MEMBERS_FILE}`);

    return members;
  } catch (error) {
    log(`Error updating members: ${error.message}`, true);
    throw error;
  }
}

// Main function
function main() {
  log('Starting SOLAR totals update...');
  
  try {
    const updatedMembers = updateMembersFile();
    log(`Successfully updated SOLAR totals for ${updatedMembers.length} members based on join date`);
  } catch (error) {
    log(`Failed to update SOLAR totals: ${error.message}`, true);
  }
}

// Run the main function
main();