/**
 * Migration script for transitioning from file-based storage to database-based storage
 * This handles:
 * 1. Solar clock data (solar_clock.csv -> database)
 * 2. Waitlist registrants (registrants.csv -> database)
 */

import { db } from './db';
import { solarClock, insertSolarClockSchema, registrants, insertRegistrantSchema } from '@shared/schema';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv';
import { sql } from 'drizzle-orm';

// Paths to CSV files
const SOLAR_CLOCK_CSV = path.join(process.cwd(), 'solar_clock.csv');
const REGISTRANTS_CSV = path.join(process.cwd(), 'registrants.csv');

// Migrate solar clock data from CSV to database
export async function migrateSolarClockData(): Promise<boolean> {
  try {
    // Check if the database is available
    if (!db) {
      console.log('Database not available, skipping solar clock migration');
      return false;
    }

    // Check if the CSV file exists
    if (!fs.existsSync(SOLAR_CLOCK_CSV)) {
      console.log('Solar clock CSV file not found, skipping migration');
      return false;
    }

    // Check if data is already in database
    const existingRecords = await db.select().from(solarClock).limit(1);
    if (existingRecords && existingRecords.length > 0) {
      console.log('Solar clock data already exists in database, skipping migration');
      return true;
    }

    // Read CSV file
    const fileContent = fs.readFileSync(SOLAR_CLOCK_CSV, { encoding: 'utf-8' });
    
    // Parse CSV data
    const records: any[] = await new Promise((resolve, reject) => {
      parse(fileContent, { columns: true }, (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records || []);
        }
      });
    });

    if (records && records.length > 0) {
      const baseData = records[0];
      
      // Insert data into database
      await db.insert(solarClock).values({
        timestamp: new Date(baseData.timestamp),
        kwh: String(parseFloat(baseData.kwh)),
        dollars: String(parseFloat(baseData.dollars))
      });
      
      console.log('Solar clock data migrated successfully from CSV to database');
      return true;
    } else {
      console.log('No solar clock data found in CSV');
      return false;
    }
  } catch (error) {
    console.error('Error migrating solar clock data:', error);
    return false;
  }
}

// Migrate registrants data from CSV to database
export async function migrateRegistrantsData(): Promise<boolean> {
  try {
    // Check if the database is available
    if (!db) {
      console.log('Database not available, skipping registrants migration');
      return false;
    }
    
    // Check if the CSV file exists
    if (!fs.existsSync(REGISTRANTS_CSV)) {
      console.log('Registrants CSV file not found, skipping migration');
      return false;
    }

    // Check if data is already in database
    const existingRecords = await db.select().from(registrants).limit(1);
    if (existingRecords && existingRecords.length > 0) {
      console.log('Registrant data already exists in database, skipping migration');
      return true;
    }

    // Read CSV file
    const fileContent = fs.readFileSync(REGISTRANTS_CSV, { encoding: 'utf-8' });
    
    // Parse CSV data
    const records: any[] = await new Promise((resolve, reject) => {
      parse(fileContent, { columns: true }, (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records || []);
        }
      });
    });

    if (records && records.length > 0) {
      // Prepare batch insert values
      const values = records.map(record => ({
        email: record.email,
        name: record.name || null,
        interests: record.interests || null,
        registeredAt: record.timestamp ? new Date(record.timestamp) : new Date()
      }));
      
      // Insert data into database
      if (values.length > 0) {
        await db.insert(registrants).values(values);
        console.log(`${values.length} registrants migrated successfully from CSV to database`);
      }
      return true;
    } else {
      console.log('No registrant data found in CSV');
      return false;
    }
  } catch (error) {
    console.error('Error migrating registrants data:', error);
    return false;
  }
}

// Run migrations for both data types
export async function runMigrations() {
  console.log('Running data migrations from CSV to database...');
  await migrateSolarClockData();
  await migrateRegistrantsData();
  console.log('Data migrations completed');
}

// Add function for the /api/migrate endpoint
export async function handleMigrationRequest() {
  try {
    await runMigrations();
    return { success: true, message: 'Migration completed successfully' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Migration error:', errorMessage);
    return { success: false, message: 'Migration failed', error: errorMessage };
  }
}

// This migration will be called from index.ts