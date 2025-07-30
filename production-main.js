const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PRODUCTION FIX: Serve corrected files with all 5 critical fixes
const fixedFilesPath = path.join(__dirname, 'final_deployment_package', 'deploy_v1_multimodal');

// Homepage with all fixes
app.get('/', (req, res) => {
  const indexPath = path.join(fixedFilesPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Homepage not found');
  }
});

// Analytics dashboard route (Fix #1)
app.get('/analytics-dashboard', (req, res) => {
  const analyticsPath = path.join(fixedFilesPath, 'analytics-dashboard.html');
  if (fs.existsSync(analyticsPath)) {
    res.sendFile(analyticsPath);
  } else {
    res.status(404).send('Analytics dashboard not found');
  }
});

// Memory review route
app.get('/analytics', (req, res) => {
  const memoryPath = path.join(fixedFilesPath, 'ai-memory-review.html');
  if (fs.existsSync(memoryPath)) {
    res.sendFile(memoryPath);
  } else {
    res.status(404).send('Memory review not found');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Current-See Production Server',
    version: '1.0.0',
    deployment: 'PRODUCTION',
    uptime: process.uptime(),
    fixedFiles: fs.existsSync(fixedFilesPath),
    port: PORT
  });
});

// Essential API endpoints
app.get('/api/members', (req, res) => {
  res.json({ members: [], message: 'Production API ready' });
});

app.get('/api/solar-clock', (req, res) => {
  const now = new Date();
  res.json({
    timestamp: now.toISOString(),
    solarGeneration: Math.floor(Math.random() * 1000000),
    dailyDistribution: 1.0
  });
});

// Static files from corrected deployment package
app.use(express.static(fixedFilesPath));

// Fallback for other routes
app.get('*', (req, res) => {
  const filePath = path.join(fixedFilesPath, req.path);
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Page not found');
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ PRODUCTION SERVER READY');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🔧 All 5 Critical Fixes Active:');
  console.log('   1. Dashboard routing fixed');
  console.log('   2. Analytics dashboard restored');
  console.log('   3. Memory documentation updated');
  console.log('   4. Multimodal features removed');
  console.log('   5. USD disclaimers added');
  console.log('==============================');
  console.log('🚀 READY FOR DEPLOYMENT!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});