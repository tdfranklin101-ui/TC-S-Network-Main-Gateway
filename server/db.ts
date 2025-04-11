import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Please add a DATABASE_URL secret in the Secrets tab of your deployment configuration.",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Add error handler to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1); // Exit on connection errors to allow container restart
});
export const db = drizzle(pool, { schema });
