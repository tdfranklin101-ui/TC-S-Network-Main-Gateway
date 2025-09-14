import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { insertDistributionSchema, User } from "@shared/schema";
import fs from "fs";
import path from "path";
import { parse } from "csv";
import { fileURLToPath } from "url";

// Import solar constants
import * as solarConstants from "./solar-constants";

// Define admin role for authorization
interface UserWithRole extends User {
  role?: string;
}

// Constants for solar distribution calculations (from solar-constants.js)
const SOLAR_VALUE_USD = solarConstants.USD_PER_SOLAR; // 1 Solar = $136,000
const SOLAR_VALUE_KWH = solarConstants.solarPerPersonKwh * 365; // 1 Solar = 17.7M kWh 
const DAILY_DISTRIBUTION_SOLAR = solarConstants.DAILY_SOLAR_DISTRIBUTION; // 1 solar per day

// Setup distribution routes
export function setupDistributionRoutes(app: any) {
  // Get the current user's solar account
  app.get("/api/solar-account", isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const solarAccount = await storage.getSolarAccountByUserId(userId);
      if (!solarAccount) {
        return res.status(404).json({ error: "Solar account not found" });
      }
      
      // Calculate accurate SOLAR balance based on protocol: Genesis (April 7, 2025) OR user's birthday (whichever is later)
      const today = new Date();
      const genesisDate = new Date('2025-04-07'); // Solar generation genesis date
      
      // For now, use joinedDate as proxy for birthday until birthday field is added to schema
      // TODO: Replace with actual birthday when user profile includes birthday field
      const userBirthdayValue = solarAccount.joinedDate ? solarAccount.joinedDate.toString() : '2025-04-10';
      const userBirthday = new Date(userBirthdayValue);
      
      // Protocol: Accumulation starts from whichever is later - Genesis OR birthday
      const accumulationStartDate = genesisDate > userBirthday ? genesisDate : userBirthday;
      
      // Calculate difference in time from accumulation start date
      const timeDiff = today.getTime() - accumulationStartDate.getTime();
      // Calculate days difference (rounded down) - cannot be negative
      const daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));
      // 1 SOLAR per day + 0.01918 initial bonus
      const calculatedSolar = daysDiff + 0.01918;
      
      // Calculate KWh and dollars based on new SOLAR amount
      const kwhPerSolar = 17700000; // 17.7M kWh per SOLAR
      const usdPerSolar = 136000; // $136,000 per SOLAR
      
      // Return updated account with real-time calculations
      res.json({
        ...solarAccount,
        totalSolar: String(calculatedSolar),
        totalKwh: String(calculatedSolar * kwhPerSolar),
        totalDollars: String(calculatedSolar * usdPerSolar)
      });
    } catch (error) {
      next(error);
    }
  });

  // Get the current user's distributions
  app.get("/api/distributions", isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const distributions = await storage.getDistributionsByUserId(userId);
      res.json(distributions);
    } catch (error) {
      next(error);
    }
  });

  // Helper function to retry database operations (similar to the one in routes.ts)
  async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, retryDelay = 500): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    // If we reach here, all retries failed
    throw lastError;
  }

  // Define a fallback account for Terry D. Franklin when database is unavailable
  const TERRY_DEFAULT_ACCOUNT = {
    id: 1,
    userId: 1,
    accountNumber: "SOL-A3CB3C7D89A3",
    isAnonymous: false,
    displayName: "Terry D. Franklin",
    totalSolar: "2.01918",
    totalKwh: "35739486",
    totalDollars: "274608.48",
    joinedDate: "2025-04-10T00:00:00.000Z"
  };
  
  // Get public leaderboard of solar accounts (excluding anonymous accounts)
  app.get("/api/solar-accounts/leaderboard", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Make multiple attempts with exponential backoff
      let solarAccounts;
      let success = false;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          solarAccounts = await storage.getAllSolarAccounts(limit, false);
          success = true;
          break;
        } catch (err) {
          console.warn(`Leaderboard fetch attempt ${attempt}/3 failed:`, err);
          if (attempt < 3) {
            // Exponential backoff: 300ms, 600ms, 900ms
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          }
        }
      }
      
      // If all attempts failed or returned empty, use fallback data
      if (!success || !solarAccounts || solarAccounts.length === 0) {
        console.warn("All leaderboard fetch attempts failed, using fallback data");
        
        // Set cache headers for fallback data
        res.header('Cache-Control', 'max-age=60'); // Longer cache time for fallback
        res.header('Access-Control-Allow-Origin', '*');
        
        // Return Terry as fallback data
        return res.json([TERRY_DEFAULT_ACCOUNT]);
      }
      
      // Calculate accurate SOLAR balances based on protocol: Genesis (April 7, 2025) OR user's birthday (whichever is later)
      const today = new Date();
      const genesisDate = new Date('2025-04-07'); // Solar generation genesis date
      
      solarAccounts = solarAccounts.map(account => {
        // For now, use joinedDate as proxy for birthday until birthday field is added to schema
        // TODO: Replace with actual birthday when user profile includes birthday field
        const userBirthdayValue = account.joinedDate ? account.joinedDate.toString() : '2025-04-10'; // Default to April 10 if null
        const userBirthday = new Date(userBirthdayValue);
        
        // Protocol: Accumulation starts from whichever is later - Genesis OR birthday
        const accumulationStartDate = genesisDate > userBirthday ? genesisDate : userBirthday;
        
        // Calculate difference in time from accumulation start date
        const timeDiff = today.getTime() - accumulationStartDate.getTime();
        // Calculate days difference (rounded down) - cannot be negative
        const daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));
        // 1 SOLAR per day + 0.01918 initial bonus
        const calculatedSolar = daysDiff + 0.01918;
        
        // Calculate KWh and dollars based on new SOLAR amount
        const kwhPerSolar = 17700000; // 17.7M kWh per SOLAR
        const usdPerSolar = 136000; // $136,000 per SOLAR
        
        return {
          ...account,
          totalSolar: String(calculatedSolar),
          totalKwh: String(calculatedSolar * kwhPerSolar),
          totalDollars: String(calculatedSolar * usdPerSolar)
        };
      });
      
      // Set cache headers to improve performance
      res.header('Cache-Control', 'max-age=10'); // Cache for 10 seconds
      res.header('Access-Control-Allow-Origin', '*');
      
      res.json(solarAccounts);
    } catch (error) {
      console.error("Error getting solar accounts leaderboard:", error);
      
      // Even on error, return fallback data to ensure user experience doesn't break
      res.header('Cache-Control', 'max-age=60'); // Longer cache for fallback data
      res.header('Access-Control-Allow-Origin', '*');
      
      // Return Terry as fallback data
      res.json([TERRY_DEFAULT_ACCOUNT]);
    }
  });
  
  // Get total member count for display on homepage
  app.get("/api/member-count", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use retry mechanism for member count as well
      const solarAccounts = await retryOperation(
        () => storage.getAllSolarAccounts(1000, true),
        3, // Max 3 retries
        300 // 300ms delay, increasing with each retry
      );
      
      // Set cache headers to improve performance
      res.header('Cache-Control', 'max-age=10'); // Cache for 10 seconds
      res.header('Access-Control-Allow-Origin', '*');
      
      res.json({ count: solarAccounts.length });
    } catch (error) {
      console.error("Error getting member count:", error);
      res.status(500).json({ 
        error: "Failed to fetch member count", 
        count: 1, // Provide at least the default value (Terry D. Franklin)
        estimated: true,
        message: "Server encountered a database issue. Using estimated count."
      });
    }
  });

  // Process daily distributions (could be triggered by a cron job)
  app.post("/api/admin/process-distributions", isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is admin - cast to UserWithRole interface for type safety
      const userWithRole = req.user as UserWithRole;
      if (!userWithRole || userWithRole.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const date = req.body.date ? new Date(req.body.date) : new Date();
      const processedCount = await processDistributions(date);
      
      res.json({ success: true, processedCount, date: date.toISOString() });
    } catch (error) {
      next(error);
    }
  });

  // Register webhook/cron endpoint for daily distribution - no auth for automated calls
  app.post("/api/cron/daily-distribution", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Could add a secret token verification here for security
      const cronSecret = req.headers["x-cron-secret"];
      if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: "Invalid cron secret" });
      }

      const date = new Date();
      
      // First create distributions for all users
      const distributionsCreated = await createDailyDistributions(date);
      
      // Then process the distributions
      const distributionsProcessed = await processDistributions(date);
      
      res.json({ 
        success: true, 
        date: date.toISOString(), 
        distributionsCreated, 
        distributionsProcessed
      });
    } catch (error) {
      next(error);
    }
  });
}

