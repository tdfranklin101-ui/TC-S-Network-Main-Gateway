/**
 * The Current-See Production Stable Server (FIXED)
 * 
 * This file ensures all API endpoints consistently return the complete member list
 * including the TC-S Solar Reserve
 */

// Import required modules
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const path = require('path');
// No longer using csvtojson library, implemented our own CSV parsing

// Set up Express application
const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Configure CORS to allow mobile app access
app.use(cors());

// Configure body parsing and static file serving
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Continue running despite errors
});

// Solar Clock Data
let solarClockData = {
  startDate: '2025-04-07T00:00:00Z',
  totalKwh: 0,
  totalValue: 0,
  kwhPerSolar: 4913,
  valuePerSolar: 136000,
  lastUpdated: new Date().toISOString()
};

// Function to calculate days between dates (inclusive)
function daysBetweenDates(startDate, endDate) {
  // Create date objects from strings if necessary
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  // Set both dates to UTC midnight
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  
  // Calculate the difference in days
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysDifference = Math.floor((endUtc - startUtc) / millisecondsPerDay) + 1; // +1 to make it inclusive
  
  return daysDifference;
}

// Function to calculate current SOLAR based on join date
function calculateCurrentSolar(joinDate, currentDate = new Date()) {
  return daysBetweenDates(joinDate, currentDate);
}

// Load members from CSV file
function loadMembersFromCSV(filePath, currentDate = new Date()) {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`CSV file not found: ${filePath}`);
      return [];
    }
    
    // Read the CSV file
    const csvData = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV to JSON
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Process each line (skipping header)
    const members = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      // Create member object from CSV row
      if (values.length >= headers.length) {
        const member = {};
        
        // Map CSV columns to object properties
        for (let j = 0; j < headers.length; j++) {
          member[headers[j]] = values[j];
        }
        
        // Ensure numeric ID
        member.id = parseInt(member.id, 10);
        
        // Convert string flags to booleans
        member.isAnonymous = member.isAnonymous === 'true';
        member.isReserve = member.isReserve === 'true';
        
        members.push(member);
      }
    }
    
    console.log(`Successfully loaded ${members.length} members from CSV file`);
    return members;
  } catch (error) {
    console.error(`Error loading members from CSV: ${error.message}`);
    return [];
  }
}

// Update members with current SOLAR totals
function updateMembersWithCurrentTotals(members, currentDate = new Date()) {
  return members.map(member => {
    // For non-reserve members, calculate SOLAR based on join date
    if (member.id !== 0 && !member.isReserve) {
      // Calculate current SOLAR (1 SOLAR per day since joining)
      const joinedDate = new Date(member.joinedDate);
      const totalSolar = calculateCurrentSolar(joinedDate, currentDate);
      
      // Update member with calculated values
      return {
        ...member,
        totalSolar: totalSolar,
        totalDollars: totalSolar * 136000,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      };
    }
    
    // For reserve accounts, keep existing values
    return member;
  });
}

// Global members array
let members = [];

// Function to load members data with fallbacks
function loadMembersData() {
  try {
    // First try to load from CSV file
    const csvMembers = loadMembersFromCSV('./data/members.csv');
    
    if (csvMembers.length > 0) {
      // Update with current totals
      members = updateMembersWithCurrentTotals(csvMembers);
      console.log(`Loaded and updated ${members.length} members from CSV file`);
      
      // Save to embedded file
      saveEmbeddedMembersFile(members);
      
      return;
    }
    
    // If CSV failed, try to load from embedded JSON file
    try {
      const embeddedContent = fs.readFileSync('./public/embedded-members.json', 'utf8');
      const embeddedMembers = JSON.parse(embeddedContent);
      
      if (Array.isArray(embeddedMembers) && embeddedMembers.length > 0) {
        // Update with current totals
        members = updateMembersWithCurrentTotals(embeddedMembers);
        console.log(`Loaded and updated ${members.length} members from embedded JSON`);
        
        // Save back to embedded file with updated values
        saveEmbeddedMembersFile(members);
        
        return;
      }
    } catch (embeddedError) {
      console.warn(`Could not load from embedded JSON: ${embeddedError.message}`);
    }
    
    // If previous methods failed, use default data with VERIFIED values
    const defaultMembers = [
      {
        "id": 0,
        "username": "tcs.reserve",
        "name": "TC-S Solar Reserve",
        "joinedDate": "2025-04-07",
        "totalSolar": 10000000000,
        "totalDollars": 1360000000000000,
        "isAnonymous": false,
        "isReserve": true,
        "lastDistributionDate": "2025-04-30"
      },
      {
        "id": 1,
        "username": "terry.franklin",
        "name": "Terry D. Franklin",
        "joinedDate": "2025-04-09",
        "totalSolar": 22,
        "totalDollars": 2992000,
        "isAnonymous": false,
        "lastDistributionDate": "2025-04-30"
      },
      {
        "id": 2,
        "username": "j.franklin",
        "name": "JF",
        "joinedDate": "2025-04-10",
        "totalSolar": 21,
        "totalDollars": 2856000,
        "isAnonymous": false,
        "lastDistributionDate": "2025-04-30"
      }
    ];
    
    // Use default data
    members = defaultMembers;
    console.log(`Using default data with ${members.length} members`);
    
    // Save to embedded file to ensure it exists
    saveEmbeddedMembersFile(members);
  } catch (error) {
    console.error(`Error loading members data: ${error.message}`);
    // Ensure members is at least an empty array to prevent crashes
    members = [];
  }
}

