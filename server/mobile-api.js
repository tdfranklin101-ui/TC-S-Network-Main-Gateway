/**
 * Mobile API Module
 * 
 * This module provides secure API endpoints for mobile app integration,
 * allowing the cross-platform mobile app to access user data in the database.
 */

const express = require('express');
const cors = require('cors');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configure CORS for mobile app access
const corsOptions = {
  origin: '*', // This allows access from any origin - should be restricted in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Apply CORS specifically for mobile API routes
router.use(cors(corsOptions));

// Simple API key verification middleware
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // This should be a secure API key verification
  // For now using a simple check - should be replaced with proper authentication
  if (!apiKey || apiKey !== process.env.MOBILE_API_KEY) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid API key'
    });
  }
  
  next();
};

// Endpoint for mobile app to verify connection
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile API is running',
    timestamp: new Date().toISOString()
  });
});

// Get all members (with API key protection)
router.get('/members', verifyApiKey, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, name, joined_date, total_solar, 
             last_distribution_date, is_anonymous, 
             CASE 
               WHEN is_anonymous = true THEN 'anonymous@example.com' 
               ELSE email 
             END as email
      FROM members
      ORDER BY id ASC
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      members: result.rows
    });
  } catch (error) {
    console.error('Error fetching members for mobile API:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: error.message
    });
  }
});

// Get specific member by ID or username
router.get('/member/:identifier', verifyApiKey, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Determine if identifier is a number (ID) or string (username)
    const isNumeric = /^\d+$/.test(identifier);
    
    let query;
    let params;
    
    if (isNumeric) {
      query = `
        SELECT id, username, name, joined_date, total_solar, 
               last_distribution_date, is_anonymous,
               CASE 
                 WHEN is_anonymous = true THEN 'anonymous@example.com' 
                 ELSE email 
               END as email
        FROM members
        WHERE id = $1
      `;
      params = [identifier];
    } else {
      query = `
        SELECT id, username, name, joined_date, total_solar, 
               last_distribution_date, is_anonymous,
               CASE 
                 WHEN is_anonymous = true THEN 'anonymous@example.com' 
                 ELSE email 
               END as email
        FROM members
        WHERE username = $1
      `;
      params = [identifier];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }
    
    res.json({
      success: true,
      member: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching specific member for mobile API:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: error.message
    });
  }
});

// Get member's distribution history
router.get('/member/:id/distributions', verifyApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM distribution_logs
      WHERE member_id = $1
      ORDER BY distribution_date DESC
    `, [id]);
    
    res.json({
      success: true,
      count: result.rows.length,
      distributions: result.rows
    });
  } catch (error) {
    console.error('Error fetching member distributions for mobile API:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: error.message
    });
  }
});

// Mobile authentication endpoint
router.post('/auth', async (req, res) => {
  try {
    const { email, authToken } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    // In a real implementation, this would verify the authToken
    // For now, just check if the user exists
    
    const result = await pool.query(
      'SELECT * FROM members WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Generate a temporary access token for the mobile app
    const tempToken = generateTempToken(result.rows[0]);
    
    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        name: result.rows[0].name
      },
      token: tempToken
    });
  } catch (error) {
    console.error('Error during mobile authentication:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
});

// Simple function to generate a temporary token
// Should be replaced with proper JWT implementation
function generateTempToken(user) {
  // In a real implementation, use JWT or other secure token method
  // This is just a placeholder
  return Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
}

module.exports = router;