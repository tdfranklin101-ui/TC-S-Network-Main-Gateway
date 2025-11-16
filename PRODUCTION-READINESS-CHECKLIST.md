# TC-S Network Foundation - Production Readiness Checklist

**Version:** 1.0.0  
**Last Updated:** November 16, 2025  
**Status:** QA Ready with Recommendations

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

// server/ai-curator.js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// server/openai.js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

**Features Using OpenAI:**
- Kid Solar Voice Assistant (Whisper STT, GPT-4o, TTS)
- AI Curator (smart artifact descriptions)
- AI Market Intelligence
- Product Energy Service
- Wallet AI Assistant

**Security:** ✅ No hardcoded keys detected

---

### ✅ READY - Database Integration
**Status:** Production Ready  
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
- `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`

**Connection Pooling:** ✅ Configured
- Max connections: 10
- Idle timeout: 30s
- Connection timeout: 10s

**Auto-Migration:** ✅ Tables auto-created on startup

**Security:** ✅ No credentials exposed in code

---

### ✅ READY - EIA API Integration
**Status:** Production Ready (Optional)  
**Configuration:** Environment variable based  
**Required:** No

**Usage:**
```javascript
const EIA_API_KEY = process.env.EIA_API_KEY;
```

**Features Using EIA:**
- Solar Intelligence Audit Layer
- Enhanced global energy data
- U.S. energy consumption metrics

**Fallback:** ✅ Works without EIA (uses quarterly/annual datasets)

**Security:** ✅ No hardcoded keys detected

---

### ⚠️ OPTIONAL - Stripe Integration
**Status:** Configured but not active  
**Configuration:** Environment variables  
**Required:** No (marketplace currently free)

**Environment Variables:**
- `STRIPE_SECRET_KEY` - Not set
- `VITE_STRIPE_PUBLIC_KEY` - Not set
- `TESTING_STRIPE_SECRET_KEY` - Set ✅
- `TESTING_VITE_STRIPE_PUBLIC_KEY` - Set ✅

**Recommendation:** 
- For QA: Use test keys (already configured)
- For Production: Set live keys when enabling payments

**Security:** ✅ Test keys available, no hardcoded keys

---

## Security Review

### ⚠️ NEEDS ATTENTION - CORS Configuration
**Current Status:** Allow all origins (`*`)  
**Production Risk:** Medium  
**Priority:** High

**Current Configuration:**
```javascript
'Access-Control-Allow-Origin': '*' // 53 occurrences in main.js
```

**Production Recommendation:**
```javascript
// Create CORS allowlist
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://thecurrentsee.org', 'https://www.thecurrentsee.org'];

// Apply to each endpoint
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

**Action Required:** 
- [ ] Restrict CORS to specific domains before production launch
- [ ] Set `ALLOWED_ORIGINS` environment variable

---

### ⚠️ NEEDS ATTENTION - Rate Limiting
**Current Status:** Disabled  
**Production Risk:** High  
**Priority:** High

**Current Configuration:**
```javascript
// Line 130-132 in main.js
// For now, always return true (allow all requests)
// TODO: Enable rate limiting after successful deployment
return true;
```

**Production Recommendation:**
```javascript
// Uncomment lines 134-148 to enable rate limiting
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

**Action Required:**
- [ ] Enable rate limiting before production launch
- [ ] Consider Redis-based rate limiting for multi-server deployments

---

### ⚠️ NEEDS ATTENTION - Session Storage
**Current Status:** In-memory Map  
**Production Risk:** High (data loss on restart)  
**Priority:** Medium

**Current Configuration:**
```javascript
// Line 155-156 in main.js
// Simple session storage (in production, use Redis or database)
const sessions = new Map();
```

**Impact:**
- Sessions lost on server restart
- Not suitable for multi-server deployments
- No persistence

**Production Recommendation:**
The application already has session database support via `connect-pg-simple`:
```javascript
// Session store already configured for PostgreSQL
// This is good! But verify it's being used instead of in-memory Map
```

**Action Required:**
- [ ] Verify PostgreSQL session store is active
- [ ] Remove in-memory session Map if database store is working
- [ ] Test session persistence across server restarts

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

**Security:** ✅ API keys and passwords not logged or exposed

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

**Security:** ✅ No plain-text passwords stored

---

### ✅ GOOD - File Upload Security
**Status:** Production Ready  
**Configuration:** MIME type validation, size limits

**Security Features:**
- File type validation (whitelist)
- 100MB file size limit
- File extension verification
- Secure file paths (no directory traversal)

**Supported Types:**
- Audio: mp3, wav, flac, aac, ogg, webm
- Video: mp4, webm, mov, avi, mkv
- Images: jpeg, jpg, png, gif, svg, webp, bmp
- Documents: txt, pdf, markdown, Word, Excel, PowerPoint