// Function to save the embedded members file
function saveEmbeddedMembersFile(membersList) {
  try {
    // Verify we have member data to save (basic check)
    if (!Array.isArray(membersList) || membersList.length === 0) {
      console.error('Cannot save empty or invalid members list');
      return false;
    }
    
    // Check for critical members (Terry, JF)
    const hasTerry = membersList.some(m => m.name === "Terry D. Franklin");
    const hasJF = membersList.some(m => m.name === "JF");
    
    if (!hasTerry || !hasJF) {
      console.warn('Member list appears to be missing critical members');
    }
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync('./backup')) {
      fs.mkdirSync('./backup');
    }
    
    // Create timestamped backup
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = `./backup/embedded-members-${timestamp}.json`;
    
    // Create backup first (if previous file exists)
    try {
      if (fs.existsSync('./public/embedded-members.json')) {
        fs.copyFileSync('./public/embedded-members.json', backupPath);
        console.log(`Created backup of members file at ${backupPath}`);
      }
    } catch (backupError) {
      console.error(`Error creating backup: ${backupError.message}`);
      // Continue with save despite backup error
    }
    
    // Save the file
    fs.writeFileSync('./public/embedded-members.json', JSON.stringify(membersList, null, 2));
    console.log('Updated embedded-members.json with current SOLAR totals');
    
    // Verify the saved file
    try {
      const savedContent = fs.readFileSync('./public/embedded-members.json', 'utf8');
      const savedMembers = JSON.parse(savedContent);
      console.log(`Verified saved data: contains ${savedMembers.length} members`);
      return true;
    } catch (verifyError) {
      console.error(`Error verifying saved data: ${verifyError.message}`);
      return false;
    }
  } catch (error) {
    console.error(`Error saving embedded members file: ${error.message}`);
    return false;
  }
}

// Function to calculate Solar Clock data
function calculateSolarData() {
  // Use the specified start date
  const startDate = new Date(solarClockData.startDate);
  const currentDate = new Date();
  
  // Calculate days since start (April 7, 2025)
  const daysSinceStart = daysBetweenDates(startDate, currentDate);
  
  // Calculate total energy (members * days * kWhPerSolar)
  // Count only non-reserve members for the calculation
  const activeMembers = members.filter(m => m.id !== 0 && !m.isReserve);
  
  // Calculate total distributed SOLAR
  let totalSolar = 0;
  for (const member of activeMembers) {
    const joinDate = new Date(member.joinedDate);
    totalSolar += daysBetweenDates(joinDate, currentDate);
  }
  
  // 4,913 kWh per SOLAR
  const totalKwh = totalSolar * solarClockData.kwhPerSolar;
  
  // $136,000 per SOLAR
  const totalValue = totalSolar * solarClockData.valuePerSolar;
  
  // Update solar clock data
  solarClockData = {
    ...solarClockData,
    totalKwh: totalKwh,
    totalValue: totalValue,
    activeMembers: activeMembers.length,
    totalSolar: totalSolar,
    daysSinceStart: daysSinceStart,
    lastUpdated: currentDate.toISOString()
  };
  
  return solarClockData;
}

// =====================
// API ROUTES
// =====================

