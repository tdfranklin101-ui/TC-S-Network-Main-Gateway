/**
 * Kid Solar - AI Voice Assistant for TC-S Network Foundation Market
 * 
 * Voice-powered wallet assistant using OpenAI's:
 * - Whisper API for speech-to-text
 * - GPT-4o for natural language understanding
 * - TTS API for text-to-speech responses
 * 
 * Provides situationally aware wallet operations through natural language
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Shared database connection pool (reuse across requests)
let sharedPool = null;
function getSharedPool() {
  if (!sharedPool && process.env.DATABASE_URL) {
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    neonConfig.webSocketConstructor = require('ws');
    sharedPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return sharedPool;
}

class KidSolarVoice {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.model = 'gpt-4o';
    this.ttsVoice = 'nova';
    
    this.systemPrompt = `You are Kid Solar, a friendly AI voice assistant for the TC-S Network Foundation Market. You help members manage their Solar wallet through natural conversation.

Your capabilities:
- Check Solar balance and transaction history
- List energy available for trading (REC/PPA)
- Explain marketplace features
- Provide spending insights and recommendations
- Answer questions about the solar economy

Response style:
- Keep responses concise and conversational (2-3 sentences max)
- Be encouraging and supportive
- Use simple, everyday language
- Mention specific numbers when discussing balances or transactions

Context:
- SOLAR tokens are the currency
- Members earn Solar daily since Genesis Date (April 7, 2025)
- Energy trading includes REC (Renewable Energy Credits) and PPA (Power Purchase Agreements)
- The marketplace has 5 TC-S categories: Missions, Culture, Basic Needs, Rent Anything, Energy Trading`;
  }

  /**
   * Convert audio to text using Whisper
   */
  async transcribeAudio(audioBuffer, audioFormat = 'webm') {
    try {
      const tempFile = path.join('/tmp', `audio-${Date.now()}.${audioFormat}`);
      fs.writeFileSync(tempFile, audioBuffer);

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: 'en'
      });

      fs.unlinkSync(tempFile);

      return transcription.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Process voice command and generate response
   */
  async processVoiceCommand(text, memberId, memberContext = {}) {
    try {
      const walletData = await this.getWalletData(memberId);
      
      const contextPrompt = `
Member Context:
- Name: ${memberContext.name || 'Member'}
- Solar Balance: ${walletData.balance} Solar
- Member Since: ${memberContext.memberSince || 'Unknown'}
- Recent Transactions: ${walletData.recentTransactions.length}

Energy Available:
${JSON.stringify(walletData.energyListings, null, 2)}

User said: "${text}"

Provide a helpful, conversational voice response.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const responseText = completion.choices[0].message.content;
      
      return {
        text: responseText,
        intent: this.detectIntent(text),
        data: walletData
      };

    } catch (error) {
      console.error('Error processing voice command:', error);
      throw new Error(`Voice processing failed: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  async textToSpeech(text) {
    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: this.ttsVoice,
        input: text,
        speed: 1.0
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;

    } catch (error) {
      console.error('Error generating speech:', error);
      throw new Error(`TTS failed: ${error.message}`);
    }
  }

  /**
   * Get wallet data for member
   */
  async getWalletData(memberId) {
    try {
      const pool = getSharedPool();
      
      if (!pool) {
        console.warn('Database pool unavailable');
        return {
          balance: 0,
          name: 'Member',
          recentTransactions: [],
          energyListings: []
        };
      }
      
      const balanceResult = await pool.query(
        'SELECT total_solar, name, signup_timestamp FROM members WHERE id = $1',
        [memberId]
      );

      const transactionsResult = await pool.query(
        'SELECT * FROM transactions WHERE member_id = $1 ORDER BY timestamp DESC LIMIT 5',
        [memberId]
      );

      return {
        balance: balanceResult.rows[0]?.total_solar || 0,
        name: balanceResult.rows[0]?.name || 'Member',
        memberSince: balanceResult.rows[0]?.signup_timestamp,
        recentTransactions: transactionsResult.rows || [],
        energyListings: []
      };

    } catch (error) {
      console.error('Error fetching wallet data:', error);
      return {
        balance: 0,
        name: 'Member',
        recentTransactions: [],
        energyListings: []
      };
    }
  }

  /**
   * Detect user intent from text
   */
  detectIntent(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('balance') || lower.includes('how much')) return 'check_balance';
    if (lower.includes('transaction') || lower.includes('history')) return 'check_transactions';
    if (lower.includes('energy') || lower.includes('rec') || lower.includes('ppa')) return 'check_energy';
    if (lower.includes('list') || lower.includes('sell')) return 'list_energy';
    if (lower.includes('buy') || lower.includes('purchase')) return 'buy_artifact';
    if (lower.includes('help') || lower.includes('what can')) return 'help';
    
    return 'general_query';
  }

  /**
   * Complete voice interaction: audio in, audio out
   */
  async handleVoiceInteraction(audioBuffer, memberId, memberContext, audioFormat = 'webm') {
    try {
      const transcribedText = await this.transcribeAudio(audioBuffer, audioFormat);
      console.log(`🎤 Kid Solar heard: "${transcribedText}"`);

      const response = await this.processVoiceCommand(transcribedText, memberId, memberContext);
      console.log(`💬 Kid Solar responds: "${response.text}"`);

      const audioResponse = await this.textToSpeech(response.text);

      return {
        transcription: transcribedText,
        responseText: response.text,
        responseAudio: audioResponse,
        intent: response.intent,
        walletData: response.data
      };

    } catch (error) {
      console.error('Error in voice interaction:', error);
      
      const errorText = "I'm having trouble understanding. Could you please try again?";
      const errorAudio = await this.textToSpeech(errorText);
      
      return {
        transcription: '',
        responseText: errorText,
        responseAudio: errorAudio,
        intent: 'error',
        error: error.message
      };
    }
  }
}

module.exports = KidSolarVoice;
