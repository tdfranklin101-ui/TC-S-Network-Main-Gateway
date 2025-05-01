/**
 * The Current-See Production Stable Server
 * 
 * This file is specifically designed for Replit deployments
 * with correct SOLAR calculations (1 SOLAR per day) and enhanced error handling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Constants
const PORT = process.env.PORT || 3001; // Using 3001 to avoid conflicts
const HOST = '0.0.0.0';

// Setup error handling for uncaught exceptions
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
      console.warn(`CSV file not found: ${filePath}`);
      return [];
    }
    
    // Read the contents of the CSV file
    const csvContent = fs.readFileSync(filePath, 'utf8');
    
    // Split the content into lines
    const lines = csvContent.split('\n');
    
    // Extract header and data rows
    const header = lines[0].split(',');
    const dataRows = lines.slice(1);
    
    // Process each row into a member object
    const members = dataRows
      .filter(row => row.trim() !== '') // Skip empty rows
      .map(row => {
        const values = row.split(',');
        
        // Create an object with properties from CSV
        const member = {};
        header.forEach((key, index) => {
          member[key.trim()] = values[index] ? values[index].trim() : '';
        });
        
        // Handle numeric IDs
        member.id = parseInt(member.id, 10);
        
        // Set proper flags for reserve account
        if (member.id === 0 || member.name === "TC-S Solar Reserve") {
          member.isReserve = true;
        }
        
        return member;
      });
    
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

// Members data storage
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
    
    // Update the rest of the members with calculated values
    members = updateMembersWithCurrentTotals(defaultMembers);
    console.log(`Loaded and updated ${members.length} default members`);
    
    // Save to embedded file
    saveEmbeddedMembersFile(members);
  } catch (error) {
    console.error(`Error in loadMembersData: ${error.message}`);
    
    // Use basic fallback data with VERIFIED values
    members = [
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
  }
}

// Function to save members data to embedded JSON file
function saveEmbeddedMembersFile(membersList) {
  try {
    // Verify the data before saving
    if (!Array.isArray(membersList) || membersList.length === 0) {
      throw new Error('Invalid member data: must be non-empty array');
    }
    
    // Ensure the data has the required fields for key members
    const terry = membersList.find(m => m.name === "Terry D. Franklin");
    const jf = membersList.find(m => m.name === "JF");
    const solarReserve = membersList.find(m => m.name === "TC-S Solar Reserve");
    
    if (!terry || !jf || !solarReserve) {
      console.warn('Warning: Key members missing from data, validating integrity before save');
    }
    
    // Create backup of current file if it exists
    const embeddedPath = './public/embedded-members.json';
    if (fs.existsSync(embeddedPath)) {
      // Create a backup directory if it doesn't exist
      const backupDir = './backup';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Create backup with timestamp
      const backupPath = `${backupDir}/embedded-members-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.copyFileSync(embeddedPath, backupPath);
      console.log(`Created backup of members file at ${backupPath}`);
    }
    
    // Write the new data
    fs.writeFileSync(embeddedPath, JSON.stringify(membersList, null, 2), 'utf8');
    console.log(`Updated embedded-members.json with current SOLAR totals`);
    
    // Verify the file was written correctly by reading it back
    try {
      const savedData = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
      if (!Array.isArray(savedData) || savedData.length !== membersList.length) {
        throw new Error('Verification failed: saved data doesn\'t match original');
      }
      console.log(`Verified saved data: contains ${savedData.length} members`);
    } catch (verifyError) {
      console.error(`Error verifying saved file: ${verifyError.message}`);
      // If verification fails, try one more time
      fs.writeFileSync(embeddedPath, JSON.stringify(membersList, null, 2), 'utf8');
      console.log('Second attempt to update embedded-members.json completed');
    }
  } catch (error) {
    console.error(`Error saving embedded members file: ${error.message}`);
    
    // Try an alternative save method if the main one fails
    try {
      const alternativePath = './public/embedded-members-backup.json';
      fs.writeFileSync(alternativePath, JSON.stringify(membersList, null, 2), 'utf8');
      console.log(`Saved backup data to ${alternativePath} as fallback`);
    } catch (backupError) {
      console.error(`Failed to save backup data: ${backupError.message}`);
    }
  }
}

// Function to calculate Solar Clock data
function calculateSolarData() {
  try {
    // Get the start date of the solar clock
    const startDate = new Date(solarClockData.startDate);
    const currentDate = new Date();
    
    // Calculate the total days since start
    const totalDays = daysBetweenDates(startDate, currentDate);
    
    // Get total member count excluding reserve accounts
    const memberCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
    
    // Calculate total SOLAR distributed (1 per day per member)
    let totalSolar = 0;
    
    // Sum up all member SOLAR amounts
    members.forEach(member => {
      if (member.id !== 0 && !member.isReserve) {
        totalSolar += parseFloat(member.totalSolar);
      }
    });
    
    // Calculate total kWh (4,913 kWh per SOLAR)
    const totalKwh = totalSolar * solarClockData.kwhPerSolar;
    
    // Calculate total value ($136,000 per SOLAR)
    const totalValue = totalSolar * solarClockData.valuePerSolar;
    
    // Update the solar clock data
    solarClockData = {
      ...solarClockData,
      totalSolar,
      totalKwh,
      totalValue,
      memberCount,
      totalDays,
      lastUpdated: currentDate.toISOString()
    };
    
    return solarClockData;
  } catch (error) {
    console.error(`Error calculating solar data: ${error.message}`);
    return solarClockData;
  }
}

// Initialize the app
const app = express();

// CORS middleware
app.use(cors());

// Middleware for JSON parsing
app.use(express.json());

// Middleware for URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// Static file serving middleware
app.use(express.static('public'));

// Health check route for Replit deployments (respond to root path)
app.get('/', (req, res) => {
  // Serve index.html for the root path
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check route for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API endpoint for solar clock data
app.get('/api/solar-clock', (req, res) => {
  // Recalculate solar data before sending
  const updatedData = calculateSolarData();
  res.json(updatedData);
});

// API endpoint for a formatted members.json file
app.get('/api/members.json', (req, res) => {
  // Return all members in JSON format
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

// API endpoint for members data
app.get('/api/members', (req, res) => {
  // Return all members except reserve accounts
  const userMembers = members.filter(m => m.id !== 0 && !m.isReserve);
  res.json(userMembers);
});

// API endpoint for member count
app.get('/api/member-count', (req, res) => {
  // Count only user members (not reserves)
  const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
  res.json({ count: userCount });
});

// API endpoint for embedded members - same format as the embedded-members.json file
app.get('/embedded-members', (req, res) => {
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