/**
 * OpenAI Integration Test for The Current-See
 * 
 * This script directly tests the OpenAI integration in the application
 */

const openaiService = require('./openai-service');

// Set a timeout for the API call
const TIMEOUT = 10000; // 10 seconds

async function testAIAssistant() {
  console.log('======== OpenAI Integration Test ========\n');
  
  try {
    console.log('Testing AI assistant with query: "What is a SOLAR token?"');
    
    // Create a promise that will reject after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), TIMEOUT);
    });
    
    // Race the actual API request against the timeout
    const response = await Promise.race([
      openaiService.getEnergyAssistantResponse('What is a SOLAR token?'),
      timeoutPromise
    ]);
    
    // Handle different response types
    if (response && response.error === true) {
      console.error('\n❌ AI Integration test failed with error response:');
      console.error(`- Message: ${response.message}`);
      if (response.details) {
        console.error(`- Details: ${response.details}`);
      }
    } else if (typeof response === 'string') {
      console.log('\n✅ AI Integration test successful!');
      console.log('Response excerpt:');
      console.log('-'.repeat(50));
      console.log(response.substring(0, 300) + (response.length > 300 ? '...' : ''));
      console.log('-'.repeat(50));
    } else {
      console.log('\n❓ AI Integration returned an unexpected response type:');
      console.log(JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error('\n❌ AI Integration test failed with exception:');
    console.error(`- Error: ${error.message}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
  
  console.log('\n======== Test Complete ========');
}

// Run the test
testAIAssistant();