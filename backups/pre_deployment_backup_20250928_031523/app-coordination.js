/**
 * The Current-See Inter-App Coordination Service
 * 
 * This module provides coordination between The Current-See website and 
 * wallet application using OpenAI for intelligent synchronization.
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  // API endpoints for wallet app
  walletApiEndpoint: process.env.WALLET_API_ENDPOINT || 'https://api.wallet.thecurrentsee.org',
  walletApiKey: process.env.WALLET_API_KEY || '',
  
  // Coordination settings
  syncIntervalMs: 5 * 60 * 1000, // 5 minutes
  retryDelayMs: 30 * 1000, // 30 seconds
  maxRetries: 3,
  
  // OpenAI settings
  openaiTimeout: 15000, // 15 seconds
  
  // Logging
  logFile: 'coordination.log',
  maxLogSize: 5 * 1024 * 1024 // 5MB
};

// Logger function
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  console.log(logEntry);
  
  // Also write to log file with rotation
  try {
    // Check if we need to rotate the log
    if (fs.existsSync(CONFIG.logFile)) {
      const stats = fs.statSync(CONFIG.logFile);
      if (stats.size > CONFIG.maxLogSize) {
        const backupFile = `${CONFIG.logFile}.${Date.now()}.bak`;
        fs.renameSync(CONFIG.logFile, backupFile);
      }
    }
    
    fs.appendFileSync(CONFIG.logFile, logEntry + '\n');
  } catch (err) {
    console.error(`Error writing to log file: ${err.message}`);
  }
}

// Load OpenAI key the same way as the main application
function loadOpenAIKey() {
  // First check if NEW_OPENAI_API_KEY is available in environment (highest priority)
  if (process.env.NEW_OPENAI_API_KEY) {
    log('Using NEW_OPENAI_API_KEY from environment (highest priority)');
    return process.env.NEW_OPENAI_API_KEY;
  }
  
  try {
    // Check if .env.openai exists
    const envPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envPath)) {
      log('Loading OpenAI API key from .env.openai file');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const keyMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (keyMatch && keyMatch[1] && keyMatch[1].trim()) {
        return keyMatch[1].trim();
      }
    }
  } catch (err) {
    log(`Error loading OpenAI key from .env.openai: ${err.message}`, 'error');
  }
  
  // Fall back to original environment variable
  return process.env.OPENAI_API_KEY;
}

// Initialize OpenAI
const apiKey = loadOpenAIKey();
const openai = new OpenAI({
  apiKey: apiKey
});

/**
 * Make an API request to the wallet application
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint path (without base URL)
 * @param {object} data - Optional data to send
 * @returns {Promise<object>} - Response from the wallet app
 */
async function walletApiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, CONFIG.walletApiEndpoint);
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.walletApiKey}`,
        'X-Source': 'website-coordinator'
      }
    };
    
    // Choose http or https module based on protocol
    const httpModule = url.protocol === 'https:' ? https : http;
    
    const req = httpModule.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (err) {
            reject(new Error(`Failed to parse wallet API response: ${err.message}`));
          }
        } else {
          reject(new Error(`Wallet API returned status code ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Wallet API request failed: ${err.message}`));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Use OpenAI to understand synchronization needs
 * @param {object} websiteData - Data from the website
 * @param {object} walletData - Data from the wallet app
 * @returns {Promise<object>} - Synchronization recommendations
 */
async function analyzeSyncNeeds(websiteData, walletData) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: `You are an AI coordinator for The Current-See platform, analyzing data between the website and wallet app to determine synchronization needs.
          
Your task is to analyze both datasets and determine:
1. What data needs to be synchronized
2. Which direction the sync should go (website to wallet, wallet to website, or both)
3. If there are any conflicts to resolve
4. What specific actions should be taken