// Health check routes - respond to all of these to ensure deployed app stays running
app.get('/', (req, res) => {
  res.send('The Current-See Server is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API endpoint for the solar clock
app.get('/api/solar-clock', (req, res) => {
  const updatedData = calculateSolarData();
  res.json(updatedData);
});

// API endpoint for a formatted members.json file
app.get('/api/members.json', (req, res) => {
  // Return all members in JSON format, ensure we're not filtering anything
  console.log(`[DEBUG] /api/members.json returning ${members.length} members`);
  res.json(members);
});

// API endpoint for distribution ledger
app.get('/api/distribution-ledger', (req, res) => {
  try {
    // Get current date for all calculations
    const currentDate = new Date();
    
    // Calculate daily distributions for all members
    const distributionData = members.map(member => {
      // Skip special accounts like TC-S Solar Reserve
      if (member.id === 0 || member.isReserve === true) {
        return null;
      }
      
      // Get the member details - ensure proper date parsing
      const joinedDate = new Date(member.joinedDate);
      
      // Calculate days between joined date and now (1 SOLAR per day)
      const days = daysBetweenDates(joinedDate, currentDate);
      
      // Calculate SOLAR amount
      const solarAmount = days;
      
      // Calculate dollar value ($136,000 per SOLAR)
      const dollarValue = solarAmount * 136000;
      
      // Calculate kWh value (4,913 kWh per SOLAR)
      const kwhValue = solarAmount * 4913;
      
      // Create distribution record with all details
      return {
        id: member.id,
        name: member.name,
        joinedDate: member.joinedDate,
        lastDistributionDate: currentDate.toISOString().split('T')[0],
        daysActive: days,
        totalSolar: solarAmount.toFixed(4),     // 4 decimal places
        totalDollars: dollarValue.toFixed(2),   // 2 decimal places for currency
        totalKwh: kwhValue.toFixed(2),          // 2 decimal places for energy
        solarPerDay: 1.0                        // Current daily distribution rate
      };
    }).filter(Boolean); // Remove null entries
    
    // Add timestamp for cache-busting and additional information
    const responseData = {
      timestamp: currentDate.toISOString(),
      distributions: distributionData,
      totalMembers: distributionData.length,
      totalDistributedSolar: distributionData.reduce((sum, d) => sum + parseFloat(d.totalSolar), 0).toFixed(4),
      latestDistributionDate: currentDate.toISOString().split('T')[0]
    };
    
    res.json(responseData);
  } catch (error) {
    console.error(`Error generating distribution ledger: ${error.message}`);
    res.status(500).json({
      error: 'Failed to generate distribution ledger',
      message: error.message
    });
  }
});

// API endpoint for members data - return ALL members
app.get('/api/members', (req, res) => {
  // Return all members including reserve accounts - this is needed for the members list
  console.log(`[DEBUG] /api/members returning ${members.length} members`);
  res.json(members);
});

// API endpoint for member count - return only regular users
app.get('/api/member-count', (req, res) => {
  // Count only user members (not reserves) for the counter display
  const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`[DEBUG] /api/member-count returning count: ${userCount}`);
  res.json({ count: userCount });
});

// API endpoint for embedded members - same format as the embedded-members.json file
app.get('/embedded-members', (req, res) => {
  // Make sure to send the full members array
  console.log(`[DEBUG] /embedded-members returning ${members.length} members`);
  res.json(members);
});

// Initialize members data
loadMembersData();

// Pre-calculate solar data
calculateSolarData();

// Periodically update the members data
setInterval(() => {
  try {
    // Update members with current totals
    members = updateMembersWithCurrentTotals(members);
    
    // Save to embedded file
    saveEmbeddedMembersFile(members);
    
    // Update solar clock data
    calculateSolarData();
    
    console.log('Periodic update completed:', new Date().toISOString());
  } catch (error) {
    console.error('Error in periodic update:', error);
  }
}, 15 * 60 * 1000); // Every 15 minutes

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Deployment server running at http://${HOST}:${PORT}/`);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
  
  // Try to restart after a delay
  setTimeout(() => {
    try {
      server.close();
      server.listen(PORT, HOST, () => {
        console.log(`Server restarted at http://${HOST}:${PORT}/`);
      });
    } catch (restartError) {
      console.error('Failed to restart server:', restartError);
    }
  }, 5000);
});