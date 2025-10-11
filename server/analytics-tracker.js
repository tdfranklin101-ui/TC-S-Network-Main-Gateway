/**
 * Geographic Analytics Tracker
 * Privacy-focused aggregate visitor tracking by country and US state
 * Stores only monthly totals - no individual user tracking
 */

const geoip = require('geoip-lite');
const { Pool } = require('@neondatabase/serverless');

class AnalyticsTracker {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
    // Historical offset to restore pre-deployment visit count
    // Production database separate from workspace - needs offset restoration
    this.HISTORICAL_OFFSET = 9716;
    
    // Historical country-level offsets (cumulative page views from pre-deployment database)
    // Validated Oct 11, 2025: 9,716 total cumulative page views since April 7, 2025
    this.COUNTRY_OFFSETS = {
      'US': 6226,
      'CA': 650,
      'GB': 460,
      'DE': 325,
      'CN': 276,
      'AU': 265,
      'IN': 226,
      'JP': 200,
      'RU': 183,
      'FR': 153,
      'NL': 114,
      'SE': 57,
      'ES': 33,
      'BR': 28,
      'PL': 25,
      'IT': 23,
      'ZA': 12,
      'SG': 2
    };
  }

  /**
   * Get geographic location from IP address
   * @param {string} ip - IP address to lookup
   * @returns {object} Geographic data
   */
  getLocationFromIP(ip) {
    // Skip private/local IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return null;
    }

    const geo = geoip.lookup(ip);
    if (!geo) {
      return null;
    }

    // Use empty string for non-US states to ensure proper unique constraint
    return {
      countryCode: geo.country,
      countryName: this.getCountryName(geo.country),
      stateCode: geo.country === 'US' && geo.region ? geo.region : '',
      stateName: geo.country === 'US' && geo.region ? this.getUSStateName(geo.region) : ''
    };
  }

  /**
   * Get country name from ISO code
   * @param {string} code - ISO 3166-1 alpha-2 country code
   * @returns {string} Country name
   */
  getCountryName(code) {
    const countries = {
      'US': 'United States',
      'CA': 'Canada',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'IT': 'Italy',
      'ES': 'Spain',
      'AU': 'Australia',
      'NZ': 'New Zealand',
      'JP': 'Japan',
      'CN': 'China',
      'IN': 'India',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'AR': 'Argentina',
      'ZA': 'South Africa',
      'KR': 'South Korea',
      'RU': 'Russia',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'CH': 'Switzerland',
      'AT': 'Austria',
      'BE': 'Belgium',
      'PT': 'Portugal',
      'IE': 'Ireland',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'GR': 'Greece',
      'TR': 'Turkey',
      'IL': 'Israel',
      'SG': 'Singapore',
      'MY': 'Malaysia',
      'TH': 'Thailand',
      'ID': 'Indonesia',
      'PH': 'Philippines',
      'VN': 'Vietnam',
      'EG': 'Egypt',
      'NG': 'Nigeria',
      'KE': 'Kenya',
      'CL': 'Chile',
      'CO': 'Colombia',
      'PE': 'Peru',
      'VE': 'Venezuela'
    };
    return countries[code] || code;
  }

  /**
   * Get US state name from state code
   * @param {string} code - Two-letter US state code
   * @returns {string} State name
   */
  getUSStateName(code) {
    const states = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
    };
    return states[code] || code;
  }

  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Current date
   */
  getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Detect if running in production environment
   * @returns {boolean} True if production
   */
  isProduction() {
    // Check for production indicators
    const nodeEnv = process.env.NODE_ENV;
    const replitDeployment = process.env.REPLIT_DEPLOYMENT;
    const replDeploy = process.env.REPL_DEPLOY;
    
    // Production if NODE_ENV is production OR if it's a Replit deployment
    return nodeEnv === 'production' || replitDeployment === '1' || replDeploy === '1';
  }

  /**
   * Track a page visit with geographic data
   * Updates daily aggregate counts (production only)
   * @param {string} ip - Visitor IP address
   */
  async trackVisit(ip) {
    try {
      // Only track production visits
      const environment = this.isProduction() ? 'production' : 'development';
      if (environment !== 'production') {
        return; // Skip development visits
      }

      const location = this.getLocationFromIP(ip);
      if (!location) {
        return; // Skip if no valid location
      }

      const date = this.getCurrentDate();

      // Upsert daily aggregate for production only
      await this.pool.query(`
        INSERT INTO geo_analytics (date, environment, country_code, country_name, state_code, state_name, visit_count, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (date, environment, country_code, COALESCE(state_code, ''))
        DO UPDATE SET
          visit_count = geo_analytics.visit_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [
        date,
        environment,
        location.countryCode,
        location.countryName,
        location.stateCode,
        location.stateName
      ]);

      console.log(`📊 Analytics: +1 production visit from ${location.countryName}${location.stateName ? ', ' + location.stateName : ''} for ${date}`);
    } catch (error) {
      console.error('❌ Analytics tracking error:', error.message);
      // Don't throw - tracking failures shouldn't break the site
    }
  }

  /**
   * Express middleware to track page visits
   * @returns {Function} Express middleware
   */
  middleware() {
    return async (req, res, next) => {
      // Get visitor IP address (handle proxies)
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
        || req.headers['x-real-ip'] 
        || req.connection.remoteAddress 
        || req.socket.remoteAddress;

      // Track visit asynchronously (don't block the request)
      this.trackVisit(ip).catch(err => {
        console.error('Analytics tracking failed:', err.message);
      });

      next();
    };
  }

  /**
   * Get all daily analytics (production only) grouped by month for display
   * @returns {Promise<Array>} Analytics data grouped by month
   */
  async getMonthlyAnalytics() {
    try {
      const result = await this.pool.query(`
        SELECT 
          SUBSTRING(date, 1, 7) as month,
          country_code,
          country_name,
          state_code,
          state_name,
          SUM(visit_count) as visit_count
        FROM geo_analytics
        WHERE environment = 'production'
        GROUP BY SUBSTRING(date, 1, 7), country_code, country_name, state_code, state_name
        ORDER BY month DESC, visit_count DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return [];
    }
  }

  /**
   * Get analytics summary for a specific month (production only)
   * @param {string} month - Month in YYYY-MM format
   * @returns {Promise<object>} Analytics summary
   */
  async getMonthSummary(month) {
    try {
      const result = await this.pool.query(`
        SELECT 
          country_code,
          country_name,
          state_code,
          state_name,
          SUM(visit_count) as visit_count
        FROM geo_analytics
        WHERE environment = 'production' AND date LIKE $1
        GROUP BY country_code, country_name, state_code, state_name
        ORDER BY visit_count DESC
      `, [month + '%']);

      const totalVisits = result.rows.reduce((sum, row) => sum + parseInt(row.visit_count), 0);
      const topCountries = result.rows
        .filter(row => !row.state_code) // Only country-level data
        .slice(0, 10);

      const usStates = result.rows
        .filter(row => row.country_code === 'US' && row.state_code)
        .sort((a, b) => b.visit_count - a.visit_count);

      return {
        month,
        totalVisits,
        topCountries,
        usStates
      };
    } catch (error) {
      console.error('Error fetching month summary:', error);
      return {
        month,
        totalVisits: 0,
        topCountries: [],
        usStates: []
      };
    }
  }

  /**
   * Get total visits since inception (production only)
   * @returns {Promise<number>} Total visit count
   */
  async getTotalVisits() {
    try {
      const result = await this.pool.query(`
        SELECT SUM(visit_count) as total
        FROM geo_analytics
        WHERE environment = 'production'
      `);
      const currentTotal = parseInt(result.rows[0]?.total || 0);
      // Add historical offset to restore pre-deployment cumulative count
      return currentTotal + this.HISTORICAL_OFFSET;
    } catch (error) {
      console.error('Error fetching total visits:', error);
      return this.HISTORICAL_OFFSET; // Return offset even on error to show historical data
    }
  }

  /**
   * Get visits for today (production only)
   * @returns {Promise<number>} Today's visit count
   */
  async getTodayVisits() {
    try {
      const date = this.getCurrentDate();
      
      const result = await this.pool.query(`
        SELECT COALESCE(SUM(visit_count), 0) as today_visits
        FROM geo_analytics
        WHERE environment = 'production' AND date = $1
      `, [date]);

      return parseInt(result.rows[0]?.today_visits) || 0;
    } catch (error) {
      console.error('Error getting today visits:', error);
      return 0;
    }
  }

  /**
   * Get all-time country totals with historical offsets (production only)
   * @returns {Promise<Array>} Country totals since inception
   */
  async getAllTimeCountryTotals() {
    try {
      const result = await this.pool.query(`
        SELECT 
          country_code,
          country_name,
          SUM(visit_count) as visit_count
        FROM geo_analytics
        WHERE environment = 'production' AND (state_code IS NULL OR state_code = '')
        GROUP BY country_code, country_name
        ORDER BY visit_count DESC
      `);

      // Apply historical offsets to restore pre-deployment cumulative totals
      const countriesWithOffsets = result.rows.map(row => {
        const historicalOffset = this.COUNTRY_OFFSETS[row.country_code] || 0;
        return {
          country_code: row.country_code,
          country_name: row.country_name,
          visit_count: parseInt(row.visit_count) + historicalOffset
        };
      });

      // Add countries that only exist in historical data (not yet in current database)
      const currentCountries = new Set(result.rows.map(r => r.country_code));
      for (const [code, count] of Object.entries(this.COUNTRY_OFFSETS)) {
        if (!currentCountries.has(code)) {
          countriesWithOffsets.push({
            country_code: code,
            country_name: this.getCountryName(code),
            visit_count: count
          });
        }
      }

      // Sort by visit count descending
      return countriesWithOffsets.sort((a, b) => b.visit_count - a.visit_count);
    } catch (error) {
      console.error('Error fetching all-time country totals:', error);
      // Return historical data on error
      return Object.entries(this.COUNTRY_OFFSETS).map(([code, count]) => ({
        country_code: code,
        country_name: this.getCountryName(code),
        visit_count: count
      })).sort((a, b) => b.visit_count - a.visit_count);
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AnalyticsTracker;
