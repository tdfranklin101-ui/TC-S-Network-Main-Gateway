/**
 * The Current-See - Ultra-Reliable Deployment Server
 * Specifically designed for Replit deployments
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Health check - required for Replit deployments
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Private network route
app.get('/private-network', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'private-network.html'));
});

// QA meaning purpose route  
app.get('/qa-meaning-purpose', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qa-meaning-purpose.html'));
});

// Other essential routes
app.get('/wallet.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet.html'));
});

app.get('/declaration.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'declaration.html'));
});

app.get('/founder_note.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/whitepapers.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whitepapers.html'));
});

app.get('/business_plan.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

// Members API
app.get('/api/members', (req, res) => {
  try {
    const membersPath = path.join(__dirname, 'public', 'api', 'members.json');
    if (fs.existsSync(membersPath)) {
      const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
      res.json(members);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Unable to load members' });
  }
});

// Kid Solar Multimodal Analysis API
app.post('/api/kid-solar-analysis', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { type, query } = req.body;
    let analysisResult;

    if (type === 'text') {
      analysisResult = await analyzeTextForKidSolar(query);
    } else if (type === 'photo' && req.files.photo) {
      const photoFile = req.files.photo[0];
      analysisResult = await analyzePhotoForKidSolar(photoFile);
    } else if (type === 'video' && req.files.video) {
      const videoFile = req.files.video[0];
      analysisResult = await analyzeVideoForKidSolar(videoFile);
    } else {
      return res.status(400).json({ error: 'Invalid input type or missing file' });
    }

    // Clean up uploaded files
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.warn('Failed to delete uploaded file:', err);
        }
      });
    }

    res.json(analysisResult);
  } catch (error) {
    console.error('Kid Solar analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

// Kid Solar Analysis Functions
async function analyzeTextForKidSolar(query) {
  try {
    // Use OpenAI if available, otherwise provide educational fallback
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY;
    
    if (openaiApiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are Kid Solar (TC-S S0001), a friendly AI assistant that helps kids learn about energy, sustainability, and environmental impact. You explain complex concepts in simple, engaging ways that kids can understand. Always provide energy estimates in kWh, SOLAR token equivalents (1 SOLAR = 4,913 kWh), and environmental impact when relevant. Make learning fun and inspiring!`
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        const analysis = data.choices[0].message.content;
        
        // Extract or estimate values for display
        const energyMatch = analysis.match(/(\d+(?:\.\d+)?)\s*kWh/i);
        const energy_kwh = energyMatch ? parseFloat(energyMatch[1]).toFixed(2) : estimateEnergyFromText(query);
        const solar_tokens = (energy_kwh / 4913).toFixed(5);
        const carbon_footprint = (energy_kwh * 0.4).toFixed(2) + ' kg CO2';

        return {
          analysis,
          energy_kwh: energy_kwh + ' kWh',
          solar_tokens: solar_tokens + ' SOLAR',
          carbon_footprint
        };
      }
    }

    // Fallback educational response
    return generateEducationalResponse(query);
    
  } catch (error) {
    console.error('Text analysis error:', error);
    return generateEducationalResponse(query);
  }
}

async function analyzePhotoForKidSolar(photoFile) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY;
    
    if (openaiApiKey) {
      // Read and encode image
      const imageBuffer = fs.readFileSync(photoFile.path);
      const base64Image = imageBuffer.toString('base64');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are Kid Solar (TC-S S0001), analyzing photos to teach kids about energy and sustainability. Look at the image and explain what you see in terms of energy use, environmental impact, and how it relates to solar power. Always estimate energy consumption in kWh and provide SOLAR token equivalents (1 SOLAR = 4,913 kWh). Make it educational and fun!`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image for energy and environmental impact. What do you see and how does it relate to sustainability?'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${photoFile.mimetype.split('/')[1]};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (response.ok) {
        const data = await response.json();
        const analysis = data.choices[0].message.content;
        
        // Extract values from analysis
        const energyMatch = analysis.match(/(\d+(?:\.\d+)?)\s*kWh/i);
        const energy_kwh = energyMatch ? parseFloat(energyMatch[1]).toFixed(2) : '5.2';
        const solar_tokens = (energy_kwh / 4913).toFixed(5);
        const carbon_footprint = (energy_kwh * 0.4).toFixed(2) + ' kg CO2';

        return {
          analysis,
          energy_kwh: energy_kwh + ' kWh',
          solar_tokens: solar_tokens + ' SOLAR',
          carbon_footprint
        };
      }
    }

    // Fallback response for photo analysis
    return {
      analysis: "I can see your photo! While I can't analyze it in detail right now, this is a great opportunity to think about energy! Look around the image for items that use electricity - lights, appliances, electronics, or vehicles. Each of these uses energy that could come from solar power!",
      energy_kwh: "2.5 kWh",
      solar_tokens: "0.00051 SOLAR",
      carbon_footprint: "1.0 kg CO2"
    };
    
  } catch (error) {
    console.error('Photo analysis error:', error);
    return {
      analysis: "Thanks for sharing your photo! Photos help us learn about energy use around us. Think about what energy sources the items in your photo might need - could they be powered by solar panels?",
      energy_kwh: "1.0 kWh",
      solar_tokens: "0.00020 SOLAR",
      carbon_footprint: "0.4 kg CO2"
    };
  }
}

async function analyzeVideoForKidSolar(videoFile) {
  try {
    // For now, provide educational response about video content
    // Video analysis could be enhanced with frame extraction and OpenAI analysis
    
    const fileSizeMB = (videoFile.size / 1024 / 1024).toFixed(1);
    const estimatedEnergyForProcessing = (fileSizeMB * 0.1).toFixed(2);
    const solar_tokens = (estimatedEnergyForProcessing / 4913).toFixed(5);
    const carbon_footprint = (estimatedEnergyForProcessing * 0.4).toFixed(2);
    
    return {
      analysis: `Great video upload! Did you know that uploading and processing a ${fileSizeMB}MB video uses about ${estimatedEnergyForProcessing} kWh of energy? That's the same amount of power a solar panel could generate in about ${(estimatedEnergyForProcessing * 4).toFixed(1)} hours of sunlight! Videos are a fun way to learn about energy - maybe you could make a video about solar power next time!`,
      energy_kwh: estimatedEnergyForProcessing + ' kWh',
      solar_tokens: solar_tokens + ' SOLAR',
      carbon_footprint: carbon_footprint + ' kg CO2'
    };
    
  } catch (error) {
    console.error('Video analysis error:', error);
    return {
      analysis: "Thanks for your video! Videos use energy to process and store. This is a great reminder that all our digital activities use energy - and that energy can come from solar power!",
      energy_kwh: "0.5 kWh",
      solar_tokens: "0.00010 SOLAR",
      carbon_footprint: "0.2 kg CO2"
    };
  }
}

function generateEducationalResponse(query) {
  const lowerQuery = query.toLowerCase();
  let energy_kwh = "10.0";
  let response = "";
  
  if (lowerQuery.includes('school') || lowerQuery.includes('classroom')) {
    energy_kwh = "50.0";
    response = "Schools use lots of energy! A typical classroom uses about 50 kWh per day for lights, computers, and climate control. That's like running 50 100-watt light bulbs for 10 hours! Solar panels on school roofs could provide clean energy for learning.";
  } else if (lowerQuery.includes('bicycle') || lowerQuery.includes('bike')) {
    energy_kwh = "0.0";
    response = "Bicycles are amazing! They use zero electricity and are powered by your muscles and the food you eat. Compared to a car that uses about 3 kWh per mile, your bike helps save energy and protects our planet!";
  } else if (lowerQuery.includes('solar') || lowerQuery.includes('panel')) {
    energy_kwh = "8.0";
    response = "Solar panels are like super cool energy collectors! One solar panel can generate about 8 kWh per day when the sun shines. That's enough to power your tablet for 40 hours or charge 400 smartphones!";
  } else {
    energy_kwh = "5.0";
    response = "That's a great question about energy! Most things around us use energy in some way. For example, the device you're using right now uses about 5 kWh per day. Solar panels could provide that clean energy from sunlight!";
  }
  
  const solar_tokens = (energy_kwh / 4913).toFixed(5);
  const carbon_footprint = (energy_kwh * 0.4).toFixed(2);
  
  return {
    analysis: response,
    energy_kwh: energy_kwh + ' kWh',
    solar_tokens: solar_tokens + ' SOLAR', 
    carbon_footprint: carbon_footprint + ' kg CO2'
  };
}

function estimateEnergyFromText(query) {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('house') || lowerQuery.includes('home')) return "30.0";
  if (lowerQuery.includes('car') || lowerQuery.includes('vehicle')) return "25.0";
  if (lowerQuery.includes('phone') || lowerQuery.includes('tablet')) return "0.1";
  if (lowerQuery.includes('computer') || lowerQuery.includes('laptop')) return "2.0";
  return "5.0";
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See server running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🌐 Website: http://0.0.0.0:${PORT}/`);
});