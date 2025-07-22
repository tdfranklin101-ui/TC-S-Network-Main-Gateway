/**
 * The Current-See - Fix SOLAR Totals
 * 
 * This script calculates and fixes SOLAR totals for all members
 * based on their join date up to May 23, 2025.
 */

const fs = require('fs');
const path = require('path');

// Current date for calculations
const TODAY = new Date('2025-05-23');
const SOLAR_VALUE = 136000; // $136,000 per SOLAR

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Add 1 to include the join date in the count
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function formatAmount(amount) {
  return amount.toFixed(4);
}

function fixSolarAmounts() {
  console.log('Starting SOLAR amount verification and correction...');
  
  // Load the members file
  const membersPath = path.join('public', 'api', 'members.json');
  const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
  
  let changesNeeded = false;
  
  // Process each member
  members.forEach(member => {
    // Skip the placeholder member
    if (member.isPlaceholder || member.is_placeholder) {
      console.log(`Skipping placeholder member: ${member.name}`);
      return;
    }
    
    const joinDate = member.joinedDate || member.joined_date;
    const daysActive = daysBetween(joinDate, TODAY);
    
    // Calculate correct SOLAR totals
    const correctTotal = daysActive;
    const correctDollars = correctTotal * SOLAR_VALUE;
    
    console.log(`Member: ${member.name}`);
    console.log(`  Join Date: ${joinDate} (${daysActive} days active)`);
    console.log(`  Current SOLAR: ${member.totalSolar}`);
    console.log(`  Correct SOLAR: ${correctTotal}`);
    
    // Check if correction is needed
    if (member.totalSolar !== correctTotal) {
      console.log(`  [CORRECTION NEEDED] Updating ${member.name} from ${member.totalSolar} to ${correctTotal} SOLAR`);
      changesNeeded = true;
      
      // Update both formats of the total solar
      member.totalSolar = correctTotal;
      member.totalDollars = correctDollars;
      member.total_solar = formatAmount(correctTotal);
      member.total_dollars = formatAmount(correctDollars);
    } else {
      console.log(`  [VERIFIED] ${member.name} has correct SOLAR total of ${correctTotal}`);
    }
  });
  
  // If changes were needed, save the updated file
  if (changesNeeded) {
    // Backup the original file
    const backupPath = path.join('deployment_backups', 'may23_2025_members_backup.json');
    fs.mkdirSync(path.join('deployment_backups', 'may23_2025'), { recursive: true });
    fs.copyFileSync(membersPath, backupPath);
    console.log(`Original members file backed up to ${backupPath}`);
    
    // Save the updated file
    fs.writeFileSync(membersPath, JSON.stringify(members, null, 2));
    console.log('Members file updated with corrected SOLAR totals');
    
    // Update the embedded members file as well
    const embeddedPath = path.join('public', 'embedded-members');
    fs.writeFileSync(
      embeddedPath,
      `const EMBEDDED_MEMBERS = ${JSON.stringify(members, null, 2)};\n`
    );
    console.log('Embedded members file updated with corrected SOLAR totals');
  } else {
    console.log('No corrections needed, all SOLAR totals are mathematically accurate');
  }
}

// Execute the function
fixSolarAmounts();