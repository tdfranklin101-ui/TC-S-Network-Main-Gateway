import { Request, Response } from 'express';
import fs from 'fs';
import { parse, stringify } from 'csv/sync';
import path from 'path';
import { db, retryDbOperation, isDatabaseAvailable, checkDatabaseHealth } from './db';
import { registrants } from '@shared/schema';
import { count, eq } from 'drizzle-orm';

const REGISTRANT_FILE = path.join(process.cwd(), 'registrants.csv');

export function setupWaitlistRoutes(app: any) {
  app.post('/signup', handleSignup);
  app.get('/registrants/count', getRegistrantCount);
  
  // Add a database health check endpoint (internal use only)
  app.get('/api/db-health', async (req: Request, res: Response) => {
    const isHealthy = await checkDatabaseHealth();
    res.json({ 
      healthy: isHealthy, 
      available: isDatabaseAvailable,
      timestamp: new Date().toISOString()
    });
  });
}

async function handleSignup(req: Request, res: Response) {
  const { name, email, interests } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    // Check if database is available (either through health check or by checking the db object)
    if (db && isDatabaseAvailable) {
      try {
        // First, verify database health
        const isHealthy = await checkDatabaseHealth();
        
        if (!isHealthy) {
          console.warn('Database health check failed before registration, falling back to CSV');
          return saveToCSVFallback(name, email, res);
        }
        
        // Check if email already exists - with retry mechanism
        const existingRegistrants = await retryDbOperation(async () => {
          if (!db) throw new Error('Database not available');
          return db.select().from(registrants).where(eq(registrants.email, email));
        });
        
        if (existingRegistrants && existingRegistrants.length > 0) {
          return res.status(400).json({ 
            error: 'This email is already registered'
          });
        }
        
        // Insert new registrant - with retry mechanism
        await retryDbOperation(async () => {
          if (!db) throw new Error('Database not available');
          return db.insert(registrants).values({
            name: name || null,
            email: email,
            interests: interests || null,
            registeredAt: new Date()
          });
        });
        
        // Set proper headers
        res.header('Cache-Control', 'no-store');
        res.header('Pragma', 'no-cache');
        
        return res.status(200).json({ 
          success: true, 
          message: `Thank you for signing up${name ? ', ' + name : ''}!` 
        });
      } catch (dbError) {
        console.error('Database error during registration after retries:', dbError);
        
        // Fallback to CSV if database operation fails after retries
        return saveToCSVFallback(name, email, res);
      }
    } else {
      console.warn('Database unavailable for registration, using CSV fallback');
      // Fallback to CSV if database is not available
      return saveToCSVFallback(name, email, res);
    }
  } catch (error) {
    console.error('Error saving registration:', error);
    return res.status(500).json({ error: 'Failed to register. Please try again.' });
  }
}

// Fallback function to save to CSV if database is unavailable
function saveToCSVFallback(name: string, email: string, res: Response) {
  try {
    const fileExists = fs.existsSync(REGISTRANT_FILE);
    const now = new Date().toISOString();
    
    // Create file with headers if it doesn't exist
    if (!fileExists) {
      fs.writeFileSync(REGISTRANT_FILE, 'name,email,date\n');
    }
    
    // Escape CSV fields to handle commas in values
    const escapedName = name && name.includes(',') ? `"${name}"` : name || '';
    const escapedEmail = email.includes(',') ? `"${email}"` : email;
    
    // Append to CSV file with date
    fs.appendFileSync(REGISTRANT_FILE, `${escapedName},${escapedEmail},${now}\n`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Thank you for signing up${name ? ', ' + name : ''}!`,
      note: 'Saved to CSV fallback'
    });
  } catch (csvError) {
    console.error('Error saving to CSV fallback:', csvError);
    return res.status(500).json({ error: 'Failed to register' });
  }
}

async function getRegistrantCount(req: Request, res: Response) {
  try {
    // Try to get count from database first with retry mechanism
    if (db && isDatabaseAvailable) {
      try {
        // First check database health
        const isHealthy = await checkDatabaseHealth();
        
        if (!isHealthy) {
          throw new Error('Database health check failed');
        }
        
        const result = await retryDbOperation(async () => {
          if (!db) throw new Error('Database not available');
          return db.select({ value: count() }).from(registrants);
        });
        
        const dbCount = result[0].value || 0;
        
        // Set cache headers for better performance
        res.header('Cache-Control', 'max-age=10'); // Cache for 10 seconds
        res.header('Access-Control-Allow-Origin', '*');
        
        return res.json({ count: dbCount });
      } catch (dbError) {
        console.error('Database error counting registrants after retries:', dbError);
        // Fall back to CSV count if database fails after retries
      }
    }
    
    // Fallback to CSV counting
    if (!fs.existsSync(REGISTRANT_FILE)) {
      // Set cache headers even for zero response
      res.header('Cache-Control', 'max-age=30');
      res.header('Access-Control-Allow-Origin', '*');
      return res.json({ count: 0 });
    }
    
    try {
      const content = fs.readFileSync(REGISTRANT_FILE, 'utf8');
      // Count lines (subtract 1 for header)
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const csvCount = Math.max(0, lines.length - 1); // Ensure non-negative
      
      // Set cache headers
      res.header('Cache-Control', 'max-age=30'); // Cache for 30 seconds for fallback
      res.header('Access-Control-Allow-Origin', '*');
      
      return res.json({ count: csvCount });
    } catch (csvError) {
      console.error('Error reading CSV for registrant count:', csvError);
      // If CSV reading fails, return at least 1 for Terry D. Franklin
      
      // Set cache headers for error response
      res.header('Cache-Control', 'max-age=60'); // Cache longer for fallback fallback
      res.header('Access-Control-Allow-Origin', '*');
      
      return res.json({ count: 1, estimated: true });
    }
  } catch (error) {
    console.error('Error counting registrants:', error);
    
    // Set cache headers for error response
    res.header('Cache-Control', 'max-age=60');
    res.header('Access-Control-Allow-Origin', '*');
    
    return res.status(500).json({ count: 1, error: 'Failed to count registrants accurately', estimated: true });
  }
}