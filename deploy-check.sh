#!/bin/bash

# The Current-See Deployment Check Script
# This script verifies that all files are ready for deployment

echo "=== THE CURRENT-SEE DEPLOYMENT CHECK ==="
echo ""

# Check for essential files
echo "Checking essential files..."
files_to_check=(
  "index.js"
  "deploy-server-fixed.js"
  "public/embedded-members.json"
  "public/members-list.html"
  "public/distribution.html"
  "public/solar-generator.html"
  "public/index.html"
)

all_files_exist=true
for file in "${files_to_check[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file is missing"
    all_files_exist=false
  fi
done

echo ""

# Check members count
echo "Checking members data..."
member_count=$(grep -c "username" public/embedded-members.json)
echo "Found $member_count members in embedded-members.json"

if [ "$member_count" -eq 16 ]; then
  echo "✓ Member count is correct (16)"
else
  echo "✗ Member count is incorrect (expected 16, found $member_count)"
fi

# Check for Terry's SOLAR amount
terry_solar=$(grep -A 4 "terry.franklin" public/embedded-members.json | grep "totalSolar" | grep -o "[0-9]*")
echo "Terry's SOLAR amount: $terry_solar"

if [ "$terry_solar" -ge 22 ]; then
  echo "✓ Terry's SOLAR amount is correct (22+)"
else
  echo "✗ Terry's SOLAR amount is incorrect (expected 22+, found $terry_solar)"
fi

echo ""
echo "Deployment check complete."

if [ "$all_files_exist" = true ] && [ "$member_count" -eq 16 ] && [ "$terry_solar" -ge 22 ]; then
  echo "✓ All checks passed! The project is ready for deployment."
  echo "  To deploy, click the Deploy button in the Replit interface."
else
  echo "✗ Some checks failed. Please fix the issues before deployment."
fi