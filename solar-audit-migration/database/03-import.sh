#!/bin/bash

# ============================================================
# SOLAR AUDIT MIGRATION - DATABASE IMPORT SCRIPT
# ============================================================
# Source: Current-See Platform (TC-S Network Foundation)
# Destination: Solar Reserve Tracker
# Migration Date: November 1, 2025
# ============================================================

set -e  # Exit on error

echo "=================================================="
echo "SOLAR AUDIT MIGRATION - DATABASE IMPORT"
echo "=================================================="
echo ""

# Configuration
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-solar_reserve_tracker}"
DB_USER="${PGUSER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Check if psql is available
if ! command -v psql &> /dev/null; then
  print_error "psql command not found. Please install PostgreSQL client."
  exit 1
fi

print_status "PostgreSQL client found"

# Check database connection
echo ""
echo "Testing database connection..."
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
  print_error "Cannot connect to database. Please check:"
  echo "  - Database server is running"
  echo "  - Connection parameters are correct"
  echo "  - User has access permissions"
  exit 1
fi

print_status "Database connection successful"
echo ""

# Prompt for confirmation
read -p "This will import Solar Audit schema and data into '$DB_NAME'. Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Import cancelled."
  exit 0
fi

echo ""
echo "=================================================="
echo "STEP 1: IMPORTING SCHEMA (01-schema.sql)"
echo "=================================================="
echo ""

if [ ! -f "01-schema.sql" ]; then
  print_error "Schema file '01-schema.sql' not found in current directory"
  exit 1
fi

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "01-schema.sql"

if [ $? -eq 0 ]; then
  print_status "Schema imported successfully"
else
  print_error "Schema import failed"
  exit 1
fi

echo ""
echo "=================================================="
echo "STEP 2: IMPORTING DATA (02-data.sql)"
echo "=================================================="
echo ""

if [ ! -f "02-data.sql" ]; then
  print_error "Data file '02-data.sql' not found in current directory"
  exit 1
fi

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "02-data.sql"

if [ $? -eq 0 ]; then
  print_status "Data imported successfully"
else
  print_error "Data import failed"
  exit 1
fi

echo ""
echo "=================================================="
echo "STEP 3: VERIFICATION"
echo "=================================================="
echo ""

# Verify table counts
print_status "Verifying imported data..."

# Check audit_categories (expected: 8)
CATEGORY_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM audit_categories;")
echo "  Categories: $CATEGORY_COUNT (expected: 8)"

# Check audit_regions (expected: 10)
REGION_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM audit_regions;")
echo "  Regions: $REGION_COUNT (expected: 10)"

# Check audit_data_sources
SOURCE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM audit_data_sources;")
echo "  Data Sources: $SOURCE_COUNT (expected: 8+)"

# Check energy_audit_log
AUDIT_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM energy_audit_log;")
echo "  Audit Log Entries: $AUDIT_COUNT (expected: 8+)"

# Check audit_region_totals
REGIONAL_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM audit_region_totals;")
echo "  Regional Totals: $REGIONAL_COUNT (expected: 48+)"

echo ""

# Verify schema version
SCHEMA_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1;")
print_status "Schema version: $SCHEMA_VERSION"

echo ""
echo "=================================================="
echo "MIGRATION COMPLETE"
echo "=================================================="
echo ""
print_status "Solar Audit database migration completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Deploy backend API endpoints (see backend/api-endpoints.js)"
echo "  2. Deploy frontend dashboard (see frontend/solar-audit.html)"
echo "  3. Configure environment variables (see README.md)"
echo "  4. Test API endpoints with: curl http://your-server/api/solar-audit/last"
echo "  5. Access dashboard at: http://your-server/solar-audit.html"
echo ""
echo "For detailed instructions, see: ../README.md"
echo ""
