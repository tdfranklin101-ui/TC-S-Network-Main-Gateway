/**
 * OpenAI API Key Update Utility
 * 
 * This script helps update the OpenAI API key in the .env.openai file.
 * 
 * Usage: 
 *   node update-openai-key.js [new-api-key]
 * 
 * If no key is provided as an argument, the script will prompt for it.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

const API_KEY_ENV_FILE = path.join(__dirname, '.env.openai');

// Check if API key was provided as command-line argument
let newApiKey = process.argv[2];

function validateApiKey(key) {
  if (!key) {
    return false;
  }
  
  // Basic validation for OpenAI API key format
  if (key.startsWith('sk-')) {
    return true;
  }
  
  return false;
}

function updateApiKeyFile(apiKey) {
  try {
    fs.writeFileSync(API_KEY_ENV_FILE, `OPENAI_API_KEY=${apiKey}\n`);
    console.log(`${colors.green}✓ API key successfully saved to ${API_KEY_ENV_FILE}${colors.reset}`);
    
    // Check key format and provide additional information
    if (apiKey.startsWith('sk-proj-')) {
      console.log(`${colors.blue}Note: Detected project-scoped API key format (sk-proj-...)${colors.reset}`);
    }
    
    console.log(`\n${colors.magenta}Next steps:${colors.reset}`);
    console.log(`1. Restart the server for the new key to take effect`);
    console.log(`2. Enable OpenAI features: ${colors.cyan}node toggle-openai.js enable${colors.reset}`);
    console.log(`3. Verify integration with: ${colors.cyan}node test-openai-integration.js${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error saving API key: ${error.message}${colors.reset}`);
    return false;
  }
}

// If API key was provided via command-line argument
if (newApiKey) {
  if (validateApiKey(newApiKey)) {
    updateApiKeyFile(newApiKey);
  } else {
    console.error(`${colors.red}Invalid API key format. Key should start with 'sk-'${colors.reset}`);
  }
} else {
  // No API key provided, prompt for it
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`${colors.cyan}OpenAI API Key Update Utility${colors.reset}`);
  console.log(`Visit ${colors.blue}https://platform.openai.com/api-keys${colors.reset} to get your API key\n`);
  
  rl.question(`Enter your OpenAI API key: `, (input) => {
    newApiKey = input.trim();
    
    if (validateApiKey(newApiKey)) {
      updateApiKeyFile(newApiKey);
    } else {
      console.error(`${colors.red}Invalid API key format. Key should start with 'sk-'${colors.reset}`);
    }
    
    rl.close();
  });
}