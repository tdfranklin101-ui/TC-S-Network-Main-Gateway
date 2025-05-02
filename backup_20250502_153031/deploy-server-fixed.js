/**
 * The Current-See Deployment-Ready Server (FIXED)
 * 
 * This file is specifically designed for Replit deployments
 * with the correct SOLAR calculations (1 SOLAR per day)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Constants
const PORT = process.env.PORT || 3001; // Using 3001 to avoid conflicts
const HOST = '0.0.0.0';

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
  
  // Set both dates to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate the difference in milliseconds
  const diffMs = end - start;
  
  // Convert to days and add 1 for inclusive counting
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

// Function to calculate current SOLAR balance based on join date and current date
function calculateCurrentSolar(joinDate, currentDate = new Date()) {
  // Get the number of days (inclusive) from join date to current date
  const days = daysBetweenDates(joinDate, currentDate);
  
  // Each member gets 1 SOLAR per day since joining
  return days;
}

// Members Data
let members = [];
const MEMBERS_EXPORT_PATH = path.join(__dirname, 'members_export.csv');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members.json');

// Function to load members from CSV file
function loadMembersFromCSV(filePath, currentDate = new Date()) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`CSV file not found: ${filePath}`);
      return null;
    }
    
    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n');
    
    // Skip header line
    const header = lines[0];
    const members = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      
      // Handle quoted fields properly
      const fields = [];
      let inQuote = false;
      let currentField = '';
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          fields.push(currentField);
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      // Add the last field
      fields.push(currentField);
      
      if (fields.length < 11) continue; // Skip invalid lines
      
      // Extract member data from CSV fields
      const [id, username, name, email, joinedDate, totalSolar, totalDollars, isAnonymous, isReserve, isPlaceholder, lastDistributionDate] = fields;
      
      const member = {
        id: parseInt(id, 10), 
        username: username.replace(/"/g, ''),
        name: name.replace(/"/g, ''),
        joinedDate: joinedDate.replace(/"/g, ''),
        totalSolar: parseFloat(totalSolar),
        totalDollars: parseFloat(totalDollars),
        isAnonymous: isAnonymous.toLowerCase() === 'true',
        isReserve: isReserve && isReserve.toLowerCase() === 'true',
        lastDistributionDate: lastDistributionDate.replace(/"/g, '') || currentDate.toISOString().split('T')[0]
      };
      
      members.push(member);
    }
    
    console.log(`Successfully loaded ${members.length} members from CSV file`);
    return members;
  } catch (error) {
    console.error(`Error parsing CSV file: ${error.message}`);
    return null;
  }
}

// Update members with current SOLAR totals based on join date
function updateMembersWithCurrentTotals(members, currentDate = new Date()) {
  return members.map(member => {
    // Skip updating reserve accounts or accounts with fixed values
    if (member.isReserve || member.username.includes('reserve')) {
      return {
        ...member,
        // Ensure totalDollars is calculated as a numeric value
        totalDollars: member.totalSolar * 136000
      };
    }

    // Calculate current SOLAR based on join date - 1 SOLAR per day
    const totalSolar = calculateCurrentSolar(member.joinedDate, currentDate);
    
    return {
      ...member,
      totalSolar: parseFloat(totalSolar.toFixed(4)),
      totalDollars: parseFloat((totalSolar * 136000).toFixed(2)),
      totalKwh: parseFloat((totalSolar * 4913).toFixed(2)),
      lastDistributionDate: currentDate.toISOString().split('T')[0]
    };
  });
}

// Function to load members data
function loadMembersData() {
  const currentDate = new Date();
  let loadedMembers = [];
  
  // Try to load members from CSV file
  const csvMembers = loadMembersFromCSV(MEMBERS_EXPORT_PATH, currentDate);
  
  if (csvMembers && csvMembers.length > 0) {
    // Update with current totals based on 1 SOLAR per day
    loadedMembers = updateMembersWithCurrentTotals(csvMembers, currentDate);
    console.log(`Loaded and updated ${loadedMembers.length} members from CSV file`);
    
    // Create placeholder if needed to reach 16 members
    if (loadedMembers.length < 15) {
      // Find the highest ID
      const maxId = loadedMembers.reduce((max, m) => Math.max(max, m.id), 0);
      
      // Add a placeholder member
      loadedMembers.push({
        id: maxId + 1,
        username: "future.member",
        name: "You are next",
        joinedDate: currentDate.toISOString().split('T')[0],
        totalSolar: 1.0,
        totalDollars: 136000,
        totalKwh: 4913,
        isAnonymous: false,
        isPlaceholder: true,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      });
      
      console.log("Added placeholder member to reach 16 members");
    }
    
    // Save to embedded members file for client-side access
    saveEmbeddedMembersFile(loadedMembers);
    
    return loadedMembers;
  } else {
    console.error("Failed to load members from CSV file");
    
    // Generate a basic set of members as fallback
    const defaultMembers = [
      {
        id: 0,
        username: "tcs.reserve",
        name: "TC-S Solar Reserve",
        joinedDate: "2025-04-07",
        totalSolar: 10000000000,
        totalDollars: 10000000000 * 136000,
        totalKwh: 10000000000 * 4913,
        isAnonymous: false,
        isReserve: true,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      },
      {
        id: 1,
        username: "terry.franklin",
        name: "Terry D. Franklin",
        joinedDate: "2025-04-09",
        totalSolar: calculateCurrentSolar("2025-04-09", currentDate),
        totalDollars: calculateCurrentSolar("2025-04-09", currentDate) * 136000,
        totalKwh: calculateCurrentSolar("2025-04-09", currentDate) * 4913,
        isAnonymous: false,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      },
      {
        id: 2,
        username: "j.franklin",
        name: "JF",
        joinedDate: "2025-04-10",
        totalSolar: calculateCurrentSolar("2025-04-10", currentDate),
        totalDollars: calculateCurrentSolar("2025-04-10", currentDate) * 136000,
        totalKwh: calculateCurrentSolar("2025-04-10", currentDate) * 4913,
        isAnonymous: false,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      }
    ];
    
    // Add additional members with sequential dates
    const additionalMembers = [
      { name: "Davis", date: "2025-04-18" },
      { name: "Miles Franklin", date: "2025-04-18" },
      { name: "Arden F", date: "2025-04-19" },
      { name: "Marissa Hasseman", date: "2025-04-19" },
      { name: "Kim", date: "2025-04-19" },
      { name: "Jeff Elmore", date: "2025-04-19" },
      { name: "Liam McKay", date: "2025-04-19" },
      { name: "KJM", date: "2025-04-20" },
      { name: "Brianna", date: "2025-04-20" },
      { name: "Alex", date: "2025-04-21" },
      { name: "Kealani Ventura", date: "2025-04-21" },
      { name: "You are next", date: "2025-04-22" }
    ];
    
    // Add each additional member
    additionalMembers.forEach((member, index) => {
      defaultMembers.push({
        id: index + 3,
        username: member.name.toLowerCase().replace(/\s+/g, '.'),
        name: member.name,
        joinedDate: member.date,
        totalSolar: calculateCurrentSolar(member.date, currentDate),
        totalDollars: calculateCurrentSolar(member.date, currentDate) * 136000,
        totalKwh: calculateCurrentSolar(member.date, currentDate) * 4913,
        isAnonymous: false,
        lastDistributionDate: currentDate.toISOString().split('T')[0]
      });
    });
    
    console.log(`Generated ${defaultMembers.length} default members with current calculations`);
    
    // Save to embedded members file for client-side access
    saveEmbeddedMembersFile(defaultMembers);
    
    return defaultMembers;
  }
}

// Function to save the members list to the embedded members file
function saveEmbeddedMembersFile(membersList) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(EMBEDDED_MEMBERS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save the members data
    fs.writeFileSync(EMBEDDED_MEMBERS_PATH, JSON.stringify(membersList, null, 2));
    console.log(`Updated embedded-members.json with current SOLAR totals`);
    return true;
  } catch (error) {
    console.error(`Error saving embedded members file: ${error.message}`);
    return false;
  }
}

// Update the solar clock data
function calculateSolarData() {
  try {
    const start = new Date(solarClockData.startDate);
    const now = new Date();
    
    // Calculate elapsed time in seconds
    const elapsedSeconds = Math.floor((now - start) / 1000);
    
    // The base rate of kWh per second (global solar influx captured monetarily)
    const kwhPerSecond = 48.33e6; // 48.33 million kWh per second based on global solar capture
    
    // Calculate total kWh
    solarClockData.totalKwh = elapsedSeconds * kwhPerSecond;
    
    // Calculate total value ($136,000 per 4,913 kWh based on SOLAR valuation)
    solarClockData.totalValue = solarClockData.totalKwh * (solarClockData.valuePerSolar / solarClockData.kwhPerSolar);
    
    // Update timestamp
    solarClockData.lastUpdated = now.toISOString();
    
    return solarClockData;
  } catch (error) {
    console.error(`Error calculating solar data: ${error.message}`);
    return solarClockData;
  }
}

// Load the members data
members = loadMembersData();

// Initialize the application
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// Health check endpoint
app.get(['/', '/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: 'The Current-See Server is running'
  });
});

// API endpoint for solar clock data
app.get('/api/solar-clock', (req, res) => {
  res.json(calculateSolarData());
});

// API endpoint for member distribution data
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

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Deployment server running at http://${HOST}:${PORT}/`);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});