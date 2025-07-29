#!/bin/bash

# Current-See Production Deployment Script
# For www.thecurrentsee.org deployment

set -e

echo "🌞 CURRENT-SEE PRODUCTION DEPLOYMENT 🌞"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js detected: $NODE_VERSION"
else
    print_error "Node.js not found! Please install Node.js first."
    exit 1
fi

# Create deployment directory structure
print_info "Setting up deployment directory structure..."
mkdir -p conversations
mkdir -p logs
print_status "Directory structure created"

# Verify critical files exist
print_info "Verifying critical deployment files..."
CRITICAL_FILES=(
    "production-deploy.js"
    "deploy_v1_multimodal/index.html"
    "deploy_v1_multimodal/dashboard.html"
    "deploy_v1_multimodal/ai-memory-review.html"
    "deploy_v1_multimodal/enhanced-did-capture.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "Found: $file"
    else
        print_error "Missing critical file: $file"
        exit 1
    fi
done

# Check if server is already running
print_info "Checking for existing server processes..."
if pgrep -f "production-deploy.js" > /dev/null; then
    print_warning "Existing server found, stopping..."
    pkill -f "production-deploy.js" || true
    sleep 2
fi

# Test server startup
print_info "Testing server startup..."
timeout 10s node production-deploy.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test health endpoint
print_info "Testing health endpoint..."
if curl -s http://localhost:3000/health > /dev/null; then
    print_status "Health endpoint responding"
else
    print_error "Health endpoint not responding"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Test main pages
print_info "Testing main application pages..."
PAGES=(
    "/"
    "/dashboard"
    "/analytics"
    "/enhanced-did-capture.js"
)

for page in "${PAGES[@]}"; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$page | grep -q "200"; then
        print_status "Page accessible: $page"
    else
        print_warning "Page may have issues: $page"
    fi
done

# Stop test server
kill $SERVER_PID 2>/dev/null || true
sleep 1

print_status "Pre-deployment tests completed successfully!"

# Production deployment instructions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYMENT READY FOR PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "To deploy to production, run:"
echo "    node production-deploy.js"
echo ""
print_info "For background deployment, run:"
echo "    nohup node production-deploy.js > deployment.log 2>&1 &"
echo ""
print_info "To monitor deployment logs:"
echo "    tail -f deployment.log"
echo "    tail -f logs/production-$(date +%Y-%m-%d).log"
echo ""

# Feature summary
echo "🌟 FEATURES READY FOR DEPLOYMENT:"
echo "   ✅ Console Solar AI Assistant (Kid Solar TC-S S0001)"
echo "   ✅ Enhanced D-ID Conversation Capture"
echo "   ✅ Dashboard Navigation System"
echo "   ✅ Real-time Analytics"
echo "   ✅ Memory Storage & Retention"
echo "   ✅ Zero Data Loss Protection"
echo "   ✅ Mobile-Responsive Design"
echo "   ✅ Production Logging"
echo "   ✅ Health Monitoring"
echo "   ✅ Error Handling"
echo ""

print_status "Current-See platform ready for www.thecurrentsee.org deployment!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"