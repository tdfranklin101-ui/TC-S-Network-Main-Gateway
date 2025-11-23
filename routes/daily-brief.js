/**
 * TC-S Daily Indices Brief API Route
 * Serves the 6 core indices daily briefing in JSON and JSON-LD formats
 */

const fs = require('fs');
const path = require('path');
const { DailyBrief } = require('../lib/indices');

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const BRIEF_FILE = path.join(DATA_DIR, 'daily-brief.json');

/**
 * GET /api/daily-brief
 * Returns the latest daily brief in JSON format
 * 
 * Query params:
 *  ?format=jsonld - Returns JSON-LD format
 */
async function getDailyBrief(req, res) {
  try {
    const format = req.query.format || 'json';

    // Check if brief file exists
    if (!fs.existsSync(BRIEF_FILE)) {
      return res.status(404).json({
        error: 'Daily brief not generated yet',
        hint: 'Run npm run generate:daily-brief or wait for scheduled generation'
      });
    }

    const content = fs.readFileSync(BRIEF_FILE, 'utf-8');
    const briefData = JSON.parse(content);
    const brief = new DailyBrief(
      briefData.date,
      briefData.indices,
      briefData.solar
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (format === 'jsonld') {
      return res.status(200).json(brief.toJSONLD());
    }

    return res.status(200).json(brief.toJSON());
  } catch (error) {
    console.error('❌ Error fetching daily brief:', error);
    return res.status(500).json({
      error: 'Failed to fetch daily brief',
      message: error.message
    });
  }
}

/**
 * POST /api/daily-brief/generate
 * Trigger manual generation of daily brief
 */
async function generateDailyBrief(req, res) {
  try {
    const generator = require('../scripts/generateDailyBrief');
    await generator.generateBrief();

    return res.status(200).json({
      message: 'Daily brief generated successfully',
      file: BRIEF_FILE
    });
  } catch (error) {
    console.error('❌ Error generating daily brief:', error);
    return res.status(500).json({
      error: 'Failed to generate daily brief',
      message: error.message
    });
  }
}

/**
 * GET /api/daily-brief/indices/:id
 * Get specific index value
 */
async function getSpecificIndex(req, res) {
  try {
    const { id } = req.params;

    if (!fs.existsSync(BRIEF_FILE)) {
      return res.status(404).json({ error: 'Daily brief not generated yet' });
    }

    const content = fs.readFileSync(BRIEF_FILE, 'utf-8');
    const briefData = JSON.parse(content);
    const index = briefData.indices.find(idx => idx.id === id);

    if (!index) {
      return res.status(404).json({ error: `Index ${id} not found` });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(index);
  } catch (error) {
    console.error(`❌ Error fetching index ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Failed to fetch index',
      message: error.message
    });
  }
}

module.exports = {
  getDailyBrief,
  generateDailyBrief,
  getSpecificIndex
};
