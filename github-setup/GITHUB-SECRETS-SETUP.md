# TC-S Network GitHub Secrets Setup

## Required Secrets for Each Repository

Navigate to: **GitHub → Settings → Secrets and variables → Actions**

### 1. VERCEL_TOKEN
Your Vercel access token for API authentication.

**How to get it:**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Name it "TC-S GitHub Actions"
4. Copy the token (you won't see it again)

### 2. VERCEL_ORG_ID
Your Vercel organization/team ID.

**How to get it:**
1. Run `vercel link` in your project
2. Open `.vercel/project.json`
3. Copy the `orgId` value

### 3. VERCEL_PROJECT_ID
The unique project ID for this specific repository.

**How to get it:**
1. Run `vercel link` in your project
2. Open `.vercel/project.json`
3. Copy the `projectId` value

---

## Repository Checklist

| Repository | VERCEL_TOKEN | VERCEL_ORG_ID | VERCEL_PROJECT_ID |
|------------|--------------|---------------|-------------------|
| TC-S-Network-Main-Gateway | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Wallet | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Market-Grid | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-SolarStack | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Indices | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Satellite-ID | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Seismic-ID | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Identify-Anything | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Z-Private | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Compute | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Apps | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Licensing | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-Grid | ✅ Same | ✅ Same | 🔑 Unique |
| TC-S-Network-ReserveTracker | ✅ Same | ✅ Same | 🔑 Unique |

**Note:** `VERCEL_TOKEN` and `VERCEL_ORG_ID` are the same across all repos. Only `VERCEL_PROJECT_ID` is unique per project.

---

## Quick Setup Script

For each satellite repo, run:
```bash
# 1. Link to Vercel
vercel link

# 2. Get your project ID
cat .vercel/project.json

# 3. Add workflow file
mkdir -p .github/workflows
cp satellite-deploy.yml .github/workflows/deploy.yml

# 4. Push to GitHub
git add .
git commit -m "Add Vercel deployment workflow"
git push origin main
```

---

## Workflow Files Location

- **Main Gateway:** `.github/workflows/deploy-all.yml`
- **All Satellites:** `.github/workflows/deploy.yml`
