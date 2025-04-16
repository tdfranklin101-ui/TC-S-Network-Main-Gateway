/**
 * Standalone Solar Counter - A dynamic counter showing solar energy accumulation
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value
 * based on data accumulated since April 7, 2025.
 */

// Configuration
const START_DATE = new Date('2025-04-07T00:00:00Z');
const KWH_PER_SOLAR = 4913; // 4,913 kWh per SOLAR
const DOLLAR_PER_SOLAR = 392; // $392 per SOLAR (at $0.08 per kWh)
const SOLAR_PER_DAY = 1; // 1 SOLAR per day
const SOLAR_PER_SECOND = SOLAR_PER_DAY / (24 * 60 * 60); // 1 SOLAR per day in seconds

// Elements
let energyDisplay, moneyDisplay, solarRateDisplay;
let rateDisplay, memberDisplay, individualsDisplay;
let initialized = false;

// Format numbers for display
function formatMkwh(value) {
  return value.toFixed(6);
}

function formatDollars(value) {
  return '$' + Math.floor(value).toLocaleString();
}

// Calculate current values based on time elapsed since START_DATE
function calculateCurrentValues() {
  const now = new Date();
  const elapsedMs = now.getTime() - START_DATE.getTime();
  const elapsedSeconds = elapsedMs / 1000;
  
  const totalSolar = SOLAR_PER_SECOND * elapsedSeconds;
  const totalKwh = totalSolar * KWH_PER_SOLAR;
  const totalDollars = totalSolar * DOLLAR_PER_SOLAR;
  
  return {
    totalSolar,
    totalKwh,
    totalDollars,
    elapsedSeconds
  };
}

// Initialize the counter
function initCounter() {
  console.log('Standalone solar counter initializing...');
  
  // Get display elements
  energyDisplay = document.getElementById('energy-display');
  moneyDisplay = document.getElementById('money-display');
  solarRateDisplay = document.getElementById('solar-rate-display');
  rateDisplay = document.getElementById('kwh-rate-display');
  memberDisplay = document.getElementById('member-count');
  individualsDisplay = document.getElementById('solar-per-individual');
  
  if (!energyDisplay || !moneyDisplay) {
    console.error('Counter display elements not found');
    return;
  }
  
  // Add styles programmatically
  const style = document.createElement('style');
  style.textContent = `
    .counter-highlight {
      color: #FFD700 !important;
      transition: color 0.3s ease;
    }
    .counter-value {
      font-weight: bold;
      transition: color 0.2s ease;
    }
    .solar-counter {
      background-color: rgba(255, 215, 0, 0.15);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
  `;
  document.head.appendChild(style);
  
  // Set member count (fixed for demo)
  if (memberDisplay) {
    memberDisplay.textContent = '2';
  }
  
  // Set solar per individual rate
  if (individualsDisplay) {
    individualsDisplay.textContent = '4,913';
  }
  
  // Set solar rate (1 per day)
  if (solarRateDisplay) {
    solarRateDisplay.textContent = '1 SOLAR = 4,913 kWh = $392';
  }
  
  // Set kWh rate display
  if (rateDisplay) {
    rateDisplay.textContent = '4,913 kWh (based on 1% of Earth\'s solar input divided among 8.5B people)';
  }
  
  // Set as initialized
  initialized = true;
  
  // Start animation loop
  requestAnimationFrame(animateCounters);
}

// Animate counters
function animateCounters() {
  if (!initialized) return;
  
  const values = calculateCurrentValues();
  
  // Update display elements
  if (energyDisplay) {
    energyDisplay.textContent = formatMkwh(values.totalKwh / 1000000); // Convert to MkWh
  }
  
  if (moneyDisplay) {
    moneyDisplay.textContent = formatDollars(values.totalDollars);
  }
  
  // Continue animation
  requestAnimationFrame(animateCounters);
}

// Start updating when the page loads
document.addEventListener('DOMContentLoaded', initCounter);

// Expose for debugging
window.debugSolarCounter = function() {
  const values = calculateCurrentValues();
  console.log({
    startDate: START_DATE.toISOString(),
    elapsedSeconds: values.elapsedSeconds,
    totalSolar: values.totalSolar,
    totalKwh: values.totalKwh,
    totalDollars: values.totalDollars,
    displayMkwh: formatMkwh(values.totalKwh / 1000000),
    displayDollars: formatDollars(values.totalDollars)
  });
};