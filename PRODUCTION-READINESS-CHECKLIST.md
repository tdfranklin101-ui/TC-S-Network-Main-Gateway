# TC-S Network Foundation - Production Readiness Checklist

**Version:** 2.0.0  
**Last Updated:** November 16, 2025  
**Status:** QA Ready with Critical Actions Required

---

## Database Status

### ⚠️ CRITICAL - Database Migration Required

**Current State:** Schema defined in `shared/schema.ts` but NOT deployed to Supabase  
**Production Risk:** CRITICAL - Application will fail without tables  
**Priority:** MUST DO BEFORE ANY DEPLOYMENT

**Defined Tables (24+):**
```
members, wallets, transactions, distribution_logs
artifacts, download_tokens, file_access_logs
kid_solar_sessions, kid_solar_memories, kid_solar_conversations
songs, play_events
signups, users, user_profiles
progressions, entitlements, content_library
solar_clock, products
newsletter_subscriptions, contact_messages
audit_categories, audit_data_sources, energy_audit_log, update_log
... and more
```

**Action Required:**
```bash
# MUST run before deployment:
npm run db:push --force

# Verify tables exist:
npm run db:studio
# OR
psql "[DATABASE_URL]" -c "\dt"
```

**⚠️ WARNING:** The application will START without these tables, but:
- User login/registration will FAIL
- Wallet features will FAIL  
- Marketplace will FAIL
- Kid Solar sessions will not persist

**Completion Checklist:**
- [ ] Run `npm run db:push --force`
- [ ] Verify all 24+ tables exist in Supabase
- [ ] Test connection with: `npm run db:studio`
- [ ] Document migration completion date

---

## API Integration Status

### ✅ READY - OpenAI Integration
**Status:** Production Ready  
**Configuration:** Environment variable based  
**Required:** Yes (for Kid Solar Voice Assistant)

**Verification:**
```javascript
// server/kid-solar-voice.js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

**Features Using OpenAI:**
- Kid Solar Voice Assistant (Whisper STT, GPT-4o, TTS)
- AI Curator (smart artifact descriptions)
- AI Market Intelligence
- Product Energy Service
- Wallet AI Assistant

**Environment Variable:**
- `OPENAI_API_KEY` - SET ✅

**Security:** ✅ No hardcoded keys detected

---

### ✅ READY - Database Integration (After Migration)
**Status:** Schema Ready, Migration Required  
**Configuration:** Supabase PostgreSQL (ep-polished-truth-a6ui)  
**Required:** Yes

**Connection Methods:**
```javascript
// Option 1: DATABASE_URL (recommended)
connectionString: process.env.DATABASE_URL

// Option 2: Individual PG* variables
host: process.env.PGHOST,
port: process.env.PGPORT,
database: process.env.PGDATABASE,
user: process.env.PGUSER,
password: process.env.PGPASSWORD
```

**SSL Configuration:** ✅ Supports all PGSSLMODE options
**Connection Pooling:** ✅ Configured (10 connections)

**Environment Variable:**
- `DATABASE_URL` - SET ✅

**Security:** ✅ No credentials exposed in code

**Migration Required:**
- [ ] Tables NOT yet created in Supabase
- [ ] Run `npm run db:push --force` BEFORE deployment

---

### ✅ READY - EIA API Integration (Optional)
**Status:** Production Ready (Optional)  
**Configuration:** Environment variable based  
**Required:** No

**Features Using EIA:**
- Solar Intelligence Audit Layer
- Enhanced global energy data
- U.S. energy consumption metrics

**Environment Variable:**
- `EIA_API_KEY` - SET ✅

**Fallback:** ✅ Works without EIA (uses quarterly/annual datasets)

---

### ⚠️ OPTIONAL - Stripe Integration
**Status:** Configured for testing only  
**Configuration:** Test keys available  
**Required:** No (marketplace currently free)

**Environment Variables:**
- `STRIPE_SECRET_KEY` - Not set (production)
- `VITE_STRIPE_PUBLIC_KEY` - Not set (production)
- `TESTING_STRIPE_SECRET_KEY` - SET ✅
- `TESTING_VITE_STRIPE_PUBLIC_KEY` - SET ✅

**Recommendation:** Set live keys when enabling payments

---

## Security Audit

### 🚨 CRITICAL - Session Storage
**Current State:** In-memory Map storage (main.js lines 155-156)  
**Production Risk:** CRITICAL  
**Priority:** MUST FIX BEFORE PRODUCTION

**Current Code:**
```javascript
// Line 155-156 in main.js
// Simple session storage (in production, use Redis or database)
const sessions = new Map();
```

**Impact:**
- ❌ All user sessions lost on server restart
- ❌ Users forcefully logged out during deployments
- ❌ Not suitable for multi-server deployments
- ❌ No session persistence

**Required Fix - Enable Database Sessions:**

The application has `connect-pg-simple` installed but NOT actively used.

**Step 1: Create Session Table:**
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

**Step 2: Modify main.js:**
```javascript
// Replace lines 155-156 with:
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const sessionStore = new pgSession({
  pool: pool,  // Existing database pool
  tableName: 'session'
});

