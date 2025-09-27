/**
 * OpenAI Feature Toggle Utility
 * 
 * This script allows easy enabling/disabling of OpenAI features
 * for testing purposes. It persists the state to a file so it can
 * be used across different Node.js processes.
 * 
 * Usage:
 *   node toggle-openai.js enable   # Enable OpenAI features
 *   node toggle-openai.js disable  # Disable OpenAI features
 *   node toggle-openai.js status   # Check current status
 */

const fs = require('fs');
const path = require('path');

// File to store the OpenAI feature state
const STATE_FILE = path.join(__dirname, '.openai-feature-state.json');

// Read the current state from file
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading state file:', error.message);
  }
  
  // Default state if file doesn't exist or can't be read
  return { apiWorking: false };
}

// Write the state to file
function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing state file:', error.message);
    return false;
  }
}

try {
  // Load the current state
  const state = readState();
  const command = process.argv[2]?.toLowerCase();
  
  if (command === 'enable') {
    state.apiWorking = true;
    if (writeState(state)) {
      console.log('✓ OpenAI features enabled');
      console.log('The AI assistant will now provide meaningful responses');
      console.log('Note: Server restart required for changes to take effect');
    }
  } else if (command === 'disable') {
    state.apiWorking = false;
    if (writeState(state)) {
      console.log('✓ OpenAI features disabled');
      console.log('The AI assistant will now show "in setup mode" messages');
      console.log('Note: Server restart required for changes to take effect');
    }
  } else if (command === 'status') {
    if (state.apiWorking) {
      console.log('✓ OpenAI features are currently ENABLED');
    } else {
      console.log('✗ OpenAI features are currently DISABLED');
    }
  } else {
    console.log('Error: Invalid command');
    console.log('Usage:');
    console.log('  node toggle-openai.js enable   # Enable OpenAI features');
    console.log('  node toggle-openai.js disable  # Disable OpenAI features');
    console.log('  node toggle-openai.js status   # Check current status');
  }
} catch (error) {
  console.error('Error:', error.message);
}