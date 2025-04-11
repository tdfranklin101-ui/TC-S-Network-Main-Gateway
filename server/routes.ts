import express, { type Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { insertNewsletterSubscriptionSchema, insertContactMessageSchema } from "@shared/schema";
import { setupWaitlistRoutes } from "./waitlist";
import { setupAdminRoutes } from "./admin";
import { setupAuth } from "./auth";
import { setupDistributionRoutes } from "./distribution";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { parse } from "csv";
import { generatePage } from "./template-processor";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser middleware for authentication
  app.use(cookieParser());
  
  // Set up authentication
  setupAuth(app);
  
  const apiRouter = express.Router();
  
  // API routes
  apiRouter.get("/solar-clock", async (req, res) => {
    try {
      const csvFilePath = path.resolve('./solar_clock.csv');
      const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
      
      // Parse CSV data
      parse(fileContent, { columns: true }, (err, records) => {
        if (err) {
          console.error("Error parsing CSV:", err);
          return res.status(500).json({ message: "Failed to parse solar clock data" });
        }
        
        if (records && records.length > 0) {
          const baseData = records[0];
          
          // Calculate current values based on base data and continuous accumulation
          const baseTimestamp = new Date(baseData.timestamp).getTime();
          const currentTimestamp = Date.now();
          const elapsedSeconds = (currentTimestamp - baseTimestamp) / 1000;
          
          // Accumulation rates (per second)
          const kwhPerSecond = 0.0005; // Increased by 10x for more visible changes
          const dollarPerKwh = 0.12;
          
          // Calculate accumulated amounts since base timestamp
          const additionalKwh = elapsedSeconds * kwhPerSecond;
          const additionalDollars = additionalKwh * dollarPerKwh;
          
          // Add to base amounts
          const totalKwh = parseFloat(baseData.kwh) + additionalKwh;
          const totalDollars = parseFloat(baseData.dollars) + additionalDollars;
          
          // Check if we need to update the base values (if it's a new day)
          const baseDate = new Date(baseData.timestamp);
          const currentDate = new Date();
          
          // If the base date is not today, update the CSV file with current totals
          if (baseDate.toDateString() !== currentDate.toDateString()) {
            console.log("Updating solar clock base values for new day...");
            
            // Format the updated CSV content
            const updatedContent = `timestamp,kwh,dollars
${currentDate.toISOString()},${totalKwh},${totalDollars}`;
            
            // Write the updated values back to the CSV file
            fs.writeFileSync(csvFilePath, updatedContent, 'utf-8');
            console.log("Solar clock base values updated successfully");
          }
          
          res.json({
            timestamp: new Date().toISOString(),
            baseTimestamp: baseData.timestamp,
            totalKwh,
            totalDollars,
            kwhPerSecond,
            dollarPerKwh,
            elapsedSeconds
          });
        } else {
          res.status(404).json({ message: "No solar clock data found" });
        }
      });
    } catch (error) {
      console.error("Error fetching solar clock data:", error);
      res.status(500).json({ message: "Failed to fetch solar clock data" });
    }
  });

  apiRouter.get("/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  apiRouter.post("/newsletter/subscribe", async (req, res) => {
    try {
      const validatedData = insertNewsletterSubscriptionSchema.parse(req.body);
      const subscription = await storage.createNewsletterSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating newsletter subscription:", error);
      res.status(400).json({ message: "Invalid subscription data" });
    }
  });

  apiRouter.post("/contact", async (req, res) => {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating contact message:", error);
      res.status(400).json({ message: "Invalid contact message data" });
    }
  });

  // Mount the API router
  app.use("/api", apiRouter);
  
  // Set up distribution routes
  setupDistributionRoutes(app);
  
  // Since we generate static files at startup, we can simply use the static file for homepage
  console.log('Using static homepage file generated at startup...');
  
  // Set up waitlist routes (direct routes, not under /api)
  setupWaitlistRoutes(app);
  
  // Set up admin routes
  setupAdminRoutes(app);
  
  // Route for the Solar Declaration page
  app.get('/declaration', (req, res) => {
    res.sendFile('declaration.html', { root: './public' });
  });

  // Add route for the personal distributions page
  app.get('/my-solar', (req, res) => {
    res.sendFile('my-solar.html', { root: './public' });
  });
  
  // Add route for the prototype page
  app.get('/prototype', (req, res) => {
    res.sendFile('prototype.html', { root: './public' });
  });
  
  // Add route for the merchandise page
  app.get('/merch', (req, res) => {
    res.sendFile('merch.html', { root: './public' });
  });
  
  // Add routes for other pages
  app.get('/whitepapers', (req, res) => {
    res.sendFile('whitepapers.html', { root: './public' });
  });
  
  app.get('/founder_note', (req, res) => {
    res.sendFile('founder_note.html', { root: './public' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