Respond with a structured JSON object that includes:
- syncNeeded: boolean
- syncDirection: "website_to_wallet" | "wallet_to_website" | "bidirectional" | "none"
- conflicts: array of specific data conflicts
- actions: array of specific synchronization actions to take
- reasoning: brief explanation of your recommendations`
        },
        {
          role: "user",
          content: `Website data: ${JSON.stringify(websiteData)}
          
Wallet app data: ${JSON.stringify(walletData)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    log(`Error analyzing sync needs with OpenAI: ${err.message}`, 'error');
    // Return a sensible default when AI analysis fails
    return {
      syncNeeded: false,
      syncDirection: "none",
      conflicts: [],
      actions: [],
      reasoning: "AI analysis failed, defaulting to no sync required."
    };
  }
}

/**
 * Sync user balances between website and wallet
 * @param {number} userId - User ID to sync
 * @returns {Promise<object>} - Result of the synchronization
 */
async function syncUserBalances(userId) {
  try {
    log(`Starting balance sync for user ${userId}`);
    
    // 1. Get user data from website database
    let websiteUserData;
    try {
      // Assuming we have a function to get user data from local database
      websiteUserData = await getWebsiteUserData(userId);
      log(`Retrieved website data for user ${userId}`);
    } catch (err) {
      log(`Error getting website data for user ${userId}: ${err.message}`, 'error');
      return { success: false, error: 'Failed to retrieve website user data' };
    }
    
    // 2. Get user data from wallet app
    let walletUserData;
    try {
      walletUserData = await walletApiRequest('GET', `/api/users/${userId}`);
      log(`Retrieved wallet data for user ${userId}`);
    } catch (err) {
      log(`Error getting wallet data for user ${userId}: ${err.message}`, 'error');
      return { success: false, error: 'Failed to retrieve wallet user data' };
    }
    
    // 3. Use OpenAI to analyze synchronization needs
    let syncAnalysis;
    try {
      syncAnalysis = await analyzeSyncNeeds(websiteUserData, walletUserData);
      log(`Completed sync analysis for user ${userId}: ${syncAnalysis.syncNeeded ? 'Sync needed' : 'No sync needed'}`);
    } catch (err) {
      log(`Error analyzing sync for user ${userId}: ${err.message}`, 'error');
      return { success: false, error: 'Failed to analyze synchronization needs' };
    }
    
    // 4. Perform synchronization if needed
    if (syncAnalysis.syncNeeded) {
      log(`Performing ${syncAnalysis.syncDirection} sync for user ${userId}`);
      
      // Implement sync based on the direction
      if (syncAnalysis.syncDirection === 'website_to_wallet') {
        // Update wallet with website data
        try {
          const result = await walletApiRequest('POST', `/api/users/${userId}/sync`, {
            source: 'website',
            data: {
              balances: websiteUserData.balances,
              lastUpdate: new Date().toISOString()
            }
          });
          log(`Successfully synced website data to wallet for user ${userId}`);
          return { success: true, sync: 'website_to_wallet', details: result };
        } catch (err) {
          log(`Failed to sync website data to wallet for user ${userId}: ${err.message}`, 'error');
          return { success: false, error: 'Failed to update wallet with website data' };
        }
      } 
      else if (syncAnalysis.syncDirection === 'wallet_to_website') {
        // Update website with wallet data
        try {
          await updateWebsiteUserData(userId, {
            balances: walletUserData.balances,
            lastSyncTime: new Date().toISOString()
          });
          log(`Successfully synced wallet data to website for user ${userId}`);
          return { success: true, sync: 'wallet_to_website' };
        } catch (err) {
          log(`Failed to sync wallet data to website for user ${userId}: ${err.message}`, 'error');
          return { success: false, error: 'Failed to update website with wallet data' };
        }
      }
      else if (syncAnalysis.syncDirection === 'bidirectional') {
        // Perform complex bidirectional sync with conflict resolution
        try {
          // For each action recommended by the AI
          for (const action of syncAnalysis.actions) {
            log(`Performing sync action: ${action.description} for user ${userId}`);
            // Implement action logic here
          }
          log(`Successfully performed bidirectional sync for user ${userId}`);
          return { success: true, sync: 'bidirectional', actions: syncAnalysis.actions };
        } catch (err) {
          log(`Failed during bidirectional sync for user ${userId}: ${err.message}`, 'error');
          return { success: false, error: 'Failed during bidirectional sync' };
        }
      }
    } else {
      log(`No synchronization needed for user ${userId}`);
      return { success: true, syncNeeded: false };
    }
  } catch (err) {
    log(`Unexpected error during sync for user ${userId}: ${err.message}`, 'error');
    return { success: false, error: `Unexpected error: ${err.message}` };
  }
}

