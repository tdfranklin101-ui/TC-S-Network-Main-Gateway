import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "session",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupReplitAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/gumball.html",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // Auth user endpoint - returns user data with wallet info
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Try to find and link a wallet by email
      let wallet = null;
      if (user?.email) {
        wallet = await storage.getWalletByEmail(user.email);
        if (!wallet) {
          // Check if user already has a wallet by userId
          wallet = await storage.getWalletByUserId(userId);
        }
      }
      
      res.json({
        ...user,
        wallet: wallet ? {
          id: wallet.id,
          balanceSolarS: wallet.balanceSolarS,
          balanceRays: wallet.balanceRays,
          promptCredits: wallet.promptCredits,
        } : null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Session endpoint - returns current user and Solar balance
  app.get('/api/session', async (req: any, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.json({ success: false, authenticated: false });
    }
    
    try {
      const userId = req.user.claims?.sub;
      const userEmail = req.user.claims?.email;
      
      if (!userId) {
        return res.json({ success: false, authenticated: false });
      }
      
      const user = await storage.getUser(userId);
      
      // CRITICAL: Get Solar balance from members.total_solar (single source of truth)
      let solarBalance = 0;
      let balanceSource = 'default';
      
      if (userEmail) {
        const member = await storage.getMemberByEmail(userEmail);
        if (member) {
          solarBalance = parseFloat(member.totalSolar || '0');
          balanceSource = 'members.total_solar';
        }
      }
      
      // Also try to get wallet info
      let wallet = null;
      if (userEmail) {
        wallet = await storage.getWalletByEmail(userEmail);
      }
      
      res.json({ 
        success: true,
        authenticated: true,
        user: {
          id: userId,
          email: userEmail,
          username: user?.firstName || userEmail?.split('@')[0] || 'Member',
          firstName: user?.firstName,
          lastName: user?.lastName,
          profileImageUrl: user?.profileImageUrl,
        },
        solarBalance,
        balanceSource,
        wallet: wallet ? {
          id: wallet.id,
          balanceSolarS: wallet.balanceSolarS,
          balanceRays: wallet.balanceRays,
        } : null
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.json({ success: false, authenticated: false, error: 'Session error' });
    }
  });

  // Claim wallet endpoint - links a pre-populated wallet to the user
  app.post('/api/auth/claim-wallet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      
      if (!userEmail) {
        return res.status(400).json({ message: "No email associated with your account" });
      }
      
      // Check if user already has a wallet
      const existingWallet = await storage.getWalletByUserId(userId);
      if (existingWallet) {
        return res.json({ 
          message: "Wallet already claimed",
          wallet: {
            id: existingWallet.id,
            balanceSolarS: existingWallet.balanceSolarS,
            balanceRays: existingWallet.balanceRays,
            promptCredits: existingWallet.promptCredits,
          }
        });
      }
      
      // Try to find wallet by email
      const walletByEmail = await storage.getWalletByEmail(userEmail);
      if (walletByEmail) {
        // Link wallet to user
        await storage.linkWalletToUser(walletByEmail.id, userId);
        return res.json({
          message: "Wallet claimed successfully!",
          wallet: {
            id: walletByEmail.id,
            balanceSolarS: walletByEmail.balanceSolarS,
            balanceRays: walletByEmail.balanceRays,
            promptCredits: walletByEmail.promptCredits,
          }
        });
      }
      
      // Create a new wallet for the user with starter balance
      const newWallet = await storage.createWallet({
        userId: userId,
        email: userEmail,
        balanceSolarS: "1.000000",
        balanceRays: 1000,
        promptCredits: 3,
      });
      
      res.json({
        message: "New wallet created with starter balance!",
        wallet: {
          id: newWallet.id,
          balanceSolarS: newWallet.balanceSolarS,
          balanceRays: newWallet.balanceRays,
          promptCredits: newWallet.promptCredits,
        }
      });
    } catch (error) {
      console.error("Error claiming wallet:", error);
      res.status(500).json({ message: "Failed to claim wallet" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
