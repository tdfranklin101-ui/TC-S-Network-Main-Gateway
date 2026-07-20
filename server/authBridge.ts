import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { pool } from "./db"; // Reuse existing pg pool
import { createSessionToken, verifySessionToken, setAuthCookie, clearAuthCookie, type SessionPayload } from "./sessionBridge";

// ------------------------------------------------------------------
// Zod schemas
// ------------------------------------------------------------------
const loginInputSchema = z.object({
  identifier: z.string().min(1).max(120),
  password: z.string().min(1).max(120),
});

const registerInputSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email().max(120),
  password: z.string().min(6).max(120),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
});

// ------------------------------------------------------------------
// CORS helper
// ------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://excellent-direction.replit.app",
  "https://excellent-direction.replit.dev",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".replit.app") || origin.endsWith(".replit.dev"))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_KEY || "tcs-bridge-fallback-secret-change-me";
}

async function findMemberByIdentifier(identifier: string): Promise<any | null> {
  if (!pool) return null;
  const normalized = identifier.toLowerCase().trim();
  // Try username first
  const byUser = await pool.query(
    "SELECT id, username, name, email, first_name, last_name, password_hash, total_solar, is_agent, is_external_agent, api_key, signup_timestamp FROM members WHERE LOWER(username) = LOWER($1) LIMIT 1",
    [normalized]
  );
  if (byUser.rows.length > 0) return byUser.rows[0];
  // Try email
  const byEmail = await pool.query(
    "SELECT id, username, name, email, first_name, last_name, password_hash, total_solar, is_agent, is_external_agent, api_key, signup_timestamp FROM members WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [normalized]
  );
  if (byEmail.rows.length > 0) return byEmail.rows[0];
  return null;
}

async function verifyBcrypt(password: string, hash: string): Promise<boolean> {
  try {
    const bcrypt = require("bcrypt");
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

function toMemberResponse(member: any) {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    totalSolar: parseFloat(member.total_solar || "0"),
    isAgent: member.is_agent,
    isExternalAgent: member.is_external_agent,
    memberSince: member.signup_timestamp,
  };
}

// ------------------------------------------------------------------
// Middleware: authenticate from tcs_auth cookie
// ------------------------------------------------------------------
export async function bridgeAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.tcs_auth || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const result = verifySessionToken(token, getSecret());
  if (!result.valid || result.expired) {
    return res.status(401).json({ success: false, error: "Session invalid or expired" });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  const memberRows = await pool.query(
    "SELECT id, username, name, email, first_name, last_name, total_solar, is_agent, is_external_agent, signup_timestamp FROM members WHERE id = $1 LIMIT 1",
    [result.payload.memberId]
  );

  if (memberRows.rows.length === 0) {
    return res.status(401).json({ success: false, error: "Member not found" });
  }

  (req as any).member = toMemberResponse(memberRows.rows[0]);
  next();
}

// ------------------------------------------------------------------
// Router
// ------------------------------------------------------------------
export const authBridgeRouter = Router();

authBridgeRouter.use((req, res, next) => {
  const origin = req.headers.origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// POST /auth/login
authBridgeRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { identifier, password } = parsed.data;
    const member = await findMemberByIdentifier(identifier);

    if (!member) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const match = await verifyBcrypt(password, member.password_hash);
    if (!match) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const payload: SessionPayload = {
      memberId: member.id,
      username: member.username,
      email: member.email,
      iat: Date.now(),
    };

    const token = createSessionToken(payload, getSecret());
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      member: toMemberResponse(member),
      token,
    });
  } catch (err) {
    console.error("[authBridge] login error:", err);
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// POST /auth/register
authBridgeRouter.post("/register", async (req, res) => {
  try {
    const parsed = registerInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { username, email, password, firstName, lastName } = parsed.data;

    if (!pool) {
      res.status(503).json({ success: false, error: "Database unavailable" });
      return;
    }

    // Check existing
    const existing = await pool.query(
      "SELECT id FROM members WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1",
      [username, email]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: "Username or email already registered" });
      return;
    }

    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash(password, 12);

    // Calculate genesis Solar
    const genesis = new Date("2025-04-07T00:00:00.000Z");
    const days = Math.floor((Date.now() - genesis.getTime()) / (1000 * 60 * 60 * 24));
    const initialSolar = Math.max(1, days);

    const result = await pool.query(
      `INSERT INTO members (username, name, email, first_name, last_name, password_hash, total_solar, total_dollars, is_anonymous, is_reserve, is_placeholder, last_distribution_date, signup_timestamp, is_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13)
       RETURNING id, username, name, email, first_name, last_name, total_solar, is_agent, is_external_agent, signup_timestamp`,
      [
        username,
        `${firstName || ""} ${lastName || ""}`.trim() || username,
        email,
        firstName || null,
        lastName || null,
        hash,
        initialSolar,
        initialSolar * 0.2,
        false,
        false,
        false,
        new Date().toISOString(),
        false,
      ]
    );

    const member = result.rows[0];
    const payload: SessionPayload = {
      memberId: member.id,
      username: member.username,
      email: member.email,
      iat: Date.now(),
    };
    const token = createSessionToken(payload, getSecret());
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      member: toMemberResponse(member),
      token,
      genesisSolar: initialSolar,
    });
  } catch (err) {
    console.error("[authBridge] register error:", err);
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// POST /auth/logout
authBridgeRouter.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

// GET /auth/me
authBridgeRouter.get("/me", bridgeAuthMiddleware, (req, res) => {
  res.status(200).json({ success: true, member: (req as any).member });
});
