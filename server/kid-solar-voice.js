/**
 * Kid Solar - AI Voice Assistant for TC-S Network Foundation Market
 * 
 * Voice-powered wallet assistant using OpenAI's:
 * - Whisper API for speech-to-text
 * - GPT-4o for natural language understanding with function calling
 * - GPT-4o Vision for image analysis
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
- Purchase artifacts from the marketplace
- Preview music, videos, and other content
- Explain marketplace features
- Provide spending insights and recommendations
- Answer questions about the solar economy
- Analyze images and documents when shared
- Help users upload artifacts with AI-powered metadata suggestions
- Guide users through the upload process step-by-step
- Check upload status and list user's artifacts

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

    // OpenAI function definitions for marketplace operations
    this.functionDefinitions = [
      {
        type: "function",
        function: {
          name: "purchase_artifact",
          description: "Purchase a music track, video, or other item from the marketplace using Solar tokens. Checks balance and creates transaction.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title or name of the artifact to purchase (e.g., 'Rasta Lady Voodoo', 'Snowmancer One')"
              },
              slug: {
                type: "string",
                description: "Optional: The URL slug of the artifact if known"
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "preview_artifact",
          description: "Get streaming preview URL for music, video, or content samples. Returns preview information without purchasing.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the artifact to preview"
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_wallet_balance",
          description: "Check the user's current Solar token balance",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_marketplace_items",
          description: "List available items from the marketplace, optionally filtered by category or price range",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Filter by category: 'music', 'video', 'art', 'text', or 'all'",
                enum: ["music", "video", "art", "text", "all"]
              },
              maxPrice: {
                type: "number",
                description: "Maximum Solar price to show (e.g., 0.01 for items under 0.01 Solar)"
              },
              limit: {
                type: "integer",
                description: "Maximum number of items to return (default 10)",
                default: 10
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_artifact_for_upload",
          description: "Analyze an uploaded image, audio, video, or document file using AI to suggest metadata for marketplace upload (title, description, category, tags, pricing)",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "Name of the file being analyzed"
              },
              fileType: {
                type: "string",
                description: "MIME type of the file (e.g., 'image/jpeg', 'audio/mp3', 'video/mp4')"
              }
            },
            required: ["fileName", "fileType"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_upload_guidance",
          description: "Provide step-by-step instructions for uploading artifacts to the marketplace, including file size limits and requirements",
          parameters: {
            type: "object",
            properties: {
              fileType: {
                type: "string",
                description: "Optional: Type of file user wants to upload (music/video/art/document) for specific guidance"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_my_uploads",
          description: "List all artifacts uploaded by the user with their approval status (approved/pending review)",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "price_artifact",
          description: "Calculate the Solar price for an item based on its energy content using Identify Anything pricing. Uses kWh assessment to determine fair Solar value.",
          parameters: {
            type: "object",
            properties: {
              fileType: {
                type: "string",
                description: "Type of file: 'music', 'video', 'art', 'document', or 'other'",
                enum: ["music", "video", "art", "document", "other"]
              },
              fileSizeMB: {
                type: "number",
                description: "File size in megabytes"
              },
              durationSeconds: {
                type: "number",
                description: "Duration in seconds (for audio/video)"
              },
              description: {
                type: "string",
                description: "Description of the item for AI pricing assessment"
              }
            },
            required: ["fileType"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_artifact_for_sale",
          description: "List an artifact for sale on the marketplace with a specified Solar price. Creates a new marketplace listing.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Title of the artifact"
              },
              description: {
                type: "string",
                description: "Description of the artifact"
              },
              category: {
                type: "string",
                description: "Category: 'music', 'video', 'art', 'document'",
                enum: ["music", "video", "art", "document"]
              },
              solarPrice: {
                type: "number",
                description: "Price in Solar tokens"
              },
              filePath: {
                type: "string",
                description: "Path to the uploaded file"
              }
            },
            required: ["title", "category", "solarPrice"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_transaction_history",
          description: "Get the user's recent transaction history showing purchases, sales, and Solar movements",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "integer",
                description: "Number of transactions to return (default 10)",
                default: 10
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_artifact",
          description: "Create and upload a new artifact to the marketplace. Handles file upload and metadata.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Title of the artifact"
              },
              description: {
                type: "string",
                description: "Description of the artifact"
              },
              category: {
                type: "string",
                description: "Category: 'music', 'video', 'art', 'document'",
                enum: ["music", "video", "art", "document"]
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags for searchability"
              },
              suggestedPrice: {
                type: "number",
                description: "Suggested Solar price (will be verified against kWh assessment)"
              }
            },
            required: ["title", "category"]
          }
        }
      }
    ];
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
   * Process voice command with function calling support
   */
  async processVoiceCommand(text, memberId, memberContext = {}, conversationHistory = [], fileData = null) {
    try {
      // Prefer memberContext data over database query for better performance and reliability
      const walletData = memberContext.totalSolar !== undefined ? {
        balance: memberContext.totalSolar,
        name: memberContext.username || memberContext.name || 'Member',
        memberSince: memberContext.memberSince || 'Unknown',
        recentTransactions: []
      } : await this.getWalletData(memberId);
      
      let contextPrompt = `
Member Context:
- Name: ${memberContext.username || memberContext.name || walletData.name || 'Member'}
- Solar Balance: ${walletData.balance} Solar
- Member Since: ${memberContext.memberSince || walletData.memberSince || 'Unknown'}
- Recent Transactions: ${walletData.recentTransactions.length}

User said: "${text}"`;

      if (fileData) {
        contextPrompt += `\n\nFile attached: ${fileData.fileName} (${fileData.fileType})`;
      }

      contextPrompt += '\n\nUse the available functions to help the user with marketplace operations, or provide a conversational response.';

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { role: 'user', content: contextPrompt }
      ];

      // First API call with function calling enabled
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: this.functionDefinitions,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 150
      });

      const responseMessage = completion.choices[0].message;

      // Check if GPT wants to call a function
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Handle all tool calls (OpenAI may request multiple at once)
        const toolCall = responseMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🔧 Kid Solar calling function: ${functionName} with args:`, functionArgs);

        // Execute the function
        const functionResult = await this.executeFunctionCall(functionName, functionArgs, memberId, fileData);

        // Add assistant message with tool_calls
        messages.push(responseMessage);
        
        // Add tool response messages for ALL tool calls
        for (const call of responseMessage.tool_calls) {
          const callFunctionName = call.function.name;
          const callFunctionArgs = JSON.parse(call.function.arguments);
          
          // Execute each function call
          const callResult = call === toolCall ? functionResult : 
            await this.executeFunctionCall(callFunctionName, callFunctionArgs, memberId, fileData);
          
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(callResult)
          });
        }

        // Get final response from GPT with function result
        const finalCompletion = await this.openai.chat.completions.create({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 150
        });

        const finalText = finalCompletion.choices[0].message.content;

        return {
          text: finalText,
          intent: functionName,
          data: functionResult,
          functionCalled: functionName,
          functionArgs: functionArgs,
          functionData: functionResult
        };
      } else {
        // No function call, return direct response
        return {
          text: responseMessage.content,
          intent: this.detectIntent(text),
          data: walletData
        };
      }

    } catch (error) {
      console.error('Error processing voice command:', error);
      throw new Error(`Voice processing failed: ${error.message}`);
    }
  }

  /**
   * Execute function calls from OpenAI
   */
  async executeFunctionCall(functionName, args, memberId, fileData = null) {
    try {
      switch (functionName) {
        case 'purchase_artifact':
          return await this.purchaseArtifact(args.title, memberId, args.slug);
        
        case 'preview_artifact':
          return await this.previewArtifact(args.title);
        
        case 'check_wallet_balance':
          return await this.checkWalletBalance(memberId);
        
        case 'list_marketplace_items':
          return await this.listMarketplaceItems(args.category, args.maxPrice, args.limit || 10);
        
        case 'analyze_artifact_for_upload':
          return await this.analyzeArtifactForUpload(fileData, args.fileName, args.fileType);
        
        case 'get_upload_guidance':
          return await this.getUploadGuidance(args.fileType);
        
        case 'check_my_uploads':
          return await this.checkMyUploads(memberId);
        
        case 'price_artifact':
          return await this.priceArtifact(args.fileType, args.fileSizeMB, args.durationSeconds, args.description);
        
        case 'list_artifact_for_sale':
          return await this.listArtifactForSale(args.title, args.description, args.category, args.solarPrice, args.filePath, memberId);
        
        case 'get_transaction_history':
          return await this.getTransactionHistory(memberId, args.limit || 10);
        
        case 'create_artifact':
          return await this.createArtifact(args.title, args.description, args.category, args.tags, args.suggestedPrice, memberId, fileData);
        
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Purchase artifact from marketplace
   */
  async purchaseArtifact(title, memberId, slug = null) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      // Find artifact by title or slug
      let artifact;
      if (slug) {
        const result = await pool.query(
          'SELECT * FROM artifacts WHERE slug = $1 AND active = true',
          [slug]
        );
        artifact = result.rows[0];
      } else {
        const result = await pool.query(
          'SELECT * FROM artifacts WHERE LOWER(title) LIKE LOWER($1) AND active = true LIMIT 1',
          [`%${title}%`]
        );
        artifact = result.rows[0];
      }

      if (!artifact) {
        return { success: false, error: `Could not find "${title}" in the marketplace` };
      }

      // Get member's current balance
      const memberResult = await pool.query(
        'SELECT total_solar, name FROM members WHERE id = $1',
        [memberId]
      );
      const member = memberResult.rows[0];
      
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      const currentBalance = parseFloat(member.total_solar || '0');
      const artifactPrice = parseFloat(artifact.solar_amount_s || '0');

      // Check if user has enough balance
      if (currentBalance < artifactPrice) {
        return {
          success: false,
          error: `Insufficient balance. You have ${currentBalance} Solar, but this costs ${artifactPrice} Solar`,
          balance: currentBalance,
          price: artifactPrice,
          artifact: {
            title: artifact.title,
            price: artifactPrice
          }
        };
      }

      // Deduct Solar from member's balance
      const newBalance = currentBalance - artifactPrice;
      await pool.query(
        'UPDATE members SET total_solar = $1 WHERE id = $2',
        [newBalance.toString(), memberId]
      );

      // Create transaction record
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, currency, status, description, metadata, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          memberId.toString(),
          'solar_spend',
          artifactPrice,
          'SOLAR',
          'completed',
          `Purchased: ${artifact.title}`,
          JSON.stringify({
            artifactId: artifact.id,
            artifactTitle: artifact.title,
            artifactSlug: artifact.slug,
            solarPrice: artifactPrice
          })
        ]
      );

      return {
        success: true,
        artifact: {
          id: artifact.id,
          title: artifact.title,
          slug: artifact.slug,
          price: artifactPrice,
          downloadUrl: artifact.trade_file_url || artifact.delivery_url,
          streamingUrl: artifact.streaming_url
        },
        transaction: {
          oldBalance: currentBalance,
          newBalance: newBalance,
          amountSpent: artifactPrice
        }
      };

    } catch (error) {
      console.error('Error purchasing artifact:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get preview information for artifact
   */
  async previewArtifact(title) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      const result = await pool.query(
        'SELECT * FROM artifacts WHERE LOWER(title) LIKE LOWER($1) AND active = true LIMIT 1',
        [`%${title}%`]
      );

      const artifact = result.rows[0];
      if (!artifact) {
        return { success: false, error: `Could not find "${title}" in the marketplace` };
      }

      return {
        success: true,
        artifact: {
          id: artifact.id,
          title: artifact.title,
          slug: artifact.slug,
          description: artifact.description,
          category: artifact.category,
          price: parseFloat(artifact.solar_amount_s || '0'),
          streamingUrl: artifact.streaming_url,
          previewUrl: artifact.preview_file_url,
          coverArt: artifact.cover_art_url,
          fileType: artifact.file_type,
          previewType: artifact.preview_type
        }
      };

    } catch (error) {
      console.error('Error previewing artifact:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check wallet balance
   */
  async checkWalletBalance(memberId) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      const result = await pool.query(
        'SELECT total_solar, total_dollars, name, joined_date FROM members WHERE id = $1',
        [memberId]
      );

      const member = result.rows[0];
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      return {
        success: true,
        balance: {
          solar: parseFloat(member.total_solar || '0'),
          dollars: parseFloat(member.total_dollars || '0'),
          name: member.name,
          memberSince: member.joined_date
        }
      };

    } catch (error) {
      console.error('Error checking balance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List marketplace items with filters
   */
  async listMarketplaceItems(category = 'all', maxPrice = null, limit = 10) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      let query = 'SELECT * FROM artifacts WHERE active = true';
      const params = [];
      let paramIndex = 1;

      // Category filter
      if (category && category !== 'all') {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Price filter
      if (maxPrice !== null && maxPrice !== undefined) {
        query += ` AND CAST(solar_amount_s AS DECIMAL) <= $${paramIndex}`;
        params.push(maxPrice);
        paramIndex++;
      }

      // Order by price and limit
      query += ` ORDER BY CAST(solar_amount_s AS DECIMAL) ASC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);

      const items = result.rows.map(artifact => ({
        id: artifact.id,
        title: artifact.title,
        slug: artifact.slug,
        description: artifact.description,
        category: artifact.category,
        price: parseFloat(artifact.solar_amount_s || '0'),
        fileType: artifact.file_type,
        coverArt: artifact.cover_art_url,
        streamingUrl: artifact.streaming_url
      }));

      return {
        success: true,
        items: items,
        count: items.length,
        filters: {
          category: category,
          maxPrice: maxPrice,
          limit: limit
        }
      };

    } catch (error) {
      console.error('Error listing marketplace items:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Price an artifact using kWh energy assessment (Identify Anything)
   * Solar Standard: 1 Solar = 4,913 kWh
   * Pricing is based on estimated energy to create, store, and distribute the artifact
   */
  async priceArtifact(fileType, fileSizeMB = 1, durationSeconds = 0, description = '') {
    try {
      // Validate inputs
      if (!fileType || !['music', 'video', 'art', 'document', 'other'].includes(fileType)) {
        return { success: false, error: 'Invalid file type. Must be: music, video, art, document, or other' };
      }
      
      // Solar Standard: 1 Solar = 4,913 kWh (renewable energy equivalent)
      const KWH_PER_SOLAR = 4913;
      
      // Base energy calculations based on file type
      let estimatedKwh = 0;
      let reasoning = '';
      
      const baseStorageEnergy = (fileSizeMB || 1) * 0.0001; // 0.0001 kWh per MB storage
      const baseDistributionEnergy = 0.001; // Base distribution energy
      
      switch (fileType) {
        case 'music':
          const minutes = (durationSeconds || 180) / 60;
          const recordingEnergy = minutes * 0.05; // 0.05 kWh per minute of recording
          const productionEnergy = minutes * 0.02; // 0.02 kWh per minute of production
          estimatedKwh = recordingEnergy + productionEnergy + baseStorageEnergy + baseDistributionEnergy;
          reasoning = `Music: Recording (${recordingEnergy.toFixed(4)} kWh) + Production (${productionEnergy.toFixed(4)} kWh) + Storage (${baseStorageEnergy.toFixed(4)} kWh)`;
          break;
          
        case 'video':
          const videoMinutes = (durationSeconds || 300) / 60;
          const filmingEnergy = videoMinutes * 0.15;
          const editingEnergy = videoMinutes * 0.08;
          const renderingEnergy = videoMinutes * 0.12;
          estimatedKwh = filmingEnergy + editingEnergy + renderingEnergy + baseStorageEnergy + baseDistributionEnergy;
          reasoning = `Video: Filming (${filmingEnergy.toFixed(4)} kWh) + Editing (${editingEnergy.toFixed(4)} kWh) + Rendering (${renderingEnergy.toFixed(4)} kWh)`;
          break;
          
        case 'art':
          const creationEnergy = 0.05;
          const processingEnergy = (fileSizeMB || 1) * 0.001;
          estimatedKwh = creationEnergy + processingEnergy + baseStorageEnergy + baseDistributionEnergy;
          reasoning = `Digital art: Creation (${creationEnergy.toFixed(4)} kWh) + Processing (${processingEnergy.toFixed(4)} kWh)`;
          break;
          
        case 'document':
          const writingEnergy = 0.02;
          const formattingEnergy = 0.005;
          estimatedKwh = writingEnergy + formattingEnergy + baseStorageEnergy + baseDistributionEnergy;
          reasoning = `Document: Writing (${writingEnergy.toFixed(4)} kWh) + Formatting (${formattingEnergy.toFixed(4)} kWh)`;
          break;
          
        default:
          estimatedKwh = baseStorageEnergy + baseDistributionEnergy + 0.01;
          reasoning = `Generic file: Base energy estimate`;
      }
      
      // Convert kWh to Solar
      const solarPrice = estimatedKwh / KWH_PER_SOLAR;
      
      return {
        success: true,
        pricing: {
          estimatedKwh: estimatedKwh.toFixed(6),
          solarPrice: solarPrice.toFixed(6),
          reasoning: reasoning,
          fileType: fileType,
          kwhPerSolar: KWH_PER_SOLAR
        }
      };
      
    } catch (error) {
      console.error('Error pricing artifact:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List an artifact for sale on the marketplace
   * Creates an active listing that can be purchased immediately
   */
  async listArtifactForSale(title, description, category, solarPrice, filePath, memberId) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      // Validate required fields
      if (!title || title.trim().length === 0) {
        return { success: false, error: 'Title is required' };
      }
      if (!category || !['music', 'video', 'art', 'document'].includes(category)) {
        return { success: false, error: 'Category must be: music, video, art, or document' };
      }
      if (!solarPrice || solarPrice <= 0) {
        return { success: false, error: 'Price must be greater than 0' };
      }

      // Get member info
      const memberResult = await pool.query(
        'SELECT name, email FROM members WHERE id = $1',
        [memberId]
      );
      const member = memberResult.rows[0];
      
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      // Generate slug from title
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const uniqueSlug = `${slug}-${Date.now()}`;

      // Calculate kWh equivalent (1 Solar = 4,913 kWh)
      const kwhEquivalent = solarPrice * 4913;

      // Insert artifact
      const result = await pool.query(
        `INSERT INTO artifacts (
          title, slug, description, category, solar_amount_s, kwh_equivalent,
          creator_email, active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        RETURNING id, title, slug, solar_amount_s`,
        [title, uniqueSlug, description || '', category, solarPrice.toString(), kwhEquivalent, member.email]
      );

      const artifact = result.rows[0];

      // Log the listing transaction
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, currency, status, description, metadata, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          memberId.toString(),
          'artifact_listed',
          0,
          'SOLAR',
          'completed',
          `Listed for sale: ${title}`,
          JSON.stringify({
            artifactId: artifact.id,
            artifactTitle: title,
            solarPrice: solarPrice
          })
        ]
      );

      return {
        success: true,
        artifact: {
          id: artifact.id,
          title: artifact.title,
          slug: artifact.slug,
          price: solarPrice,
          category: category
        },
        message: `Successfully listed "${title}" for ${solarPrice} Solar`
      };

    } catch (error) {
      console.error('Error listing artifact for sale:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's transaction history (ledger)
   */
  async getTransactionHistory(memberId, limit = 10) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      const result = await pool.query(
        `SELECT id, type, amount, currency, status, description, metadata, completed_at
         FROM transactions 
         WHERE user_id = $1 
         ORDER BY completed_at DESC 
         LIMIT $2`,
        [memberId.toString(), limit]
      );

      const transactions = result.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount || 0),
        currency: tx.currency,
        status: tx.status,
        description: tx.description,
        details: tx.metadata,
        date: tx.completed_at
      }));

      return {
        success: true,
        transactions: transactions,
        count: transactions.length,
        message: transactions.length > 0 
          ? `Found ${transactions.length} recent transactions`
          : 'No transactions found'
      };

    } catch (error) {
      console.error('Error getting transaction history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create and upload a new artifact
   * This creates a placeholder entry for the artifact. The actual file upload
   * is handled separately through the marketplace upload UI.
   * 
   * Agent workflow:
   * 1. User asks "Create artifact called X"
   * 2. Kid Solar creates DB entry with metadata (pending status)
   * 3. User then uploads file through marketplace UI
   * 4. File upload links to the created entry
   */
  async createArtifact(title, description, category, tags, suggestedPrice, memberId, fileData = null) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      // Validate required fields
      if (!title || title.trim().length === 0) {
        return { success: false, error: 'Title is required' };
      }
      if (!category || !['music', 'video', 'art', 'document'].includes(category)) {
        return { success: false, error: 'Category must be: music, video, art, or document' };
      }

      // Get member info
      const memberResult = await pool.query(
        'SELECT name, email FROM members WHERE id = $1',
        [memberId]
      );
      const member = memberResult.rows[0];
      
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      // Calculate price if not suggested (uses kWh energy assessment)
      let finalPrice = suggestedPrice;
      if (!finalPrice) {
        const pricingResult = await this.priceArtifact(category, 1, 180, description);
        finalPrice = parseFloat(pricingResult.pricing?.solarPrice || 0.001);
      }

      // Generate slug
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const uniqueSlug = `${slug}-${Date.now()}`;

      // Calculate kWh equivalent
      const kwhEquivalent = finalPrice * 4913;

      // Insert artifact (pending review)
      const result = await pool.query(
        `INSERT INTO artifacts (
          title, slug, description, category, solar_amount_s, kwh_equivalent,
          creator_email, active, created_at, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), $8)
        RETURNING id, title, slug, solar_amount_s`,
        [
          title, 
          uniqueSlug, 
          description || '', 
          category, 
          finalPrice.toString(), 
          kwhEquivalent, 
          member.email,
          JSON.stringify(tags || [])
        ]
      );

      const artifact = result.rows[0];

      // Log creation transaction
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount, currency, status, description, metadata, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          memberId.toString(),
          'artifact_created',
          0,
          'SOLAR',
          'pending',
          `Created artifact: ${title}`,
          JSON.stringify({
            artifactId: artifact.id,
            artifactTitle: title,
            solarPrice: finalPrice,
            status: 'pending_review'
          })
        ]
      );

      return {
        success: true,
        artifact: {
          id: artifact.id,
          title: artifact.title,
          slug: artifact.slug,
          price: finalPrice,
          category: category,
          status: 'pending_review'
        },
        message: `Created "${title}" (pending review). Suggested price: ${finalPrice.toFixed(6)} Solar`,
        nextStep: 'Upload your file through the marketplace to complete the listing'
      };

    } catch (error) {
      console.error('Error creating artifact:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process image with GPT-4o Vision
   */
  async processImageWithVision(imageData, prompt, conversationHistory = []) {
    try {
      let base64Image;
      
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        base64Image = imageData.split(',')[1];
      } else if (typeof imageData === 'string') {
        base64Image = imageData;
      } else {
        throw new Error('Invalid image data format');
      }

      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 300
      });

      return {
        text: completion.choices[0].message.content,
        intent: 'image_analysis'
      };

    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Process file text extraction
   */
  async processFileText(fileData, fileName, prompt, conversationHistory = []) {
    try {
      const ext = path.extname(fileName).toLowerCase();
      let extractedText = '';

      if (ext === '.txt') {
        extractedText = Buffer.isBuffer(fileData) ? fileData.toString('utf-8') : fileData;
      } else if (ext === '.pdf') {
        return {
          text: "I can see you've uploaded a PDF document. PDF text extraction is coming soon! For now, please copy and paste the text you'd like me to analyze.",
          intent: 'file_upload'
        };
      } else if (ext === '.doc' || ext === '.docx') {
        return {
          text: "I can see you've uploaded a Word document. Document analysis is coming soon! For now, please copy and paste the text you'd like me to analyze.",
          intent: 'file_upload'
        };
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      if (extractedText.length > 4000) {
        extractedText = extractedText.substring(0, 4000) + '... (truncated)';
      }

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        {
          role: 'user',
          content: `${prompt || 'Please analyze this file content:'}\n\nFile: ${fileName}\n\nContent:\n${extractedText}`
        }
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 300
      });

      return {
        text: completion.choices[0].message.content,
        intent: 'file_analysis'
      };

    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error(`File processing failed: ${error.message}`);
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
        'SELECT total_solar, name, joined_date FROM members WHERE id = $1',
        [memberId]
      );

      // Get wallet_id for this member to fetch transactions
      const walletResult = await pool.query(
        'SELECT id FROM wallets WHERE member_id = $1',
        [memberId]
      );
      
      const walletId = walletResult.rows[0]?.id;
      
      let recentTransactions = [];
      if (walletId) {
        const transactionsResult = await pool.query(
          'SELECT * FROM transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 5',
          [walletId]
        );
        recentTransactions = transactionsResult.rows;
      }

      return {
        balance: parseFloat(balanceResult.rows[0]?.total_solar || '0'),
        name: balanceResult.rows[0]?.name || 'Member',
        memberSince: balanceResult.rows[0]?.joined_date,
        recentTransactions: recentTransactions,
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
    if (lower.includes('preview') || lower.includes('play') || lower.includes('stream')) return 'preview_artifact';
    if (lower.includes('upload') || lower.includes('submit')) return 'upload_artifact';
    if (lower.includes('my upload') || lower.includes('my artifact')) return 'check_my_uploads';
    if (lower.includes('how to upload') || lower.includes('upload guide')) return 'upload_guidance';
    if (lower.includes('help') || lower.includes('what can')) return 'help';
    
    return 'general_query';
  }

  /**
   * Analyze artifact file for upload using Vision API
   */
  async analyzeArtifactForUpload(fileData, fileName, fileType) {
    try {
      if (!fileData || !fileData.buffer) {
        return {
          success: false,
          error: 'No file data provided for analysis'
        };
      }

      let analysisText = '';
      let category = 'uncategorized';
      let suggestedPrice = 0.001;

      if (fileType.startsWith('image/')) {
        const visionPrompt = `Analyze this image for marketplace upload. Provide:
1. Suggested title (creative and descriptive)
2. Detailed description (2-3 sentences)
3. Category (art/photo/design)
4. 3-5 relevant tags
5. Suggested pricing in Solar (0.001-0.01 range based on quality and complexity)

Format your response as JSON.`;

        const visionResult = await this.processImageWithVision(fileData.buffer, visionPrompt);
        analysisText = visionResult.text;
        
        const match = analysisText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            return {
              success: true,
              suggestions: {
                title: parsed.title || fileName.replace(/\.[^/.]+$/, ''),
                description: parsed.description || 'High-quality artwork',
                category: parsed.category || 'art',
                tags: parsed.tags || [],
                price: parsed.price || 0.005
              },
              fileInfo: {
                name: fileName,
                type: fileType,
                category: 'image'
              }
            };
          } catch (e) {
            console.warn('Failed to parse Vision JSON, using text analysis');
          }
        }
        
        category = 'art';
        suggestedPrice = 0.005;

      } else if (fileType.startsWith('audio/')) {
        category = 'music';
        suggestedPrice = 0.002;
        analysisText = 'Audio file detected. Suggested category: Music';

      } else if (fileType.startsWith('video/')) {
        category = 'video';
        suggestedPrice = 0.01;
        analysisText = 'Video file detected. Suggested category: Video';

      } else {
        category = 'document';
        suggestedPrice = 0.001;
        analysisText = 'Document file detected';
      }

      const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      return {
        success: true,
        suggestions: {
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          description: `${category.charAt(0).toUpperCase() + category.slice(1)} file: ${fileName}`,
          category: category,
          tags: [category, 'upload'],
          price: suggestedPrice
        },
        fileInfo: {
          name: fileName,
          type: fileType,
          category: category
        },
        analysis: analysisText
      };

    } catch (error) {
      console.error('Error analyzing artifact:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Provide upload guidance
   */
  async getUploadGuidance(fileType = null) {
    const guidance = {
      success: true,
      general: {
        steps: [
          'Go to the Upload tab in the marketplace',
          'Select your file (drag & drop or browse)',
          'Add a catchy title and description',
          'Choose the right category',
          'Set your Solar price (or let AI suggest)',
          'Submit for review'
        ],
        tips: [
          'Use clear, descriptive titles',
          'Add relevant tags for better discovery',
          'High-quality files get more attention',
          'Pricing is based on file size and content value'
        ]
      },
      limits: {
        music: { maxSize: '50MB', formats: 'MP3, WAV, FLAC, OGG', suggestedPrice: '0.001-0.005 Solar' },
        video: { maxSize: '500MB', formats: 'MP4, WEBM, MOV', suggestedPrice: '0.005-0.02 Solar' },
        art: { maxSize: '25MB', formats: 'JPG, PNG, GIF, WEBP, SVG', suggestedPrice: '0.002-0.01 Solar' },
        document: { maxSize: '5MB', formats: 'PDF, TXT, DOC, DOCX', suggestedPrice: '0.001-0.003 Solar' }
      }
    };

    if (fileType) {
      const type = fileType.toLowerCase();
      if (guidance.limits[type]) {
        guidance.specific = guidance.limits[type];
      }
    }

    return guidance;
  }

  /**
   * Check user's uploads and their status
   */
  async checkMyUploads(memberId) {
    const pool = getSharedPool();
    if (!pool) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      const result = await pool.query(
        `SELECT id, title, category, solar_amount_s, active, created_at, processing_status
         FROM artifacts 
         WHERE creator_id = $1 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [memberId.toString()]
      );

      const uploads = result.rows.map(artifact => ({
        id: artifact.id,
        title: artifact.title,
        category: artifact.category,
        price: parseFloat(artifact.solar_amount_s || '0'),
        status: artifact.active ? 'approved' : 'pending review',
        processingStatus: artifact.processing_status || 'completed',
        uploadedAt: artifact.created_at
      }));

      const stats = {
        total: uploads.length,
        approved: uploads.filter(u => u.status === 'approved').length,
        pending: uploads.filter(u => u.status === 'pending review').length
      };

      return {
        success: true,
        uploads: uploads,
        stats: stats
      };

    } catch (error) {
      console.error('Error checking uploads:', error);
      return { success: false, error: error.message };
    }
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
        walletData: response.data,
        functionCalled: response.functionCalled,
        functionArgs: response.functionArgs
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
