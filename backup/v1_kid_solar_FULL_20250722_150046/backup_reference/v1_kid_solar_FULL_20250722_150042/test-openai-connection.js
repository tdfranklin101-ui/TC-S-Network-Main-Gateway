/**
 * The Current-See OpenAI Connection Tester
 * 
 * This script specifically tests the OpenAI API connection and reports results.
 * It can be run on a schedule to verify API functionality.
 * 
 * Usage: node test-openai-connection.js
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Configuration
const CONFIG = {
  timeoutMs: 20000, // 20 seconds timeout
  testPrompt: 'Hello, this is a test message to verify API connectivity. Please respond with "Connection successful."',
  logFile: 'openai-connection.log',
  maxLogSize: 1024 * 1024 // 1MB
};

/**
 * Log a message with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let color = colors.reset;
  let prefix = 'INFO';
  
  switch (type) {
    case 'error':
      color = colors.red;
      prefix = 'ERROR';
      break;
    case 'warning':
      color = colors.yellow;
      prefix = 'WARNING';
      break;
    case 'success':
      color = colors.green;
      prefix = 'SUCCESS';
      break;
    default:
      color = colors.reset;
      prefix = 'INFO';
  }
  
  const logMessage = `[${timestamp}] ${prefix}: ${message}`;
  console.log(`${color}${logMessage}${colors.reset}`);
  
  // Also write to log file
  try {
    // Rotate log if needed
    if (fs.existsSync(CONFIG.logFile)) {
      const stats = fs.statSync(CONFIG.logFile);
      if (stats.size > CONFIG.maxLogSize) {
        const backupFile = `${CONFIG.logFile}.${Date.now()}.bak`;
        fs.renameSync(CONFIG.logFile, backupFile);
      }
    }
    
    fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  } catch (err) {
    console.error(`${colors.red}Error writing to log file: ${err.message}${colors.reset}`);
  }
}

/**
 * Load OpenAI API key from environment or file
 */
function loadOpenAIKey() {
  // First check if NEW_OPENAI_API_KEY is available in environment (highest priority)
  if (process.env.NEW_OPENAI_API_KEY) {
    log('Using NEW_OPENAI_API_KEY from environment (highest priority)');
    return process.env.NEW_OPENAI_API_KEY;
  }
  
  try {
    // Check if .env.openai exists
    const envPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envPath)) {
      log('Loading OpenAI API key from .env.openai file');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const keyMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (keyMatch && keyMatch[1] && keyMatch[1].trim()) {
        return keyMatch[1].trim();
      }
    }
  } catch (err) {
    log(`Error loading OpenAI key from .env.openai: ${err.message}`, 'error');
  }
  
  // Fall back to original environment variable
  if (process.env.OPENAI_API_KEY) {
    log('Using OPENAI_API_KEY from environment');
    return process.env.OPENAI_API_KEY;
  }
  
  log('No OpenAI API key found', 'warning');
  return null;
}

/**
 * Clean up API key if it has special format
 */
function getCleanApiKey(rawKey) {
  if (!rawKey) return null;
  
  // Handle special case where key starts with "-sk-p"
  if (rawKey.startsWith('-sk-p')) {
    log('Note: Detected non-standard API key format (-sk-p), attempting to clean', 'warning');
    
    // Try to find and extract a proper API key if embedded in the longer string
    const standardKeyMatch = rawKey.match(/sk-[a-zA-Z0-9]{48}/);
    if (standardKeyMatch) {
      return standardKeyMatch[0];
    }
  }
  
  // Handle project-scoped API key format
  if (rawKey.startsWith('sk-proj-')) {
    log('Note: Detected sk-proj API key format (project-scoped key)');
    return rawKey;
  }
  
  // Handle standard API key format
  if (rawKey.startsWith('sk-') && rawKey.length >= 50) {
    return rawKey;
  }
  
  log('Warning: Unrecognized API key format', 'warning');
  return rawKey;
}

/**
 * Test connection to OpenAI API
 */
async function testOpenAIConnection() {
  log('====== OpenAI Connection Test ======');
  
  // Load API key
  const apiKey = loadOpenAIKey();
  if (!apiKey) {
    log('No API key available, cannot test connection', 'error');
    return false;
  }
  
  const cleanApiKey = getCleanApiKey(apiKey);
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: cleanApiKey
  });
  
  try {
    log('Testing connection to OpenAI API...');
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), CONFIG.timeoutMs);
    });
    
    // Make a simple API call
    const responsePromise = openai.chat.completions.create({
      model: 'gpt-4o', // always use the latest model
      messages: [{
        role: 'user',
        content: CONFIG.testPrompt
      }],
      max_tokens: 50,
      temperature: 0
    });
    
    // Race the API call against the timeout
    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    // Check response
    if (response && response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      log('Response received: ' + content, 'success');
      log('Connection test successful', 'success');
      
      const stats = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        model: response.model,
        responseTime: Math.round((new Date() - startTime) / 10) / 100
      };
      
      log(`Stats: ${JSON.stringify(stats)}`, 'info');
      
      return true;
    } else {
      log('Received unexpected response format', 'error');
      log(`Response: ${JSON.stringify(response)}`, 'error');
      return false;
    }
  } catch (err) {
    log(`OpenAI API connection failed: ${err.message}`, 'error');
    
    // Check for specific error types
    if (err.message.includes('401')) {
      log('Authentication error - check your API key', 'error');
    } else if (err.message.includes('429')) {
      log('Rate limit exceeded - reduce request frequency or upgrade your plan', 'error');
    } else if (err.message.includes('timeout')) {
      log('Request timed out - check network connectivity', 'error');
    }
    
    return false;
  }
}

// Record start time to measure entire operation
const startTime = new Date();

// Run the test
testOpenAIConnection()
  .then(success => {
    const elapsed = (new Date() - startTime) / 1000;
    log(`Test completed in ${elapsed.toFixed(2)} seconds`, success ? 'success' : 'error');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    log(`Unexpected error: ${err.message}`, 'error');
    process.exit(1);
  });