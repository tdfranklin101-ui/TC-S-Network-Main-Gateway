# TC-S Network Foundation - QA Deployment Guide

**Version:** 2.0.0  
**Target Environment:** QA with Production Database  
**Database:** Supabase PostgreSQL (ep-polished-truth-a6ui)  
**Last Updated:** November 16, 2025

---

## 🚨 CRITICAL PRE-DEPLOYMENT STEPS

### Before Deployment - MANDATORY ACTIONS

#### 1. Database Migration (REQUIRED)
The application uses Drizzle ORM with 24+ database tables defined in `shared/schema.ts`. These tables **must** be created in Supabase before deployment.

**Run Database Migrations:**
```bash
# Push schema to production database
npm run db:push --force

# Verify tables were created
npm run db:studio
```

**Expected Tables:**
- `members` - User accounts
- `wallets` - Solar token balances
- `transactions` - Token transfers  
- `artifacts` - Marketplace items
- `download_tokens` - File access control
- `kid_solar_sessions` - AI assistant sessions
- `songs`, `play_events` - Music tracking
- `audit_*` tables - Energy audit system
- And 15+ more tables

**⚠️ WARNING:** The server will start WITHOUT these tables, but core features (login, wallet, marketplace) will FAIL.

#### 2. Session Security (REQUIRED)
**Current State:** Sessions use in-memory Map storage (line 155-156 in main.js)  
**Problem:** All user sessions lost on server restart  
**Required Action:** Must be addressed before QA

**Fix Options:**

**Option A - Enable Database Sessions (Recommended):**
The application has connect-pg-simple installed but NOT actively used. Activate it:

```javascript
// In main.js, replace lines 155-156:
// OLD:
const sessions = new Map();

// NEW:
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const sessionStore = new pgSession({
  pool: pool,
  tableName: 'session'
});
```

Then ensure session table exists:
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

**Option B - Document as Known Limitation:**
If database sessions cannot be implemented before QA, clearly document:
- Users will be logged out on server restart
- Not suitable for production
- Plan to migrate to database sessions before launch

#### 3. CORS Restriction (REQUIRED for Production)
**Current State:** All origins allowed (`Access-Control-Allow-Origin: *`)  
**Risk:** Moderate security risk  
**Required Action:** Restrict before production launch

**Implementation:**
```javascript
// Add to main.js (after line 105)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://thecurrentsee.org', 'https://www.thecurrentsee.org', 'https://qa.thecurrentsee.org'];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
}
```

**Environment Variable:**
```bash
ALLOWED_ORIGINS=https://thecurrentsee.org,https://qa.thecurrentsee.org
```

**For QA:** Can deploy with `*` but must restrict before production.

#### 4. Rate Limiting (REQUIRED for Production)
**Current State:** Disabled (line 130-132 in main.js)  
**Risk:** High - vulnerable to abuse  
**Required Action:** Enable before production launch

**To Enable:**
Uncomment lines 134-148 in main.js:
```javascript
// Remove "return true;" at line 132
// Uncomment the rate limiting block
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

**For QA:** Can deploy disabled for testing, but MUST enable before production.

---

## Environment Variables - Required Setup

### CRITICAL (Must Set):
```bash
# Database - Choose ONE option:

# Option 1: Connection String (Recommended)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Option 2: Individual Variables
PGHOST=aws-0-us-east-1.pooler.supabase.com
PGPORT=6543
PGDATABASE=postgres
PGUSER=postgres.[project-ref]
PGPASSWORD=[your-supabase-password]
PGSSLMODE=require

# OpenAI (Required for Kid Solar)
OPENAI_API_KEY=sk-proj-[your-key]

# Session Security (Recommended)
SESSION_SECRET=[generate-with: openssl rand -base64 32]
```

### OPTIONAL:
```bash
# Server Config
PORT=8080
NODE_ENV=production

# CORS (Production only)
ALLOWED_ORIGINS=https://thecurrentsee.org,https://qa.thecurrentsee.org

# EIA API (Enhanced energy data)
EIA_API_KEY=[your-eia-key]

# Stripe (if enabling payments)
STRIPE_SECRET_KEY=sk_live_[your-key]
VITE_STRIPE_PUBLIC_KEY=pk_live_[your-key]
```

---

## Deployment Steps

### Step 1: Database Setup

1. **Connect to Supabase:**
   ```bash
   psql "postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
   ```

2. **Run Migrations:**
   ```bash
   npm run db:push --force
   ```

3. **Verify Tables:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
   Expected count: 24+ tables

4. **Create Session Table (if using database sessions):**
   ```sql
   CREATE TABLE IF NOT EXISTS "session" (
     "sid" varchar NOT NULL COLLATE "default",
     "sess" json NOT NULL,
     "expire" timestamp(6) NOT NULL,
     PRIMARY KEY ("sid")
   );
   CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
   ```

### Step 2: Configure Environment

**For Replit Deployment:**
1. Go to Secrets tab (padlock icon)
2. Add all required environment variables
3. Never commit secrets to Git

**Verify Secrets:**
```bash
# Check secrets are loaded (don't print values!)
node -e "console.log('DB:', process.env.DATABASE_URL ? 'SET' : 'MISSING')"
node -e "console.log('OpenAI:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING')"
```

### Step 3: Code Changes (if applying security fixes)

**If enabling database sessions:**
1. Edit main.js lines 155-156
2. Add session middleware configuration
3. Test locally first

**If restricting CORS:**
1. Add ALLOWED_ORIGINS environment variable
2. Modify CORS headers in main.js
3. Test with production domains

**If enabling rate limiting:**
1. Uncomment lines 134-148 in main.js
2. Adjust RATE_LIMIT if needed
3. Test with realistic traffic

### Step 4: Deploy

**Replit Deployment:**
1. Click "Deploy" button
2. Select deployment target
3. Monitor deployment logs
4. Wait for "✅ Database connection ready" message

**Cloud Run Deployment:**
```bash
gcloud run deploy tcs-network \
  --image gcr.io/[PROJECT-ID]/tcs-network \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=[SUPABASE_URL],OPENAI_API_KEY=[KEY],NODE_ENV=production
