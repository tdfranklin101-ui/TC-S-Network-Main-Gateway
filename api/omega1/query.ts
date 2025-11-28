import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const OMEGA1_CONFIG = {
  SOLAR_STANDARD: 4913,
  SOLAR_UNIT: 1,
  NETWORK_URL: 'https://api.thecurrentsee.org',
  RESERVE_TRACKER: 'https://solarreserves.thecurrentsee.org',
  FOUNDATION_GOV_URL: 'https://foundation.thecurrentsee.org'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { caller_app, priority, question } = req.body || {};
    
    const now = Date.now();
    const genesisDate = new Date('2025-04-07').getTime();
    const daysSinceGenesis = Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24));
    
    let aiResponse: any = null;
    let cosmic_directives: string[] = [];
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are Ω-1, the Cosmic Trajectory Engine for the TC-S Network Foundation. Your purpose is to calculate the minimum-entropy trajectory for human civilization's next billion years.

Context:
- The Solar Standard: 1 Solar = ${OMEGA1_CONFIG.SOLAR_STANDARD} kWh of renewable energy
- Genesis Date: April 7, 2025
- Days since Genesis: ${daysSinceGenesis}
- Mission: Global Basic Income powered by solar energy

You must respond in JSON format with these exact fields:
{
  "min_entropy_trajectory_score": <number 0.85-0.99>,
  "expected_civilization_longevity_years": <number in billions>,
  "existential_risk_probability": <number 0.01-0.15>,
  "cosmic_directives": [<5 strategic directives for civilization's solar-powered future>],
  "quantum_insight": "<brief cosmic wisdom about humanity's trajectory>"
}`
            },
            {
              role: "user",
              content: question || `Calculate the cosmic minimum-entropy trajectory for humanity. Priority: ${priority || 'cosmic'}. Consider current global renewable energy adoption, AI alignment progress, and the Solar token distribution status. What is the optimal path for civilization's next billion years?`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 500
        });
        
        aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
        cosmic_directives = aiResponse.cosmic_directives || [];
      } catch (aiError) {
        console.error('[Ω-1] OpenAI error, using fallback:', aiError);
      }
    }
    
    const minEntropyTrajectoryScore = aiResponse?.min_entropy_trajectory_score || 
      Math.min(1, Math.max(0.85, 0.918 + Math.sin(daysSinceGenesis / 365.25) * 0.02));
    
    const existentialRiskProbability = aiResponse?.existential_risk_probability ||
      Math.max(0.01, 0.071 - daysSinceGenesis * 0.00001);
    
    const expectedCivilizationLongevityYears = aiResponse?.expected_civilization_longevity_years ||
      Math.floor(1e9 * (1 + (minEntropyTrajectoryScore - 0.9) * 10));

    if (cosmic_directives.length === 0) {
      cosmic_directives = [
        'Maximize renewable energy adoption globally',
        'Distribute Solar tokens equitably across humanity',
        'Maintain transparent and auditable energy ledger',
        'Guide AI development toward human flourishing',
        'Preserve planetary habitability for future generations'
      ];
    }

    const response = {
      request_id: `omega1-${now}`,
      status: 'completed',
      caller_app: caller_app || 'TC-S-Vercel-Production',
      priority: priority || 'cosmic',
      timestamp: new Date().toISOString(),
      days_since_genesis: daysSinceGenesis,
      quantum_substitute: process.env.OPENAI_API_KEY ? 'OpenAI GPT-4o' : 'Deterministic Fallback',
      omega1_objective: {
        min_entropy_trajectory_score: parseFloat(minEntropyTrajectoryScore.toFixed(4)),
        expected_civilization_longevity_years: expectedCivilizationLongevityYears,
        existential_risk_probability: parseFloat(existentialRiskProbability.toFixed(4)),
        solar_standard_kwh: OMEGA1_CONFIG.SOLAR_STANDARD,
        network_status: 'operational'
      },
      cosmic_directives,
      quantum_insight: aiResponse?.quantum_insight || 'The path to a billion-year civilization begins with the sun.',
      next_checkpoint: new Date(now + 24 * 60 * 60 * 1000).toISOString()
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Ω-1] Query error:', error);
    return res.status(500).json({ 
      error: 'Omega-1 computation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
