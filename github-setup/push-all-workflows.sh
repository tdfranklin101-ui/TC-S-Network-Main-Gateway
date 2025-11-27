#!/bin/bash
# TC-S Ω-1 Network - Push Workflows to All Repos
# Execute this after setting up GitHub secrets

GITHUB_USER="tdfranklin101-ui"

echo "═══════════════════════════════════════════════════════════════"
echo "  TC-S Ω-1 MASTER DEPLOYMENT - Push Workflows to GitHub"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────
# MAIN GATEWAY
# ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}▶ MAIN GATEWAY${NC}"
echo "  Repository: TC-S-Network-Main-Gateway"
echo "  Workflow:   .github/workflows/deploy-all.yml"
echo ""
echo "  Commands to execute:"
echo "  ────────────────────"
cat << 'EOF'
  git add .github/workflows/deploy-all.yml
  git commit -m "Ω-1 Master Deployment - Hub Controller"
  git push origin main
EOF
echo ""

# ─────────────────────────────────────────────────────────────────
# SATELLITES
# ─────────────────────────────────────────────────────────────────
SATELLITES=(
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

echo -e "${YELLOW}▶ SATELLITE REPOS (13)${NC}"
echo ""

for i in "${!SATELLITES[@]}"; do
  REPO="${SATELLITES[$i]}"
  NUM=$((i + 1))
  echo "  [$NUM/13] $REPO"
done

echo ""
echo "  For each satellite, execute:"
echo "  ────────────────────────────"
cat << 'EOF'
  mkdir -p .github/workflows
  cp satellite-deploy.yml .github/workflows/deploy.yml
  git add .github/
  git commit -m "Ω-1 Satellite Deployment Workflow"
  git push origin main
EOF

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✓ DEPLOYMENT CONFIGURATION READY${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  EXECUTION ORDER:"
echo "  1. Add secrets to Main Gateway (4 secrets)"
echo "  2. Push Main Gateway workflow"
echo "  3. Add secrets to each satellite (3 secrets each)"
echo "  4. Push satellite workflows"
echo ""
echo "  Once Main Gateway pushes, ALL 14 repos deploy automatically."
echo ""
