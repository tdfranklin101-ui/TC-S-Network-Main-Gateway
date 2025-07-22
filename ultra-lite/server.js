const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY
});

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.static('public'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Current-See Ultra-Lite' });
});

// Multimodal photo analysis endpoint
app.post('/api/photo-analysis', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const base64Image = req.file.buffer.toString('base64');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are Kid Solar (TC-S S0001), an educational AI assistant for The Current-See platform. Analyze photos and provide energy-related insights in a friendly, educational manner. Always include solar energy calculations when relevant."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and provide educational insights about energy, sustainability, or environmental impact. If applicable, estimate energy usage or potential solar generation."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    res.json({
      analysis: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Current-See Ultra-Lite running on port ${PORT}`);
});

module.exports = app;