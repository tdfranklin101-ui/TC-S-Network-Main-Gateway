/**
 * Badge Generator Service for Current-See
 * 
 * This module provides integration with the Python badge generation service,
 * allowing for the creation of shareable solar achievement badges.
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

// Configuration
const BADGE_SERVICE_PORT = 5002;
const BADGE_SERVICE_URL = `http://localhost:${BADGE_SERVICE_PORT}`;
let badgeServiceRunning = false;

/**
 * Start the Python badge generator service
 */
function startBadgeService() {
  if (badgeServiceRunning) return;
  
  try {
    console.log('Starting Python badge generator service...');
    
    // Start the Python service as a child process
    const pythonProcess = spawn('python3', [
      'python_services/badge_generator.py',
      '--server',
      '--port', BADGE_SERVICE_PORT.toString()
    ]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Badge service: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Badge service error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Badge service exited with code ${code}`);
      badgeServiceRunning = false;
    });
    
    badgeServiceRunning = true;
    
    // Handle process exit to clean up child process
    process.on('exit', () => {
      pythonProcess.kill();
    });
  } catch (error) {
    console.error('Failed to start Python badge service:', error);
  }
}

/**
 * Generate a badge using the Python service
 * @param {Object} options - Badge generation options
 * @param {string} options.name - Username to display on the badge
 * @param {string} options.kwh - Energy value to display (without unit)
 * @param {string} options.type - Badge type (offset, generated, saved)
 * @param {string} options.theme - Color theme (default, green, blue)
 * @param {string} options.format - Output format (png or base64)
 * @returns {Promise<Buffer|Object>} - Badge data as buffer (png) or object with base64 data (base64)
 */
async function generateBadge(options) {
  try {
    // Start the service if not running
    if (!badgeServiceRunning) {
      startBadgeService();
      // Give it a moment to start up
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Build query parameters
    const params = new URLSearchParams();
    if (options.name) params.append('name', options.name);
    if (options.kwh) params.append('kwh', options.kwh);
    if (options.type) params.append('type', options.type);
    if (options.theme) params.append('theme', options.theme);
    if (options.format) params.append('format', options.format);
    
    // Make request to the Python service
    const response = await fetch(`${BADGE_SERVICE_URL}/generate_badge?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Return appropriate format
    if (options.format === 'base64') {
      return await response.json();
    } else {
      return await response.buffer();
    }
  } catch (error) {
    console.error('Error generating badge:', error);
    throw error;
  }
}

/**
 * Generate a badge directly using the Python script (without server)
 * @param {Object} options - Badge generation options
 * @returns {Promise<string>} - Base64 encoded image data
 */
function generateBadgeDirect(options) {
  return new Promise((resolve, reject) => {
    const args = [
      'python_services/badge_generator.py',
      '--name', options.name || 'Solar Hero',
      '--kwh', options.kwh || '0.0'
    ];
    
    if (options.type) args.push('--type', options.type);
    if (options.theme) args.push('--theme', options.theme);
    
    const pythonProcess = spawn('python3', args);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python badge generator exited with code ${code}`);
        console.error(`Error: ${errorData}`);
        reject(new Error(`Badge generation failed: ${errorData}`));
      } else {
        resolve(outputData.trim());
      }
    });
  });
}

// If running as the main module, start the badge service
if (require.main === module) {
  startBadgeService();
}

module.exports = {
  startBadgeService,
  generateBadge,
  generateBadgeDirect
};