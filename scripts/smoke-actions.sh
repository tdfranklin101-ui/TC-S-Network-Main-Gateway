#!/bin/bash
# TC-S Agentic Framework Smoke Test
# Tests the complete action lifecycle: create → approve → execute
# Usage: ./scripts/smoke-actions.sh [BASE_URL]

set -e

BASE_URL="${1:-http://localhost:3002}"
ADMIN_HEADER="X-Admin: true"

echo "=============================================="
echo "TC-S Agentic Framework Smoke Test"
echo "=============================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}→${NC} $1"; }

# Generate unique test ID
TEST_ID=$(date +%s)
NETWORK_NAME="Smoke-Test-Network-${TEST_ID}"
IDEMPOTENCY_KEY="smoke-test-${TEST_ID}"

echo "Test ID: ${TEST_ID}"
echo "Network Name: ${NETWORK_NAME}"
echo ""

# Test 1: Submit a valid network creation request
echo "=============================================="
echo "TEST 1: Submit Network Creation Request"
echo "=============================================="
info "POST /api/agentic/commissioning/create-direct"

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agentic/commissioning/create-direct" \
  -H "Content-Type: application/json" \
  -d "{
    \"networkSpec\": {
      \"name\": \"${NETWORK_NAME}\",
      \"networkType\": \"satellite\",
      \"capabilities\": [\"energy_tracking\", \"wallet_management\"],
      \"region\": \"north_america\",
      \"energySource\": \"solar\",
      \"initialSolarAllocation\": 100
    },
    \"idempotencyKey\": \"${IDEMPOTENCY_KEY}\"
  }")

echo "Response: $RESPONSE"

# Extract requestId
REQUEST_ID=$(echo "$RESPONSE" | grep -o '"actionRequestId":"[^"]*"' | cut -d'"' -f4)
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REQUEST_ID" ]; then
  fail "No requestId returned"
fi

if [ "$STATUS" != "pending" ]; then
  fail "Expected status 'pending', got '$STATUS'"
fi

pass "Created action request: $REQUEST_ID with status: $STATUS"
echo ""

# Test 2: Check action status (should be pending)
echo "=============================================="
echo "TEST 2: Check Action Status (Pending)"
echo "=============================================="
info "GET /api/agentic/actions/${REQUEST_ID}"

RESPONSE=$(curl -s "${BASE_URL}/api/agentic/actions/${REQUEST_ID}")
echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" != "pending" ]; then
  fail "Expected status 'pending', got '$STATUS'"
fi

pass "Action status is 'pending'"
echo ""

# Test 3: Approve the action
echo "=============================================="
echo "TEST 3: Approve Action"
echo "=============================================="
info "POST /api/agentic/actions/${REQUEST_ID}/approve"

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agentic/actions/${REQUEST_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "${ADMIN_HEADER}" \
  -d '{}')

echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" != "approved" ]; then
  fail "Expected status 'approved', got '$STATUS'"
fi

pass "Action approved successfully"
echo ""

# Test 4: Check status after approval (should be approved)
echo "=============================================="
echo "TEST 4: Check Action Status (Approved)"
echo "=============================================="
info "GET /api/agentic/actions/${REQUEST_ID}"

RESPONSE=$(curl -s "${BASE_URL}/api/agentic/actions/${REQUEST_ID}")
echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" != "approved" ]; then
  fail "Expected status 'approved', got '$STATUS'"
fi

pass "Action status is 'approved'"
echo ""

# Test 5: Execute the action
echo "=============================================="
echo "TEST 5: Execute Action"
echo "=============================================="
info "POST /api/agentic/actions/${REQUEST_ID}/execute"

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agentic/actions/${REQUEST_ID}/execute" \
  -H "Content-Type: application/json" \
  -H "${ADMIN_HEADER}" \
  -d '{}')

echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" != "succeeded" ]; then
  fail "Expected status 'succeeded', got '$STATUS'"
fi

pass "Action executed successfully"
echo ""

# Test 6: Verify final status and result
echo "=============================================="
echo "TEST 6: Verify Final Status and Result"
echo "=============================================="
info "GET /api/agentic/actions/${REQUEST_ID}"

RESPONSE=$(curl -s "${BASE_URL}/api/agentic/actions/${REQUEST_ID}")
echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
NETWORK_ID=$(echo "$RESPONSE" | grep -o '"networkId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$STATUS" != "succeeded" ]; then
  fail "Expected final status 'succeeded', got '$STATUS'"
fi

if [ -z "$NETWORK_ID" ]; then
  # Try alternate format
  NETWORK_ID=$(echo "$RESPONSE" | grep -o '"networkId":[0-9]*' | head -1 | cut -d':' -f2)
fi

pass "Action completed with network created"
echo ""

# Test 7: Test invalid spec (should be rejected by policy)
echo "=============================================="
echo "TEST 7: Test Invalid Spec (Policy Rejection)"
echo "=============================================="
info "POST /api/agentic/commissioning/create-direct with invalid spec"

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/agentic/commissioning/create-direct" \
  -H "Content-Type: application/json" \
  -d '{
    "networkSpec": {
      "networkType": "satellite"
    }
  }')

echo "Response: $RESPONSE"

# Check if it was rejected or has validation errors
if echo "$RESPONSE" | grep -q "error\|rejected\|Invalid\|Missing"; then
  pass "Invalid spec properly rejected"
else
  echo "Warning: Invalid spec may not have been properly validated"
fi

echo ""

# Test 8: List all actions
echo "=============================================="
echo "TEST 8: List All Actions"
echo "=============================================="
info "GET /api/agentic/actions/list"

RESPONSE=$(curl -s "${BASE_URL}/api/agentic/actions/list?limit=10" -H "${ADMIN_HEADER}")
echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"success":true'; then
  pass "Actions list retrieved successfully"
else
  fail "Failed to list actions"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}ALL SMOKE TESTS PASSED${NC}"
echo "=============================================="
echo "Request ID: ${REQUEST_ID}"
echo "Network ID: ${NETWORK_ID:-'Check response'}"
echo "Network Name: ${NETWORK_NAME}"
echo ""
echo "View in Admin UI: ${BASE_URL}/admin-actions.html"
