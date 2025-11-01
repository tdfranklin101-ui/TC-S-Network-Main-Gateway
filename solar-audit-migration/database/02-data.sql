-- ============================================================
-- SOLAR AUDIT MIGRATION - SAMPLE DATA
-- ============================================================
-- Source: Current-See Platform (TC-S Network Foundation)
-- Destination: Solar Reserve Tracker
-- Migration Date: November 1, 2025
-- ============================================================

-- ============================================================
-- SEED DATA: audit_categories (8 core categories)
-- ============================================================
INSERT INTO audit_categories (id, name, description) VALUES
(1, 'housing', 'Residential electricity consumption - EIA Residential + Eurostat + IEA/UN'),
(2, 'manufacturing', 'Industrial electricity consumption - EIA Industrial + global datasets'),
(3, 'transport', 'Electric transportation - DOE/AFDC + EV charging + rail'),
(4, 'food', 'Agriculture and food production - IEA/USDA agricultural energy'),
(5, 'digital-services', 'Data centers and IT infrastructure - LBNL + global aggregation'),
(6, 'money', 'Cryptocurrency mining - Mempool.space + Cambridge CBECI'),
(7, 'ai-ml', 'AI/ML compute infrastructure - IEA AI Tracker + Goldman Sachs estimates'),
(8, 'government', 'Government and military facilities - DOD + FEMP + IEA Public Services')
ON CONFLICT (name) DO NOTHING;

-- Reset sequence
SELECT setval('audit_categories_id_seq', (SELECT MAX(id) FROM audit_categories));

-- ============================================================
-- SEED DATA: audit_data_sources (primary data sources)
-- ============================================================
INSERT INTO audit_data_sources (id, name, url, description) VALUES
(1, 'EIA API', 'https://api.eia.gov', 'U.S. Energy Information Administration - Official energy statistics'),
(2, 'Eurostat API', 'https://ec.europa.eu/eurostat/api', 'European Union statistical office - Quarterly energy data'),
(3, 'IEA/UN Datasets', 'https://www.iea.org/data-and-statistics', 'International Energy Agency 2023 World Energy Statistics'),
(4, 'Mempool.space API', 'https://mempool.space/api', 'Bitcoin network hashrate and energy consumption'),
(5, 'DOE/AFDC', 'https://afdc.energy.gov/data', 'Alternative Fuels Data Center - EV infrastructure'),
(6, 'DOD Energy Reports', 'https://www.acq.osd.mil/eie/OE/OE_index.html', 'Department of Defense Operational Energy'),
(7, 'LBNL Data Centers', 'https://eta.lbl.gov/publications', 'Lawrence Berkeley National Laboratory - Data center research'),
(8, 'Cambridge CBECI', 'https://ccaf.io/cbeci', 'Cambridge Bitcoin Electricity Consumption Index')
ON CONFLICT (name) DO NOTHING;

-- Reset sequence
SELECT setval('audit_data_sources_id_seq', (SELECT MAX(id) FROM audit_data_sources));

-- ============================================================
-- SEED DATA: audit_regions (10 regions: 6 global + 4 US)
-- ============================================================
INSERT INTO audit_regions (code, name, level, parent_region, population, color, metadata) VALUES
-- Level 1: Global Primary Regions
('GLOBAL_ASIA', 'Asia (Global Primary)', 1, NULL, 4700000000, '#FF6B6B', '{"countries": ["China", "India", "Japan", "South Korea", "Indonesia", "Thailand", "Vietnam"], "description": "Asia-Pacific region"}'),
('GLOBAL_NORTH_AMERICA', 'North America (Global Primary)', 1, NULL, 600000000, '#4ECDC4', '{"countries": ["United States", "Canada", "Mexico"], "description": "North American continent"}'),
('GLOBAL_EUROPE', 'Europe (Global Primary)', 1, NULL, 750000000, '#45B7D1', '{"countries": ["EU-27", "UK", "Norway", "Switzerland"], "description": "European region including EU and partners"}'),
('GLOBAL_AFRICA', 'Africa (Global Primary)', 1, NULL, 1400000000, '#F7DC6F', '{"countries": ["South Africa", "Nigeria", "Egypt", "Kenya", "Morocco"], "description": "African continent"}'),
('GLOBAL_LATIN_AMERICA', 'Latin America (Global Primary)', 1, NULL, 650000000, '#BB8FCE', '{"countries": ["Brazil", "Mexico", "Argentina", "Chile", "Colombia"], "description": "Latin America and Caribbean"}'),
('GLOBAL_OCEANIA', 'Oceania (Global Primary)', 1, NULL, 45000000, '#85C1E9', '{"countries": ["Australia", "New Zealand", "Papua New Guinea"], "description": "Oceania region"}'),

