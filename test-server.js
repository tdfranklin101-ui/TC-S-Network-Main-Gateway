const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// Routes
app.get('/', (req, res) => {
  console.log('Homepage requested');
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`✅ Website: http://localhost:${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});