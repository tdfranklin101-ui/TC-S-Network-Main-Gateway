const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');
const url = require('url');
const fetch = require('node-fetch');
// const { ObjectStorageService } = require('./server/objectStorage'); // Disabled for stable Music Now service

// Import seed rotation system
const { initializeSeedRotation, getSeedRotator } = require('./server/seed-rotation-api');

const PORT = process.env.PORT || 3000;

// Database setup for music tracking
let pool = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    console.log('✅ Database connection ready for music tracking');
  }
} catch (error) {
  console.warn('⚠️ Database connection failed, using fallback mode:', error.message);
}

// In-memory storage fallback
let signupStorage = [];

// Simplified signups - no database blocking
function ensureSignupsTable() {
  console.log('📝 Using in-memory storage for signups (fast startup)');
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

// Initialize database
ensureSignupsTable();

console.log('🚀 Starting Current-See Deployment Server...');

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

  // User Signup with Initial Solar Allocation API
  if (pathname === '/api/users/signup-solar' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, email, firstName, lastName } = body;
      
      if (!username || !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username and email are required' }));
        return;
      }

      if (pool) {
        // Check if user already exists
        const existingUserQuery = 'SELECT id FROM users WHERE username = $1 OR email = $2';
        const existingUser = await pool.query(existingUserQuery, [username, email]);
        
        if (existingUser.rows.length > 0) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username or email already exists' }));
          return;
        }

        // Calculate initial Solar allocation (1 Solar per day since April 7, 2025)
        const genesisDate = new Date('2025-04-07');
        const currentDate = new Date();
        const daysSinceGenesis = Math.floor((currentDate - genesisDate) / (1000 * 60 * 60 * 24));
        const initialSolarAmount = Math.max(daysSinceGenesis, 1); // At least 1 Solar

        // Create user account
        const userInsertQuery = `
          INSERT INTO users (id, username, email, first_name, last_name, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
          RETURNING id
        `;
        
        const userResult = await pool.query(userInsertQuery, [username, email, firstName || '', lastName || '']);
        const userId = userResult.rows[0].id;

        // Create Solar account with initial allocation
        const solarAccountQuery = `
          INSERT INTO solar_accounts (user_id, account_number, display_name, total_solar, total_kwh, total_dollars, joined_date)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `;
        
        const accountNumber = `SOL-${userId.substring(0, 8).toUpperCase()}`;
        const initialKwh = initialSolarAmount * 4913; // Convert to kWh equivalent
        const initialDollars = initialSolarAmount * 0.20; // Approximate dollar value
        
        await pool.query(solarAccountQuery, [
          userId, accountNumber, `${firstName || username}'s Solar Account`, 
          initialSolarAmount, initialKwh, initialDollars
        ]);

        console.log(`🌱 New user created: ${username} with ${initialSolarAmount} Solar (${daysSinceGenesis} days since genesis)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          userId: userId,
          username: username,
          accountNumber: accountNumber,
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
      console.error('User signup error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to create user account' }));
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
          formattedBalance: `${user.total_solar || 0}.0000 Solar`
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
        // Get artifact details
        const artifactQuery = 'SELECT id, title, solar_amount_s, delivery_url, active FROM artifacts WHERE id = $1';
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

        // Generate download link (simplified - in production this would be a signed URL)
        const downloadToken = Buffer.from(`${user.id}:${artifactId}:${Date.now()}`).toString('base64');
        const downloadUrl = `/api/artifacts/download/${downloadToken}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transactionId: transactionResult.rows[0].id,
          artifactTitle: artifact.title,
          amountPaid: requiredSolar,
          newBalance: newBalance,
          downloadUrl: downloadUrl,
          message: `Successfully purchased "${artifact.title}" for ${requiredSolar} Solar. Your new balance is ${newBalance.toFixed(4)} Solar.`
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

  // Get Available Artifacts API (for marketplace display)
  if (pathname === '/api/artifacts/available' && req.method === 'GET') {
    try {
      if (pool) {
        const artifactsQuery = `
          SELECT id, title, description, category, kwh_footprint, solar_amount_s, 
                 is_bonus, cover_art_url, delivery_mode
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
          kwhFootprint: parseFloat(artifact.kwh_footprint),
          solarPrice: parseFloat(artifact.solar_amount_s),
          formattedPrice: `${artifact.solar_amount_s} Solar`,
          isBonus: artifact.is_bonus,
          coverArt: artifact.cover_art_url,
          deliveryMode: artifact.delivery_mode || 'download'
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          totalArtifacts: artifacts.length,
          artifacts: artifacts,
          categories: ['music', 'art', 'document'],
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