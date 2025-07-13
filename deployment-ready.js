/**
 * The Current-See Production Deployment Server
 * 
 * This is the optimized production server for deployment with:
 * - Audio streaming support
 * - Health checks for cloud deployment
 * - Database integration
 * - Member management
 * - Solar counter APIs
 * - Static file serving
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const serveStatic = require('serve-static');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMBERS_FILE = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_FILE = path.join(PUBLIC_DIR, 'js', 'embedded-members.js');

// Global members array
let members = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✅ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Load members data on startup
loadMembers();

// Health checks for deployment
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memberCount: members.length,
    audioFile: fs.existsSync(path.join(PUBLIC_DIR, 'audio', 'The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav'))
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Audio streaming with range support
app.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(PUBLIC_DIR, 'audio', filename);
  
  log(`Audio request: ${filename}`);
  
  if (!fs.existsSync(audioPath)) {
    log(`Audio file not found: ${filename}`, true);
    return res.status(404).json({ error: 'Audio file not found' });
  }
  
  const stat = fs.statSync(audioPath);
  const range = req.headers.range;
  
  if (range) {
    // Handle range requests for streaming
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(audioPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/wav',
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Serve entire file
    const head = {
      'Content-Length': stat.size,
      'Content-Type': 'audio/wav',
      'Accept-Ranges': 'bytes',
    };
    
    res.writeHead(200, head);
    fs.createReadStream(audioPath).pipe(res);
  }
});

// Solar clock API
app.get('/api/solar-clock', (req, res) => {
  const startDate = new Date('2025-04-07T00:00:00Z');
  const now = new Date();
  const elapsedSeconds = (now - startDate) / 1000;
  const elapsedHours = elapsedSeconds / 3600;
  
  // Solar calculations
  const totalPowerPerHour = 1.366 * 510100000 * 1000000 * 0.20 * 0.01;
  const totalEnergyKwh = totalPowerPerHour * elapsedHours;
  const totalEnergyMkwh = totalEnergyKwh / 1000000;
  const totalValue = totalEnergyKwh / 4913 * 136000;
  
  res.json({
    totalEnergyMkwh: totalEnergyMkwh.toFixed(6),
    totalValue: totalValue.toFixed(2),
    elapsedHours: elapsedHours.toFixed(2),
    elapsedDays: (elapsedHours / 24).toFixed(1),
    timestamp: now.toISOString()
  });
});

// Members API
app.get('/api/members', (req, res) => {
  res.json(members);
});

app.get('/api/member/:id', (req, res) => {
  const memberId = parseInt(req.params.id);
  const member = members.find(m => m.id === memberId);
  
  if (member) {
    res.json(member);
  } else {
    res.status(404).json({ error: 'Member not found' });
  }
});

// Member signup
app.post('/api/signup', (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Check existing email
    const existingMember = members.find(member => 
      member.email === email && !member.is_placeholder
    );
    
    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }
    
    // Create new member
    const highestId = members.reduce((max, member) => {
      const id = typeof member.id === 'number' ? member.id : 0;
      return id > max ? id : max;
    }, 0);
    
    const today = new Date().toISOString().split('T')[0];
    const newMember = {
      id: highestId + 1,
      username: name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, ''),
      name: name,
      email: email,
      joinedDate: today,
      joined_date: today,
      totalSolar: 1,
      total_solar: "1.0000",
      isAnonymous: false,
      isPlaceholder: false,
      lastDistributionDate: today
    };
    
    members.push(newMember);
    updateMembersFiles();
    
    log(`New member registered: ${name} (${email})`);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      member: {
        id: newMember.id,
        name: newMember.name,
        joinDate: newMember.joinedDate,
        totalSolar: newMember.totalSolar
      }
    });
    
  } catch (error) {
    log(`Signup error: ${error.message}`, true);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// Database status
app.get('/api/database/status', (req, res) => {
  res.json({
    status: 'connected',
    memberCount: members.length,
    lastUpdate: new Date().toISOString()
  });
});

// Load members function
function loadMembers() {
  try {
    if (fs.existsSync(MEMBERS_FILE)) {
      const data = fs.readFileSync(MEMBERS_FILE, 'utf8');
      members = JSON.parse(data);
      log(`Loaded ${members.length} members`);
    } else {
      log('Members file not found, starting with empty array');
      members = [];
    }
  } catch (error) {
    log(`Error loading members: ${error.message}`, true);
    members = [];
  }
}

// Update members files
function updateMembersFiles() {
  try {
    const apiDir = path.dirname(MEMBERS_FILE);
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }
    
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
    
    // Update embedded members file
    const jsDir = path.dirname(EMBEDDED_MEMBERS_FILE);
    if (!fs.existsSync(jsDir)) {
      fs.mkdirSync(jsDir, { recursive: true });
    }
    
    fs.writeFileSync(EMBEDDED_MEMBERS_FILE, 
      `const EMBEDDED_MEMBERS = ${JSON.stringify(members)};`);
    
    log('Updated members files');
  } catch (error) {
    log(`Error updating members files: ${error.message}`, true);
  }
}

// Static file serving
app.use(serveStatic(PUBLIC_DIR, {
  index: ['index.html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (filePath.match(/\.(wav|mp3|ogg)$/)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Route handlers
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/private-network', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'private-network.html'));
});

app.get('/qa-meaning-purpose', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'qa-meaning-purpose.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log(`🚀 The Current-See deployment server running on port ${PORT}`);
  log(`📊 Members loaded: ${members.length}`);
  log(`🎵 Audio file available: ${fs.existsSync(path.join(PUBLIC_DIR, 'audio', 'The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav'))}`);
  log(`🌐 Ready for deployment at www.thecurrentsee.org`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});