import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Global variable to track if database is available
let isDatabaseAvailable = false;

// Basic health check query
const HEALTH_CHECK_QUERY = 'SELECT 1 as health';

// We'll populate this later after initialization
let dbPool: any = null;

/**
 * Retry function for database operations
 */
export async function retryDbOperation<T>(operation: () => Promise<T>, maxRetries = 3, retryDelay = 300): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
  
  // If we reach here, all retries failed
  throw lastError;
}

/**
 * Performs a health check on the database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  // If pool hasn't been assigned yet or is null, database is not available
  if (!dbPool) return false;
  
  try {
    const client = await dbPool.connect();
    try {
      await client.query(HEALTH_CHECK_QUERY);
      isDatabaseAvailable = true;
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    isDatabaseAvailable = false;
    return false;
  }
}

/**
 * Create a function to initialize the database with more robust error handling
 */
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
      ssl: { rejectUnauthorized: false }, // Always allow SSL for Neon
      allowExitOnIdle: false // Prevent pool from shutting down on idle
    });

    // More robust error handling
    pool.on('error', (err) => {
      console.error('Pool error:', err);
      isDatabaseAvailable = false;
      // Don't exit process on error, just log it
    });
    
    pool.on('connect', () => {
      isDatabaseAvailable = true;
      console.log('New database connection established');
    });

    const db = drizzle(pool, { schema });
    
    // Perform an initial health check
    checkDatabaseHealth()
      .then(isHealthy => {
        if (isHealthy) {
          console.log('Database connection verified successfully');
        } else {
          console.warn('Initial database health check failed, will retry on operations');
        }
      })
      .catch(err => {
        console.error('Error during initial database health check:', err);
      });
      
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

// Assign the pool to our global variable for health checks
dbPool = pool;

// Schedule periodic health checks
setInterval(async () => {
  try {
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy && isDatabaseAvailable) {
      console.warn('Database connection is unhealthy, operations may fail');
    } else if (isHealthy && !isDatabaseAvailable) {
      console.log('Database connection restored');
    }
  } catch (err) {
    console.error('Error during scheduled health check:', err);
  }
}, 30000); // Check every 30 seconds

// Export the database connection objects and health status
export { pool, db, isDatabaseAvailable };
