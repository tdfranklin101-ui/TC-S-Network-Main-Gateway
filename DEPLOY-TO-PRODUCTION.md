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
- 395MB of videos (public/videos/*.mp4) 
- 518MB of dev assets (attached_assets/)
- Deployment size: ~400MB (under 500MB limit)

✅ Videos served from Object Storage in production:
- plant-the-seed.mp4
- we-said-so-monazite.mp4  
- podcast-discussion.mp4

✅ Google Cloud Storage SDK auto-authenticates in Cloud Run

## Alternative: Deploy from Cloud Shell

1. Open [Cloud Shell](https://shell.cloud.google.com)
2. Upload project: Click upload button (⋮) → Select zip
3. Run deploy command above

## Environment Variables Needed

These are already in your Replit secrets - copy them to Cloud Run:
- `DATABASE_URL` (PostgreSQL connection)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (for videos)
- `OPENAI_API_KEY` (for AI features)

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
