/**
 * The Current-See Deployment Preparation Script
 * 
 * This script prepares the website for deployment with the following steps:
 * 1. Verifies all required components are in place
 * 2. Tests the OpenAI API key
 * 3. Runs a test distribution
 * 4. Ensures all automatic update systems are functional
 * 5. Updates the version and timestamp information
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Log a message with color
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let colorCode = '';
  
  switch (type) {
    case 'success':
      colorCode = colors.green;
      break;
    case 'warning':
      colorCode = colors.yellow;
      break;
    case 'error':
      colorCode = colors.red;
      break;
    case 'info':
    default:
      colorCode = colors.cyan;
      break;
  }
  
  console.log(`${colorCode}[${timestamp}] ${message}${colors.reset}`);
  
  // Also log to the deployment preparation log
  fs.appendFileSync('deploy-prep.log', `[${timestamp}] [${type.toUpperCase()}] ${message}\n`);
}

/**
 * Run a command and return its output
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Check if key files exist
 */
async function checkRequiredFiles() {
  log('Checking for required files...', 'info');
  
  const requiredFiles = [
    'server.js',
    'public/cache-timestamp.txt',
    'public/js/cache-buster.js',
    'public/js/public-members-log.js',
    'public/js/solar-generator-refresh.js',
    'solar-conversion-sync.js',
    'solar-distribution-integration.js',
    'solar-distribution-scheduler.js',
    'page-includes.js',
    'check-solar-distribution.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`Missing required file: ${file}`, 'error');
      allFilesExist = false;
    }
  }
  
  if (allFilesExist) {
    log('All required files are present', 'success');
  } else {
    throw new Error('Missing required files');
  }
}

/**
 * Test the OpenAI API key
 */
async function testOpenAIKey() {
  log('Testing OpenAI API key...', 'info');
  
  if (!process.env.OPENAI_API_KEY && !process.env.NEW_OPENAI_API_KEY) {
    log('OpenAI API key is not set in the environment', 'error');
    throw new Error('Missing OpenAI API key');
  }
  
  try {
    // Write a simple test script file
    const testScriptContent = `
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY,
});

async function testKey() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a helpful assistant."},
        {role: "user", content: "Hello, this is a test message to verify the API key is working."}
      ],
      max_tokens: 10
    });
    console.log("API key is valid!");
    return true;
  } catch (error) {
    console.error("API key test failed:", error.message);
    return false;
  }
}

testKey().then(result => process.exit(result ? 0 : 1));
`;
    
    // Write the test script to a temporary file
    fs.writeFileSync('test-openai-key.js', testScriptContent);
    
    // Run the script
    const output = await runCommand('node test-openai-key.js');
    
    // Clean up
    fs.unlinkSync('test-openai-key.js');
    
    if (output.includes('API key is valid')) {
      log('OpenAI API key is valid', 'success');
    } else {
      log('OpenAI API key test failed', 'error');
      throw new Error('Invalid OpenAI API key');
    }
  } catch (error) {
    log(`Error testing OpenAI API key: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update the cache timestamp
 */
function updateCacheTimestamp() {
  log('Updating cache timestamp...', 'info');
  
  const timestamp = new Date().toISOString();
  fs.writeFileSync('public/cache-timestamp.txt', timestamp);
  
  log(`Cache timestamp updated to ${timestamp}`, 'success');
}

/**
 * Update synchronization log
 */
function updateSyncLog() {
  log('Updating synchronization log...', 'info');
  
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] Deployment preparation completed - Solar-Conversion-Clock synchronization ready\n`;
  
  fs.appendFileSync('sync_log.txt', entry);
  
  log('Synchronization log updated', 'success');
}

/**
 * Run the system check tool
 */
async function runSystemCheck() {
  log('Running system check...', 'info');
  
  try {
    await runCommand('node check-solar-distribution.js');
    log('System check passed', 'success');
  } catch (error) {
    log('System check failed', 'error');
    throw error;
  }
}

/**
 * Create a deployment-ready marker file
 */
function createDeploymentMarker() {
  log('Creating deployment marker...', 'info');
  
  const timestamp = new Date().toISOString();
  const version = '1.0.0'; // You can update this based on your versioning system
  
  const markerContent = {
    timestamp,
    version,
    features: {
      solarDistribution: true,
      autoUpdate: true,
      openAiIntegration: true,
      cacheManagement: true
    },
    deployReady: true
  };
  
  fs.writeFileSync('deployment-ready.json', JSON.stringify(markerContent, null, 2));
  
  log('Deployment marker created', 'success');
}

/**
 * Main function to run all preparation steps
 */
async function prepareForDeployment() {
  log('Starting deployment preparation...', 'info');
  
  try {
    // Create the deploy-prep.log file
    fs.writeFileSync('deploy-prep.log', `Deployment Preparation Log\nStarted at ${new Date().toISOString()}\n\n`);
    
    // Run all preparation steps
    await checkRequiredFiles();
    await testOpenAIKey();
    updateCacheTimestamp();
    updateSyncLog();
    await runSystemCheck();
    createDeploymentMarker();
    
    log('Deployment preparation completed successfully!', 'success');
    console.log(`\n${colors.green}${colors.bold}✓ The system is ready for deployment${colors.reset}`);
    console.log(`${colors.cyan}You can now deploy the website using the Replit deployment interface.${colors.reset}`);
    console.log(`${colors.cyan}The website will automatically update after Solar-Conversion-Clock distributions.${colors.reset}\n`);
    
    return true;
  } catch (error) {
    log(`Deployment preparation failed: ${error.message}`, 'error');
    console.log(`\n${colors.red}${colors.bold}✗ The system is not ready for deployment${colors.reset}`);
    console.log(`${colors.red}Please fix the issues above before deploying.${colors.reset}\n`);
    
    return false;
  }
}

// Run the preparation process
prepareForDeployment();