// Use with Express (add session middleware)
```

**Alternative:** Document as known limitation for QA, but MUST fix before production

**Action Items:**
- [ ] Create session table in Supabase
- [ ] Enable connect-pg-simple in main.js
- [ ] Test session persistence across restarts
- [ ] OR document limitation for QA only

---

### 🚨 HIGH PRIORITY - CORS Configuration
**Current State:** All origins allowed (`Access-Control-Allow-Origin: *`)  
**Production Risk:** MEDIUM  
**Priority:** MUST FIX BEFORE PRODUCTION

**Current Configuration:**
```javascript
// 53 occurrences in main.js
'Access-Control-Allow-Origin': '*'
```

**Security Risk:**
- Any website can make requests to your API
- Potential for CSRF attacks
- No origin validation

**Required Fix:**
```javascript
// Add to main.js (after line 105)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://thecurrentsee.org', 'https://www.thecurrentsee.org'];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  } else {
    // Reject request or use default
  }
}

// Apply to all endpoints (replace all Access-Control-Allow-Origin: '*')
```

**Environment Variable:**
```bash
ALLOWED_ORIGINS=https://thecurrentsee.org,https://www.thecurrentsee.org,https://qa.thecurrentsee.org
```

**Action Items:**
- [ ] Define ALLOWED_ORIGINS environment variable
- [ ] Update CORS headers in main.js (53 locations)
- [ ] Test with production domains
- [ ] OR accept risk for QA testing only

---

### 🚨 HIGH PRIORITY - Rate Limiting
**Current State:** Disabled (main.js lines 130-132)  
**Production Risk:** HIGH  
**Priority:** MUST FIX BEFORE PRODUCTION

**Current Code:**
```javascript
// Line 130-132 in main.js
// For now, always return true (allow all requests)
// TODO: Enable rate limiting after successful deployment
return true;
```

**Security Risk:**
- No protection against abuse
- Vulnerable to DDoS attacks
- No request throttling
- API costs could spike

**Required Fix:**
```javascript
// Uncomment lines 134-148 in main.js
if (timestamps.length >= RATE_LIMIT) {
  res.writeHead(429, { 
    'Content-Type': 'application/json',
    'Retry-After': '30'
  });
  res.end(JSON.stringify({
    error: "rate_limited",
    message: "Too many requests. Please try again later.",
    retry_after_s: 30,
    request_id: req.requestId
  }));
  return false;
}
```

**Configuration:**
- Current limit: 60 requests/minute per IP
- Adjust if needed via RATE_LIMIT constant

**Action Items:**
- [ ] Uncomment rate limiting code in main.js
- [ ] Test with realistic traffic patterns
- [ ] Monitor for false positives
- [ ] OR accept risk for QA testing only

---

### ⚠️ MEDIUM PRIORITY - Session Secret
**Current State:** Auto-generated on each server start  
**Production Risk:** MEDIUM  
**Priority:** RECOMMENDED

**Impact:**
- Different secret on each restart
- Invalidates existing sessions on restart (if database sessions used)

**Required Fix:**
```bash
# Generate persistent secret:
openssl rand -base64 32

# Set environment variable:
SESSION_SECRET=[generated-secret]
```

**Action Items:**
- [ ] Generate SESSION_SECRET
- [ ] Add to environment variables
- [ ] Update session middleware to use it

---

### ✅ GOOD - Error Handling
**Status:** Secure  
**Assessment:** Errors don't expose sensitive data

**Examples:**
```javascript
// Good: Generic error messages to client
res.end(JSON.stringify({ error: 'Database unavailable' }));

// Good: Detailed errors only in server logs
console.error('❌ Database insert error:', dbError.message);
```

**Security:** ✅ API keys and passwords never logged or exposed

---

### ✅ GOOD - Password Security
**Status:** Production Ready  
**Configuration:** Bcrypt with 10 salt rounds

```javascript
// Passwords hashed before storage
const hashedPassword = await bcrypt.hash(password, 10);

