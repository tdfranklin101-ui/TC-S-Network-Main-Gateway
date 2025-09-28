#!/usr/bin/env node

/**
 * Minimal Deployment Server - The Current-See Platform
 * Ultra-lightweight for fast Replit deployments
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Minimal middleware
app.use(express.static('public'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'The Current-See Platform - Minimal Deploy'
  });
});

// Essential API
app.get('/api/members', (req, res) => {
  res.json({ totalMembers: 16, activeMembers: 16 });
});

app.get('/api/solar-clock', (req, res) => {
  const now = Date.now();
  res.json({
    currentGeneration: 4.32e14,
    timestamp: now
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See Platform (Minimal) running on port ${PORT}`);
  console.log(`🚀 Deployment: http://0.0.0.0:${PORT}`);
});

module.exports = app;