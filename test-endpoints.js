/**
 * Test script to directly access the embedded-members.json file
 * and compare its content with what's returned from the server
 */
const fs = require('fs');
const path = require('path');

// Load the embedded-members.json file directly
const embeddedPath = path.join(__dirname, 'public', 'embedded-members.json');
let fileMembers = [];

if (fs.existsSync(embeddedPath)) {
  try {
    const fileContent = fs.readFileSync(embeddedPath, 'utf8');
    fileMembers = JSON.parse(fileContent);
    console.log(`File contains ${fileMembers.length} members`);
    console.log(`TC-S Solar Reserve in file: ${fileMembers.some(m => m.name === 'TC-S Solar Reserve')}`);
    console.log(`Terry in file: ${fileMembers.some(m => m.name === 'Terry D. Franklin')}`);
    console.log(`JF in file: ${fileMembers.some(m => m.name === 'JF')}`);
    
    // Examine what reserves look like in the data
    const reserves = fileMembers.filter(m => m.isReserve === true);
    console.log(`Reserve accounts in file: ${reserves.length}`);
    if (reserves.length > 0) {
      console.log('First reserve account:', JSON.stringify(reserves[0], null, 2));
    }
    
    // Fix problem code - for educational purposes
    const fixedArray = fileMembers.filter(m => true); // keep all members
    console.log(`After dummy filter: ${fixedArray.length} members`);
    console.log(`TC-S Solar Reserve after filter: ${fixedArray.some(m => m.name === 'TC-S Solar Reserve')}`);
    
    // Investigate common filtering patterns
    const noReserveFilter = fileMembers.filter(m => !m.isReserve);
    console.log(`After removing reserves: ${noReserveFilter.length} members`);
    console.log(`TC-S Solar Reserve after removing reserves: ${noReserveFilter.some(m => m.name === 'TC-S Solar Reserve')}`);
  } catch (error) {
    console.error(`Error parsing embedded-members.json: ${error.message}`);
  }
} else {
  console.error('embedded-members.json file not found');
}
