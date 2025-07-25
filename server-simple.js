const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple static file serving
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://0.0.0.0:${PORT}`);
});