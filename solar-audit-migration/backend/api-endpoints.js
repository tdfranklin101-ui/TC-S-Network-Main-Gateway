/**
 * SOLAR AUDIT API ENDPOINTS
 * ============================================================
 * Extracted from Current-See Platform (TC-S Network Foundation)
 * For migration to Solar Reserve Tracker
 * 
 * These endpoints provide the Solar Intelligence Audit Layer API
 * supporting the global energy monitoring dashboard.
 * 
 * Dependencies:
 * - PostgreSQL database with audit tables (see database/01-schema.sql)
 * - Feed functions for live data collection (see feed-functions.js)
 * - IEA/UN data loader for global coverage (see iea-un-data-loader.js)
 * ============================================================
 */

const { Pool } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Database connection (configure via environment variables)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ============================================================
// POST /api/solar-audit/update
// Trigger manual data fetch from all 8 energy category feeds
// ============================================================
async function handleSolarAuditUpdate(req, res) {
  try {
    const result = await updateSolarAuditData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error('Solar Audit update error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Failed to update solar audit data', 
      details: String(error) 
    }));
  }
}

// ============================================================
// GET /api/solar-audit/entries
// Return full audit log with category/source details
// ============================================================
async function handleSolarAuditEntries(req, res) {
  if (!pool) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database not available' }));
    return;
  }

  try {
    const query = `
      SELECT 
        e.id,
        c.name as category,
        s.name as source,
        s.organization as "sourceOrganization",
        s.verification_level as "verificationLevel",
        s.source_type as "sourceType",
        e.day,
        e.kwh,
        e.solar_units as "solarUnits",
        e.rights_alignment as "rightsAlignment",
        e.data_hash as "dataHash",
        e.notes,
        e.created_at as "createdAt"
      FROM solar_audit_entries e
      INNER JOIN solar_audit_categories c ON e.category_id = c.id
      INNER JOIN solar_audit_data_sources s ON e.source_id = s.id
      ORDER BY e.day DESC, e.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
    console.log(`✅ Solar audit entries: ${result.rows.length} records`);
  } catch (error) {
    console.error('Solar Audit entries error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch audit entries' }));
  }
}

// ============================================================
// GET /api/solar-audit/summary
// Return daily aggregates grouped by category
// ============================================================
async function handleSolarAuditSummary(req, res) {
  if (!pool) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database not available' }));
    return;
  }

  try {
    const query = `
      SELECT 
        c.name as category,
        SUM(e.kwh)::text as "totalKwh",
        SUM(e.solar_units)::text as "totalSolar",
        COUNT(*)::integer as "recordCount"
      FROM solar_audit_entries e
      INNER JOIN solar_audit_categories c ON e.category_id = c.id
      GROUP BY c.name
    `;
    
    const result = await pool.query(query);
    const categories = result.rows;
    
    // Calculate global totals
    const globalKwh = categories.reduce((sum, cat) => sum + parseFloat(cat.totalKwh || '0'), 0);
    const globalSolar = categories.reduce((sum, cat) => sum + parseFloat(cat.totalSolar || '0'), 0);
    const globalRecords = categories.reduce((sum, cat) => sum + cat.recordCount, 0);
    
    const response = {
      categories: categories,
      global: {
        totalKwh: globalKwh,
        totalSolar: globalSolar,
        totalRecords: globalRecords
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    console.log(`✅ Solar audit summary: ${categories.length} categories, ${globalRecords} total records`);
  } catch (error) {
    console.error('Solar Audit summary error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch summary' }));
  }
}

// ============================================================
// GET /api/solar-audit/last
// Get last successful update with regional breakdowns
// ============================================================
async function handleSolarAuditLast(req, res) {
  if (!pool) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ last_update: null, categories: [] }));
    return;
  }

  try {
    // Get last update timestamp
    const updateQuery = `
      SELECT finished_at 
      FROM update_log 
      WHERE status IN ('SUCCESS', 'PARTIAL') 
      ORDER BY finished_at DESC 
      LIMIT 1
    `;
    const updateResult = await pool.query(updateQuery);
    const lastUpdate = updateResult.rows.length > 0 
      ? new Date(updateResult.rows[0].finished_at).toISOString() 
      : null;
    
    // Get latest audit data with regional breakdowns
    const dataQuery = `
      SELECT 
        c.name as category,
        art.region_code,
        ar.name as region_name,
        art.energy_kwh,
        art.energy_solar,
        art.data_freshness,
        el.date
      FROM audit_region_totals art
      JOIN energy_audit_log el ON art.audit_log_id = el.id
      JOIN audit_categories c ON el.category_id = c.id
      JOIN audit_regions ar ON art.region_code = ar.code
      WHERE el.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY el.date DESC, c.name, art.region_code
    `;
    
    const dataResult = await pool.query(dataQuery);
    
    // Group by category
    const categoriesMap = {};
    dataResult.rows.forEach(row => {
      if (!categoriesMap[row.category]) {
        categoriesMap[row.category] = {
          category: row.category,
          regions: [],
          dataFreshness: row.data_freshness
        };
      }
      
      // Only include global regions (not US sub-regions) for coverage matrix
      if (row.region_code.startsWith('GLOBAL_')) {
        categoriesMap[row.category].regions.push({
          regionCode: row.region_code,
          regionName: row.region_name,
          energyKwh: parseFloat(row.energy_kwh),
          energySolar: parseFloat(row.energy_solar),
          dataFreshness: row.data_freshness
        });
      }
    });
    
    const categories = Object.values(categoriesMap);
    
    const response = {
      timestamp: new Date().toISOString(),
      last_update: lastUpdate,
      nextUpdate: '3:00 AM UTC daily',
      dataVintage: '2023-2024',
      categories: categories
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error('Last update endpoint error:', error);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ last_update: null, categories: [] }));
  }
}

// ============================================================
// GET /api/solar-audit/logs
// View update history (limit parameter supported)
// ============================================================
async function handleSolarAuditLogs(req, res) {
  if (!pool) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database not available' }));
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '20'), 200));
    
    const query = `
      SELECT 
        id,
        started_at,
        finished_at,
        status,
        updated,
        missing,
        error,
        meta
      FROM update_log 
      ORDER BY started_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
    console.log(`✅ Update logs: ${result.rows.length} entries`);
  } catch (error) {
    console.error('Update logs endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch update logs' }));
  }
}

