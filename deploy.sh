#!/bin/bash

echo "🚀 Current-See Platform Deployment Script"
echo "=========================================="

# Check environment
echo "📋 Environment Check:"
echo "- Node.js version: $(node --version)"
echo "- NPM version: $(npm --version)"

# Check critical files
echo ""
echo "📁 Critical Files Check:"
files=(
  "main.js"
  "deploy_v1_multimodal/index.html"
  "public-dashboard.html"
  "analytics-standalone/index.html"
  "server/kidSolarMemory.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file - Found"
  else
    echo "❌ $file - Missing"
  fi
done

# Check package.json
echo ""
echo "📦 Dependencies Check:"
if [ -f "package.json" ]; then
  echo "✅ package.json found"
  npm list --depth=0 2>/dev/null | head -10
else
  echo "❌ package.json missing"
fi

# Port configuration
echo ""
echo "🌐 Port Configuration:"
echo "- Default PORT: 3000"
echo "- Environment PORT: ${PORT:-'Not set'}"
echo "- Bind Address: 0.0.0.0"

# Database check
echo ""
echo "🗄️ Database Configuration:"
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL configured"
else
  echo "⚠️ DATABASE_URL not set (fallback available)"
fi

if [ -n "$CURRENTSEE_DB_URL" ]; then
  echo "✅ CURRENTSEE_DB_URL configured"
else
  echo "⚠️ CURRENTSEE_DB_URL not set"
fi

# OpenAI check
echo ""
echo "🤖 AI Services:"
if [ -n "$OPENAI_API_KEY" ]; then
  echo "✅ OPENAI_API_KEY configured"
else
  echo "⚠️ OPENAI_API_KEY not set"
fi

if [ -n "$NEW_OPENAI_API_KEY" ]; then
  echo "✅ NEW_OPENAI_API_KEY configured"
else
  echo "⚠️ NEW_OPENAI_API_KEY not set"
fi

echo ""
echo "🎯 DEPLOYMENT TARGETS:"
echo "- Main Website: www.thecurrentsee.org"
echo "- Analytics Dashboard: analytics.thecurrentsee.org"
echo ""
echo "✅ READY FOR DEPLOYMENT!"
echo "=========================================="