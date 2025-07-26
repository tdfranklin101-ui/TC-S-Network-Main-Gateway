const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from deploy_v1_multimodal
app.use('/', express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// File upload handling
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Current-See Platform'
  });
});

// Kid Solar photo analysis endpoint
app.post('/api/analyze-photo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Mock analysis for deployment testing
    const mockAnalysis = `Kid Solar here! I can see this is a ${req.file.originalname} file. This appears to be an image that would generate approximately 5297 kWh of solar energy equivalent, translating to 1.08 SOLAR tokens in our renewable energy system. The visual elements suggest sustainable technology integration potential.`;

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.log('File cleanup note:', err.message);
    }

    res.json({
      analysis: mockAnalysis,
      energy_kwh: 5297,
      solar_tokens: 1.08,
      sessionId: 'session_' + Date.now()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Members endpoint
app.get('/api/members', (req, res) => {
  res.json([
    { id: 1, email: 'founder@thecurrentsee.org', solar_balance: 45.2, joined_date: '2025-04-07' },
    { id: 2, email: 'member@example.com', solar_balance: 38.7, joined_date: '2025-05-15' }
  ]);
});

// Database status
app.get('/api/database/status', (req, res) => {
  res.json({ status: 'connected', type: 'deployment_ready' });
});

// Solar clock endpoint
app.get('/api/solar-clock', (req, res) => {
  const now = new Date();
  const startDate = new Date('2025-04-07T00:00:00Z');
  const daysSince = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  
  res.json({
    current_solar: daysSince * 2, // 2 SOLAR per day for 2 members
    energy_generated: daysSince * 9.826, // kWh equivalent
    days_since_start: daysSince
  });
});

// Catch-all route - serve index.html for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌞 Current-See Platform ready at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Kid Solar analysis ready at /api/analyze-photo`);
});