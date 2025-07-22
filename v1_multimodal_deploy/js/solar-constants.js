/**
 * Solar Constants - Global configuration for The Current-See platform
 */

const SOLAR_CONSTANTS = {
  // Solar energy hitting Earth daily in kWh
  TOTAL_SOLAR_KWH_PER_DAY: 4.176e+15,
  
  // Percentage of solar energy monetized
  MONETIZED_PERCENTAGE: 0.01,
  
  // Global population estimate
  GLOBAL_POPULATION: 8.5e+9,
  
  // Initial test group size
  TEST_GROUP_POPULATION: 1000,
  
  // Value of 1 SOLAR unit in USD
  USD_PER_SOLAR: 136000,
  
  // Base date for all calculations
  BASE_DATE: new Date('2025-04-07T00:00:00Z'),
  
  // Daily SOLAR distribution per person
  DAILY_SOLAR_DISTRIBUTION: 1,
  
  // Calculated values (will be filled in)
  monetizedKwh: 0,
  solarPerPersonKwh: 0,
  mkwhPerDay: 0,
  KWH_PER_SECOND: 0,
  DAILY_KWH_DISTRIBUTION: 0,
  DAILY_USD_DISTRIBUTION: 0
};

// Calculate derived constants
function initializeSolarConstants() {
  // Total daily solar energy monetized in kWh
  SOLAR_CONSTANTS.monetizedKwh = 
    SOLAR_CONSTANTS.TOTAL_SOLAR_KWH_PER_DAY * 
    SOLAR_CONSTANTS.MONETIZED_PERCENTAGE;
  
  // Per person share of monetized daily solar energy in kWh
  SOLAR_CONSTANTS.solarPerPersonKwh = 
    SOLAR_CONSTANTS.monetizedKwh / 
    SOLAR_CONSTANTS.GLOBAL_POPULATION;
  
  // Daily solar energy in million kWh (MkWh)
  SOLAR_CONSTANTS.mkwhPerDay = 
    SOLAR_CONSTANTS.monetizedKwh / 1e6;
  
  // Solar energy production rate in kWh per second
  SOLAR_CONSTANTS.KWH_PER_SECOND = 
    SOLAR_CONSTANTS.mkwhPerDay * 1e6 / (24 * 60 * 60);
  
  // Daily kWh distribution per person (same as solarPerPersonKwh)
  SOLAR_CONSTANTS.DAILY_KWH_DISTRIBUTION = 
    SOLAR_CONSTANTS.solarPerPersonKwh;
  
  // Daily USD value distribution per person
  SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION = 
    SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * 
    SOLAR_CONSTANTS.USD_PER_SOLAR;
}

// Initialize on load
initializeSolarConstants();

// Utility functions to calculate solar amounts
const SolarCalculator = {
  /**
   * Calculate total SOLAR accumulated since a given date
   * @param {Date|string} joinDate - The date to calculate from
   * @returns {number} - Total SOLAR units
   */
  calculateTotalSolar: function(joinDate) {
    const startDate = joinDate instanceof Date ? 
      joinDate : new Date(joinDate);
    
    if (isNaN(startDate.getTime())) {
      console.error('Invalid date provided to calculateTotalSolar:', joinDate);
      return 0;
    }
    
    // Don't allow dates before the base date
    if (startDate < SOLAR_CONSTANTS.BASE_DATE) {
      startDate = new Date(SOLAR_CONSTANTS.BASE_DATE);
    }
    
    const now = new Date();
    const millisDiff = now - startDate;
    const daysDiff = millisDiff / (1000 * 60 * 60 * 24);
    
    // Daily distribution is 1 SOLAR per day
    return SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * daysDiff;
  },
  
  /**
   * Calculate total kWh accumulated since a given date
   * @param {Date|string} joinDate - The date to calculate from
   * @returns {number} - Total kWh
   */
  calculateTotalKwh: function(joinDate) {
    const totalSolar = this.calculateTotalSolar(joinDate);
    return totalSolar * SOLAR_CONSTANTS.solarPerPersonKwh * 365;
  },
  
  /**
   * Calculate total monetary value accumulated since a given date
   * @param {Date|string} joinDate - The date to calculate from
   * @returns {number} - Total value in USD
   */
  calculateTotalValue: function(joinDate) {
    const totalSolar = this.calculateTotalSolar(joinDate);
    return totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
  }
};

// Make available globally
window.SOLAR_CONSTANTS = SOLAR_CONSTANTS;
window.SolarCalculator = SolarCalculator;