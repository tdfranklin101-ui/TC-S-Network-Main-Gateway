import express, { type Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { insertNewsletterSubscriptionSchema, insertContactMessageSchema, solarClock } from "@shared/schema";
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
import cors from "cors";
import { db } from "./db";
import { sql } from "drizzle-orm";
import apiRoutes from "./routes/api";
import progressionRoutes from "./routes/progression";
import paymentsRoutes from "./routes/payments";
import aiRoutes from "./routes/ai";
import geoip from "geoip-lite";
import multer from "multer";

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
    if (allowedOrigins.includes(origin)) {
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
      const totalKwh = parseFloat(String(baseData.kwh)) + additionalKwh;
      const totalDollars = parseFloat(String(baseData.dollars)) + additionalDollars;
      
      // Check if we need to update the base values (if it's a new day)
      const baseDate = new Date(baseData.timestamp);
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

  apiRouter.post("/user/:userId/topup", async (req, res) => {
    try {
      const { amount, stripePaymentIntentId } = req.body; // amount in Solar tokens
      
      // Create transaction record
      const transaction = await storage.createTransaction({
        userId: req.params.userId,
        type: 'stripe_topup',
        amount: amount,
        currency: 'SOLAR',
        status: 'completed',
        stripePaymentIntentId,
        description: `Top-up ${amount} Solar tokens`,
        completedAt: new Date()
      });
      
      // Update user balance
      const updatedProfile = await storage.updateSolarBalance(req.params.userId, amount);
      
      res.json({ transaction, profile: updatedProfile });
    } catch (error) {
      console.error("Top-up error:", error);
      res.status(500).json({ error: "Top-up failed" });
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

  // Initialize AI services
  const aiWalletAssistant = new AIWalletAssistant();
  const aiMarketIntelligence = new AIMarketIntelligence();
  
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
      const userId = req.body.userId || req.session?.user?.id;
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
        message: error.message 
      });
    }
  });

  aiRouter.post("/chat", async (req, res) => {
    try {
      const { message, context, conversationHistory } = req.body;
      const userId = req.body.userId || req.session?.user?.id;

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
        message: error.message 
      });
    }
  });

  aiRouter.post("/content-recommendations", async (req, res) => {
    try {
      const userId = req.body.userId || req.session?.user?.id;
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
        message: error.message 
      });
    }
  });

  aiRouter.get("/user-context", async (req, res) => {
    try {
      const userId = req.session?.user?.id;
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
        message: error.message 
      });
    }
  });

  // Helper functions for AI responses
  function formatAIResponse(response) {
    if (response.insights && response.insights.length > 0) {
      return `Here's what I found:\n\n${response.insights.join('\n\n')}`;
    }
    return 'I analyzed your request and here are the results.';
  }

  function generateFollowUpSuggestions(response) {
    const suggestions = [];
    
    if (response.type === 'analysis') {
      suggestions.push("Tell me more about these patterns");
      suggestions.push("How can I improve this?");
    } else if (response.type === 'recommendation') {
      suggestions.push("Why do you recommend this?");
      suggestions.push("What are some alternatives?");
    }
    
    return suggestions;
  }

  function generateSpeechText(response) {
    if (response.insights && response.insights.length > 0) {
      return response.insights.slice(0, 2).join('. ') + '.';
    }
    return 'I have analyzed your request and found some interesting information for you.';
  }

  function determineUserSegment(userProfile, transactions) {
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
        displayName: account.displayName || account.accountNumber,
        solarBalance: parseFloat(account.totalSolar).toFixed(5),
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
        displayName: account.displayName || account.accountNumber,
        solarBalance: parseFloat(account.totalSolar).toFixed(5),
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
        displayName: account.displayName || account.accountNumber,
        solarBalance: parseFloat(account.totalSolar).toFixed(5),
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

  apiRouter.post("/user/:userId/topup", async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, stripePaymentIntentId } = req.body;
      
      if (!amount || !stripePaymentIntentId) {
        return res.status(400).json({ error: "amount and stripePaymentIntentId required" });
      }
      
      // TODO: Verify payment with Stripe and update balance
      const profile = {
        userId,
        solarBalance: 1000 + amount, // Add to existing balance
        totalEarned: 1000 + amount,
        totalSpent: 0,
        lastActivityAt: new Date().toISOString()
      };
      
      const transaction = {
        id: `txn_${Date.now()}`,
        userId,
        type: 'topup',
        amount,
        stripePaymentIntentId,
        createdAt: new Date().toISOString()
      };
      
      res.json({ profile, transaction });
    } catch (error) {
      console.error('Top-up error:', error);
      res.status(500).json({ error: "Top-up failed", message: String(error) });
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

  // Stripe payment intent creation
  apiRouter.post("/payment/create-intent", async (req, res) => {
    try {
      const { amount, currency = 'usd', userId } = req.body;
      
      if (!amount || amount < 250) { // Minimum $2.50 (250 cents)
        return res.status(400).json({ error: "Minimum amount is $2.50" });
      }
      
      // TODO: Create Stripe payment intent
      // For now, return a mock response
      res.json({
        client_secret: `pi_mock_${Date.now()}_secret_mock`,
        amount,
        currency
      });
    } catch (error) {
      console.error('Payment intent creation error:', error);
      res.status(500).json({ error: "Payment intent creation failed", message: String(error) });
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

  const httpServer = createServer(app);
  return httpServer;
}
