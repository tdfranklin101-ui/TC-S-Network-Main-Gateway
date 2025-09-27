/**
 * Current-See Distribution Monitor Service
 * 
 * This script checks the distribution log and monitors the server status
 * to ensure the daily SOLAR distributions are occurring as scheduled.
 * Compatible with the node-schedule implementation for precise timing.
 */

const fs = require('fs');
const http = require('http');
const schedule = require('node-schedule');

// Configuration
const LOG_FILE = 'distribution_log.txt';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const SERVER_URL = 'http://localhost:3000/health';
const ALERT_THRESHOLD = 26 * 60 * 60 * 1000; // Alert if no distribution for 26 hours

// Function to check if distributions are happening
function checkDistributions() {
  console.log(`[${new Date().toISOString()}] Running distribution check...`);

  try {
    // Check if the log file exists
    if (!fs.existsSync(LOG_FILE)) {
      console.error(`WARNING: Log file ${LOG_FILE} not found. Server may not be logging properly.`);
      return;
    }

    // Read the log file
    const logContents = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = logContents.split('\n').filter(line => line.trim());

    // Check for distribution records
    const distributionLines = lines.filter(line => line.includes('Distribution completed'));
    
    if (distributionLines.length === 0) {
      console.error('WARNING: No distribution logs found. Distribution may not be running.');
      return;
    }

    // Get the most recent distribution time
    const lastDistribution = distributionLines[distributionLines.length - 1];
    const match = lastDistribution.match(/\[(.*?)\]/);
    
    if (!match) {
      console.error('WARNING: Invalid log format in the distribution logs.');
      return;
    }

    const lastDistributionTime = new Date(match[1]);
    const now = new Date();
    const timeSinceLastDistribution = now - lastDistributionTime;

    console.log(`Last distribution occurred at: ${lastDistributionTime.toISOString()}`);
    console.log(`Pacific Time: ${lastDistributionTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
    console.log(`Hours since last distribution: ${(timeSinceLastDistribution / (60 * 60 * 1000)).toFixed(2)}`);

    // Alert if it's been too long since the last distribution
    if (timeSinceLastDistribution > ALERT_THRESHOLD) {
      console.error(`ALERT: It has been more than ${ALERT_THRESHOLD / (60 * 60 * 1000)} hours since the last distribution!`);
      console.error('The distribution service may not be functioning correctly.');
    } else {
      console.log('Distribution service appears to be functioning correctly.');
    }
  } catch (error) {
    console.error('Error checking distributions:', error);
  }
}

// Function to check if the server is running
function checkServerStatus() {
  return new Promise((resolve) => {
    http.get(SERVER_URL, (response) => {
      if (response.statusCode === 200) {
        console.log(`[${new Date().toISOString()}] Server is running. Status: OK (${response.statusCode})`);
        resolve(true);
      } else {
        console.error(`[${new Date().toISOString()}] Server check failed. Status: ${response.statusCode}`);
        resolve(false);
      }
    }).on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Server check error: ${error.message}`);
      resolve(false);
    });
  });
}

// Main monitoring function
async function runMonitoring() {
  console.log(`[${new Date().toISOString()}] Starting Current-See Distribution Monitor Service`);
  console.log('This service monitors the SOLAR distribution process to ensure it runs daily at 00:00 GMT (5:00 PM Pacific Time).');
  
  // Initial checks
  const serverRunning = await checkServerStatus();
  if (serverRunning) {
    checkDistributions();
  }
  
  // Set up scheduled monitoring using node-schedule (runs every 6 hours)
  // This uses the same cron syntax as the main distribution system
  const monitorJob = schedule.scheduleJob('0 */6 * * *', async function() {
    const isRunning = await checkServerStatus();
    if (isRunning) {
      checkDistributions();
    }
  });
  
  // Display the next scheduled check time
  const nextCheck = monitorJob.nextInvocation();
  console.log(`Next scheduled check: ${nextCheck.toLocaleString()} (${nextCheck.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific Time)`);
  
  console.log('Monitoring service active using node-schedule. Checks will run every 6 hours.');
}

// Start the monitoring service
runMonitoring();