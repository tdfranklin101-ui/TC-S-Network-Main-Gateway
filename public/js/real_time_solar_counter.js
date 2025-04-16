/**
 * Real-Time Solar Counter - An advanced, animated counter showing solar energy accumulation
 * 
 * This script creates an animated, real-time counter that visualizes the 
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
let energyDisplay, moneyDisplay;
let initialized = false;
let lastUpdated = 0;
let animationFrameId = null;

// Format numbers for display with animation
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
function initRealTimeCounter() {
  console.log('Real-time solar counter initializing...');
  
  // Get display elements
  energyDisplay = document.getElementById('energy-display');
  moneyDisplay = document.getElementById('money-display');
  
  if (!energyDisplay || !moneyDisplay) {
    console.error('Counter display elements not found');
    return;
  }
  
  // Add animation styles
  addCounterStyles();
  
  // Set as initialized
  initialized = true;
  
  // Start animation loop
  animateCounters();
}

function addCounterStyles() {
  if (document.getElementById('real-time-counter-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'real-time-counter-styles';
  style.textContent = `
    @keyframes digitPulse {
      0% { color: #7bc144; }
      50% { color: #4a9021; }
      100% { color: #7bc144; }
    }
    
    .digit {
      display: inline-block;
      transition: transform 0.2s ease;
    }
    
    .digit.changing {
      animation: digitPulse 0.5s;
      transform: scale(1.1);
    }
    
    .counter-value {
      font-family: 'Roboto Mono', monospace, sans-serif;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);
  
  // Add roboto mono if needed
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
}

// Animate both counters with realistic odometer effect
function animateCounters() {
  if (!initialized) return;
  
  const now = Date.now();
  const values = calculateCurrentValues();
  
  // Calculate MkWh (Million kWh)
  const mkwh = values.totalKwh / 1000000;
  const formattedMkwh = formatMkwh(mkwh);
  
  // Format dollar value
  const dollars = values.totalDollars;
  const formattedDollars = formatDollars(dollars);
  
  // Update the energy display with animation
  if (energyDisplay) {
    // Only update DOM if content has changed or 250ms has passed (for performance)
    if (energyDisplay.textContent !== formattedMkwh || now - lastUpdated > 250) {
      updateWithAnimation(energyDisplay, energyDisplay.textContent, formattedMkwh);
    }
  }
  
  // Update the money display with animation
  if (moneyDisplay) {
    // Only update DOM if content has changed or 250ms has passed
    if (moneyDisplay.textContent !== formattedDollars || now - lastUpdated > 250) {
      updateWithAnimation(moneyDisplay, moneyDisplay.textContent, formattedDollars);
    }
  }
  
  // Update last update timestamp
  if (now - lastUpdated > 250) {
    lastUpdated = now;
  }
  
  // Continue animation
  animationFrameId = requestAnimationFrame(animateCounters);
}

// Update element with animated transition for changing digits
function updateWithAnimation(element, oldValue, newValue) {
  // Convert to simple strings if they're not already
  oldValue = String(oldValue || '');
  newValue = String(newValue || '');
  
  // If no previous value, just set it
  if (!oldValue || oldValue === '0' || oldValue === '0.000000' || oldValue === '$0') {
    element.textContent = newValue;
    return;
  }
  
  // Create array of spans for each character
  const chars = [];
  
  // Keep track of which digits have changed
  const changedIndexes = [];
  
  // Loop through each character in the new value
  for (let i = 0; i < newValue.length; i++) {
    const char = newValue[i];
    const oldChar = i < oldValue.length ? oldValue[i] : '';
    
    // Check if this character has changed
    const hasChanged = char !== oldChar;
    if (hasChanged) {
      changedIndexes.push(i);
    }
    
    // Create a span for this character
    const span = document.createElement('span');
    span.textContent = char;
    span.className = 'digit';
    chars.push(span);
  }
  
  // Clear the element and add all spans
  element.innerHTML = '';
  chars.forEach(span => element.appendChild(span));
  
  // Animate the changed digits
  changedIndexes.forEach(index => {
    const span = element.childNodes[index];
    if (span) {
      span.classList.add('changing');
      setTimeout(() => span.classList.remove('changing'), 500);
    }
  });
}

// Start updating when the page loads
document.addEventListener('DOMContentLoaded', initRealTimeCounter);

// Clean up on page unload
window.addEventListener('beforeunload', function() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

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