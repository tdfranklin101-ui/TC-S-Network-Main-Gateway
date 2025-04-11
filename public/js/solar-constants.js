/**
 * Solar Generation Constants (Client-Side)
 * 
 * This is the client-side mirror of server/solar-constants.ts
 * Used by the Solar Counter to ensure consistent calculations 
 * between server and client.
 * 
 * Updated based on the formulas provided in the Python code.
 */

// Constants
const TOTAL_SOLAR_KWH_PER_DAY = 4.176e+15;  // Total solar energy hitting Earth daily in kWh
const MONETIZED_PERCENTAGE = 0.01;          // 1% of total solar energy is monetized
const GLOBAL_POPULATION = 8.5e+9;           // Global population estimate
const TEST_GROUP_POPULATION = 1000;         // Initial test group size
const USD_PER_SOLAR = 136000;               // Value of 1 SOLAR unit in USD

// Calculate monetized solar
const monetizedKwh = TOTAL_SOLAR_KWH_PER_DAY * MONETIZED_PERCENTAGE;
const solarPerPersonKwh = monetizedKwh / GLOBAL_POPULATION;
const mkwhPerDay = monetizedKwh / 1e6;      // MkWh = Million kWh

// The rate of solar generation per second (for the counter)
const KWH_PER_SECOND = mkwhPerDay * 1e6 / (24 * 60 * 60);

// Daily distribution amount per person (1/365th of a SOLAR)
const DAILY_SOLAR_DISTRIBUTION = 1 / 365;
const DAILY_KWH_DISTRIBUTION = solarPerPersonKwh;
const DAILY_USD_DISTRIBUTION = DAILY_SOLAR_DISTRIBUTION * USD_PER_SOLAR;

// Calculate the ledger data for today
function getLedgerData() {
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    mkwh_generated: mkwhPerDay,
    solar_per_person_kwh: solarPerPersonKwh,
    solar_value_usd: USD_PER_SOLAR,
    total_solars_issued: GLOBAL_POPULATION,
    total_solars_distributed: TEST_GROUP_POPULATION,
    total_solars_reserved: GLOBAL_POPULATION - TEST_GROUP_POPULATION,
    registrants: [
      {
        name: 'Terry Franklin',
        email: 'hello@thecurrentsee.org',
        date_registered: '2025-04-10',
        solars_received: 1
      },
      {
        name: 'Demo Test',
        email: 'demo@example.com',
        date_registered: '2025-04-10',
        solars_received: 1
      }
    ]
  };
}

// Export as global SolarConstants object
window.SolarConstants = {
  // Core constants
  TOTAL_SOLAR_KWH_PER_DAY,
  MONETIZED_PERCENTAGE,
  GLOBAL_POPULATION,
  TEST_GROUP_POPULATION,
  USD_PER_SOLAR,
  
  // Calculated values
  monetizedKwh,
  solarPerPersonKwh,
  mkwhPerDay,
  
  // Rate constants for real-time calculations
  KWH_PER_SECOND,
  
  // Daily distribution amounts
  DAILY_SOLAR_DISTRIBUTION,
  DAILY_KWH_DISTRIBUTION,
  DAILY_USD_DISTRIBUTION,
  
  // Helper function
  getLedgerData
};