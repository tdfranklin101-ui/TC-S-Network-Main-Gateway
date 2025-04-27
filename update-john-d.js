/**
 * Update John D's join date and recalculate SOLAR
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

// Update John D's join date
function updateJohnD() {
  console.log('Updating John D\'s join date to April 26, 2025...');
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Find John D
    const johnD = members.find(member => 
      member.name === "John D" && member.email === "johnd@example.com");
    
    if (!johnD) {
      console.error('John D not found in members file');
      return { success: false, error: 'John D not found' };
    }
    
    // Update join date
    const newJoinDate = '2025-04-26';
    console.log(`Changing John D's join date from ${johnD.joined_date} to ${newJoinDate}`);
    johnD.joined_date = newJoinDate;
    
    // Calculate correct SOLAR amount
    const days = daysBetween(newJoinDate, FINAL_DATE.toISOString().split('T')[0]);
    const correctSolar = days * SOLAR_PER_DAY;
    
    console.log(`Days since join: ${days} (inclusive of ${newJoinDate} and ${FINAL_DATE.toISOString().split('T')[0]})`);
    console.log(`Correct SOLAR amount: ${correctSolar}`);
    
    // Update SOLAR total
    johnD.total_solar = formatAmount(correctSolar);
    
    // Update dollar value
    const dollars = correctSolar * SOLAR_DOLLAR_VALUE;
    johnD.total_dollars = formatAmount(dollars);
    
    // Update last distribution date
    johnD.last_distribution_date = FINAL_DATE.toISOString().split('T')[0];
    
    // Save updated members
    fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    updateEmbeddedMembersFile(members);
    
    console.log('John D updated successfully.');
    return { success: true };
  } catch (error) {
    console.error('Error updating John D:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the update
updateJohnD();