-- Level 2: US Census Sub-Regions (children of North America)
('US_NORTHEAST', 'United States - Northeast', 2, 'GLOBAL_NORTH_AMERICA', 57000000, '#3498DB', '{"states": ["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"], "description": "US Northeast Census Region"}'),
('US_MIDWEST', 'United States - Midwest', 2, 'GLOBAL_NORTH_AMERICA', 68000000, '#2ECC71', '{"states": ["IL", "IN", "MI", "OH", "WI", "IA", "KS", "MN", "MO", "NE", "ND", "SD"], "description": "US Midwest Census Region"}'),
('US_SOUTH', 'United States - South', 2, 'GLOBAL_NORTH_AMERICA', 125000000, '#E74C3C', '{"states": ["DE", "FL", "GA", "MD", "NC", "SC", "VA", "WV", "AL", "KY", "MS", "TN", "AR", "LA", "OK", "TX"], "description": "US South Census Region"}'),
('US_WEST', 'United States - West', 2, 'GLOBAL_NORTH_AMERICA', 78000000, '#F39C12', '{"states": ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "AK", "CA", "HI", "OR", "WA"], "description": "US West Census Region"}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SAMPLE DATA: energy_audit_log (8 records - one per category)
-- ============================================================
-- Example records for 2025-11-01 (replace with actual data)
INSERT INTO energy_audit_log (date, category_id, data_source_id, energy_kwh, energy_solar, data_hash, metadata) VALUES
('2025-11-01', 1, 1, 12500000000.00, 2544000.00, 'a1b2c3d4e5f6...', '{"source": "EIA Residential", "year": 2024, "month": 10}'),
('2025-11-01', 2, 1, 18700000000.00, 3806000.00, 'b2c3d4e5f6a1...', '{"source": "EIA Industrial", "year": 2024, "month": 10}'),
('2025-11-01', 3, 5, 840000000.00, 171000.00, 'c3d4e5f6a1b2...', '{"source": "DOE/AFDC", "ev_charging": true}'),
('2025-11-01', 4, 3, 2100000000.00, 427000.00, 'd4e5f6a1b2c3...', '{"source": "IEA/UN Agriculture", "vintage": "2023"}'),
('2025-11-01', 5, 7, 950000000.00, 193000.00, 'e5f6a1b2c3d4...', '{"source": "LBNL Data Centers", "estimate": true}'),
('2025-11-01', 6, 4, 420000000.00, 85500.00, 'f6a1b2c3d4e5...', '{"source": "Mempool.space", "bitcoin_hashrate": "450 EH/s"}'),
('2025-11-01', 7, 3, 690000000.00, 140500.00, 'a1b2c3d4e5f6...', '{"source": "IEA AI Tracker", "ai_ml_compute": true}'),
('2025-11-01', 8, 6, 980000000.00, 199500.00, 'b2c3d4e5f6a1...', '{"source": "DOD Energy Reports", "federal_civilian": 146625000, "military": 234300000}')
ON CONFLICT (date, category_id, data_source_id) DO UPDATE SET
  energy_kwh = EXCLUDED.energy_kwh,
  energy_solar = EXCLUDED.energy_solar,
  data_hash = EXCLUDED.data_hash,
  metadata = EXCLUDED.metadata;

-- ============================================================
-- SAMPLE DATA: audit_region_totals (60 records minimum)
-- 8 categories × 6 global regions = 48 primary data points
-- + 12 US sub-regional records for select categories
-- ============================================================
-- Example: Housing category across all 6 global regions
-- (Replace with actual regional breakdown data)
INSERT INTO audit_region_totals (audit_log_id, region_code, energy_kwh, energy_solar, data_freshness, metadata) VALUES
-- Housing (category_id=1) - Global Regional Breakdown
(1, 'GLOBAL_ASIA', 10547945205.00, 2146720.00, 'ANNUAL_DATASET', '{"source": "IEA 2023", "annual_twh": 3850}'),
(1, 'GLOBAL_NORTH_AMERICA', 1234567890.00, 251340.00, 'LIVE_DAILY', '{"source": "EIA Real-time", "states": 50}'),
(1, 'GLOBAL_EUROPE', 987654321.00, 201050.00, 'QUARTERLY_API', '{"source": "Eurostat Q3 2024"}'),
(1, 'GLOBAL_AFRICA', 397260274.00, 80860.00, 'ANNUAL_DATASET', '{"source": "IEA 2023", "annual_twh": 145}'),
(1, 'GLOBAL_LATIN_AMERICA', 1150684932.00, 234200.00, 'ANNUAL_DATASET', '{"source": "IEA 2023", "annual_twh": 420}'),
(1, 'GLOBAL_OCEANIA', 232876712.00, 47410.00, 'ANNUAL_DATASET', '{"source": "IEA 2023", "annual_twh": 85}')
-- Add remaining 54 records for other categories × regions
ON CONFLICT DO NOTHING;

-- Note: Full dataset would include 48+ records covering all category × region combinations

-- ============================================================
-- SEED DATA: solar_audit_categories (enhanced schema)
-- ============================================================
INSERT INTO solar_audit_categories (name, description) VALUES
('housing', 'Residential electricity consumption tracked via EIA Residential, Eurostat EU-27, and IEA/UN global datasets'),
('manufacturing', 'Industrial electricity consumption from EIA Industrial sector and global manufacturing data'),
('transport', 'Electric transportation including EV charging infrastructure and electric rail systems'),
('food', 'Agricultural energy consumption from IEA/USDA agricultural sector tracking'),
('digital-services', 'Data center and IT infrastructure energy from LBNL research and global aggregation'),
('money', 'Cryptocurrency mining energy tracked via Mempool.space Bitcoin hashrate and Cambridge CBECI'),
('ai-ml', 'Artificial intelligence and machine learning compute energy from IEA AI Tracker'),
('government', 'Government and military energy from DOD Operational Energy and Federal Energy Management Program')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED DATA: solar_audit_data_sources (enhanced schema)
-- ============================================================
INSERT INTO solar_audit_data_sources (name, organization, verification_level, source_type, uri) VALUES
('EIA Residential Retail Sales', 'U.S. Energy Information Administration', 'THIRD_PARTY', 'DIRECT', 'https://api.eia.gov/v2/electricity/retail-sales'),
('Eurostat EU-27 Energy Statistics', 'European Commission Eurostat', 'THIRD_PARTY', 'DIRECT', 'https://ec.europa.eu/eurostat/api'),
('IEA World Energy Balances 2024', 'International Energy Agency', 'THIRD_PARTY', 'AGGREGATOR', 'https://www.iea.org/data-and-statistics'),
('Mempool.space Bitcoin API', 'Mempool.space', 'THIRD_PARTY', 'DIRECT', 'https://mempool.space/api/v1/mining/hashrate'),
('DOE Alternative Fuels Data Center', 'U.S. Department of Energy', 'THIRD_PARTY', 'DIRECT', 'https://afdc.energy.gov/data'),
('DOD Operational Energy Report', 'U.S. Department of Defense', 'THIRD_PARTY', 'AGGREGATOR', 'https://www.acq.osd.mil/eie/OE'),
('LBNL Data Center Research', 'Lawrence Berkeley National Laboratory', 'MODELLED', 'AGGREGATOR', 'https://eta.lbl.gov'),
('Cambridge Bitcoin Electricity Index', 'Cambridge Centre for Alternative Finance', 'THIRD_PARTY', 'AGGREGATOR', 'https://ccaf.io/cbeci')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SAMPLE DATA: solar_audit_entries (example records)
-- ============================================================
-- Example: 3 sample entries showing different verification levels
-- (Replace with actual audit entries from production)
INSERT INTO solar_audit_entries (category_id, source_id, day, kwh, solar_units, rights_alignment, data_hash, notes) VALUES
(1, 1, '2025-11-01', 12500000000.000, 2544000.000000, '{"privacy":"PUBLIC", "transparency":"ENFORCED"}', 'sha256:a1b2c3d4...', 'Housing - US EIA residential retail sales Oct 2024'),
(6, 4, '2025-11-01', 420000000.000, 85500.000000, '{"privacy":"PUBLIC", "transparency":"ENFORCED"}', 'sha256:f6a1b2c3...', 'Money - Bitcoin hashrate 450 EH/s from Mempool.space'),
(7, 7, '2025-11-01', 690000000.000, 140500.000000, '{"privacy":"PUBLIC", "transparency":"MODELLED"}', 'sha256:a1b2c3d4...', 'AI/ML - Modelled estimates from IEA AI Tracker + Goldman Sachs')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SAMPLE DATA: update_log (tracking automated updates)
-- ============================================================
INSERT INTO update_log (started_at, finished_at, status, updated, missing, meta) VALUES
('2025-11-01 03:00:00+00', '2025-11-01 03:05:23+00', 'SUCCESS', 
  '{"categories": 8, "regions": 48, "entries": 48}'::jsonb,
  '[]'::jsonb,
  '{"scheduled": true, "trigger": "cron_3am_utc"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DATA INTEGRITY CHECKS
-- ============================================================

-- Verify category count
SELECT COUNT(*) as category_count FROM audit_categories; -- Expected: 8

-- Verify regional coverage
SELECT COUNT(*) as region_count FROM audit_regions; -- Expected: 10 (6 global + 4 US)

-- Verify data source registry
SELECT COUNT(*) as source_count FROM audit_data_sources; -- Expected: 8+

-- Verify audit log entries
SELECT COUNT(*) as audit_entries FROM energy_audit_log; -- Expected: 8+ (one per category minimum)

-- Verify regional totals (48 minimum = 8 categories × 6 regions)
SELECT COUNT(*) as regional_totals FROM audit_region_totals; -- Expected: 48+

-- ============================================================
-- END OF DATA SEED
-- ============================================================
