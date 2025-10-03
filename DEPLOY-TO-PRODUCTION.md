# Deploy to Google Cloud Run

## Quick Deploy (2 Steps)

### Step 1: Download Project
Click the three dots menu (⋮) in Replit → Download as zip

### Step 2: Deploy from Local Machine
```bash
# Extract the zip file
unzip current-see.zip
cd current-see

# Deploy to Cloud Run (requires gcloud CLI installed)
gcloud run deploy current-see \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=$DATABASE_URL,DEFAULT_OBJECT_STORAGE_BUCKET_ID=$DEFAULT_OBJECT_STORAGE_BUCKET_ID" \
  --quiet
```

## What Happens During Deployment

✅ `.gcloudignore` automatically excludes:
- 400MB node_modules (rebuilt by Cloud Build with production deps only)
- 521MB attached_assets (dev files)
- 850MB non-runtime directories (admin/, analytics-standalone/, download/, etc.)
- 98MB music bundles (public/music/bundles/)
- **Final deployment size: ~450MB** (under 500MB limit)

✅ Videos hosted on Vimeo (external):
- Plant the Seed: vimeo.com/1124103517
- We Said So: vimeo.com/1124104035
- Podcast Discussion: vimeo.com/1124104721

✅ Cloud Build process:
1. Copies source code (~250MB)
2. Runs `npm ci --production` (installs ~200MB production deps)
3. Starts server with `node main.js`

## Alternative: Deploy from Cloud Shell

1. Open [Cloud Shell](https://shell.cloud.google.com)
2. Upload project: Click upload button (⋮) → Select zip
3. Run deploy command above

## Environment Variables Needed

Set these in Cloud Run (from your Replit secrets):
- `DATABASE_URL` - PostgreSQL connection string (required for member data)
- `OPENAI_API_KEY` - For AI curator and Kid Solar agent (required)
- `NODE_ENV=production` - Enables production optimizations (auto-set by deploy script)

## Verify Deployment

After deployment completes:
```bash
# Get service URL
gcloud run services describe current-see --region us-central1 --format='value(status.url)'

# Test endpoints
curl https://[YOUR-URL]/marketplace
curl -I https://[YOUR-URL]/videos/plant-the-seed.mp4
```

## Troubleshooting

**Error: Project too large**
- ✅ Fixed by .gcloudignore (excludes 913MB of assets)

**Error: Videos not playing**  
- ✅ Fixed by Object Storage + GCS SDK serving

**Error: 404 on everything**
- ✅ Fixed by reducing deployment under 500MB limit
