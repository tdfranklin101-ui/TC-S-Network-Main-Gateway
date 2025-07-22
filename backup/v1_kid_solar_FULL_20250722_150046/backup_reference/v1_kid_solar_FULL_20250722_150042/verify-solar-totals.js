// SOLAR calculation verification script
const fs = require('fs');
const path = require('path');

// Load the members file
const membersPath = path.join('public', 'api', 'members.json');
const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));

// Calculate correct SOLAR totals based on join date to today (May 23, 2025)
const today = new Date('2025-05-23');
let hasErrors = false;

console.log('===== SOLAR Calculation Verification Report =====');
console.log('Calculating correct SOLAR distribution based on join date to May 23, 2025');
console.log('-----------------------------------------------');

members.forEach(member => {
  // Skip placeholder
  if (member.isPlaceholder) {
    console.log();
    return;
  }
  
  const joinDate = new Date(member.joinedDate);
  const daysActive = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24)) + 1; // Include join day
  
  // Each member gets 1 SOLAR at signup + 1 SOLAR per day
  const correctTotal = daysActive;
  const currentTotal = member.totalSolar;
  
  // Calculate dollar amount at 36,000 per SOLAR
  const correctDollars = correctTotal * 136000;
  
  console.log();
  console.log();
  console.log();
  console.log();
  console.log();
  
  if (correctTotal !== currentTotal) {
    console.log();
    hasErrors = true;
  } else {
    console.log();
  }
  console.log('-----------------------------------------------');
});

if (hasErrors) {
  console.log('❌ Some SOLAR totals need correction.');
} else {
  console.log('✓ All SOLAR totals are mathematically correct.');
}

