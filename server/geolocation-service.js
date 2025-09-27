const { spawn } = require('child_process');
const fetch = require('node-fetch');

// Try to load geoip-lite but handle missing data gracefully
let geoip = null;
try {
  geoip = require('geoip-lite');
  console.log('Node.js geoip-lite service loaded successfully');
} catch (error) {
  console.log('Warning: geoip-lite not available, using fallback geolocation service');
}

// Configuration
const USE_PYTHON_SERVICE = true; // Set to false to use Node.js geoip-lite instead
const PYTHON_SERVICE_PORT = 5001;
const PYTHON_SERVICE_URL = `http://localhost:${PYTHON_SERVICE_PORT}`;
let pythonServiceRunning = false;

/**
 * Start the Python geolocation service
 */
function startPythonService() {
  if (pythonServiceRunning) return;
  
  try {
    console.log('Starting Python geolocation service...');
    
    // Start the Python service as a child process
    const pythonProcess = spawn('python3', [
      'python_services/geolocation_service.py',
      '--server',
      '--port', PYTHON_SERVICE_PORT.toString()
    ]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Geolocation service: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Geolocation service error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Geolocation service exited with code ${code}`);
      pythonServiceRunning = false;
    });
    
    pythonServiceRunning = true;
    
    // Handle process exit to clean up child process
    process.on('exit', () => {
      pythonProcess.kill();
    });
  } catch (error) {
    console.error('Failed to start Python geolocation service:', error);
  }
}

/**
 * Get location data for an IP address using the Python service
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object>} Location data
 */
async function getLocationFromPythonService(ip) {
  try {
    // Start the service if not running
    if (!pythonServiceRunning) {
      startPythonService();
      // Give it a moment to start up
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Make request to the Python service
    const response = await fetch(`${PYTHON_SERVICE_URL}/geolocate?ip=${ip}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting location from Python service:', error);
    return getFallbackLocation(ip, `Python service error: ${error.message}`);
  }
}

/**
 * Get location data using Node.js geoip-lite
 * @param {string} ip - IP address to look up
 * @returns {Object} Location data
 */
function getLocationFromNodeGeoip(ip) {
  try {
    if (!geoip) {
      return getFallbackLocation(ip, 'geoip-lite not available');
    }
    
    const geo = geoip.lookup(ip);
    
    if (!geo) {
      return getFallbackLocation(ip, 'Location not found in geoip-lite database');
    }
    
    return {
      city: geo.city || 'Unknown',
      region: geo.region || 'Unknown',
      country: geo.country || 'Unknown',
      latitude: geo.ll[0],
      longitude: geo.ll[1],
      time_zone: geo.timezone || 'Unknown',
      ip: ip,
      source: 'geoip-lite'
    };
  } catch (error) {
    console.error('Error getting location from geoip-lite:', error);
    return getFallbackLocation(ip, `geoip-lite error: ${error.message}`);
  }
}

/**
 * Provide fallback location data when geolocation services fail
 * @param {string} ip - IP address
 * @param {string} reason - Reason for fallback
 * @returns {Object} Fallback location data
 */
function getFallbackLocation(ip, reason = 'Unknown error') {
  return {
    city: 'Unknown',
    region: 'Unknown',
    country: 'Unknown',
    latitude: 0,
    longitude: 0,
    time_zone: 'UTC',
    ip: ip,
    source: 'fallback',
    reason: reason
  };
}

/**
 * Get location data for an IP address
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object>} Location data
 */
async function getLocation(ip) {
  if (USE_PYTHON_SERVICE) {
    return getLocationFromPythonService(ip);
  } else {
    return getLocationFromNodeGeoip(ip);
  }
}

// If running as the main module, start the Python service
if (require.main === module) {
  startPythonService();
}

module.exports = {
  getLocation,
  startPythonService
};