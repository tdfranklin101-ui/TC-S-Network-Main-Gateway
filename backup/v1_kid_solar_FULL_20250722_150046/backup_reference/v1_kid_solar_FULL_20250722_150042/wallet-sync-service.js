/**
 * Wallet Sync Service
 * 
 * This service provides real-time synchronization between the website and wallet app
 * using WebSockets for instant updates.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

// File paths
const MEMBERS_JSON_PATH = path.join(__dirname, 'public', 'api', 'members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public', 'embedded-members');

// Track connected clients
const clients = new Set();

/**
 * Initialize the wallet sync service
 * @param {http.Server} server - HTTP server instance
 */
function initWalletSyncService(server) {
  // Create WebSocket server
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws/wallet-sync'
  });
  
  // Handle new WebSocket connections
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WALLET-SYNC] New connection from ${clientIp}`);
    
    // Add client to the set
    clients.add(ws);
    
    // Send initial data to the client
    sendMemberData(ws);
    
    // Handle messages from clients
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        if (data.type === 'get_members') {
          sendMemberData(ws);
        } else if (data.type === 'authenticate') {
          // Authenticate user by email
          authenticateUser(ws, data.email);
        }
      } catch (error) {
        console.error('[WALLET-SYNC] Error processing message:', error);
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log(`[WALLET-SYNC] Client disconnected: ${clientIp}`);
      clients.delete(ws);
    });
    
    // Send heartbeat to keep connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
      } else {
        clearInterval(interval);
      }
    }, 30000);
  });
  
  console.log('[WALLET-SYNC] Wallet sync service initialized');
  return wss;
}

/**
 * Send member data to a specific client
 * @param {WebSocket} ws - WebSocket client
 */
function sendMemberData(ws) {
  try {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    // Read the most current members data
    const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Filter out placeholder accounts
    const filteredMembers = members.filter(m => !m.isPlaceholder);
    
    // Send data to client
    ws.send(JSON.stringify({
      type: 'members_data',
      data: {
        timestamp: new Date().toISOString(),
        count: filteredMembers.length,
        members: filteredMembers
      }
    }));
  } catch (error) {
    console.error('[WALLET-SYNC] Error sending member data:', error);
  }
}

/**
 * Authenticate a user by email
 * @param {WebSocket} ws - WebSocket client
 * @param {string} email - User email
 */
function authenticateUser(ws, email) {
  try {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    // Read the most current members data
    const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Find the user by email (case insensitive)
    const user = members.find(m => 
      m.email && m.email.toLowerCase() === email.toLowerCase()
    );
    
    if (user) {
      // User authenticated - send user data
      ws.send(JSON.stringify({
        type: 'authentication_result',
        success: true,
        user: user
      }));
      
      // Store user email on the connection for future reference
      ws.userEmail = email;
    } else {
      // User not found
      ws.send(JSON.stringify({
        type: 'authentication_result',
        success: false,
        error: 'User not found'
      }));
    }
  } catch (error) {
    console.error('[WALLET-SYNC] Error authenticating user:', error);
    
    // Send error to client
    ws.send(JSON.stringify({
      type: 'authentication_result',
      success: false,
      error: 'Internal server error'
    }));
  }
}

/**
 * Broadcast an update to all connected clients
 * @param {string} type - Message type
 * @param {object} data - Message data
 */
function broadcastUpdate(type, data) {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Notify clients of a new member
 * @param {object} member - New member data
 */
function notifyNewMember(member) {
  broadcastUpdate('new_member', { member });
}

/**
 * Notify clients of a member update
 * @param {object} member - Updated member data
 */
function notifyMemberUpdate(member) {
  broadcastUpdate('member_update', { member });
}

/**
 * Notify clients of a distribution update
 * @param {object} distributionData - Distribution data
 */
function notifyDistribution(distributionData) {
  broadcastUpdate('distribution_update', distributionData);
}

// Watch for changes to the members.json file
function startFileWatcher() {
  try {
    // Watch the members.json file for changes
    fs.watch(MEMBERS_JSON_PATH, (eventType) => {
      if (eventType === 'change') {
        console.log('[WALLET-SYNC] Detected change in members.json, broadcasting update');
        // Read updated data
        const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
        const members = JSON.parse(membersData);
        
        // Broadcast update to all clients
        broadcastUpdate('members_update', {
          count: members.length,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    console.log('[WALLET-SYNC] File watcher started for members.json');
  } catch (error) {
    console.error('[WALLET-SYNC] Error starting file watcher:', error);
  }
}

// Expose the sync service functions
module.exports = {
  initWalletSyncService,
  notifyNewMember,
  notifyMemberUpdate,
  notifyDistribution,
  startFileWatcher
};