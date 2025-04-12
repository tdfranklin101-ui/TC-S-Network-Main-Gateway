/**
 * Script to automatically push database schema changes without interactive prompts
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '@shared/schema';
import fs from 'fs';
import { exec } from 'child_process';

// Configure the WebSocket constructor for neon
neonConfig.webSocketConstructor = ws;

// Check for in-memory mode
if (process.env.USE_IN_MEMORY_MODE === 'true') {
  console.log('Running in in-memory mode. Skipping database schema updates.');
  
  // Function to get a mock pool for in-memory mode
  function getPool() {
    return {
      query: async () => ({ rows: [] }),
      end: async () => {}
    };
  }
} else {
  // Check for the DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot push schema changes.');
    process.exit(1);
  }

  // Function to get a connected pool
  function getPool() {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
}

/**
 * Function to create tables directly using SQL
 */
export async function createTables() {
  const pool = getPool();
  
  try {
    console.log('Creating/updating database tables...');
    
    // Create distribution_status enum if it doesn't exist
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distribution_status') THEN
            CREATE TYPE distribution_status AS ENUM ('pending', 'processed', 'failed');
          END IF;
        END
        $$;
      `);
      console.log('Enum distribution_status created or already exists');
    } catch (error) {
      console.error('Error creating enum:', error);
    }
    
    // Create users table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT,
          password TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Users table created or already exists');
    } catch (error) {
      console.error('Error creating users table:', error);
    }
    
    // Create solar_accounts table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS solar_accounts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          account_number TEXT NOT NULL UNIQUE,
          display_name TEXT,
          total_solar NUMERIC DEFAULT 0 NOT NULL,
          total_kwh NUMERIC DEFAULT 0 NOT NULL,
          dollar_value NUMERIC DEFAULT 0 NOT NULL,
          joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_anonymous BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Solar accounts table created or already exists');
    } catch (error) {
      console.error('Error creating solar_accounts table:', error);
    }
    
    // Create distributions table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS distributions (
          id SERIAL PRIMARY KEY,
          solar_account_id INTEGER NOT NULL REFERENCES solar_accounts(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          amount NUMERIC NOT NULL,
          kwh_amount NUMERIC NOT NULL,
          dollar_value NUMERIC NOT NULL,
          distribution_date TIMESTAMP NOT NULL,
          status distribution_status DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP
        );
      `);
      console.log('Distributions table created or already exists');
    } catch (error) {
      console.error('Error creating distributions table:', error);
    }
    
    // Create products table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          price NUMERIC NOT NULL,
          image_url TEXT,
          inventory INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Products table created or already exists');
    } catch (error) {
      console.error('Error creating products table:', error);
    }
    
    // Create newsletter_subscriptions table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Newsletter subscriptions table created or already exists');
    } catch (error) {
      console.error('Error creating newsletter_subscriptions table:', error);
    }
    
    // Create contact_messages table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_messages (
          id SERIAL PRIMARY KEY,
          name TEXT,
          email TEXT NOT NULL,
          message TEXT NOT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Contact messages table created or already exists');
    } catch (error) {
      console.error('Error creating contact_messages table:', error);
    }
    
    // Create solar_clock table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS solar_clock (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          kwh NUMERIC NOT NULL,
          dollars NUMERIC NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Solar clock table created or already exists');
    } catch (error) {
      console.error('Error creating solar_clock table:', error);
    }
    
    // Create registrants table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS registrants (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          interests TEXT,
          registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Registrants table created or already exists');
    } catch (error) {
      console.error('Error creating registrants table:', error);
    }
    
    console.log('All tables created or updated successfully');
    return true;
  } catch (error) {
    console.error('Error creating tables:', error);
    return false;
  } finally {
    // Clean up pool
    await pool.end();
  }
}

// Run the function to create tables only if this is the main module (not imported)
// In ESM, we need a different approach to detect if this is the main module
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Check if this file is being executed directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  createTables()
    .then(success => {
      if (success) {
        console.log('Schema push completed successfully');
        process.exit(0);
      } else {
        console.error('Schema push failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error during schema push:', error);
      process.exit(1);
    });
}