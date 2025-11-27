#!/bin/bash
# TC-S Ω-1 Network - GitHub Workflow Setup Script
# Deploys workflow files to all 14 repositories

GITHUB_USER="tdfranklin101-ui"
REPOS=(
  "TC-S-Network-Main-Gateway"
  "TC-S-Network-Wallet"
  "TC-S-Network-Market-Grid"
  "TC-S-Network-SolarStack"
  "TC-S-Network-Indices"
  "TC-S-Network-Satellite-ID"
  "TC-S-Network-Seismic-ID"
  "TC-S-Network-Identify-Anything"
  "TC-S-Network-Z-Private"
  "TC-S-Network-Compute"
  "TC-S-Network-Apps"
  "TC-S-Network-Licensing"
  "TC-S-Network-Grid"
  "TC-S-Network-ReserveTracker"
)

echo "═══════════════════════════════════════════════════════"
echo "  TC-S Ω-1 Network - GitHub Workflow Deployment"
echo "═══════════════════════════════════════════════════════"

for REPO in "${REPOS[@]}"; do
  echo ""
  echo "▶ Setting up: $REPO"
  
  # Clone or pull
  if [ -d "$REPO" ]; then
    cd "$REPO"
    git pull origin main
  else
    git clone "https://github.com/$GITHUB_USER/$REPO.git"
    cd "$REPO"
  fi
  
  # Create workflow directory
  mkdir -p .github/workflows
  
  # Copy appropriate workflow
  if [ "$REPO" == "TC-S-Network-Main-Gateway" ]; then
    cp ../deploy-all.yml .github/workflows/deploy-all.yml
    echo "  ✓ Added master deployment workflow (deploy-all.yml)"
  else
    cp ../satellite-deploy.yml .github/workflows/deploy.yml
    echo "  ✓ Added satellite deployment workflow (deploy.yml)"
  fi
  
  # Commit and push
  git add .github/
  git commit -m "Add TC-S Ω-1 deployment workflow" 2>/dev/null || echo "  → No changes to commit"
  git push origin main 2>/dev/null || echo "  → Push skipped (may need auth)"
  
  cd ..
  echo "  ✓ Complete"
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✓ All 14 repositories configured"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next: Add secrets to each repo via GitHub UI"
echo "  → VERCEL_TOKEN"
echo "  → VERCEL_ORG_ID"  
echo "  → VERCEL_PROJECT_ID (unique per repo)"
echo ""