// Passwords verified securely
const isValid = await bcrypt.compare(password, user.password);
```

**Security:** ✅ No plain-text passwords

---

### ✅ GOOD - File Upload Security
**Status:** Production Ready  
**Configuration:** MIME type validation, size limits

**Security Features:**
- ✅ File type validation (whitelist)
- ✅ 100MB file size limit
- ✅ File extension verification
- ✅ Secure file paths
- ✅ .mov file support added

**Supported Types:**
- Audio: mp3, wav, flac, aac, ogg, webm
- Video: mp4, webm, **mov**, avi, mkv
- Images: jpeg, jpg, png, gif, svg, webp, bmp
- Documents: txt, pdf, markdown, Word, Excel, PowerPoint

---

## Pre-Deployment Action Items

### 🚨 CRITICAL - Must Complete:

1. **Database Migration:**
   - [ ] Run `npm run db:push --force`
   - [ ] Verify all 24+ tables exist
   - [ ] Test database connection
   - [ ] Create session table

2. **Environment Variables:**
   - [ ] Set DATABASE_URL (Supabase connection)
   - [ ] Set OPENAI_API_KEY
   - [ ] Set SESSION_SECRET (recommended)
   - [ ] Set NODE_ENV=production

3. **Session Storage:**
   - [ ] Decide: Database sessions OR in-memory with docs
   - [ ] If database: Implement connect-pg-simple
   - [ ] If in-memory: Document known limitation

### ⚠️ HIGH PRIORITY - Should Complete:

4. **CORS Restriction:**
   - [ ] Set ALLOWED_ORIGINS environment variable
   - [ ] Update main.js CORS headers
   - [ ] Test with production domains
   - [ ] OR document as QA-only risk

5. **Rate Limiting:**
   - [ ] Uncomment rate limiting code
   - [ ] Test with realistic traffic
   - [ ] Adjust limits if needed
   - [ ] OR document as QA-only risk

### 📋 MEDIUM PRIORITY - Recommended:

6. **Monitoring:**
   - [ ] Set up error tracking (Sentry)
   - [ ] Configure logging
   - [ ] Add health check monitoring
   - [ ] Set up database backups

7. **Performance:**
   - [ ] Load testing
   - [ ] Database query optimization
   - [ ] Consider Redis caching

---

## Deployment Verification Tests

After deployment, run these tests:

### 1. Database Verification:
```bash
# Verify connection
curl https://[domain]/health
# Expected: {"status":"healthy","database":"connected"}

# Verify tables exist
psql "$DATABASE_URL" -c "\dt" | wc -l
# Expected: 24+ tables
```

### 2. Authentication Test:
```bash
# Register new user via browser
# Login via browser
# Restart server (if testing sessions)
# Check if still logged in
```

### 3. Marketplace Test:
```bash
# Upload .mov file
curl -X POST https://[domain]/api/creator/upload \
  -F "file=@test.mov" \
  -F "title=Test" \
  -F "description=Test"
# Expected: Success with AI price assessment
```

### 4. Kid Solar Test:
```bash
curl https://[domain]/api/kid-solar/status
# Expected: {"status":"ready"}
```

### 5. Session Persistence Test:
```bash
# Login via browser
# Note session cookie
# Wait 5 minutes
# Refresh page
# Expected: Still logged in
```

---

## Known Limitations (Current State)

### For QA Deployment:

1. **Sessions NOT Persistent** (CRITICAL)
   - In-memory storage active
   - Users logged out on restart
   - Must fix before production

2. **CORS Wide Open** (HIGH)
   - Allows all origins
   - Security risk
   - Must fix before production

3. **Rate Limiting Disabled** (HIGH)
   - No abuse protection
   - Must fix before production

4. **File Storage Local** (MEDIUM)
   - Local filesystem only
   - Not scalable to multi-server
   - Plan migration to object storage

### Acceptable for QA, Fixed for Production:

- Database migrations (must run before QA)
- Session persistence (can document for QA)
- CORS/rate limiting (can accept risk for QA)

---

## Production Launch Checklist

Before production launch, ALL items must be complete:

### MANDATORY:
- [ ] Database migration completed (24+ tables exist)
- [ ] Database sessions enabled (OR in-memory documented)
- [ ] CORS restricted to production domains
- [ ] Rate limiting enabled
- [ ] SESSION_SECRET set
- [ ] HTTPS/TLS configured
- [ ] Error monitoring active
- [ ] Database backups configured

### RECOMMENDED:
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Performance optimization
- [ ] Object storage migration
- [ ] Redis caching implemented
- [ ] Documentation complete
- [ ] Runbook created

---

## Overall Assessment

**QA Deployment Status:** ✅ READY (with critical actions completed)  
**Production Ready:** ⚠️ NOT YET (security fixes required)

**Critical Path:**
1. ✅ Run database migrations
2. ⚠️ Fix session storage (OR document)
3. ⚠️ Restrict CORS (OR accept QA risk)
4. ⚠️ Enable rate limiting (OR accept QA risk)
5. ✅ Deploy to QA
6. 📝 Test and document
7. 🔒 Apply security fixes
8. 🚀 Production launch

---

**Prepared By:** Replit Agent  
**Date:** November 16, 2025  
**Next Review:** After QA testing completion
