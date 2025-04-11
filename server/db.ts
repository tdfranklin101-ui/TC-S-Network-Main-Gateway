import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Create a function to initialize the database with retries
function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.warn(
      "DATABASE_URL is not set. Static site functionality will work, but database features will be unavailable.",
    );
    // Return null values that will be checked before use
    return { pool: null, db: null };
  }

  try {
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000, // Increased timeout for deployment
      max: 20,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false } // Always allow SSL for Neon
    });

    // More robust error handling
    pool.on('error', (err) => {
      console.error('Pool error:', err);
      // Don't exit process on error, just log it
    });

    const db = drizzle(pool, { schema });
    
    console.log('Database connection initialized successfully');
    return { pool, db };
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Return null values that will be checked before use
    return { pool: null, db: null };
  }
}

// Initialize database connection
const { pool, db } = initializeDatabase();

// Export the database connection objects
export { pool, db };
