# Cloud Run Deployment Checklist

## ✅ Pre-Deployment Verification (Completed)

### Code & Configuration
- [x] JavaScript syntax error fixed (marketplace.html line 2982)
- [x] Sign In / Join Network buttons working in dev
- [x] .gcloudignore optimized (excludes 1.4GB, keeps ~250MB source)
- [x] Procfile created (`web: node main.js`)
- [x] package-lock.json present for reproducible builds
- [x] Videos migrated to Vimeo (external hosting)

### Package Size Optimization
- [x] Deployment size: ~450MB (under 500MB Cloud Run limit)
  - Source code: ~250MB
  - Production node_modules: ~200MB (installed by Cloud Build)
- [x] Excluded from deployment:
  - 400MB node_modules (rebuilt by Cloud Build)
  - 521MB attached_assets
  - 850MB non-runtime directories
  - 98MB music bundles

## 🚀 Deployment Steps

### Step 1: Download Project
1. In Replit: Click three dots (⋮) → Download as zip
2. Extract on your local machine: `unzip current-see.zip && cd current-see`

### Step 2: Set Environment Variables
Copy these from Replit Secrets:
```bash
# Required - export before deploying
export DATABASE_URL="your-postgres-connection-string"
export OPENAI_API_KEY="your-openai-api-key"
```

### Step 3: Deploy to Cloud Run

**Option A: Using deployment script (recommended)**
```bash
./deploy-production.sh
```
The deployment script validates environment variables before deploying.

**Option B: Manual gcloud command**
```bash
gcloud run deploy current-see \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_API_KEY"
```

### Step 4: Verify Deployment
```bash
# Get production URL
SERVICE_URL=$(gcloud run services describe current-see --region us-central1 --format='value(status.url)')
echo "Production URL: $SERVICE_URL"

# Test endpoints
curl -I $SERVICE_URL/marketplace
curl -I $SERVICE_URL/main-platform
```

## 🧪 Post-Deployment Testing

### Critical Paths to Test
1. **Marketplace Authentication**
   - [ ] Visit `/marketplace`
   - [ ] Click "Join Network" → Register test account
   - [ ] Verify Solar balance displays in header
   - [ ] Click "Sign In" → Login with test account

2. **Artifact Operations**
   - [ ] Upload test artifact (image/video/music)
   - [ ] Verify artifact appears in marketplace
   - [ ] Test purchase workflow
   - [ ] Verify Solar deduction
   - [ ] Test artifact download after purchase

3. **Video Streaming**
   - [ ] Visit `/main-platform`
   - [ ] Test Vimeo video playback
   - [ ] Verify embedded videos load correctly

4. **Database Connectivity**
   - [ ] Verify member registration persists
   - [ ] Check daily Solar distribution runs
   - [ ] Confirm transaction history works

## 📊 Monitoring

### Cloud Run Metrics to Watch
- Container startup time (should be <30s)
- Memory usage (should stay <1GB)
- Request latency (marketplace <2s)
- Error rate (should be <1%)

### Known Issues & Solutions
- **Issue**: Videos not playing
  - **Fix**: Videos are on Vimeo - check embed codes
  
- **Issue**: Authentication fails
  - **Fix**: Verify DATABASE_URL is set correctly
  
- **Issue**: Container crashes on startup
  - **Fix**: Check Cloud Run logs for missing env vars

## 🔧 Rollback Plan
If deployment fails:
```bash
# List revisions
gcloud run revisions list --service current-see --region us-central1

# Rollback to previous version
gcloud run services update-traffic current-see \
  --to-revisions REVISION-NAME=100 \
  --region us-central1
```
