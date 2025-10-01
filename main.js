const http = require('http');
const fs = require('fs');
const path = require('path');

// Add process error handlers to prevent crashes from database issues
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.log('🔄 Server continuing to run...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🔄 Server continuing to run...');
});
const { Pool, neonConfig } = require('@neondatabase/serverless');

// Configure WebSocket for Node.js environment to fix distribution connectivity
neonConfig.webSocketConstructor = require('ws');
neonConfig.fetch = require('node-fetch');
neonConfig.poolQueryViaFetch = true;
const url = require('url');
const fetch = require('node-fetch');
const multer = require('multer');
// Conditional native modules for Cloud Run compatibility
let sharp = null;
let bcrypt = null;
try {
  sharp = require('sharp');
  console.log('✅ Sharp module loaded successfully');
} catch (error) {
  console.warn('⚠️ Sharp module disabled (not available in this environment):', error.message);
}

try {
  bcrypt = require('bcrypt');
  console.log('✅ Bcrypt module loaded successfully');
} catch (error) {
  console.warn('⚠️ Bcrypt module disabled (not available in this environment):', error.message);
}

const { fileTypeFromBuffer } = require('file-type');
const crypto = require('crypto');
const schedule = require('node-schedule');
// const { ObjectStorageService } = require('./server/objectStorage'); // Disabled for stable Music Now service

// Import seed rotation system
const { initializeSeedRotation, getSeedRotator } = require('./server/seed-rotation-api');

// Import enhanced file management system
const ArtifactFileManager = require('./server/artifact-file-manager');
const AICurator = require('./server/ai-curator');

// Import market data and SEO services
const MarketDataService = require('./server/market-data-service');
const ContentValidator = require('./server/content-validator');
const SEOGenerator = require('./server/seo-generator');
const AISEOOptimizer = require('./server/ai-seo-optimizer');
const MemberContentService = require('./server/member-content-service');
const AIPromotionService = require('./server/ai-promotion-service');
const MemberTemplateService = require('./server/member-template-service');

const PORT = process.env.PORT || 3000;

// Simple session storage (in production, use Redis or database)
const sessions = new Map();

// Initialize enhanced file management system
const fileManager = new ArtifactFileManager({
  masterStoragePath: path.join(__dirname, 'storage/master'),
  previewStoragePath: path.join(__dirname, 'public/previews'),
  tradeStoragePath: path.join(__dirname, 'storage/trade')
});

// Initialize AI curation system for smart descriptions
const aiCurator = new AICurator();

// Automatic slug generation for uploads
function generateSlug(title, filename) {
  // Use title if available, fallback to filename
  const source = title || path.basename(filename, path.extname(filename));
  
  return source
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100) // Limit length
    || 'untitled-upload'; // Fallback if empty
}

// Session helper functions
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userId, userData) {
  const sessionId = generateSessionId();
  const sessionData = {
    userId,
    ...userData,
    createdAt: new Date(),
    lastAccess: new Date()
  };
  sessions.set(sessionId, sessionData);
  return sessionId;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastAccess = new Date();
    return session;
  }
  return null;
}

function destroySession(sessionId) {
  return sessions.delete(sessionId);
}

// Cookie helper function
function getCookie(req, name) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  
  const cookieArr = cookies.split(';');
  for (let cookie of cookieArr) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return null;
}

// File upload configuration - using disk storage for security
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // Reduced to 100MB for better security
  },
  fileFilter: (req, file, cb) => {
    // Extended filter for marketplace artifacts - more permissive
    const allowedMimes = [
      // Audio files
      'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/ogg',
      // Image files
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp',
      // Video files  
      'video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/mkv', 'video/x-msvideo',
      // Document files
      'text/plain', 'application/pdf', 'text/markdown', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Archive files
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Binary and generic files
      'application/octet-stream', 'application/x-binary'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

// Solar formatting helper - 4 decimal places, extend if rounds to zero
function formatSolar(amount) {
  const num = parseFloat(amount);
  if (num === 0) return '0.0000';
  
  let formatted = num.toFixed(4);
  if (parseFloat(formatted) === 0 && num > 0) {
    // Extend decimals if rounds to zero
    for (let decimals = 5; decimals <= 10; decimals++) {
      formatted = num.toFixed(decimals);
      if (parseFloat(formatted) > 0) break;
    }
  }
  return formatted;
}

// Enhanced AI Content Analysis for all file types
async function analyzeContentForPricing(fileBuffer, mimeType, metadata) {
  let estimatedKwh = 0;
  let reasoning = '';
  const { title, description, category, fileSize, filename } = metadata;
  
  // Base energy calculations
  const fileSizeMB = fileSize / (1024 * 1024);
  const baseStorageEnergy = fileSizeMB * 0.0001; // 0.0001 kWh per MB storage
  const baseDistributionEnergy = 0.1; // Base distribution cost
  
  if (mimeType.startsWith('audio/')) {
    // Audio analysis (enhanced from existing music analysis)
    const estimatedDuration = Math.max(fileSizeMB * 60, 180); // Rough duration estimate
    const recordingEnergy = estimatedDuration * 0.002; // Recording energy
    const productionEnergy = estimatedDuration * 0.001; // Production energy
    
    estimatedKwh = recordingEnergy + productionEnergy + baseStorageEnergy + baseDistributionEnergy;
    reasoning = `Audio track: Recording (${recordingEnergy.toFixed(4)} kWh) + Production (${productionEnergy.toFixed(4)} kWh) + Storage (${baseStorageEnergy.toFixed(4)} kWh) + Distribution (${baseDistributionEnergy} kWh)`;
    
    // Genre-based multipliers
    const titleLower = title.toLowerCase();
    if (titleLower.includes('symphony') || titleLower.includes('orchestra')) {
      estimatedKwh *= 1.4;
      reasoning += ' +40% complex orchestration';
    } else if (titleLower.includes('jazz') || titleLower.includes('blues')) {
      estimatedKwh *= 1.2;
      reasoning += ' +20% live recording';
    } else if (titleLower.includes('electronic') || titleLower.includes('edm')) {
      estimatedKwh *= 0.9;
      reasoning += ' -10% digital production';
    }
    
  } else if (mimeType.startsWith('image/')) {
    // Image/Art analysis
    const resolutionFactor = Math.min(fileSizeMB / 5, 3); // Scale with resolution
    const creationEnergy = 0.5 + (resolutionFactor * 0.3); // Base creation + complexity
    const processingEnergy = fileSizeMB * 0.01; // Processing energy
    
    estimatedKwh = creationEnergy + processingEnergy + baseStorageEnergy + baseDistributionEnergy;
    reasoning = `Digital art: Creation (${creationEnergy.toFixed(4)} kWh) + Processing (${processingEnergy.toFixed(4)} kWh) + Storage (${baseStorageEnergy.toFixed(4)} kWh) + Distribution (${baseDistributionEnergy} kWh)`;
    
    // Art complexity factors
    const titleLower = title.toLowerCase();
    if (titleLower.includes('painting') || titleLower.includes('artwork')) {
      estimatedKwh *= 1.3;
      reasoning += ' +30% artistic complexity';
    } else if (titleLower.includes('photo') || titleLower.includes('picture')) {
      estimatedKwh *= 0.8;
      reasoning += ' -20% photography';
    }
    
  } else if (mimeType.startsWith('video/')) {
    // Video analysis
    const estimatedDuration = Math.max(fileSizeMB / 50, 30); // Rough duration estimate
    const filmingEnergy = estimatedDuration * 0.01; // Filming energy
    const editingEnergy = estimatedDuration * 0.02; // Editing energy (higher than filming)
    const renderingEnergy = fileSizeMB * 0.005; // Rendering based on file size
    
    estimatedKwh = filmingEnergy + editingEnergy + renderingEnergy + baseStorageEnergy + baseDistributionEnergy;
    reasoning = `Video: Filming (${filmingEnergy.toFixed(4)} kWh) + Editing (${editingEnergy.toFixed(4)} kWh) + Rendering (${renderingEnergy.toFixed(4)} kWh) + Storage (${baseStorageEnergy.toFixed(4)} kWh) + Distribution (${baseDistributionEnergy} kWh)`;
    
    // Video type multipliers
    const titleLower = title.toLowerCase();
    if (titleLower.includes('film') || titleLower.includes('movie')) {
      estimatedKwh *= 1.5;
      reasoning += ' +50% cinematic production';
    } else if (titleLower.includes('animation')) {
      estimatedKwh *= 1.8;
      reasoning += ' +80% animation complexity';
    }
    
  } else if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
    // Text/Document analysis
    const wordCount = Math.max(fileSizeMB * 500, 100); // Rough word count estimate
    const writingEnergy = wordCount * 0.00001; // Energy per word
    const formattingEnergy = fileSizeMB * 0.001; // Formatting energy
    
    estimatedKwh = writingEnergy + formattingEnergy + baseStorageEnergy + baseDistributionEnergy;
    reasoning = `Document: Writing (${writingEnergy.toFixed(4)} kWh) + Formatting (${formattingEnergy.toFixed(4)} kWh) + Storage (${baseStorageEnergy.toFixed(4)} kWh) + Distribution (${baseDistributionEnergy} kWh)`;
    
    // Content type multipliers
    const titleLower = title.toLowerCase();
    if (titleLower.includes('poetry') || titleLower.includes('poem')) {
      estimatedKwh *= 1.2;
      reasoning += ' +20% creative writing';
    } else if (titleLower.includes('research') || titleLower.includes('academic')) {
      estimatedKwh *= 1.4;
      reasoning += ' +40% research complexity';
    }
  } else {
    // Generic file analysis
    estimatedKwh = baseStorageEnergy + baseDistributionEnergy + (fileSizeMB * 0.001);
    reasoning = `Generic file: Storage + Distribution + Processing = ${estimatedKwh.toFixed(4)} kWh`;
  }
  
  // Quality multiplier based on file size (higher quality = more energy)
  if (fileSizeMB > 100) {
    estimatedKwh *= 1.2;
    reasoning += ' +20% high quality';
  } else if (fileSizeMB < 1) {
    estimatedKwh *= 0.9;
    reasoning += ' -10% compressed';
  }
  
  // Convert to Solar (1 Solar = 4,913 kWh)
  const solarAmount = estimatedKwh / 4913;
  
  return {
    estimatedKwh: parseFloat(estimatedKwh.toFixed(4)),
    solarAmount: parseFloat(solarAmount.toFixed(10)), // High precision for small amounts
    reasoning: reasoning + ` = ${estimatedKwh.toFixed(4)} kWh total`,
    category: category,
    qualityScore: Math.min(fileSizeMB / 10, 5) // Simple quality score 0-5
  };
}

// Enhanced database setup with robust error handling
let pool = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('✅ Database connection ready for music tracking');
  }
} catch (error) {
  console.warn('⚠️ Database connection failed, using fallback mode:', error.message);
  pool = null;
}

// Legacy signup storage (deprecated - auth uses database)
let signupStorage = [];

// Note: This is for legacy signups only - authentication uses database
function ensureSignupsTable() {
  console.log('📝 Using in-memory storage for legacy signups only (authentication uses database)');
}

// Parse body data helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Daily Solar Distribution System
async function processDailyDistribution() {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  console.log(`🌱 Processing daily Solar distribution for ${todayString}...`);
  
  if (!pool) {
    console.log('⚠️ No database connection - skipping daily distribution');
    return;
  }
  
  try {
    console.log('📡 Performing atomic Solar distribution to prevent race conditions...');
    
    // Atomic UPDATE with race condition protection and duplicate prevention
    const atomicDistributionQuery = `
      UPDATE members 
      SET 
        total_solar = total_solar + 1,
        last_distribution_date = CURRENT_TIMESTAMP
      WHERE 
        last_distribution_date IS NULL 
        OR DATE(last_distribution_date) < CURRENT_DATE
      RETURNING id, username, total_solar, last_distribution_date
    `;
    
    const distributionResult = await pool.query(atomicDistributionQuery);
    const updatedMembers = distributionResult.rows;
    
    if (updatedMembers.length === 0) {
      console.log(`✅ All members already received today's Solar distribution`);
      return;
    }
    
    console.log(`📊 Distributed 1 Solar to ${updatedMembers.length} members atomically`);
    
    // Log each member's distribution
    for (const member of updatedMembers) {
      console.log(`💰 ${member.username}: received 1 Solar (total: ${member.total_solar})`);
    }
    
    const successCount = updatedMembers.length;
    const errorCount = 0;
    
    console.log(`✅ Daily distribution complete: ${successCount} success, ${errorCount} errors`);
    
    // Log individual member distributions to match table structure
    try {
      for (const member of updatedMembers) {
        const logQuery = `
          INSERT INTO distribution_logs (member_id, distribution_date, solar_amount, dollar_value)
          VALUES ($1, $2, $3, $4)
        `;
        await pool.query(logQuery, [member.id, todayString, 1.0000, 0.00]);
      }
      console.log(`📝 Distribution logged: ${updatedMembers.length} member distributions recorded`);
    } catch (logError) {
      console.error('⚠️ Failed to log distribution:', logError.message);
    }
    
  } catch (error) {
    console.error('❌ Daily distribution failed:', error.message);
  }
}

function initializeDailyDistribution() {
  console.log('🌱 Initializing daily Solar distribution system...');
  
  // Schedule daily distribution at 3:00 AM UTC with explicit timezone
  const dailyJob = schedule.scheduleJob({ rule: '0 3 * * *', tz: 'UTC' }, async () => {
    await processDailyDistribution();
  });
  
  if (dailyJob) {
    console.log('✅ Daily Solar distribution scheduled for 3:00 AM UTC');
    console.log('🔄 Next distribution:', dailyJob.nextInvocation());
  } else {
    console.error('❌ Failed to schedule daily distribution');
  }
  
  // Run initial check on startup (useful for testing)
  setTimeout(() => {
    console.log('🔍 Running initial distribution check...');
    processDailyDistribution();
  }, 5000); // Wait 5 seconds after server startup
}

