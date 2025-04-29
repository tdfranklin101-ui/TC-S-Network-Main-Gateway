/**
 * The Current-See Deployment-Ready Server
 * 
 * This file is specifically designed for Replit deployments
 * with minimal dependencies and maximum reliability.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
const CURRENTSEE_DB_URL = process.env.CURRENTSEE_DB_URL;

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

// Function to parse CSV file and extract member data
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

    // Calculate current SOLAR based on join date
    const totalSolar = calculateCurrentSolar(member.joinedDate, currentDate);
    
    return {
      ...member,
      totalSolar: parseFloat(totalSolar.toFixed(4)),
      totalDollars: parseFloat((totalSolar * 136000).toFixed(2))
    };
  });
}

// Members Data with CURRENT totals as of today
let members = [];
// Try to load members from embedded data
const embeddedPath = path.join(__dirname, 'public/embedded-members.json');
const csvPath = path.join(__dirname, 'members_export.csv');

// Current date for calculation
const currentDate = new Date();

// Define main function to load members data
function loadMembersData() {
  let localMembers = [];
  
  try {
    // Attempt to load members from CSV file
    const csvMembers = loadMembersFromCSV(csvPath, currentDate);
    
    // Process CSV members if available
    if (csvMembers && csvMembers.length > 0) {
      // Update with current totals
      const processedMembers = updateMembersWithCurrentTotals(csvMembers, currentDate);
      localMembers = processedMembers;
      console.log(`Loaded and updated ${localMembers.length} members from CSV file`);
      
      // Update the file with current values
      try {
        fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
        console.log("Updated embedded.json with current SOLAR totals from CSV data");
      } catch (writeErr) {
        console.error("Error updating embedded.json file:", writeErr);
      }
    } else {
      // We only get here if CSV loading failed
      console.log("CSV loading failed, using default hardcoded members");
      
      // Default members with up-to-date SOLAR balances - FULL LIST
      const defaultMembers = [
        {
          id: 0,
          username: "tcs.reserve",
          name: "TC-S Solar Reserve",
          joinedDate: "2025-04-07", // Started on system launch date
          totalSolar: 10000000000, // 10 billion SOLAR fixed allocation
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 1,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          // Calculate days from April 9 to today (inclusive)
          totalSolar: calculateCurrentSolar("2025-04-09", currentDate),
          // $136,000 per SOLAR
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 2,
          username: "j.franklin",
          name: "JF",
          joinedDate: "2025-04-10", // Updated to match original documentation
          // Calculate days from April 10 to today (inclusive)
          totalSolar: calculateCurrentSolar("2025-04-10", currentDate),
          // $136,000 per SOLAR
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 3,
          username: "john.doe",
          name: "John D",
          joinedDate: "2025-04-12",
          // Calculate days from April 12 to today (inclusive)
          totalSolar: calculateCurrentSolar("2025-04-12", currentDate),
          // $136,000 per SOLAR
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 4,
          username: "maria.smith",
          name: "Maria S",
          joinedDate: "2025-04-14",
          totalSolar: calculateCurrentSolar("2025-04-14", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 5,
          username: "david.johnson",
          name: "David J",
          joinedDate: "2025-04-15",
          totalSolar: calculateCurrentSolar("2025-04-15", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 6,
          username: "susan.williams",
          name: "Susan W",
          joinedDate: "2025-04-16",
          totalSolar: calculateCurrentSolar("2025-04-16", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 7,
          username: "robert.brown",
          name: "Robert B",
          joinedDate: "2025-04-18",
          totalSolar: calculateCurrentSolar("2025-04-18", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 8,
          username: "lisa.jones",
          name: "Lisa J",
          joinedDate: "2025-04-19",
          totalSolar: calculateCurrentSolar("2025-04-19", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 9,
          username: "michael.miller",
          name: "Michael M",
          joinedDate: "2025-04-21",
          totalSolar: calculateCurrentSolar("2025-04-21", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 10,
          username: "jennifer.davis",
          name: "Jennifer D",
          joinedDate: "2025-04-22",
          totalSolar: calculateCurrentSolar("2025-04-22", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 11,
          username: "james.garcia",
          name: "James G",
          joinedDate: "2025-04-23",
          totalSolar: calculateCurrentSolar("2025-04-23", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 12,
          username: "emily.wilson",
          name: "Emily W",
          joinedDate: "2025-04-24",
          totalSolar: calculateCurrentSolar("2025-04-24", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 13,
          username: "thomas.martinez",
          name: "Thomas M",
          joinedDate: "2025-04-25",
          totalSolar: calculateCurrentSolar("2025-04-25", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 14,
          username: "patricia.rodriguez",
          name: "Patricia R",
          joinedDate: "2025-04-26",
          totalSolar: calculateCurrentSolar("2025-04-26", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        },
        {
          id: 15,
          username: "george.lopez",
          name: "George L",
          joinedDate: "2025-04-27",
          totalSolar: calculateCurrentSolar("2025-04-27", currentDate),
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0]
        }
      ];
  
      // Convert getter to actual property for JSON serialization
      const processedMembers = defaultMembers.map(member => ({
        ...member,
        totalSolar: parseFloat(member.totalSolar.toFixed(4)), // Format to 4 decimal places
        totalDollars: member.totalDollars // Use the computed value
      }));
  
      // Check for existing file or create new
      if (fs.existsSync(embeddedPath)) {
        localMembers = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
        console.log(`Loaded ${localMembers.length} members from embedded data file`);
        
        // Update with current values if file exists
        localMembers = processedMembers;
        
        // Update the file with current values
        try {
          fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
          console.log("Updated embedded.json with current SOLAR totals");
        } catch (writeErr) {
          console.error("Error updating embedded.json file:", writeErr);
        }
      } else {
        // Use the processed default members
        localMembers = processedMembers;
        console.log("Using default members data with current SOLAR totals");
        
        // No need to create directory since we're using a direct file path
        // Make sure the public directory exists
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          try {
            fs.mkdirSync(publicDir, { recursive: true });
            console.log("Created public directory");
          } catch (mkdirErr) {
            console.error("Error creating public directory:", mkdirErr);
          }
        }
        
        // Write the default members to the embedded file
        try {
          fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
          console.log("Created default embedded.json file with current SOLAR totals");
        } catch (writeErr) {
          console.error("Error writing embedded.json file:", writeErr);
        }
      }
    }
    
    // Return the members data
    return localMembers;
  } catch (err) {
    console.error("Error in loadMembersData function:", err);
    throw err; // Re-throw to be caught by the outer try-catch
  }
}

// Try to load members from data sources, with fallback mechanism
try {
  // Call the function to load members
  members = loadMembersData();
} catch (error) {
  console.error("Error processing members data:", error);
  // Default members as a fallback with fixed values (full list)
  members = [
    {
      id: 0,
      username: "tcs.reserve",
      name: "TC-S Solar Reserve",
      joinedDate: "2025-04-07",
      totalSolar: 10000000000, // 10 billion SOLAR fixed allocation
      totalDollars: 1360000000000000, // This is the actual math result for display
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 1,
      username: "terry.franklin",
      name: "Terry D. Franklin",
      joinedDate: "2025-04-09",
      totalSolar: 20.0000, // Placeholder count since April 9
      totalDollars: 2720000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 2,
      username: "j.franklin",
      name: "JF",
      joinedDate: "2025-04-10",
      totalSolar: 19.0000, // Placeholder count since April 10
      totalDollars: 2584000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 3,
      username: "john.doe",
      name: "John D",
      joinedDate: "2025-04-12",
      totalSolar: 17.0000, // Placeholder count since April 12
      totalDollars: 2312000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 4,
      username: "maria.smith",
      name: "Maria S",
      joinedDate: "2025-04-14",
      totalSolar: 15.0000, // Placeholder count since April 14
      totalDollars: 2040000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 5,
      username: "david.johnson",
      name: "David J",
      joinedDate: "2025-04-15",
      totalSolar: 14.0000, // Placeholder count since April 15
      totalDollars: 1904000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 6,
      username: "susan.williams",
      name: "Susan W",
      joinedDate: "2025-04-16",
      totalSolar: 13.0000, // Placeholder count since April 16
      totalDollars: 1768000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 7,
      username: "robert.brown",
      name: "Robert B",
      joinedDate: "2025-04-18",
      totalSolar: 11.0000, // Placeholder count since April 18
      totalDollars: 1496000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 8,
      username: "lisa.jones",
      name: "Lisa J",
      joinedDate: "2025-04-19",
      totalSolar: 10.0000, // Placeholder count since April 19
      totalDollars: 1360000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 9,
      username: "michael.miller",
      name: "Michael M",
      joinedDate: "2025-04-21",
      totalSolar: 8.0000, // Placeholder count since April 21
      totalDollars: 1088000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 10,
      username: "jennifer.davis",
      name: "Jennifer D",
      joinedDate: "2025-04-22",
      totalSolar: 7.0000, // Placeholder count since April 22
      totalDollars: 952000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 11,
      username: "james.garcia",
      name: "James G",
      joinedDate: "2025-04-23",
      totalSolar: 6.0000, // Placeholder count since April 23
      totalDollars: 816000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 12,
      username: "emily.wilson",
      name: "Emily W",
      joinedDate: "2025-04-24",
      totalSolar: 5.0000, // Placeholder count since April 24
      totalDollars: 680000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 13,
      username: "thomas.martinez",
      name: "Thomas M",
      joinedDate: "2025-04-25",
      totalSolar: 4.0000, // Placeholder count since April 25
      totalDollars: 544000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 14,
      username: "patricia.rodriguez",
      name: "Patricia R",
      joinedDate: "2025-04-26",
      totalSolar: 3.0000, // Placeholder count since April 26
      totalDollars: 408000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    },
    {
      id: 15,
      username: "george.lopez",
      name: "George L",
      joinedDate: "2025-04-27",
      totalSolar: 2.0000, // Placeholder count since April 27
      totalDollars: 272000,
      isAnonymous: false,
      lastDistributionDate: new Date().toISOString().split('T')[0]
    }
  ];
}

// Create a function to update the solar clock data
function updateSolarClockData() {
  const now = new Date();
  const startDate = new Date('2025-04-07T00:00:00Z');
  
  // Calculate seconds since start date
  const diffSeconds = Math.floor((now - startDate) / 1000);
  
  // Calculate kWh (using 0.1 kWh per second as an approximation)
  const kwhPerSecond = 0.1;
  const totalKwh = diffSeconds * kwhPerSecond;
  
  // Calculate dollar value at $0.12 per kWh
  const valuePerKwh = 0.12;
  const totalValue = totalKwh * valuePerKwh;
  
  // Calculate elapsed seconds and other data needed by the frontend
  const elapsedSeconds = diffSeconds;
  const dollarPerKwh = valuePerKwh;
  
  // Update the solar clock data with everything needed by the frontend
  solarClockData = {
    startDate: '2025-04-07T00:00:00Z',
    totalKwh: totalKwh,
    totalValue: totalValue,
    totalDollars: totalValue, // Needed by frontend
    kwhPerSolar: 4913,
    valuePerSolar: 136000,
    lastUpdated: now.toISOString(),
    timestamp: now.toISOString(), // Current time for frontend calculations
    elapsedSeconds: elapsedSeconds, // Time elapsed since start date
    kwhPerSecond: kwhPerSecond, // Rate of generation
    dollarPerKwh: dollarPerKwh, // Conversion rate
    displayUnit: 'MkWh' // Display in million kWh format
  };
  
  return solarClockData;
}

// Create Express app
const app = express();

// Basic configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced middleware for page includes
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string') {
      // Get the header content
      let headerContent = '';
      try {
        const headerPath = path.join(__dirname, 'public/includes/header.html');
        headerContent = fs.readFileSync(headerPath, 'utf8');
      } catch (err) {
        console.error('Error reading header file:', err);
      }
      
      // Get the footer content
      let footerContent = '';
      try {
        const footerPath = path.join(__dirname, 'public/includes/footer.html');
        footerContent = fs.readFileSync(footerPath, 'utf8');
      } catch (err) {
        console.error('Error reading footer file:', err);
      }
      
      // Process header placeholder (comment-based)
      if (body.includes('<!-- HEADER_PLACEHOLDER -->')) {
        body = body.replace('<!-- HEADER_PLACEHOLDER -->', headerContent);
      }
      
      // Process footer placeholder (comment-based)
      if (body.includes('<!-- FOOTER_PLACEHOLDER -->')) {
        body = body.replace('<!-- FOOTER_PLACEHOLDER -->', footerContent);
      }
      
      // Process header container (div-based)
      if (body.includes('<div id="header-container"></div>')) {
        body = body.replace('<div id="header-container"></div>', `<div id="header-container">${headerContent}</div>`);
      }
      
      // Process footer container (div-based)
      if (body.includes('<div id="footer-container"></div>')) {
        body = body.replace('<div id="footer-container"></div>', `<div id="footer-container">${footerContent}</div>`);
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Static files
app.use(express.static('public'));

// Health check routes (high priority)
app.get(['/health', '/healthz', '/_health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'The Current-See server is running'
  });
});

// Specific routes to ensure correct file serving for all pages from backup
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/my-solar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-features.html'));
});

// Main navigation pages
app.get('/account-info', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account-info.html'));
});

app.get('/business-plan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

app.get('/business_plan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

app.get('/dashboard-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-demo.html'));
});

app.get('/declaration', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'declaration.html'));
});

app.get('/demo-features', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo-features.html'));
});

app.get('/founder-note', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/founder_note', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/merch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'merch.html'));
});

app.get('/merchandise', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'merch.html'));
});

app.get('/members-list', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'members-list.html'));
});

app.get('/members', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'members-list.html'));
});

app.get('/prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'prototype.html'));
});

app.get('/share', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/solar-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'solar-generator.html'));
});

app.get('/splash', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'splash.html'));
});

app.get('/transfer-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transfer-demo.html'));
});

app.get('/update-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'update-account.html'));
});

// Wallet pages
app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet.html'));
});

app.get('/wallet-ai-features', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-features.html'));
});

app.get('/wallet-ai-prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-prototype.html'));
});

app.get('/wallet-prototype', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-prototype.html'));
});

// AI demo pages
app.get('/ai-assistant-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-assistant-demo.html'));
});

app.get('/voice-assistant-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voice-assistant-demo.html'));
});

// Test pages
app.get('/api-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-test.html'));
});

app.get('/test-language', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-language.html'));
});

app.get('/test-members', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-members.html'));
});

// White paper pages
app.get('/whitepapers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whitepapers.html'));
});

app.get('/white-paper-1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_1.html'));
});

app.get('/white-paper-2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_2.html'));
});

app.get('/white-paper-3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_3.html'));
});

app.get('/white-paper-4', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_4.html'));
});

app.get('/white-paper-5', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_5.html'));
});

app.get('/white-paper-6', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_6.html'));
});

app.get('/white-paper-7', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_7.html'));
});

app.get('/white-paper-9', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_9.html'));
});

app.get('/white-paper-10', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_10.html'));
});

app.get('/white_paper_1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_1.html'));
});

app.get('/white_paper_2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_2.html'));
});

app.get('/white_paper_3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_3.html'));
});

app.get('/white_paper_4', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_4.html'));
});

app.get('/white_paper_5', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_5.html'));
});

app.get('/white_paper_6', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_6.html'));
});

app.get('/white_paper_7', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_7.html'));
});

app.get('/white_paper_9', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_9.html'));
});

app.get('/white_paper_10', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'white_paper_10.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/dashboard.html'));
});

app.get('/admin/member-roster', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin/member-roster.html'));
});

// API Endpoints essential for website functionality
app.get('/api/solar-clock', (req, res) => {
  updateSolarClockData();
  res.json(solarClockData);
});

app.get('/api/members', (req, res) => {
  // Use the helper function to serialize members
  res.json(serializeMembers(members));
});

app.get('/api/solar-accounts/leaderboard', (req, res) => {
  // Use the helper function to serialize members
  res.json(serializeMembers(members));
});

app.get('/api/members.json', (req, res) => {
  // Use the helper function to serialize members
  res.json(serializeMembers(members));
});

// Serve the embedded members data with proper content type
app.get('/embedded-members', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  // Use the helper function to serialize members
  res.json(serializeMembers(members));
});

app.get('/embedded-members.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(serializeMembers(members));
});

// Also maintain backward compatibility with old path
app.get('/embedded-members/embedded.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(serializeMembers(members));
});

app.get('/api/members-data', (req, res) => {
  // Alternative endpoint for JSONP callback support
  const serializedMembers = serializeMembers(members);
  const callback = req.query.callback;
  if (callback) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}(${JSON.stringify(serializedMembers)})`);
  } else {
    res.json(serializedMembers);
  }
});

app.get('/api/members.js', (req, res) => {
  // JSONP endpoint for cross-domain support
  const serializedMembers = serializeMembers(members);
  const callback = req.query.callback || 'updateMembers';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${callback}(${JSON.stringify(serializedMembers)})`);
});

app.get('/api/member-count', (req, res) => {
  res.json({ count: members.length });
});

// Join form submission endpoint
app.post('/api/join', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Both name and email are required'
    });
  }
  
  // Log the join request
  console.log(`Join request received: ${name} (${email})`);
  
  // For deployment, we'll just acknowledge the request
  // In production, this would store the data in the database
  res.json({
    success: true,
    message: 'Thank you for joining The Current-See waitlist!'
  });
});

// Catch-all route for any other paths
app.use((req, res) => {
  // Check if the file exists in public directory
  const filePath = path.join(__dirname, 'public', req.path);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    // Fall back to index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Helper function to serialize members data for JSON responses
// This ensures getter properties like totalDollars are properly handled
function serializeMembers(membersArray) {
  return membersArray.map(member => {
    // Create a plain object with all properties resolved
    const serialized = { ...member };
    
    // Ensure totalDollars is a number, not a getter
    if (typeof member.totalDollars === 'function' || 
        Object.getOwnPropertyDescriptor(member, 'totalDollars')?.get) {
      serialized.totalDollars = member.totalSolar * 136000;
    }
    
    return serialized;
  });
}

// Helper to safely serialize a single member object
function serializeMember(member) {
  // Create a plain object with all properties resolved
  const serialized = { ...member };
  
  // Ensure totalDollars is a number, not a getter
  if (typeof member.totalDollars === 'function' || 
      Object.getOwnPropertyDescriptor(member, 'totalDollars')?.get) {
    serialized.totalDollars = member.totalSolar * 136000;
  }
  
  return serialized;
}

// Helper to safely write member data to a file 
function writeSafelyToFile(filePath, data, message = "Updated file") {
  try {
    // Make sure we properly serialize any getter properties before writing to file
    const serializedData = Array.isArray(data) ? serializeMembers(data) : serializeMember(data);
    fs.writeFileSync(filePath, JSON.stringify(serializedData, null, 2));
    console.log(message);
    return true;
  } catch (err) {
    console.error(`Error writing to file ${filePath}:`, err);
    return false;
  }
}

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Deployment server running at http://${HOST}:${PORT}/`);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// End of deployment server

// Function to process CSV members safely
function processCSVMembers(csvMembers, currentDate) {
  // First update with current totals
  const updatedMembers = updateMembersWithCurrentTotals(csvMembers, currentDate);
  
  // Then ensure all computed properties are properly serialized
  return serializeMembers(updatedMembers).map(member => ({
    ...member,
    // Format totalSolar to 4 decimal places for consistency
    totalSolar: parseFloat(member.totalSolar.toFixed(4))
  }));
}

// Define main function to load members data
function loadMembersData() {
  let localMembers = [];
  
  try {
    // Attempt to load members from CSV file
    const csvMembers = loadMembersFromCSV(csvPath, currentDate);
    
    // Process CSV members if available
    if (csvMembers && csvMembers.length > 0) {
      // Use our specialized function to properly process and serialize members
      const processedMembers = processCSVMembers(csvMembers, currentDate);
      localMembers = processedMembers;
      console.log(`Loaded and updated ${localMembers.length} members from CSV file`);
      
      // Update the file with current values using safe write helper
      writeSafelyToFile(
        embeddedPath, 
        localMembers, 
        "Updated embedded.json with current SOLAR totals from CSV data"
      );
    } else {
      // We only get here if CSV loading failed
      console.log("CSV loading failed, using default hardcoded members");
      
      // Default members with up-to-date SOLAR balances - FULL LIST
      const defaultMembers = [
        {
          id: 0,
          username: "tcs.reserve",
          name: "TC-S Solar Reserve",
          joinedDate: "2025-04-07", // Started on system launch date
          totalSolar: 10000000000, // 10 billion SOLAR fixed allocation
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 1,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          // Calculate days from April 9 to today (inclusive)
          totalSolar: calculateCurrentSolar("2025-04-09", currentDate),
          // $136,000 per SOLAR
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        // Add other members similarly
        // ...
      ];
  
      // Use our serialization helper to properly handle all properties
      const processedMembers = serializeMembers(defaultMembers).map(member => ({
        ...member,
        // Format totalSolar to 4 decimal places for consistency
        totalSolar: parseFloat(member.totalSolar.toFixed(4))
      }));
  
      // Check for existing file or create new
      if (fs.existsSync(embeddedPath)) {
        try {
          const existingMembers = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
          console.log(`Loaded ${existingMembers.length} members from embedded data file`);
          
          // Update with current values
          localMembers = processedMembers;
          
          // Update the file with current values using safe write helper
          writeSafelyToFile(
            embeddedPath, 
            localMembers, 
            "Updated embedded.json with current SOLAR totals"
          );
        } catch (readErr) {
          console.error("Error reading embedded.json file:", readErr);
          localMembers = processedMembers;
        }
      } else {
        // Use the processed default members
        localMembers = processedMembers;
        console.log("Using default members data with current SOLAR totals");
        
        // Make sure the public directory exists
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          try {
            fs.mkdirSync(publicDir, { recursive: true });
            console.log("Created public directory");
          } catch (mkdirErr) {
            console.error("Error creating public directory:", mkdirErr);
          }
        }
        
        // Write the default members to the embedded file using safe write helper
        writeSafelyToFile(
          embeddedPath, 
          localMembers, 
          "Created default embedded.json file with current SOLAR totals"
        );
      }
    }
    
    // Return the members data
    return localMembers;
  } catch (err) {
    console.error("Error in loadMembersData function:", err);
    throw err; // Re-throw to be caught by the outer try-catch
  }
}