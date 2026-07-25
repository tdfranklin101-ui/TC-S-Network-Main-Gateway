/**
 * Solar Passport Auth Bridge (production)
 * ----------------------------------------
 * Cross-origin authentication endpoints for the Solar Passport app
 * (excellent-direction.replit.app) against the shared `members` table.
 *
 * Endpoints:
 *   POST /auth/login       — sign in (username or email + password)
 *   POST /auth/register    — create member (genesis Solar + welcome email)
 *   POST /auth/logout      — clear session cookie
 *   GET  /auth/me          — current member (HMAC cookie or Bearer token)
 *   GET  /auth/gbi-status  — active GBI membership verification
 *
 * Sessions are stateless HMAC-SHA256 signed tokens (no schema changes).
 */

const { createHmac, timingSafeEqual } = require('crypto');

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const GENESIS_DATE = new Date('2025-04-07T00:00:00Z');
const GBI_DAILY_RATE = 1; // 1 Solar per member per day

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_KEY;
  if (!secret) {
    throw new Error('Auth bridge requires SESSION_SECRET (or ADMIN_KEY) to be set');
  }
  return secret;
}

// ---------------------------------------------------------------
// Per-IP rate limiting (in-memory, sliding window)
// ---------------------------------------------------------------
const rateBuckets = new Map();
const RATE_LIMITS = {
  '/auth/login': { windowMs: 15 * 60 * 1000, max: 20 },     // 20 attempts / 15 min
  '/auth/register': { windowMs: 60 * 60 * 1000, max: 5 }     // 5 registrations / hour
};

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(req, pathname) {
  const limit = RATE_LIMITS[pathname];
  if (!limit) return false;
  const key = `${pathname}:${clientIp(req)}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket) { bucket = []; rateBuckets.set(key, bucket); }
  // Drop entries outside the window
  while (bucket.length && now - bucket[0] > limit.windowMs) bucket.shift();
  if (bucket.length >= limit.max) return true;
  bucket.push(now);
  // Opportunistic cleanup to bound memory
  if (rateBuckets.size > 10000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > 60 * 60 * 1000) rateBuckets.delete(k);
    }
  }
  return false;
}

// ---------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------
function signValue(value) {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

function createToken(payload) {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${json}.${signValue(json)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const value = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = signValue(value);
  try {
    if (sig.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!payload.memberId || typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) return null;
    if (payload.iat > Date.now() + 5 * 60 * 1000) return null; // reject future-skewed tokens
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookies(req).tcs_auth || null;
}

// ---------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'https://excellent-direction.replit.app',
  'https://www.thecurrentsee.org',
  'https://thecurrentsee.org',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:3000'
]);

function corsHeaders(req) {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  const allowed = ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://excellent-direction.replit.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

function json(req, res, status, body, extraHeaders) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(req), extraHeaders || {}));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function authCookie(token) {
  return [
    `tcs_auth=${token}`,
    'HttpOnly',
    'SameSite=None',
    'Secure',
    'Path=/',
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`
  ].join('; ');
}

function memberResponse(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    totalSolar: parseFloat(row.total_solar) || 0,
    isAgent: !!row.is_agent,
    memberSince: row.signup_timestamp || row.joined_date
  };
}

const MEMBER_COLS = 'id, username, name, email, first_name, last_name, password_hash, total_solar, is_agent, signup_timestamp, joined_date, last_distribution_date';

async function findMember(pool, identifier) {
  const result = await pool.query(
    `SELECT ${MEMBER_COLS} FROM members WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1`,
    [String(identifier).trim()]
  );
  return result.rows[0] || null;
}

async function authenticateRequest(req, pool) {
  const payload = verifyToken(extractToken(req));
  if (!payload) return null;
  const result = await pool.query(
    `SELECT ${MEMBER_COLS} FROM members WHERE id = $1 LIMIT 1`,
    [payload.memberId]
  );
  return result.rows[0] || null;
}

function gbiStatus(row) {
  const memberSince = new Date(row.signup_timestamp || row.joined_date || GENESIS_DATE);
  const daysInNetwork = Math.max(0, Math.floor((Date.now() - memberSince.getTime()) / 86400000));
  return {
    member: row.username,
    active: true,
    gbi: {
      program: 'TC-S Solar Daily Distribution',
      dailyRate: GBI_DAILY_RATE,
      unit: 'SOLAR',
      kwhPerSolar: 4913,
      lastDistribution: row.last_distribution_date || null
    },
    memberSince: memberSince.toISOString(),
    daysInNetwork,
    totalSolar: parseFloat(row.total_solar) || 0
  };
}

// ---------------------------------------------------------------
// Solar Passport email (non-blocking)
// The passport ARTIFACT itself is delivered by email — no external
// UI is involved. Any signup path (site or bridge) signals through
// here so every new member receives their passport.
// ---------------------------------------------------------------
async function getEnvResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const { Resend } = await import('resend');
  return { client: new Resend(apiKey), fromEmail: 'TC-S Network <hello@thecurrentsee.org>' };
}

