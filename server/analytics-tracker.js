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

    return {
      countryCode: geo.country,
      countryName: this.getCountryName(geo.country),
      stateCode: geo.country === 'US' ? geo.region : null,
      stateName: geo.country === 'US' ? this.getUSStateName(geo.region) : null
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
   * Get current month in YYYY-MM format
   * @returns {string} Current month
   */
  getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Track a page visit with geographic data
   * Updates monthly aggregate counts
   * @param {string} ip - Visitor IP address
   */
  async trackVisit(ip) {
    try {
      const location = this.getLocationFromIP(ip);
      if (!location) {
        return; // Skip if no valid location
      }

      const month = this.getCurrentMonth();

      // Upsert monthly aggregate
      await this.pool.query(`
        INSERT INTO geo_analytics (month, country_code, country_name, state_code, state_name, visit_count, updated_at)
        VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (month, country_code, COALESCE(state_code, ''))
        DO UPDATE SET
          visit_count = geo_analytics.visit_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [
        month,
        location.countryCode,
        location.countryName,
        location.stateCode,
        location.stateName
      ]);

      console.log(`📊 Analytics: +1 visit from ${location.countryName}${location.stateName ? ', ' + location.stateName : ''} for ${month}`);
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
   * Get all monthly analytics
   * @returns {Promise<Array>} Analytics data grouped by month
   */
  async getMonthlyAnalytics() {
    try {
      const result = await this.pool.query(`
        SELECT 
          month,
          country_code,
          country_name,
          state_code,
          state_name,
          visit_count
        FROM geo_analytics
        ORDER BY month DESC, visit_count DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return [];
    }
  }

  /**
   * Get analytics summary for a specific month
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
          visit_count
        FROM geo_analytics
        WHERE month = $1
        ORDER BY visit_count DESC
      `, [month]);

      const totalVisits = result.rows.reduce((sum, row) => sum + row.visit_count, 0);
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
      return null;
    }
  }

  /**
   * Get total visits since inception
   * @returns {Promise<number>} Total visit count
   */
  async getTotalVisits() {
    try {
      const result = await this.pool.query(`
        SELECT SUM(visit_count) as total
        FROM geo_analytics
      `);
      return parseInt(result.rows[0]?.total || 0);
    } catch (error) {
      console.error('Error fetching total visits:', error);
      return 0;
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
