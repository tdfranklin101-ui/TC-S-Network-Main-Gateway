import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { insertDistributionSchema, User } from "@shared/schema";
import fs from "fs";
import path from "path";
import { parse } from "csv";

// Define admin role for authorization
interface UserWithRole extends User {
  role?: string;
}

// Constants for solar distribution calculations
const SOLAR_VALUE_USD = 136000; // 1 Solar = $136,000
const SOLAR_VALUE_KWH = 17700000; // 1 Solar = 17.7M kWh
const DAILY_DISTRIBUTION_SOLAR = 1 / 365; // 1/365th solar per day (approx)

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

      res.json(solarAccount);
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

  // Get public leaderboard of solar accounts (excluding anonymous accounts)
  app.get("/api/solar-accounts/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const solarAccounts = await storage.getAllSolarAccounts(limit, false);
      res.json(solarAccounts);
    } catch (error) {
      next(error);
    }
  });
  
  // Get total member count for display on homepage
  app.get("/api/member-count", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const solarAccounts = await storage.getAllSolarAccounts(1000, true); // Get a large number to get total count
      res.json({ count: solarAccounts.length });
    } catch (error) {
      next(error);
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