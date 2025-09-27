/**
 * Mobile API Verification Script
 * 
 * This script tests the mobile API endpoints to verify they work
 * with database credential-based authentication.
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');

// These environment variables should already be set
const {
  DATABASE_URL,
  PGUSER,
  PGPASSWORD,
  PGHOST,
  PGDATABASE,
  PGPORT
} = process.env;

// Base URL for the API - this will need to be updated for production
const API_BASE_URL = 'http://localhost:3000/mobile';

// Verify database connection first
async function verifyDatabaseConnection() {
  try {
    const pool = new Pool({
      connectionString: DATABASE_URL
    });
    
    const result = await pool.query('SELECT 1 as connection_test');
    if (result.rows[0].connection_test === 1) {
      console.log('✅ Database connection successful');
      await pool.end();
      return true;
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test API status endpoint (should be public)
async function testStatusEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Status endpoint working:', data.message);
      return true;
    } else {
      console.error('❌ Status endpoint returned unsuccessful response');
      return false;
    }
  } catch (error) {
    console.error('❌ Status endpoint error:', error.message);
    return false;
  }
}

// Test members endpoint with DB credentials
async function testMembersEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/members`, {
      method: 'GET',
      headers: {
        'x-pguser': PGUSER,
        'x-pgpassword': PGPASSWORD,
        'x-pghost': PGHOST,
        'x-pgdatabase': PGDATABASE
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Members endpoint working: Retrieved ${data.count} members`);
      return true;
    } else {
      console.error('❌ Members endpoint returned unsuccessful response');
      return false;
    }
  } catch (error) {
    console.error('❌ Members endpoint error:', error.message);
    return false;
  }
}

// Test the API with an invalid credential to ensure security
async function testInvalidCredentials() {
  try {
    const response = await fetch(`${API_BASE_URL}/members`, {
      method: 'GET',
      headers: {
        'x-pguser': 'invalid_user',
        'x-pgpassword': 'invalid_password',
        'x-pghost': PGHOST,
        'x-pgdatabase': PGDATABASE
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Security check passed: Invalid credentials properly rejected');
      return true;
    } else {
      console.error('❌ Security failure: Invalid credentials not rejected');
      return false;
    }
  } catch (error) {
    // Network errors are not what we're testing for here
    console.error('❌ Error during invalid credentials test:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('=== Mobile API Verification ===');
  console.log('Testing connection to database and API endpoints...\n');
  
  const dbConnected = await verifyDatabaseConnection();
  if (!dbConnected) {
    console.error('❌ Database connection required for further tests. Exiting.');
    return;
  }
  
  await testStatusEndpoint();
  await testMembersEndpoint();
  await testInvalidCredentials();
  
  console.log('\n=== Tests Completed ===');
}

runTests().catch(error => {
  console.error('Unexpected error during tests:', error);
  process.exit(1);
});