# TC-S Ω-1 Network - DEPLOYMENT EXECUTION

## Pre-Flight Checklist

### ✅ Workflow Files Ready
- [x] `.github/workflows/deploy-all.yml` - Master controller
- [x] `github-setup/satellite-deploy.yml` - Satellite template

### ⚙️ GitHub Secrets Required (Per Repo)

| Secret | Same Across Repos? | Status |
|--------|-------------------|--------|
| `VERCEL_TOKEN` | ✅ Yes | Add to all 14 |
| `VERCEL_ORG_ID` | ✅ Yes | Add to all 14 |
| `VERCEL_PROJECT_ID` | ❌ No (unique) | Add unique per repo |
| `GH_PAT` | ✅ Yes | Add to Main Gateway only |

---

## STEP 1: Add Secrets to Main Gateway

```
GitHub.com → tdfranklin101-ui/TC-S-Network-Main-Gateway
→ Settings → Secrets and variables → Actions → New repository secret
```

Add these 4 secrets:
1. `VERCEL_TOKEN` = (your token)
2. `VERCEL_ORG_ID` = (your org ID)
3. `VERCEL_PROJECT_ID` = (Main Gateway project ID)
4. `GH_PAT` = (GitHub Personal Access Token with repo scope)

---

## STEP 2: Push Main Gateway

```bash
cd TC-S-Network-Main-Gateway
git add .
git commit -m "Ω-1 Master Deployment Configuration"
git push origin main
```

This will trigger:
1. Main Gateway deployment
2. All 13 satellite deployments (via matrix)

---

## STEP 3: Add Secrets to Each Satellite

For each of the 13 satellites, add these 3 secrets:

| Repository | VERCEL_PROJECT_ID |
|------------|-------------------|
| TC-S-Network-Wallet | (unique) |
| TC-S-Network-Market-Grid | (unique) |
| TC-S-Network-SolarStack | (unique) |
| TC-S-Network-Indices | (unique) |
| TC-S-Network-Satellite-ID | (unique) |
| TC-S-Network-Seismic-ID | (unique) |
| TC-S-Network-Identify-Anything | (unique) |
| TC-S-Network-Z-Private | (unique) |
| TC-S-Network-Compute | (unique) |
| TC-S-Network-Apps | (unique) |
| TC-S-Network-Licensing | (unique) |
| TC-S-Network-Grid | (unique) |
| TC-S-Network-ReserveTracker | (unique) |

---

## STEP 4: Add Workflow to Each Satellite

For each satellite repo:

```bash
mkdir -p .github/workflows
# Copy satellite-deploy.yml as deploy.yml
git add .github/
git commit -m "Add TC-S deployment workflow"
git push origin main
```

---

## Verification Commands

After deployment, verify each domain:

```bash
# Main Gateway
curl -I https://thecurrentsee.org

# Satellites (examples)
curl -I https://wallet.thecurrentsee.org
curl -I https://market.thecurrentsee.org
curl -I https://indices.thecurrentsee.org
```

---

## Quick Reference: Get VERCEL_PROJECT_ID

For each repo:
```bash
cd [repo-name]
vercel link
cat .vercel/project.json | grep projectId
```

---

## Emergency Rollback

If deployment fails:
```bash
vercel rollback --yes
```

---

## Status: READY FOR EXECUTION ✅

All configuration files are in place. Execute Steps 1-4 above.