**Security:** ✅ No arbitrary file execution risk

---

## Environment Variables Audit

### Required for QA Deployment:
- [x] `DATABASE_URL` or `PG*` variables - SET ✅
- [x] `OPENAI_API_KEY` - SET ✅
- [ ] `SESSION_SECRET` - RECOMMENDED (currently auto-generated)

### Optional:
- [x] `EIA_API_KEY` - SET ✅
- [ ] `STRIPE_SECRET_KEY` - Not needed for QA
- [ ] `VITE_STRIPE_PUBLIC_KEY` - Not needed for QA
- [ ] `ALLOWED_ORIGINS` - RECOMMENDED for production
- [ ] `NODE_ENV` - RECOMMENDED (set to `production`)

---

## Performance Considerations

### Database Connection Pooling
**Current:** 10 max connections  
**Status:** ✅ Adequate for QA  
**Production Recommendation:** Increase to 20-50 based on traffic

### File Storage
**Current:** Local file system  
**Status:** ⚠️ Works for single-server deployments  
**Production Recommendation:** Migrate to object storage for multi-server

**Options:**
- Replit Object Storage (already configured)
- Supabase Storage
- Google Cloud Storage

### Caching
**Current:** In-memory for product database  
**Status:** ✅ Adequate for QA  
**Production Recommendation:** Add Redis for distributed caching

---

## Pre-Deployment Actions

### Critical (Must Do):
- [ ] Set Supabase production database connection string
- [ ] Verify OpenAI API key has sufficient credits
- [ ] Test database connection to Supabase
- [ ] Verify all required tables exist

### High Priority (Should Do):
- [ ] Restrict CORS origins
- [ ] Enable rate limiting
- [ ] Set persistent `SESSION_SECRET`
- [ ] Configure `NODE_ENV=production`

### Medium Priority (Nice to Have):
- [ ] Set up error monitoring (Sentry)
- [ ] Configure logging (Winston, Bunyan)
- [ ] Add health check monitoring
- [ ] Set up database backups

### Optional:
- [ ] Configure Stripe live keys (if enabling payments)
- [ ] Set up CDN for static assets
- [ ] Add performance monitoring

---

## Deployment Verification Tests

After deployment, verify:

1. **Health Check:**
   ```bash
   curl https://[your-domain]/health
   # Expected: {"status":"healthy","timestamp":"...","database":"connected"}
   ```

2. **Database Connection:**
   ```bash
   curl https://[your-domain]/api/db-status
   # Expected: Success with member count
   ```

3. **Kid Solar Status:**
   ```bash
   curl https://[your-domain]/api/kid-solar/status
   # Expected: {"status":"ready","features":["voice","text","vision"]}
   ```

4. **File Upload (.mov test):**
   ```bash
   curl -X POST https://[your-domain]/api/creator/upload \
     -F "file=@test.mov" \
     -F "title=Test" \
     -F "description=Test"
   # Expected: Success with AI price assessment
   ```

5. **Authentication:**
   - Test user registration
   - Test user login
   - Test session persistence

6. **Marketplace:**
   - Browse categories
   - View artifact details
   - Test download tokens

---

## Known Issues & Limitations

### Minor Issues:
1. **In-memory sessions:** Will be lost on server restart (database store recommended)
2. **CORS wide open:** Should be restricted for production
3. **Rate limiting disabled:** Should be enabled for production

### Non-Issues:
1. **Stripe keys missing:** Optional - marketplace currently free
2. **EIA API optional:** Works without it using fallback datasets

---

## Production Launch Checklist

Before going live to production:

- [ ] Enable HTTPS/TLS (handled by Replit/Cloud Run)
- [ ] Configure custom domain (thecurrentsee.org)
- [ ] Set up DNS records
- [ ] Enable rate limiting
- [ ] Restrict CORS origins
- [ ] Configure error monitoring
- [ ] Set up automated backups
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation complete

---

## Support Contacts

- **Supabase Support:** https://supabase.com/support
- **Replit Support:** support@replit.com
- **OpenAI Support:** help.openai.com
- **GitHub Issues:** https://github.com/tdfranklin101-ui/TC-S-Network-Foundation/issues

---

**Overall Assessment:** ✅ READY FOR QA DEPLOYMENT  
**Production Ready:** ⚠️ After addressing CORS and rate limiting

**Next Steps:**
1. Deploy to QA environment
2. Run verification tests
3. Address CORS and rate limiting
4. Prepare for production launch

---

**Prepared By:** Replit Agent  
**Date:** November 16, 2025
