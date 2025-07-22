/**
 * Direct OpenAI Connection Test
 * 
 * This script directly tests the OpenAI API key from the environment variable.
 */

const { OpenAI } = require('openai');

async function testOpenAIConnection() {
  console.log('======== Direct OpenAI Connection Test ========\n');
  
  // Get API key directly from environment - prioritize NEW_OPENAI_API_KEY over OPENAI_API_KEY
  const apiKey = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No OpenAI API key found in environment');
    return;
  }
  
  console.log(`Using key: ${process.env.NEW_OPENAI_API_KEY ? 'NEW_OPENAI_API_KEY' : 'OPENAI_API_KEY'}`); 
  
  // Display key format (safely)
  console.log(`API key length: ${apiKey.length} characters`);
  console.log(`API key prefix: ${apiKey.substring(0, 10)}...`);
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
  try {
    console.log('Testing connection with a simple completion request...');
    
    // Make a simple request
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello! This is a test message to verify API connection." }
      ],
      max_tokens: 50
    });
    
    if (response && response.choices && response.choices.length > 0) {
      console.log('\n✅ OpenAI API connection successful!');
      console.log(`Response: "${response.choices[0].message.content}"\n`);
    } else {
      console.log('\n❓ Received response from OpenAI, but it was not in the expected format');
      console.log('Response:', JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error('\n❌ OpenAI API connection failed');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
  
  console.log('\n======== Test Complete ========');
}

// Run the test
testOpenAIConnection();