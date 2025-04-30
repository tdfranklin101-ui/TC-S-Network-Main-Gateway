/**
 * The Current-See Member Count Test
 * 
 * This script checks the number of members in the embedded-members.json file
 * and verifies that Terry and JF have the correct SOLAR amounts.
 */

const fs = require('fs');
const path = require('path');

// Path to the embedded members file
const MEMBERS_FILE = path.join(__dirname, 'public/embedded-members.json');

console.log('Running member count and SOLAR verification test...');

// Load the members data
try {
  const membersData = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
  console.log(`Total members found: ${membersData.length}`);
  
  // Check if we have all 16 members
  if (membersData.length === 16) {
    console.log('✓ PASS: Found all 16 members');
  } else {
    console.log(`✗ FAIL: Expected 16 members, found ${membersData.length}`);
  }
  
  // Find Terry and check SOLAR
  const terry = membersData.find(m => m.username === 'terry.franklin');
  if (terry) {
    console.log(`Terry joined: ${terry.joinedDate}, SOLAR: ${terry.totalSolar}`);
    if (terry.totalSolar >= 22) {
      console.log('✓ PASS: Terry has correct SOLAR amount');
    } else {
      console.log(`✗ FAIL: Terry should have 22+ SOLAR, has ${terry.totalSolar}`);
    }
  } else {
    console.log('✗ FAIL: Could not find Terry in members data');
  }
  
  // Find JF and check SOLAR
  const jf = membersData.find(m => m.username === 'j.franklin');
  if (jf) {
    console.log(`JF joined: ${jf.joinedDate}, SOLAR: ${jf.totalSolar}`);
    if (jf.totalSolar >= 21) {
      console.log('✓ PASS: JF has correct SOLAR amount');
    } else {
      console.log(`✗ FAIL: JF should have 21+ SOLAR, has ${jf.totalSolar}`);
    }
  } else {
    console.log('✗ FAIL: Could not find JF in members data');
  }
  
} catch (error) {
  console.error(`ERROR: ${error.message}`);
}

console.log('\nVerification test complete.');