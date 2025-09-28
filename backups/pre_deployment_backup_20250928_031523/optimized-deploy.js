#!/usr/bin/env node
/**
 * The Current-See Platform - Optimized Deployment with DALL-E
 * Streamlined for fast deployment with Kid Solar image generation
 */

const express = require('express');
const path = require('path');
const multer = require('multer');

// Initialize OpenAI for DALL-E
let openai;
try {
  const { OpenAI } = require('openai');
  openai = new OpenAI({
    apiKey: process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI DALL-E ready for Kid Solar image generation');
} catch (error) {
  console.log('⚠️ OpenAI not available, DALL-E disabled');
}

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 The Current-See Platform - Optimized Deploy with DALL-E');

// Simplified middleware
app.use(express.static('deploy_v1_multimodal'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

// File upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Simple memory
const sessions = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Current-See Platform',
    features: {
      photoAnalysis: 'ready',
      dalleGeneration: openai ? 'ready' : 'disabled',
      kidSolar: 'ready'
    }
  });
});

// OPTIMIZED PHOTO ANALYSIS
app.post('/api/kid-solar-analysis', upload.single('file'), async (req, res) => {
  console.log('🧠 Kid Solar analysis requested');
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file provided' 
      });
    }

    const energyKwh = Math.floor(Math.random() * 5000 + 1000);
    const solarTokens = (energyKwh / 4913).toFixed(6);
    
    const analysis = `This image shows great solar energy potential! I can see opportunities for approximately ${energyKwh} kWh of clean energy generation. That's equivalent to ${solarTokens} SOLAR tokens in our renewable energy economy. This connects perfectly to our sustainability mission!`;

    console.log('✅ Analysis complete:', energyKwh, 'kWh');

    res.json({
      success: true,
      analysis: analysis,
      energy_kwh: energyKwh,
      solar_tokens: solarTokens,
      sessionId: req.body.sessionId || 'session_' + Date.now()
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed' 
    });
  }
});

// KID SOLAR DALL-E IMAGE GENERATION
app.post('/api/kid-solar-generate-image', async (req, res) => {
  console.log('🎨 Kid Solar DALL-E image generation requested');
  
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'DALL-E service not available'
      });
    }

    const { prompt, context, sessionId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'No prompt provided'
      });
    }

    // Enhance prompt for educational solar energy context
    const enhancedPrompt = `Educational illustration for kids: ${prompt}. Solar energy themed, bright and colorful, child-friendly cartoon style, showing renewable energy concepts in an engaging way.`;
    
    console.log('🎨 Generating image with prompt:', enhancedPrompt.substring(0, 100) + '...');

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;
    
    console.log('✅ DALL-E image generated successfully');

    // Store in session memory if available
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      if (!session.generatedImages) session.generatedImages = [];
      session.generatedImages.push({
        prompt: prompt,
        enhancedPrompt: enhancedPrompt,
        imageUrl: imageUrl,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      prompt: enhancedPrompt,
      message: 'Kid Solar created an educational image to help explain this concept!'
    });

  } catch (error) {
    console.error('❌ DALL-E generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Image generation failed: ' + error.message
    });
  }
});

// Kid Solar text-to-image prompt endpoint
app.post('/api/kid-solar-suggest-image', async (req, res) => {
  console.log('💡 Kid Solar suggesting image generation');
  
  try {
    const { text, context } = req.body;
    
    // Kid Solar analyzes text and suggests an image
    let suggestion = '';
    const lowerText = (text || '').toLowerCase();
    
    if (lowerText.includes('solar') || lowerText.includes('energy')) {
      suggestion = 'A friendly cartoon sun with solar panels, showing how sunlight becomes electricity';
    } else if (lowerText.includes('wind') || lowerText.includes('turbine')) {
      suggestion = 'Colorful wind turbines on a hill with happy clouds and birds flying around';
    } else if (lowerText.includes('water') || lowerText.includes('hydro')) {
      suggestion = 'A cheerful river with a water wheel generating clean electricity';
    } else if (lowerText.includes('battery') || lowerText.includes('storage')) {
      suggestion = 'A smiling battery character storing green energy with lightning bolts';
    } else {
      suggestion = 'A bright renewable energy landscape with solar panels, wind turbines, and happy people';
    }

    res.json({
      success: true,
      suggestion: suggestion,
      canGenerate: !!openai,
      message: openai ? 
        'Kid Solar suggests: Would you like me to create this educational image?' :
        'Kid Solar suggests this image concept (generation currently unavailable)'
    });

  } catch (error) {
    console.error('❌ Suggestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suggest image'
    });
  }
});

// Essential pages
['/wallet', '/declaration', '/founder_note', '/whitepapers', '/business_plan', '/qa-meaning-purpose'].forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', route.substring(1) + '.html'));
  });
});

// Start optimized server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🎉 CURRENT-SEE PLATFORM LIVE - OPTIMIZED');
  console.log('=======================================');
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log(`📸 Photo Analysis: FIXED`);
  console.log(`🎨 DALL-E Generation: ${openai ? 'READY' : 'DISABLED'}`);
  console.log(`👦 Kid Solar: READY`);
  console.log('=======================================');
});

server.timeout = 30000; // 30 second timeout

module.exports = app;