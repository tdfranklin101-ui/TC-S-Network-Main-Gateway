# TC-S Network Foundation - QA Deployment Guide

**Version:** 1.0.0  
**Target Environment:** QA with Production Database  
**Database:** Supabase PostgreSQL (ep-polished-truth-a6ui)  
**Last Updated:** November 16, 2025

---

## Pre-Deployment Checklist

### ✅ Required Environment Variables

#### Database Configuration (CRITICAL)
- [ ] `DATABASE_URL` - Supabase connection string for ep-polished-truth-a6ui
  - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  - OR use individual PG* variables:
- [ ] `PGHOST` - Supabase host (e.g., `aws-0-us-east-1.pooler.supabase.com`)
- [ ] `PGPORT` - Supabase port (default: `6543` for pooler, `5432` for direct)
- [ ] `PGDATABASE` - Database name (usually `postgres`)
- [ ] `PGUSER` - Supabase user (usually `postgres.[project-ref]`)
- [ ] `PGPASSWORD` - Supabase password
- [ ] `PGSSLMODE` - SSL mode (recommended: `require`)

#### OpenAI Integration (REQUIRED)
- [ ] `OPENAI_API_KEY` - For Kid Solar voice assistant (Whisper, GPT-4o, TTS)

#### Stripe Integration (OPTIONAL - if payments enabled)
- [ ] `STRIPE_SECRET_KEY` - Production Stripe key
- [ ] `VITE_STRIPE_PUBLIC_KEY` - Frontend Stripe publishable key

#### EIA API (OPTIONAL - for enhanced energy data)
- [ ] `EIA_API_KEY` - U.S. Energy Information Administration API key

#### Server Configuration
- [ ] `PORT` - Server port (default: 8080, Replit uses 5000)
- [ ] `NODE_ENV` - Set to `production` for QA/Production

---

## Database Setup

### 1. Verify Supabase Connection

```bash
# Test connection using psql
psql "postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

### 2. Initialize Database Tables

The application auto-creates tables on startup. Required tables:

**Core Tables:**
- `members` - User accounts and authentication
- `wallets` - Solar token balances
- `transactions` - Solar transfer history
- `daily_distributions` - Token distribution tracking

**Marketplace Tables:**
- `artifacts` - Digital marketplace items
- `download_tokens` - Secure download management
- `file_access_logs` - File access audit trail
- `identify_submissions` - Identify Anything AI submissions

**Analytics Tables:**
- `page_views` - Geographic analytics
- `solar_audit_entries` - Energy audit logs
- `audit_categories` - Audit category definitions
- `audit_data_sources` - Data source verification

**UIM Tables:**
- `uim_handshakes` - AI-to-AI communication logs
- `uim_nodes` - UIM network node registry

**Session Management:**
- `session` - Express session storage (connect-pg-simple)

### 3. Schema Validation

Run the schema initialization check:
```bash
node -e "require('./main.js')"
# Look for: "✅ Database tables initialized"
```

---

## File Upload Configuration

### Current Setup: Local File System
- **Upload Directory:** `./uploads/`
- **Max File Size:** 100MB
- **Three-Copy System:** Master, Preview, Trade copies

### Supported File Types:
- **Audio:** mp3, wav, flac, aac, ogg, webm
- **Video:** mp4, webm, mov, avi, mkv
- **Images:** jpeg, jpg, png, gif, svg, webp, bmp
- **Documents:** txt, pdf, markdown, Word, Excel, PowerPoint

### Future: Object Storage Migration
For production scale, migrate to:
- Replit Object Storage (`@replit/object-storage`)
- OR Supabase Storage
- OR Google Cloud Storage

---

## Security Configuration

### 1. CORS Settings
Current: Allows all origins (`*`)  
**QA Recommendation:** Restrict to specific domains:
```javascript
const allowedOrigins = [
  'https://thecurrentsee.org',
  'https://qa.thecurrentsee.org',
  'https://www.thecurrentsee.org'
];
```

### 2. Rate Limiting
- Current: 60 requests/minute per IP
- Adjust in `main.js` if needed

### 3. Session Security
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Session secret: Auto-generated on startup
- **QA Recommendation:** Use persistent `SESSION_SECRET` environment variable

### 4. Password Hashing
- Uses bcrypt with 10 salt rounds
- Passwords never stored in plain text

---

## API Integration Verification

### OpenAI (REQUIRED for Kid Solar)
- **Voice Input:** Whisper API (speech-to-text)
- **AI Chat:** GPT-4o (text generation, vision analysis)
- **Voice Output:** TTS API (Nova voice model)
- **Image Generation:** DALL-E 3

**Test Command:**
```bash
curl -X POST http://localhost:8080/api/kid-solar/voice \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello Kid Solar"}'
```

### Stripe (OPTIONAL)
- Payment processing for marketplace
- Currently configured but not actively used
- Test/Production keys managed via environment variables

---

## Deployment Steps

### Option 1: Replit Deployment (Recommended)

1. **Set Environment Variables** in Replit Secrets:
   - Add all required variables from checklist above
   - NEVER commit secrets to Git

2. **Configure Deployment Settings:**
   - Go to Replit Deployment tab
   - Set deployment target: "Replit Deployment"
   - Build command: `npm install` (auto-detected)
   - Run command: `node main.js`

3. **Deploy:**
   - Click "Deploy" button
   - Monitor deployment logs
   - Verify startup messages

4. **Post-Deployment Verification:**
   - Check database connection: Look for "✅ Database connection ready"
   - Test health endpoint: `GET /health`
   - Verify Kid Solar: `GET /api/kid-solar/status`

### Option 2: Cloud Run Deployment

1. **Build Docker Container:**
```bash
# Dockerfile already optimized for Cloud Run
docker build -t tcs-network-foundation .
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy tcs-network \
  --image gcr.io/[PROJECT-ID]/tcs-network-foundation \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=[SUPABASE_URL],OPENAI_API_KEY=[KEY]