// Helper function to create daily distributions for all users
async function createDailyDistributions(date: Date): Promise<number> {
  try {
    // Get solar accounts
    const solarAccounts = await storage.getAllSolarAccounts(1000, true);
    let createdCount = 0;

    // Get the latest solar data
    const solarData = await getSolarClockData();
    const kwhPerUser = solarData.dailyKwh / Math.max(solarAccounts.length, 1);
    const dollarsPerUser = solarData.dailyDollars / Math.max(solarAccounts.length, 1);

    for (const account of solarAccounts) {
      // Check if a distribution already exists for this user and date
      const existingDistributions = await storage.getDistributionsByDate(date);
      const dateStr = date.toISOString().split('T')[0];
      const userHasDistribution = existingDistributions.some(
        d => d.solarAccountId === account.id && (typeof d.distributionDate === 'string' ? d.distributionDate : new Date(d.distributionDate).toISOString().split('T')[0]) === dateStr
      );

      if (!userHasDistribution) {
        await storage.createDistribution({
          solarAccountId: account.id,
          userId: account.userId,
          distributionDate: date.toISOString().split('T')[0],
          solarAmount: String(DAILY_DISTRIBUTION_SOLAR),
          kwhAmount: String(kwhPerUser),
          dollarValue: String(dollarsPerUser),
          status: 'pending'
        });
        createdCount++;
      }
    }

    return createdCount;
  } catch (error) {
    console.error("Error creating daily distributions:", error);
    throw error;
  }
}