async function sendSolarPassportEmail(member, genesisSolar, getClient) {
  try {
    if (!member || !member.email) return;
    let resendCtx = null;
    if (typeof getClient === 'function') {
      try { resendCtx = await getClient(); } catch (err) {
        console.warn('⚠️ Resend connector unavailable, trying env key:', err.message);
      }
    }
    if (!resendCtx) resendCtx = await getEnvResendClient();
    if (!resendCtx) {
      console.warn(`⚠️ Solar Passport email skipped for ${member.email} — no Resend credentials`);
      return;
    }
    const { client, fromEmail } = resendCtx;
    const memberSince = new Date(member.signup_timestamp || member.joined_date || Date.now());
    const passportId = `TCS-${String(member.id).padStart(6, '0')}`;
    const holderName = member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username;
    const verifyUrl = `https://www.thecurrentsee.org/auth/gbi-status?member=${encodeURIComponent(member.username)}`;
    await client.emails.send({
      from: fromEmail || 'TC-S Network <hello@thecurrentsee.org>',
      to: member.email,
      subject: '🛂 Your Solar Passport — The Current-See Network',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a1828;color:#fff;padding:32px;border-radius:12px;border:1px solid rgba(0,245,212,0.35)">
          <div style="text-align:center;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;margin-bottom:20px">
            <div style="font-size:11px;letter-spacing:4px;color:rgba(255,255,255,0.65)">THE CURRENT-SEE NETWORK</div>
            <h1 style="color:#00f5d4;margin:8px 0 0;letter-spacing:2px">☀️ SOLAR PASSPORT</h1>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:rgba(255,255,255,0.55);width:45%">Passport No.</td><td style="padding:6px 0;color:#fff;font-weight:bold">${passportId}</td></tr>
            <tr><td style="padding:6px 0;color:rgba(255,255,255,0.55)">Holder</td><td style="padding:6px 0;color:#fff;font-weight:bold">${holderName}</td></tr>
            <tr><td style="padding:6px 0;color:rgba(255,255,255,0.55)">Username</td><td style="padding:6px 0;color:#fff">${member.username}</td></tr>
            <tr><td style="padding:6px 0;color:rgba(255,255,255,0.55)">Member Since</td><td style="padding:6px 0;color:#fff">${memberSince.toISOString().slice(0, 10)}</td></tr>
          </table>
          <div style="background:rgba(0,245,212,0.08);border:1px solid rgba(0,245,212,0.3);border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:4px 0"><strong style="color:#39ff14">Genesis Solar Balance:</strong> ${genesisSolar} SOLAR</p>
            <p style="margin:4px 0"><strong style="color:#39ff14">Daily Distribution:</strong> +1 SOLAR every day</p>
            <p style="margin:4px 0"><strong style="color:#39ff14">Energy Backing:</strong> 1 SOLAR = 4,913 kWh</p>
          </div>
          <p style="font-size:13px;color:rgba(255,255,255,0.75)">This passport certifies your active membership in the solar-backed Global Basic Income. Verify your membership status anytime at:<br>
          <a href="${verifyUrl}" style="color:#00f5d4;word-break:break-all">${verifyUrl}</a></p>
          <p>Visit the <a href="https://www.thecurrentsee.org/marketplace.html" style="color:#00f5d4">marketplace</a> to transact with your Solar, or check your balance anytime at <a href="https://www.thecurrentsee.org" style="color:#00f5d4">thecurrentsee.org</a>.</p>
          <p style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:24px">The Current-See Foundation • Contribution begets compensation</p>
        </div>`
    });
    console.log(`🛂 Solar Passport ${passportId} emailed to ${member.email}`);
  } catch (err) {
    console.warn('⚠️ Solar Passport email failed (non-blocking):', err.message);
  }
}

// ---------------------------------------------------------------
// Main handler — returns true if the request was handled
// ---------------------------------------------------------------
async function handleAuthBridge(req, res, pathname, ctx) {
  if (!pathname.startsWith('/auth/')) return false;
  const { pool, bcrypt, getResendClient } = ctx;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return true;
  }

  // Per-IP rate limiting on sensitive endpoints
  if (req.method === 'POST' && isRateLimited(req, pathname)) {
    json(req, res, 429, { success: false, error: 'Too many requests — please try again later' });
    return true;
  }

  // ---- POST /auth/login ----
  if (pathname === '/auth/login' && req.method === 'POST') {
    try {
      if (!pool || !bcrypt) return json(req, res, 503, { success: false, error: 'Service unavailable' }), true;
      const body = await readBody(req);
      const identifier = body.identifier || body.username || body.email;
      const password = body.password;
      if (!identifier || !password) {
        json(req, res, 400, { success: false, error: 'identifier and password are required' });
        return true;
      }
      const member = await findMember(pool, identifier);
      if (!member || !member.password_hash || !(await bcrypt.compare(password, member.password_hash))) {
        json(req, res, 401, { success: false, error: 'Invalid credentials' });
        return true;
      }
      const token = createToken({ memberId: member.id, username: member.username, iat: Date.now() });
      console.log(`🔐 [Passport Bridge] Login: ${member.username} (ID: ${member.id})`);
      json(req, res, 200, { success: true, member: memberResponse(member), token }, { 'Set-Cookie': authCookie(token) });
    } catch (err) {
      console.error('[Passport Bridge] login error:', err.message);
      json(req, res, 500, { success: false, error: 'Internal error' });
    }
    return true;
  }

  // ---- POST /auth/register ----
  if (pathname === '/auth/register' && req.method === 'POST') {
    try {
      if (!pool || !bcrypt) return json(req, res, 503, { success: false, error: 'Service unavailable' }), true;
      const body = await readBody(req);
      const { username, email, password, firstName, lastName } = body;
      if (!username || !email || !password) {
        json(req, res, 400, { success: false, error: 'username, email and password are required' });
        return true;
      }
      if (String(password).length < 6) {
        json(req, res, 400, { success: false, error: 'Password must be at least 6 characters' });
        return true;
      }
      const existing = await pool.query(
        'SELECT id FROM members WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1',
        [username, email]
      );
      if (existing.rows.length > 0) {
        json(req, res, 409, { success: false, error: 'Username or email already registered' });
        return true;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date();
      const genesisSolar = Math.max(0, Math.floor((now - GENESIS_DATE) / 86400000));
      const displayName = `${firstName || ''} ${lastName || ''}`.trim() || username;
      const result = await pool.query(
        `INSERT INTO members (username, email, first_name, last_name, password_hash, name, joined_date, total_solar, total_dollars, is_anonymous, is_reserve, is_placeholder, last_distribution_date, signup_timestamp, is_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),false)
         RETURNING ${MEMBER_COLS}`,
        [username, email, firstName || '', lastName || '', passwordHash, displayName, now.toISOString(), genesisSolar, 0, false, false, false, now.toISOString()]
      );
      const member = result.rows[0];
      const token = createToken({ memberId: member.id, username: member.username, iat: Date.now() });
      console.log(`📝 [Passport Bridge] New member: ${member.username} (ID: ${member.id}) | Genesis: ${genesisSolar} Solar`);
      sendSolarPassportEmail(member, genesisSolar, getResendClient); // fire-and-forget
      json(req, res, 201, { success: true, member: memberResponse(member), token, genesisSolar }, { 'Set-Cookie': authCookie(token) });
    } catch (err) {
      console.error('[Passport Bridge] register error:', err.message);
      if (err.code === '23505') json(req, res, 409, { success: false, error: 'Username or email already registered' });
      else json(req, res, 500, { success: false, error: 'Internal error' });
    }
    return true;
  }

  // ---- POST /auth/logout ----
  if (pathname === '/auth/logout' && req.method === 'POST') {
    json(req, res, 200, { success: true }, { 'Set-Cookie': 'tcs_auth=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0' });
    return true;
  }

  // ---- GET /auth/me ----
  if (pathname === '/auth/me' && req.method === 'GET') {
    try {
      if (!pool) return json(req, res, 503, { success: false, error: 'Service unavailable' }), true;
      const member = await authenticateRequest(req, pool);
      if (!member) {
        json(req, res, 401, { success: false, error: 'Not authenticated' });
        return true;
      }
      json(req, res, 200, { success: true, member: memberResponse(member) });
    } catch (err) {
      console.error('[Passport Bridge] me error:', err.message);
      json(req, res, 500, { success: false, error: 'Internal error' });
    }
    return true;
  }

  // ---- GET /auth/gbi-status ----
  if (pathname === '/auth/gbi-status' && req.method === 'GET') {
    try {
      if (!pool) return json(req, res, 503, { success: false, error: 'Service unavailable' }), true;
      // Authenticated: full status for the logged-in member
      const member = await authenticateRequest(req, pool);
      if (member) {
        json(req, res, 200, { success: true, ...gbiStatus(member) });
        return true;
      }
      // Public lookup by ?member=<username or email>: minimal verification only
      const url = new URL(req.url, `http://${req.headers.host}`);
      const lookup = url.searchParams.get('member');
      if (lookup) {
        const row = await findMember(pool, lookup);
        if (!row) {
          json(req, res, 404, { success: false, active: false, error: 'Member not found' });
          return true;
        }
        const status = gbiStatus(row);
        json(req, res, 200, {
          success: true,
          member: status.member,
          active: true,
          gbi: status.gbi,
          memberSince: status.memberSince,
          daysInNetwork: status.daysInNetwork
        });
        return true;
      }
      json(req, res, 401, { success: false, error: 'Provide a session token or ?member= lookup' });
    } catch (err) {
      console.error('[Passport Bridge] gbi-status error:', err.message);
      json(req, res, 500, { success: false, error: 'Internal error' });
    }
    return true;
  }

  // Unknown /auth/* path
  json(req, res, 404, { success: false, error: 'Not found' });
  return true;
}

module.exports = { handleAuthBridge, verifyToken, createToken, sendSolarPassportEmail };
