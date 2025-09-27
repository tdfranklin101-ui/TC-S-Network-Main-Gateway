/**
 * Simple API Integration Test
 * Tests the actual AI API endpoint from the application
 */

const fetch = require('node-fetch');

async function testAIEndpoint() {
  console.log('Testing Current-See AI Integration...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/ai/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'What is a SOLAR token?' })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ AI Integration successful!');
      console.log('Response snippet:', result.substring ? result.substring(0, 100) : JSON.stringify(result).substring(0, 100));
    } else {
      console.log('❌ AI Integration failed');
      console.log('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error testing AI endpoint:', error.message);
  }
}

// Run the test
testAIEndpoint();
