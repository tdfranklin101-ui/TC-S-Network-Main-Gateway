/**
 * Simple test script to check member counts from different endpoints and debug the issue
 */
const http = require('http');
const fs = require('fs');

// Function to fetch data from a URL
function fetchData(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });
  });
}

// Function to get member count
async function getMemberCount(url, label) {
  try {
    console.log(`Checking ${label}...`);
    const data = await fetchData(url);
    const count = Array.isArray(data) ? data.length : (data.count || 'unknown');
    const reserveCount = Array.isArray(data) ? data.filter(m => m.isReserve === true).length : 0;
    
    console.log(`${label}: ${count} total members`);
    if (Array.isArray(data)) {
      console.log(`  of which ${reserveCount} are reserve accounts`);
      
      // Check if TC-S Solar Reserve is present
      const reserve = data.find(m => m.name === "TC-S Solar Reserve");
      console.log(`  TC-S Solar Reserve: ${reserve ? 'Present' : 'Missing'}`);
      
      // Check if Terry D. Franklin is present
      const terry = data.find(m => m.name === "Terry D. Franklin");
      console.log(`  Terry D. Franklin: ${terry ? 'Present' : 'Missing'}`);
      
      // Check if JF is present
      const jf = data.find(m => m.name === "JF");
      console.log(`  JF: ${jf ? 'Present' : 'Missing'}`);
    }
    
    return count;
  } catch (error) {
    console.error(`Error checking ${label}: ${error.message}`);
    return 'error';
  }
}

// Main test function
async function runTest() {
  console.log('Testing member counts from all endpoints...\n');
  
  try {
    // Check file directly
    try {
      console.log('Checking embedded-members.json file directly:');
      const fileData = fs.readFileSync('./public/embedded-members.json', 'utf8');
      const fileMembers = JSON.parse(fileData);
      console.log(`File contains: ${fileMembers.length} members`);
      
      const fileReserveCount = fileMembers.filter(m => m.isReserve === true).length;
      console.log(`  of which ${fileReserveCount} are reserve accounts`);
      
      // Check for specific important members
      console.log(`  TC-S Solar Reserve: ${fileMembers.some(m => m.name === 'TC-S Solar Reserve') ? 'Present' : 'Missing'}`);
      console.log(`  Terry D. Franklin: ${fileMembers.some(m => m.name === 'Terry D. Franklin') ? 'Present' : 'Missing'}`); 
      console.log(`  JF: ${fileMembers.some(m => m.name === 'JF') ? 'Present' : 'Missing'}`);
    } catch (fileError) {
      console.error(`Error checking file: ${fileError.message}`);
    }
    
    console.log('\nChecking API endpoints:');
    
    // Check each endpoint
    await getMemberCount('http://localhost:3001/api/members.json', 'members.json API');
    await getMemberCount('http://localhost:3001/api/members', 'members API');
    await getMemberCount('http://localhost:3001/embedded-members', 'embedded-members endpoint');
    await getMemberCount('http://localhost:3001/api/member-count', 'member-count API');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
runTest();