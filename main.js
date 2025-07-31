#!/usr/bin/env node

/**
 * The Current-See Platform - V1 Multimodal Deployment
 * Enhanced with multimodal photo button for Kid Solar D-ID agent
 */

const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.static('.'));
app.use(express.json());

// File upload setup for multimodal functionality
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Current-See V1 Multimodal',
    kidSolar: 'v2_agt_vhYf_e_C active'
  });
});

// Kid Solar multimodal analysis endpoint
app.post('/api/kid-solar-analysis', upload.single('photo'), async (req, res) => {
  try {
    if (req.file) {
      // Photo analysis
      res.json({
        analysis: "Hi! I'm Kid Solar (TC-S S0001)! I can see your photo! This is a test response to confirm the multimodal photo upload is working. In the full version with OpenAI integration, I'll provide detailed energy analysis, carbon footprint calculations, and educational insights about sustainability!",
        energy_kwh: Math.floor(Math.random() * 100) + 50,
        solar_tokens: (Math.random() * 0.1).toFixed(6),
        carbon_footprint: Math.floor(Math.random() * 50) + 20,
        timestamp: new Date().toISOString()
      });
    } else if (req.body.type === 'text') {
      // Text analysis
      res.json({
        analysis: `Hi! I'm Kid Solar! You asked: "${req.body.query}" - This is a test response showing the text analysis is working. With full OpenAI integration, I'll provide detailed educational responses about energy and sustainability!`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({ error: 'No photo or text provided' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message 
    });
  }
});

// Essential routes
const routes = [
  '/',
  '/wallet.html',
  '/wallet',
  '/index.html',
  '/declaration.html',
  '/founder_note.html',
  '/whitepapers.html',
  '/business_plan.html'
];

routes.forEach(route => {
  app.get(route, (req, res) => {
    if (route === '/' || route === '/index.html') {
      res.sendFile(path.join(__dirname, 'index.html'));
    } else if (route === '/wallet') {
      res.sendFile(path.join(__dirname, 'wallet.html'));
    } else {
      res.sendFile(path.join(__dirname, route));
    }
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See V1 Multimodal running on port ${PORT}`);
  console.log(`🌐 Homepage: http://0.0.0.0:${PORT}`);
  console.log(`👦 Kid Solar: http://0.0.0.0:${PORT}/wallet.html`);
  console.log(`📸 Multimodal: Photo upload button in Kid Solar D-ID agent`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;