/**
 * The Current-See Deployment-Ready Server
 * 
 * This file includes all the necessary components for a successful deployment:
 * 1. Health checks responding to the root path (/)
 * 2. Static file serving for the public directory
 * 3. API endpoints with proper CORS handling
 * 4. Daily SOLAR distribution system
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const serveStatic = require('serve-static');

// Constants for SOLAR calculations
const SOLAR_CONSTANTS = {
  USD_PER_SOLAR: 136000, // $136,000 per SOLAR
  KWH_PER_SOLAR: 4913    // 4,913 kWh per SOLAR
};

// Path constants
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMBERS_FILE = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_FILE = path.join(PUBLIC_DIR, 'embedded-members');

// Global members array
let members = [];

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(cors());
app.use(express.json());

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Health check endpoint for Replit deployments
app.get('/', (req, res) => {
  res.status(200).send('The Current-See Server is running correctly');
});

// Health check for Replit cloud
app.get('/health', (req, res) => {
  res.status(200).send('Healthy');
});

// Health check for additional compatibility
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the public directory
app.use(serveStatic(path.join(__dirname, 'public'), {
  index: ['index.html'],
  setHeaders: (res, filePath) => {
    // Set cache control headers for static assets
    if (filePath.endsWith('.html')) {
      // Don't cache HTML files
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      // Cache static assets for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// API endpoint to verify member data is accessible
app.get('/api/check-members', (req, res) => {
  try {
    const membersFilePath = path.join(__dirname, 'public', 'api', 'members.json');
    if (fs.existsSync(membersFilePath)) {
      const membersData = JSON.parse(fs.readFileSync(membersFilePath, 'utf8'));
      res.json({ 
        success: true, 
        memberCount: membersData.length,
        message: 'Members data is accessible'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Members file not found'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error accessing members data',
      error: error.message
    });
  }
});

// Load members data from files
function loadMembers() {
  try {
    if (fs.existsSync(MEMBERS_FILE)) {
      const data = fs.readFileSync(MEMBERS_FILE, 'utf8');
      members = JSON.parse(data);
      log(`Loaded ${members.length} members from ${MEMBERS_FILE}`);
    } else {
      log(`Members file not found at ${MEMBERS_FILE}`, true);
      members = [];
    }
  } catch (error) {
    log(`Error loading members: ${error.message}`, true);
    members = [];
  }
}

// Update members files with current data
function updateMembersFiles() {
  try {
    // Create API directory if it doesn't exist
    const apiDir = path.dirname(MEMBERS_FILE);
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
      log(`Created API directory: ${apiDir}`);
    }
    
    // Write to members.json
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
    log(`Updated ${members.length} members in ${MEMBERS_FILE}`);
    
    // Update embedded-members file for browser-side access
    updateEmbeddedMembersFile();
  } catch (error) {
    log(`Error updating members files: ${error.message}`, true);
  }
}

// Update the embedded-members file
function updateEmbeddedMembersFile() {
  try {
    fs.writeFileSync(EMBEDDED_MEMBERS_FILE, 
      `const EMBEDDED_MEMBERS = ${JSON.stringify(members)};`);
    log('Updated embedded-members file');
  } catch (error) {
    log(`Error updating embedded-members file: ${error.message}`, true);
  }
}

// Process daily distribution for all members
function processDailyDistribution() {
  const today = new Date().toISOString().split('T')[0];
  let updatedCount = 0;
  
  members.forEach(member => {
    // Check if the lastDistributionDate is not today
    const lastDist = member.lastDistributionDate || member.last_distribution_date;
    if (lastDist !== today) {
      // Add daily distribution (1 SOLAR per day)
      let newTotal = (parseFloat(member.totalSolar || member.total_solar) || 0) + 1;
      
      // Update all variations of the property (some entries use different formats)
      member.totalSolar = newTotal;
      member.total_solar = newTotal.toFixed(4);
      
      // Calculate dollar value
      const dollarValue = newTotal * SOLAR_CONSTANTS.USD_PER_SOLAR;
      member.totalDollars = dollarValue;
      member.total_dollars = dollarValue.toFixed(4);
      
      // Update lastDistributionDate (both formats)
      member.lastDistributionDate = today;
      member.last_distribution_date = today;
      
      updatedCount++;
      log(`Member ${member.name} received 1 SOLAR, new total: ${newTotal.toFixed(4)} SOLAR = $${dollarValue.toLocaleString()}`);
    }
  });
  
  if (updatedCount > 0) {
    log(`Processed daily distribution for ${updatedCount} members`);
    updateMembersFiles();
  } else {
    log('No members needed distribution updates today');
  }
}

// Check and run daily distributions if needed
function checkAndProcessDailyDistributions() {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if any member needs distribution for today
  const needsDistribution = members.some(m => {
    const lastDist = m.lastDistributionDate || m.last_distribution_date;
    return lastDist !== today;
  });
  
  if (needsDistribution) {
    log('Found members needing distribution for today, processing...');
    processDailyDistribution();
  } else {
    log('All members are up to date with distributions');
  }
}

// Setup scheduled tasks
function setupScheduledTasks() {
  // Check if we need to process distributions on startup
  checkAndProcessDailyDistributions();
  
  // Schedule daily check at midnight UTC (5 PM Pacific Time)
  const DISTRIBUTION_HOUR_UTC = 0; // Midnight UTC (GMT)
  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === DISTRIBUTION_HOUR_UTC && now.getUTCMinutes() === 0) {
      log('Scheduled distribution time reached, processing...');
      processDailyDistribution();
    }
  }, 60 * 1000); // Check every minute
  
  log('Scheduled tasks initialized');
}

// Start the server
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  log(`Health check available at http://localhost:${PORT}/healthz`);
  log(`Main application at http://localhost:${PORT}/`);
  
  // Load members data
  loadMembers();
  
  // Setup scheduled tasks
  setupScheduledTasks();
});