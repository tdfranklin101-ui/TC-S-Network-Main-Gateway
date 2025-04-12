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
import * as solarConstants from "./solar-constants";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add CORS headers middleware with more comprehensive configuration
  app.use((req, res, next) => {
    // Allow all origins for maximum compatibility
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Api-Key');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });
  
  // Add cookie parser middleware for authentication
  app.use(cookieParser());
  
  // Set up authentication
  setupAuth(app);
  
  const apiRouter = express.Router();
  
  // API routes
  apiRouter.get("/solar-clock", async (req, res) => {
    try {
      const csvFilePath = path.resolve(process.cwd(), 'solar_clock.csv');
      console.log(`Reading solar clock data from: ${csvFilePath}`);
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
          
          // Accumulation rates (per second) from solar constants
          const kwhPerSecond = solarConstants.KWH_PER_SECOND; 
          // Dollar per kWh is calculated from the solar constants
          const dollarPerKwh = solarConstants.USD_PER_SOLAR / (solarConstants.solarPerPersonKwh * 365);
          
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
  
  // Add a special endpoint for public consumption with embedded JSONP support
  app.get("/public-api/members", async (req, res) => {
    try {
      // Get the callback name from the query string or use a default
      const callback = req.query.callback || 'processMembers';
      
      // Get the solar accounts (members)
      const accounts = await storage.getAllSolarAccounts(100, false);
      
      // Format the data for the public API
      const formattedAccounts = accounts.map(account => ({
        id: account.id,
        displayName: account.displayName || account.accountNumber,
        solarBalance: parseFloat(account.totalSolar).toFixed(5),
        joinedDate: account.joinedDate
      }));
      
      // Get the member count
      const count = formattedAccounts.length;
      
      // Create the response object
      const responseData = {
        members: formattedAccounts,
        count: count,
        timestamp: new Date().toISOString()
      };
      
      // Set appropriate headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      
      // If it's a JSONP request, wrap the response in the callback
      if (req.query.callback) {
        return res.jsonp(responseData);
      }
      
      // Otherwise, send as regular JSON
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching members for public API:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });
  
  // Add a simple HTML endpoint that includes the member data directly
  app.get("/embedded-members", async (req, res) => {
    try {
      // Get the solar accounts (members)
      const accounts = await storage.getAllSolarAccounts(100, false);
      
      // Format the accounts data for embedding
      const accountsForTemplate = accounts.map(account => ({
        id: account.id,
        displayName: account.displayName || account.accountNumber,
        solarBalance: parseFloat(account.totalSolar).toFixed(5),
        joinedDate: account.joinedDate ? new Date(account.joinedDate).toISOString().split('T')[0] : ''
      }));
      
      // Create the HTML content with embedded member data
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Current-See Members</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .member-list { margin-top: 20px; }
          .member-item { padding: 10px; border-bottom: 1px solid #eee; }
          .count { font-weight: bold; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="count">Total Members: ${accountsForTemplate.length}</div>
        <div class="member-list">
          ${accountsForTemplate.map(member => `
            <div class="member-item">
              <div>#${member.id} - ${member.displayName}</div>
              <div>Solar Balance: ${member.solarBalance}</div>
              <div>Joined: ${member.joinedDate}</div>
            </div>
          `).join('')}
        </div>
        
        <script>
          // This data can be used by parent pages if embedded in an iframe
          window.memberData = ${JSON.stringify({
            members: accountsForTemplate,
            count: accountsForTemplate.length,
            timestamp: new Date().toISOString()
          })};
        </script>
      </body>
      </html>
      `;
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating embedded members page:", error);
      res.status(500).send("Error loading member data");
    }
  });
  
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
  
  // Add route for the login page
  app.get('/login', (req, res) => {
    res.sendFile('login.html', { root: './public' });
  });
  
  // Add route for the account update page
  app.get('/update-account', (req, res) => {
    res.sendFile('update-account.html', { root: './public' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
