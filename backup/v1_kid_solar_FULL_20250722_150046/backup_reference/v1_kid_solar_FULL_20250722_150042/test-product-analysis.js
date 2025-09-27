/**
 * OpenAI Product Analysis Test for The Current-See
 * 
 * This script directly tests the OpenAI product analysis function
 */

const openaiService = require('./openai-service');

// Set a timeout for the API call
const TIMEOUT = 15000; // 15 seconds

// Test product data
const testProduct = {
  name: "Refrigerator XC-2000",
  type: "Home Appliance",
  materials: "Steel, Plastic, Copper, Refrigerant",
  location: "USA",
  weight: "120 kg",
  additionalInfo: "Energy Star certified, 20 cubic feet capacity"
};

async function testProductAnalysis() {
  console.log('======== OpenAI Product Analysis Test ========\n');
  console.log('Testing product analysis with sample product:');
  console.log(JSON.stringify(testProduct, null, 2));
  
  try {
    // Create a promise that will reject after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), TIMEOUT);
    });
    
    // Race the actual API request against the timeout
    const response = await Promise.race([
      openaiService.analyzeProductEnergy(testProduct),
      timeoutPromise
    ]);
    
    // Handle different response types
    if (response && response.error === true) {
      console.error('\n❌ Product analysis test failed with error response:');
      console.error(`- Message: ${response.message}`);
      if (response.details) {
        console.error(`- Details: ${response.details}`);
      }
    } else if (typeof response === 'object') {
      console.log('\n✅ Product analysis test successful!');
      console.log('Analysis results:');
      console.log('-'.repeat(50));
      console.log(JSON.stringify(response, null, 2));
      console.log('-'.repeat(50));
    } else {
      console.log('\n❓ Product analysis returned an unexpected response type:');
      console.log(typeof response);
      console.log(response);
    }
  } catch (error) {
    console.error('\n❌ Product analysis test failed with exception:');
    console.error(`- Error: ${error.message}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
  
  console.log('\n======== Test Complete ========');
}

// Run the test
testProductAnalysis();