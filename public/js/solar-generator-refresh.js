/**
 * The Current-See Solar Generator Refresh System
 * 
 * This script updates the Solar Generator counter in real-time without requiring
 * page refreshes to ensure users always see the most accurate energy and value data.
 */

(function() {
  // Track last fetch time to prevent excessive requests
  let lastFetchTime = 0;
  const REFRESH_COOLDOWN = 60 * 1000; // 60 seconds between refreshes
  
  // Constants for solar calculations
  const SOLAR_VALUE_USD = 136000; // $136,000 per SOLAR
  const KWH_PER_SOLAR = 4913; // 4,913 kWh per SOLAR
  const STARTING_DATE = new Date('April 7, 2025');
  
  /**
   * Calculate the current solar generation and value based on elapsed time
   * from the starting date (April 7, 2025)
   */
  function calculateCurrentSolarData() {
    const now = new Date();
    
    // Calculate milliseconds elapsed since starting date
    const elapsedMs = now.getTime() - STARTING_DATE.getTime();
    
    // Calculate days elapsed (includes fractional days)
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
    
    // Calculate total generated SOLAR
    // The rate is determined by your specific generation rules
    const generatedSolar = elapsedDays * 100; // Example: 100 SOLAR per day
    
    // Calculate equivalent energy in MkWh (million kWh)
    const energyKwh = generatedSolar * KWH_PER_SOLAR;
    const energyMkwh = energyKwh / 1000000;
    
    // Calculate monetary value
    const value = generatedSolar * SOLAR_VALUE_USD;
    
    return {
      solar: generatedSolar,
      energyKwh: energyKwh,
      energyMkwh: energyMkwh, 
      value: value,
      timestamp: now,
      elapsedDays: elapsedDays
    };
  }
  
  /**
   * Update the solar generator displays on the webpage
   */
  function updateSolarGeneratorDisplays(data) {
    // Update energy counter displays
    updateElementText('solar-energy-counter', formatEnergyMkwh(data.energyMkwh));
    updateElementText('solar-energy-value', formatCurrency(data.value));
    updateElementText('solar-amount-generated', formatSolar(data.solar));
    
    // Update any detailed displays that show days elapsed
    updateElementText('days-elapsed', formatNumber(data.elapsedDays, 2));
    
    // Update any other elements showing calculation components
    updateElementText('kwh-per-solar', formatNumber(KWH_PER_SOLAR, 0));
    updateElementText('solar-value-usd', formatCurrency(SOLAR_VALUE_USD));
    
    // Additional information that might be displayed
    const elapsedHours = data.elapsedDays * 24;
    updateElementText('hours-elapsed', formatNumber(elapsedHours, 0));
  }
  
  /**
   * Format energy value in MkWh (million kWh) format with 6 decimal places
   */
  function formatEnergyMkwh(mkwh) {
    return mkwh.toFixed(6) + ' MkWh';
  }
  
  /**
   * Format SOLAR amounts with 4 decimal places
   */
  function formatSolar(amount) {
    return amount.toFixed(4) + ' SOLAR';
  }
  
  /**
   * Format currency values
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(amount);
  }
  
  /**
   * Format number with specified decimal places
   */
  function formatNumber(number, decimalPlaces) {
    return number.toFixed(decimalPlaces);
  }
  
  /**
   * Update the text content of an element if it exists
   */
  function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }
  
  /**
   * Fetch solar generator data from the server API
   * This can be used instead of client-side calculation if you prefer
   * server-generated values for accuracy or security
   */
  async function fetchSolarGeneratorData() {
    // Check if we should throttle the refresh
    const now = Date.now();
    if (now - lastFetchTime < REFRESH_COOLDOWN) {
      console.log('Solar Generator refresh throttled - too soon since last refresh');
      return;
    }
    
    lastFetchTime = now;
    console.log('Refreshing Solar Generator data...');
    
    try {
      // Fetch with cache-busting
      const response = await fetch(`/api/solar-generator-status?cache=${Math.random()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.log('Server API not available, using client-side calculation');
        // Fall back to client-side calculation
        const calculatedData = calculateCurrentSolarData();
        updateSolarGeneratorDisplays(calculatedData);
        return;
      }
      
      const data = await response.json();
      updateSolarGeneratorDisplays(data);
      console.log('Solar Generator data refreshed from server');
    } catch (error) {
      console.error('Error fetching Solar Generator data:', error);
      // Fall back to client-side calculation
      console.log('Falling back to client-side calculation');
      const calculatedData = calculateCurrentSolarData();
      updateSolarGeneratorDisplays(calculatedData);
    }
  }
  
  /**
   * Main refresh function - tries server API first, then falls back to local calculation
   */
  function refreshSolarGeneratorData() {
    // Try to fetch from server API
    fetchSolarGeneratorData().catch(error => {
      console.error('Error in Solar Generator refresh:', error);
      
      // Always ensure the display is updated even on error
      const calculatedData = calculateCurrentSolarData();
      updateSolarGeneratorDisplays(calculatedData);
    });
  }
  
  // Make the refresh function available globally
  window.refreshSolarGeneratorData = refreshSolarGeneratorData;
  
  // Set up automatic periodic refresh (every minute)
  setInterval(refreshSolarGeneratorData, 60 * 1000);
  
  // Initial data load
  document.addEventListener('DOMContentLoaded', function() {
    refreshSolarGeneratorData();
  });
})();