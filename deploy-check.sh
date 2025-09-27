#!/bin/bash
# The Current-See Deployment Checker
# This script checks that all necessary files are in place for deployment

echo "=== The Current-See Deployment Checker ==="
echo "Checking deployment files..."

# Array of required files
required_files=(
  "unified-deploy.js"
  "server.js"
  "health-check.js"
  "deploy-ready.js"
  "public/index.html"
  "public/declaration.html"
  "public/founder_note.html"
  "public/wallet-ai-features.html"
  "public/whitepapers.html"
  "public/my-solar.html"
  "public/solar-generator.html"
)

# Check for each required file
missing_files=0
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file is missing!"
    missing_files=$((missing_files + 1))
  fi
done

# Check public directory
if [ -d "public" ]; then
  echo "✓ public directory exists"
  
  # Count files in public directory
  file_count=$(find public -type f | wc -l)
  echo "  Found $file_count files in public directory"
else
  echo "✗ public directory is missing!"
  missing_files=$((missing_files + 1))
fi

# Check for sun ray watermark CSS in each HTML file
watermark_files=(
  "public/index.html"
  "public/declaration.html"
  "public/founder_note.html"
  "public/wallet-ai-features.html"
  "public/whitepapers.html"
  "public/my-solar.html"
  "public/solar-generator.html"
)

echo ""
echo "Checking for sun ray watermarks..."
for file in "${watermark_files[@]}"; do
  if [ -f "$file" ]; then
    if grep -q "sun-ray\|watermark\|rotate" "$file"; then
      echo "✓ $file has watermark styles"
    else
      echo "✗ $file may be missing watermark styles!"
    fi
  fi
done

echo ""
if [ $missing_files -eq 0 ]; then
  echo "✅ All required files found. Ready for deployment!"
  exit 0
else
  echo "❌ $missing_files required files are missing. Please fix before deployment."
  exit 1
fi