```

### Step 5: Verify Deployment

Run all verification tests:

```bash
# 1. Health Check
curl https://[your-domain]/health
# Expected: {"status":"healthy","database":"connected"}

# 2. Database Tables
curl https://[your-domain]/api/members/count
# Expected: Member count (number)

# 3. Kid Solar Status
curl https://[your-domain]/api/kid-solar/status
# Expected: {"status":"ready"}

# 4. File Upload (.mov test)
curl -X POST https://[your-domain]/api/creator/upload \
  -F "file=@test.mov" \
  -F "title=Test" \
  -F "description=Test"
# Expected: Success with price assessment

# 5. User Registration
# Test via browser: Create account, verify in database

# 6. Session Persistence
# Login, restart server, check if still logged in
# EXPECTED: If using in-memory sessions = logged out
# EXPECTED: If using database sessions = still logged in
```

---

## Post-Deployment Verification Checklist

### Core Functionality:
- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] All 24+ tables exist in database
- [ ] `/health` endpoint returns 200 OK
- [ ] Homepage loads

### Authentication:
- [ ] User registration works
- [ ] User login works  
- [ ] Sessions persist (or document if they don't)
- [ ] Password hashing works

### Marketplace:
- [ ] Browse categories
- [ ] Upload files (test .mov, .mp4, .jpg)
- [ ] View artifact details
- [ ] Download tokens work

### Kid Solar:
- [ ] Voice assistant responds
- [ ] Text commands work
- [ ] Image analysis works

### Wallet:
- [ ] View balance
- [ ] Solar tokens display
- [ ] Transaction history

### Analytics:
- [ ] Page view tracking
- [ ] Solar audit data displays

---

## Known Issues & Current State

### ⚠️ Current Limitations:

1. **Sessions Not Persistent**
   - Status: In-memory storage active
   - Impact: Users logged out on server restart
   - Fix Required: Before production launch
   - Workaround: Document for QA testers

2. **CORS Wide Open**
   - Status: Allows all origins
   - Impact: Moderate security risk
   - Fix Required: Before production launch
   - Workaround: OK for internal QA

3. **Rate Limiting Disabled**
   - Status: All requests allowed
   - Impact: Vulnerable to abuse
   - Fix Required: Before production launch
   - Workaround: Monitor for abuse during QA

4. **File Storage Local**
   - Status: Local filesystem
   - Impact: Not scalable to multiple servers
   - Fix Required: Before multi-server production
   - Workaround: OK for single-server QA

### ✅ Production Ready:

- OpenAI integration
- Database connection (Supabase)
- Password hashing (bcrypt)
- File upload validation
- Error handling
- API structure

---

## Troubleshooting

### "Database tables missing"
**Solution:**
```bash
npm run db:push --force
# Verify with: npm run db:studio
```

### "Sessions lost on restart"
**Expected:** Using in-memory sessions  
**Solution:** Implement database sessions OR document as known issue for QA

### "CORS error from browser"
**Expected:** If accessing from different domain  
**Solution:** Add domain to ALLOWED_ORIGINS OR keep `*` for QA

### "OpenAI API error"
**Solution:**
1. Verify OPENAI_API_KEY is set
2. Check API credits
3. Test with: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### "File upload fails for .mov"
**Fixed:** MIME type validation updated  
**Verify:** Should work now. If not, check server logs for actual error

---

## Production Launch Requirements

Before deploying to production (thecurrentsee.org):

### MANDATORY:
- [ ] Run `npm run db:push --force` to create all tables
- [ ] Enable database session storage (OR keep in-memory with documented restart policy)
- [ ] Restrict CORS to production domains
- [ ] Enable rate limiting
- [ ] Set persistent SESSION_SECRET
- [ ] Configure HTTPS/TLS
- [ ] Set up error monitoring

### RECOMMENDED:
- [ ] Load testing
- [ ] Security audit
- [ ] Database backups configured
- [ ] Migrate to object storage
- [ ] Add Redis caching
- [ ] Performance optimization
- [ ] Documentation complete

---

## Support & Resources

- **Database Schema:** `shared/schema.ts` (24+ tables)
- **Deployment Registry:** `TC-S-DEPLOYMENT-REGISTRY.md`
- **Production Checklist:** `PRODUCTION-READINESS-CHECKLIST.md`
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ep-polished-truth-a6ui
- **GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Foundation

---

**Status:** ✅ Ready for QA with Known Limitations  
**Production Ready:** ⚠️ After completing mandatory security fixes  

**Critical Path:**
1. Run database migrations → 2. Deploy to QA → 3. Test & verify → 4. Apply security fixes → 5. Production launch
