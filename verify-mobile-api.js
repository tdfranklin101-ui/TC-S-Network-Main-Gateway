/**
 * Mobile API Verification Script
 * 
 * This script tests the mobile API endpoints to verify they're working correctly.
 * Run this script after setting up the MOBILE_API_KEY environment variable.
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Change to your server URL
const API_KEY = process.env.MOBILE_API_KEY;

// Utility function to make HTTP requests
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'x-api-key': API_KEY
      }
    };

    console.log(`Making ${method} request to ${url.toString()}`);

    const httpLib = url.protocol === 'https:' ? https : http;
    const req = httpLib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const jsonResponse = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: jsonResponse });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error making request: ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

// Main verification function
async function verifyMobileApi() {
  console.log('=== Mobile API Verification ===');
  
  if (!API_KEY) {
    console.error('MOBILE_API_KEY environment variable is not set. Please set it first.');
    process.exit(1);
  }

  try {
    // Test 1: Check the status endpoint
    console.log('\n1. Testing /mobile/status endpoint:');
    const statusResponse = await makeRequest('/mobile/status');
    console.log(JSON.stringify(statusResponse.body, null, 2));

    // Test 2: Check the members endpoint (protected)
    console.log('\n2. Testing /mobile/members endpoint:');
    const membersResponse = await makeRequest('/mobile/members');
    console.log(`Retrieved ${membersResponse.body.count} members`);
    
    // Test 3: Check a specific member endpoint
    if (membersResponse.body.members && membersResponse.body.members.length > 0) {
      const firstMemberId = membersResponse.body.members[0].id;
      console.log(`\n3. Testing /mobile/member/${firstMemberId} endpoint:`);
      const memberResponse = await makeRequest(`/mobile/member/${firstMemberId}`);
      console.log(JSON.stringify(memberResponse.body, null, 2));
    } else {
      console.log('\n3. Skipping member endpoint test (no members available)');
    }

    console.log('\n✅ Mobile API verification completed successfully!');
  } catch (error) {
    console.error('Mobile API verification failed:', error);
    process.exit(1);
  }
}

// Run the verification
verifyMobileApi().catch(console.error);