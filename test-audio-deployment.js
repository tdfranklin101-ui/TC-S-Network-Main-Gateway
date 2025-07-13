/**
 * Test Audio Deployment Script
 * 
 * This script creates a simple server to test audio file serving
 * and diagnose the audio playback issue.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable CORS for audio files
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Specific audio file serving with proper headers
app.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(__dirname, 'public', 'audio', filename);
  
  console.log('Audio request for:', filename);
  console.log('Full path:', audioPath);
  
  if (!fs.existsSync(audioPath)) {
    console.error('Audio file not found:', audioPath);
    return res.status(404).send('Audio file not found');
  }
  
  const stat = fs.statSync(audioPath);
  const range = req.headers.range;
  
  if (range) {
    // Handle range requests for audio streaming
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
    // Serve the entire file
    const head = {
      'Content-Length': stat.size,
      'Content-Type': 'audio/wav',
      'Accept-Ranges': 'bytes',
    };
    
    res.writeHead(200, head);
    fs.createReadStream(audioPath).pipe(res);
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Audio test server running on port ${PORT}`);
  console.log('Audio file test URL: http://localhost:' + PORT + '/audio/The%20Current-See_%20Solar%20Energy%20for%20Universal%20Basic%20Income_1752340053171.wav');
});