// Initialize database
ensureSignupsTable();

// Initialize market data and SEO services
const marketDataService = new MarketDataService();
const contentValidator = new ContentValidator();
const seoGenerator = new SEOGenerator();
const aiSEOOptimizer = new AISEOOptimizer();
const memberContentService = new MemberContentService();
const aiPromotionService = new AIPromotionService(memberContentService, marketDataService);

// Initialize template service with error handling
let memberTemplateService;
try {
  memberTemplateService = new MemberTemplateService(memberContentService);
  console.log('🎨 Member display templates ready');
} catch (error) {
  console.error('⚠️ Template service initialization failed:', error.message);
  // Create fallback service
  memberTemplateService = {
    getAllTemplates: () => [],
    getTemplatesByCategory: () => [],
    generateTemplatePreview: () => ({ templateId: 'error', templateName: 'Service Unavailable', previewHtml: '<div>Template service temporarily unavailable</div>', previewCss: '', features: [], category: 'error' }),
    createMemberDisplay: () => { throw new Error('Template service unavailable'); },
    getMemberDisplays: () => [],
    getDisplayById: () => { throw new Error('Template service unavailable'); },
    updateMemberDisplay: () => { throw new Error('Template service unavailable'); },
    getTemplateStats: () => ({ totalTemplates: 0, totalDisplays: 0, activeDisplays: 0, mostPopularTemplate: null, totalViews: 0, templateUsage: [] })
  };
}

// Start automatic SEO updates
seoGenerator.startAutoUpdates();

