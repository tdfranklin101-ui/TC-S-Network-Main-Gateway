-- ============================================================
-- SOLAR AUDIT MIGRATION - DATABASE SCHEMA
-- ============================================================
-- Source: Current-See Platform (TC-S Network Foundation)
-- Destination: Solar Reserve Tracker
-- Migration Date: November 1, 2025
-- Tables: 8 core tables for Solar Intelligence Audit Layer
-- ============================================================

-- Enable UUID extension for solar_audit_entries
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: audit_categories
-- Stores energy consumption categories (8 core categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE audit_categories IS 'Energy consumption categories for global audit tracking';
COMMENT ON COLUMN audit_categories.name IS 'Category name: housing, manufacturing, transport, food, digital-services, ai-ml, money, government';

-- ============================================================
-- TABLE 2: audit_data_sources
-- Tracks data sources with verification levels
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_data_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  url TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE audit_data_sources IS 'Data source registry for energy audit trail';
COMMENT ON COLUMN audit_data_sources.url IS 'API endpoint or data source URI';

-- ============================================================
-- TABLE 3: energy_audit_log
-- Core audit ledger with SHA-256 hashing for immutability
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_audit_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  category_id INTEGER REFERENCES audit_categories(id),
  data_source_id INTEGER REFERENCES audit_data_sources(id),
  energy_kwh DECIMAL(20, 2) NOT NULL,
  energy_solar DECIMAL(20, 8) NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, category_id, data_source_id)
);

COMMENT ON TABLE energy_audit_log IS 'Immutable audit log with SHA-256 hashing (1 Solar = 4913 kWh)';
COMMENT ON COLUMN energy_audit_log.energy_kwh IS 'Energy consumption in kilowatt-hours';
COMMENT ON COLUMN energy_audit_log.energy_solar IS 'Converted Solar units (kwh / 4913)';
COMMENT ON COLUMN energy_audit_log.data_hash IS 'SHA-256 hash of raw entry for immutability verification';

-- ============================================================
-- TABLE 4: audit_regions
-- Regional taxonomy with hierarchical structure
-- Level 1: 6 Global Regions
-- Level 2: 4 US Census Sub-Regions
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_regions (
  code VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  parent_region VARCHAR(50),
  population BIGINT,
  color VARCHAR(50),
  metadata JSONB
);

COMMENT ON TABLE audit_regions IS 'Hierarchical regional taxonomy (10 regions: 6 global + 4 US sub-regions)';
COMMENT ON COLUMN audit_regions.level IS '1 = global primary region, 2 = sub-region (US Census)';
COMMENT ON COLUMN audit_regions.parent_region IS 'Parent region code for hierarchical structure';
COMMENT ON COLUMN audit_regions.metadata IS 'JSON with countries[], states[], description, etc.';

-- ============================================================
-- TABLE 5: audit_region_totals
-- Links energy audit log to regional breakdowns
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_region_totals (
  id SERIAL PRIMARY KEY,
  audit_log_id INTEGER NOT NULL REFERENCES energy_audit_log(id),
  region_code VARCHAR(50) NOT NULL REFERENCES audit_regions(code),
  energy_kwh DOUBLE PRECISION NOT NULL,
  energy_solar DOUBLE PRECISION NOT NULL,
  data_freshness VARCHAR(20) DEFAULT 'LIVE_DAILY',
  metadata JSONB
);

COMMENT ON TABLE audit_region_totals IS 'Regional energy breakdown (48 data points: 8 categories × 6 regions)';
COMMENT ON COLUMN audit_region_totals.data_freshness IS 'LIVE_DAILY, QUARTERLY_API, or ANNUAL_DATASET';
COMMENT ON COLUMN audit_region_totals.metadata IS 'Region-specific details and source information';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_region_totals_audit_log ON audit_region_totals (audit_log_id);
CREATE INDEX IF NOT EXISTS idx_region_totals_region ON audit_region_totals (region_code);

-- ============================================================
-- TABLE 6: solar_audit_categories
-- Enhanced category table with descriptions (Drizzle schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS solar_audit_categories (
  id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE solar_audit_categories IS 'Solar Audit categories with detailed descriptions';

-- ============================================================
-- TABLE 7: solar_audit_data_sources
-- Enhanced data sources with verification levels (Drizzle schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS solar_audit_data_sources (
  id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  name TEXT NOT NULL,
  organization TEXT,
  contact TEXT,
  verification_level VARCHAR(20) NOT NULL,
  source_type TEXT DEFAULT 'DIRECT',
  uri TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE solar_audit_data_sources IS 'Data source registry with verification levels';
COMMENT ON COLUMN solar_audit_data_sources.verification_level IS 'SELF, THIRD_PARTY, METERED, or MODELLED';
COMMENT ON COLUMN solar_audit_data_sources.source_type IS 'DIRECT or AGGREGATOR';

-- ============================================================
-- TABLE 8: solar_audit_entries
-- Core auditable energy ledger with UUIDs (Drizzle schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS solar_audit_entries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id INTEGER NOT NULL REFERENCES solar_audit_categories(id),
  source_id INTEGER NOT NULL REFERENCES solar_audit_data_sources(id),
  day DATE NOT NULL,
  kwh NUMERIC(18, 3) NOT NULL,
  solar_units NUMERIC(18, 6),
  rights_alignment JSONB,
  data_hash TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE solar_audit_entries IS 'Immutable energy audit ledger with UUID primary keys';
COMMENT ON COLUMN solar_audit_entries.rights_alignment IS 'JSON: {"privacy":"ENFORCED", "transparency":"PUBLIC"}';
COMMENT ON COLUMN solar_audit_entries.data_hash IS 'SHA-256 hash for immutability verification';

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS solar_audit_entries_day_idx ON solar_audit_entries (day);
CREATE INDEX IF NOT EXISTS solar_audit_entries_category_idx ON solar_audit_entries (category_id);
CREATE INDEX IF NOT EXISTS solar_audit_entries_source_idx ON solar_audit_entries (source_id);

-- ============================================================
-- SUPPORTING TABLES (for reference)
-- ============================================================

-- Update log table (tracks data refresh cycles)
CREATE TABLE IF NOT EXISTS update_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS','PARTIAL','FAIL')),
  updated JSONB,
  missing JSONB,
  error TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_update_log_started_at ON update_log (started_at DESC);

COMMENT ON TABLE update_log IS 'Tracks automated data refresh cycles at 3:00 AM UTC daily';

-- ============================================================
-- SCHEMA VERSION INFORMATION
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_version (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial Solar Audit migration schema - 8 core tables')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
