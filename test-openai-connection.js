/**
 * OpenAI Connection Test
 * 
 * This script tests the connection to OpenAI API using the provided key.
 */

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Load OpenAI API key from .env.openai file
const loadOpenAIKey = () => {
  try {
    const envPath = path.join(process.cwd(), '.env.openai');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/OPENAI_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error('Error loading OpenAI key:', error.message);
    return null;
  }
};

async function testOpenAIConnection() {
  console.log('======== OpenAI Connection Test ========\n');
  
  // Get API key
  const apiKey = process.env.OPENAI_API_KEY || loadOpenAIKey();
  
  if (!apiKey) {
    console.error('❌ No OpenAI API key found');
    return;
  }
  
  console.log(`✓ API key found (${apiKey.substring(0, 8)}...)`);
  
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