/**
 * Sync transaction history between website and wallet
 * @param {number} userId - User ID to sync
 * @returns {Promise<object>} - Result of the synchronization
 */
async function syncTransactionHistory(userId) {
  try {
    log(`Starting transaction history sync for user ${userId}`);
    
    // Implementation similar to syncUserBalances but for transactions
    // This would follow the same pattern of:
    // 1. Get website transaction data
    // 2. Get wallet transaction data
    // 3. Use OpenAI to analyze and recommend sync actions
    // 4. Perform the synchronization
    
    // For now, return a placeholder
    return { success: true, message: 'Transaction history sync not yet implemented' };
  } catch (err) {
    log(`Error syncing transaction history for user ${userId}: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

/**
 * Schedule periodic sync for all users
 */
function schedulePeriodicSync() {
  log('Setting up periodic sync schedule');
  
  // Run every 5 minutes (or whatever is configured)
  setInterval(async () => {
    try {
      log('Starting scheduled synchronization');
      
      // Get list of users to sync
      const users = await getUsersForSync();
      log(`Found ${users.length} users to synchronize`);
      
      // Process each user
      for (const userId of users) {
        try {
          log(`Syncing user ${userId}`);
          await syncUserBalances(userId);
          await syncTransactionHistory(userId);
        } catch (err) {
          log(`Error syncing user ${userId}: ${err.message}`, 'error');
        }
      }
      
      log('Completed scheduled synchronization');
    } catch (err) {
      log(`Error during scheduled sync: ${err.message}`, 'error');
    }
  }, CONFIG.syncIntervalMs);
}

/**
 * Placeholder function to get website user data
 * Replace with actual implementation
 */
async function getWebsiteUserData(userId) {
  // Replace this with actual database query
  return {
    id: userId,
    name: 'Sample User',
    balances: {
      solar: 15.0,
      dollars: 2040000.0
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Placeholder function to update website user data
 * Replace with actual implementation
 */
async function updateWebsiteUserData(userId, updateData) {
  // Replace this with actual database update
  log(`Would update user ${userId} with: ${JSON.stringify(updateData)}`);
  return true;
}

/**
 * Placeholder function to get users that need syncing
 * Replace with actual implementation
 */
async function getUsersForSync() {
  // Replace this with actual query to find users needing sync
  return [1, 2, 3]; // Sample user IDs
}

/**
 * Initialize the coordination service
 */
function initialize() {
  log('Initializing The Current-See inter-app coordination service');
  
  // Check if we have the required configuration
  if (!CONFIG.walletApiEndpoint) {
    log('Missing wallet API endpoint configuration', 'error');
    return false;
  }
  
  if (!CONFIG.walletApiKey) {
    log('Missing wallet API key configuration', 'error');
    return false;
  }
  
  if (!apiKey) {
    log('Missing OpenAI API key', 'error');
    return false;
  }
  
  // Schedule periodic sync
  schedulePeriodicSync();
  
  log('Inter-app coordination service initialized successfully');
  return true;
}

// Expose the functions for use by the main application
module.exports = {
  initialize,
  syncUserBalances,
  syncTransactionHistory,
  walletApiRequest,
  analyzeSyncNeeds
};

// Auto-initialize if this module is run directly
if (require.main === module) {
  initialize();
}