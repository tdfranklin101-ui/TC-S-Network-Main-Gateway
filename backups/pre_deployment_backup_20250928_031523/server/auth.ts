import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends UserType {}
    interface Request {
      login(user: any, callback: (err: any) => void): void;
      logout(callback: (err?: any) => void): void;
      isAuthenticated(): boolean;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "currentsee-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done: any) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.password || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user: any, done: any) => done(null, user.id));
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration request received:", { 
        username: req.body.username,
        email: req.body.email,
        displayName: req.body.displayName,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        isAnonymous: req.body.isAnonymous
      });
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Registration failed: Username already exists");
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash the password before saving
      const hashedPassword = await hashPassword(req.body.password);
      
      // Ensure firstName and lastName are set properly
      const firstName = req.body.firstName || (req.body.displayName ? req.body.displayName.split(' ')[0] : '');
      const lastName = req.body.lastName || (req.body.displayName && req.body.displayName.includes(' ') 
        ? req.body.displayName.split(' ').slice(1).join(' ') 
        : '');
      
      console.log("Creating user with name data:", { firstName, lastName });
      
      const user = await storage.createUser({
        username: req.body.username,
        password: hashedPassword,
        email: req.body.email || null,
        firstName: firstName || null,
        lastName: lastName || null
      });
      
      console.log("User created successfully with ID:", user.id);

      // Calculate Solar balance: 1 Solar per day since April 7, 2025
      const solarGenesisDate = new Date('2025-04-07T00:00:00.000Z');
      const currentDate = new Date();
      const daysSinceGenesis = Math.floor((currentDate.getTime() - solarGenesisDate.getTime()) / (1000 * 60 * 60 * 24));
      const initialSolarBalance = Math.max(0, daysSinceGenesis); // 1 Solar per day, minimum 0
      
      console.log(`Calculating Solar balance: ${daysSinceGenesis} days since genesis = ${initialSolarBalance} Solar`);
      
      // Create user profile with calculated Solar balance
      const userProfile = await storage.createUserProfile({
        userId: user.id,
        solarBalance: initialSolarBalance,
        totalEarned: initialSolarBalance,
        registrationBonus: true
      });
      
      console.log(`User profile created with ${initialSolarBalance} Solar balance`);
      
      // Create registration transaction record
      await storage.createTransaction({
        userId: user.id,
        type: 'registration_bonus',
        amount: initialSolarBalance,
        currency: 'SOLAR',
        status: 'completed',
        description: `Registration bonus: ${daysSinceGenesis} days since Solar genesis (April 7, 2025)`,
        completedAt: new Date()
      });

      req.login(user, (err: any) => {
        if (err) {
          console.error("Login after registration failed:", err);
          return next(err);
        }
        
        // Remove password from response
        const userResponse = { ...user, password: undefined };
        
        console.log("Registration completed successfully, sending response");
        res.status(201).json({ 
          user: userResponse, 
          userProfile,
          solarBalance: initialSolarBalance
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication failed" });
      }
      
      // Get user's Solar profile
      const userProfile = await storage.getUserProfile(req.user.id);
      
      // If no profile exists, create one with calculated Solar balance
      let profile = userProfile;
      if (!profile) {
        const solarGenesisDate = new Date('2025-04-07T00:00:00.000Z');
        const currentDate = new Date();
        const daysSinceGenesis = Math.floor((currentDate.getTime() - solarGenesisDate.getTime()) / (1000 * 60 * 60 * 24));
        const initialSolarBalance = Math.max(0, daysSinceGenesis);
        
        profile = await storage.createUserProfile({
          userId: req.user.id,
          solarBalance: initialSolarBalance,
          totalEarned: initialSolarBalance,
          registrationBonus: true
        });
        
        console.log(`Created missing profile for user ${req.user.id} with ${initialSolarBalance} Solar`);
      }
      
      // Remove password from response
      const userResponse = { ...req.user, password: undefined };
      res.status(200).json({ 
        user: userResponse,
        userProfile: profile,
        solarBalance: profile.solarBalance
      });
    } catch (error) {
      console.error('Error during login:', error);
      if (!req.user) {
        return res.status(500).json({ error: "Login failed" });
      }
      const userResponse = { ...req.user, password: undefined };
      res.status(200).json(userResponse);
    }
  });
  
  // API endpoint to update existing account with credentials
  app.post("/api/update-account", async (req, res, next) => {
    try {
      const { identifier, email, password } = req.body;
      
      if (!identifier || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Try to find the user by ID first (if it looks like a UUID)
      let user;
      if (identifier.length > 10 && identifier.includes('-')) {
        user = await storage.getUser(identifier);
      }
      
      // If not found by ID, try by username
      if (!user) {
        user = await storage.getUserByUsername(identifier);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Update the user with new credentials
      const updatedUser = await storage.updateUserCredentials(user.id, email, hashedPassword);
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user" });
      }
      
      res.status(200).json({ success: true, message: "Account updated successfully" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err?: any) => {
      if (err) return next(err);
      res.status(200).send({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }
    
    try {
      // Get user's Solar profile
      const userProfile = await storage.getUserProfile(req.user.id);
      
      // Remove password from response
      const userResponse = { ...req.user, password: undefined };
      res.json({ 
        user: userResponse,
        userProfile,
        solarBalance: userProfile?.solarBalance || 0
      });
    } catch (error) {
      console.error('Error getting user profile:', error);
      const userResponse = { ...req.user, password: undefined };
      res.json(userResponse);
    }
  });

  app.get("/api/session", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.json({ success: false, authenticated: false });
    }
    
    try {
      // Get user's Solar profile
      const userProfile = await storage.getUserProfile(req.user.id);
      
      // Remove password from response
      const userResponse = { ...req.user, password: undefined };
      res.json({ 
        success: true,
        authenticated: true,
        user: userResponse,
        userProfile,
        solarBalance: userProfile?.solarBalance || 0
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.json({ success: false, authenticated: false });
    }
  });
}

// Helper middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send('Unauthorized');
}