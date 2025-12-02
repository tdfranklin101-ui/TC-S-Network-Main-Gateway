#!/bin/bash

echo "🔧 Fixing Solar Dashboard specifically"
echo "======================================"
echo ""

GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-fix-solar"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Setup git auth
gh auth setup-git

# Clone Solar Dashboard
gh repo clone "$GITHUB_USER/TC-S-Network-Solar-Dashboard" solar-dashboard
cd solar-dashboard

echo "📋 Current structure:"
ls -la

echo ""
echo "🗑️ Removing conflicting src/ subfolders..."
rm -rf src/api
rm -rf src/components
rm -rf src/app  # just in case

echo ""
echo "📋 Cleaned structure:"
ls -la src/

git add .
git commit -m "fix: Remove conflicting src/ subfolders for clean Next.js App Router build"
git push origin main

echo ""
echo "✅ Solar Dashboard fixed!"
echo "⏳ Vercel will rebuild in 1-2 minutes"
