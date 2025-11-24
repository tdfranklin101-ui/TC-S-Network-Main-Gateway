#!/bin/bash

# TC-S Network - Push All Repos Script
# Commits and pushes the TC-S Agent Layer to all 8 GitHub repositories

echo "🚀 TC-S Network - Pushing Agent Layer to All Repos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Base directory - adjust if your repos are elsewhere
BASE_DIR="$HOME/tcs"

# All TC-S Network repositories
REPOS=(
  "TC-S-Network-Satellite-ID-Anywhere"
  "TC-S-Network-Seismic-ID-Anywhere"
  "TC-S-Network-Solar-Dashboard"
  "TC-S-Network-Solar-Reserve"
  "TC-S-Network-Standards"
  "TC-S-Network-UIM-Protocol"
  "TC-S-Network-Wallet"
  "TC-S-Network-Z-Private"
)

# Commit message
COMMIT_MSG="🤖 Add TC-S Agent Layer - Solar-metered agentic network integration"

# Counters
SUCCESS=0
FAILED=0

for repo in "${REPOS[@]}"; do
  REPO_PATH="$BASE_DIR/$repo"
  
  echo "📦 Processing: $repo"
  
  if [ -d "$REPO_PATH" ]; then
    cd "$REPO_PATH"
    
    # Check if there are changes to commit
    if [ -n "$(git status --porcelain)" ]; then
      # Add all changes
      git add .
      
      # Commit
      git commit -m "$COMMIT_MSG"
      
      # Push to origin main (or master)
      if git push origin main 2>/dev/null || git push origin master 2>/dev/null; then
        echo "   ✅ Pushed successfully!"
        ((SUCCESS++))
      else
        echo "   ❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "   ⏭️  No changes to commit"
      ((SUCCESS++))
    fi
  else
    echo "   ⚠️  Directory not found: $REPO_PATH"
    ((FAILED++))
  fi
  
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 Complete! Success: $SUCCESS | Failed: $FAILED"
echo ""
echo "📡 Vercel will now auto-deploy all updated repos!"
echo "   Check your Vercel dashboard: https://vercel.com/dashboard"
