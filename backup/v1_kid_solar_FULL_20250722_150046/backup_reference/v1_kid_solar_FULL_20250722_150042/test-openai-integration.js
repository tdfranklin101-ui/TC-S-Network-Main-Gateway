/**
 * OpenAI API Integration Test
 * 
 * This script tests the OpenAI API connection to verify that the API key is working
 * and the API is accessible. It also provides diagnostics for common issues.
 */

const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');
const { OpenAI } = require('openai');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

console.log('========== OpenAI API Integration Test ===========\n');

// Load API key from .env.openai file or environment
console.log('Checking .env.openai file for API key...');
let apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  try {
    const envFilePath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envFilePath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envFilePath));
      apiKey = envConfig.OPENAI_API_KEY;
    }
  } catch (err) {
    console.error(`${colors.red}Error reading .env.openai file: ${err.message}${colors.reset}`);
  }
}

if (!apiKey) {
  console.error(`${colors.red}No API key found. Please set OPENAI_API_KEY environment variable or create .env.openai file.${colors.reset}`);
  console.log(`
${colors.yellow}Instructions:${colors.reset}
1. Create a file named .env.openai in the project root directory
2. Add your OpenAI API key in this format: OPENAI_API_KEY=your_key_here
3. Run this test again

Visit ${colors.cyan}https://platform.openai.com/api-keys${colors.reset} to create an API key if you don't have one.
See ${colors.cyan}OPENAI-API-GUIDE.md${colors.reset} for detailed instructions.
`);
  process.exit(1);
}

// Check API key format
console.log(`API key loaded. First 10 characters: ${apiKey.substring(0, 10)}...`);
console.log(`API key length: ${apiKey.length} characters`);

let keyFormat = 'Unknown';
if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-')) {
  keyFormat = 'Traditional';
} else if (apiKey.startsWith('sk-proj-')) {
  keyFormat = 'Project-scoped';
  console.log('Note: Detected sk-proj API key format (project-scoped key)');
}
console.log(`API key format: ${keyFormat}`);

// Initialize OpenAI client
console.log('\nInitializing OpenAI client...');
const openai = new OpenAI({
  apiKey: apiKey
});

// Test API connection
console.log('Sending test request to OpenAI API...\n');
(async () => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Please respond with a short "Hello from OpenAI!" message to test API connectivity.'
        }
      ],
      max_tokens: 20
    });

    console.log(`${colors.green}✓ OpenAI API connection successful!${colors.reset}`);
    console.log(`Response: ${response.choices[0].message.content}`);
    console.log(`Model: ${response.model}`);
    console.log(`Usage: ${response.usage.total_tokens} tokens`);
  } catch (error) {
    console.error(`${colors.red}✗ Error testing OpenAI API:${colors.reset}`);
    console.error(error.message);
    console.log('\nThis appears to be an authentication error. Possible causes:');
    console.log('1. The API key may be invalid or expired');
    console.log('2. The API key may have usage restrictions');
    console.log('3. The API key format may be incorrect');
    console.log('\nSuggestion: Try generating a new API key from https://platform.openai.com/api-keys');
    console.log('\nRefer to OPENAI-API-GUIDE.md for detailed troubleshooting steps.');
  } finally {
    console.log('\n========== Test Complete ===========');
  }
})();