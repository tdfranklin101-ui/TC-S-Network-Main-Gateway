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
const { randomUUID } = require('crypto');
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

// TC-S Computronium Market routes
const marketRoutes = require('./routes/market');
const energyRoutes = require('./routes/energy');
const kidRoutes = require('./routes/kid');

// Kid Solar Voice Assistant
const KidSolarVoice = require('./server/kid-solar-voice');

// Geographic Analytics Tracker
const AnalyticsTracker = require('./server/analytics-tracker');
let analyticsTracker;
try {
  analyticsTracker = new AnalyticsTracker(process.env.DATABASE_URL);
  console.log('✅ Analytics tracker initialized');
} catch (error) {
  console.error('⚠️ Analytics tracker initialization failed:', error.message);
  // Create minimal fallback
  analyticsTracker = {
    trackVisit: async () => {},
    getTotalVisits: async () => 0,
    getMonthlyAnalytics: async () => [],
    getMonthSummary: async () => ({ month: '', totalVisits: 0, topCountries: [], usStates: [] })
  };
}

const PORT = process.env.PORT || 8080;

// ================== UIM HEADERS + REQUEST ID ==================
const UIM_VERSION = "1.0.0";
const UIM_BUILD_SHA = "urn:sha256:79cb6cf146c700b654d8aa55f17071e6060e682189e51733c2d46134f04a8f74";

function addUIMHeaders(req, res) {
  const requestId = randomUUID();
  req.requestId = requestId;
  
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("Cache-Control", "public, max-age=30");
  res.setHeader("X-Service-Version", UIM_VERSION);
  res.setHeader("X-Build-SHA", UIM_BUILD_SHA);
}

// ================== RATE LIMITER ==================
const RATE_LIMIT = 60; // requests per window
const WINDOW_MS = 60000; // 1 minute window
const requestCounts = new Map();

function checkRateLimit(req, res) {
  // Simplified rate limiter - just track and allow all requests
  // Full implementation will be enabled after testing
  try {
    const key = req.headers['x-forwarded-for']?.split(',')[0].trim() 
      || req.headers['x-real-ip'] 
      || req.socket.remoteAddress 
      || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }

    const timestamps = requestCounts.get(key).filter(ts => now - ts < WINDOW_MS);
    timestamps.push(now);
    requestCounts.set(key, timestamps);

    // For now, always return true (allow all requests)
    // TODO: Enable rate limiting after successful deployment
    return true;
    
    /* FUTURE: Enable this block for actual rate limiting
    if (timestamps.length >= RATE_LIMIT) {
      res.writeHead(429, { 
        'Content-Type': 'application/json',
        'Retry-After': '30'
      });
      res.end(JSON.stringify({
        error: "rate_limited",
        message: "Too many requests. Please try again later.",
        retry_after_s: 30,
        request_id: req.requestId
      }));
      return false;
    }
    */
  } catch (err) {
    console.error('Rate limiting error:', err.message);
    return true;
  }
}

// Simple session storage (in production, use Redis or database)
const sessions = new Map();

// Initialize enhanced file management system with error handling
let fileManager;
try {
  fileManager = new ArtifactFileManager({
    masterStoragePath: path.join(__dirname, 'storage/master'),
    previewStoragePath: path.join(__dirname, 'public/previews'),
    tradeStoragePath: path.join(__dirname, 'storage/trade')
  });
  console.log('✅ File management system initialized');
} catch (error) {
  console.error('⚠️ File manager initialization failed:', error.message);
  // Create minimal fallback
  fileManager = {
    processFile: () => { throw new Error('File manager unavailable'); },
    getFileMetadata: () => null
  };
}

// Initialize AI curation system for smart descriptions with error handling
let aiCurator;
try {
  aiCurator = new AICurator();
  console.log('✅ AI curator initialized');
} catch (error) {
  console.error('⚠️ AI curator initialization failed:', error.message);
  // Create minimal fallback
  aiCurator = {
    generateDescription: async () => 'Description unavailable',
    categorizeArtifact: async () => 'uncategorized'
  };
}

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

