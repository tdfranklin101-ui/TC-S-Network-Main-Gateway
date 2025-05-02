/**
 * The Current-See Deployment Production Server
 * 
 * This server is specifically designed for Replit deployment
 * with correct SOLAR calculations, stability enhancements, 
 * and fixed member listing functionality.
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

// Create Express application
const app = express();

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Enable CORS for mobile app connectivity
app.use(cors());

// Middleware for parsing JSON
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static('public'));

// Global members array to store all member data
let members = [];

/**
 * Calculate days between two dates accurately
 */
function daysBetweenDates(startDate, endDate) {
  // Convert both dates to UTC to avoid timezone issues
  const start = new Date(Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ));
  
  const end = new Date(Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  ));
  
  // Calculate difference in milliseconds
  const diffMs = end - start;
  
  // Convert to days (including partial days)
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate current SOLAR amount for a member
 * based on join date and current date
 */
function calculateCurrentSolar(joinDate, currentDate = new Date()) {
  // Parse input date if it's a string
  const startDate = typeof joinDate === 'string' 
    ? new Date(joinDate)
    : joinDate;
  
  // Calculate days active (1 SOLAR per day)
  const daysActive = daysBetweenDates(startDate, currentDate);
  
  // Return SOLAR amount (1 per day)
  return daysActive;
}

/**
 * Load members from the CSV file and calculate current totals
 */
function loadMembersFromCSV(filePath, currentDate = new Date()) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Members CSV file not found: ${filePath}`);
      return [];
    }
    
    // Read CSV file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Split into lines
    const lines = fileContent.split('\n');
    
    // Skip header and empty lines, parse each member
    return lines
      .slice(1) // Skip header row
      .filter(line => line.trim() !== '')
      .map((line, index) => {
        // Split CSV fields
        const fields = line.split(',');
        
        // Extract member data
        const id = parseInt(fields[0], 10) || index + 1;
        const name = fields[1]?.trim() || `Member ${id}`;
        const joinDateStr = fields[2]?.trim() || new Date().toISOString().split('T')[0];
        const joinDate = new Date(joinDateStr);
        const isReserve = (fields[3]?.toLowerCase()?.trim() === 'true') || false;
        const initialReserve = parseFloat(fields[4] || '0');
        
        // Calculate current SOLAR based on days since joining
        const solarAmount = isReserve && initialReserve > 0 
          ? initialReserve 
          : calculateCurrentSolar(joinDate, currentDate);
        
        // Calculate equivalent USD value ($136,000 per SOLAR)
        const dollarValue = solarAmount * 136000;
        
        // Calculate equivalent kWh value (4,913 kWh per SOLAR)
        const kwhValue = solarAmount * 4913;
        
        // Create member object
        return {
          id,
          name,
          joinedDate: joinDateStr,
          isReserve,
          initialReserve,
          totalSolar: solarAmount.toFixed(4),
          totalDollars: dollarValue.toFixed(2),
          totalKwh: kwhValue.toFixed(2),
          daysActive: daysBetweenDates(joinDate, currentDate)
        };
      });
  } catch (error) {
    console.error(`Error loading members from CSV: ${error.message}`);
    return [];
  }
}

/**
 * Update members with current calculated totals
 */
function updateMembersWithCurrentTotals(members, currentDate = new Date()) {
  return members.map(member => {
    // Skip updating reserves with fixed amounts
    if (member.isReserve && member.initialReserve > 0) {
      return member;
    }
    
    // Parse joined date
    const joinDate = new Date(member.joinedDate);
    
    // Calculate current SOLAR amount (1 per day)
    const solarAmount = calculateCurrentSolar(joinDate, currentDate);
    
    // Calculate equivalent values
    const dollarValue = solarAmount * 136000;
    const kwhValue = solarAmount * 4913;
    
    // Update member
    return {
      ...member,
      totalSolar: solarAmount.toFixed(4),
      totalDollars: dollarValue.toFixed(2),
      totalKwh: kwhValue.toFixed(2),
      daysActive: daysBetweenDates(joinDate, currentDate)
    };
  });
}

/**
 * Load members data from multiple sources with fallbacks
 */
function loadMembersData() {
  try {
    console.log('Loading members data...');
    
    // Try to load from embedded-members.json first
    const embeddedPath = path.join(__dirname, 'public', 'embedded-members.json');
    
    if (fs.existsSync(embeddedPath)) {
      try {
        const fileContent = fs.readFileSync(embeddedPath, 'utf8');
        const parsedData = JSON.parse(fileContent);
        
        // Check if we have reserve account present
        const hasReserve = parsedData.some(m => m.id === 0 && m.name === 'TC-S Solar Reserve');
        
        if (parsedData.length > 0 && hasReserve) {
          console.log(`Successfully loaded ${parsedData.length} members from embedded-members.json`);
          console.log('TC-S Solar Reserve is present');
          members = updateMembersWithCurrentTotals(parsedData);
          return;
        }
      } catch (e) {
        console.error(`Error parsing embedded-members.json: ${e.message}`);
      }
    }
    
    // If embedded file failed, try CSV file
    const csvPath = path.join(__dirname, 'data', 'members.csv');
    
    if (fs.existsSync(csvPath)) {
      const csvMembers = loadMembersFromCSV(csvPath);
      
      if (csvMembers.length > 0) {
        console.log(`Successfully loaded ${csvMembers.length} members from CSV`);
        members = csvMembers;
        
        // Save to embedded file for future use
        saveEmbeddedMembersFile(members);
        return;
      }
    }
    
    // Last resort: Check if we have a backup JSON in data directory
    const jsonPath = path.join(__dirname, 'data', 'members.json');
    
    if (fs.existsSync(jsonPath)) {
      try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const jsonMembers = JSON.parse(jsonContent);
        
        if (jsonMembers.length > 0) {
          console.log(`Successfully loaded ${jsonMembers.length} members from JSON backup`);
          members = updateMembersWithCurrentTotals(jsonMembers);
          
          // Save to embedded file for future use
          saveEmbeddedMembersFile(members);
          return;
        }
      } catch (e) {
        console.error(`Error parsing members.json backup: ${e.message}`);
      }
    }
    
    // If everything failed, create placeholder data for TC-S Solar Reserve
    console.warn('All member sources failed, creating minimal dataset with TC-S Solar Reserve');
    
    members = [
      {
        id: 0,
        name: 'TC-S Solar Reserve',
        joinedDate: '2025-04-07',
        isReserve: true,
        initialReserve: 10000000000,
        totalSolar: '10000000000.0000',
        totalDollars: '1360000000000000.00',
        totalKwh: '49130000000000.00',
        daysActive: 0
      },
      {
        id: 1,
        name: 'Terry D. Franklin',
        joinedDate: '2025-04-09',
        isReserve: false,
        initialReserve: 0,
        totalSolar: '22.0000',
        totalDollars: '2992000.00',
        totalKwh: '108086.00',
        daysActive: 22
      },
      {
        id: 2,
        name: 'JF',
        joinedDate: '2025-04-10',
        isReserve: false,
        initialReserve: 0,
        totalSolar: '21.0000',
        totalDollars: '2856000.00',
        totalKwh: '103173.00',
        daysActive: 21
      }
    ];
    
    // Save this placeholder data to embedded file
    saveEmbeddedMembersFile(members);
  } catch (error) {
    console.error(`Error in loadMembersData: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Save members to embedded-members.json file
 */
