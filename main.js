/**
 * Simple Production Server for The Current-See
 * 
 * A minimal server implementation for deploying the website
 * that handles both serving static files and health checks.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(PUBLIC_DIR, 'includes');

// Solar constants for calculations
const SOLAR_CONSTANTS = {
  KWPH_PER_METER_SQUARED: 1.366, // kW per hour per square meter
  EARTH_SURFACE_KM2: 510100000, // Earth's surface area in square km
  LAND_SURFACE_KM2: 149000000, // Land surface area in square km
  COLLECTION_EFFICIENCY: 0.20, // 20% collection efficiency
  METERS_PER_KM2: 1000000, // Square meters per square km
  GLOBAL_POPULATION: 8500000000, // Approximate global population
  SOLAR_PERCENT: 0.01, // 1% allocation for humanity
  USD_PER_SOLAR: 136000, // Current-See conversion rate ($136,000 per SOLAR)
  KWH_PER_SOLAR: 4913, // kWh per SOLAR
  GENERATION_START_DATE: new Date('2025-04-07T00:00:00Z') // Solar tracking start date
};

// Solar calculation utils (these will be needed for the counter and value calculations)
function calculateTotalEnergy() {
  const now = new Date();
  const elapsedSeconds = (now - SOLAR_CONSTANTS.GENERATION_START_DATE) / 1000;
  const elapsedHours = elapsedSeconds / 3600;
  
  const totalPowerPerHour = SOLAR_CONSTANTS.KWPH_PER_METER_SQUARED * 
                           SOLAR_CONSTANTS.EARTH_SURFACE_KM2 * 
                           SOLAR_CONSTANTS.METERS_PER_KM2 * 
                           SOLAR_CONSTANTS.COLLECTION_EFFICIENCY;
  
  // Total energy in kWh
  const totalEnergyKwh = totalPowerPerHour * elapsedHours * SOLAR_CONSTANTS.SOLAR_PERCENT;
  
  // Convert to million kWh (MkWh) for display
  const totalEnergyMkwh = totalEnergyKwh / 1000000;
  
  return totalEnergyMkwh;
}

function calculateTotalValue() {
  const totalEnergy = calculateTotalEnergy() * 1000000; // Convert back to kWh
  const kwhPerSolar = (SOLAR_CONSTANTS.KWPH_PER_METER_SQUARED * 
                       SOLAR_CONSTANTS.EARTH_SURFACE_KM2 * 
                       SOLAR_CONSTANTS.METERS_PER_KM2 * 
                       SOLAR_CONSTANTS.COLLECTION_EFFICIENCY * 
                       SOLAR_CONSTANTS.SOLAR_PERCENT) / 
                       SOLAR_CONSTANTS.GLOBAL_POPULATION * 24; // kWh per person per day
  
  // Calculate total SOLAR tokens based on energy generated
  const totalSolar = totalEnergy / kwhPerSolar;
  
  // Calculate value in USD
  return totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
}

// Members data array (loaded from file)
let members = [];

// Initialize function to load members data
function loadMembers() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const membersFilePath = path.join(PUBLIC_DIR, 'api', 'members.json');
    
    if (fs.existsSync(membersFilePath)) {
      const membersData = fs.readFileSync(membersFilePath, 'utf8');
      members = JSON.parse(membersData);
      log(`Loaded ${members.length} members from file`);
      
      // Check if there's a TC-S Solar Reserve entry
      const hasReserve = members.some(m => m.username === "tc-s.reserve" && m.name === "TC-S Solar Reserve");
      
      // If no reserve exists, add one
      if (!hasReserve) {
        log('Adding TC-S Solar Reserve to members');
        
        // Insert at the beginning of the array (id 0 to ensure it's first)
        members.unshift({
          id: 0,
          username: "tc-s.reserve",
          name: "TC-S Solar Reserve",
          email: "reserve@thecurrentsee.org",
          joinedDate: "2025-04-07", // Start from the genesis date
          totalSolar: 10000000000.0000, // 10 billion Solar
          totalDollars: 10000000000 * SOLAR_CONSTANTS.USD_PER_SOLAR,
          isAnonymous: false,
          lastDistributionDate: today,
          isReserve: true,
          notes: "Genesis Reserve Allocation"
        });
        
        // Re-number the IDs to ensure consistency
        members.forEach((member, index) => {
          member.id = index;
        });
        
        // Save the updated members list
        updateMembersFiles();
      }
      
      // Check if there's a "You are next" placeholder entry
      const hasPlaceholder = members.some(m => 
        m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
      
      // If no placeholder exists, add one
      if (!hasPlaceholder) {
        const placeholderId = members.length + 1;
        log(`Adding "You are next" placeholder as member #${placeholderId}`);
        
        members.push({
          id: placeholderId,
          username: "you.are.next",
          name: "You are next",
          joinedDate: today,
          totalSolar: 1.0000,
          totalDollars: Math.round(1.0000 * SOLAR_CONSTANTS.USD_PER_SOLAR),
          isAnonymous: false,
          lastDistributionDate: today
        });
        
        // Save the updated members list
        updateMembersFiles();
      }
    } else {
      // Initialize with default members if file doesn't exist
      members = [
        {
          id: 0,
          username: "tc-s.reserve",
          name: "TC-S Solar Reserve",
          email: "reserve@thecurrentsee.org",
          joinedDate: "2025-04-07", // Start from the genesis date
          totalSolar: 10000000000.0000, // 10 billion Solar
          totalDollars: 10000000000 * SOLAR_CONSTANTS.USD_PER_SOLAR,
          isAnonymous: false,
          lastDistributionDate: today,
          isReserve: true,
          notes: "Genesis Reserve Allocation"
        },
        {
          id: 1,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          totalSolar: 10.0000,
          totalDollars: 1360000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 2,
          username: "j.franklin",
          name: "JF",
          joinedDate: "2025-04-10",
          totalSolar: 9.0000,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 3,
          username: "d.franklin",
          name: "Davis",
          email: "Davisfranklin095@gmail.com",
          joinedDate: "2025-04-18", 
          totalSolar: 2.0000,
          totalDollars: 272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 4,
          username: "m.franklin",
          name: "Miles Franklin",
          email: "Milesgfranklin9@gmail.com",
          joinedDate: "2025-04-18",
          totalSolar: 2.0000,
          totalDollars: 272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 5,
          username: "a.franklin",
          name: "Arden F",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 6,
          username: "m.hasseman",
          name: "Marissa Hasseman",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 7,
          username: "k.member",
          name: "Kim",
          email: "kim.contact@thecurrentsee.org",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 8,
          username: "you.are.next",
          name: "You are next",
          joinedDate: today,
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: today
        }
      ];
      // Save default members
      updateMembersFiles();
    }
    
    // Also update the embedded-members file for quick loading
    updateEmbeddedMembersFile();
  } catch (error) {
    log(`Error loading members: ${error.message}`);
  }
}

// Save members data to files
function updateMembersFiles() {
  try {
    // First ensure the api directory exists
    const apiDir = path.join(PUBLIC_DIR, 'api');
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
      log(`Created API directory at ${apiDir}`);
    }
    
    const membersFilePath = path.join(apiDir, 'members.json');
    
    fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2));
    log(`Updated members file with ${members.length} members`);
    
    // Also update embedded-members
    updateEmbeddedMembersFile();
    
    // Verify the file was written successfully
    if (fs.existsSync(membersFilePath)) {
      const stats = fs.statSync(membersFilePath);
      log(`Verified members file: ${stats.size} bytes written at ${new Date(stats.mtime).toISOString()}`);
    } else {
      log(`Warning: Members file not found after write attempt`);
    }
  } catch (error) {
    log(`Error updating members files: ${error.message}`);
  }
}

// Update embedded-members file (used for quick loading on client)
function updateEmbeddedMembersFile() {
  try {
    // Format the members data with 4 decimal places for SOLAR values
    const formattedMembers = members.map(member => {
      // Create a copy of the member
      const formattedMember = {...member};
      
      // Format totalSolar to 4 decimal places if it's a number
      if (typeof formattedMember.totalSolar !== 'undefined') {
        formattedMember.totalSolar = parseFloat(formattedMember.totalSolar).toFixed(4);
      }
      
      return formattedMember;
    });
    
    const embeddedMembersPath = path.join(PUBLIC_DIR, 'embedded-members');
    fs.writeFileSync(embeddedMembersPath, 
      `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`);
    log('Updated embedded-members file with 4 decimal place SOLAR values');
  } catch (error) {
    log(`Error updating embedded-members file: ${error.message}`);
  }
}

// Process daily distribution for all members
function processDailyDistribution() {
  const today = new Date().toISOString().split('T')[0];
  let updatedCount = 0;
  
  members.forEach(member => {
    if (member.lastDistributionDate !== today) {
      // Add daily distribution (1 SOLAR per day)
      member.totalSolar += 1;
      // Format with 4 decimal places (1.0000 format)
      member.totalSolar = parseFloat(member.totalSolar.toFixed(4));
      // Calculate dollar value (rounding to whole numbers as requested)
      member.totalDollars = Math.round(member.totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR);
      member.lastDistributionDate = today;
      updatedCount++;
      log(`Member ${member.name} received 1 SOLAR, new total: ${member.totalSolar.toFixed(4)} SOLAR = $${member.totalDollars.toLocaleString()}`);
    }
  });
  
  if (updatedCount > 0) {
    log(`Processed daily distribution for ${updatedCount} members`);
    updateMembersFiles();
  }
}

// Load members on server start
loadMembers();

// Set up scheduled tasks
const DISTRIBUTION_HOUR_UTC = 0; // Midnight UTC (GMT)
function setupScheduledTasks() {
  // Check if we need to process distributions on startup
  checkAndProcessDailyDistributions();
  
  // Schedule daily check at midnight UTC
  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === DISTRIBUTION_HOUR_UTC && now.getUTCMinutes() === 0) {
      log('Scheduled distribution time reached, processing...');
      processDailyDistribution();
    }
  }, 60 * 1000); // Check every minute
  
  log('Scheduled tasks initialized');
}

// Check and run daily distributions if needed
function checkAndProcessDailyDistributions() {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if any member needs distribution for today
  const needsDistribution = members.some(m => m.lastDistributionDate !== today);
  
  if (needsDistribution) {
    log('Found members needing distribution for today, processing...');
    processDailyDistribution();
  } else {
    log('All members are up to date with distributions');
  }
}

// Start scheduled tasks
setupScheduledTasks();

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging function
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Health check endpoint - explicit route for monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Redirect paths for removed pages
app.get('/my-solar', (req, res) => {
  log('Redirecting /my-solar request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/login', (req, res) => {
  log('Redirecting /login request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/register', (req, res) => {
  log('Redirecting /register request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/wallet', (req, res) => {
  log('Redirecting /wallet request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

// Root endpoint - special handling for deployment health checks
app.get('/', (req, res, next) => {
  // If it's a health check (no user agent), just return OK
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  
  // For normal users, serve the index.html file with header/footer injected
  try {
    let indexContent = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      indexContent = indexContent.replace('<!-- HEADER_PLACEHOLDER -->', header);
      indexContent = indexContent.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(indexContent);
  } catch (error) {
    log(`Error serving index.html: ${error.message}`);
    next();
  }
});

// Handle HTML files with header/footer injection
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) {
    return next();
  }
  
  try {
    const filePath = path.join(PUBLIC_DIR, req.path);
    
    if (!fs.existsSync(filePath)) {
      return next();
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      content = content.replace('<!-- HEADER_PLACEHOLDER -->', header);
      content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
      
      // Ensure scripts are properly loaded after DOM content
      if (content.includes('/js/real_time_solar_counter.js')) {
        log(`Found solar counter script in ${req.path}, ensuring proper initialization`);
        
        // Make sure trySolarCounterInit is called after page fully loads
        // by adding an additional script before closing body tag
        const additionalScript = `
<script>
  // Ensure solar counter initialization happens after DOM is fully loaded
  window.addEventListener('load', function() {
    console.log('Window fully loaded with injected content, running solar counter init');
    setTimeout(function() {
      if (typeof trySolarCounterInit === 'function') {
        trySolarCounterInit();
      }
    }, 100);
  });
</script>`;
        
        // Add script just before closing body tag
        content = content.replace('</body>', additionalScript + '</body>');
      }
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    log(`Error serving ${req.path}: ${error.message}`);
    next();
  }
});

// Sign up endpoint
app.post('/api/signup', (req, res) => {
  try {
    log('Received signup request: ' + JSON.stringify(req.body));
    const userData = req.body;
    
    // Validate required fields
    if (!userData.name || !userData.email) {
      log('Validation failed: Missing name or email');
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
    }
    
    // Check if email already exists
    const existingMember = members.find(m => m.email === userData.email);
    if (existingMember) {
      log('Signup failed: Email already exists');
      return res.status(400).json({
        success: false,
        error: 'This email is already registered'
      });
    }
    
    // Calculate new member data
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate proper initial SOLAR allocation:
    // 1. Everyone gets 1 SOLAR on the day they join
    const initialSolar = 1.0000; // Format with 4 decimal places (using 1.0000 format)
    
    // Check for "You are next" placeholder
    const placeholderIndex = members.findIndex(m => 
      m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
    
    // Generate member object
    const newMember = {
      id: members.length + (placeholderIndex !== -1 ? 0 : 1), // Adjust ID if replacing placeholder
      username: userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
      name: userData.name,
      email: userData.email,
      joinedDate: today,
      totalSolar: initialSolar, // Initial allocation with 4 decimal places
      totalDollars: Math.round(initialSolar * SOLAR_CONSTANTS.USD_PER_SOLAR),
      isAnonymous: userData.isAnonymous || false,
      lastDistributionDate: today // Set initial distribution date
    };
    
    log('Creating new member: ' + JSON.stringify(newMember));
    
    // Remove existing placeholder if it exists
    if (placeholderIndex !== -1) {
      log('Removing existing placeholder to ensure it goes at the end');
      members.splice(placeholderIndex, 1);
    }
    
    // Add the new member
    members.push(newMember);
    
    // Create a new placeholder and add it at the very end
    const newPlaceholder = {
      id: members.length + 1,
      username: "you.are.next",
      name: "You are next",
      joinedDate: today,
      totalSolar: initialSolar,
      totalDollars: Math.round(initialSolar * SOLAR_CONSTANTS.USD_PER_SOLAR),
      isAnonymous: false,
      lastDistributionDate: today
    };
    
    // Add new placeholder as the last entry
    members.push(newPlaceholder);
    
    // Update the files
    updateMembersFiles();
    
    log('Current member count: ' + members.length);
    
    // Return success response with accurate member count
    // The count should exclude the "you are next" placeholder in the count sent to the client
    const actualMemberCount = members.filter(m => !m.name.toLowerCase().includes("you are next")).length;
    
    res.status(201).json({ 
      success: true, 
      member: newMember,
      totalMembers: actualMemberCount
    });
  } catch (e) {
    log('Error processing signup: ' + e.message);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Process daily distributions for members
app.post('/api/process-distributions', (req, res) => {
  try {
    processDailyDistribution();
    res.json({ success: true, message: 'Distributions processed successfully' });
  } catch (e) {
    log('Error processing distributions: ' + e.message);
    res.status(500).json({ success: false, error: 'Failed to process distributions' });
  }
});

// API endpoint for getting live solar generation data
app.get('/api/solar-data', (req, res) => {
  const totalEnergy = calculateTotalEnergy();
  const totalValue = calculateTotalValue();
  
  // Calculate total SOLAR tokens
  const totalSolar = totalValue / SOLAR_CONSTANTS.USD_PER_SOLAR;
  
  res.json({
    energy: {
      value: totalEnergy,
      unit: 'MkWh'
    },
    solar: {
      value: parseFloat(totalSolar.toFixed(4)),
      formatted: totalSolar.toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }),
      kwhPerSolar: SOLAR_CONSTANTS.KWH_PER_SOLAR,
      usdPerSolar: SOLAR_CONSTANTS.USD_PER_SOLAR
    },
    money: {
      value: totalValue,
      formatted: '$' + totalValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    },
    timestamp: new Date().toISOString()
  });
});

// API endpoint for getting just the member count
app.get('/api/member-count', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
  // Calculate actual member count, excluding the "you are next" placeholder
  const actualMemberCount = members.filter(m => !m.name.toLowerCase().includes("you are next")).length;
  
  res.json({
    count: actualMemberCount,
    timestamp: new Date().toISOString()
  });
});

// Serve static files
// Set no-cache headers for member data to prevent stale information
app.use('/api/members.json', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

app.use('/embedded-members', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Serve static files with cache control for JS files
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, path) => {
    // Set no-cache headers for JavaScript files to prevent stale code
    if (path.endsWith('.js')) {
      res.set({
        'Cache-Control': 'no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
  }
}));

// Fallback handler for SPA-like navigation (without using path-to-regexp)
app.use((req, res) => {
  // If the file doesn't exist, route to index.html
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #4caf50; }
          a { color: #4caf50; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p><a href="/">Return to Home</a></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  log(`The Current-See server running on port ${PORT}`);
  log(`Serving static files from: ${PUBLIC_DIR}`);
});

// Handle termination signals
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  process.exit(0);
});