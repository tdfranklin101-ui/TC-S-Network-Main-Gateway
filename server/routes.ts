import express, { type Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertNewsletterSubscriptionSchema, insertContactMessageSchema } from "@shared/schema";
import { setupWaitlistRoutes } from "./waitlist";
import { setupAdminRoutes } from "./admin";
import cookieParser from "cookie-parser";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser middleware for admin authentication
  app.use(cookieParser());
  const apiRouter = express.Router();
  
  // API routes
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
  
  // Set up waitlist routes (direct routes, not under /api)
  setupWaitlistRoutes(app);
  
  // Set up admin routes
  setupAdminRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

import { createServer } from "http";
