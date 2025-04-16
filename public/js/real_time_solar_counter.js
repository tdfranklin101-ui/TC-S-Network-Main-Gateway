/**
 * Real-Time Solar Counter - A dynamic odometer for the Current-See project
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value
 * based on data accumulated since April 7, 2025.
 * 
 * The calculation is based on 1% of Earth's solar input divided among 8.5 billion people,
 * with each person receiving an equal share (1 SOLAR = 4,913 kWh).
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log("Real-time solar counter initializing...");
  initSolarCounter();
  
  // Initialize kwh rate display
  const kwhRateDisplay = document.getElementById('kwh-rate-display');
  if (kwhRateDisplay) {
    kwhRateDisplay.innerHTML = '1 Solar = 4,913 kWh (based on 1% of Earth\'s solar input divided among 8.5B people)';
  }
});

function initSolarCounter() {
  // Reference to the counter elements
  const energyDisplay = document.getElementById('energy-display');
  const moneyDisplay = document.getElementById('money-display');
  
  if (!energyDisplay || !moneyDisplay) {
    console.error("Solar counter elements not found!");
    return;
  }
  
  // Base values - hardcoded for static implementation
  // April 7, 2025 is the official starting date for the Solar Generator
  const baseDate = new Date('2025-04-07T00:00:00Z');
  const kwhPerSecond = 0.155664; // kWh generated per second
  const dollarPerKwh = 0.12;     // Dollar value per kWh
  
  // Start counter animation
  updateCounter(baseDate, kwhPerSecond, dollarPerKwh);
}

function updateCounter(baseDate, kwhPerSecond, dollarPerKwh) {
  // Calculate elapsed time since base date
  const currentTime = new Date();
  const elapsedMs = currentTime.getTime() - baseDate.getTime();
  const elapsedSeconds = elapsedMs / 1000;
  
  // Calculate current energy and money values
  const totalKwh = elapsedSeconds * kwhPerSecond;
  const totalDollars = totalKwh * dollarPerKwh;
  
  // Convert to MkWh (Million kWh) for display
  const currentMkWh = totalKwh / 1000000;
  
  // Format values with proper precision
  const formattedMkWh = formatWithDigitAnimation(
    currentMkWh.toFixed(6), 
    document.getElementById('energy-display')
  );
  
  const formattedDollars = formatWithDigitAnimation(
    '$' + totalDollars.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    document.getElementById('money-display')
  );
  
  // Request next animation frame
  requestAnimationFrame(() => updateCounter(baseDate, kwhPerSecond, dollarPerKwh));
}

function formatWithDigitAnimation(value, element) {
  if (!element) return value;
  
  const newValue = value.toString();
  const oldValue = element.getAttribute('data-value') || '0';
  
  // Store new value for next comparison
  element.setAttribute('data-value', newValue);
  
  // If this is the first render, just set the text
  if (oldValue === '0') {
    element.textContent = newValue;
    return newValue;
  }
  
  // Create a new display with animated digits
  let html = '';
  const digitRegex = /(\d|\.|\,|\$)/g;
  
  for (let i = 0; i < newValue.length; i++) {
    const char = newValue[i];
    
    // Check if this digit changed
    const changed = (i < oldValue.length) ? (char !== oldValue[i]) : true;
    
    if (char.match(digitRegex)) {
      // It's a digit, decimal point, comma, or currency symbol
      if (changed && char.match(/\d/)) {
        // Only digits get animation, not separators or currency symbols
        html += `<span class="digit changing">${char}</span>`;
      } else {
        html += `<span class="digit">${char}</span>`;
      }
    } else {
      // Other characters
      html += char;
    }
  }
  
  element.innerHTML = html;
  
  // Clear animation classes after the animation completes
  setTimeout(() => {
    const changingDigits = element.querySelectorAll('.changing');
    changingDigits.forEach(digit => {
      digit.classList.remove('changing');
    });
  }, 500);
  
  return newValue;
}