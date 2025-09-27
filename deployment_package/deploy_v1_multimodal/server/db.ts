import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema';

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Check if DATABASE_URL environment variable is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create a connection pool
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// Function to test the database connection
export async function testConnection() {
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

// Function to get the current state of the database
export async function getDatabaseInfo() {
  try {
    // Get table counts
    const memberCount = await db.select({ count: schema.members }).execute();
    const distributionCount = await db.select({ count: schema.distributionLogs }).execute();
    const backupCount = await db.select({ count: schema.backupLogs }).execute();
    
    return {
      success: true,
      memberCount: memberCount[0]?.count || 0,
      distributionCount: distributionCount[0]?.count || 0,
      backupCount: backupCount[0]?.count || 0
    };
  } catch (error) {
    return {
      success: false,
      message: `Error getting database info: ${error.message}`
    };
  }
}