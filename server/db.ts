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
  connectionTimeoutMillis: 5000 
});

// Add error handler to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});
export const db = drizzle(pool, { schema });
