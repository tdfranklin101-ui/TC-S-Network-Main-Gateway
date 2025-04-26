/**
 * Test Signup Script
 * 
 * This script tests the signup process with the enhanced data persistence mechanism.
 */

const emailLogger = require('./signup-email-logger');

// Create a test user
const testUser = {
  name: 'Test User',
  email: 'test_user_' + Date.now() + '@example.com',
  source: 'test_script',
  ipAddress: '127.0.0.1'
};

console.log(`Testing signup with user: ${testUser.name} (${testUser.email})`);

// Log the signup using the enhanced logger
const result = emailLogger.logSignup(testUser);

console.log('Signup result:', result ? 'Success' : 'Failed');