// Helper function to process pending distributions
async function processDistributions(date: Date): Promise<number> {
  try {
    return await storage.processDistributions(date);
  } catch (error) {
    console.error("Error processing distributions:", error);
    throw error;
  }
}

// Helper function to get solar clock data
async function getSolarClockData() {
  try {
    const csvFilePath = path.resolve(process.cwd(), 'solar_clock.csv');
    console.log(`Reading solar clock data from: ${csvFilePath}`);
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    return new Promise<{ timestamp: string, totalKwh: number, totalDollars: number, dailyKwh: number, dailyDollars: number }>((resolve, reject) => {
      parse(fileContent, { columns: true }, (err, records) => {
        if (err) {
          console.error("Error parsing CSV:", err);
          reject(err);
          return;
        }
        
        if (records && records.length > 0) {
          const baseData = records[0];
          
          // Calculate daily values (using constants for demo)
          const dailyKwh = SOLAR_VALUE_KWH * DAILY_DISTRIBUTION_SOLAR;
          const dailyDollars = SOLAR_VALUE_USD * DAILY_DISTRIBUTION_SOLAR;
          
          resolve({
            timestamp: baseData.timestamp,
            totalKwh: parseFloat(baseData.kwh),
            totalDollars: parseFloat(baseData.dollars),
            dailyKwh,
            dailyDollars
          });
        } else {
          reject(new Error("No solar clock data found"));
        }
      });
    });
  } catch (error) {
    console.error("Error fetching solar clock data:", error);
    throw error;
  }
}