```

3. **Configure Custom Domain:**
```bash
gcloud run domain-mappings create \
  --service tcs-network \
  --domain thecurrentsee.org
```

### Option 3: Custom Server

1. **Clone Repository:**
```bash
git clone https://github.com/tdfranklin101-ui/TC-S-Network-Foundation.git
cd TC-S-Network-Foundation
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Configure Environment:**
```bash
cp .env.example .env
# Edit .env with production values
```

4. **Start Server:**
```bash
NODE_ENV=production node main.js
```

5. **Set Up Process Manager (PM2):**
```bash
npm install -g pm2
pm2 start main.js --name "tcs-network"
pm2 save
pm2 startup
```

---

## Health Checks & Monitoring

### Health Endpoint
```
GET /health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-16T21:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

### Database Connection Check
```
GET /api/db-status
```

### Kid Solar Status
```
GET /api/kid-solar/status
```

### Analytics Dashboard
```
GET /analytics
```

---

## File Upload Testing

### Test Video Upload (.mov file fix verification)
```bash
curl -X POST http://localhost:8080/api/creator/upload \
  -F "file=@test-video.mov" \
  -F "title=Test Upload" \
  -F "description=Testing .mov upload" \
  -F "tags=test,video"
```

**Expected:** No "pattern did not match" error, successful upload with AI price assessment

---

## Common Issues & Troubleshooting

### Issue: "Database unavailable"
**Solution:**
1. Verify `DATABASE_URL` or `PG*` variables are set correctly
2. Check Supabase connection pooler is accessible
3. Verify SSL mode: Try `sslmode=require` or `rejectUnauthorized: false`

### Issue: "OpenAI API error"
**Solution:**
1. Verify `OPENAI_API_KEY` is set
2. Check API key has sufficient credits
3. Verify API rate limits

### Issue: "File upload failed"
**Solution:**
1. Check `uploads/` directory exists and is writable
2. Verify file size < 100MB
3. Check MIME type is in allowed list (see File Upload Configuration)

### Issue: "Session store disconnect"
**Solution:**
1. Verify `session` table exists in database
2. Check database connection is stable
3. Restart server to reinitialize session store

---

## Post-Deployment Verification Checklist

- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] `/health` endpoint returns 200 OK
- [ ] Homepage loads correctly
- [ ] Marketplace accessible
- [ ] Kid Solar voice assistant responds
- [ ] File upload works (test .mov, .mp4, .jpg)
- [ ] User registration works
- [ ] User login works
- [ ] Solar wallet displays correctly
- [ ] Analytics tracking working

---

## Rollback Plan

### If Deployment Fails:

1. **Revert to Previous Version:**
   - Replit: Use deployment history to rollback
   - Cloud Run: Deploy previous revision
   - Custom: Checkout previous Git commit

2. **Database Issues:**
   - Database changes are backwards compatible
   - No manual migrations required
   - Safe to rollback application code

3. **Emergency Contact:**
   - GitHub Issues: https://github.com/tdfranklin101-ui/TC-S-Network-Foundation/issues
   - Replit Support: support@replit.com

---

## Performance Optimization

### Database Connection Pooling
Current settings (in `main.js`):
- Max connections: 10
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

For high traffic, increase:
```javascript
max: 20,
idleTimeoutMillis: 60000,
connectionTimeoutMillis: 20000
```

### Caching
- Currently: In-memory caching for sessions
- Recommended: Add Redis for production scale

### File Storage
- Currently: Local file system
- Recommended: Migrate to object storage for multi-server deployments

---

## Next Steps After QA Deployment

1. **Load Testing:** Test with realistic user traffic
2. **Security Audit:** Penetration testing and vulnerability scan
3. **Backup Strategy:** Automated database backups
4. **Monitoring:** Set up error tracking (Sentry, LogRocket)
5. **CDN:** Configure CloudFlare for static assets
6. **SSL/TLS:** Verify HTTPS certificate
7. **Domain Configuration:** Point thecurrentsee.org to deployment

---

## Support & Documentation

- **Main Documentation:** `/replit.md`
- **Deployment Registry:** `/TC-S-DEPLOYMENT-REGISTRY.md`
- **GitHub Repository:** https://github.com/tdfranklin101-ui/TC-S-Network-Foundation
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ep-polished-truth-a6ui

---

**Status:** Ready for QA Deployment ✅  
**Date Prepared:** November 16, 2025  
**Prepared By:** Replit Agent