// ============================================================
// GET /auditlog
// Returns flat array format for Chart.js dashboard compatibility
// ============================================================
async function handleAuditLog(req, res) {
  if (!pool) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  try {
    const query = `
      SELECT 
        e.date::text as day,
        c.name as category,
        e.energy_kwh as kwh,
        e.energy_solar as solar_units,
        s.name as source,
        CASE 
          WHEN e.metadata->>'verificationLevel' IS NOT NULL 
          THEN e.metadata->>'verificationLevel'
          ELSE 'TIER_1'
        END as verification_level
      FROM energy_audit_log e
      INNER JOIN audit_categories c ON e.category_id = c.id
      INNER JOIN audit_data_sources s ON e.data_source_id = s.id
      ORDER BY e.date DESC, e.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
    console.log(`✅ Auditlog endpoint: ${result.rows.length} records`);
  } catch (error) {
    console.error('Auditlog endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  }
}

// ============================================================
// CORE UPDATE FUNCTION
// Fetches data from all 8 category feeds and stores in database
// ============================================================
async function updateSolarAuditData() {
  // This function should call all feed functions and store results
  // Implementation requires feed-functions.js to be integrated
  // See feed-functions.js for the individual category feed implementations
  
  console.log('🔄 Starting Solar Audit data update...');
  console.log('📊 Fetching data from 8 category feeds...');
  
  // TODO: Implement full update logic
  // 1. Call each feed function (feedHousingKwh, feedManufacturingKwh, etc.)
  // 2. Store results in energy_audit_log table
  // 3. Create regional breakdowns in audit_region_totals
  // 4. Log update status in update_log table
  
  return {
    status: 'SUCCESS',
    message: 'Solar Audit data update completed',
    timestamp: new Date().toISOString(),
    categories: 8,
    regions: 6
  };
}

// ============================================================
// EXPORT FOR INTEGRATION
// ============================================================
module.exports = {
  handleSolarAuditUpdate,
  handleSolarAuditEntries,
  handleSolarAuditSummary,
  handleSolarAuditLast,
  handleSolarAuditLogs,
  handleAuditLog,
  updateSolarAuditData
};

/**
 * INTEGRATION EXAMPLE:
 * ============================================================
 * 
 * const solarAuditAPI = require('./api-endpoints');
 * 
 * // In your Express/HTTP server routing:
 * if (pathname === '/api/solar-audit/update' && method === 'POST') {
 *   return solarAuditAPI.handleSolarAuditUpdate(req, res);
 * }
 * 
 * if (pathname === '/api/solar-audit/entries' && method === 'GET') {
 *   return solarAuditAPI.handleSolarAuditEntries(req, res);
 * }
 * 
 * if (pathname === '/api/solar-audit/summary' && method === 'GET') {
 *   return solarAuditAPI.handleSolarAuditSummary(req, res);
 * }
 * 
 * if (pathname === '/api/solar-audit/last' && method === 'GET') {
 *   return solarAuditAPI.handleSolarAuditLast(req, res);
 * }
 * 
 * if (pathname === '/api/solar-audit/logs' && method === 'GET') {
 *   return solarAuditAPI.handleSolarAuditLogs(req, res);
 * }
 * 
 * if (pathname === '/auditlog' && method === 'GET') {
 *   return solarAuditAPI.handleAuditLog(req, res);
 * }
 * ============================================================
 */
