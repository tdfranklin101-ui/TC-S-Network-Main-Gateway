/**
 * Solar Generation Constants and Calculations
 * 
 * This module defines the core constants and calculations for
 * The Current-See's solar energy distribution system.
 * Converted from Python to JavaScript.
 */

// Constants
export const TOTAL_SOLAR_KWH_PER_DAY = 4.176e+15;  // Total solar energy hitting Earth daily in kWh
export const MONETIZED_PERCENTAGE = 0.01;          // 1% of total solar energy monetized
export const GLOBAL_POPULATION = 8.5e+9;           // Global population estimate
export const TEST_GROUP_POPULATION = 1000;         // Initial test group size
export const USD_PER_SOLAR = 136000;               // Monetary value of 1 SOLAR unit in USD

// Calculate monetized solar
export const monetizedKwh = TOTAL_SOLAR_KWH_PER_DAY * MONETIZED_PERCENTAGE;
export const solarPerPersonKwh = monetizedKwh / GLOBAL_POPULATION;
export const solarValueUsd = USD_PER_SOLAR;
export const mkwhPerDay = monetizedKwh / 1e6;      // MkWh = Million kWh

// Daily issuance
export const totalSolarsIssued = GLOBAL_POPULATION;  // 1 per person
export const totalSolarsDistributed = TEST_GROUP_POPULATION;
export const totalSolarsReserved = totalSolarsIssued - totalSolarsDistributed;

// The rate of solar generation per second (for the counter)
export const KWH_PER_SECOND = mkwhPerDay * 1e6 / (24 * 60 * 60);

// Calculate daily distribution amount per person (1 SOLAR per day)
export const DAILY_SOLAR_DISTRIBUTION = 1;
export const DAILY_KWH_DISTRIBUTION = solarPerPersonKwh;
export const DAILY_USD_DISTRIBUTION = DAILY_SOLAR_DISTRIBUTION * USD_PER_SOLAR;

// Helper function to get today's ledger information
export function getLedgerData() {
  return {
    date: new Date().toISOString().split('T')[0],
    mkwh_generated: mkwhPerDay,
    solar_per_person_kwh: solarPerPersonKwh,
    solar_value_usd: solarValueUsd,
    total_solars_issued: totalSolarsIssued,
    total_solars_distributed: totalSolarsDistributed,
    total_solars_reserved: totalSolarsReserved
  };
}