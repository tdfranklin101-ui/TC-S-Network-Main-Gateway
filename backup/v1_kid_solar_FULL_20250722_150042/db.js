/**
 * Database Connection Module
 * 
 * This module handles the connection to PostgreSQL database
 * using the Neon Serverless package.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Check if DATABASE_URL environment variable is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create a connection pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Function to test the database connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { 
      success: true, 
      message: `Database connection successful. Server time: ${result.rows[0].now}` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Database connection failed: ${error.message}` 
    };
  }
}

// Function to initialize database schema (create tables)
async function initializeSchema() {
  try {
    console.log('Creating database tables...');
    
    // Create members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        joined_date TEXT NOT NULL,
        total_solar DECIMAL(20,4) NOT NULL DEFAULT 1,
        total_dollars DECIMAL(20,2) NOT NULL,
        is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        is_reserve BOOLEAN NOT NULL DEFAULT FALSE, 
        is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
        last_distribution_date TEXT NOT NULL,
        notes TEXT,
        signup_timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create distribution_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS distribution_logs (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL,
        distribution_date TEXT NOT NULL,
        solar_amount DECIMAL(20,4) NOT NULL,
        dollar_value DECIMAL(20,2) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create backup_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id SERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        member_count INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    return { success: true, message: 'Database tables created successfully' };
  } catch (error) {
    return { success: false, message: `Error creating database tables: ${error.message}` };
  }
}

// Function to get database stats
async function getDatabaseStats() {
  try {
    // Get table counts
    const memberCountResult = await pool.query('SELECT COUNT(*) FROM members');
    const distributionCountResult = await pool.query('SELECT COUNT(*) FROM distribution_logs');
    const backupCountResult = await pool.query('SELECT COUNT(*) FROM backup_logs');
    
    return {
      success: true,
      memberCount: parseInt(memberCountResult.rows[0].count),
      distributionCount: parseInt(distributionCountResult.rows[0].count),
      backupCount: parseInt(backupCountResult.rows[0].count)
    };
  } catch (error) {
    return {
      success: false,
      message: `Error getting database stats: ${error.message}`
    };
  }
}

module.exports = {
  pool,
  testConnection,
  initializeSchema,
  getDatabaseStats
};