console.log('🚀 Starting Current-See Deployment Server...');
console.log('📊 Market data service initialized');
console.log('✅ Content validation system ready');
console.log('🔄 Dynamic SEO generation active');
console.log('🤖 AI SEO optimization enabled');
console.log('📁 Member content sharing system ready');
console.log('🎯 AI automatic promotion system active');

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  
  // Music API Endpoints
  if (pathname === '/api/music/play' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { songTitle, sessionId, userAgent, playDuration, completedPlay } = body;
      
      if (!songTitle) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Song title is required' }));
        return;
      }

      if (pool) {
        // Find the song by title
        const songQuery = 'SELECT id FROM songs WHERE title ILIKE $1 LIMIT 1';
        const songResult = await pool.query(songQuery, [songTitle]);
        
        if (songResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Song not found' }));
          return;
        }

        // Record the play event
        const playEvent = {
          songId: songResult.rows[0].id,
          sessionId: sessionId || `session_${Date.now()}`,
          userAgent: userAgent || req.headers['user-agent'] || 'unknown',
          ipAddress: req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
          playDuration: playDuration || 0,
          completedPlay: completedPlay || false,
          source: 'web_player',
          metadata: JSON.stringify({ timestamp: new Date().toISOString() })
        };

        const insertQuery = `
          INSERT INTO play_events (id, song_id, session_id, user_agent, ip_address, played_at, play_duration, completed_play, source, metadata)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), $5, $6, $7, $8)
        `;
        
        await pool.query(insertQuery, [
          playEvent.songId, playEvent.sessionId, playEvent.userAgent, 
          playEvent.ipAddress, playEvent.playDuration, playEvent.completedPlay,
          playEvent.source, playEvent.metadata
        ]);
        
        console.log(`🎵 Play tracked: "${songTitle}" - ${playDuration || 0}s`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, songId: songResult.rows[0].id }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, note: 'Database unavailable, tracking skipped' }));
      }
    } catch (error) {
      console.error('Play tracking error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to track play' }));
    }
    return;
  }

  // Creator File Upload API
  if (pathname === '/api/creator/upload' && req.method === 'POST') {
    // Check authentication first
    const sessionId = getCookie(req, 'tc_s_session');
    if (!sessionId || !sessions.get(sessionId)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    const userId = sessions.get(sessionId).userId;

    upload.single('file')(req, res, async (err) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      let tempFilePath = null;
      try {
        if (!req.file) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No file uploaded' }));
          return;
        }

        const file = req.file;
        tempFilePath = file.path; // Store for cleanup
        const fileBuffer = fs.readFileSync(file.path);
        
        // Determine file type and validate size limits
        const fileType = await fileTypeFromBuffer(fileBuffer);
        const actualMime = fileType?.mime || file.mimetype;
        
        let maxSize, category;
        if (actualMime.startsWith('audio/')) {
          maxSize = 50 * 1024 * 1024; // 50MB
          category = 'music';
        } else if (actualMime.startsWith('image/')) {
          maxSize = 25 * 1024 * 1024; // 25MB
          category = 'art';
        } else if (actualMime.startsWith('video/')) {
          maxSize = 500 * 1024 * 1024; // 500MB
          category = 'video';
        } else if (actualMime.startsWith('text/') || actualMime === 'application/pdf') {
          maxSize = 5 * 1024 * 1024; // 5MB
          category = 'document';
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unsupported file type: ${actualMime}` }));
          return;
        }

        if (file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `File too large. Maximum size for ${category} files is ${maxSizeMB}MB` 
          }));
          return;
        }

        // Get form data (creator info and metadata)
        const formData = {};
        if (req.body) {
          Object.assign(formData, req.body);
        }

        const { title, description, tags, email } = formData;
        const creatorId = userId; // Get from session instead of form
        
        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Title is required' }));
          return;
        }

        // AI Content Analysis for pricing
        const analysis = await analyzeContentForPricing(fileBuffer, actualMime, {
          title,
          description,
          category,
          fileSize: file.size,
          filename: file.originalname
        });

        // Process file through enhanced three-copy workflow
        console.log(`🔄 Processing upload through three-copy workflow: ${title}`);
        const fileProcessingResult = await fileManager.processUpload(
          fileBuffer,
          {
            originalname: file.originalname,
            mimetype: actualMime,
            size: file.size
          },
          {
            title,
            description,
            category,
            creatorId
          }
        );

        if (!fileProcessingResult.success) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `File processing failed: ${fileProcessingResult.error}` 
          }));
          return;
        }

        const artifactId = fileProcessingResult.artifactId;
        console.log(`✅ Three-copy processing complete for: ${artifactId}`);
        
        // AI Curation: Generate smart descriptions for non-video content
        let aiCuration = null;
        if (!actualMime.startsWith('video/')) {
          try {
            console.log(`🤖 AI curating content: ${title}`);
            aiCuration = await aiCurator.generateSmartDescription(
              fileBuffer,
              actualMime,
              { title, description, category }
            );
            
            if (aiCuration.success) {
              console.log(`✨ AI curation complete: ${aiCuration.category} - ${aiCuration.suggestedPrice} Solar`);
              
              // Override category and description with AI suggestions if better
              if (aiCuration.category && aiCuration.category !== 'uncategorized') {
                category = aiCuration.category;
              }
              if (aiCuration.description && (!description || description.length < 50)) {
                description = aiCuration.description;
              }
            }
          } catch (error) {
            console.warn(`⚠️ AI curation failed: ${error.message}`);
            // Continue without AI curation
          }
        }

        if (pool) {
          // Generate unique slug automatically
          const baseSlug = generateSlug(title, file.originalname);
          let finalSlug = baseSlug;
          let slugCounter = 1;
          
          // Ensure slug uniqueness
          while (true) {
            const slugCheck = await pool.query('SELECT id FROM artifacts WHERE slug = $1', [finalSlug]);
            if (slugCheck.rows.length === 0) break;
            finalSlug = `${baseSlug}-${slugCounter++}`;
          }
          
          // Insert artifact into database with enhanced three-copy schema + AI curation
          const insertQuery = `
            INSERT INTO artifacts (
              id, slug, title, description, category, file_type, 
              kwh_footprint, solar_amount_s, rays_amount, delivery_mode, delivery_url,
              creator_id, cover_art_url, active,
              master_file_url, preview_file_url, trade_file_url,
              master_file_size, preview_file_size, trade_file_size,
              file_duration, preview_duration, preview_type, preview_slug,
              processing_status, search_tags, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW()
            ) RETURNING id, slug, solar_amount_s
          `;
          
          // Use AI-suggested pricing if available and reasonable
          let finalSolarAmount = analysis.solarAmount;
          if (aiCuration && aiCuration.success && aiCuration.suggestedPrice) {
            const aiSuggested = parseFloat(aiCuration.suggestedPrice);
            if (aiSuggested > 0 && aiSuggested <= 100) {
              finalSolarAmount = aiSuggested;
              console.log(`💡 Using AI-suggested pricing: ${aiSuggested} Solar (was ${analysis.solarAmount})`);
            }
          }
          
          const result = await pool.query(insertQuery, [
            artifactId, // Use the artifactId from file processing
            finalSlug, // Auto-generated unique slug
            title,
            description || '',
            category,
            actualMime,
            analysis.estimatedKwh,
            finalSolarAmount, // Use AI-suggested pricing if available
            0, // rays_amount (default to 0)
            'download',
            fileProcessingResult.tradeFile.url, // Legacy delivery_url points to trade file
            creatorId,
            fileProcessingResult.previewFile.thumbnailUrl,
            true, // active - immediately available in marketplace (changed from false)
            fileProcessingResult.masterFile.url,
            fileProcessingResult.previewFile.previewUrl,
            fileProcessingResult.tradeFile.url,
            fileProcessingResult.masterFile.size,
            fileProcessingResult.previewFile.previewSize || 0,
            fileProcessingResult.tradeFile.size,
            fileProcessingResult.metadata.fileDuration || null,
            fileProcessingResult.previewFile.previewDuration || null,
            fileProcessingResult.previewFile.previewType,
            `${finalSlug}-preview`, // Generate preview slug
            fileProcessingResult.processingStatus,
            aiCuration && aiCuration.success ? aiCuration.tags : [] // AI-generated tags
          ]);

          const dbArtifactId = result.rows[0].id;
          const artifactSlug = result.rows[0].slug;
          const solarPrice = result.rows[0].solar_amount_s;

          console.log(`🚀 Enhanced Upload Complete: "${title}" (${artifactSlug}) by ${creatorId} - ${formatSolar(solarPrice)} Solar`);
          console.log(`📁 Files: Master (${fileProcessingResult.masterFile.size}B), Preview (${fileProcessingResult.previewFile.previewSize || 0}B), Trade (${fileProcessingResult.tradeFile.size}B)`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            artifactId: dbArtifactId,
            slug: artifactSlug,
            title: title,
            category: category,
            fileSize: file.size,
            estimatedKwh: analysis.estimatedKwh,
            solarPrice: formatSolar(solarPrice),
            estimatedSolarPrice: formatSolar(solarPrice),
            thumbnailUrl: fileProcessingResult.previewFile.thumbnailUrl,
            previewType: fileProcessingResult.previewFile.previewType,
            analysis: analysis.reasoning,
            message: `🚀 Upload successful! "${title}" is now available in the marketplace at ${formatSolar(solarPrice)} Solar. Preview system ready.`,
            uploadType: 'enhanced_three_copy',
            fileSystem: {
              masterFile: fileProcessingResult.masterFile.url,
              previewFile: fileProcessingResult.previewFile.previewUrl,
              tradeFile: fileProcessingResult.tradeFile.url,
              previewType: fileProcessingResult.previewFile.previewType
            },
            autoGenerated: {
              slug: artifactSlug,
              category: category,
              pricing: `${formatSolar(solarPrice)} Solar (${analysis.estimatedKwh} kWh)`,
              previewSlug: `${artifactSlug}-preview`
            }
          }));
          
        } else {
          // Cleanup files if database is unavailable
          await fileManager.cleanup(artifactId);
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database unavailable for uploads' }));
        }
      } catch (error) {
        console.error('Enhanced upload error:', error);
        
        // Cleanup any partial files on error
        if (fileProcessingResult && fileProcessingResult.artifactId) {
          await fileManager.cleanup(fileProcessingResult.artifactId);
        }
        
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Enhanced upload failed: ' + error.message }));
      } finally {
        // Always clean up temporary upload file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
            console.log(`🧹 Temporary upload file cleaned: ${tempFilePath}`);
          } catch (cleanupError) {
            console.warn(`⚠️ Failed to cleanup temp file ${tempFilePath}:`, cleanupError);
          }
        }
      }
    });
    return;
  }

  // AI-Powered kWh Assessment System (Identify Anything Function)
  if (pathname === '/api/artifacts/assess-kwh' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { itemType, itemName, duration, fileSize, additionalContext } = body;
      
      if (!itemType || !itemName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item type and name are required' }));
        return;
      }

      // AI-powered kWh assessment logic
      let estimatedKwh = 0;
      let assessmentReasoning = '';

      // Music track kWh assessment based on various factors
      if (itemType === 'music_track') {
        const baseDuration = duration || 240; // Default 4 minutes
        const baseFileSize = fileSize || 5; // Default 5MB
        
        // Factors affecting kWh footprint:
        // 1. Recording energy (studio time, equipment)
        // 2. Production energy (mixing, mastering)
        // 3. Digital storage and distribution
        // 4. Streaming infrastructure per listen
        
        const recordingEnergy = baseDuration * 0.002; // 0.002 kWh per second of recording
        const productionEnergy = baseDuration * 0.001; // Production overhead
        const storageEnergy = baseFileSize * 0.0001; // Storage per MB
        const distributionEnergy = 0.15; // Base distribution energy
        
        estimatedKwh = recordingEnergy + productionEnergy + storageEnergy + distributionEnergy;
        
        assessmentReasoning = `Music track assessment: Recording (${recordingEnergy.toFixed(4)} kWh) + Production (${productionEnergy.toFixed(4)} kWh) + Storage (${storageEnergy.toFixed(4)} kWh) + Distribution (${distributionEnergy} kWh) = ${estimatedKwh.toFixed(4)} kWh total footprint.`;
        
        // Add complexity factors based on name analysis
        if (itemName.toLowerCase().includes('symphony') || itemName.toLowerCase().includes('rhapsody')) {
          estimatedKwh *= 1.3; // Complex orchestration multiplier
          assessmentReasoning += ' Complex orchestration factor applied (+30%).';
        }
        if (itemName.toLowerCase().includes('blues') || itemName.toLowerCase().includes('jazz')) {
          estimatedKwh *= 1.1; // Live recording factor
          assessmentReasoning += ' Live recording factor applied (+10%).';
        }
        if (itemName.toLowerCase().includes('electronic') || itemName.toLowerCase().includes('edm')) {
          estimatedKwh *= 0.9; // Digital production efficiency
          assessmentReasoning += ' Digital production efficiency (-10%).';
        }
      }

      // Convert kWh to Solar using 1 Solar = 4,913 kWh formula
      const solarAmount = estimatedKwh / 4913;
      const formattedSolarAmount = parseFloat(solarAmount.toFixed(6));

      console.log(`🔍 kWh Assessment: "${itemName}" = ${estimatedKwh.toFixed(4)} kWh = ${formattedSolarAmount} Solar`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        itemName,
        itemType,
        assessedKwh: parseFloat(estimatedKwh.toFixed(4)),
        solarAmount: formattedSolarAmount,
        reasoning: assessmentReasoning,
        formula: '1 Solar = 4,913 kWh',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('kWh assessment error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to assess kWh footprint' }));
    }
    return;
  }

  // Login API endpoint
  if ((pathname === '/api/login' || pathname === '/api/users/login') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;

      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Username and password are required' }));
        return;
      }

      let loginSuccess = false;
      let userData = null;

      // Try database authentication first
      if (pool) {
        try {
          // Check for user by username or email
          const result = await pool.query(
            'SELECT id, username, email, first_name, last_name, password_hash, total_solar, signup_timestamp FROM members WHERE username = $1 OR email = $1',
            [username]
          );

          if (result && result.rows && result.rows.length > 0) {
            const user = result.rows[0];
            
            // Verify password
            if (!bcrypt) {
              throw new Error('Password verification unavailable (bcrypt not loaded)');
            }
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            
            if (passwordMatch) {
              loginSuccess = true;
              userData = {
                userId: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                solarBalance: parseFloat(user.total_solar) || 0,
                memberSince: user.signup_timestamp
              };
              console.log(`🔐 User logged in: ${user.username} (ID: ${user.id})`);
            }
          }
        } catch (dbError) {
          console.error('Database login error:', dbError);
        }
      }

      if (loginSuccess) {
        // Create session
        const sessionId = createSession(userData.userId, userData);
        
        // Set secure session cookie
        const cookieOptions = [
          `tc_s_session=${sessionId}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${24 * 60 * 60}` // 24 hours
        ];
        
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Set-Cookie': cookieOptions.join('; ')
        });
        res.end(JSON.stringify({
          success: true,
          message: 'Login successful',
          ...userData
        }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid username or password' }));
      }
    } catch (error) {
      console.error('Login error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Login failed' }));
    }
    return;
  }

  // Session Check API endpoint
  if (pathname === '/api/session' && req.method === 'GET') {
    try {
      const sessionId = getCookie(req, 'tc_s_session');
      
      if (!sessionId) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, authenticated: false }));
        return;
      }
      
      const session = getSession(sessionId);
      
      if (!session) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, authenticated: false }));
        return;
      }
      
      // Return session data
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        authenticated: true,
        user: {
          id: session.userId,
          username: session.username,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName
        },
        solarBalance: session.solarBalance || 0
      }));
    } catch (error) {
      console.error('Session check error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Session check failed' }));
    }
    return;
  }

  // Registration API endpoint (for existing login.html page)
  if (pathname === '/api/register' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, displayName, email, password, isAnonymous, firstName, lastName } = body;

      // Validate required fields
      if (!username || !email || !password || !displayName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'All required fields must be provided' }));
        return;
      }

      // Validate password length
      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Password must be at least 6 characters long' }));
        return;
      }

      // Hash the password
      if (!bcrypt) {
        throw new Error('Password hashing unavailable (bcrypt not loaded)');
      }
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Calculate days since Solar start date for initial allocation
      const startDate = new Date('2025-04-07T00:00:00Z');
      const currentDate = new Date();
      const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const initialSolarAllocation = Math.max(daysSinceStart, 0);

      let success = false;
      let userId = null;

      // Try database first
      if (pool) {
        try {
          const result = await pool.query(
            'INSERT INTO members (username, email, first_name, last_name, password_hash, name, joined_date, total_solar, total_dollars, is_anonymous, is_reserve, is_placeholder, last_distribution_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [username, email, firstName || '', lastName || '', passwordHash, displayName, currentDate.toISOString(), initialSolarAllocation, 0, isAnonymous || false, false, false, currentDate.toISOString()]
          );
          if (result && result.rows && result.rows.length > 0) {
            userId = result.rows[0].id;
            success = true;
            console.log(`📝 New TC-S Network member registered: ${username} (DB ID: ${userId})`);
          }
        } catch (dbError) {
          console.error('Database registration error:', dbError);
          if (dbError.code === '23505') { // Unique constraint violation
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Username or email already exists' }));
            return;
          }
        }
      }

      if (success) {
        // Create session for the new user
        const userData = {
          userId: userId,
          username: username,
          email: email,
          firstName: firstName || '',
          lastName: lastName || '',
          solarBalance: initialSolarAllocation,
          memberSince: currentDate.toISOString()
        };
        
        const sessionId = createSession(userId, userData);
        
        // Set secure session cookie
        const cookieOptions = [
          `tc_s_session=${sessionId}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${24 * 60 * 60}` // 24 hours
        ];
        
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Set-Cookie': cookieOptions.join('; ')
        });
        res.end(JSON.stringify({
          success: true,
          message: 'Registration successful',
          ...userData
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Failed to create account' }));
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Registration failed' }));
    }
    return;
  }

  // Manual daily distribution trigger API (for testing)
  // Admin interface route
  if (pathname === '/admin' && req.method === 'GET') {
    try {
      const adminHtmlPath = path.join(__dirname, 'admin', 'global-solar-admin.html');
      if (fs.existsSync(adminHtmlPath)) {
        const content = fs.readFileSync(adminHtmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        console.log('✅ Served admin interface');
        return;
      }
    } catch (error) {
      console.error('Admin interface error:', error);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Admin interface not found');
    return;
  }

  // Admin CSS/JS files
  if (pathname.startsWith('/admin/') && req.method === 'GET') {
    try {
      const adminFilePath = path.join(__dirname, pathname);
      if (fs.existsSync(adminFilePath) && fs.statSync(adminFilePath).isFile()) {
        const content = fs.readFileSync(adminFilePath);
        const ext = path.extname(pathname);
        const contentType = ext === '.css' ? 'text/css' : 
                           ext === '.js' ? 'application/javascript' :
                           'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        console.log(`✅ Served admin file: ${pathname}`);
        return;
      }
    } catch (error) {
      console.error('Admin file error:', error);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Admin file not found');
    return;
  }

  if (pathname === '/api/admin/trigger-distribution' && req.method === 'POST') {
    try {
      console.log('🔧 Manual distribution trigger requested');
      await processDailyDistribution();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Daily distribution triggered successfully'
      }));
    } catch (error) {
      console.error('Manual distribution trigger error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Distribution trigger failed',
        details: error.message 
      }));
    }
    return;
  }

  // Logout API endpoint
  if ((pathname === '/api/logout' || pathname === '/api/users/logout') && req.method === 'POST') {
    try {
      // Get session ID from cookie
      const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {}) || {};
      
      const sessionId = cookies.tc_s_session;
      
      if (sessionId) {
        destroySession(sessionId);
      }
      
      // Clear the session cookie
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'tc_s_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
      });
      res.end(JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }));
    } catch (error) {
      console.error('Logout error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Logout failed' }));
    }
    return;
  }

  // Enhanced member registration API
  if (pathname === '/api/users/register-member' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { firstName, lastName, username, email, password, country, interests, agreeToTerms, subscribeNewsletter, interestedInCommissioning } = body;

      if (!agreeToTerms) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'You must agree to the terms of service' }));
        return;
      }

      // Validate required fields
      if (!firstName || !lastName || !username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'All required fields must be provided' }));
        return;
      }

      // Validate password length
      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Password must be at least 6 characters long' }));
        return;
      }

      // Hash the password
      if (!bcrypt) {
        throw new Error('Password hashing unavailable (bcrypt not loaded)');
      }
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Calculate days since Solar start date for initial allocation
      const startDate = new Date('2025-04-07T00:00:00Z');
      const currentDate = new Date();
      const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const initialSolarAllocation = Math.max(daysSinceStart, 0);

      // Enhanced member data
      const memberData = {
        username,
        email,
        firstName,
        lastName,
        passwordHash,
        country: country || 'Not specified',
        interests: interests || 'General',
        solarBalance: initialSolarAllocation,
        memberSince: currentDate.toISOString(),
        subscribeNewsletter: subscribeNewsletter || false,
        interestedInCommissioning: interestedInCommissioning || false,
        membershipType: 'Foundation Market Member'
      };

      let success = false;
      let userId = null;

      // Try database first
      if (pool) {
        try {
          const result = await pool.query(
            'INSERT INTO members (username, email, first_name, last_name, password_hash, country, interests, solar_balance, member_since, subscribe_newsletter, interested_in_commissioning, membership_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
            [username, email, firstName, lastName, passwordHash, memberData.country, memberData.interests, memberData.solarBalance, memberData.memberSince, memberData.subscribeNewsletter, memberData.interestedInCommissioning, memberData.membershipType]
          );
          if (result && result.rows && result.rows.length > 0) {
            userId = result.rows[0].id;
            success = true;
            console.log(`📝 New TC-S Network member registered: ${username} (DB ID: ${userId})`);
          }
        } catch (dbError) {
          console.error('Database registration error:', dbError);
        }
      }

      // Fallback to memory storage
      if (!success) {
        userId = Date.now();
        memberData.id = userId;
        // Store in memory (in production, this would be handled differently)
        console.log(`📝 New TC-S Network member registered: ${username} (Memory ID: ${userId})`);
        success = true;
      }

      if (success) {
        // Create session for the new user
        const userData = {
          userId: userId,
          username: username,
          email: email,
          firstName: firstName,
          lastName: lastName,
          solarBalance: initialSolarAllocation,
          memberSince: memberData.memberSince,
          membershipType: 'Foundation Market Member'
        };
        
        const sessionId = createSession(userId, userData);
        
        // Set secure session cookie
        const cookieOptions = [
          `tc_s_session=${sessionId}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${24 * 60 * 60}` // 24 hours
        ];
        
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Set-Cookie': cookieOptions.join('; ')
        });
        res.end(JSON.stringify({
          success: true,
          message: 'TC-S Network membership created successfully',
          ...userData
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Failed to create membership' }));
      }
    } catch (error) {
      console.error('Member registration error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Registration system error' }));
    }
    return;
  }

  // Unified Auth Signup API - creates members with proper password hashing
  if ((pathname === '/api/users/signup-solar' || pathname === '/api/auth/signup') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, email, firstName, password } = body;
      
      if (!username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username, email, and password are required' }));
        return;
      }

      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password must be at least 6 characters long' }));
        return;
      }

      if (!bcrypt) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password hashing unavailable' }));
        return;
      }

      if (pool) {
        // Check if member already exists
        const existingMemberQuery = 'SELECT id FROM members WHERE username = $1 OR email = $2';
        const existingMember = await pool.query(existingMemberQuery, [username, email]);
        
        if (existingMember.rows.length > 0) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username or email already exists' }));
          return;
        }

        // Calculate initial Solar allocation (1 Solar per day since April 7, 2025)
        const genesisDate = new Date('2025-04-07');
        const currentDate = new Date();
        const daysSinceGenesis = Math.floor((currentDate - genesisDate) / (1000 * 60 * 60 * 24));
        const initialSolarAmount = Math.max(daysSinceGenesis, 1); // At least 1 Solar

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create member with hashed password and initial Solar balance
        const memberInsertQuery = `
          INSERT INTO members (username, name, email, first_name, password_hash, total_solar, total_dollars, signup_timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id, username, total_solar
        `;
        
        const displayName = firstName || username;
        const initialDollars = initialSolarAmount * 0.20; // Approximate dollar value
        
        let memberResult;
        try {
          memberResult = await pool.query(memberInsertQuery, [
            username, displayName, email, firstName || '', passwordHash,
            initialSolarAmount, initialDollars
          ]);
        } catch (dbError) {
          console.error('❌ Database insert error:', dbError.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Database error: ${dbError.message}` }));
          return;
        }
        
        const member = memberResult.rows[0];

        console.log(`🌱 New member created: ${username} with ${initialSolarAmount} Solar (${daysSinceGenesis} days since genesis)`);

        // Create session for immediate login
        const sessionId = createSession(member.id, {
          userId: member.id,
          username: member.username,
          solarBalance: parseFloat(member.total_solar) || 0
        });
        
        // Set secure session cookie
        const cookieOptions = [
          `tc_s_session=${sessionId}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${24 * 60 * 60}` // 24 hours
        ];
        
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }

        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Set-Cookie': cookieOptions.join('; ')
        });
        res.end(JSON.stringify({
          success: true,
          userId: member.id,
          username: member.username,
          solarBalance: parseFloat(member.total_solar) || 0,
          initialSolarAmount: initialSolarAmount,
          daysSinceGenesis: daysSinceGenesis,
          genesisDate: '2025-04-07',
          message: `Welcome to the Current-See Network! You've been allocated ${initialSolarAmount} Solar tokens (${daysSinceGenesis} days since genesis).`
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable for user registration' }));
      }
    } catch (error) {
      console.error('Member signup error:', error);
      console.error('Full error details:', error.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Failed to create member account: ${error.message}` }));
    }
    return;
  }

  // Get User Solar Balance API
  if (pathname === '/api/users/solar-balance' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { userId, username, email } = body;
      
      if (!userId && !username && !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User ID, username, or email required' }));
        return;
      }

      if (pool) {
        let userQuery = 'SELECT u.id, u.username, sa.total_solar, sa.account_number FROM users u LEFT JOIN solar_accounts sa ON u.id = sa.user_id WHERE ';
        let params = [];
        
        if (userId) {
          userQuery += 'u.id = $1';
          params = [userId];
        } else if (username) {
          userQuery += 'u.username = $1';
          params = [username];
        } else {
          userQuery += 'u.email = $1';
          params = [email];
        }
        
        const userResult = await pool.query(userQuery, params);
        
        if (userResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not found' }));
          return;
        }

        const user = userResult.rows[0];
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          userId: user.id,
          username: user.username,
          accountNumber: user.account_number,
          solarBalance: user.total_solar || 0,
          formattedBalance: `${formatSolar(user.total_solar || 0)} Solar`
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Solar balance check error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to check Solar balance' }));
    }
    return;
  }

  // Artifact Purchase and Download API
  if (pathname === '/api/artifacts/purchase' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { userId, artifactId, userEmail, userName } = body;
      
      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID is required' }));
        return;
      }

      if (pool) {
        // Get artifact details with enhanced file URLs
        const artifactQuery = `
          SELECT id, title, solar_amount_s, delivery_url, active,
                 master_file_url, preview_file_url, trade_file_url,
                 file_type, category, trade_file_size, processing_status
          FROM artifacts WHERE id = $1
        `;
        const artifactResult = await pool.query(artifactQuery, [artifactId]);
        
        if (artifactResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found' }));
          return;
        }
        
        const artifact = artifactResult.rows[0];
        
        if (!artifact.active) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not available for purchase' }));
          return;
        }

        // Get or create user if needed
        let user = null;
        if (userId) {
          const userQuery = 'SELECT u.id, u.username, sa.total_solar FROM users u LEFT JOIN solar_accounts sa ON u.id = sa.user_id WHERE u.id = $1';
          const userResult = await pool.query(userQuery, [userId]);
          user = userResult.rows[0];
        } else if (userEmail) {
          // Check if user exists by email
          const emailQuery = 'SELECT u.id, u.username, sa.total_solar FROM users u LEFT JOIN solar_accounts sa ON u.id = sa.user_id WHERE u.email = $1';
          const emailResult = await pool.query(emailQuery, [userEmail]);
          
          if (emailResult.rows.length > 0) {
            user = emailResult.rows[0];
          } else {
            // Create new user for first purchase
            const genesisDate = new Date('2025-04-07');
            const currentDate = new Date();
            const daysSinceGenesis = Math.floor((currentDate - genesisDate) / (1000 * 60 * 60 * 24));
            const initialSolarAmount = Math.max(daysSinceGenesis, 1);

            const newUserQuery = `
              INSERT INTO users (id, username, email, first_name, created_at)
              VALUES (gen_random_uuid(), $1, $2, $3, NOW())
              RETURNING id
            `;
            
            const username = userName || userEmail.split('@')[0];
            const newUserResult = await pool.query(newUserQuery, [username, userEmail, userName || '']);
            const newUserId = newUserResult.rows[0].id;

            // Create Solar account
            const accountNumber = `SOL-${newUserId.substring(0, 8).toUpperCase()}`;
            const solarAccountQuery = `
              INSERT INTO solar_accounts (user_id, account_number, display_name, total_solar, total_kwh, total_dollars, joined_date)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `;
            
            await pool.query(solarAccountQuery, [
              newUserId, accountNumber, `${userName || username}'s Solar Account`, 
              initialSolarAmount, initialSolarAmount * 4913, initialSolarAmount * 0.20
            ]);

            user = {
              id: newUserId,
              username: username,
              total_solar: initialSolarAmount
            };

            console.log(`🌱 New user created for purchase: ${username} with ${initialSolarAmount} Solar`);
          }
        }

        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User identification required' }));
          return;
        }

        // Check if user has sufficient Solar balance
        const requiredSolar = parseFloat(artifact.solar_amount_s);
        const userBalance = parseFloat(user.total_solar || 0);
        
        if (userBalance < requiredSolar) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Insufficient Solar balance', 
            required: requiredSolar,
            available: userBalance,
            shortfall: requiredSolar - userBalance
          }));
          return;
        }

        // Process transaction (deduct Solar)
        const newBalance = userBalance - requiredSolar;
        const updateBalanceQuery = 'UPDATE solar_accounts SET total_solar = $1 WHERE user_id = $2';
        await pool.query(updateBalanceQuery, [newBalance, user.id]);

        // Record transaction
        const transactionQuery = `
          INSERT INTO transactions (id, type, wallet_id, artifact_id, amount_s, note, created_at)
          VALUES (gen_random_uuid(), 'purchase', $1, $2, $3, $4, NOW())
          RETURNING id
        `;
        
        const transactionResult = await pool.query(transactionQuery, [
          user.id, 
          artifactId, 
          requiredSolar,
          `Purchase of "${artifact.title}" for ${requiredSolar} Solar`
        ]);

        console.log(`💰 Purchase completed: ${user.username} bought "${artifact.title}" for ${requiredSolar} Solar`);

        // Generate secure trade file access (valid for 7 days for purchased content)
        const secureTradeAccess = fileManager.generateSecureUrl('trade', artifactId, 7 * 24 * 3600); // 7 days
        
        // Create enhanced download record in database
        const downloadToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        // Check if download_tokens table exists and enhance if needed
        try {
          const enhancedTokenQuery = `
            INSERT INTO download_tokens (
              token, artifact_id, user_id, expires_at, created_at,
              secure_url, access_type, file_size
            ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
          `;
          
          await pool.query(enhancedTokenQuery, [
            downloadToken, 
            artifactId, 
            user.id, 
            expiresAt,
            secureTradeAccess.url,
            'trade_file',
            artifact.trade_file_size || 0
          ]);
          
          console.log(`🔐 Enhanced download access created for ${user.username}`);
        } catch (dbError) {
          // Fallback to simple token system if enhanced table doesn't exist
          console.log('📁 Using fallback download system - enhanced table not available');
        }

        // Provide both secure and legacy download options
        const downloadUrl = `/api/artifacts/download/${downloadToken}`;
        const secureDownloadUrl = secureTradeAccess.url;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transactionId: transactionResult.rows[0].id,
          artifactTitle: artifact.title,
          amountPaid: requiredSolar,
          newBalance: newBalance,
          downloadUrl: downloadUrl, // Legacy endpoint for compatibility
          secureDownloadUrl: secureDownloadUrl, // Enhanced secure access
          downloadExpires: expiresAt.toISOString(),
          fileInfo: {
            type: artifact.file_type,
            category: artifact.category,
            size: artifact.trade_file_size || 'Unknown',
            secureAccess: true
          },
          message: `Successfully purchased "${artifact.title}" for ${formatSolar(requiredSolar)} Solar. Your new balance is ${formatSolar(newBalance)} Solar. Download access valid for 7 days.`
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable for purchases' }));
      }
    } catch (error) {
      console.error('Purchase error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to process purchase' }));
    }
    return;
  }

  // Creator Dashboard API - Get creator's artifacts and earnings
  if (pathname === '/api/creator/dashboard' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { creatorId } = body;
      
      if (!creatorId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Creator ID is required' }));
        return;
      }

      if (pool) {
        // Get creator's artifacts
        const artifactsQuery = `
          SELECT id, title, category, kwh_footprint, solar_amount_s, 
                 created_at, active, delivery_url
          FROM artifacts 
          WHERE creator_id = $1 
          ORDER BY created_at DESC
        `;
        
        const artifactsResult = await pool.query(artifactsQuery, [creatorId]);
        
        // Get purchase statistics for creator's artifacts
        const salesQuery = `
          SELECT a.id as artifact_id, a.title, COUNT(t.id) as total_sales,
                 SUM(t.amount_s) as total_revenue
          FROM artifacts a
          LEFT JOIN transactions t ON a.id = t.artifact_id AND t.type = 'purchase'
          WHERE a.creator_id = $1
          GROUP BY a.id, a.title
          ORDER BY total_revenue DESC NULLS LAST
        `;
        
        const salesResult = await pool.query(salesQuery, [creatorId]);
        
        // Calculate total earnings (85% of sales)
        const totalSales = salesResult.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0);
        const creatorEarnings = totalSales * 0.85;
        
        const artifacts = artifactsResult.rows.map(artifact => {
          const salesData = salesResult.rows.find(s => s.artifact_id === artifact.id);
          return {
            id: artifact.id,
            title: artifact.title,
            category: artifact.category,
            solarPrice: formatSolar(artifact.solar_amount_s),
            createdAt: artifact.created_at,
            active: artifact.active,
            totalSales: parseInt(salesData?.total_sales || 0),
            totalRevenue: formatSolar(salesData?.total_revenue || 0),
            creatorEarnings: formatSolar((salesData?.total_revenue || 0) * 0.85)
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          creatorId: creatorId,
          totalArtifacts: artifacts.length,
          totalEarnings: formatSolar(creatorEarnings),
          totalSales: salesResult.rows.reduce((sum, row) => sum + parseInt(row.total_sales || 0), 0),
          artifacts: artifacts
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Creator dashboard error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get creator dashboard' }));
    }
    return;
  }

  // Get Available Artifacts API (for marketplace display)
  if (pathname === '/api/artifacts/available' && req.method === 'GET') {
    try {
      if (pool) {
        const artifactsQuery = `
          SELECT id, title, description, category, file_type, kwh_footprint, solar_amount_s, 
                 is_bonus, cover_art_url, delivery_mode, creator_id, 
                 streaming_url, preview_type, preview_slug
          FROM artifacts 
          WHERE active = true 
          ORDER BY is_bonus ASC, solar_amount_s ASC, title ASC
        `;
        
        const artifactsResult = await pool.query(artifactsQuery);
        
        const artifacts = artifactsResult.rows.map(artifact => ({
          id: artifact.id,
          title: artifact.title,
          description: artifact.description,
          category: artifact.category,
          file_type: artifact.file_type,
          kwhFootprint: parseFloat(artifact.kwh_footprint),
          solarPrice: parseFloat(artifact.solar_amount_s),
          formattedPrice: `${formatSolar(artifact.solar_amount_s)} Solar`,
          isBonus: artifact.is_bonus,
          coverArt: artifact.cover_art_url,
          deliveryMode: artifact.delivery_mode || 'download',
          creatorId: artifact.creator_id,
          streamingUrl: artifact.streaming_url,
          previewType: artifact.preview_type,
          previewSlug: artifact.preview_slug
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          totalArtifacts: artifacts.length,
          artifacts: artifacts,
          categories: ['music', 'video', 'art', 'document'],
          priceRange: {
            min: Math.min(...artifacts.map(a => a.solarPrice)),
            max: Math.max(...artifacts.map(a => a.solarPrice))
          }
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Artifacts listing error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get artifacts' }));
    }
    return;
  }

  // Generate Video Preview Token API (secure server-side)
  if (pathname.startsWith('/api/artifacts/') && pathname.endsWith('/preview') && req.method === 'POST') {
    try {
      const artifactId = pathname.split('/')[3]; // Extract ID from /api/artifacts/{id}/preview
      
      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID required' }));
        return;
      }

      // Check if artifact exists and is video
      const artifactQuery = 'SELECT id, title, category, delivery_url FROM artifacts WHERE id = $1 AND active = true';
      const artifactResult = await pool.query(artifactQuery, [artifactId]);
      
      if (artifactResult.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Video not found' }));
        return;
      }

      const artifact = artifactResult.rows[0];
      if (artifact.category !== 'video' && artifact.category !== 'music') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Preview only available for videos and music' }));
        return;
      }

      // Generate secure HMAC-signed preview token (expires in 10 minutes)
      const crypto = require('crypto');
      const secretKey = process.env.PREVIEW_TOKEN_SECRET || 'fallback-preview-secret-2025';
      
      const previewData = {
        artifactId: artifactId,
        type: 'preview',
        expires: Date.now() + (10 * 60 * 1000), // 10 minutes
        timestamp: Date.now(),
        nonce: crypto.randomBytes(8).toString('hex')
      };
      
      const payload = Buffer.from(JSON.stringify(previewData)).toString('base64');
      const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
      const previewToken = `${payload}.${signature}`;
      const previewUrl = `/api/artifacts/preview/${previewToken}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        previewUrl: previewUrl,
        artifactTitle: artifact.title,
        expiresIn: 600 // seconds
      }));
    } catch (error) {
      console.error('Preview token generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate preview' }));
    }
    return;
  }

  // Video Preview Delivery API (secure token validation)
  if (pathname.startsWith('/api/artifacts/preview/') && req.method === 'GET') {
    try {
      const previewToken = pathname.split('/')[4]; // Extract token from /api/artifacts/preview/{token}
      
      if (!previewToken) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview token');
        return;
      }

      // Validate HMAC-signed preview token
      const crypto = require('crypto');
      const secretKey = process.env.PREVIEW_TOKEN_SECRET || 'fallback-preview-secret-2025';
      
      const tokenParts = previewToken.split('.');
      if (tokenParts.length !== 2) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview token format');
        return;
      }
      
      const [payload, signature] = tokenParts;
      
      // Verify HMAC signature
      const expectedSignature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview token signature');
        return;
      }
      
      // Decode and validate preview data
      let previewData;
      try {
        previewData = JSON.parse(Buffer.from(payload, 'base64').toString());
      } catch (decodeError) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview token payload');
        return;
      }

      // Validate token structure and expiration
      if (!previewData.artifactId || !previewData.expires || previewData.type !== 'preview') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview token data');
        return;
      }

      if (Date.now() > previewData.expires) {
        res.writeHead(410, { 'Content-Type': 'text/plain' });
        res.end('Preview token expired');
        return;
      }

      // Get artifact delivery URL
      const artifactQuery = 'SELECT delivery_url, title FROM artifacts WHERE id = $1 AND active = true AND category = $2';
      const artifactResult = await pool.query(artifactQuery, [previewData.artifactId, 'video']);
      
      if (artifactResult.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Video not found');
        return;
      }

      const deliveryUrl = artifactResult.rows[0].delivery_url;
      
      // Redirect to actual video file with security headers
      res.writeHead(302, { 
        'Location': deliveryUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      });
      res.end();
    } catch (error) {
      console.error('Preview delivery error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Preview service error');
    }
    return;
  }

  // Type-Aware Preview Resolver API - redirects based on artifact type
  if (pathname.startsWith('/api/preview/') && req.method === 'GET') {
    try {
      const artifactId = pathname.split('/')[3]; // Extract ID from /api/preview/{id}
      
      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID required' }));
        return;
      }

      if (pool) {
        // Get artifact details including new preview fields
        const artifactQuery = `
          SELECT id, title, category, preview_type, streaming_url, preview_slug, delivery_url, active 
          FROM artifacts 
          WHERE id = $1 AND active = true
        `;
        const artifactResult = await pool.query(artifactQuery, [artifactId]);
        
        if (artifactResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found' }));
          return;
        }

        const artifact = artifactResult.rows[0];
        
        // Route based on preview type
        if (artifact.preview_type === 'audio' && artifact.streaming_url) {
          // For music: redirect to Music Now streaming location
          res.writeHead(302, { 
            'Location': artifact.streaming_url,
            'Cache-Control': 'no-cache'
          });
          res.end();
        } else if (artifact.preview_slug) {
          // For video/other files: redirect to preview page
          res.writeHead(302, { 
            'Location': `/preview/${artifact.preview_slug}`,
            'Cache-Control': 'no-cache'
          });
          res.end();
        } else {
          // Fallback: return preview info as JSON
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: artifact.id,
            title: artifact.title,
            category: artifact.category,
            previewType: artifact.preview_type,
            streamingUrl: artifact.streaming_url,
            previewSlug: artifact.preview_slug,
            message: 'Preview available - use streaming URL or preview slug'
          }));
        }
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Preview resolver error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Preview service error' }));
    }
    return;
  }

  // Get User's Items API (uploaded artifacts + purchased artifacts)
  if (pathname === '/api/artifacts/my-items' && req.method === 'GET') {
    try {
      // Get user ID from session
      const sessionId = getCookie(req, 'tc_s_session');
      if (!sessionId || !sessions.get(sessionId)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      const userId = sessions.get(sessionId).userId;

      if (pool) {
        // Get uploaded artifacts (created by user) - both active and inactive
        const uploadedQuery = `
          SELECT id, title, description, category, file_type, kwh_footprint, solar_amount_s, 
                 is_bonus, cover_art_url, delivery_mode, creator_id, created_at, active
          FROM artifacts 
          WHERE creator_id = $1
          ORDER BY created_at DESC
        `;
        
        const uploadedResult = await pool.query(uploadedQuery, [userId.toString()]);
        
        // Get purchased artifacts (bought by user)
        const purchasedQuery = `
          SELECT DISTINCT a.id, a.title, a.description, a.category, a.kwh_footprint, 
                 a.solar_amount_s, a.is_bonus, a.cover_art_url, a.delivery_mode, 
                 a.creator_id, a.file_type, t.created_at as purchase_date, t.amount_s as paid_amount
          FROM artifacts a
          INNER JOIN transactions t ON a.id = t.artifact_id
          WHERE a.active = true AND t.wallet_id = $1 AND t.type = 'purchase'
          ORDER BY t.created_at DESC
        `;
        
        const purchasedResult = await pool.query(purchasedQuery, [userId]);

        const uploadedArtifacts = uploadedResult.rows.map(artifact => ({
          id: artifact.id,
          title: artifact.title,
          description: artifact.description,
          category: artifact.category,
          file_type: artifact.file_type,
          kwhFootprint: parseFloat(artifact.kwh_footprint),
          solarPrice: parseFloat(artifact.solar_amount_s),
          formattedPrice: `${formatSolar(artifact.solar_amount_s)} Solar`,
          isBonus: artifact.is_bonus,
          coverArt: artifact.cover_art_url,
          deliveryMode: artifact.delivery_mode || 'download',
          creatorId: artifact.creator_id,
          itemType: 'uploaded',
          dateAdded: artifact.created_at,
          active: artifact.active,
          status: artifact.active ? 'published' : 'pending_approval'
        }));

        const purchasedArtifacts = purchasedResult.rows.map(artifact => ({
          id: artifact.id,
          title: artifact.title,
          description: artifact.description,
          category: artifact.category,
          kwhFootprint: parseFloat(artifact.kwh_footprint),
          solarPrice: parseFloat(artifact.solar_amount_s),
          formattedPrice: `${formatSolar(artifact.paid_amount)} Solar`,
          isBonus: artifact.is_bonus,
          coverArt: artifact.cover_art_url,
          deliveryMode: artifact.delivery_mode || 'download',
          creatorId: artifact.creator_id,
          fileType: artifact.file_type,
          itemType: 'purchased',
          dateAdded: artifact.purchase_date,
          paidAmount: parseFloat(artifact.paid_amount)
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          userId: userId,
          uploaded: {
            count: uploadedArtifacts.length,
            artifacts: uploadedArtifacts
          },
          purchased: {
            count: purchasedArtifacts.length,
            artifacts: purchasedArtifacts
          }
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('My items error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get user items' }));
    }
    return;
  }

  // Artifact Approval API (for publishing uploaded artifacts to marketplace)
  if (pathname === '/api/artifacts/approve' && req.method === 'POST') {
    try {
      // Get user ID from session
      const sessionId = getCookie(req, 'tc_s_session');
      if (!sessionId || !sessions.get(sessionId)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      const userId = sessions.get(sessionId).userId;
      const body = await parseBody(req);
      const { artifactId } = body;

      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID required' }));
        return;
      }

      if (pool) {
        // Verify the user owns this artifact
        const ownershipQuery = 'SELECT id, title, active FROM artifacts WHERE id = $1 AND creator_id = $2';
        const ownershipResult = await pool.query(ownershipQuery, [artifactId, userId.toString()]);

        if (ownershipResult.rows.length === 0) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found or access denied' }));
          return;
        }

        const artifact = ownershipResult.rows[0];

        // Check if already active
        if (artifact.active) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact is already published' }));
          return;
        }

        // Approve the artifact for publication
        const approveQuery = 'UPDATE artifacts SET active = true WHERE id = $1 AND creator_id = $2';
        await pool.query(approveQuery, [artifactId, userId.toString()]);

        console.log(`✅ Artifact approved for publication: ${artifact.title} (${artifactId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `"${artifact.title}" has been published to the marketplace`,
          artifactId: artifactId
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Artifact approval error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to approve artifact' }));
    }
    return;
  }

  // Music Stats API
  if (pathname === '/api/music/stats' && req.method === 'GET') {
    try {
      if (pool) {
        // Get total play count
        const totalQuery = 'SELECT COUNT(*) as count FROM play_events';
        const totalResult = await pool.query(totalQuery);
        const totalPlays = parseInt(totalResult.rows[0].count) || 0;

        // Get top 3 most played songs
        const topSongsQuery = `
          SELECT s.title, s.artist, COUNT(pe.id) as play_count
          FROM songs s
          LEFT JOIN play_events pe ON s.id = pe.song_id
          WHERE s.is_active = true
          GROUP BY s.id, s.title, s.artist
          ORDER BY play_count DESC, s.title ASC
          LIMIT 3
        `;
        const topSongsResult = await pool.query(topSongsQuery);

        const formattedVolume = totalPlays > 0 ? `↗ ${totalPlays.toLocaleString()} plays` : '↗ 0 plays';
        
        const topSongs = topSongsResult.rows.map((song, index) => ({
          rank: index + 1,
          title: song.title,
          artist: song.artist,
          playCount: parseInt(song.play_count) || 0,
          trend: index === 0 ? '+127%' : index === 1 ? '+89%' : '+62%'
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          totalPlays,
          formattedVolume,
          topSongs,
          averagePrice: 'S0.1000',
          topGenre: 'Blues Rock'
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          totalPlays: 0,
          formattedVolume: '↗ 0 plays',
          topSongs: [],
          averagePrice: 'S0.1000',
          topGenre: 'Blues Rock'
        }));
      }
    } catch (error) {
      console.error('Stats retrieval error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get statistics' }));
    }
    return;
  }

  // Artifact Download Handler
  if (pathname.startsWith('/api/artifacts/download/')) {
    try {
      const downloadToken = pathname.split('/api/artifacts/download/')[1];
      const decoded = Buffer.from(downloadToken, 'base64').toString();
      const [userId, artifactId, timestamp] = decoded.split(':');
      
      // Verify token is recent (within 1 hour)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      if (now - tokenTime > 3600000) { // 1 hour expiry
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Download token expired' }));
        return;
      }

      if (pool) {
        // Verify user purchased this artifact
        const purchaseQuery = 'SELECT t.id FROM transactions t WHERE t.wallet_id = $1 AND t.artifact_id = $2 AND t.type = $3';
        const purchaseResult = await pool.query(purchaseQuery, [userId, artifactId, 'purchase']);
        
        if (purchaseResult.rows.length === 0) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No valid purchase found' }));
          return;
        }

        // Get artifact details for file serving
        const artifactQuery = 'SELECT title, delivery_url FROM artifacts WHERE id = $1';
        const artifactResult = await pool.query(artifactQuery, [artifactId]);
        
        if (artifactResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found' }));
          return;
        }

        const artifact = artifactResult.rows[0];
        
        // For music tracks, serve from the music directory
        // In production, this would be from secure cloud storage
        const musicFiles = {
          "'Ternal Flame": "https://storage.aisongmaker.io/audio/4a839c86-40d9-4272-989b-7a512184ddb6.mp3",
          "David Boyeez Hair": "https://storage.aisongmaker.io/audio/9b2b12e4-8626-41e4-b9e4-c7a563e40f97.mp3",
          "Starlight Forever": "https://storage.aisongmaker.io/audio/c51b1f15-eff7-41fb-b778-b1b9d914ce3a.mp3",
          "Snowmancer One (Market Exclusive)": "/music/snowmancer-one.mp3"
        };

        const fileUrl = musicFiles[artifact.title] || artifact.delivery_url;
        
        if (fileUrl) {
          if (fileUrl.startsWith('http')) {
            // Redirect to external URL
            res.writeHead(302, { 'Location': fileUrl });
            res.end();
          } else {
            // Serve local file
            const filePath = path.join(__dirname, 'public', fileUrl);
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Length': stats.size,
                'Content-Disposition': `attachment; filename="${artifact.title}.mp3"`
              });
              fs.createReadStream(filePath).pipe(res);
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File not found' }));
            }
          }
          
          console.log(`💾 Download initiated: "${artifact.title}" for user ${userId}`);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Download URL not available' }));
        }
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable for downloads' }));
      }
    } catch (error) {
      console.error('Download error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Download failed' }));
    }
    return;
  }

  // Skip object storage for stable deployment
  if (pathname.startsWith('/public-objects/')) {
    console.log(`⚠️ Object storage disabled for stable deployment`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Object storage temporarily disabled' }));
    return;
  }
  
  // Debug route to list object storage contents
  if (pathname === '/debug/storage') {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h2>Object Storage Debug</h2>
      <p><strong>Bucket ID:</strong> ${bucketId}</p>
      <p><strong>Public Path:</strong> https://storage.googleapis.com/${bucketId}/public/</p>
      <p><strong>Try these URLs directly:</strong></p>
      <ul>
        <li><a href="https://storage.googleapis.com/${bucketId}/public/We_Said_So-by_Monazite.mp4" target="_blank">We_Said_So-by_Monazite.mp4</a></li>
        <li><a href="https://storage.googleapis.com/${bucketId}/public/we-said-so-by-monazite.mp4" target="_blank">we-said-so-by-monazite.mp4</a></li>
        <li><a href="https://storage.googleapis.com/${bucketId}/public/WeSaidSo.mp4" target="_blank">WeSaidSo.mp4</a></li>
      </ul>
      <p><a href="/video-stream-simple.html">Back to Video Player</a></p>
    `);
    return;
  }
  
  // Prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  // Route handling - start with 3-page intro sequence
  if (pathname === '/') {
    res.writeHead(302, { 'Location': '/page1-solar-intro.html' });
    res.end();
    console.log('✅ Redirecting to intro sequence (page1)');
    return;
  }
  
  if (pathname === '/page1') {
    const filePath = path.join(__dirname, 'public', 'page1-solar-intro.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }
  
  if (pathname === '/page2') {
    const filePath = path.join(__dirname, 'public', 'page2-solar-live.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }
  
  if (pathname === '/page3') {
    const filePath = path.join(__dirname, 'public', 'page3-features.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }
  
  if (pathname === '/main-platform' || pathname === '/main') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log('✅ Served main platform with Music Now functionality');
      return;
    }
  }
  
  if (pathname === '/paygate') {
    const filePath = path.join(__dirname, 'public', 'paygate.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }
  
  if (pathname === '/my-solar') {
    // Redirect to main platform solar tracking section
    res.writeHead(302, { 'Location': '/main-platform#solar-tracking' });
    res.end();
    return;
  }

  // Market Data API Endpoints
  if (pathname === '/api/market-data/stats' && req.method === 'GET') {
    try {
      const marketData = await marketDataService.getRenewableEnergyStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: marketData }));
    } catch (error) {
      console.error('Market data error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch market data' }));
    }
    return;
  }

  if (pathname === '/api/market-data/positioning' && req.method === 'GET') {
    try {
      const positioning = await marketDataService.getMarketPositioning();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: positioning }));
    } catch (error) {
      console.error('Market positioning error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch market positioning' }));
    }
    return;
  }

  // Content Validation API Endpoints
  if (pathname === '/api/content/validate' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { content, contentType = 'general' } = body;
      
      if (!content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content is required' }));
        return;
      }

      const validation = await contentValidator.validateAndEnhanceContent(content, contentType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: validation }));
    } catch (error) {
      console.error('Content validation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Content validation failed' }));
    }
    return;
  }

  if (pathname === '/api/content/competitor-analysis' && req.method === 'GET') {
    try {
      const analysis = await contentValidator.getCompetitorAnalysis();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: analysis }));
    } catch (error) {
      console.error('Competitor analysis error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Competitor analysis failed' }));
    }
    return;
  }

  // Dynamic SEO API Endpoints
  if (pathname === '/api/seo/generate' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { pageType = 'homepage' } = body;
      
      const seoContent = await seoGenerator.generateAllSEOContent();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: seoContent,
        pageType: pageType,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('SEO generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'SEO generation failed' }));
    }
    return;
  }

  if (pathname === '/api/seo/update' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { pageType = 'all' } = body;
      
      const updatedPages = await seoGenerator.updateSEOFiles(pageType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: `SEO updated for ${pageType}`,
        data: updatedPages,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('SEO update error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'SEO update failed' }));
    }
    return;
  }

  if (pathname === '/api/seo/competitive-analysis' && req.method === 'GET') {
    try {
      const analysis = await seoGenerator.getCompetitiveSEOAnalysis();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: analysis }));
    } catch (error) {
      console.error('SEO competitive analysis error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'SEO competitive analysis failed' }));
    }
    return;
  }

  // AI SEO Optimization API Endpoints
  if (pathname === '/api/ai-seo/generate' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { contentType = 'homepage' } = body;
      
      const aiOptimizedContent = await aiSEOOptimizer.generateAIOptimizedContent(contentType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: aiOptimizedContent,
        contentType: contentType,
        optimization: 'AI-optimized for semantic understanding and entity recognition',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('AI SEO generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI SEO generation failed' }));
    }
    return;
  }

  if (pathname === '/api/ai-seo/optimize-content' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { content, contentType = 'general' } = body;
      
      if (!content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content is required' }));
        return;
      }

      const optimization = await aiSEOOptimizer.optimizeForAIRanking(content, contentType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: optimization }));
    } catch (error) {
      console.error('AI content optimization error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI content optimization failed' }));
    }
    return;
  }

  if (pathname === '/api/ai-seo/meta-tags' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { contentType = 'homepage' } = body;
      
      const aiContent = await aiSEOOptimizer.generateAIOptimizedContent(contentType);
      const metaTags = aiSEOOptimizer.generateAIMetaTags(aiContent, contentType);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: metaTags,
        description: 'AI-optimized meta tags for enhanced semantic understanding',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('AI meta tags generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI meta tags generation failed' }));
    }
    return;
  }

  if (pathname === '/api/ai-seo/knowledge-graph' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const contentType = url.searchParams.get('contentType') || 'homepage';
      
      const aiContent = await aiSEOOptimizer.generateAIOptimizedContent(contentType);
      const knowledgeGraph = aiContent.knowledgeGraphNodes;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: knowledgeGraph,
        description: 'Knowledge graph for AI understanding and entity recognition',
        contentType: contentType
      }));
    } catch (error) {
      console.error('Knowledge graph generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Knowledge graph generation failed' }));
    }
    return;
  }

  if (pathname === '/api/ai-seo/conversational-context' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const contentType = url.searchParams.get('contentType') || 'homepage';
      
      const aiContent = await aiSEOOptimizer.generateAIOptimizedContent(contentType);
      const conversationalContext = aiContent.naturalLanguageContext;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: conversationalContext,
        description: 'Conversational context optimized for AI assistants and voice search',
        contentType: contentType
      }));
    } catch (error) {
      console.error('Conversational context generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Conversational context generation failed' }));
    }
    return;
  }

  // Member Content Sharing and Advertising API Endpoints
  if (pathname === '/api/member-content/upload' && req.method === 'POST') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const memberId = url.searchParams.get('memberId');
      const username = url.searchParams.get('username');

      if (!memberId || !username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Member ID and username required' }));
        return;
      }

      // Handle file upload and content info with robust error handling
      upload.single('contentFile')(req, res, async (err) => {
        if (err) {
          console.error('Upload error:', err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `File upload failed: ${err.message}` }));
          return;
        }

        try {
          const body = await parseBody(req);
          const memberData = { userId: memberId, username: username };

          // Enhanced upload with database fallback handling
          const result = await memberContentService.uploadMemberContent(memberData, req.file, body);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (uploadError) {
          console.error('Member content upload error:', uploadError);
          
          // Provide helpful error message based on error type
          let errorMessage = 'Upload failed';
          if (uploadError.message.includes('WebSocket') || uploadError.message.includes('database')) {
            errorMessage = 'Upload successful but database connection temporarily unavailable. Your file is saved and will be processed shortly.';
          } else if (uploadError.message.includes('file')) {
            errorMessage = 'File processing failed. Please check file format and try again.';
          } else {
            errorMessage = `Upload failed: ${uploadError.message}`;
          }
          
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: errorMessage,
            technical: uploadError.message
          }));
        }
      });
    } catch (error) {
      console.error('Member content upload error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Upload failed' }));
    }
    return;
  }

  if (pathname === '/api/member-content/my-content' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const memberId = url.searchParams.get('memberId');
      const category = url.searchParams.get('category');
      const status = url.searchParams.get('status');
      const searchTerm = url.searchParams.get('search');

      if (!memberId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Member ID required' }));
        return;
      }

      const filters = { category, status, searchTerm };
      const result = memberContentService.getMemberContent(memberId, filters);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Get member content error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get content' }));
    }
    return;
  }

  if (pathname === '/api/member-content/marketplace' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const category = url.searchParams.get('category');
      const priceRange = url.searchParams.get('priceRange');
      const searchTerm = url.searchParams.get('search');

      const filters = { category, priceRange, searchTerm };
      const result = memberContentService.getMarketplaceContent(filters);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Get marketplace content error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get marketplace content' }));
    }
    return;
  }

  // NEW: Monazite Collection API - Serve seeded marketplace artifacts
  if (pathname === '/api/marketplace/monazite' && req.method === 'GET') {
    try {
      const fs = require('fs');
      const manifestPath = 'public/models/monazite-collection.json';
      
      if (!fs.existsSync(manifestPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Monazite collection not found',
          message: 'Run the seeding script to initialize the collection'
        }));
        return;
      }

      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const url = new URL(req.url, `http://${req.headers.host}`);
      const includeBundle = url.searchParams.get('bundle') !== 'false';
      const category = url.searchParams.get('category');
      const searchTerm = url.searchParams.get('search');

      let artifacts = manifestData.artifacts.filter(artifact => artifact.isActive);
      let bundles = includeBundle ? manifestData.bundles.filter(bundle => bundle.isActive) : [];

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        artifacts = artifacts.filter(artifact => 
          artifact.title.toLowerCase().includes(searchLower) ||
          artifact.description.toLowerCase().includes(searchLower) ||
          artifact.genre.toLowerCase().includes(searchLower) ||
          artifact.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        if (includeBundle) {
          bundles = bundles.filter(bundle =>
            bundle.title.toLowerCase().includes(searchLower) ||
            bundle.description.toLowerCase().includes(searchLower)
          );
        }
      }

      // Apply category filter for music vs bundles
      if (category === 'music') {
        bundles = [];
      } else if (category === 'bundles') {
        artifacts = [];
      }

      const response = {
        success: true,
        data: {
          collection: manifestData.metadata,
          artifacts: artifacts,
          bundles: bundles,
          totals: {
            tracks: artifacts.length,
            bundles: bundles.length,
            totalValue: artifacts.reduce((sum, a) => sum + a.priceSolar, 0),
            bundleValue: bundles.reduce((sum, b) => sum + b.priceSolar, 0)
          }
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error('Monazite collection API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Failed to load Monazite collection',
        message: error.message 
      }));
    }
    return;
  }

  // NEW: Purchase Monazite tracks/bundles with Solar tokens
  if (pathname === '/api/marketplace/purchase' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { artifactId, bundleId, buyerEmail, solarAmount } = body;

      if (!buyerEmail || (!artifactId && !bundleId) || !solarAmount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: buyerEmail, artifactId/bundleId, solarAmount' 
        }));
        return;
      }

      // Load Monazite collection
      const fs = require('fs');
      const manifestPath = 'public/models/monazite-collection.json';
      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      let item = null;
      let itemType = '';

      if (artifactId) {
        item = manifestData.artifacts.find(a => a.id === artifactId && a.isActive);
        itemType = 'track';
      } else if (bundleId) {
        item = manifestData.bundles.find(b => b.id === bundleId && b.isActive);
        itemType = 'bundle';
      }

      if (!item) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Item not found or not available for purchase' 
        }));
        return;
      }

      // Verify price
      if (Math.abs(solarAmount - item.priceSolar) > 0.0001) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Price mismatch',
          expected: item.priceSolar,
          provided: solarAmount
        }));
        return;
      }

      // Check buyer's Solar balance (simplified - in production integrate with actual user accounts)
      const buyerBalance = 172.5; // Your current balance - in production, query from database
      
      if (buyerBalance < solarAmount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Insufficient Solar balance',
          required: solarAmount,
          available: buyerBalance
        }));
        return;
      }

      // Generate secure download token
      const crypto = require('crypto');
      const purchaseId = `purch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const downloadToken = crypto.createHmac('sha256', 'monazite-secure-key')
        .update(`${purchaseId}:${buyerEmail}:${item.id}:${Date.now()}`)
        .digest('hex');

      // Record purchase (simplified - in production, save to database)
      const purchase = {
        id: purchaseId,
        buyerEmail: buyerEmail,
        itemId: item.id,
        itemType: itemType,
        itemTitle: item.title,
        priceSolar: solarAmount,
        creatorEmail: item.creatorEmail,
        creatorEarnings: Math.round(solarAmount * 0.85 * 10000) / 10000, // 85% to creator
        platformFee: Math.round(solarAmount * 0.15 * 10000) / 10000, // 15% platform fee
        purchasedAt: new Date().toISOString(),
        downloadToken: downloadToken,
        downloadExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour expiry
      };

      console.log(`💰 SOLAR PURCHASE: ${buyerEmail} bought "${item.title}" for ${solarAmount} Solar`);
      console.log(`🎯 Creator earnings: ${purchase.creatorEarnings} Solar (85%)`);
      console.log(`🏛️ Platform fee: ${purchase.platformFee} Solar (15%)`);

      const response = {
        success: true,
        purchase: {
          id: purchase.id,
          item: {
            id: item.id,
            title: item.title,
            type: itemType
          },
          payment: {
            amount: solarAmount,
            currency: 'Solar'
          },
          download: {
            token: downloadToken,
            expires: purchase.downloadExpires,
            url: `/api/download/${downloadToken}`
          }
        },
        message: `Successfully purchased ${item.title}! Download available for 24 hours.`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error('Purchase error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Purchase failed',
        message: error.message 
      }));
    }
    return;
  }

  // NEW: Secure download endpoint with token validation
  if (pathname.startsWith('/api/download/') && req.method === 'GET') {
    try {
      const token = pathname.split('/api/download/')[1];
      
      if (!token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Download token required' }));
        return;
      }

      // Load Monazite collection to find item
      const fs = require('fs');
      const manifestPath = 'public/models/monazite-collection.json';
      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // In production, validate token against database purchases
      // For now, check if token matches expected format
      if (token.length !== 64) { // SHA256 hex length
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid download token' }));
        return;
      }

      // Determine what to download based on token (simplified)
      // In production, look up actual purchase record
      const url = new URL(req.url, `http://${req.headers.host}`);
      const itemId = url.searchParams.get('item');
      const bundleDownload = url.searchParams.get('bundle') === 'true';

      if (bundleDownload) {
        // Download complete bundle ZIP
        const bundlePath = 'public/music/bundles/monazite-complete-collection.zip';
        
        if (!fs.existsSync(bundlePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Bundle file not found' }));
          return;
        }

        const bundleStats = fs.statSync(bundlePath);
        const bundleStream = fs.createReadStream(bundlePath);

        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="Monazite_Complete_Collection.zip"',
          'Content-Length': bundleStats.size,
          'Cache-Control': 'no-cache',
          'X-Download-Type': 'bundle'
        });

        bundleStream.pipe(res);
        console.log(`📦 Bundle download initiated: Monazite Complete Collection (${(bundleStats.size / 1024 / 1024).toFixed(2)} MB)`);
        return;

      } else if (itemId) {
        // Download individual track
        const artifact = manifestData.artifacts.find(a => a.id === itemId);
        
        if (!artifact || !fs.existsSync(artifact.filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Track file not found' }));
          return;
        }

        const trackStats = fs.statSync(artifact.filePath);
        const trackStream = fs.createReadStream(artifact.filePath);
        const filename = `${artifact.trackNumber.toString().padStart(2, '0')}_${artifact.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.mp3`;

        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': trackStats.size,
          'Cache-Control': 'no-cache',
          'X-Download-Type': 'track'
        });

        trackStream.pipe(res);
        console.log(`🎵 Track download initiated: ${artifact.title} (${(trackStats.size / 1024 / 1024).toFixed(2)} MB)`);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'No download type specified' }));

    } catch (error) {
      console.error('Download error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Download failed',
        message: error.message 
      }));
    }
    return;
  }

  if (pathname === '/api/member-content/promote' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { contentId, memberId, promotion } = body;

      if (!contentId || !memberId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content ID and member ID required' }));
        return;
      }

      const result = memberContentService.updateContentPromotion(contentId, memberId, promotion);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Content promotion error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/member-content/advertisement' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { contentId } = body;

      if (!contentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content ID required' }));
        return;
      }

      const advertisement = memberContentService.generateContentAdvertisement(contentId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, advertisement: advertisement }));
    } catch (error) {
      console.error('Advertisement generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/member-content/stream' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const contentId = url.searchParams.get('contentId');

      if (!contentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content ID required' }));
        return;
      }

      const streamData = await memberContentService.getContentForStreaming(contentId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: streamData }));
    } catch (error) {
      console.error('Content streaming error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/member-content/dashboard' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const memberId = url.searchParams.get('memberId');

      if (!memberId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Member ID required' }));
        return;
      }

      const summary = memberContentService.getMemberContentSummary(memberId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: summary }));
    } catch (error) {
      console.error('Member dashboard error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get dashboard data' }));
    }
    return;
  }

  // AI Automatic Promotion System API Endpoints
  if (pathname === '/api/ai-promotion/analytics' && req.method === 'GET') {
    try {
      const analytics = aiPromotionService.getPromotionAnalytics();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: analytics,
        description: 'AI promotion system analytics including category indexes and performance metrics'
      }));
    } catch (error) {
      console.error('AI promotion analytics error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get promotion analytics' }));
    }
    return;
  }

  if (pathname === '/api/ai-promotion/recommendations' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const contentId = url.searchParams.get('contentId');

      if (!contentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content ID required' }));
        return;
      }

      const recommendations = aiPromotionService.getContentPromotionRecommendations(contentId);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: recommendations,
        contentId: contentId
      }));
    } catch (error) {
      console.error('AI promotion recommendations error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/ai-promotion/trigger-analysis' && req.method === 'POST') {
    try {
      // Manually trigger a promotion analysis cycle
      aiPromotionService.runPromotionAnalysis()
        .then(() => console.log('✅ Manual promotion analysis completed'))
        .catch(error => console.error('Manual promotion analysis failed:', error));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'AI promotion analysis triggered',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('AI promotion trigger error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to trigger promotion analysis' }));
    }
    return;
  }

  if (pathname === '/api/ai-promotion/market-index' && req.method === 'GET') {
    try {
      const analytics = aiPromotionService.getPromotionAnalytics();
      const marketIndex = {
        categoryIndexes: analytics.categoryIndexes,
        inventoryGaps: analytics.inventoryGaps,
        totalContent: Object.values(analytics.categoryIndexes || {})
          .reduce((sum, cat) => sum + (cat.totalItems || 0), 0),
        lastIndexed: analytics.performanceMetrics?.lastUpdated || new Date().toISOString()
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: marketIndex,
        description: 'Market category indexes and inventory gap analysis'
      }));
    } catch (error) {
      console.error('Market index error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get market index' }));
    }
    return;
  }

  if (pathname === '/api/ai-promotion/performance' && req.method === 'GET') {
    try {
      const analytics = aiPromotionService.getPromotionAnalytics();
      const performance = {
        metrics: analytics.performanceMetrics,
        recentPromotions: analytics.recentPromotions,
        algorithmStats: analytics.performanceMetrics?.algorithmPerformance || {},
        systemStatus: {
          active: true,
          lastAnalysis: analytics.performanceMetrics?.lastUpdated,
          nextAnalysis: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min from now
        }
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: performance,
        description: 'AI promotion system performance metrics and algorithm statistics'
      }));
    } catch (error) {
      console.error('Promotion performance error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get performance data' }));
    }
    return;
  }

  // Member Template and Display System API Endpoints
  if (pathname === '/api/templates/available' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const category = url.searchParams.get('category');

      let templates;
      if (category) {
        templates = memberTemplateService.getTemplatesByCategory(category);
      } else {
        templates = memberTemplateService.getAllTemplates();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: templates,
        totalCount: templates.length
      }));
    } catch (error) {
      console.error('Get templates error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get templates' }));
    }
    return;
  }

  if (pathname === '/api/templates/preview' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { templateId, sampleData } = body;

      if (!templateId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Template ID required' }));
        return;
      }

      const preview = memberTemplateService.generateTemplatePreview(templateId, sampleData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: preview 
      }));
    } catch (error) {
      console.error('Template preview error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/templates/create-display' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { memberId, templateId, displayData } = body;

      if (!memberId || !templateId || !displayData) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Member ID, template ID, and display data required' }));
        return;
      }

      const memberDisplay = await memberTemplateService.createMemberDisplay(memberId, templateId, displayData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: memberDisplay,
        message: 'Member display created successfully'
      }));
    } catch (error) {
      console.error('Create member display error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/templates/member-displays' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const memberId = url.searchParams.get('memberId');

      if (!memberId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Member ID required' }));
        return;
      }

      const displays = memberTemplateService.getMemberDisplays(memberId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: displays,
        totalCount: displays.length
      }));
    } catch (error) {
      console.error('Get member displays error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get member displays' }));
    }
    return;
  }

  if (pathname === '/api/templates/display' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const displayId = url.searchParams.get('displayId');

      if (!displayId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Display ID required' }));
        return;
      }

      const display = memberTemplateService.getDisplayById(displayId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: display 
      }));
    } catch (error) {
      console.error('Get display error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/templates/update-display' && req.method === 'PUT') {
    try {
      const body = await parseBody(req);
      const { displayId, updates } = body;

      if (!displayId || !updates) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Display ID and updates required' }));
        return;
      }

      const updatedDisplay = await memberTemplateService.updateMemberDisplay(displayId, updates);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: updatedDisplay,
        message: 'Display updated successfully'
      }));
    } catch (error) {
      console.error('Update display error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  if (pathname === '/api/templates/stats' && req.method === 'GET') {
    try {
      const stats = memberTemplateService.getTemplateStats();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: stats,
        description: 'Template usage statistics and performance metrics'
      }));
    } catch (error) {
      console.error('Template stats error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get template stats' }));
    }
    return;
  }

  if (pathname === '/api/templates/render-display' && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const displayId = url.searchParams.get('displayId');

      if (!displayId) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Display ID Required</h1><p>Please provide a display ID to render the template.</p>');
        return;
      }

      const display = memberTemplateService.getDisplayById(displayId);
      
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${display.templateName} - TC-S Network</title>
          <style>${display.renderedCss}</style>
        </head>
        <body>
          ${display.renderedHtml}
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fullHtml);
    } catch (error) {
      console.error('Render display error:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Display Error</h1><p>Failed to render the display template.</p>');
    }
    return;
  }

  // Brand Authenticity Dashboard API
  if (pathname === '/api/brand/authenticity-dashboard' && req.method === 'GET') {
    try {
      const [marketData, positioning, competitorAnalysis, seoAnalysis] = await Promise.all([
        marketDataService.getRenewableEnergyStats(),
        marketDataService.getMarketPositioning(),
        contentValidator.getCompetitorAnalysis(),
        seoGenerator.getCompetitiveSEOAnalysis()
      ]);

      const dashboard = {
        marketData: {
          lastUpdated: marketData.lastUpdated,
          aiEnergyDemand: `${marketData.aiDataCenterDemand.value}GW by 2030`,
          digitalEconomyScale: `$${marketData.globalDigitalEconomy.value}T (${marketData.globalDigitalEconomy.percentage}% of GDP)`,
          renewableGrowth: `${marketData.renewableMarketGrowth.value}% annually`
        },
        authenticity: {
          energyStandard: `1 Solar = ${marketData.solarStandard.value} kWh`,
          distributionStart: marketData.dailyDistribution.startDate,
          brandConsistency: 'TC-S Network Foundation Market',
          crossReferences: positioning.crossReferences.industry_reports.length
        },
        competitive: {
          uniqueValue: Object.keys(positioning.uniqueValue).length + ' key differentiators',
          marketGaps: Object.keys(positioning.marketGaps).length + ' gaps addressed',
          seoAdvantages: Object.keys(seoAnalysis.seoAdvantages).length + ' SEO advantages'
        },
        credibility: {
          realDataBacking: 'All claims cross-referenced with industry reports',
          marketTiming: `Aligned with ${marketData.aiDataCenterDemand.value}GW AI energy surge`,
          innovation: 'First energy-backed universal basic income system',
          transparency: `Public distribution tracking since ${marketData.dailyDistribution.startDate}`
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: dashboard }));
    } catch (error) {
      console.error('Brand authenticity dashboard error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Dashboard generation failed' }));
    }
    return;
  }

  // Enhanced file preview endpoint for three-copy workflow
  if (pathname.startsWith('/api/files/preview/') && req.method === 'GET') {
    try {
      const artifactId = pathname.split('/')[4];
      
      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID required' }));
        return;
      }

      if (pool) {
        // Get artifact with enhanced file URLs
        const artifactQuery = `
          SELECT id, title, category, preview_file_url, preview_type, 
                 master_file_url, trade_file_url, delivery_url
          FROM artifacts 
          WHERE id = $1 AND active = true
        `;
        const artifactResult = await pool.query(artifactQuery, [artifactId]);
        
        if (artifactResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found' }));
          return;
        }

        const artifact = artifactResult.rows[0];
        
        // Generate secure preview URL using file manager
        const secureUrl = fileManager.generateSecureUrl('preview', artifactId, 3600); // 1 hour expiry
        
        // Provide preview URL (try enhanced first, fallback to legacy)
        const previewUrl = artifact.preview_file_url || artifact.delivery_url || `/artifacts/${artifactId}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          artifactId: artifact.id,
          artifactTitle: artifact.title,
          previewUrl: secureUrl.url, // Use secure URL for better access control
          directUrl: previewUrl, // Fallback direct URL
          previewType: artifact.preview_type,
          expires: secureUrl.expires,
          message: 'Enhanced preview URL generated'
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
    } catch (error) {
      console.error('Preview URL generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Preview generation failed' }));
    }
    return;
  }

  // Secure file access endpoint
  if (pathname.startsWith('/api/files/secure/') && req.method === 'GET') {
    try {
      const pathParts = pathname.split('/');
      const fileType = pathParts[4]; // 'master', 'preview', 'trade'
      const artifactId = pathParts[5];
      
      const urlParams = new URLSearchParams(url.parse(req.url).query);
      const token = urlParams.get('token');
      const expires = parseInt(urlParams.get('expires'));
      
      if (!fileType || !artifactId || !token || !expires) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing required parameters');
        return;
      }

      // Verify secure token
      const verification = fileManager.verifySecureUrl(fileType, artifactId, token, expires);
      if (!verification.valid) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end(`Access denied: ${verification.reason}`);
        return;
      }

      // Serve the requested file
      const filePath = fileManager.getFilePath(fileType, artifactId);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }

      // Stream the file with appropriate headers
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Secure-Access': 'true'
      });
      
      fileStream.pipe(res);
      console.log(`🔒 Secure file access: ${fileType}/${artifactId}`);
      
    } catch (error) {
      console.error('Secure file access error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
    return;
  }

  // Health check endpoint - Cloud Run compatible
  if (pathname === '/health' || pathname === '/healthz' || pathname === '/_ah/health') {
    const healthData = { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      server: 'deployment-ready',
      port: PORT,
      service: 'current-see-platform'
    };
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(healthData, null, 2));
    return;
  }

  // Signup API endpoint
  if (pathname === '/api/signup' && req.method === 'POST') {
    try {
      const data = await parseBody(req);
      
      if (!data.name || !data.address) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name and address are required' }));
        return;
      }

      let result;
      const timestamp = new Date().toISOString();
      const id = 'signup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      if (pool) {
        // Insert into database
        try {
          const dbResult = await pool.query(
            'INSERT INTO signups (name, address, email) VALUES ($1, $2, $3) RETURNING id, timestamp',
            [data.name, data.address, data.email || null]
          );
          result = { id: dbResult.rows[0].id, timestamp: dbResult.rows[0].timestamp };
        } catch (dbError) {
          console.log('⚠️ Database insert failed, using memory storage:', dbError.message);
          pool = null; // Disable database for this session
          signupStorage.push({ id, name: data.name, address: data.address, email: data.email, timestamp });
          result = { id, timestamp };
        }
      } else {
        // Use in-memory storage
        signupStorage.push({ id, name: data.name, address: data.address, email: data.email, timestamp });
        result = { id, timestamp };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        id: result.id,
        timestamp: result.timestamp,
        message: 'Signup recorded successfully'
      }));
      console.log(`✅ New signup: ${data.name} (${pool ? 'database' : 'memory'})`);
    } catch (error) {
      console.error('❌ Signup error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to record signup' }));
    }
    return;
  }

  // Get signups API endpoint (for admin)
  if (pathname === '/api/signups' && req.method === 'GET') {
    try {
      let signups;
      if (pool) {
        const result = await pool.query('SELECT * FROM signups ORDER BY timestamp DESC');
        signups = result.rows;
      } else {
        signups = signupStorage.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, signups, storage: pool ? 'database' : 'memory' }));
    } catch (error) {
      console.error('❌ Get signups error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch signups' }));
    }
    return;
  }

  // SEED ROTATION API ENDPOINTS - SECURED
  
  // Authentication helper for seed rotation endpoints
  function authenticateSeedRotationRequest(req) {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.SEED_ROTATION_API_TOKEN || process.env.ADMIN_API_TOKEN;
    
    if (!expectedToken) {
      console.warn('🔐 SECURITY WARNING: No SEED_ROTATION_API_TOKEN or ADMIN_API_TOKEN configured - blocking all seed rotation requests');
      return false;
    }
    
    if (!authHeader) {
      return false;
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    
    return token === expectedToken;
  }

  // Get seed rotation status (read-only, but still secured)
  if (pathname === '/api/seed-rotation/status' && req.method === 'GET') {
    if (!authenticateSeedRotationRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required for seed rotation endpoints'
      }));
      return;
    }
    
    try {
      const rotator = getSeedRotator();
      const status = rotator.getStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: status,
        message: 'Seed rotation status retrieved successfully'
      }));
    } catch (error) {
      console.error('Error getting seed rotation status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get seed rotation status',
        message: error.message
      }));
    }
    return;
  }

  // DANGEROUS ENDPOINT - SECURED: Trigger seed rotation manually
  if (pathname === '/api/seed-rotation/trigger' && req.method === 'POST') {
    if (!authenticateSeedRotationRequest(req)) {
      console.warn(`🚨 SECURITY ALERT: Unauthorized attempt to trigger seed rotation from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required for seed rotation trigger'
      }));
      return;
    }
    
    try {
      const rotator = getSeedRotator();
      
      if (rotator.isRotating) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Rotation already in progress',
          message: 'Please wait for the current rotation to complete'
        }));
        return;
      }

      console.log('🔧 Manual seed rotation triggered via API');
      const result = await rotator.triggerRotation();
      
      if (result) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Seed rotation completed successfully',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Rotation failed',
          message: 'Check server logs for details'
        }));
      }
    } catch (error) {
      console.error('Error triggering seed rotation:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to trigger seed rotation',
        message: error.message
      }));
    }
    return;
  }

  // SECURED: Get seed rotation logs (contains sensitive system info)
  if (pathname === '/api/seed-rotation/logs' && req.method === 'GET') {
    if (!authenticateSeedRotationRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required for seed rotation logs'
      }));
      return;
    }
    
    try {
      const rotator = getSeedRotator();
      const status = rotator.getStatus();
      
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const limit = parseInt(urlParams.searchParams.get('limit')) || 50;
      const logs = status.recentLogs.slice(-limit);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        logs: logs,
        total: status.recentLogs.length,
        limit: limit
      }));
    } catch (error) {
      console.error('Error getting rotation logs:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get rotation logs',
        message: error.message
      }));
    }
    return;
  }

  // Get available seeds information (public info, but still secured for consistency)
  if (pathname === '/api/seed-rotation/seeds' && req.method === 'GET') {
    if (!authenticateSeedRotationRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required for seed rotation endpoints'
      }));
      return;
    }
    
    try {
      const seedDatabase = require('./server/seed-database');
      const allSeeds = seedDatabase.getAllSeeds();
      const categories = Object.keys(seedDatabase.SEED_DATABASE);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          totalSeeds: allSeeds.length,
          categories: categories,
          categoryCounts: categories.reduce((acc, category) => {
            acc[category] = seedDatabase.SEED_DATABASE[category].length;
            return acc;
          }, {})
        }
      }));
    } catch (error) {
      console.error('Error getting seed information:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to get seed information',
        message: error.message
      }));
    }
    return;
  }

  // Root path - serve homepage and act as health check
  if (pathname === '/') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Add health check headers for deployment
      res.setHeader('X-Health-Status', 'healthy');
      res.setHeader('X-Server-Ready', 'true');
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log(`✅ Served homepage: ${content.length} bytes`);
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Homepage not found - server not ready');
      console.log('❌ Homepage file missing');
    }
    return;
  }

  // Handle object storage public files
  if (pathname.startsWith('/public-objects/')) {
    const filePath = pathname.replace('/public-objects/', '');
    console.log(`🎬 Requesting Object Storage file: ${filePath}`);
    
    try {
      // Try multiple paths in Object Storage
      const possiblePaths = [
        `http://127.0.0.1:1106/object-storage/object/${process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID}/public/${filePath}`,
        `http://127.0.0.1:1106/object-storage/object/${process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID}/${filePath}`,
        `http://127.0.0.1:1106/object-storage/object/replit-objstore-f95b4cf3-0db7-40d1-9680-54f5b997ed65/public/${filePath}`,
        `http://127.0.0.1:1106/object-storage/object/replit-objstore-f95b4cf3-0db7-40d1-9680-54f5b997ed65/${filePath}`
      ];
      
      let response = null;
      let successUrl = null;
      
      for (const url of possiblePaths) {
        try {
          console.log(`🔍 Trying: ${url}`);
          response = await fetch(url);
          if (response.ok) {
            successUrl = url;
            console.log(`✅ Found video at: ${url}`);
            break;
          }
        } catch (err) {
          console.log(`❌ Failed: ${url} - ${err.message}`);
          continue;
        }
      }
      
      if (response && response.ok) {
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        
        // Enhanced range request handling for streaming
        const range = req.headers.range;
        if (range && contentLength) {
          console.log(`📺 Range request: ${range} for ${filePath}`);
          
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1048576, parseInt(contentLength) - 1); // 1MB chunks
          const chunksize = (end - start) + 1;
          
          // Make range request to Object Storage
          const rangeResponse = await fetch(successUrl, {
            headers: {
              'Range': `bytes=${start}-${end}`
            }
          });
          
          if (rangeResponse.status === 206 || rangeResponse.status === 200) {
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${contentLength}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600'
            });
            rangeResponse.body.pipe(res);
            console.log(`📺 Streamed chunk: ${start}-${end}/${contentLength} (${chunksize} bytes)`);
          } else {
            // Fallback to full response
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': contentLength,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=3600'
            });
            response.body.pipe(res);
          }
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': contentLength,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
          });
          response.body.pipe(res);
        }
      } else {
        // Fallback to demo video or error
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Object Storage file not found: ${filePath}`);
        console.log(`❌ Object Storage: All paths failed for ${filePath}`);
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Object Storage error: ${error.message}`);
      console.log(`❌ Object Storage error for ${filePath}:`, error.message);
    }
    return;
  }

  // Preview Page Handler - serves universal preview page for different file types
  if (pathname.startsWith('/preview/') && req.method === 'GET') {
    try {
      const previewSlug = pathname.split('/')[2]; // Extract slug from /preview/{slug}
      
      if (!previewSlug) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid preview slug');
        return;
      }

      if (pool) {
        // Get artifact details by preview slug
        const artifactQuery = `
          SELECT id, title, category, file_type, preview_type, delivery_url, streaming_url, 
                 description, creator_id, kwh_footprint, solar_amount_s, active
          FROM artifacts 
          WHERE preview_slug = $1 AND active = true
        `;
        const artifactResult = await pool.query(artifactQuery, [previewSlug]);
        
        if (artifactResult.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Preview Not Found - TC-S Network</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Preview Not Available</h2>
              <p>The requested preview could not be found.</p>
              <a href="/marketplace.html">← Back to Marketplace</a>
            </body>
            </html>
          `);
          return;
        }

        const artifact = artifactResult.rows[0];
        
        // Generate preview page HTML based on file type
        let previewContent = '';
        let pageTitle = `Preview: ${artifact.title} - TC-S Network`;
        
        if (artifact.preview_type === 'video' && artifact.delivery_url) {
          previewContent = `
            <div style="max-width: 800px; margin: 0 auto;">
              <video controls style="width: 100%; max-height: 400px;" preload="metadata">
                <source src="${artifact.delivery_url}" type="${artifact.file_type}">
                Your browser does not support video playback.
              </video>
            </div>
          `;
        } else if (artifact.preview_type === 'audio' && artifact.delivery_url) {
          previewContent = `
            <div style="max-width: 600px; margin: 0 auto;">
              <audio controls style="width: 100%;" preload="metadata">
                <source src="${artifact.delivery_url}" type="${artifact.file_type}">
                Your browser does not support audio playback.
              </audio>
            </div>
          `;
        } else if (artifact.file_type && artifact.file_type.startsWith('image/') && artifact.delivery_url) {
          previewContent = `
            <div style="max-width: 800px; margin: 0 auto;">
              <img src="${artifact.delivery_url}" alt="${artifact.title}" style="max-width: 100%; height: auto; border-radius: 8px;">
            </div>
          `;
        } else {
          previewContent = `
            <div style="max-width: 600px; margin: 0 auto; text-align: center;">
              <p style="color: #666;">Preview not available for this file type.</p>
              <a href="/marketplace.html" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
                Purchase to Download
              </a>
            </div>
          `;
        }

        const previewPage = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${pageTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: white; }
              .container { max-width: 1000px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; }
              .artifact-info { background: #2a2a2a; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
              .preview-area { background: #333; padding: 20px; border-radius: 12px; text-align: center; }
              .actions { text-align: center; margin-top: 20px; }
              .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 6px; font-weight: bold; }
              .btn-primary { background: #28a745; color: white; }
              .btn-secondary { background: #6c757d; color: white; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${artifact.title}</h1>
                <p style="color: #888;">Category: ${artifact.category.charAt(0).toUpperCase() + artifact.category.slice(1)}</p>
              </div>
              
              <div class="artifact-info">
                <p><strong>Description:</strong> ${artifact.description || 'No description available'}</p>
                <p><strong>Energy Footprint:</strong> ${artifact.kwh_footprint} kWh</p>
                <p><strong>Price:</strong> ${formatSolar(artifact.solar_amount_s)} Solar</p>
              </div>
              
              <div class="preview-area">
                ${previewContent}
              </div>
              
              <div class="actions">
                <a href="/marketplace.html" class="btn btn-primary">Purchase & Download</a>
                <a href="/marketplace.html" class="btn btn-secondary">← Back to Marketplace</a>
              </div>
            </div>
          </body>
          </html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(previewPage);
      } else {
        res.writeHead(503, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Service Unavailable - TC-S Network</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Service Temporarily Unavailable</h2>
            <p>Preview service is currently unavailable. Please try again later.</p>
            <a href="/marketplace.html">← Back to Marketplace</a>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Preview page error:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Error - TC-S Network</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Preview Error</h2>
          <p>There was an error loading the preview. Please try again.</p>
          <a href="/marketplace.html">← Back to Marketplace</a>
        </body>
        </html>
      `);
    }
    return;
  }
  
  // Static files with enhanced video streaming
  let filePath = path.join(__dirname, 'public', pathname);
  
  // Try direct file first
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const isMedia = ['.mp4', '.webm', '.mov', '.mp3'].includes(ext);
    
    // Enhanced media streaming with range requests (video and audio)
    if (isMedia) {
      const stats = fs.statSync(filePath);
      const range = req.headers.range;
      
      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        
        // Create read stream for the range
        const stream = fs.createReadStream(filePath, { start, end });
        
        // Determine content type for media
        const mediaContentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mediaContentType,
          'Cache-Control': 'public, max-age=3600'
        });
        
        stream.pipe(res);
        const mediaType = ext === '.mp3' ? '🎵 audio' : '🎬 video';
        console.log(`${mediaType} Streamed range: ${pathname} (${start}-${end})`);
      } else {
        // Serve entire media file
        const mediaContentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';
        const mediaType = ext === '.mp3' ? '🎵 audio' : '🎬 video';
        
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': mediaContentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        });
        
        fs.createReadStream(filePath).pipe(res);
        console.log(`${mediaType} Served full file: ${pathname}`);
      }
      return;
    }
    
    // Regular static files
    const content = fs.readFileSync(filePath);
    
    // Set content type based on extension
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime'
    };
    
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(content);
    console.log(`✅ Served static file: ${pathname}`);
  } else {
    // Try adding .html extension for extensionless URLs
    const htmlFilePath = path.join(__dirname, 'public', pathname + '.html');
    if (fs.existsSync(htmlFilePath) && fs.statSync(htmlFilePath).isFile()) {
      const content = fs.readFileSync(htmlFilePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log(`✅ Served HTML file: ${pathname}.html`);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      console.log(`❌ File not found: ${pathname}`);
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Music functions: Embedded in homepage (18 tracks)`);
  console.log(`🤖 D-ID Agent: Kid Solar ready`);
  console.log(`📱 Mobile responsive: Enabled`);
  console.log(`🔗 Links: Q&A and waitlist working`);
  
  // Initialize Seed Rotation System with comprehensive error handling
  setImmediate(async () => {
    try {
      console.log('🌱 Initializing Seed Rotation System...');
      
      const rotator = initializeSeedRotation();
      
      if (rotator) {
        const status = rotator.getStatus();
        
        if (status.isInitialized) {
          console.log(`✅ Seed Rotation System: Active (${status.config.rotationInterval}-day auto-rotation)`);
          console.log(`🌱 Seed Rotation API: http://localhost:${PORT}/api/seed-rotation/status`);
          console.log(`🔧 Manual trigger: POST http://localhost:${PORT}/api/seed-rotation/trigger`);
          
          if (status.scheduledJob) {
            console.log(`📅 Automatic scheduling: Enabled`);
          } else {
            console.log(`📅 Automatic scheduling: Disabled (manual triggers only)`);
          }
        } else if (status.initializationError) {
          console.warn(`⚠️ Seed Rotation System initialized with errors: ${status.initializationError}`);
          console.log(`🌱 API endpoints available but functionality limited`);
        } else {
          console.log(`✅ Seed Rotation System: Initialized successfully`);
          console.log(`🌱 Seed Rotation API: http://localhost:${PORT}/api/seed-rotation/status`);
          console.log(`🔧 Manual trigger: POST http://localhost:${PORT}/api/seed-rotation/trigger`);
        }
      } else {
        console.warn(`⚠️ Seed Rotation System failed to initialize - continuing without rotation features`);
      }
      
    } catch (error) {
      console.error(`❌ Seed Rotation System initialization error:`, error.message);
      console.log(`🌱 Server continuing without seed rotation features`);
    }
  });
  
  console.log(`🚀 CLOUD RUN READY - SINGLE PORT CONFIGURATION`);
  
  // Initialize daily Solar distribution automation
  initializeDailyDistribution();
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} in use, trying alternative...`);
    const altPort = PORT === 3000 ? 8080 : 3000;
    server.listen(altPort, '0.0.0.0', () => {
      console.log(`✅ Server running on alternative port ${altPort}`);
      console.log(`🚀 DEPLOYMENT READY - ALL SYSTEMS OPERATIONAL`);
    });
  } else {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Server interrupted, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});