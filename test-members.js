/**
 * Simple test script to load members from different sources
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

// Function to check if data contains expected members
function checkForKeyMembers(data, source) {
  console.log(`\nChecking ${source} (${data.length} members):`);
  
  // Check for TC-S Solar Reserve
  const reserve = data.find(m => m.name === "TC-S Solar Reserve");
  console.log(`TC-S Solar Reserve: ${reserve ? 'Found' : 'Not found'}`);
  if (reserve) {
    console.log(`  SOLAR: ${reserve.totalSolar}`);
  }
  
  // Check for Terry Franklin
  const terry = data.find(m => m.name === "Terry D. Franklin");
  console.log(`Terry D. Franklin: ${terry ? 'Found' : 'Not found'}`);
  if (terry) {
    console.log(`  SOLAR: ${terry.totalSolar}`);
    console.log(`  Joined: ${terry.joinedDate}`);
  }
  
  // Check for JF
  const jf = data.find(m => m.name === "JF");
  console.log(`JF: ${jf ? 'Found' : 'Not found'}`);
  if (jf) {
    console.log(`  SOLAR: ${jf.totalSolar}`);
    console.log(`  Joined: ${jf.joinedDate}`);
  }
}

// Main execution
async function main() {
  try {
    console.log('Testing members data sources...');
    
    // Test embedded-members.json file
    try {
      console.log('\nTesting embedded-members.json file:');
      const fileData = fs.readFileSync('./public/embedded-members.json', 'utf8');
      const embeddedMembers = JSON.parse(fileData);
      checkForKeyMembers(embeddedMembers, 'embedded-members.json file');
    } catch (error) {
      console.error(`Error with embedded-members.json: ${error.message}`);
    }
    
    // Test embedded-members endpoint
    try {
      console.log('\nTesting embedded-members endpoint:');
      const embeddedEndpoint = await fetchData('http://localhost:3001/embedded-members');
      checkForKeyMembers(embeddedEndpoint, 'embedded-members endpoint');
    } catch (error) {
      console.error(`Error with embedded-members endpoint: ${error.message}`);
    }
    
    // Test API endpoint
    try {
      console.log('\nTesting API endpoint:');
      const apiEndpoint = await fetchData('http://localhost:3001/api/members.json');
      checkForKeyMembers(apiEndpoint, 'API endpoint');
    } catch (error) {
      console.error(`Error with API endpoint: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
main();