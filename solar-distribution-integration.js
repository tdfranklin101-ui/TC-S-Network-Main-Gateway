/**
 * The Current-See - Solar Distribution Integration
 * 
 * This module integrates the Solar Distribution Scheduler with the server
 * to ensure daily SOLAR distributions occur properly at 00:00 GMT.
 */

const { scheduleDistribution } = require('./solar-distribution-scheduler');
const fs = require('fs');
const path = require('path');

const DISTRIBUTION_LOG_PATH = path.join(__dirname, 'distribution_log.txt');

// Log message to console and file
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(logEntry);
  
  // Append to log file
  fs.appendFileSync(DISTRIBUTION_LOG_PATH, logEntry + '\n');
}

/**
 * Initialize the SOLAR distribution system
 */
function initializeSolarDistribution() {
  try {
    // Ensure OpenAI API key is available (try both environment variables)
    const openaiApiKey = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logMessage('WARNING: Neither OPENAI_API_KEY nor NEW_OPENAI_API_KEY found. SOLAR distribution will not function.');
      return false;
    }
    
    // Initialize scheduler
    const job = scheduleDistribution();
    
    logMessage('SOLAR distribution system initialized');
    logMessage('Distribution scheduled for 00:00 GMT daily');
    
    return job;
  } catch (error) {
    logMessage(`ERROR initializing SOLAR distribution: ${error.message}`);
    return false;
  }
}

module.exports = {
  initializeSolarDistribution
};