/**
 * API Endpoint Test Script for The Current-See
 * 
 * This script tests all API endpoints to ensure they return the full member data
 * including the TC-S Solar Reserve.
 */

const fetch = require('node-fetch');

// Base URL for the API server
const BASE_URL = 'http://localhost:3001';

// Endpoints to test
const endpoints = [
  '/api/members',
  '/api/members.json',
  '/embedded-members',
  '/api/member-count'
];

/**
 * Test an API endpoint and verify the response
 */
async function testEndpoint(endpoint) {
  try {
    console.log(`Testing endpoint: ${endpoint}`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      console.error(`  ERROR: Endpoint ${endpoint} returned status ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    // Check if it's the member count endpoint (special case)
    if (endpoint === '/api/member-count') {
      console.log(`  Count endpoint returned: ${JSON.stringify(data)}`);
      return true;
    }
    
    // For member list endpoints
    if (!Array.isArray(data)) {
      console.error(`  ERROR: Expected array response, got: ${typeof data}`);
      return false;
    }
    
    // Check if we have the TC-S Solar Reserve
    const hasReserve = data.some(m => m.name === 'TC-S Solar Reserve');
    
    // Check for Terry and JF (known members)
    const hasTerry = data.some(m => m.name === 'Terry D. Franklin');
    const hasJF = data.some(m => m.name === 'JF');
    
    console.log(`  Found ${data.length} members`);
    console.log(`  TC-S Solar Reserve: ${hasReserve ? 'Present ✓' : 'MISSING ✗'}`);
    console.log(`  Terry D. Franklin: ${hasTerry ? 'Present ✓' : 'MISSING ✗'}`);
    console.log(`  JF: ${hasJF ? 'Present ✓' : 'MISSING ✗'}`);
    
    return hasReserve && hasTerry && hasJF;
  } catch (error) {
    console.error(`  ERROR testing ${endpoint}: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('===================================');
  console.log('  The Current-See API Endpoint Test');
  console.log('===================================');
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('');
  }
  
  console.log('===================================');
  console.log(`Test Results: ${successCount} passed, ${failCount} failed`);
  console.log('===================================');
  
  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Start tests after a short delay to ensure server is ready
setTimeout(runTests, 2000);