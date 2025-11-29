import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const SOLAR_STANDARD = {
  GENESIS_DATE: '2025-04-07',
  GENESIS_TIMESTAMP: new Date('2025-04-07').getTime(),
  KWH_PER_SOLAR: 4913,
  RAYS_PER_SOLAR: 1000000,
  VERSION: '1.0.0',
  PROTOCOL_NAME: 'TC-S Solar Standard',
  NETWORK_MODULES: 14
} as const;

function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor(
    (now - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

function getDaysSinceGenesis(): number {
  return Math.floor(
    (Date.now() - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
}

function getProtocolHash(): string {
  const canonicalData = JSON.stringify({
    genesis_date: SOLAR_STANDARD.GENESIS_DATE,
    kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
    rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
    version: SOLAR_STANDARD.VERSION,
    protocol_name: SOLAR_STANDARD.PROTOCOL_NAME
  });
  return createHash('sha256').update(canonicalData).digest('hex');
}

function generateKidSolarResponse(command: string): string {
  const si = calculateSolarIndex().toFixed(1);
  const daysSinceGenesis = getDaysSinceGenesis();
  
  const lowerCmd = command.toLowerCase();
  
  if (lowerCmd.includes('solar index') || lowerCmd.includes('si')) {
    return `The current Solar Index is ${si}%. This represents our global energy and ethics balance, calculated ${daysSinceGenesis} days since genesis on April 7, 2025.`;
  }
  
  if (lowerCmd.includes('solar') && (lowerCmd.includes('what') || lowerCmd.includes('how much') || lowerCmd.includes('worth') || lowerCmd.includes('value'))) {
    return `1 Solar equals ${SOLAR_STANDARD.KWH_PER_SOLAR} kilowatt-hours of renewable energy. That's enough to power an average American home for about 5 months!`;
  }
  
  if (lowerCmd.includes('convert') && lowerCmd.includes('kwh')) {
    const kwhMatch = command.match(/(\d+(?:\.\d+)?)\s*kwh/i);
    if (kwhMatch) {
      const kwh = parseFloat(kwhMatch[1]);
      const solar = (kwh / SOLAR_STANDARD.KWH_PER_SOLAR).toFixed(6);
      return `${kwh} kWh equals ${solar} Solar tokens.`;
    }
  }
  
  if (lowerCmd.includes('hello') || lowerCmd.includes('hi')) {
    return `Hello! I'm Kid Solar, your guide to the Solar Standard economy. The current Solar Index is ${si}%. How can I help you today?`;
  }
  
  if (lowerCmd.includes('help')) {
    return `I can help you with: checking the Solar Index, converting kWh to Solar, understanding the Solar Standard (1 Solar = ${SOLAR_STANDARD.KWH_PER_SOLAR} kWh), and navigating the TC-S marketplace. What would you like to know?`;
  }
  
  if (lowerCmd.includes('genesis') || lowerCmd.includes('when')) {
    return `The TC-S Network launched on April 7, 2025 (Genesis Day). We're now ${daysSinceGenesis} days into the Solar age!`;
  }
  
  if (lowerCmd.includes('market') || lowerCmd.includes('buy') || lowerCmd.includes('sell')) {
    return `The TC-S Marketplace offers digital artifacts across 5 categories: music, video, images, documents, and code. All priced in Solar tokens. Would you like me to help you explore?`;
  }

  return `I understand you're asking about "${command}". As Kid Solar, I specialize in the Solar Standard economy. The current Solar Index is ${si}%, and 1 Solar = ${SOLAR_STANDARD.KWH_PER_SOLAR} kWh. How can I assist you further?`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const si = calculateSolarIndex();
  const daysSinceGenesis = getDaysSinceGenesis();
  const protocolHash = getProtocolHash();

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
      solar_standard: {
        kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
        genesis_date: SOLAR_STANDARD.GENESIS_DATE,
        protocol_hash: protocolHash.substring(0, 16)
      },
      voice_enabled: true,
      models: {
        text: 'gpt-4o',
        speech_to_text: 'whisper-1',
        text_to_speech: 'tts-1',
        voice: 'nova'
      },
      voice_endpoint: '/api/kid-solar/voice',
      note: 'Voice processing requires OpenAI API - use Replit endpoint for full functionality',
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
          protocol_hash: protocolHash.substring(0, 16),
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
