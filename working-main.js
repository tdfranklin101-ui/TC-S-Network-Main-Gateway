#!/usr/bin/env node

const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.static('public'));
app.use(express.json());

// File upload setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Current-See Working Server'
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'multimodal-test.html'));
});

// Multimodal photo upload endpoint (simplified for testing)
app.post('/api/photo-analysis', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Simplified response for testing deployment
    res.json({
      analysis: "Hello! I'm Kid Solar (TC-S S0001). I can see your photo! The multimodal interface is working. In the full version, I'll provide detailed energy analysis using OpenAI GPT-4o. This confirms the upload functionality is operational!",
      timestamp: new Date().toISOString(),
      fileSize: req.file.size,
      fileType: req.file.mimetype
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Current-See Working Server running on port ${PORT}`);
  console.log(`🌐 Access at: http://0.0.0.0:${PORT}`);
  console.log(`📸 Test multimodal: Upload a photo to see Kid Solar respond`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;