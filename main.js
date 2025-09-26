/**
 * TC-S Network Foundation Digital Artifact Marketplace
 * FileFlow Deployment - Root Directory Version
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'TC-S Marketplace FileFlow Deployment Active'
  });
});

// Simple API
app.get('/api/artifacts/available', (req, res) => {
  res.json({
    artifacts: [
      {
        id: 'artifact_1',
        title: 'Solar Audio Track',
        description: 'TC-S Digital Artifact',
        price: 150,
        category: 'audio',
        filePath: '/music/b72acaea-72b4-4dc2-8c84-98e0b30a82e3_1757951813274.mp3'
      }
    ],
    total: 1
  });
});

app.get('/api/market/stats', (req, res) => {
  res.json({
    totalArtifacts: 1,
    totalUsers: 1,
    totalTransactions: 0,
    totalValue: 150
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TC-S Marketplace running on port ${PORT}`);
  console.log('⚡ FileFlow Deployment Ready');
  console.log('📱 URL: https://file-flow-tdfranklin101.replit.app');
});

module.exports = app;