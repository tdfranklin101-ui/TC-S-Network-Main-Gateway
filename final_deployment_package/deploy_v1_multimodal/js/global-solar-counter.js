/**
 * Global Solar Counter
 * 
 * Displays a live counter of total SOLAR generated globally since April 7, 2025
 * Based on the rate of 8.5 billion SOLAR per day (distributed to the world population)
 */

// Constants
const START_DATE = new Date('2025-04-07T00:00:00Z');
const SOLAR_PER_DAY = 8.5 * 1000000000; // 8.5 billion
const SOLAR_PER_SECOND = SOLAR_PER_DAY / (24 * 60 * 60);
const KWH_PER_SOLAR = 4913;
// Dollar conversion removed as requested

// Variables for the rolling animation
let targetSolarValue = 0;
let currentDisplayValue = 0;
let animationFrameId = null;

// Format number with commas and 4 decimal places
function formatNumber(num, decimals = 4) {
  // Use toLocaleString for consistent formatting of large numbers
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Currency formatting removed as requested

// Calculate the total SOLAR generated since start date
function calculateTotalSolar() {
  const now = new Date();
  const elapsedSeconds = (now - START_DATE) / 1000;
  return elapsedSeconds * SOLAR_PER_SECOND;
}

// Calculate energy in MkWh (million kWh)
function calculateEnergy(solar) {
  return solar * KWH_PER_SOLAR / 1000000; // Convert to million kWh
}

// Dollar value calculation removed as requested

// Update counter display with rolling animation
function updateCounterWithAnimation() {
  // Calculate the current target value
  targetSolarValue = calculateTotalSolar();
  
  // If this is the first run, initialize current value
  if (currentDisplayValue === 0) {
    currentDisplayValue = targetSolarValue;
  }
  
  // Determine how quickly to catch up (faster for bigger differences)
  const difference = targetSolarValue - currentDisplayValue;
  const increment = Math.max(difference * 0.1, 0.1); // At least 0.1 SOLAR per frame
  
  // Update current display value
  currentDisplayValue += increment;
  
  // If we've caught up enough, just set to the target
  if (Math.abs(targetSolarValue - currentDisplayValue) < 0.1) {
    currentDisplayValue = targetSolarValue;
  }
  
  // Calculate derived values
  const energy = calculateEnergy(currentDisplayValue);
  // Dollar value calculation removed
  
  // Update display elements
  if (document.getElementById('global-solar-count')) {
    document.getElementById('global-solar-count').textContent = formatNumber(currentDisplayValue);
  }
  
  if (document.getElementById('global-energy-count')) {
    document.getElementById('global-energy-count').textContent = formatNumber(energy, 6);
  }
  
  // Dollar value display removed as requested
  
  // Continue animation
  animationFrameId = requestAnimationFrame(updateCounterWithAnimation);
}

// Initialize counter when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Start the animation
  updateCounterWithAnimation();
});