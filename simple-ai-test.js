/**
 * Minimal OpenAI API Test
 * 
 * This is a self-contained script to test OpenAI API connectivity
 * with minimal dependencies or complexity.
 */

const https = require('https');
const fs = require('fs');

// Load API key from environment or .env.openai file
function loadApiKey() {
  // First try from environment variable
  let apiKey = process.env.OPENAI_API_KEY;
  
  // If not in environment, try from .env.openai file
  if (!apiKey) {
    try {
      const envFile = fs.readFileSync('.env.openai', 'utf8');
      const match = envFile.match(/OPENAI_API_KEY=(.+)/);
      if (match && match[1]) {
        apiKey = match[1].trim();
      }
    } catch (error) {
      console.error('Error reading .env.openai file:', error.message);
    }
  }
  
  return apiKey;
}

// Perform a simple OpenAI API request
function testOpenAiApi(apiKey) {
  return new Promise((resolve, reject) => {
    // Simple request data
    const requestData = JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user", 
          content: "Hello, this is a simple test message to verify API connectivity. Please respond with 'Connection successful.'"
        }
      ],
      max_tokens: 10
    });

    // Request options
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    // Send request
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // Check if response is successful
        if (res.statusCode === 200) {
          try {
            const jsonResponse = JSON.parse(responseData);
            resolve({
              success: true,
              statusCode: res.statusCode,
              response: jsonResponse
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: 'Error parsing JSON response',
              response: responseData
            });
          }
        } else {
          resolve({
            success: false,
            statusCode: res.statusCode,
            response: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message
      });
    });

    // Write data to request body
    req.write(requestData);
    req.end();
  });
}

// Main function
async function main() {
  console.log('===== Simple OpenAI API Test =====\n');
  
  // Step 1: Load API key
  const apiKey = loadApiKey();
  
  if (!apiKey) {
    console.error('No API key found. Please set OPENAI_API_KEY environment variable or create .env.openai file.');
    process.exit(1);
  }
  
  console.log(`API key loaded. First 10 chars: ${apiKey.substring(0, 10)}...`);
  console.log(`API key length: ${apiKey.length} characters`);
  
  // Step 2: Test API connection
  console.log('\nTesting API connection...');
  
  try {
    const result = await testOpenAiApi(apiKey);
    
    if (result.success) {
      console.log('\n✓ API connection successful!');
      console.log('Response:', JSON.stringify(result.response, null, 2));
    } else {
      console.log('\n✗ API connection failed.');
      console.log(`Status code: ${result.statusCode}`);
      console.log('Response:', result.response);
    }
  } catch (error) {
    console.error('\n✗ Error during API request:', error.error || error);
  }
  
  console.log('\n===== Test Complete =====');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});