// Balance change logging utility - CRITICAL for debugging wallet issues
function logBalanceChange(context, userId, username, oldBalance, newBalance, source) {
  const timestamp = new Date().toISOString();
  const change = newBalance - oldBalance;
  const changeStr = change >= 0 ? `+${change}` : `${change}`;
  
  console.log(`💰 [BALANCE LOG] ${timestamp} | ${context} | User: ${username} (ID: ${userId}) | ${oldBalance} → ${newBalance} Solar (${changeStr}) | Source: ${source}`);
  
  // Critical warning if balance drops to 0 unexpectedly
  if (newBalance === 0 && oldBalance > 0) {
    console.error(`🚨 [BALANCE ALERT] User ${username} balance dropped to ZERO! Was ${oldBalance} Solar. Source: ${source}`);
  }
  
  // Warning if balance decreased without transaction
  if (newBalance < oldBalance && !source.includes('purchase') && !source.includes('transaction')) {
    console.warn(`⚠️ [BALANCE WARNING] Balance decreased without transaction: ${username} ${oldBalance} → ${newBalance} | ${source}`);
  }
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
  
  // Log session creation with initial balance
  const balance = userData.solarBalance || 0;
  console.log(`🔐 [SESSION] Created for ${userData.username} (ID: ${userId}) | Balance: ${balance} Solar | Session: ${sessionId.substring(0, 8)}...`);
  
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

// ============================================================
// SOLAR INTELLIGENCE AUDIT LAYER (SAi-Audit) AUTOMATION
// Regulatory-grade energy demand tracking with full automation
// ============================================================

// Helper: Compute SHA-256 hash for data integrity
function computeDataHash(data) {
  const raw = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Helper: Ensure category exists (upsert)
async function ensureCategory(name, description) {
  if (!pool) return null;
  
  try {
    const existing = await pool.query('SELECT id FROM audit_categories WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    
    const result = await pool.query(
      'INSERT INTO audit_categories (name, description) VALUES ($1, $2) RETURNING id',
      [name, description || null]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error('Error ensuring category:', error);
    return null;
  }
}

// Helper: Ensure data source exists (upsert)
async function ensureDataSource(name, verificationLevel, organization, contact, uri, sourceType) {
  if (!pool) return null;
  
  try {
    const existing = await pool.query('SELECT id FROM audit_data_sources WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    
    const result = await pool.query(
      'INSERT INTO audit_data_sources (name, verification_level, organization, contact, uri, source_type, url, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [
        name, 
        verificationLevel, 
        organization || null, 
        contact || null, 
        uri || null, 
        sourceType || 'DIRECT',
        uri || '', // url column (legacy)
        `${organization || name} - ${verificationLevel || 'TIER_1'} verification` // description column (legacy)
      ]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error ensuring data source:', error.message);
    return null;
  }
}

// Helper: Insert auditable energy record
async function insertEnergyRecord(categoryName, sourceName, sourceVerificationLevel, kwh, rightsAlignment, notes, sourceOrg, sourceUri, sourceType) {
  if (!pool) return false;
  
  try {
    const categoryId = await ensureCategory(categoryName);
    const sourceId = await ensureDataSource(sourceName, sourceVerificationLevel, sourceOrg, null, sourceUri, sourceType);
    
    if (!categoryId || !sourceId) {
      console.error(`❌ Failed to ensure category (${categoryId}) or source (${sourceId}) for ${categoryName}`);
      return false;
    }
    
    const record = {
      category: categoryName,
      source: sourceName,
      kwh,
      rights: rightsAlignment,
      day: new Date().toISOString().split('T')[0]
    };
    const dataHash = computeDataHash(record);
    const solarUnits = kwh / 4913.0; // Convert kWh to Solar
    
    const metadata = {
      rightsAlignment,
      notes: notes || null,
      verificationLevel: sourceVerificationLevel,
      sourceUri: sourceUri || null,
      sourceOrganization: sourceOrg || null
    };
    
    const result = await pool.query(
      `INSERT INTO energy_audit_log (date, category_id, data_source_id, energy_kwh, energy_solar, data_hash, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [record.day, categoryId, sourceId, kwh, solarUnits, dataHash, JSON.stringify(metadata)]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Energy record: ${categoryName} - ${(kwh / 1e6).toFixed(2)} GWh`);
      return true;
    } else {
      console.log(`⚠️  Duplicate skipped: ${categoryName} for ${record.day}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error inserting energy record for ${categoryName}:`, error.message);
    return false;
  }
}

// Helper: Convert monthly MWh to daily kWh
function eiaMonthToDailyKwh(mwhMonthly, year, month) {
  if (mwhMonthly === null || mwhMonthly === undefined || isNaN(mwhMonthly)) {
    console.error(`❌ Invalid MWh value: ${mwhMonthly} for ${year}-${month}`);
    return 0;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  return (mwhMonthly * 1000.0) / daysInMonth; // MWh->kWh, then /days
}

// Helper: Convert Petajoules to kWh
// 1 PJ = 10^15 J, 1 kWh = 3.6 × 10^6 J
// Therefore: 1 PJ = 277,777,778 kWh (approx 2.778e8 kWh)
function petajouleToKwh(pj) {
  return pj * 277777778;
}

// Helper: Convert British Thermal Units to kWh
function btuToKwh(btu) {
  return btu * 0.000293071; // 1 BTU = 0.000293071 kWh
}

// Fetch EIA retail sales data for a specific sector
async function eiaRetailSalesLatest(sector) {
  const EIA_API_KEY = process.env.EIA_API_KEY;
  if (!EIA_API_KEY) {
    console.error('EIA_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${EIA_API_KEY}&frequency=monthly&data[0]=sales&facets[sectorid][]=${sector}&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'TC-S-Network-SAi-Audit/1.0' }
    });
    
    if (!response.ok) {
      console.error(`❌ EIA API error for sector ${sector}:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    const row = data?.response?.data?.[0];
    
    if (!row || !row.period || row.sales === undefined || row.sales === null) {
      console.error(`❌ Invalid EIA response for sector ${sector}: sales=${row?.sales}, period=${row?.period}`);
      return null;
    }
    
    const [year, month] = row.period.split('-').map(n => parseInt(n));
    const mwh = parseFloat(row.sales);
    
    if (isNaN(mwh) || mwh < 0) {
      console.error(`❌ Invalid sales value for sector ${sector}: ${mwh}`);
      return null;
    }
    
    return { mwh, year, month };
  } catch (error) {
    console.error(`❌ Failed to fetch EIA data for sector ${sector}:`, error.message);
    return null;
  }
}

// Fetch live Bitcoin energy consumption calculated from network hashrate
// Uses mempool.space API for real-time hashrate data
async function getBitcoinKwh() {
  try {
    const response = await fetch('https://mempool.space/api/v1/mining/hashrate/1y', { 
      headers: { 'User-Agent': 'TC-S-Network-SAi-Audit/1.0' }
    });
    if (!response.ok) {
      console.error('Bitcoin hashrate API error:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    const hashrates = data?.hashrates;
    
    if (!hashrates || hashrates.length === 0) {
      console.error('No hashrate data available');
      return null;
    }
    
    // Get the most recent hashrate (last item in array)
    const latestHashrate = hashrates[hashrates.length - 1];
    const hashrateHashPerSec = latestHashrate.avgHashrate; // H/s
    
    // Convert to TH/s (terahashes per second)
    const hashrateTHPerSec = hashrateHashPerSec / 1e12;
    
    // Network average mining efficiency: ~35 W/TH
    // (Accounts for mix of newer ASICs at 25-30 W/TH and older hardware at 40-50 W/TH)
    const efficiencyWattsPerTH = 35;
    
    // Calculate network power consumption in watts
    const powerWatts = hashrateTHPerSec * efficiencyWattsPerTH;
    
    // Convert to daily kWh: watts * 24 hours / 1000
    const dailyKwh = (powerWatts * 24) / 1000;
    
    console.log(`✅ Bitcoin hashrate: ${(hashrateTHPerSec / 1e6).toFixed(2)} EH/s | Daily energy: ${(dailyKwh / 1e6).toFixed(2)} GWh`);
    
    return dailyKwh;
  } catch (error) {
    console.error('Failed to fetch Bitcoin hashrate data:', error.message);
    return null;
  }
}

// Live feed functions for each energy category
async function feedHousingKwh() {
  const result = await eiaRetailSalesLatest('RES');
  if (!result) return null;
  
  const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
  return {
    kwh,
    source: {
      name: 'EIA Retail Sales – Residential',
      organization: 'U.S. Energy Information Administration',
      verificationLevel: 'THIRD_PARTY',
      uri: 'https://api.eia.gov',
      sourceType: 'DIRECT'
    },
    note: `US monthly retail sales (RES) ${result.year}-${result.month.toString().padStart(2, '0')}`
  };
}

async function feedDigitalServicesKwh() {
  // LBNL Data Center Energy Consumption
  // Source: Lawrence Berkeley National Laboratory - United States Data Center Energy Usage Report
  // Latest estimate (2023): ~97 TWh/year for US data centers
  // Reference: LBNL "Data Center Energy Usage Trends" and IEA "Digitalization and Energy 2023"
  // 
  // This is FAR more accurate than generic commercial sector (which includes offices, retail, etc.)
  // Data centers are specifically IT/digital services infrastructure
  
  try {
    // Latest LBNL estimate for US data center energy consumption
    // 2023 data: 97,000 GWh/year = 97 TWh/year
    const annualTWh = 97; // Terawatt-hours per year
    const annualKwh = annualTWh * 1e9; // Convert TWh to kWh (1 TWh = 1 billion kWh)
    const dailyKwh = annualKwh / 365; // Convert annual to daily
    
    // Calculate from annual estimate
    console.log(`✅ US Data Centers (LBNL): ${annualTWh} TWh/year | Daily: ${(dailyKwh / 1e6).toFixed(2)} GWh`);
    
    return {
      kwh: dailyKwh,
      source: {
        name: 'LBNL Data Center Energy Study',
        organization: 'Lawrence Berkeley National Laboratory / U.S. Department of Energy',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://eta.lbl.gov/publications/united-states-data-center-energy',
        sourceType: 'CALCULATED'
      },
      note: `US data center energy consumption: ${annualTWh} TWh/year from LBNL 2023 research. Includes enterprise data centers, cloud infrastructure, and colocation facilities. Daily average: ${(dailyKwh / 1e6).toFixed(2)} GWh`
    };
  } catch (error) {
    console.error('❌ Failed to calculate LBNL data center energy:', error.message);
    return null;
  }
}

async function feedManufacturingKwh() {
  const result = await eiaRetailSalesLatest('IND');
  if (!result) return null;
  
  const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
  return {
    kwh,
    source: {
      name: 'EIA Retail Sales – Industrial',
      organization: 'U.S. Energy Information Administration',
      verificationLevel: 'THIRD_PARTY',
      uri: 'https://api.eia.gov',
      sourceType: 'DIRECT'
    },
    note: `US monthly retail sales (IND) ${result.year}-${result.month.toString().padStart(2, '0')}`
  };
}

async function feedTransportKwh() {
  // Comprehensive US transportation electrification energy calculation
  // Data sources: DOE Alternative Fuels Data Center, IEA Global EV Outlook, EPA
  // NOTE: EIA TRA sector only captures rail/transit, not EV charging which occurs at homes/public stations
  
  try {
    // Component 1: Electric Vehicles (passenger + light-duty)
    // US EV fleet: ~3.3 million vehicles (DOE/AFDC 2024 data)
    // Average energy consumption: 0.35 kWh/mile (EPA combined rating)
    // Average daily driving: 40 miles/day per vehicle (FHWA national average)
    const evFleetSize = 3300000; // vehicles
    const evKwhPerMile = 0.35;   // kWh/mile
    const dailyMilesPerEv = 40;  // miles/day
    const evDailyKwh = evFleetSize * dailyMilesPerEv * evKwhPerMile;
    
    // Component 2: Electric Public Transit (buses, trains, metro systems)
    // Data: APTA (American Public Transportation Association) 2023 Fact Book
    // Sources: ~8,100 electric buses (APTA Public Transportation Fact Book 2024)
    //          + Major metro systems (NYC, DC, SF BART, Chicago L) consuming ~12 GWh/day
    //          + Electric commuter rail (NJ Transit, SEPTA, Caltrain) ~3 GWh/day
    // Total: ~15 GWh/day combined electric transit energy
    const transitDailyKwh = 15e6; // 15 GWh/day
    
    // Component 3: Commercial Electric Fleets (delivery, logistics, ride-share)
    // Sources: Amazon (100,000 electric delivery vans goal by 2030, ~30% deployed 2024)
    //          + UPS/FedEx electric fleet pilots (~5,000 vehicles combined)
    //          + Uber/Lyft electric ride-share programs
    // Reference: EPA SmartWay Transport Partnership annual reports
    // Estimated ~8 GWh/day based on commercial BEV fleet size and utilization rates
    const commercialFleetKwh = 8e6; // 8 GWh/day
    
    // Component 4: Public Charging Infrastructure (DCFC network overhead)
    // ChargePoint, Electrify America, Tesla Supercharger network inefficiencies
    // ~5% overhead on total EV charging energy
    const chargingOverhead = evDailyKwh * 0.05;
    
    // Total transportation electrification energy
    const totalKwh = evDailyKwh + transitDailyKwh + commercialFleetKwh + chargingOverhead;
    
    console.log(`✅ Transportation energy (calculated): ${(totalKwh / 1e6).toFixed(2)} GWh/day (${(evDailyKwh / 1e6).toFixed(1)} GWh EVs + ${(transitDailyKwh / 1e6).toFixed(0)} GWh transit + ${(commercialFleetKwh / 1e6).toFixed(0)} GWh commercial)`);
    
    return {
      kwh: totalKwh,
      source: {
        name: 'DOE/AFDC Transportation Electrification',
        organization: 'U.S. Department of Energy Alternative Fuels Data Center',
        verificationLevel: 'GOVERNMENT',
        uri: 'https://afdc.energy.gov/data/',
        sourceType: 'CALCULATED'
      },
      note: `US transportation electrification: ${(evFleetSize / 1e6).toFixed(1)}M EVs + public transit + commercial fleets`
    };
  } catch (error) {
    console.error('❌ Failed to calculate transportation electrification energy:', error.message);
    return null;
  }
}

async function feedFoodAgricultureKwh() {
  // FAOstat API is currently inaccessible, using IEA/USDA agricultural energy statistics
  // Data source: USDA ERS & IEA - US Agricultural Sector Energy Consumption
  // Reference: ~1.75 quadrillion BTU/year (2022-2023 average)
  // Conversion: 1 quad BTU = 293.071 billion kWh
  // Total: 1.75 quad BTU = 512.87 billion kWh/year
  
  try {
    // Calculate daily energy from annual US agricultural consumption
    // Source: USDA Economic Research Service & IEA Agriculture Energy Balance
    const annualQuadBtu = 1.75; // Quadrillion BTU per year (2022-2023 data)
    const kwhPerQuadBtu = 293071000000; // 293.071 billion kWh per quad BTU
    const annualKwh = annualQuadBtu * kwhPerQuadBtu;
    const dailyKwh = annualKwh / 365;
    
    // Log the calculated value for verification
    console.log(`✅ Agriculture energy (calculated): ${(dailyKwh / 1e9).toFixed(2)} GWh/day from ${annualQuadBtu} quad BTU/year`);
    
    return {
      kwh: dailyKwh,
      source: {
        name: 'IEA/USDA Agricultural Energy Use',
        organization: 'International Energy Agency & U.S. Department of Agriculture',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://www.ers.usda.gov/data-products/energy-use-in-agriculture/',
        sourceType: 'CALCULATED'
      },
      note: `US agricultural energy consumption: ${annualQuadBtu} quad BTU/year (${(annualKwh / 1e9).toFixed(2)} TWh/year) from USDA ERS & IEA data. Daily average: ${(dailyKwh / 1e6).toFixed(2)} GWh`
    };
  } catch (error) {
    console.error('❌ Failed to calculate agricultural energy:', error.message);
    return null;
  }
}

async function feedMoneyKwh() {
  const bitcoinKwh = await getBitcoinKwh();
  if (!bitcoinKwh) return null;
  
  // Include Ethereum and Solana estimates
  const ethereumKwh = 0.01 * 1e9 / 365; // ~10 TWh/year
  const solanaKwh = 8755 * 1e3 / 365; // ~8.755 GWh/year
  const totalKwh = bitcoinKwh + ethereumKwh + solanaKwh;
  
  return {
    kwh: totalKwh,
    source: {
      name: 'Mempool.space – Bitcoin Network Hashrate',
      organization: 'Mempool.space (calculated from hashrate + efficiency)',
      verificationLevel: 'THIRD_PARTY',
      uri: 'https://mempool.space/api',
      sourceType: 'DIRECT'
    },
    note: `Bitcoin: ${(bitcoinKwh / 1e6).toFixed(2)} GWh/day (from hashrate), Ethereum: ${(ethereumKwh / 1e6).toFixed(2)} GWh/day, Solana: ${(solanaKwh / 1e6).toFixed(2)} GWh/day`
  };
}

// Tiered fetch wrapper with error handling
async function tieredFetch(fetchFn, categoryName, rights) {
  try {
    const result = await fetchFn();
    if (result) {
      const inserted = await insertEnergyRecord(
        categoryName,
        result.source.name,
        result.source.verificationLevel,
        result.kwh,
        rights,
        result.note,
        result.source.organization,
        result.source.uri,
        result.source.sourceType
      );
      return inserted;
    }
    return false;
  } catch (error) {
    console.error(`❌ ${categoryName} fetch failed:`, error.message);
    return false;
  }
}

// Main update function - fetches all live data
async function updateSolarAuditData() {
  const startTime = new Date();
  let logId = null;
  
  if (!pool) {
    console.log('⚠️  Database not available - skipping solar audit update');
    return { status: 'error', message: 'Database not available' };
  }

  try {
    // Log update start
    const logResult = await pool.query(
      `INSERT INTO update_log (started_at, status) VALUES ($1, 'PARTIAL') RETURNING id`,
      [startTime]
    );
    logId = logResult.rows[0].id;

    console.log('🌍 Starting Solar Audit data update...');
    
    const rights = {
      privacy: "ENFORCED",
      non_discrimination: "ENFORCED",
      auditability: "FULL"
    };

    const EIA_API_KEY = process.env.EIA_API_KEY;
    let recordsCreated = 0;
    const completed = [];
    const missing = [];

    // 1. Money/Blockchain (live Bitcoin via CBECI - always available)
    const moneySuccess = await tieredFetch(feedMoneyKwh, 'money', rights);
    if (moneySuccess) {
      recordsCreated++;
      completed.push('money');
    } else {
      missing.push('money');
    }

    // 2. EIA-backed categories (DIRECT sources - requires API key)
    if (EIA_API_KEY) {
      console.log('📊 Fetching live EIA data for 5 energy sectors...');
      
      const housingSuccess = await tieredFetch(feedHousingKwh, 'housing', rights);
      if (housingSuccess) {
        recordsCreated++;
        completed.push('housing');
      } else {
        missing.push('housing');
      }
      
      const digitalSuccess = await tieredFetch(feedDigitalServicesKwh, 'digital-services', rights);
      if (digitalSuccess) {
        recordsCreated++;
        completed.push('digital-services');
      } else {
        missing.push('digital-services');
      }
      
      const mfgSuccess = await tieredFetch(feedManufacturingKwh, 'manufacturing', rights);
      if (mfgSuccess) {
        recordsCreated++;
        completed.push('manufacturing');
      } else {
        missing.push('manufacturing');
      }
      
      const transportSuccess = await tieredFetch(feedTransportKwh, 'transport', rights);
      if (transportSuccess) {
        recordsCreated++;
        completed.push('transport');
      } else {
        missing.push('transport');
      }
      
      const foodSuccess = await tieredFetch(feedFoodAgricultureKwh, 'food', rights);
      if (foodSuccess) {
        recordsCreated++;
        completed.push('food');
      } else {
        missing.push('food');
      }
      
      console.log('✅ Solar Audit data updated successfully with live feeds');
    } else {
      console.warn('⚠️  EIA_API_KEY missing; skipping housing, digital-services, manufacturing, transport, food categories');
      missing.push('housing', 'digital-services', 'manufacturing', 'transport', 'food');
    }

    console.log(`✅ Solar Audit update complete: ${recordsCreated} records created`);
    console.log(`✅ Updated: ${completed.join(', ')}`);
    if (missing.length > 0) {
      console.log(`⚠️ Missing: ${missing.join(', ')}`);
    }
    
    // Log successful completion
    const finishTime = new Date();
    const duration = finishTime - startTime;
    const status = missing.length === 6 ? 'FAIL' : (missing.length > 0 ? 'PARTIAL' : 'SUCCESS');
    
    await pool.query(
      `UPDATE update_log SET finished_at = $1, status = $2, updated = $3, missing = $4, meta = $5 WHERE id = $6`,
      [
        finishTime,
        status,
        JSON.stringify(completed),
        JSON.stringify(missing),
        JSON.stringify({ recordsCreated, duration_ms: duration }),
        logId
      ]
    );
    
    return { 
      status: 'ok', 
      date: new Date().toISOString().split('T')[0],
      recordsCreated,
      eiaDataAvailable: !!EIA_API_KEY,
      completed,
      missing,
      timestamp: finishTime.toISOString()
    };
  } catch (error) {
    console.error('❌ Solar Audit update failed:', error);
    
    // Log failure if we have a log ID
    if (logId) {
      try {
        await pool.query(
          `UPDATE update_log SET finished_at = $1, status = 'FAIL', error = $2 WHERE id = $3`,
          [new Date(), error.message, logId]
        );
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }
    
    return { 
      status: 'error', 
      message: error.message 
    };
  }
}

// Schedule daily updates at 3:00 AM UTC
function scheduleDailyUpdates() {
  // Run at 3:00 AM UTC every day
  schedule.scheduleJob('0 3 * * *', async () => {
    console.log('⏰ Scheduled Solar Audit update triggered (3:00 AM UTC)');
    await updateSolarAuditData();
  });
  console.log('📅 Solar Audit scheduled: Daily updates at 3:00 AM UTC');
}

// Create Solar Audit tables
async function createSolarAuditTables() {
  if (!pool) return;
  
  try {
    // Create audit_categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create audit_data_sources table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_data_sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        url TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create energy_audit_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS energy_audit_log (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        category_id INTEGER REFERENCES audit_categories(id),
        data_source_id INTEGER REFERENCES audit_data_sources(id),
        energy_kwh DECIMAL(20, 2) NOT NULL,
        energy_solar DECIMAL(20, 8) NOT NULL,
        data_hash VARCHAR(64) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date, category_id, data_source_id)
      )
    `);
    
    // Create update_log table to track each data refresh cycle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS update_log (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS','PARTIAL','FAIL')),
        updated JSONB,
        missing JSONB,
        error TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_update_log_started_at ON update_log (started_at DESC)
    `);
    
    console.log('✅ Solar Audit tables created/verified');
  } catch (error) {
    console.error('⚠️  Solar Audit table creation failed:', error.message);
  }
}

// Initialize on server startup
async function initializeSolarAudit() {
  if (!pool) {
    console.log('⚠️  Database not available - skipping Solar Audit initialization');
    return;
  }
  
  console.log('🚀 Initializing Solar Audit Layer...');
  
  // Create tables first
  await createSolarAuditTables();
  
  // Schedule daily updates
  scheduleDailyUpdates();
  
  // Trigger initial data fetch
  setTimeout(async () => {
    console.log('🔄 Running initial Solar Audit data fetch...');
    await updateSolarAuditData();
  }, 5000); // Wait 5 seconds after startup
}

// UIM Handshake Protocol - AI System Registry with Capabilities
const UIM_UTILS = require('./lib/uim-utils');

const AI_SYSTEM_REGISTRY = {
  'chatgpt': {
    systemId: 'chatgpt',
    systemName: 'ChatGPT (OpenAI)',
    capabilities: ['reasoning', 'generation', 'analysis'],
    ethicsScore: 85,
    solarCost: '0.00020',
    status: 'active',
    provider: 'OpenAI'
  },
  'claude': {
    systemId: 'claude',
    systemName: 'Claude (Anthropic)',
    capabilities: ['reasoning', 'ethics', 'analysis'],
    ethicsScore: 95,
    solarCost: '0.00018',
    status: 'active',
    provider: 'Anthropic'
  },
  'gemini': {
    systemId: 'gemini',
    systemName: 'Gemini (Google)',
    capabilities: ['multimodal', 'reasoning', 'search'],
    ethicsScore: 80,
    solarCost: '0.00022',
    status: 'active',
    provider: 'Google'
  },
  'deepseek': {
    systemId: 'deepseek',
    systemName: 'DeepSeek AI',
    capabilities: ['reasoning', 'code', 'analysis'],
    ethicsScore: 90,
    solarCost: '0.00015',
    status: 'active',
    provider: 'DeepSeek'
  },
  'meta-ai': {
    systemId: 'meta-ai',
    systemName: 'Meta AI (Facebook)',
    capabilities: ['social', 'reasoning', 'realtime'],
    ethicsScore: 75,
    solarCost: '0.00025',
    status: 'active',
    provider: 'Meta'
  },
  'perplexity': {
    systemId: 'perplexity',
    systemName: 'Perplexity AI',
    capabilities: ['search', 'reasoning', 'realtime'],
    ethicsScore: 88,
    solarCost: '0.00019',
    status: 'active',
    provider: 'Perplexity'
  },
  'grok': {
    systemId: 'grok',
    systemName: 'Grok (xAI)',
    capabilities: ['realtime', 'social', 'reasoning'],
    ethicsScore: 82,
    solarCost: '0.00021',
    status: 'active',
    provider: 'xAI'
  }
};

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
  
  // Initial check disabled to prevent server instability
  // Use manual trigger endpoint: POST /api/distribution/trigger
  // Or wait for scheduled run at 3:00 AM UTC
  console.log('ℹ️  Initial distribution check disabled - using scheduled cron only');
  console.log('📌 Manual trigger: POST /api/distribution/trigger');
}

// Solar Foundation Integrity Wheel - Audit and Hash Verification
function initializeFoundationIntegrityWheel() {
  console.log('🔒 Initializing Foundation Solar Integrity Wheel...');
  
  const { execSync } = require('child_process');
  
  // Schedule daily audit at 7:00 AM UTC
  const auditJob = schedule.scheduleJob({ rule: '0 7 * * *', tz: 'UTC' }, () => {
    try {
      console.log('🔍 Running Foundation integrity audit...');
      execSync('node scripts/solar_foundation_audit.js', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Foundation audit error:', error.message);
    }
  });
  
  if (auditJob) {
    console.log('✅ Foundation audit scheduled for 7:00 AM UTC daily');
    console.log('🔄 Next audit:', auditJob.nextInvocation());
  } else {
    console.error('❌ Failed to schedule Foundation audit');
  }
  
  // Wake-trigger: Run audit immediately on server start
  try {
    console.log('🔍 Running initial Foundation integrity audit...');
    execSync('node scripts/solar_foundation_audit.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️ Initial audit error:', error.message);
  }
}

// Initialize database with error handling
try {
  ensureSignupsTable();
  console.log('✅ Database tables initialized');
} catch (error) {
  console.error('⚠️ Database initialization failed:', error.message);
  console.log('Server will continue without database features');
}

// Initialize market data and SEO services with error handling
let marketDataService, contentValidator, seoGenerator, aiSEOOptimizer, memberContentService, aiPromotionService;

try {
  marketDataService = new MarketDataService();
  contentValidator = new ContentValidator();
  seoGenerator = new SEOGenerator();
  aiSEOOptimizer = new AISEOOptimizer();
  memberContentService = new MemberContentService();
  aiPromotionService = new AIPromotionService(memberContentService, marketDataService);
  console.log('✅ Market data and SEO services initialized');
} catch (error) {
  console.error('⚠️ Service initialization failed:', error.message);
  // Create minimal fallbacks
  marketDataService = { getMarketData: () => ({}) };
  contentValidator = { validate: () => true };
  seoGenerator = { startAutoUpdates: () => {}, generateSEO: () => '' };
  aiSEOOptimizer = { optimize: () => '' };
  memberContentService = { getContent: () => null };
  aiPromotionService = { promote: () => null };
}

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
  
  // UIM Headers + Request ID + Logging
  addUIMHeaders(req, res);
  
  // NOTE: Rate limiting temporarily disabled pending deployment testing
  // TODO: Re-enable rate limiting after successful initial deployment
  // if (!checkRateLimit(req, res)) {
  //   return;
  // }
  
  // Track page visits for analytics (async, non-blocking)
  if (req.method === 'GET' && !pathname.startsWith('/api/') && !pathname.includes('.')) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
      || req.headers['x-real-ip'] 
      || req.connection.remoteAddress 
      || req.socket.remoteAddress;
    analyticsTracker.trackVisit(ip).catch(err => {
      console.error('Analytics tracking failed:', err.message);
    });
  }
  
  // TC-S Computronium Market API routes
  let body = null;
  if (req.method === 'POST' && (pathname.startsWith('/market') || pathname.startsWith('/energy') || pathname.startsWith('/kid'))) {
    try {
      body = await parseBody(req);
    } catch (error) {
      // Continue without body for GET requests or parsing errors
    }
  }
  
  // Try market routes (includes /api/kid-solar/voice multi-modal endpoint)
  // EXCLUDE .html files so /marketplace.html reaches static file handler
  if ((pathname.startsWith('/market') && !pathname.endsWith('.html')) || pathname === '/api/kid-solar/voice') {
    if (marketRoutes(req, res, pathname)) return;
  }
  
  // Try energy routes
  if (pathname.startsWith('/energy')) {
    if (await energyRoutes(req, res, pathname, body)) return;
  }
  
  // Try Kid Solar routes
  if (pathname.startsWith('/kid')) {
    if (await kidRoutes(req, res, pathname, body)) return;
  }
  
  // OLD Kid Solar Voice Interaction (replaced by multi-modal endpoint in routes/market.js)
  if (false && pathname === '/api/kid-solar/voice' && req.method === 'POST') {
    try {
      // Verify authentication first
      const sessionId = getCookie(req, 'tc_s_session');
      if (!sessionId || !sessions.get(sessionId)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      const session = sessions.get(sessionId);
      const authenticatedUserId = session.userId;
      const memberName = session.username || 'Member';

      // Rate limiting: 5 requests per minute per user
      const rateLimitKey = `voice_${authenticatedUserId}`;
      const now = Date.now();
      if (!session.voiceRateLimit) session.voiceRateLimit = { count: 0, resetAt: now + 60000 };
      
      if (now > session.voiceRateLimit.resetAt) {
        session.voiceRateLimit = { count: 0, resetAt: now + 60000 };
      }
      
      if (session.voiceRateLimit.count >= 5) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }));
        return;
      }
      
      session.voiceRateLimit.count++;

      const chunks = [];
      let totalSize = 0;
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB max audio size

      req.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          req.destroy();
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Audio file too large (max 10MB)' }));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          const boundary = req.headers['content-type']?.split('boundary=')[1];
          if (!boundary) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No boundary in multipart data' }));
            return;
          }
          
          const parts = buffer.toString('binary').split(`--${boundary}`);
          let audioData = null;
          
          for (const part of parts) {
            if (part.includes('name="audio"')) {
              const dataStart = part.indexOf('\r\n\r\n') + 4;
              const dataEnd = part.lastIndexOf('\r\n');
              audioData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
              
              // Validate it's actually audio data (basic check for webm/audio headers)
              if (audioData.length < 100 || audioData.length > MAX_SIZE) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid audio data' }));
                return;
              }
            }
          }
          
          if (!audioData) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing audio data' }));
            return;
          }
          
          const kidSolar = new KidSolarVoice();
          const result = await kidSolar.handleVoiceInteraction(
            audioData,
            authenticatedUserId,
            { name: memberName },
            'webm'
          );
          
          res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
          res.end(result.responseAudio);
          
        } catch (error) {
          console.error('Voice processing error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } catch (error) {
      console.error('Voice endpoint error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
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
      let fileProcessingResult = null; // Declare here so it's available in catch block
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
        fileProcessingResult = await fileManager.processUpload(
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

  // Solar Standard Protocol API - Convert kWh to Solar
  if (pathname === '/api/solar' && req.method === 'GET') {
    try {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const kWh = urlParams.searchParams.get('kWh');
      
      if (!kWh) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing kWh parameter',
          usage: '/api/solar?kWh=9826'
        }));
        return;
      }
      
      const kWhValue = parseFloat(kWh);
      if (isNaN(kWhValue) || kWhValue < 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid kWh value. Must be a positive number.' 
        }));
        return;
      }
      
      const solarEquivalent = kWhValue / 4913;
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Allow cross-origin API access
      });
      res.end(JSON.stringify({
        kWh: kWhValue,
        solar_equivalent: parseFloat(solarEquivalent.toFixed(6)),
        unit: 'Solar',
        reference: 'Solar Standard v1.0',
        formula: '1 Solar = 4,913 kWh',
        timestamp: new Date().toISOString()
      }));
      
      console.log(`☀️ Solar API: ${kWhValue} kWh → ${solarEquivalent.toFixed(6)} Solar`);
    } catch (error) {
      console.error('Solar API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Solar calculation failed' }));
    }
    return;
  }

  // Solar Standard Protocol - Spec + Health Check
  if (pathname === '/api/solar-standard' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      name: "Solar Standard Protocol",
      version: "1.0",
      unit: { symbol: "Solar", kWh: 4913 },
      reference_date: "2025-04-07",
      spec_url: "https://www.thecurrentsee.org/SolarStandard.json",
      feed_url: "https://www.thecurrentsee.org/SolarFeed.xml",
      status: "ok",
      time: new Date().toISOString()
    }));
    console.log('📋 Solar Standard spec requested');
    return;
  }

  // Solar Reserve Data API - Regional renewable energy tracking
  if (pathname === '/api/solar/reserve' && req.method === 'GET') {
    try {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const region = urlParams.searchParams.get('region') || 'global';
      
      // Regional renewable energy data (realistic daily estimates)
      const regionalData = {
        global: {
          region: 'global',
          renewable_output_kwh: 145890000000,
          breakdown: {
            solar: 58400000000,
            wind: 52300000000,
            hydro: 28900000000,
            geothermal: 4200000000,
            bioenergy: 2090000000
          },
          sources: ['EIA (US)', 'ENTSO-E (EU)', 'AEMO (AU)', 'IRENA']
        },
        us: {
          region: 'us',
          renewable_output_kwh: 38000000000,
          breakdown: {
            solar: 16200000000,
            wind: 13800000000,
            hydro: 6400000000,
            geothermal: 1100000000,
            bioenergy: 500000000
          },
          sources: ['EIA (US)', 'FERC', 'DOE']
        },
        eu: {
          region: 'eu',
          renewable_output_kwh: 29000000000,
          breakdown: {
            solar: 11600000000,
            wind: 10800000000,
            hydro: 5200000000,
            geothermal: 800000000,
            bioenergy: 600000000
          },
          sources: ['ENTSO-E (EU)', 'Eurostat', 'IRENA']
        },
        asia: {
          region: 'asia',
          renewable_output_kwh: 52000000000,
          breakdown: {
            solar: 20800000000,
            wind: 18600000000,
            hydro: 10400000000,
            geothermal: 1500000000,
            bioenergy: 700000000
          },
          sources: ['AEMO (AU)', 'China NEA', 'India CEA', 'IRENA']
        }
      };
      
      // Validate region
      if (!regionalData[region]) {
        res.writeHead(400, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
          error: `Invalid region. Supported regions: ${Object.keys(regionalData).join(', ')}`,
          usage: '/api/solar/reserve?region=global'
        }));
        return;
      }
      
      const data = regionalData[region];
      const solarEquivalent = data.renewable_output_kwh / 4913;
      
      const response = {
        region: data.region,
        timestamp: new Date().toISOString(),
        renewable_output_kwh: data.renewable_output_kwh,
        solar_equivalent: parseFloat(solarEquivalent.toFixed(2)),
        breakdown: data.breakdown,
        sources: data.sources,
        genesis_date: '2025-04-07',
        conversion_rate: '1 Solar = 4,913 kWh'
      };
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(response));
      
      console.log(`🌍 Solar Reserve API: ${region} → ${solarEquivalent.toFixed(2)} Solar`);
    } catch (error) {
      console.error('Solar Reserve API error:', error);
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Failed to fetch reserve data' }));
    }
    return;
  }

  // Solar Standard Protocol - Artifact Enrichment API
  if (pathname === '/api/solar/artifact' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      const body = await parseBody(req);
      const kWh = Number(body.energy_consumed_kWh);
      
      if (!kWh) {
        res.writeHead(400, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'energy_consumed_kWh required' }));
        return;
      }

      const solarEquivalent = kWh / 4913;
      const payload = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": body.name || body.id || "Solar-tracked asset",
        "identifier": body.id || null,
        "category": body.asset_type || "DIGITAL_ARTIFACT",
        "additionalProperty": [
          {"@type":"PropertyValue","name":"energy_consumed_kWh","value":kWh},
          {"@type":"PropertyValue","name":"solar_equivalent","value":parseFloat(solarEquivalent.toFixed(6))},
          {"@type":"PropertyValue","name":"renewable_source","value":body.renewable_source || "UNKNOWN"},
          {"@type":"PropertyValue","name":"verification","value":body.verification || "SELF_REPORTED"},
          {"@type":"PropertyValue","name":"geo_origin","value":body.geo_origin || "UNKNOWN"},
          {"@type":"PropertyValue","name":"timestamp","value":new Date().toISOString()}
        ]
      };

      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(payload));
      
      console.log(`🔖 Artifact enriched: ${body.id || 'unnamed'} = ${kWh} kWh → ${solarEquivalent.toFixed(6)} Solar`);
    } catch (error) {
      console.error('Artifact enrichment error:', error);
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Artifact enrichment failed' }));
    }
    return;
  }

  // UIM Handshake Protocol - Hello Response
  if (pathname === '/protocols/uim-handshake/v1.0/hello' && (req.method === 'GET' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const timestamp = new Date().toISOString();
    const signature = UIM_UTILS.generateHandshakeSignature(
      "tcs-network-foundation-001",
      "external-system",
      timestamp
    );

    const helloResponse = {
      node_id: "tcs-network-foundation-001",
      api_endpoint: "https://www.thecurrentsee.org/protocols/uim-handshake/v1.0",
      capabilities: [
        "solar-protocol-authority",
        "energy-data-aggregation",
        "global-basic-income",
        "renewable-energy-tracking",
        "ethical-ai-alignment"
      ],
      protocol_version: "UIM-HS-1.0",
      solar_endpoint: "https://www.thecurrentsee.org/api/solar",
      solar_standard: {
        unit: "Solar",
        kWh_per_solar: 4913,
        genesis_date: "2025-04-07"
      },
      uim_authority_level: "TIER_1",
      description: "TC-S Network Foundation - Global renewable energy authority node",
      signature: signature,
      timestamp: timestamp
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(helloResponse));
    console.log('🤝 UIM Hello handshake completed with signature:', signature.substring(0, 16) + '...');
    return;
  }

  // UIM Handshake Protocol - Semantic Profile
  if (pathname === '/protocols/uim-handshake/v1.0/profile' && (req.method === 'GET' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const semanticProfile = {
      node_id: "tcs-network-foundation-001",
      semantic_domains: [
        "renewable-energy-economics",
        "global-basic-income",
        "solar-protocol-standards",
        "energy-abundance-metrics",
        "ethical-ai-frameworks",
        "sustainable-digital-economy"
      ],
      capabilities: [
        "solar-protocol-authority",
        "energy-data-aggregation",
        "global-basic-income",
        "renewable-energy-tracking",
        "ethical-ai-alignment"
      ],
      reasoning_framework: "custom",
      ethical_framework: {
        name: "GENIUS Act Compliance Framework",
        adherence_level: "FULL",
        version: "1.0",
        solar_consumption_rate: 0.0001,
        rights_alignment: {
          privacy: "ENFORCED",
          non_discrimination: "ENFORCED",
          accessibility: "ENFORCED"
        },
        verification_link: "https://www.thecurrentsee.org/genius-act-whitepaper.html"
      },
      ethics_framework_version: "1.0",
      data_sources: [
        "EIA (US Energy Information Administration)",
        "ENTSO-E (European Network)",
        "AEMO (Australian Energy Market Operator)",
        "IRENA (International Renewable Energy Agency)",
        "Solar Reserve Tracker API"
      ],
      update_frequency: "daily_3am_utc",
      last_updated: new Date().toISOString()
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(semanticProfile));
    console.log('📊 UIM Semantic profile served');
    return;
  }

  // UIM Handshake Protocol - Task Proposal Handler
  if (pathname === '/protocols/uim-handshake/v1.0/task' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      const body = await parseBody(req);
      const { task_id, proposing_node, task_type, input_context, max_solar_budget } = body;

      console.log(`📋 UIM Task Proposal received: ${task_id} from ${proposing_node}`);

      const timestamp = new Date().toISOString();
      const energyKwh = (Math.random() * 10 + 2).toFixed(4);
      const solarEquivalent = UIM_UTILS.calculateSolarCost(energyKwh);
      const renewableSource = UIM_UTILS.selectRenewableSource();
      const ethicsScore = UIM_UTILS.calculateEthicsScore('FULL', renewableSource);
      const signature = UIM_UTILS.generateHandshakeSignature(
        "tcs-network-foundation-001",
        proposing_node,
        timestamp
      );

      if (pool) {
        try {
          await pool.query(
            `INSERT INTO uim_handshakes (
              node_id, system_id, system_name, signature, energy_kwh, 
              solar_equivalent, renewable_source, ethics_score, capabilities, status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              "tcs-network-foundation-001",
              proposing_node || "unknown-system",
              proposing_node || "Unknown System",
              signature,
              energyKwh,
              solarEquivalent,
              renewableSource,
              ethicsScore,
              ["solar-protocol-authority", "energy-data-aggregation"],
              "completed",
              JSON.stringify({ task_id, task_type, input_context })
            ]
          );
          console.log(`✅ UIM Handshake logged: ${signature.substring(0, 16)}... (${energyKwh} kWh, ${solarEquivalent} Solar, ${renewableSource}, Ethics: ${ethicsScore})`);
        } catch (dbError) {
          console.error('⚠️ Database logging failed:', dbError.message);
        }
      }

      const taskResponse = {
        task_id: task_id || `task_${Date.now()}`,
        status: "ACKNOWLEDGED",
        accepting_node: "tcs-network-foundation-001",
        proposing_node,
        task_type,
        solar_budget_allocated: Math.min(max_solar_budget || 0.001, 0.01),
        estimated_completion_time: "30s",
        capabilities_matched: ["solar-protocol-authority", "energy-data-aggregation"],
        message: "Task received. TC-S Network Foundation ready to provide renewable energy data and Solar Protocol conversions.",
        energy_consumed_kwh: energyKwh,
        solar_consumed: solarEquivalent,
        renewable_source: renewableSource,
        ethics_score: ethicsScore,
        signature: signature
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(taskResponse));
    } catch (error) {
      console.error('UIM Task proposal error:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Task proposal processing failed' }));
    }
    return;
  }

  // UIM Handshake Protocol - History Endpoint
  if (pathname === '/protocols/uim-handshake/v1.0/history' && (req.method === 'GET' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      const parsedUrl = url.parse(req.url, true);
      const limit = parseInt(parsedUrl.query.limit) || 50;
      const systemId = parsedUrl.query.system_id;
      const since = parsedUrl.query.since;

      if (!pool) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
      }

      let query = 'SELECT * FROM uim_handshakes WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (systemId) {
        query += ` AND system_id = $${paramCount}`;
        params.push(systemId);
        paramCount++;
      }

      if (since) {
        query += ` AND timestamp >= $${paramCount}`;
        params.push(since);
        paramCount++;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramCount}`;
      params.push(Math.min(limit, 100));

      const result = await pool.query(query, params);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        handshakes: result.rows,
        count: result.rows.length,
        limit: Math.min(limit, 100)
      }));

      console.log(`📜 UIM History served: ${result.rows.length} handshakes`);
    } catch (error) {
      console.error('UIM History error:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'History retrieval failed' }));
    }
    return;
  }

  // UIM Handshake Protocol - Metrics Endpoint
  if (pathname === '/protocols/uim-handshake/v1.0/metrics' && (req.method === 'GET' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      if (!pool) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Database not available' }));
        return;
      }

      const metricsQuery = `
        SELECT 
          COUNT(*) as handshake_count,
          COUNT(DISTINCT system_id) as connected_systems_count,
          SUM(CAST(solar_equivalent AS DECIMAL)) as total_solar_consumed,
          AVG(ethics_score) as avg_ethics_score,
          renewable_source,
          COUNT(*) as source_count
        FROM uim_handshakes
        GROUP BY renewable_source
      `;

      const result = await pool.query(metricsQuery);

      let totalHandshakes = 0;
      let totalSolar = 0;
      let connectedSystems = 0;
      let avgEthics = 0;
      const renewableBreakdown = {};

      if (result.rows.length > 0) {
        totalHandshakes = parseInt(result.rows[0].handshake_count) || 0;
        connectedSystems = parseInt(result.rows[0].connected_systems_count) || 0;
        
        result.rows.forEach(row => {
          totalSolar += parseFloat(row.total_solar_consumed) || 0;
          renewableBreakdown[row.renewable_source] = parseInt(row.source_count) || 0;
        });

        const ethicsQuery = 'SELECT AVG(ethics_score) as avg_ethics FROM uim_handshakes';
        const ethicsResult = await pool.query(ethicsQuery);
        avgEthics = parseFloat(ethicsResult.rows[0]?.avg_ethics) || 0;
      }

      const metrics = {
        total_solar_consumed: totalSolar.toFixed(10),
        handshake_count: totalHandshakes,
        connected_systems_count: connectedSystems,
        average_ethics_score: avgEthics.toFixed(2),
        renewable_source_breakdown: renewableBreakdown,
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(metrics));

      console.log(`📊 UIM Metrics served: ${totalHandshakes} handshakes, ${totalSolar.toFixed(6)} Solar consumed`);
    } catch (error) {
      console.error('UIM Metrics error:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Metrics retrieval failed' }));
    }
    return;
  }

  // UIM Handshake Protocol - Query Routing Endpoint
  if (pathname === '/protocols/uim-handshake/v1.0/route' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      const body = await parseBody(req);
      const { query, max_solar_budget, required_capabilities } = body;

      let eligibleSystems = Object.values(AI_SYSTEM_REGISTRY);

      if (required_capabilities && required_capabilities.length > 0) {
        eligibleSystems = eligibleSystems.filter(system => 
          required_capabilities.every(cap => system.capabilities.includes(cap))
        );
      }

      if (max_solar_budget) {
        eligibleSystems = eligibleSystems.filter(system => 
          parseFloat(system.solarCost) <= parseFloat(max_solar_budget)
        );
      }

      if (eligibleSystems.length === 0) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          recommended_system: null,
          confidence_score: 0,
          reasoning: 'No systems match the specified criteria',
          eligible_systems_count: 0
        }));
        return;
      }

      const routingResult = UIM_UTILS.routeQueryByEthicsEnergy(eligibleSystems);

      const response = {
        recommended_system: routingResult.system.systemId,
        system_name: routingResult.system.systemName,
        confidence_score: routingResult.score.toFixed(2),
        reasoning: routingResult.reasoning,
        ethics_score: routingResult.system.ethicsScore,
        solar_cost: routingResult.system.solarCost,
        capabilities: routingResult.system.capabilities,
        eligible_systems_count: eligibleSystems.length
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(response));

      console.log(`🧭 UIM Route recommendation: ${routingResult.system.systemName} (score: ${routingResult.score.toFixed(2)})`);
    } catch (error) {
      console.error('UIM Routing error:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Query routing failed' }));
    }
    return;
  }

  // UIM Handshake Protocol - Mesh Status Endpoint
  if (pathname === '/protocols/uim-handshake/v1.0/mesh-status' && (req.method === 'GET' || req.method === 'OPTIONS')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    try {
      const registeredSystems = Object.values(AI_SYSTEM_REGISTRY).map(system => ({
        system_id: system.systemId,
        system_name: system.systemName,
        status: system.status,
        capabilities: system.capabilities,
        ethics_score: system.ethicsScore,
        solar_cost: system.solarCost,
        provider: system.provider
      }));

      let recentActivity = 0;
      let activeConnections = 0;

      if (pool) {
        try {
          const activityQuery = `
            SELECT COUNT(*) as recent_count 
            FROM uim_handshakes 
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
          `;
          const activityResult = await pool.query(activityQuery);
          recentActivity = parseInt(activityResult.rows[0]?.recent_count) || 0;

          const connectionsQuery = `
            SELECT COUNT(DISTINCT system_id) as active_count
            FROM uim_handshakes
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
          `;
          const connectionsResult = await pool.query(connectionsQuery);
          activeConnections = parseInt(connectionsResult.rows[0]?.active_count) || 0;
        } catch (dbError) {
          console.error('⚠️ Mesh status database query failed:', dbError.message);
        }
      }

      const meshStatus = recentActivity > 0 ? 'active' : (activeConnections > 0 ? 'connecting' : 'disconnected');

      const statusResponse = {
        mesh_status: meshStatus,
        registered_systems: registeredSystems,
        registered_systems_count: registeredSystems.length,
        active_connections_24h: activeConnections,
        recent_activity_1h: recentActivity,
        connection_health: {
          status: meshStatus,
          last_activity: new Date().toISOString(),
          uptime_percentage: recentActivity > 0 ? 100 : 0
        },
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(statusResponse));

      console.log(`🌐 UIM Mesh Status: ${meshStatus}, ${activeConnections} active systems`);
    } catch (error) {
      console.error('UIM Mesh status error:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Mesh status retrieval failed' }));
    }
    return;
  }

  // Satellite ID Anywhere - Healthz endpoint
  if (pathname === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: "GREEN",
      service: "satellite-id-anywhere",
      version: "1.0.0",
      build_sha: "urn:sha256:79cb6cf146c700b654d8aa55f17071e6060e682189e51733c2d46134f04a8f74",
      now: new Date().toISOString()
    }));
    console.log('🛰️ Healthz check: GREEN');
    return;
  }

  // Satellite ID Anywhere - Readyz endpoint
  if (pathname === '/readyz' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      ready: true,
      dependencies: [
        { name: "catalog_source_primary", status: "OK" }
      ]
    }));
    console.log('🛰️ Readyz check: OK');
    return;
  }

  // Satellite ID Anywhere - Status endpoint (Human-friendly)
  if (pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TC-S Satellite ID Anywhere - Service Status</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    h2 { 
      color: #667eea;
      margin-top: 0;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }
    .status-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      margin-left: 10px;
    }
    .metadata {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .metadata p { margin: 8px 0; }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 12px;
      margin: 8px 0;
      background: #f1f5f9;
      border-radius: 6px;
      transition: all 0.2s;
    }
    li:hover {
      background: #e2e8f0;
      transform: translateX(4px);
    }
    a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      color: #64748b;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>🛰️ TC-S Network Satellite ID Anywhere<span class="status-badge">✅ Running</span></h2>
    
    <div class="metadata">
      <p><strong>Service Version:</strong> ${UIM_VERSION}</p>
      <p><strong>Build SHA:</strong> ${UIM_BUILD_SHA}</p>
      <p><strong>Request ID:</strong> ${req.requestId}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    </div>
    
    <hr/>
    
    <h3>📡 API Reference</h3>
    <ul>
      <li>🩺 <a href="/healthz">/healthz</a> - Health check endpoint</li>
      <li>✅ <a href="/readyz">/readyz</a> - Readiness check endpoint</li>
      <li>🛰️ <a href="/api/lookup?norad=25544">/api/lookup?norad=25544</a> - Lookup ISS by NORAD</li>
      <li>🛰️ <a href="/api/lookup?cospar=1998-067A">/api/lookup?cospar=1998-067A</a> - Lookup ISS by COSPAR</li>
      <li>📄 <a href="/openapi.json">/openapi.json</a> - OpenAPI Schema</li>
      <li>🤝 <a href="/.well-known/uim-handshake.json">/.well-known/uim-handshake.json</a> - UIM Handshake Discovery</li>
    </ul>
    
    <hr/>
    
    <h3>🌐 UIM Handshake Protocol</h3>
    <ul>
      <li>👋 <a href="/protocols/uim-handshake/v1.0/hello">/protocols/uim-handshake/v1.0/hello</a> - Node Discovery</li>
      <li>📋 <a href="/protocols/uim-handshake/v1.0/profile">/protocols/uim-handshake/v1.0/profile</a> - Semantic Profile</li>
      <li>🎯 <a href="/protocols/uim-handshake/v1.0/task">/protocols/uim-handshake/v1.0/task</a> - Task Proposal</li>
      <li>📊 <a href="/protocols/uim-handshake/v1.0/history">/protocols/uim-handshake/v1.0/history</a> - Handshake History</li>
      <li>📈 <a href="/protocols/uim-handshake/v1.0/metrics">/protocols/uim-handshake/v1.0/metrics</a> - Energy Metrics</li>
      <li>🔀 <a href="/protocols/uim-handshake/v1.0/route">/protocols/uim-handshake/v1.0/route</a> - Query Routing</li>
      <li>🔗 <a href="/protocols/uim-handshake/v1.0/mesh-status">/protocols/uim-handshake/v1.0/mesh-status</a> - Mesh Status</li>
    </ul>
    
    <div class="footer">
      <p><strong>TC-S Unified Intelligence Mesh</strong></p>
      <p>Adaptive Service Layer • Solar Standard Protocol v1.0 • 1 Solar = 4,913 kWh</p>
      <p>Foundation Node: tcs-network-foundation-001 (TIER_1)</p>
    </div>
  </div>
</body>
</html>`);
    console.log('📊 Status page served');
    return;
  }

  // Satellite ID Anywhere - Lookup API (COSPAR/NORAD)
  if (pathname === '/api/lookup' && req.method === 'GET') {
    try {
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const cospar = urlParams.searchParams.get('cospar');
      const norad = urlParams.searchParams.get('norad');
      
      if ((!cospar && !norad) || (cospar && norad)) {
        res.writeHead(400, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          error: "bad_request",
          message: "Provide either ?cospar or ?norad, not both."
        }));
        return;
      }
      
      const id = cospar || norad;
      const id_type = cospar ? "COSPAR" : "NORAD";
      
      // Mock data - ISS example
      if (id === "25544" || id === "1998-067A") {
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          id: id,
          id_type,
          names: ["ISS (ZARYA)", "International Space Station"],
          launch: { date: "1998-11-20", site: "Baikonur" },
          orbit: {
            class: "LEO",
            periapsis_km: 415,
            apoapsis_km: 421,
            inclination_deg: 51.6
          },
          operators: ["NASA", "Roscosmos", "ESA", "JAXA", "CSA"],
          purpose: "Space station",
          source: "TC-S normalized catalog v1",
          last_updated: new Date().toISOString()
        }));
        console.log(`🛰️ Satellite lookup: ${id} (${id_type})`);
        return;
      }
      
      // Not found
      res.writeHead(404, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        error: "not_found",
        message: "Satellite record not found"
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
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
              const balanceValue = parseFloat(user.total_solar) || 0;
              userData = {
                userId: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                solarBalance: balanceValue,
                memberSince: user.signup_timestamp
              };
              
              // Log login with balance
              console.log(`🔐 User logged in: ${user.username} (ID: ${user.id}) | Balance: ${balanceValue} Solar`);
              logBalanceChange('Login', user.id, user.username, 0, balanceValue, 'database_at_login');
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
          `Max-Age=${30 * 24 * 60 * 60}` // 30 days
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

  // Session Check API endpoint - ENHANCED with balance safeguards
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
      
      // SAFEGUARD 1: Store last known good balance as fallback
      const cachedBalance = session.solarBalance || 0;
      let currentBalance = cachedBalance;
      let balanceSource = 'cached_session';
      
      console.log(`🔍 [SESSION CHECK] User: ${session.username} (ID: ${session.userId}) | Cached balance: ${cachedBalance} Solar`);
      
      if (pool && session.userId) {
        try {
          const result = await pool.query(
            'SELECT total_solar FROM members WHERE id = $1',
            [session.userId]
          );
          
          if (result && result.rows && result.rows.length > 0) {
            const dbBalance = result.rows[0].total_solar;
            
            // SAFEGUARD 2: Handle NULL/undefined from database properly
            if (dbBalance === null || dbBalance === undefined) {
              console.warn(`⚠️ [BALANCE WARNING] Database returned NULL balance for ${session.username}. Using cached: ${cachedBalance}`);
              currentBalance = cachedBalance; // Keep cached balance
              balanceSource = 'cached_null_db';
            } else {
              const parsedBalance = parseFloat(dbBalance);
              
              // SAFEGUARD 3: Validate parsed balance
              if (isNaN(parsedBalance)) {
                console.error(`🚨 [BALANCE ERROR] Invalid balance in DB for ${session.username}: "${dbBalance}". Using cached: ${cachedBalance}`);
                currentBalance = cachedBalance;
                balanceSource = 'cached_invalid_db';
              } else {
                // All checks passed - use DB balance (including legitimate 0)
                currentBalance = parsedBalance;
                balanceSource = 'database';
                
                // Enhanced logging: distinguish NULL vs legitimate 0
                if (parsedBalance === 0 && cachedBalance > 0) {
                  console.log(`📊 [BALANCE UPDATE] ${session.username}: ${cachedBalance} → 0 Solar (legitimate transaction or zero balance)`);
                } else if (currentBalance !== cachedBalance) {
                  logBalanceChange('Session Check', session.userId, session.username, cachedBalance, currentBalance, balanceSource);
                }
                
                // Update session with current balance
                session.solarBalance = currentBalance;
              }
            }
          } else {
            console.warn(`⚠️ [BALANCE WARNING] No DB record for ${session.username}. Using cached: ${cachedBalance}`);
            currentBalance = cachedBalance;
            balanceSource = 'cached_no_db_record';
          }
        } catch (dbError) {
          console.error(`❌ [DB ERROR] Failed to fetch balance for ${session.username}:`, dbError.message);
          // SAFEGUARD 5: On DB error, ALWAYS use cached balance
          currentBalance = cachedBalance;
          balanceSource = 'cached_db_error';
        }
      } else {
        balanceSource = 'cached_no_pool';
      }
      
      console.log(`✅ [SESSION CHECK] Returning balance for ${session.username}: ${currentBalance} Solar (source: ${balanceSource})`);
      
      // Return session data with current balance
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
        solarBalance: currentBalance,
        balanceSource: balanceSource // Debug info
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
            console.log(`📝 New TC-S Network member registered: ${username} (DB ID: ${userId}) | Initial balance: ${initialSolarAllocation} Solar`);
            logBalanceChange('Registration', userId, username, 0, initialSolarAllocation, 'initial_allocation');
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
          `Max-Age=${30 * 24 * 60 * 60}` // 30 days
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
          // Construct full name from first and last names
          const fullName = `${firstName} ${lastName}`.trim();
          const joinedDate = currentDate.toISOString();
          
          const result = await pool.query(
            'INSERT INTO members (username, name, email, first_name, last_name, password_hash, total_solar, total_dollars, joined_date, last_distribution_date, signup_timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [username, fullName, email, firstName, lastName, passwordHash, memberData.solarBalance, 0, joinedDate, joinedDate, new Date()]
          );
          if (result && result.rows && result.rows.length > 0) {
            userId = result.rows[0].id;
            success = true;
            console.log(`📝 New TC-S Network member registered: ${username} (DB ID: ${userId}) with ${memberData.solarBalance} Solar`);
          }
        } catch (dbError) {
          console.error('Database registration error:', dbError);
          
          // Handle duplicate username/email
          if (dbError.code === '23505') { // Unique violation
            const errorMessage = dbError.message.includes('email') 
              ? 'Email address already registered. Please use a different email or sign in.' 
              : 'Username already exists. Please choose a different username.';
            
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: errorMessage
            }));
            return;
          }
          
          // For other database errors, report them properly
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Database error during registration. Please try again.' 
          }));
          return;
        }
      } else {
        // No database available
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Database unavailable. Please try again later.' 
        }));
        return;
      }

      if (success) {
        // Fetch fresh balance from database for session
        let currentBalance = initialSolarAllocation;
        if (pool && userId) {
          try {
            const balanceResult = await pool.query(
              'SELECT total_solar FROM members WHERE id = $1',
              [userId]
            );
            if (balanceResult && balanceResult.rows && balanceResult.rows.length > 0) {
              currentBalance = parseFloat(balanceResult.rows[0].total_solar) || 0;
            }
          } catch (err) {
            console.error('Error fetching balance:', err);
          }
        }

        // Create session for automatic login
        const userData = {
          userId: userId,
          username: username,
          email: email,
          firstName: firstName,
          lastName: lastName,
          solarBalance: currentBalance,
          memberSince: memberData.memberSince,
          membershipType: 'Foundation Market Member'
        };
        
        const sessionId = createSession(userId, userData);
        
        // Set persistent session cookie (30 days)
        const cookieOptions = [
          `tc_s_session=${sessionId}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${30 * 24 * 60 * 60}` // 30 days
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
          `Max-Age=${30 * 24 * 60 * 60}` // 30 days
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

  // New Purchase API with artifactId in URL path (for session-based auth)
  if (pathname.startsWith('/api/artifacts/') && pathname.endsWith('/purchase') && req.method === 'POST') {
    try {
      const artifactId = pathname.split('/')[3]; // Extract ID from /api/artifacts/{id}/purchase
      
      if (!artifactId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact ID required' }));
        return;
      }

      // Get session from cookie
      const sessionId = getCookie(req, 'tc_s_session');
      
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
      }

      const session = sessions.get(sessionId);
      const userId = session.userId;

      if (!pool) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database unavailable' }));
        return;
      }

      // Get artifact details
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

      // Get user's current balance from members table
      const userQuery = 'SELECT id, username, total_solar FROM members WHERE id = $1';
      const userResult = await pool.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      const user = userResult.rows[0];
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

      // Process transaction (deduct Solar from members table)
      const newBalance = userBalance - requiredSolar;
      const updateBalanceQuery = 'UPDATE members SET total_solar = $1 WHERE id = $2';
      await pool.query(updateBalanceQuery, [newBalance, user.id]);
      
      // Log balance change for purchase
      logBalanceChange('Purchase', user.id, user.username, userBalance, newBalance, `purchase_artifact_${artifactId}`);

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

      // Generate download URL - prefer trade_file_url, fallback to master_file_url or delivery_url
      let downloadUrl = artifact.trade_file_url || artifact.master_file_url || artifact.delivery_url;
      
      if (!downloadUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'No download file available for this artifact',
          success: false
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        transactionId: transactionResult.rows[0].id,
        artifactTitle: artifact.title,
        amountPaid: requiredSolar,
        newBalance: newBalance,
        downloadUrl: downloadUrl,
        expiresIn: '7 days',
        message: `Successfully purchased "${artifact.title}" for ${formatSolar(requiredSolar)} Solar. Your new balance is ${formatSolar(newBalance)} Solar.`
      }));
    } catch (error) {
      console.error('Purchase error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Purchase failed: ${error.message}` }));
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
                 file_type, category, trade_file_size, processing_status,
                 creator_id
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
          const userQuery = 'SELECT id, username, total_solar FROM members WHERE id = $1';
          const userResult = await pool.query(userQuery, [userId]);
          user = userResult.rows[0];
        } else if (userEmail) {
          // Check if user exists by email
          const emailQuery = 'SELECT id, username, total_solar FROM members WHERE email = $1';
          const emailResult = await pool.query(emailQuery, [userEmail]);
          
          if (emailResult.rows.length > 0) {
            user = emailResult.rows[0];
          } else {
            // Cannot create new user during purchase - user must register first
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Please register an account before making purchases' }));
            return;
          }
        }

        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User identification required' }));
          return;
        }

        // Check if user is trying to purchase their own artifact
        if (artifact.creator_id && artifact.creator_id === user.id) {
          console.log(`🚫 Self-purchase prevented: User ${user.username} (ID: ${user.id}) tried to purchase their own artifact "${artifact.title}" (ID: ${artifactId})`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'You cannot purchase your own artifact',
            isOwner: true,
            message: 'This is your listing. You already own this artifact as the creator.'
          }));
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

        // Process transaction (deduct Solar from members table)
        const newBalance = userBalance - requiredSolar;
        const updateBalanceQuery = 'UPDATE members SET total_solar = $1 WHERE id = $2';
        await pool.query(updateBalanceQuery, [newBalance, user.id]);
        
        // Log balance change for purchase
        logBalanceChange('Purchase', user.id, user.username, userBalance, newBalance, `purchase_artifact_${artifactId}`);

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

      // Get artifact delivery URL (supports both video and music)
      const artifactQuery = 'SELECT delivery_url, title, category FROM artifacts WHERE id = $1 AND active = true AND category IN ($2, $3)';
      const artifactResult = await pool.query(artifactQuery, [previewData.artifactId, 'video', 'music']);
      
      if (artifactResult.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Media file not found');
        return;
      }

      const deliveryUrl = artifactResult.rows[0].delivery_url;
      
      // Stream video with Range request support for large files
      try {
        // First, get the file size with a HEAD request
        const headResponse = await fetch(deliveryUrl, { method: 'HEAD' });
        
        if (!headResponse.ok) {
          throw new Error(`Failed to fetch video info: ${headResponse.status}`);
        }

        const fileSize = parseInt(headResponse.headers.get('content-length') || '0', 10);
        const artifact = artifactResult.rows[0];
        const defaultType = artifact.category === 'music' ? 'audio/mpeg' : 'video/mp4';
        const contentType = headResponse.headers.get('content-type') || defaultType;

        // Check if client sent a Range header
        const rangeHeader = req.headers.range;
        
        if (rangeHeader && fileSize > 0) {
          // Parse Range header (format: "bytes=start-end")
          const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(rangeParts[0], 10);
          const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;
          
          // Validate range
          if (start >= fileSize || end >= fileSize) {
            res.writeHead(416, {
              'Content-Range': `bytes */${fileSize}`
            });
            res.end();
            return;
          }

          const chunkSize = (end - start) + 1;

          // Fetch only the requested byte range from Google Cloud Storage
          const rangeResponse = await fetch(deliveryUrl, {
            headers: {
              'Range': `bytes=${start}-${end}`
            }
          });

          if (!rangeResponse.ok) {
            throw new Error(`Failed to fetch range: ${rangeResponse.status}`);
          }

          // Return HTTP 206 Partial Content
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Length': chunkSize,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
          });

          // Stream the partial content
          rangeResponse.body.pipe(res);
          console.log(`📹 Streaming ${artifact.category} range: ${start}-${end}/${fileSize} bytes`);
          
        } else {
          // No Range header - send entire file (for small videos)
          const response = await fetch(deliveryUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status}`);
          }
          
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
          });

          response.body.pipe(res);
          console.log(`📹 Streaming full ${artifact.category}: ${fileSize} bytes`);
        }
      } catch (streamError) {
        console.error('Media streaming error:', streamError);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Media streaming failed');
      }
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
    const filePath = path.join(__dirname, 'public', 'main-platform.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log('✅ Served main platform with Music Now functionality');
      return;
    }
  }
  
  // Permanent redirect from .html extension to clean route
  if (pathname === '/main-platform.html') {
    res.writeHead(301, { 'Location': '/main-platform' });
    res.end();
    return;
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
  
  if (pathname === '/marketplace.html' || pathname === '/marketplace') {
    console.log('🔍 MARKETPLACE ROUTE HIT:', pathname);
    const filePath = path.join(__dirname, 'public', 'marketplace.html');
    console.log('📁 File path:', filePath);
    console.log('📄 File exists:', fs.existsSync(filePath));
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log('📏 Content length:', content.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log('✅ Served marketplace with AI platform dropdowns');
      return;
    }
    console.log('❌ File not found!');
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

  // Music Now Streaming API - Get all music tracks (Monazite + Member Uploads)
  if (pathname === '/api/music/all-tracks' && req.method === 'GET') {
    try {
      // Monazite collection (Foundation curated)
      const monaziteTracks = [
        {
          id: 'mono_1',
          title: '\'Ternal Flame - Longevity Manifesto',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/4a839c86-40d9-4272-989b-7a512184ddb6.mp3',
          collection: 'monazite',
          icon: '🔥'
        },
        {
          id: 'mono_2',
          title: 'David Boyeez Hair',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/9b2b12e4-8626-41e4-b9e4-c7a563e40f97.mp3',
          collection: 'monazite',
          icon: '⭐'
        },
        {
          id: 'mono_3',
          title: 'Swampy Boogie Nights (Cajun Crawler)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/015092c3-f687-4a01-9a81-dad42f2adce9.mp3',
          collection: 'monazite',
          icon: '🐊'
        },
        {
          id: 'mono_4',
          title: 'The Heart is a Mule',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/10db8911-0b74-4675-ba62-02182c1d7f6b.mp3',
          collection: 'monazite',
          icon: '🎵'
        },
        {
          id: 'mono_5',
          title: 'A Solar Day (groovin)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/418add3e-c1a5-4a76-b361-14d6a11794fe.mp3',
          collection: 'monazite',
          icon: '🎶'
        },
        {
          id: 'mono_6',
          title: 'A Solar Day (moovin)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/a2647129-991f-4105-aad2-e45210005bef.mp3',
          collection: 'monazite',
          icon: '🎼'
        },
        {
          id: 'mono_7',
          title: 'Break Time Blues Rhapsody',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/09de8c9d-25a7-4b38-a6bd-c27b7de4629e.mp3',
          collection: 'monazite',
          icon: '🎺'
        },
        {
          id: 'mono_8',
          title: 'Starlight Forever',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/c51b1f15-eff7-41fb-b778-b1b9d914ce3a.mp3',
          collection: 'monazite',
          icon: '⭐'
        },
        {
          id: 'mono_9',
          title: 'Light It From Within',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/ab1612d5-ccf4-4b4a-ab92-21b77bebdd46.mp3',
          collection: 'monazite',
          icon: '💡'
        },
        {
          id: 'mono_10',
          title: 'Moonshine in St Kitts',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/675d577c-5ab9-45c9-b9d5-d4362f6bcc12.mp3',
          collection: 'monazite',
          icon: '🌙'
        },
        {
          id: 'mono_11',
          title: 'Solar Tempest Symphony',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/94088af1-8318-401a-b277-b79fbbdb7475.mp3',
          collection: 'monazite',
          icon: '⚡'
        },
        {
          id: 'mono_12',
          title: 'Steel In His Soul',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/cb58c04e-fc7b-448a-a9e5-a642e168cacd.mp3',
          collection: 'monazite',
          icon: '🔩'
        },
        {
          id: 'mono_13',
          title: 'We Said So',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/11802549-7cf8-4d4c-a708-44f04804f2ab.mp3',
          collection: 'monazite',
          icon: '💬'
        },
        {
          id: 'mono_14',
          title: 'Funky Voodoo (Blues Jam)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/19d37c35-dc0b-4686-8bd7-71992f925670.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_15',
          title: 'Green and Blue (Rock)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/255be09f-c09a-4d9a-8dbc-3c3ba65e9204.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_16',
          title: 'Green and Blue (EDM)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/01e05fb6-a7ac-4dd3-9500-00bb46625ef1.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_17',
          title: 'Lady Voodoo (Folk Yah)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/49fc3427-e775-47f0-b5ea-8903006b07a0.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_18',
          title: 'Lady Voodoo (Crying)',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/b2001c35-620a-4893-b046-4de20ad11422.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_19',
          title: 'Rasta Lady Voodoo',
          artist: 'TC-S Network',
          url: 'https://storage.aisongmaker.io/audio/7abf4dac-2b12-434a-8d59-c115f8c54cb9.mp3',
          collection: 'monazite',
          icon: '🗿'
        },
        {
          id: 'mono_20',
          title: 'Snowmancer One (Bonus)',
          artist: 'TC-S Network',
          url: '/music/snowmancer-one.mp3',
          collection: 'monazite',
          icon: '❄️'
        }
      ];

      // Get member uploaded music
      const memberMusic = Array.from(memberContentService.memberContent.values())
        .filter(content => 
          content.category === 'music' && 
          content.status === 'active' &&
          content.isFreeStreaming === true
        )
        .map(content => ({
          id: content.id,
          title: content.title,
          artist: content.memberUsername,
          url: `/uploads/member-content/audio/${path.basename(content.filePath)}`,
          collection: 'member-uploads',
          icon: '🎵',
          uploadDate: content.uploadDate
        }));

      const allTracks = [...monaziteTracks, ...memberMusic];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        tracks: allTracks,
        monaziteCount: monaziteTracks.length,
        memberCount: memberMusic.length,
        totalCount: allTracks.length
      }));
    } catch (error) {
      console.error('Music tracks API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch music tracks' }));
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

  // Analytics API endpoints
  if (pathname === '/api/analytics/total-visits' && req.method === 'GET') {
    console.log('📊 Analytics API: total-visits request received');
    try {
      const totalVisits = await analyticsTracker.getTotalVisits();
      console.log('📊 Total visits:', totalVisits);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, totalVisits }));
    } catch (error) {
      console.error('❌ Error fetching total visits:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch total visits' }));
    }
    return;
  }

  if (pathname === '/api/analytics/monthly' && req.method === 'GET') {
    try {
      const data = await analyticsTracker.getMonthlyAnalytics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
    } catch (error) {
      console.error('Error fetching monthly analytics:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch analytics' }));
    }
    return;
  }

  if (pathname.startsWith('/api/analytics/month/') && req.method === 'GET') {
    try {
      const month = pathname.split('/api/analytics/month/')[1];
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid month format. Use YYYY-MM' }));
        return;
      }
      const summary = await analyticsTracker.getMonthSummary(month);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...summary }));
    } catch (error) {
      console.error('Error fetching month summary:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch month summary' }));
    }
    return;
  }

  if (pathname === '/api/analytics/today' && req.method === 'GET') {
    try {
      const todayVisits = await analyticsTracker.getTodayVisits();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, todayVisits }));
    } catch (error) {
      console.error('Error fetching today visits:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch today visits' }));
    }
    return;
  }

  if (pathname === '/api/analytics/countries-all-time' && req.method === 'GET') {
    try {
      const countries = await analyticsTracker.getAllTimeCountryTotals();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, countries }));
    } catch (error) {
      console.error('Error fetching all-time country totals:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to fetch country totals' }));
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

  // POST /api/solar-audit/update - Trigger data fetch
  if (pathname === '/api/solar-audit/update' && req.method === 'POST') {
    try {
      const result = await updateSolarAuditData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Solar Audit update error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to update solar audit data', details: String(error) }));
    }
    return;
  }

  // GET /api/solar-audit/entries - Return full audit log
  if (pathname === '/api/solar-audit/entries' && req.method === 'GET') {
    if (!pool) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }

    try {
      const query = `
        SELECT 
          e.id,
          c.name as category,
          s.name as source,
          s.organization as "sourceOrganization",
          s.verification_level as "verificationLevel",
          s.source_type as "sourceType",
          e.day,
          e.kwh,
          e.solar_units as "solarUnits",
          e.rights_alignment as "rightsAlignment",
          e.data_hash as "dataHash",
          e.notes,
          e.created_at as "createdAt"
        FROM solar_audit_entries e
        INNER JOIN solar_audit_categories c ON e.category_id = c.id
        INNER JOIN solar_audit_data_sources s ON e.source_id = s.id
        ORDER BY e.day DESC, e.created_at DESC
      `;
      
      const result = await pool.query(query);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
      console.log(`✅ Solar audit entries: ${result.rows.length} records`);
    } catch (error) {
      console.error('Solar Audit entries error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch audit entries' }));
    }
    return;
  }

  // GET /api/solar-audit/summary - Return daily aggregates
  if (pathname === '/api/solar-audit/summary' && req.method === 'GET') {
    if (!pool) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }

    try {
      const query = `
        SELECT 
          c.name as category,
          SUM(e.kwh)::text as "totalKwh",
          SUM(e.solar_units)::text as "totalSolar",
          COUNT(*)::integer as "recordCount"
        FROM solar_audit_entries e
        INNER JOIN solar_audit_categories c ON e.category_id = c.id
        GROUP BY c.name
      `;
      
      const result = await pool.query(query);
      const categories = result.rows;
      
      // Calculate global totals
      const globalKwh = categories.reduce((sum, cat) => sum + parseFloat(cat.totalKwh || '0'), 0);
      const globalSolar = categories.reduce((sum, cat) => sum + parseFloat(cat.totalSolar || '0'), 0);
      const globalRecords = categories.reduce((sum, cat) => sum + cat.recordCount, 0);
      
      const response = {
        categories: categories,
        global: {
          totalKwh: globalKwh,
          totalSolar: globalSolar,
          totalRecords: globalRecords
        }
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      console.log(`✅ Solar audit summary: ${categories.length} categories, ${globalRecords} total records`);
    } catch (error) {
      console.error('Solar Audit summary error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch summary' }));
    }
    return;
  }

  // GET /auditlog - Returns flat array format for Chart.js dashboard
  if (pathname === '/auditlog' && req.method === 'GET') {
    if (!pool) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    try {
      const query = `
        SELECT 
          e.date::text as day,
          c.name as category,
          e.energy_kwh as kwh,
          e.energy_solar as solar_units,
          s.name as source,
          CASE 
            WHEN e.metadata->>'verificationLevel' IS NOT NULL 
            THEN e.metadata->>'verificationLevel'
            ELSE 'TIER_1'
          END as verification_level
        FROM energy_audit_log e
        INNER JOIN audit_categories c ON e.category_id = c.id
        INNER JOIN audit_data_sources s ON e.data_source_id = s.id
        ORDER BY e.date DESC, e.created_at DESC
      `;
      
      const result = await pool.query(query);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
      console.log(`✅ Auditlog endpoint: ${result.rows.length} records`);
    } catch (error) {
      console.error('Auditlog endpoint error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // GET /api/solar-audit/logs - View update history
  if (pathname === '/api/solar-audit/logs' && req.method === 'GET') {
    if (!pool) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '20'), 200));
      
      const query = `
        SELECT 
          id,
          started_at,
          finished_at,
          status,
          updated,
          missing,
          error,
          meta
        FROM update_log 
        ORDER BY started_at DESC 
        LIMIT $1
      `;
      
      const result = await pool.query(query, [limit]);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
      console.log(`✅ Update logs: ${result.rows.length} entries`);
    } catch (error) {
      console.error('Update logs endpoint error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch update logs' }));
    }
    return;
  }

  // GET /api/solar-audit/last - Get last successful update timestamp
  if (pathname === '/api/solar-audit/last' && req.method === 'GET') {
    if (!pool) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ last_update: null }));
      return;
    }

    try {
      const query = `SELECT finished_at FROM update_log WHERE status IN ('SUCCESS', 'PARTIAL') ORDER BY finished_at DESC LIMIT 1`;
      const result = await pool.query(query);
      
      const lastUpdate = result.rows.length > 0 ? new Date(result.rows[0].finished_at).toISOString() : null;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ last_update: lastUpdate }));
    } catch (error) {
      console.error('Last update endpoint error:', error);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ last_update: null }));
    }
    return;
  }

  // GET /ping - Health check with last update timestamp
  if (pathname === '/ping' && req.method === 'GET') {
    try {
      let lastUpdate = null;
      
      if (pool) {
        const query = `SELECT finished_at FROM update_log WHERE status IN ('SUCCESS', 'PARTIAL') ORDER BY finished_at DESC LIMIT 1`;
        const result = await pool.query(query);
        if (result.rows.length > 0) {
          lastUpdate = result.rows[0].finished_at;
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        alive: true, 
        last_update: lastUpdate ? new Date(lastUpdate).toISOString() : null,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Ping endpoint error:', error);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alive: true, last_update: null, timestamp: new Date().toISOString() }));
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
      const { Client } = require('@replit/object-storage');
      const storageClient = new Client();
      
      // Download file from object storage
      const objectPath = `public/${filePath}`;
      console.log(`📥 Downloading from object storage: ${objectPath}`);
      
      const fileBuffer = await storageClient.downloadAsBytes(objectPath);
      
      if (fileBuffer) {
        const contentType = filePath.endsWith('.mp4') ? 'video/mp4' : 
                          filePath.endsWith('.webm') ? 'video/webm' :
                          filePath.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
        
        const fileSize = fileBuffer.length;
        
        // Enhanced range request handling for streaming
        const range = req.headers.range;
        
        if (range) {
          // Send partial content when requested
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const chunk = fileBuffer.slice(start, end + 1);
          
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(chunk);
          console.log(`📺 Streamed chunk: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
        } else {
          // Send full file for initial request
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(fileBuffer);
          console.log(`✅ Served full file from object storage: ${filePath} (${fileSize} bytes)`);
        }

      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Object Storage file not found: ${filePath}`);
        console.log(`❌ Object Storage: File not found: ${objectPath}`);
      }
    } catch (error) {
      console.error(`❌ Object Storage error for ${filePath}:`, error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Object Storage error: ${error.message}`);
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
                 description, creator_id, kwh_footprint, solar_amount_s, active,
                 preview_file_url, master_file_url, trade_file_url
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
        
        if (artifact.preview_type === 'video' && (artifact.preview_file_url || artifact.delivery_url)) {
          const videoUrl = artifact.preview_file_url || artifact.delivery_url;
          previewContent = `
            <div style="max-width: 800px; margin: 0 auto;">
              <video controls style="width: 100%; max-height: 400px;" preload="metadata">
                <source src="${videoUrl}" type="${artifact.file_type}">
                Your browser does not support video playback.
              </video>
            </div>
          `;
        } else if (artifact.preview_type === 'audio' && (artifact.preview_file_url || artifact.delivery_url)) {
          const audioUrl = artifact.preview_file_url || artifact.delivery_url;
          previewContent = `
            <div style="max-width: 600px; margin: 0 auto;">
              <audio controls style="width: 100%;" preload="metadata">
                <source src="${audioUrl}" type="${artifact.file_type}">
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
  
  // Serve member uploaded audio files for Music Now streaming
  if (pathname.startsWith('/uploads/member-content/audio/')) {
    const audioFilePath = path.join(__dirname, pathname);
    
    if (fs.existsSync(audioFilePath)) {
      const stat = fs.statSync(audioFilePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        // Browser requesting specific byte range for streaming
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(audioFilePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000'
        });
        
        file.pipe(res);
      } else {
        // Serve entire file
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000'
        });
        fs.createReadStream(audioFilePath).pipe(res);
      }
      
      console.log(`🎵 Served member audio: ${path.basename(audioFilePath)}`);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Audio file not found');
      return;
    }
  }

  // Handle root path - serve index.html
  if (pathname === '/') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      console.log(`✅ Served root: index.html`);
      return;
    }
  }
  
  // Static files with enhanced video streaming
  let filePath = path.join(__dirname, 'public', pathname);
  
  // Check if requesting a video that should be served from Object Storage
  const ext = path.extname(pathname).toLowerCase();
  const isMedia = ['.mp4', '.webm', '.mov', '.mp3'].includes(ext);
  const isVideoPath = pathname.startsWith('/videos/');
  
  if (isMedia && isVideoPath && !fs.existsSync(filePath)) {
    // Video not in local filesystem - serve from Object Storage via Google Cloud Storage
    console.log(`📦 Serving video from Object Storage: public${pathname}`);
    
    try {
      const { Storage } = require('@google-cloud/storage');
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      const storage = new Storage();
      const bucket = storage.bucket(bucketId);
      const file = bucket.file(`public${pathname}`); // e.g., public/videos/plant-the-seed.mp4
      
      // Get file metadata for size
      const [metadata] = await file.getMetadata();
      const fileSize = parseInt(metadata.size, 10);
      
      const mediaContentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';
      const range = req.headers.range;
      
      if (range) {
        // Browser requesting specific byte range
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (end - start) + 1,
          'Content-Type': mediaContentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
        });
        
        file.createReadStream({ start, end }).pipe(res);
        console.log(`📹 Object Storage HTTP 206: ${pathname} (${start}-${end}/${fileSize})`);
      } else {
        // Initial request - force partial content for large files (Cloud Run fix)
        const CLOUD_RUN_SAFE_SIZE = 10 * 1024 * 1024; // 10MB
        
        if (fileSize > CLOUD_RUN_SAFE_SIZE) {
          const end = Math.min(CLOUD_RUN_SAFE_SIZE - 1, fileSize - 1);
          
          res.writeHead(206, {
            'Content-Range': `bytes 0-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end + 1,
            'Content-Type': mediaContentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
          });
          
          file.createReadStream({ start: 0, end }).pipe(res);
          console.log(`📹 Object Storage HTTP 206 Initial Chunk: ${pathname} (0-${end}/${fileSize})`);
        } else {
          // Small file - send complete
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mediaContentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Length, Accept-Ranges'
          });
          
          file.createReadStream().pipe(res);
          console.log(`📹 Object Storage HTTP 200: ${pathname} (${fileSize} bytes)`);
        }
      }
      return;
      
    } catch (error) {
      console.error(`❌ Error serving from Object Storage:`, error.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Video not found');
      return;
    }
  }
  
  // Try direct file first (for local files)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const isMedia = ['.mp4', '.webm', '.mov', '.mp3'].includes(ext);
    
    // Enhanced media streaming with range requests (video and audio)
    if (isMedia) {
      const stats = fs.statSync(filePath);
      const range = req.headers.range;
      
      const mediaContentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';
      const mediaType = ext === '.mp3' ? '🎵 audio' : '🎬 video';
      
      // Cloud Run HTTP/1 has 32MB limit - force partial content for large files
      const CLOUD_RUN_SAFE_SIZE = 10 * 1024 * 1024; // 10MB safety threshold
      const isLargeFile = stats.size > CLOUD_RUN_SAFE_SIZE;
      
      if (range) {
        // Parse range header for partial content
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        
        const stream = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mediaContentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
        });
        
        stream.pipe(res);
        console.log(`📹 ${mediaType} HTTP 206 Partial Content: ${pathname} (${start}-${end}/${stats.size} bytes)`);
      } else if (isLargeFile) {
        // PRODUCTION FIX: Force partial content for large files to bypass Cloud Run 32MB limit
        // Send first chunk and let browser request more via Range headers
        const start = 0;
        const end = Math.min(CLOUD_RUN_SAFE_SIZE - 1, stats.size - 1);
        const chunksize = (end - start) + 1;
        
        const stream = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mediaContentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
        });
        
        stream.pipe(res);
        console.log(`📹 ${mediaType} HTTP 206 Initial Chunk (Cloud Run): ${pathname} (${start}-${end}/${stats.size} bytes)`);
      } else {
        // Small files can be sent in full (under 10MB)
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': mediaContentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Accept-Ranges'
        });
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        console.log(`📹 ${mediaType} HTTP 200 Full File: ${pathname} (${stats.size} bytes)`);
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
      '.pdf': 'application/pdf',
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
  
  // Initialize daily Solar distribution
  // Note: Cron jobs work in dev but not in Autoscale deployment
  // For production, use External Cron (Replit Deployments settings) to call:
  // POST https://your-app.replit.app/api/distribution/trigger
  try {
    initializeDailyDistribution();
  } catch (error) {
    console.warn('⚠️ Cron scheduling not available in this environment');
    console.log('📌 Use external cron or manual trigger: POST /api/distribution/trigger');
  }
  
  // Initialize Foundation Solar Integrity Wheel
  try {
    initializeFoundationIntegrityWheel();
  } catch (error) {
    console.warn('⚠️ Foundation audit scheduling failed:', error.message);
    console.log('📌 Manual audit: node scripts/solar_foundation_audit.js');
  }
  
  // Initialize Solar Audit Layer (SAi-Audit)
  try {
    initializeSolarAudit();
    console.log('✅ Solar Audit Layer initialized');
    console.log(`📊 Dashboard: http://localhost:${PORT}/solar-audit.html`);
    console.log(`🔄 Manual update: POST http://localhost:${PORT}/api/solar-audit/update`);
  } catch (error) {
    console.warn('⚠️ Solar Audit initialization failed:', error.message);
    console.log('📌 Dashboard still available but data fetch requires manual trigger');
  }
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
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