function saveEmbeddedMembersFile(membersList) {
  try {
    const filePath = path.join(__dirname, 'public', 'embedded-members.json');
    
    // Create a backup before writing
    if (fs.existsSync(filePath)) {
      const backupDir = path.join(__dirname, 'backup');
      
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Create timestamped backup
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(backupDir, `embedded-members-${timestamp}.json`);
      
      fs.copyFileSync(filePath, backupPath);
    }
    
    // Format with pretty printing for readability
    const jsonContent = JSON.stringify(membersList, null, 2);
    
    // Write new data
    fs.writeFileSync(filePath, jsonContent, 'utf8');
    
    console.log(`Saved ${membersList.length} members to embedded-members.json`);
  } catch (error) {
    console.error(`Error saving embedded members file: ${error.message}`);
  }
}

/**
 * Calculate Solar Clock data for current totals
 */
function calculateSolarData() {
  try {
    // Calculate total SOLAR, dollars, and kWh
    let totalSolar = 0;
    let totalDollars = 0;
    let totalKwh = 0;
    
    // Skip TC-S Solar Reserve in calculations
    for (const member of members) {
      if (member.id !== 0 && !member.isReserve) {
        totalSolar += parseFloat(member.totalSolar || 0);
        totalDollars += parseFloat(member.totalDollars || 0);
        totalKwh += parseFloat(member.totalKwh || 0);
      }
    }
    
    // Get user count (excluding reserves)
    const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
    
    // Format with appropriate precision
    const data = {
      timestamp: new Date().toISOString(),
      totalSolar: totalSolar.toFixed(4),
      totalDollars: totalDollars.toFixed(2),
      totalKwh: totalKwh.toFixed(2),
      formattedDollars: '$' + totalDollars.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      formattedKwh: totalKwh.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' kWh',
      // MkWh format with 6 decimal places
      formattedMkwh: (totalKwh / 1000000).toLocaleString('en-US', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      }) + ' MkWh',
      userCount: userCount,
      dataSource: 'live'
    };
    
    return data;
  } catch (error) {
    console.error(`Error calculating solar data: ${error.message}`);
    
    // Return fallback data
    return {
      timestamp: new Date().toISOString(),
      totalSolar: '43.0000',
      totalDollars: '5848000.00',
      totalKwh: '211259.00',
      formattedDollars: '$5,848,000.00',
      formattedKwh: '211,259.00 kWh',
      formattedMkwh: '0.211259 MkWh',
      userCount: 2,
      dataSource: 'fallback',
      error: error.message
    };
  }
}

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('The Current-See Server is running.');
});

// Additional health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.1.0'
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Solar clock data endpoint
app.get('/api/solar-clock', (req, res) => {
  const updatedData = calculateSolarData();
  res.json(updatedData);
});

// API endpoint for a formatted members.json file
app.get('/api/members.json', (req, res) => {
  // Return all members in JSON format, ensure we're not filtering anything
  console.log(`[DEBUG] /api/members.json returning ${members.length} members (including TC-S Solar Reserve)`);
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
  // Return all members including reserve accounts - this is needed for the members list
  console.log(`[DEBUG] /api/members returning ${members.length} members (including TC-S Solar Reserve)`);
  res.json(members);
});

// API endpoint for member count
app.get('/api/member-count', (req, res) => {
  // Count only user members (not reserves) for the counter display
  const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
  console.log(`[DEBUG] /api/member-count returning count: ${userCount}`);
  res.json({ count: userCount });
});

// API endpoint for embedded members - same format as the embedded-members.json file
app.get('/embedded-members', (req, res) => {
  // Make sure to send the full members array
  console.log(`[DEBUG] /embedded-members returning ${members.length} members (including TC-S Solar Reserve)`);
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