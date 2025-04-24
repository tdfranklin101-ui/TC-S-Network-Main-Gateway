/**
 * OpenAI API Key Diagnosis Tool
 * 
 * This script diagnoses issues with OpenAI API keys and provides
 * clear guidance on how to obtain a valid key.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Check if running on Replit
const isReplit = process.env.REPL_ID && process.env.REPL_OWNER;

// ANSI colors
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

console.log(`${colors.bright}${colors.cyan}======== OpenAI API Key Diagnosis Tool ========${colors.reset}\n`);

// Function to load OpenAI API key from different sources
function getApiKeys() {
  const keys = {
    env: process.env.OPENAI_API_KEY,
    envFile: null,
    customFile: null
  };
  
  // Check .env.openai file
  try {
    const customEnvPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(customEnvPath)) {
      console.log(`${colors.dim}Checking .env.openai file...${colors.reset}`);
      const content = fs.readFileSync(customEnvPath, 'utf8');
      const match = content.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (match && match[1] && match[1].trim()) {
        keys.customFile = match[1].trim();
      }
    }
  } catch (err) {
    console.log(`${colors.red}Error reading .env.openai: ${err.message}${colors.reset}`);
  }
  
  return keys;
}

// Analyze API key format
function analyzeKey(key, source) {
  if (!key) {
    console.log(`${colors.yellow}No API key found in ${source}${colors.reset}`);
    return false;
  }
  
  console.log(`\n${colors.bright}${colors.blue}Analyzing API key from ${source}:${colors.reset}`);
  console.log(`${colors.dim}Key length: ${key.length} characters${colors.reset}`);
  console.log(`${colors.dim}Key prefix: ${key.substring(0, 8)}...${colors.reset}`);
  
  // Check for valid OpenAI key formats
  const isLegacyFormat = key.startsWith('sk-') && 
                          !key.startsWith('sk-proj') && 
                          key.length >= 40 && 
                          key.length <= 70;
                          
  const isProjectFormat = key.startsWith('sk-proj');
  
  if (isLegacyFormat) {
    console.log(`${colors.green}✓ Key has legacy OpenAI API format (sk-...)${colors.reset}`);
  } else if (isProjectFormat) {
    console.log(`${colors.green}✓ Key has project-scoped OpenAI API format (sk-proj-...)${colors.reset}`);
    console.log(`${colors.blue}ℹ As of 2024, OpenAI is now issuing project-scoped keys instead of user-level keys${colors.reset}`);
    
    if (key.length > 100) {
      console.log(`${colors.yellow}! The key is unusually long (${key.length} characters) but may still be valid${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✗ Key does not match any known OpenAI API format${colors.reset}`);
    
    if (key.length > 100) {
      console.log(`${colors.yellow}! The key is unusually long (${key.length} characters)${colors.reset}`);
    }
  }
  
  const isValidFormat = isLegacyFormat || isProjectFormat;
  
  return isValidFormat;
}

// Provide guidance on how to get a proper OpenAI API key
function provideGuidance() {
  console.log(`\n${colors.bright}${colors.magenta}How to obtain a valid OpenAI API key:${colors.reset}`);
  console.log(`${colors.bright}1. Go to ${colors.cyan}https://platform.openai.com/signup${colors.reset} to create an OpenAI account`);
  console.log(`${colors.bright}2. After logging in, go to ${colors.cyan}https://platform.openai.com/api-keys${colors.reset}`);
  console.log(`${colors.bright}3. Click "Create new secret key" and give it a name${colors.reset}`);
  console.log(`${colors.bright}4. Copy the generated key (it will start with 'sk-proj-' for most current accounts)${colors.reset}`);
  console.log(`${colors.bright}5. Add the key to your ${colors.cyan}.env.openai${colors.reset} file:${colors.reset}`);
  console.log(`${colors.dim}   OPENAI_API_KEY=sk-proj-your-key-here${colors.reset}`);
  
  console.log(`\n${colors.bright}${colors.blue}Important Notes on OpenAI Key Formats:${colors.reset}`);
  console.log(`${colors.bright}1. As of 2024, OpenAI issues project-scoped keys (sk-proj-) instead of user-level keys (sk-)${colors.reset}`);
  console.log(`${colors.bright}2. Project-scoped keys are valid for OpenAI API usage${colors.reset}`);
  console.log(`${colors.bright}3. These keys may be longer than the older format keys${colors.reset}`);
  
  if (isReplit) {
    console.log(`\n${colors.bright}${colors.yellow}Note for Replit users:${colors.reset}`);
    console.log(`${colors.bright}1. You might be using a Replit-specific OpenAI integration${colors.reset}`);
    console.log(`${colors.bright}2. For direct OpenAI API integration, you need an OpenAI-issued key${colors.reset}`);
    console.log(`${colors.bright}3. After getting the key, add it to Replit Secrets with the name ${colors.cyan}OPENAI_API_KEY${colors.reset}`);
  }
}

// Main function
function main() {
  const keys = getApiKeys();
  let hasValidKey = false;
  
  if (keys.customFile) {
    hasValidKey = analyzeKey(keys.customFile, '.env.openai file') || hasValidKey;
  }
  
  if (keys.env) {
    hasValidKey = analyzeKey(keys.env, 'environment variables') || hasValidKey;
  }
  
  if (!hasValidKey) {
    console.log(`\n${colors.red}No valid OpenAI API key found in any location${colors.reset}`);
    provideGuidance();
  } else {
    console.log(`\n${colors.green}Found at least one valid API key format. If you're still having issues, the key may be invalid or have usage restrictions.${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}${colors.cyan}======== Diagnosis Complete ========${colors.reset}`);
}

main();