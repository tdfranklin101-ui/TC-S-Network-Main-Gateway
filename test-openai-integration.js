/**
 * OpenAI Integration Test Script
 * 
 * This script tests the integration with OpenAI using the current API key.
 * It will make a simple request to the OpenAI API and display the response.
 */

// Using direct OpenAI imports to test the raw API connection
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// ANSI colors for better output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bright: '\x1b[1m'
};

console.log(`${colors.cyan}${colors.bright}========== OpenAI API Integration Test ===========${colors.reset}\n`);

// Load API key from environment or file
function loadApiKey() {
  // Try to get from specific .env.openai file first
  try {
    const envPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envPath)) {
      console.log(`${colors.dim}Checking .env.openai file for API key...${colors.reset}`);
      const envContent = fs.readFileSync(envPath, 'utf8');
      const keyMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (keyMatch && keyMatch[1] && keyMatch[1].trim()) {
        return keyMatch[1].trim();
      }
    }
  } catch (err) {
    console.error(`${colors.red}Error reading .env.openai file: ${err.message}${colors.reset}`);
  }
  
  // Fall back to environment variable
  return process.env.OPENAI_API_KEY;
}

// Main async function
async function testOpenAIAPI() {
  try {
    const apiKey = loadApiKey();
    
    if (!apiKey) {
      console.error(`${colors.red}No OpenAI API key found in environment or .env.openai file${colors.reset}`);
      console.log(`${colors.yellow}Please set an API key as OPENAI_API_KEY in the environment or in the .env.openai file${colors.reset}`);
      return;
    }
    
    console.log(`${colors.blue}API key loaded. First 10 characters: ${apiKey.substring(0, 10)}...${colors.reset}`);
    console.log(`${colors.blue}API key length: ${apiKey.length} characters${colors.reset}`);
    console.log(`${colors.blue}API key format: ${apiKey.startsWith('sk-proj') ? 'Project-scoped' : 'User-level'}${colors.reset}`);
    
    // Initialize OpenAI client
    console.log(`\n${colors.yellow}Initializing OpenAI client...${colors.reset}`);
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Make a simple test request
    console.log(`${colors.yellow}Sending test request to OpenAI API...${colors.reset}`);
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for The Current-See solar energy platform."
        },
        {
          role: "user",
          content: "What is the value of 1 SOLAR token in The Current-See system?"
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;
    
    console.log(`\n${colors.green}${colors.bright}✓ API request successful! Response received in ${responseTime.toFixed(2)} seconds.${colors.reset}\n`);
    console.log(`${colors.magenta}${colors.bright}Response from OpenAI:${colors.reset}`);
    console.log(`${colors.reset}${response.choices[0].message.content}${colors.reset}\n`);
    
    console.log(`${colors.dim}Response metadata:${colors.reset}`);
    console.log(`${colors.dim}Model: ${response.model}${colors.reset}`);
    console.log(`${colors.dim}Completion tokens: ${response.usage.completion_tokens}${colors.reset}`);
    console.log(`${colors.dim}Prompt tokens: ${response.usage.prompt_tokens}${colors.reset}`);
    console.log(`${colors.dim}Total tokens: ${response.usage.total_tokens}${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Error testing OpenAI API:${colors.reset}`);
    console.error(`${colors.red}${error.message}${colors.reset}`);
    
    if (error.message.includes('401')) {
      console.log(`\n${colors.yellow}This appears to be an authentication error. Possible causes:${colors.reset}`);
      console.log(`${colors.yellow}1. The API key may be invalid or expired${colors.reset}`);
      console.log(`${colors.yellow}2. The API key may have usage restrictions${colors.reset}`);
      console.log(`${colors.yellow}3. The API key format may be incorrect${colors.reset}`);
      console.log(`\n${colors.yellow}Suggestion: Try generating a new API key from https://platform.openai.com/api-keys${colors.reset}`);
    } else if (error.message.includes('429')) {
      console.log(`\n${colors.yellow}This appears to be a rate limit error. Possible causes:${colors.reset}`);
      console.log(`${colors.yellow}1. Your OpenAI account may have reached its rate limits${colors.reset}`);
      console.log(`${colors.yellow}2. You may not have billing enabled on your OpenAI account${colors.reset}`);
      console.log(`\n${colors.yellow}Suggestion: Check your usage at https://platform.openai.com/usage${colors.reset}`);
    }
  } finally {
    console.log(`\n${colors.cyan}${colors.bright}========== Test Complete ===========${colors.reset}`);
  }
}

// Run the test
testOpenAIAPI();