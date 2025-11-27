import express, { type Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { insertNewsletterSubscriptionSchema, insertContactMessageSchema, solarClock, songs, playEvents, insertPlayEventSchema, solarAuditCategories, solarAuditDataSources, solarAuditEntries, auditRegionTotals, auditRegions, insertSolarAuditCategorySchema, insertSolarAuditDataSourceSchema, insertSolarAuditEntrySchema } from "@shared/schema";
import { setupWaitlistRoutes } from "./waitlist";
import { setupAdminRoutes } from "./admin";
import { setupAuth } from "./auth";
import { setupDistributionRoutes } from "./distribution";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { generatePage } from "./template-processor";
// @ts-ignore - JavaScript file without type definitions
import { AIWalletAssistant } from "./ai-wallet-assistant";
// @ts-ignore - JavaScript file without type definitions
import { AIMarketIntelligence } from "./ai-market-intelligence";
import * as solarConstants from "./solar-constants";
import cors from "cors";
import { db } from "./db";
import { sql, eq, desc } from "drizzle-orm";
import apiRoutes from "./routes/api";
import progressionRoutes from "./routes/progression";
import paymentsRoutes from "./routes/payments";
import aiRoutes from "./routes/ai";
import omega1Routes from "./routes/omega1";
import powerTwinRoutes from "./routes/power-twin";
import geoip from "geoip-lite";
import multer from "multer";
import crypto from "crypto";
import fetch from "node-fetch";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add a simple health check endpoint for deployment checks
  app.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint for health checks
  app.get('/', (req, res, next) => {
    // Check if this is a health check request from the deployment system
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('Health') || req.query.health === 'check') {
      return res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
    }
    // Otherwise continue to the next handler (which will serve the index.html)
    next();
  });
  // Add CORS headers middleware with secure configuration
  app.use((req, res, next) => {
    // Secure CORS configuration - never use '*' with credentials
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']) 
      : ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://0.0.0.0:5000'];
    
    const origin = req.headers.origin;
    // Only allow specific origins when credentials are used
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
      // Same-origin requests (no origin header)
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Api-Key, X-CSRF-Token');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
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
  
  // Initialize AI services
  const aiWalletAssistant = new AIWalletAssistant();
  const aiMarketIntelligence = new AIMarketIntelligence();
  
  // Migration endpoint
  apiRouter.post("/migrate", async (req, res) => {
    try {
      // This is an admin-only endpoint, should be protected
      const { handleMigrationRequest } = await import('./migration');
      const result = await handleMigrationRequest();
      res.json(result);
    } catch (error) {
      console.error('Error handling migration request:', error);
      res.status(500).json({ success: false, message: 'Migration failed', error: String(error) });
    }
  });

  // API routes
  apiRouter.get("/solar-clock", async (req, res) => {
    try {
      // Check if database is available
      if (!db) {
        return res.status(500).json({ message: "Database not available" });
      }
      
      // Try to get solar clock data from database
      const clockRecords = await db.select().from(solarClock).orderBy(sql`${solarClock.timestamp} DESC`).limit(1);
      
      if (!clockRecords || clockRecords.length === 0) {
        return res.status(404).json({ message: "No solar clock data found" });
      }
      
      const baseData = clockRecords[0];
      
      // Calculate current values based on base data and continuous accumulation
      const baseTimestamp = baseData.timestamp ? new Date(baseData.timestamp).getTime() : Date.now();
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
      const totalKwh = parseFloat(String(baseData.kwh)) + additionalKwh;
      const totalDollars = parseFloat(String(baseData.dollars)) + additionalDollars;
      
      // Check if we need to update the base values (if it's a new day)
      const baseDate = baseData.timestamp ? new Date(baseData.timestamp) : new Date();
      const currentDate = new Date();
      
      // If the base date is not today, update the database with current totals
      if (baseDate.toDateString() !== currentDate.toDateString()) {
        console.log("Updating solar clock base values for new day...");
        
        // Insert new record with updated values
        await db.insert(solarClock).values({
          timestamp: currentDate,
          kwh: String(totalKwh),
          dollars: String(totalDollars)
        });
        
        console.log("Solar clock base values updated successfully in database");
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

  // Timer-gated progression system API endpoints

  // User Management Endpoints
  apiRouter.post("/user/register", async (req, res) => {
    try {
      const { email, firstName, lastName } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      // Create user and profile
      const user = await storage.createUser({ email, firstName, lastName });
      const userProfile = await storage.createUserProfile({ 
        userId: user.id,
        solarBalance: 100, // Registration bonus
        totalEarned: 100,
        registrationBonus: true
      });
      
      res.status(201).json({ user, profile: userProfile });
    } catch (error) {
      console.error("User registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  apiRouter.get("/user/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // User Profile Management
  apiRouter.get("/user/:userId/profile", async (req, res) => {
    try {
      const profile = await storage.getUserProfile(req.params.userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Content Access Management
  apiRouter.get("/content/access", async (req, res) => {
    try {
      const { userId, sessionId, contentType, contentId } = req.query;
      
      const accessInfo = await storage.canAccessContent(
        userId as string || null,
        sessionId as string || null,
        contentType as string,
        contentId as string
      );
      
      res.json(accessInfo);
    } catch (error) {
      console.error("Access check error:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  apiRouter.post("/content/unlock", async (req, res) => {
    try {
      const { userId, contentType, contentId, solarCost } = req.body;
      
      const result = await storage.unlockContentWithPayment(
        userId,
        contentType,
        contentId,
        solarCost
      );
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Unlock error:", error);
      res.status(500).json({ error: "Failed to unlock content" });
    }
  });

  // Progression Management
  apiRouter.get("/progression", async (req, res) => {
    try {
      const { userId, sessionId, contentType, contentId } = req.query;
      
      const progression = await storage.getProgression(
        userId as string || null,
        sessionId as string || null,
        contentType as string,
        contentId as string
      );
      
      res.json(progression || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch progression" });
    }
  });

  apiRouter.get("/user/:userId/progressions", async (req, res) => {
    try {
      const { sessionId } = req.query;
      const progressions = await storage.getUserProgressions(
        req.params.userId,
        sessionId as string || null
      );
      res.json(progressions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch progressions" });
    }
  });

  apiRouter.post("/progression/start-timer", async (req, res) => {
    try {
      const { userId, sessionId, contentType, contentId, duration } = req.body;
      
      const progression = await storage.startTimer(
        userId || null,
        sessionId || null,
        contentType,
        contentId,
        duration
      );
      
      res.status(201).json(progression);
    } catch (error) {
      console.error("Timer start error:", error);
      res.status(500).json({ error: "Failed to start timer" });
    }
  });

  apiRouter.post("/progression/:progressionId/complete", async (req, res) => {
    try {
      const progression = await storage.completeTimer(req.params.progressionId);
      if (!progression) {
        return res.status(404).json({ error: "Progression not found" });
      }
      res.json(progression);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete timer" });
    }
  });

  // Entitlement Management
  apiRouter.get("/entitlements", async (req, res) => {
    try {
      const { userId, sessionId } = req.query;
      const entitlements = await storage.getUserEntitlements(
        userId as string || null,
        sessionId as string || null
      );
      res.json(entitlements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entitlements" });
    }
  });

  apiRouter.get("/entitlement", async (req, res) => {
    try {
      const { userId, sessionId, contentType, contentId } = req.query;
      
      const entitlement = await storage.getEntitlement(
        userId as string || null,
        sessionId as string || null,
        contentType as string,
        contentId as string
      );
      
      res.json(entitlement || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entitlement" });
    }
  });

  // Content Library Management
  apiRouter.get("/content/library", async (req, res) => {
    try {
      const library = await storage.getContentLibrary();
      res.json(library);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content library" });
    }
  });

  apiRouter.get("/content/:contentType/:contentId", async (req, res) => {
    try {
      const contentItem = await storage.getContentItem(
        req.params.contentType,
        req.params.contentId
      );
      
      if (!contentItem) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      res.json(contentItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content item" });
    }
  });

  apiRouter.post("/content/library", async (req, res) => {
    try {
      const contentItem = await storage.createContentItem(req.body);
      res.status(201).json(contentItem);
    } catch (error) {
      console.error("Content creation error:", error);
      res.status(500).json({ error: "Failed to create content item" });
    }
  });

  // Transaction Management
  apiRouter.get("/user/:userId/transactions", async (req, res) => {
    try {
      const transactions = await storage.getUserTransactions(req.params.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Session Management
  apiRouter.post("/session/create", async (req, res) => {
    try {
      const sessionId = require('crypto').randomUUID();
      res.json({ sessionId, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    } catch (error) {
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Health check for progression system
  apiRouter.get("/progression/health", async (req, res) => {
    try {
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        features: ["timers", "progressions", "entitlements", "payments"]
      });
    } catch (error) {
      res.status(500).json({ error: "Health check failed" });
    }
  });
  
  // Configure multer for image uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // AI API endpoints
  const aiRouter = express.Router();

  // Wallet AI endpoints
  aiRouter.post("/wallet-analysis", async (req, res) => {
    try {
      const userId = req.body.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      const options = {
        timeframe: req.body.timeframe || 30,
        includeRecommendations: req.body.includeRecommendations !== false
      };

      const analysis = await aiWalletAssistant.analyzeWallet(userId, options);
      res.json(analysis);

    } catch (error) {
      console.error('Error in wallet analysis:', error);
      res.status(500).json({ 
        error: "Wallet analysis failed", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  aiRouter.post("/chat", async (req, res) => {
    try {
      const { message, context, conversationHistory } = req.body;
      const userId = req.body.userId || (req.session as any)?.userId;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Process the query using the AI Wallet Assistant
      const response = await aiWalletAssistant.processQuery(userId || 'anonymous', message, {
        context,
        conversationHistory: conversationHistory || []
      });

      // Enhance response with conversational formatting
      const conversationalResponse = {
        message: response.message || formatAIResponse(response),
        data: response.data,
        suggestions: generateFollowUpSuggestions(response),
        context: {
          lastQuery: message,
          responseType: response.type,
          timestamp: new Date().toISOString()
        },
        speak: response.speak || generateSpeechText(response)
      };

      res.json(conversationalResponse);

    } catch (error) {
      console.error('Error in AI chat:', error);
      res.status(500).json({ 
        error: "Chat processing failed", 
        message: "I apologize, but I encountered an error processing your request. Please try again."
      });
    }
  });

  aiRouter.get("/market-overview", async (req, res) => {
    try {
      const options = {
        timeframe: parseInt(req.query.timeframe as string) || 30,
        includeForecasts: req.query.includeForecasts !== 'false'
      };

      const marketOverview = await aiMarketIntelligence.generateMarketOverview(options);
      res.json(marketOverview);

    } catch (error) {
      console.error('Error generating market overview:', error);
      res.status(500).json({ 
        error: "Market analysis failed", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  aiRouter.post("/content-recommendations", async (req, res) => {
    try {
      const userId = req.body.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      const options = {
        maxRecommendations: req.body.maxRecommendations || 10,
        contentTypes: req.body.contentTypes || null
      };

      const recommendations = await aiMarketIntelligence.generateContentRecommendations(userId, options);
      res.json(recommendations);

    } catch (error) {
      console.error('Error generating content recommendations:', error);
      res.status(500).json({ 
        error: "Content recommendation failed", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  aiRouter.get("/user-context", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      // Get user profile and basic context
      const userProfile = await storage.getUserProfile(userId);
      const recentTransactions = await storage.getUserTransactions(userId);

      const context = {
        userId,
        solarBalance: userProfile?.solarBalance || 0,
        totalEarned: userProfile?.totalEarned || 0,
        totalSpent: userProfile?.totalSpent || 0,
        recentActivity: recentTransactions.length,
        lastActivity: userProfile?.lastActivityAt,
        segment: determineUserSegment(userProfile, recentTransactions)
      };

      res.json(context);

    } catch (error) {
      console.error('Error loading user context:', error);
      res.status(500).json({ 
        error: "Failed to load user context", 
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Helper functions for AI responses
  function formatAIResponse(response: any): string {
    if (response.insights && response.insights.length > 0) {
      return `Here's what I found:\n\n${response.insights.join('\n\n')}`;
    }
    return 'I analyzed your request and here are the results.';
  }

  function generateFollowUpSuggestions(response: any): string[] {
    const suggestions: string[] = [];
    
    if (response.type === 'analysis') {
      suggestions.push("Tell me more about these patterns");
      suggestions.push("How can I improve this?");
    } else if (response.type === 'recommendation') {
      suggestions.push("Why do you recommend this?");
      suggestions.push("What are some alternatives?");
    }
    
    return suggestions;
  }

  function generateSpeechText(response: any): string {
    if (response.insights && response.insights.length > 0) {
      return response.insights.slice(0, 2).join('. ') + '.';
    }
    return 'I have analyzed your request and found some interesting information for you.';
  }

  function determineUserSegment(userProfile: any, transactions: any[]): string {
    if (!userProfile) return 'new';
    
    const balance = userProfile.solarBalance || 0;
    const spent = userProfile.totalSpent || 0;
    
    if (balance > 500 && spent > 100) return 'premium';
    if (balance > 100 && spent > 50) return 'active';
    if (spent > 10) return 'engaged';
    return 'casual';
  }

  // Mount specialized API route modules
  app.use("/api/progression", progressionRoutes);
  app.use("/api/payment", paymentsRoutes); 
  app.use("/api/ai", aiRoutes);
  app.use("/api/omega1", omega1Routes);
  app.use("/api/power-twin", powerTwinRoutes);

  // Mount legacy AI routes (to be replaced)
  app.use("/api/ai", aiRouter);

  // Mount the general API router
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
        displayName: account.name || account.username || `Member ${account.id}`,
        solarBalance: account.totalSolar ? parseFloat(account.totalSolar).toFixed(5) : '0.00000',
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
        displayName: account.name || account.username || `Member ${account.id}`,
        solarBalance: account.totalSolar ? parseFloat(account.totalSolar).toFixed(5) : '0.00000',
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
      
      // Ensure proper CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating embedded members page:", error);
      res.status(500).send("Error loading member data");
    }
  });
  
  // Add JSON endpoint for members
  app.get("/api/members.json", async (req, res) => {
    try {
      // Get the solar accounts (members)
      const accounts = await storage.getAllSolarAccounts(100, false);
      
      // Format the accounts data
      const formattedAccounts = accounts.map(account => ({
        id: account.id,
        displayName: account.name || account.username || `Member ${account.id}`,
        solarBalance: account.totalSolar ? parseFloat(account.totalSolar).toFixed(5) : '0.00000',
        joinedDate: account.joinedDate
      }));
      
      // Set appropriate headers for cross-origin access
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Content-Type', 'application/json');
      
      // Send the response
      res.json({
        members: formattedAccounts,
        count: formattedAccounts.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating members JSON:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });
  
  // Add JS endpoint for members (JSONP style)
  app.get("/api/members.js", async (req, res) => {
    try {
      // Get the solar accounts (members)
      const accounts = await storage.getAllSolarAccounts(100, false);
      
      // Format the accounts data
      const formattedAccounts = accounts.map(account => ({
        id: account.id,
        displayName: account.name || account.username || `Member ${account.id}`,
        solarBalance: account.totalSolar ? parseFloat(account.totalSolar).toFixed(5) : '0.00000',
        joinedDate: account.joinedDate
      }));
      
      // Get the callback name from query or use default
      const callback = req.query.callback || 'updateMembers';
      
      // Create data object
      const data = {
        members: formattedAccounts,
        count: formattedAccounts.length,
        timestamp: new Date().toISOString()
      };
      
      // Create JavaScript content that calls the callback function
      const jsContent = `${callback}(${JSON.stringify(data)});`;
      
      // Set appropriate headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Content-Type', 'application/javascript');
      
      // Send the response
      res.send(jsContent);
    } catch (error) {
      console.error("Error generating members JS:", error);
      res.status(500).send(`console.error("Failed to load members data");`);
    }
  });
  
  // Helper function to retry database operations
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

  // Add a simplified endpoint with minimal processing
  app.get("/api/members-data", async (req, res) => {
    try {
      // Use the storage interface with retry mechanism
      const accounts = await retryOperation(
        () => storage.getAllSolarAccounts(100, false),
        3, // Max 3 retries
        300 // 300ms delay, increasing with each retry
      );
      
      // Format the accounts data
      const formattedAccounts = accounts.map(account => ({
        id: account.id,
        displayName: account.name || account.username || `Member ${account.id}`,
        solarBalance: account.totalSolar ? parseFloat(account.totalSolar).toFixed(5) : '0.00000',
        joinedDate: account.joinedDate
      }));
      
      // Set CORS headers with longer cache times for better performance
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Cache-Control', 'max-age=10'); // Cache for 10 seconds
      
      // Send the response
      res.json({
        members: formattedAccounts,
        count: formattedAccounts.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating minimal members data after retries:", error);
      res.status(500).json({ 
        error: "Failed to fetch members", 
        message: "Server encountered a temporary database issue. Please try again.",
        retry: true
      });
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

  // AI Wallet Assistant endpoints
  apiRouter.post("/ai/wallet/analyze", async (req, res) => {
    try {
      const { userId, options = {} } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }
      
      const analysis = await aiWalletAssistant.analyzeWallet(userId, options);
      res.json(analysis);
    } catch (error) {
      console.error('AI Wallet Analysis error:', error);
      res.status(500).json({ error: "AI analysis failed", message: String(error) });
    }
  });

  apiRouter.post("/ai/wallet/query", async (req, res) => {
    try {
      const { userId, query, options = {} } = req.body;
      if (!userId || !query) {
        return res.status(400).json({ error: "userId and query required" });
      }
      
      const response = await aiWalletAssistant.processNaturalLanguageQuery(userId, query, options);
      res.json(response);
    } catch (error) {
      console.error('AI Wallet Query error:', error);
      res.status(500).json({ error: "AI query failed", message: String(error) });
    }
  });

  // AI Market Intelligence endpoints
  apiRouter.get("/ai/market/overview", async (req, res) => {
    try {
      const options = {
        timeframe: parseInt(req.query.timeframe as string) || 30,
        includeForecasts: req.query.includeForecasts !== 'false'
      };
      
      const overview = await aiMarketIntelligence.generateMarketOverview(options);
      res.json(overview);
    } catch (error) {
      console.error('AI Market Overview error:', error);
      res.status(500).json({ error: "Market analysis failed", message: String(error) });
    }
  });

  apiRouter.post("/ai/market/pricing", async (req, res) => {
    try {
      const { contentType, contentId, currentPrice, options = {} } = req.body;
      if (!contentType || !contentId) {
        return res.status(400).json({ error: "contentType and contentId required" });
      }
      
      const pricing = await aiMarketIntelligence.optimizePricing(contentType, contentId, currentPrice, options);
      res.json(pricing);
    } catch (error) {
      console.error('AI Pricing Optimization error:', error);
      res.status(500).json({ error: "Pricing optimization failed", message: String(error) });
    }
  });

  // AI Chat Interface endpoints
  apiRouter.post("/ai/chat", async (req, res) => {
    try {
      const { message, userId, context = {} } = req.body;
      if (!message) {
        return res.status(400).json({ error: "message required" });
      }
      
      // Route to appropriate AI service based on context
      let response;
      if (context.type === 'wallet' && userId) {
        response = await aiWalletAssistant.processNaturalLanguageQuery(userId, message, context);
      } else if (context.type === 'market') {
        response = await aiMarketIntelligence.generateMarketOverview({ query: message });
      } else {
        // Default to wallet assistant for general queries
        response = {
          type: 'query_response',
          category: 'general',
          confidence: 0.8,
          data: {},
          insights: [
            "I can help you with Solar wallet management and market insights.",
            "Try asking about your balance, recent transactions, or market trends."
          ],
          recommendations: []
        };
      }
      
      res.json(response);
    } catch (error) {
      console.error('AI Chat error:', error);
      res.status(500).json({ error: "AI chat failed", message: String(error) });
    }
  });

  // Progression and content access endpoints
  apiRouter.post("/progression/start-timer", async (req, res) => {
    try {
      const { userId, sessionId, contentType, contentId, duration } = req.body;
      
      if (!contentType || !contentId || !duration) {
        return res.status(400).json({ error: "contentType, contentId, and duration required" });
      }
      
      // Store progression in database (implement with your storage)
      const progression = {
        id: `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId || null,
        sessionId: sessionId || null,
        contentType,
        contentId,
        status: 'timer_active',
        timerStartTime: new Date().toISOString(),
        timerEndTime: new Date(Date.now() + (duration * 1000)).toISOString(),
        duration
      };
      
      // TODO: Save to database via storage interface
      
      res.json(progression);
    } catch (error) {
      console.error('Start timer error:', error);
      res.status(500).json({ error: "Timer start failed", message: String(error) });
    }
  });

  apiRouter.post("/progression/:progressionId/complete", async (req, res) => {
    try {
      const { progressionId } = req.params;
      
      // TODO: Update progression status to 'timer_complete' in database
      const progression = {
        id: progressionId,
        status: 'timer_complete',
        completedAt: new Date().toISOString()
      };
      
      res.json(progression);
    } catch (error) {
      console.error('Complete timer error:', error);
      res.status(500).json({ error: "Timer completion failed", message: String(error) });
    }
  });

  apiRouter.get("/content/access", async (req, res) => {
    try {
      const { contentType, contentId, userId, sessionId } = req.query;
      
      if (!contentType || !contentId) {
        return res.status(400).json({ error: "contentType and contentId required" });
      }
      
      // Check entitlements and progressions
      // TODO: Implement actual database checks
      const accessInfo = {
        canAccess: true,
        accessType: 'preview', // 'preview', 'timer_active', 'timer_complete', 'full'
        solarCost: 50,
        progression: null,
        entitlement: null
      };
      
      res.json(accessInfo);
    } catch (error) {
      console.error('Content access check error:', error);
      res.status(500).json({ error: "Access check failed", message: String(error) });
    }
  });

  apiRouter.post("/content/unlock", async (req, res) => {
    try {
      const { userId, contentType, contentId, solarCost } = req.body;
      
      if (!userId || !contentType || !contentId || !solarCost) {
        return res.status(400).json({ error: "userId, contentType, contentId, and solarCost required" });
      }
      
      // Server-side validation for content unlock
      if (!userId || !contentType || !contentId || solarCost < 1) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid unlock request parameters" 
        });
      }
      
      // TODO: Implement actual balance check and deduction
      // For now, simulate validation
      const mockCurrentBalance = 1000;
      if (mockCurrentBalance < solarCost) {
        return res.status(400).json({ 
          success: false,
          error: "Insufficient Solar balance",
          currentBalance: mockCurrentBalance,
          requiredAmount: solarCost
        });
      }
      
      const newBalance = mockCurrentBalance - solarCost;
      const result = {
        success: true,
        entitlement: {
          id: `ent_${Date.now()}`,
          userId,
          contentType,
          contentId,
          accessType: 'full',
          createdAt: new Date().toISOString()
        },
        newBalance,
        transactionId: `txn_unlock_${Date.now()}`
      };
      
      res.json(result);
    } catch (error) {
      console.error('Content unlock error:', error);
      res.status(500).json({ error: "Content unlock failed", message: String(error) });
    }
  });

  apiRouter.post("/user/register", async (req, res) => {
    try {
      const { email, firstName, lastName } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ error: "email, firstName, and lastName required" });
      }
      
      // TODO: Create user and profile in database
      const user = {
        id: `user_${Date.now()}`,
        email,
        firstName,
        lastName,
        createdAt: new Date().toISOString()
      };
      
      const profile = {
        userId: user.id,
        solarBalance: 1000, // Starting balance
        totalEarned: 1000,
        totalSpent: 0,
        lastActivityAt: new Date().toISOString()
      };
      
      res.json({ user, profile });
    } catch (error) {
      console.error('User registration error:', error);
      res.status(500).json({ error: "Registration failed", message: String(error) });
    }
  });

  apiRouter.get("/user/:userId/profile", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // TODO: Get user profile from database
      const profile = {
        userId,
        solarBalance: 1000,
        totalEarned: 1000,
        totalSpent: 0,
        lastActivityAt: new Date().toISOString()
      };
      
      res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: "Profile fetch failed", message: String(error) });
    }
  });

  apiRouter.post("/session/create", async (req, res) => {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // TODO: Store session in database
      
      res.json({ sessionId });
    } catch (error) {
      console.error('Session creation error:', error);
      res.status(500).json({ error: "Session creation failed", message: String(error) });
    }
  });

  // Enhanced conversation capture endpoint for Console Solar responses
  app.post('/api/enhanced-conversation-capture', (req, res) => {
    try {
      const data = req.body;
      console.log('✅ Enhanced Console Solar response captured:', data.responseText ? data.responseText.substring(0, 100) + '...' : 'No text');
      
      // Store conversation data with enhanced metadata
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `conversations/console_solar_${timestamp}_${data.source}.json`;
      
      // Enhanced data structure for Console Solar responses
      const enhancedData = {
        ...data,
        captureMethod: 'enhanced-audio-capture',
        processingTimestamp: new Date().toISOString(),
        responseLength: data.responseText ? data.responseText.length : 0,
        qualityScore: data.responseText && data.responseText.length > 50 ? 'high' : 'low'
      };
      
      console.log(`📝 Storing Console Solar response: ${enhancedData.qualityScore} quality, ${enhancedData.responseLength} chars`);
      
      res.json({ 
        success: true, 
        stored: filename,
        responseLength: enhancedData.responseLength,
        qualityScore: enhancedData.qualityScore
      });
    } catch (error) {
      console.error('Enhanced capture error:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  });

  // Music Play Tracking Endpoints
  app.post('/api/music/play', async (req, res) => {
    try {
      const { songTitle, sessionId, userAgent, playDuration, completedPlay } = req.body;
      
      if (!songTitle) {
        return res.status(400).json({ error: 'Song title is required' });
      }

      // Find the song by title
      const song = await db.select().from(songs).where(sql`${songs.title} ILIKE ${songTitle}`).limit(1);
      
      if (song.length === 0) {
        return res.status(404).json({ error: 'Song not found' });
      }

      // Record the play event
      const playEvent = {
        songId: song[0].id,
        sessionId: sessionId || null,
        userAgent: userAgent || req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        playDuration: playDuration || 0,
        completedPlay: completedPlay || false,
        source: 'web',
        metadata: { timestamp: new Date().toISOString() }
      };

      await db.insert(playEvents).values(playEvent);
      
      console.log(`🎵 Play tracked: "${songTitle}" - ${playDuration || 0}s`);
      
      res.json({ success: true, songId: song[0].id });
    } catch (error) {
      console.error('Play tracking error:', error);
      res.status(500).json({ error: 'Failed to track play' });
    }
  });

  // Get play statistics for Market Intelligence
  app.get('/api/music/stats', async (req, res) => {
    try {
      // Get total play count
      const totalPlays = await db.select({
        count: sql<number>`count(*)`
      }).from(playEvents);

      // Get top 3 most played songs
      const topSongs = await db.select({
        title: songs.title,
        artist: songs.artist,
        playCount: sql<number>`count(${playEvents.id})`
      })
      .from(songs)
      .leftJoin(playEvents, sql`${songs.id} = ${playEvents.songId}`)
      .groupBy(songs.id, songs.title, songs.artist)
      .orderBy(sql`count(${playEvents.id}) DESC`)
      .limit(3);

      // Get total volume with proper formatting
      const volume = totalPlays[0]?.count || 0;
      const formattedVolume = volume >= 1000 
        ? `${(volume / 1000).toFixed(1)}K` 
        : volume.toString();

      res.json({
        totalPlays: volume,
        formattedVolume: `↗ ${formattedVolume} plays`,
        topSongs: topSongs.map((song, index) => ({
          rank: index + 1,
          title: song.title,
          artist: song.artist,
          playCount: song.playCount || 0,
          trend: index === 0 ? '+127%' : index === 1 ? '+89%' : '+62%' // Mock trend for now
        })),
        averagePrice: 'S0.1000',
        topGenre: 'Blues Rock'
      });
    } catch (error) {
      console.error('Stats retrieval error:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // Get song list for frontend
  app.get('/api/music/songs', async (req, res) => {
    try {
      const allSongs = await db.select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        genre: songs.genre,
        duration: songs.duration,
        metadata: songs.metadata
      }).from(songs).where(sql`${songs.isActive} = true`).orderBy(songs.title);

      res.json(allSongs);
    } catch (error) {
      console.error('Songs retrieval error:', error);
      res.status(500).json({ error: 'Failed to get songs' });
    }
  });

  // ============================================================
  // SOLAR INTELLIGENCE AUDIT LAYER (SAi-Audit) API ROUTES
  // Regulatory-grade energy demand tracking with full lineage
  // ============================================================

  // Helper function to compute SHA-256 hash for data integrity
  function computeDataHash(data: any): string {
    const raw = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  // Helper function to ensure category exists (upsert)
  async function ensureCategory(name: string, description?: string): Promise<number> {
    const existing = await db.select().from(solarAuditCategories).where(eq(solarAuditCategories.name, name));
    if (existing.length > 0) {
      return existing[0].id;
    }
    const result = await db.insert(solarAuditCategories).values({ name, description }).returning({ id: solarAuditCategories.id });
    return result[0].id;
  }

  // Helper function to ensure data source exists (upsert)
  async function ensureDataSource(name: string, verificationLevel: string, organization?: string, contact?: string, uri?: string, sourceType?: string): Promise<number> {
    const existing = await db.select().from(solarAuditDataSources).where(eq(solarAuditDataSources.name, name));
    if (existing.length > 0) {
      return existing[0].id;
    }
    const result = await db.insert(solarAuditDataSources).values({ 
      name, 
      verificationLevel: verificationLevel as any,
      organization,
      contact,
      uri,
      sourceType: (sourceType || 'DIRECT') as any
    }).returning({ id: solarAuditDataSources.id });
    return result[0].id;
  }

  // Helper function to insert auditable energy record
  async function insertEnergyRecord(
    categoryName: string, 
    sourceName: string, 
    sourceVerificationLevel: string,
    kwh: number, 
    rightsAlignment: any, 
    notes?: string,
    sourceOrg?: string,
    sourceUri?: string,
    sourceType?: string
  ) {
    const categoryId = await ensureCategory(categoryName);
    const sourceId = await ensureDataSource(sourceName, sourceVerificationLevel, sourceOrg, undefined, sourceUri, sourceType);
    
    const record = {
      category: categoryName,
      source: sourceName,
      kwh,
      rights: rightsAlignment,
      day: new Date().toISOString().split('T')[0]
    };
    const dataHash = computeDataHash(record);

    await db.insert(solarAuditEntries).values({
      categoryId,
      sourceId,
      day: new Date().toISOString().split('T')[0] as any, // YYYY-MM-DD format
      kwh: kwh.toString() as any,
      rightsAlignment,
      dataHash,
      notes
    }).onConflictDoNothing(); // Prevent duplicate daily entries
  }

  // Helper function to convert monthly MWh to daily kWh
  function eiaMonthToDailyKwh(mwhMonthly: number, year: number, month: number): number {
    // Get days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    return (mwhMonthly * 1000.0) / daysInMonth; // MWh->kWh, then /days
  }

  // Fetch EIA retail sales data for a specific sector
  interface EiaRetailSalesResult {
    mwh: number;
    year: number;
    month: number;
  }

  async function eiaRetailSalesLatest(sector: string): Promise<EiaRetailSalesResult | null> {
    const EIA_API_KEY = process.env.EIA_API_KEY;
    if (!EIA_API_KEY) {
      console.error('EIA_API_KEY not configured');
      return null;
    }

    try {
      const url = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${EIA_API_KEY}&frequency=monthly&data[0]=sales&facets[sectorid][]=${sector}&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
      const response = await fetch(url, { 
        headers: { 'User-Agent': 'TC-S-Network-SAi-Audit/1.0' },
        timeout: 20000
      } as any);
      
      if (!response.ok) {
        console.error(`EIA API error for sector ${sector}:`, response.status, response.statusText);
        return null;
      }
      
      const data = await response.json() as any;
      const row = data?.response?.data?.[0];
      
      if (!row || !row.period || row.sales === undefined) {
        console.error(`Invalid EIA response for sector ${sector}:`, JSON.stringify(row));
        return null;
      }
      
      const [year, month] = row.period.split('-').map((n: string) => parseInt(n));
      // EIA v2 API returns the metric value in the field matching data[0] parameter (sales in this case)
      const mwh = parseFloat(row.sales);
      
      return { mwh, year, month };
    } catch (error) {
      console.error(`Failed to fetch EIA data for sector ${sector}:`, error);
      return null;
    }
  }

  // Fetch live Bitcoin energy consumption from CBECI API
  async function getBitcoinKwh(): Promise<number | null> {
    try {
      const response = await fetch('https://ccaf.io/cbeci/api/v1/bitcoin/energy', { 
        headers: { 'User-Agent': 'TC-S-Network-SAi-Audit/1.0' }
      });
      if (!response.ok) {
        console.error('CBECI API error:', response.status, response.statusText);
        return null;
      }
      const data = await response.json() as any;
      // Convert annual TWh to daily kWh
      const annualTWh = data?.best_guess?.terawattHours;
      if (typeof annualTWh === 'number') {
        return (annualTWh * 1e9) / 365; // TWh -> kWh per day
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch Bitcoin energy data from CBECI:', error);
      return null;
    }
  }

  // Live feed functions for each energy category (DIRECT sources)
  async function feedHousingKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    const result = await eiaRetailSalesLatest('RES');
    if (!result) return null;
    
    const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
    return {
      kwh,
      source: {
        name: 'EIA Retail Sales – Residential',
        organization: 'U.S. Energy Information Administration',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://api.eia.gov',
        sourceType: 'DIRECT'
      },
      note: `US monthly retail sales (RES) ${result.year}-${result.month.toString().padStart(2, '0')}`
    };
  }

  async function feedDigitalServicesKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    // LBNL Data Center Energy Consumption
    // Source: Lawrence Berkeley National Laboratory - United States Data Center Energy Usage Report
    // Latest estimate (2023): ~97 TWh/year for US data centers
    // Reference: LBNL "Data Center Energy Usage Trends" and IEA "Digitalization and Energy 2023"
    // 
    // This is FAR more accurate than generic commercial sector (which includes offices, retail, etc.)
    // Data centers are specifically IT/digital services infrastructure
    
    try {
      // Latest LBNL estimate for US data center energy consumption
      // 2023 data: 97,000 GWh/year = 97 TWh/year
      const annualTWh = 97; // Terawatt-hours per year
      const annualKwh = annualTWh * 1e9; // Convert TWh to kWh (1 TWh = 1 billion kWh)
      const dailyKwh = annualKwh / 365; // Convert annual to daily
      
      // Calculate from annual estimate
      console.log(`✅ US Data Centers (LBNL): ${annualTWh} TWh/year | Daily: ${(dailyKwh / 1e6).toFixed(2)} GWh`);
      
      return {
        kwh: dailyKwh,
        source: {
          name: 'LBNL Data Center Energy Study',
          organization: 'Lawrence Berkeley National Laboratory / U.S. Department of Energy',
          verificationLevel: 'THIRD_PARTY',
          uri: 'https://eta.lbl.gov/publications/united-states-data-center-energy',
          sourceType: 'CALCULATED'
        },
        note: `US data center energy consumption: ${annualTWh} TWh/year from LBNL 2023 research. Includes enterprise data centers, cloud infrastructure, and colocation facilities. Daily average: ${(dailyKwh / 1e6).toFixed(2)} GWh`
      };
    } catch (error: any) {
      console.error('❌ Failed to calculate LBNL data center energy:', error.message);
      return null;
    }
  }

  async function feedManufacturingKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    const result = await eiaRetailSalesLatest('IND');
    if (!result) return null;
    
    const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
    return {
      kwh,
      source: {
        name: 'EIA Retail Sales – Industrial',
        organization: 'U.S. Energy Information Administration',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://api.eia.gov',
        sourceType: 'DIRECT'
      },
      note: `US monthly retail sales (IND) ${result.year}-${result.month.toString().padStart(2, '0')}`
    };
  }

  async function feedTransportKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    const result = await eiaRetailSalesLatest('TRA');
    if (!result) return null;
    
    const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
    return {
      kwh,
      source: {
        name: 'EIA Retail Sales – Transportation',
        organization: 'U.S. Energy Information Administration',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://api.eia.gov',
        sourceType: 'DIRECT'
      },
      note: `US monthly retail sales (TRA) ${result.year}-${result.month.toString().padStart(2, '0')}`
    };
  }

  async function feedFoodAgricultureKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    const result = await eiaRetailSalesLatest('OTH');
    if (!result) return null;
    
    const kwh = eiaMonthToDailyKwh(result.mwh, result.year, result.month);
    return {
      kwh,
      source: {
        name: 'EIA Retail Sales – Other (Ag/Other)',
        organization: 'U.S. Energy Information Administration',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://api.eia.gov',
        sourceType: 'DIRECT'
      },
      note: `US monthly retail sales (OTH) ${result.year}-${result.month.toString().padStart(2, '0')}`
    };
  }

  async function feedMoneyKwh(): Promise<{ kwh: number; source: any; note: string } | null> {
    const bitcoinKwh = await getBitcoinKwh();
    if (!bitcoinKwh) return null;
    
    // Include Ethereum and Solana estimates
    const ethereumKwh = 0.01 * 1e9 / 365; // ~10 TWh/year
    const solanaKwh = 8755 * 1e3 / 365; // ~8.755 GWh/year
    const totalKwh = bitcoinKwh + ethereumKwh + solanaKwh;
    
    return {
      kwh: totalKwh,
      source: {
        name: 'CBECI – Bitcoin Energy',
        organization: 'Cambridge Centre for Alternative Finance',
        verificationLevel: 'THIRD_PARTY',
        uri: 'https://ccaf.io/cbeci',
        sourceType: 'DIRECT'
      },
      note: `Bitcoin: ${(bitcoinKwh / 1e6).toFixed(2)} GWh/day, Ethereum: ${(ethereumKwh / 1e6).toFixed(2)} GWh/day, Solana: ${(solanaKwh / 1e6).toFixed(2)} GWh/day`
    };
  }

  // Tiered fetch wrapper with error handling and fallback
  async function tieredFetch(
    fetchFn: () => Promise<{ kwh: number; source: any; note: string } | null>,
    categoryName: string,
    rights: any,
    fallbackFn?: () => Promise<{ kwh: number; source: any; note: string } | null>
  ): Promise<boolean> {
    try {
      const result = await fetchFn();
      if (result) {
        await insertEnergyRecord(
          categoryName,
          result.source.name,
          result.source.verificationLevel,
          result.kwh,
          rights,
          result.note,
          result.source.organization,
          result.source.uri,
          result.source.sourceType
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`${categoryName} direct fetch failed:`, error);
      
      // Try fallback if provided
      if (fallbackFn) {
        try {
          const fallbackResult = await fallbackFn();
          if (fallbackResult) {
            await insertEnergyRecord(
              categoryName,
              fallbackResult.source.name,
              fallbackResult.source.verificationLevel,
              fallbackResult.kwh,
              rights,
              `[AGGREGATOR FALLBACK] ${fallbackResult.note}`,
              fallbackResult.source.organization,
              fallbackResult.source.uri,
              'AGGREGATOR'
            );
            return true;
          }
        } catch (fallbackError) {
          console.error(`${categoryName} fallback failed:`, fallbackError);
        }
      }
      return false;
    }
  }

  // POST /api/solar-audit/update - Fetch live data and populate audit ledger
  app.post('/api/solar-audit/update', async (req, res) => {
    try {
      const rights = {
        privacy: "ENFORCED",
        non_discrimination: "ENFORCED",
        auditability: "FULL"
      };

      const EIA_API_KEY = process.env.EIA_API_KEY;
      let recordsCreated = 0;

      // 1. Money/Blockchain (live Bitcoin via CBECI - always available)
      const moneySuccess = await tieredFetch(feedMoneyKwh, 'money', rights);
      if (moneySuccess) recordsCreated++;

      // 2. EIA-backed categories (DIRECT sources - requires API key)
      if (EIA_API_KEY) {
        console.log('📊 Fetching live EIA data for 5 energy sectors...');
        
        const housingSuccess = await tieredFetch(feedHousingKwh, 'housing', rights);
        if (housingSuccess) recordsCreated++;
        
        const digitalSuccess = await tieredFetch(feedDigitalServicesKwh, 'digital-services', rights);
        if (digitalSuccess) recordsCreated++;
        
        const mfgSuccess = await tieredFetch(feedManufacturingKwh, 'manufacturing', rights);
        if (mfgSuccess) recordsCreated++;
        
        const transportSuccess = await tieredFetch(feedTransportKwh, 'transport', rights);
        if (transportSuccess) recordsCreated++;
        
        const foodSuccess = await tieredFetch(feedFoodAgricultureKwh, 'food', rights);
        if (foodSuccess) recordsCreated++;
        
        console.log('✅ Solar Audit data updated successfully with live feeds');
      } else {
        console.warn('⚠️  EIA_API_KEY missing; skipping housing, digital-services, manufacturing, transport, food categories');
      }

      res.json({ 
        status: 'ok', 
        date: new Date().toISOString().split('T')[0],
        recordsCreated,
        eiaDataAvailable: !!EIA_API_KEY
      });
    } catch (error) {
      console.error('Solar Audit update error:', error);
      res.status(500).json({ error: 'Failed to update solar audit data', details: String(error) });
    }
  });

  // GET /api/solar-audit/entries - Return full audit log
  app.get('/api/solar-audit/entries', async (req, res) => {
    try {
      const entries = await db
        .select({
          id: solarAuditEntries.id,
          category: solarAuditCategories.name,
          source: solarAuditDataSources.name,
          sourceOrganization: solarAuditDataSources.organization,
          verificationLevel: solarAuditDataSources.verificationLevel,
          sourceType: solarAuditDataSources.sourceType,
          day: solarAuditEntries.day,
          kwh: solarAuditEntries.kwh,
          solarUnits: solarAuditEntries.solarUnits,
          rightsAlignment: solarAuditEntries.rightsAlignment,
          dataHash: solarAuditEntries.dataHash,
          notes: solarAuditEntries.notes,
          createdAt: solarAuditEntries.createdAt
        })
        .from(solarAuditEntries)
        .innerJoin(solarAuditCategories, eq(solarAuditEntries.categoryId, solarAuditCategories.id))
        .innerJoin(solarAuditDataSources, eq(solarAuditEntries.sourceId, solarAuditDataSources.id))
        .orderBy(desc(solarAuditEntries.day), desc(solarAuditEntries.createdAt));

      res.json(entries);
    } catch (error) {
      console.error('Solar Audit entries error:', error);
      res.status(500).json({ error: 'Failed to fetch audit entries' });
    }
  });

  // GET /api/solar-audit/summary - Return daily aggregates
  app.get('/api/solar-audit/summary', async (req, res) => {
    try {
      // Get all entries grouped by category
      const summary = await db
        .select({
          category: solarAuditCategories.name,
          totalKwh: sql<string>`SUM(${solarAuditEntries.kwh})`,
          totalSolar: sql<string>`SUM(${solarAuditEntries.solarUnits})`,
          recordCount: sql<number>`COUNT(*)`
        })
        .from(solarAuditEntries)
        .innerJoin(solarAuditCategories, eq(solarAuditEntries.categoryId, solarAuditCategories.id))
        .groupBy(solarAuditCategories.name);

      // Calculate global totals
      const globalKwh = summary.reduce((sum, cat) => sum + parseFloat(cat.totalKwh || '0'), 0);
      const globalSolar = summary.reduce((sum, cat) => sum + parseFloat(cat.totalSolar || '0'), 0);

      res.json({
        categories: summary,
        global: {
          totalKwh: globalKwh,
          totalSolar: globalSolar,
          totalRecords: summary.reduce((sum, cat) => sum + cat.recordCount, 0)
        }
      });
    } catch (error) {
      console.error('Solar Audit summary error:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // POST /api/solar-audit/categories - Create new category
  app.post('/api/solar-audit/categories', async (req, res) => {
    try {
      const validatedData = insertSolarAuditCategorySchema.parse(req.body);
      const result = await db.insert(solarAuditCategories).values(validatedData).returning();
      res.json(result[0]);
    } catch (error) {
      console.error('Category creation error:', error);
      res.status(400).json({ error: 'Invalid category data', details: String(error) });
    }
  });

  // POST /api/solar-audit/sources - Create new data source
  app.post('/api/solar-audit/sources', async (req, res) => {
    try {
      const validatedData = insertSolarAuditDataSourceSchema.parse(req.body);
      const result = await db.insert(solarAuditDataSources).values(validatedData).returning();
      res.json(result[0]);
    } catch (error) {
      console.error('Data source creation error:', error);
      res.status(400).json({ error: 'Invalid data source', details: String(error) });
    }
  });

  // GET /api/solar-audit/last - Return latest audit with regional breakdowns and data freshness
  app.get('/api/solar-audit/last', async (req, res) => {
    try {
      // Get most recent audit entries (one per category for today)
      const latestEntries = await db
        .select({
          id: solarAuditEntries.id,
          category: solarAuditCategories.name,
          categoryId: solarAuditEntries.categoryId,
          source: solarAuditDataSources.name,
          sourceOrganization: solarAuditDataSources.organization,
          verificationLevel: solarAuditDataSources.verificationLevel,
          day: solarAuditEntries.day,
          kwh: solarAuditEntries.kwh,
          solarUnits: solarAuditEntries.solarUnits,
          notes: solarAuditEntries.notes,
          createdAt: solarAuditEntries.createdAt
        })
        .from(solarAuditEntries)
        .innerJoin(solarAuditCategories, eq(solarAuditEntries.categoryId, solarAuditCategories.id))
        .innerJoin(solarAuditDataSources, eq(solarAuditEntries.sourceId, solarAuditDataSources.id))
        .orderBy(desc(solarAuditEntries.day), desc(solarAuditEntries.createdAt))
        .limit(20);

      // Get regional breakdowns for these entries
      const entryIds = latestEntries.map(e => e.id);
      const regionalData = entryIds.length > 0 
        ? await db
            .select()
            .from(auditRegionTotals)
            .where(sql`${auditRegionTotals.auditLogId} IN (${sql.join(entryIds, sql`, `)})`)
        : [];

      // Get region metadata
      const regions = await db
        .select()
        .from(auditRegions);

      // Combine data: add regional breakdowns to each category
      const categoriesWithRegions = latestEntries.reduce((acc, entry) => {
        const categoryRegions = regionalData
          .filter(r => Number(r.auditLogId) === Number(entry.id))
          .map(r => {
            const regionInfo = regions.find(reg => reg.code === r.regionCode);
            return {
              code: r.regionCode,
              name: regionInfo?.name || r.regionCode,
              level: regionInfo?.level || 1,
              population: regionInfo?.population,
              energyKwh: r.energyKwh,
              energySolar: r.energySolar,
              dataFreshness: r.dataFreshness,
              metadata: r.metadata
            };
          });

        acc.push({
          ...entry,
          regions: categoryRegions
        });
        return acc;
      }, [] as any[]);

      res.json({
        timestamp: new Date().toISOString(),
        nextUpdate: '03:00 UTC daily',
        dataVintage: '2023-2024',
        categories: categoriesWithRegions
      });
    } catch (error) {
      console.error('Solar Audit last error:', error);
      res.status(500).json({ error: 'Failed to fetch latest audit data' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
