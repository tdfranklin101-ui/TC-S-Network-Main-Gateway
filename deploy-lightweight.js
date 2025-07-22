#!/usr/bin/env node

/**
 * Ultra-Lightweight Deployment Server for The Current-See Platform
 * Optimized for fast Replit deployments with minimal dependencies
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Essential middleware only
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

// Health check for deployment monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'The Current-See Platform',
    version: 'V1 Kid Solar Enhanced',
    uptime: process.uptime()
  });
});

// Essential API endpoints
app.get('/api/members', (req, res) => {
  res.json({
    totalMembers: 16,
    activeMembers: 16,
    reserves: 4,
    lastUpdate: new Date().toISOString()
  });
});

app.get('/api/solar-clock', (req, res) => {
  const now = Date.now();
  const baseRate = 4.32e14; // kWh per second baseline
  const platformAllocation = baseRate * 0.01; // 1% to platform
  const solarPerMember = platformAllocation / 16 / 4913; // Convert to SOLAR tokens
  
  res.json({
    currentGeneration: baseRate,
    platformAllocation: platformAllocation,
    solarPerMember: solarPerMember,
    timestamp: now
  });
});

// Simplified Kid Solar endpoint
app.post('/api/kid-solar-analysis', (req, res) => {
  res.json({
    analysis: "Hi! I'm Kid Solar! Solar energy is amazing - it comes from the sun and helps power our world! Every ray of sunlight can be converted into clean, renewable energy. What would you like to learn about energy today?",
    energyFacts: "Solar panels convert sunlight into electricity using photovoltaic cells!",
    kwhEquivalent: "1 SOLAR token = 4,913 kWh of energy"
  });
});

// Member signup
app.post('/api/signup', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  res.json({
    success: true,
    message: 'Successfully joined the waitlist!',
    memberId: Date.now()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See Platform (Lightweight) running on port ${PORT}`);
  console.log(`🚀 Ready for deployment: http://0.0.0.0:${PORT}`);
  console.log(`🎯 Kid Solar: http://0.0.0.0:${PORT}/wallet.html`);
  console.log(`📊 Health: http://0.0.0.0:${PORT}/health`);
});

module.exports = app;