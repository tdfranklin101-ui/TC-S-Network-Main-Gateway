import type { VercelRequest, VercelResponse } from '@vercel/node';

const GENESIS_DATE = new Date('2025-04-07').getTime();
const SOLAR_KWH = 4913;

function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor((now - GENESIS_DATE) / (1000 * 60 * 60 * 24));
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

function generateKidSolarResponse(command: string): string {
  const si = calculateSolarIndex().toFixed(1);
  const daysSinceGenesis = Math.floor((Date.now() - GENESIS_DATE) / (1000 * 60 * 60 * 24));
  
  const lowerCmd = command.toLowerCase();
  
  if (lowerCmd.includes('solar index') || lowerCmd.includes('si')) {
    return `The current Solar Index is ${si}%. This represents our global energy and ethics balance, calculated ${daysSinceGenesis} days since genesis on April 7, 2025.`;
  }
  
  if (lowerCmd.includes('solar') && (lowerCmd.includes('what') || lowerCmd.includes('how much'))) {
    return `1 Solar equals ${SOLAR_KWH} kilowatt-hours of renewable energy. That's enough to power an average American home for about 5 months!`;
  }
  
  if (lowerCmd.includes('convert') && lowerCmd.includes('kwh')) {
    const kwhMatch = command.match(/(\d+(?:\.\d+)?)\s*kwh/i);
    if (kwhMatch) {
      const kwh = parseFloat(kwhMatch[1]);
      const solar = (kwh / SOLAR_KWH).toFixed(6);
      return `${kwh} kWh equals ${solar} Solar tokens.`;
    }
  }
  
  if (lowerCmd.includes('hello') || lowerCmd.includes('hi')) {
    return `Hello! I'm Kid Solar, your guide to the Solar Standard economy. The current Solar Index is ${si}%. How can I help you today?`;
  }
  
  if (lowerCmd.includes('help')) {
    return `I can help you with: checking the Solar Index, converting kWh to Solar, understanding the Solar Standard (1 Solar = ${SOLAR_KWH} kWh), and navigating the TC-S marketplace. What would you like to know?`;
  }
  
  if (lowerCmd.includes('genesis') || lowerCmd.includes('when')) {
    return `The TC-S Network launched on April 7, 2025 (Genesis Day). We're now ${daysSinceGenesis} days into the Solar age!`;
  }
  
  if (lowerCmd.includes('market') || lowerCmd.includes('buy') || lowerCmd.includes('sell')) {
    return `The TC-S Marketplace offers digital artifacts across 5 categories: music, video, images, documents, and code. All priced in Solar tokens. Would you like me to help you explore?`;
  }

  return `I understand you're asking about "${command}". As Kid Solar, I specialize in the Solar Standard economy. The current Solar Index is ${si}%, and 1 Solar = ${SOLAR_KWH} kWh. How can I assist you further?`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const si = calculateSolarIndex();
  const daysSinceGenesis = Math.floor((Date.now() - GENESIS_DATE) / (1000 * 60 * 60 * 24));

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      name: 'Kid Solar',
      version: '2.0.0',
      capabilities: [
        'text_chat',
        'solar_calculations',
        'marketplace_navigation',
        'wallet_inquiries'
      ],
      current_indices: {
        solar_index: parseFloat(si.toFixed(1)),
        days_since_genesis: daysSinceGenesis
      },
      voice_enabled: true,
      models: {
        text: 'gpt-4o',
        speech_to_text: 'whisper-1',
        text_to_speech: 'tts-1',
        voice: 'nova'
      },
      last_updated: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    try {
      const { command, message, text } = req.body || {};
      const userInput = command || message || text || '';

      if (!userInput) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a command, message, or text field'
        });
      }

      const response = generateKidSolarResponse(userInput);

      return res.status(200).json({
        success: true,
        response,
        input: userInput,
        metadata: {
          solar_index: parseFloat(si.toFixed(1)),
          days_since_genesis: daysSinceGenesis,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process command',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
