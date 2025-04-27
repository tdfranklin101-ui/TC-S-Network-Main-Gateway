/**
 * Wallet API Routes
 * 
 * Dedicated API endpoints for the wallet application to access member data
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

// File paths
const MEMBERS_JSON_PATH = path.join(__dirname, 'public', 'api', 'members.json');
const SOLAR_LOG_PATH = path.join(__dirname, 'logs', 'solar-distribution.log');

/**
 * Register wallet API routes
 * @param {object} app - Express application
 */
function registerWalletApiRoutes(app) {
  // Get all members (with optional filtering)
  app.get('/api/wallet/members', (req, res) => {
    try {
      // Read the most current members data
      const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
      const members = JSON.parse(membersData);
      
      // Filter out placeholder accounts
      const filteredMembers = members.filter(m => !m.isPlaceholder);
      
      res.json({
        success: true,
        count: filteredMembers.length,
        members: filteredMembers
      });
    } catch (error) {
      console.error('[WALLET-API] Error fetching members:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch member data'
      });
    }
  });

  // Get specific member by ID
  app.get('/api/wallet/member/:id', (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid member ID'
        });
      }
      
      // Read the most current members data
      const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
      const members = JSON.parse(membersData);
      
      // Find the specific member
      const member = members.find(m => m.id === memberId);
      
      if (!member) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }
      
      res.json({
        success: true,
        member
      });
    } catch (error) {
      console.error('[WALLET-API] Error fetching member:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch member data'
      });
    }
  });

  // Get specific member by email
  app.get('/api/wallet/member-by-email/:email', (req, res) => {
    try {
      const email = req.params.email;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      
      // Read the most current members data
      const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
      const members = JSON.parse(membersData);
      
      // Find the specific member (case insensitive email match)
      const member = members.find(m => 
        m.email && m.email.toLowerCase() === email.toLowerCase()
      );
      
      if (!member) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }
      
      res.json({
        success: true,
        member
      });
    } catch (error) {
      console.error('[WALLET-API] Error fetching member by email:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch member data'
      });
    }
  });

  // Get solar distribution history
  app.get('/api/wallet/distribution-history', (req, res) => {
    try {
      if (!fs.existsSync(SOLAR_LOG_PATH)) {
        return res.json({
          success: true,
          history: []
        });
      }
      
      const logData = fs.readFileSync(SOLAR_LOG_PATH, 'utf8');
      const lines = logData.trim().split('\n');
      
      const history = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(entry => entry !== null);
      
      res.json({
        success: true,
        history
      });
    } catch (error) {
      console.error('[WALLET-API] Error fetching distribution history:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch distribution history'
      });
    }
  });
  
  console.log('[WALLET-API] Registered wallet API routes');
}

module.exports = { registerWalletApiRoutes };