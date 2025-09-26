/**
 * Solar Counter - A dynamic counter showing solar energy accumulation
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value
 * based on data accumulated since April 7, 2025.
 */

// Elements and configuration
let energyCounter = null;
let moneyCounter = null;
let energyDisplay = null;
let moneyDisplay = null;
let initialized = false;
let lastUpdateTime = 0;
let currentKwh = 0;
let currentDollars = 0;
let kwhPerSecond = 0;
let dollarPerKwh = 0;

// Format numbers for display
function formatMkwh(value) {
  return value.toFixed(6);
}

function formatDollars(value) {
  return '$' + Math.floor(value).toLocaleString();
}

// Style counters with proper formatting and animations
function styleCounter(element) {
  if (!element) return;
  element.style.transition = 'color 0.3s';
}

// Fetch solar clock data from the server
function fetchSolarClockData() {
  fetch('/api/solar-clock')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (!initialized) {
        initCounter(data);
      } else {
        updateCounter(data);
      }
    })
    .catch(error => {
      console.error('Error fetching solar data:', error);
      
      // If we can't fetch data, use fallback values for demo purpose
      if (!initialized) {
        initCounter({
          totalKwh: 262412146783333,  // Example starting value
          totalDollars: 2015858563710, // Example starting value
          kwhPerSecond: 482600, // Expected kWh per second
          dollarPerKwh: 0.00768 // Value of kWh in dollars
        });
      }
    });
}

// Initialize the counter with initial data
function initCounter(data) {
  console.log('Solar counter initializing...');
  
  // Get hidden counter elements for storing raw values
  energyCounter = document.getElementById('energy-counter');
  moneyCounter = document.getElementById('money-counter');
  
  // Get display elements for formatted values
  energyDisplay = document.getElementById('energy-display');
  moneyDisplay = document.getElementById('money-display');
  
  if (!energyCounter || !moneyCounter) {
    console.error('Counter storage elements not found');
    return;
  }
  
  if (!energyDisplay) {
    console.error('Energy display element not found');
    return;
  }
  
  // Money display is now optional (removed from UI)
  const hasMoneyDisplay = moneyDisplay !== null;
  
  styleCounter(energyDisplay);
  styleCounter(moneyDisplay);
  
  // Set initial values
  currentKwh = data.totalKwh;
  currentDollars = data.totalDollars;
  kwhPerSecond = data.kwhPerSecond;
  dollarPerKwh = data.dollarPerKwh;
  
  // Display initial values
  energyCounter.textContent = formatMkwh(currentKwh / 1000000);
  if (moneyCounter) moneyCounter.textContent = formatDollars(currentDollars);
  
  energyDisplay.textContent = formatMkwh(currentKwh / 1000000);
  if (moneyDisplay) moneyDisplay.textContent = formatDollars(currentDollars);
  
  // Add highlight effect
  energyDisplay.classList.add('counter-highlight');
  if (moneyDisplay) moneyDisplay.classList.add('counter-highlight');
  
  setTimeout(() => {
    energyDisplay.classList.remove('counter-highlight');
    if (moneyDisplay) moneyDisplay.classList.remove('counter-highlight');
  }, 1500);
  
  // Set as initialized
  initialized = true;
  lastUpdateTime = Date.now();
  
  // Start animation loop
  requestAnimationFrame(animateCounters);
}

// Update counter with new data from server
function updateCounter(data) {
  const addedKwh = data.totalKwh - currentKwh;
  
  console.log(`Solar counter updating: ${formatMkwh(data.totalKwh / 1000000)} MkWh (${formatMkwh(addedKwh)} kWh added)`);
  
  // Update the values
  currentKwh = data.totalKwh;
  currentDollars = data.totalDollars;
  kwhPerSecond = data.kwhPerSecond;
  dollarPerKwh = data.dollarPerKwh;
  
  // Update the timestamp
  lastUpdateTime = Date.now();
  
  // Add highlight effect
  if (energyDisplay) {
    energyDisplay.classList.add('counter-highlight');
    
    setTimeout(() => {
      energyDisplay.classList.remove('counter-highlight');
    }, 1500);
  }
  
  // Apply to money display only if it exists
  if (moneyDisplay) {
    moneyDisplay.classList.add('counter-highlight');
    
    setTimeout(() => {
      moneyDisplay.classList.remove('counter-highlight');
    }, 1500);
  }
}

// Animate counters between server updates
function animateCounters(timestamp) {
  if (!initialized) return;
  
  const now = Date.now();
  const deltaTime = (now - lastUpdateTime) / 1000; // in seconds
  
  // Calculate current values based on elapsed time
  const interpolatedKwh = currentKwh + (kwhPerSecond * deltaTime);
  const interpolatedDollars = currentDollars + (kwhPerSecond * dollarPerKwh * deltaTime);
  
  // Update hidden storage elements
  if (energyCounter) {
    energyCounter.textContent = formatMkwh(interpolatedKwh / 1000000);
  }
  
  if (moneyCounter) {
    moneyCounter.textContent = formatDollars(interpolatedDollars);
  }
  
  // Update visible display elements
  if (energyDisplay) {
    energyDisplay.textContent = formatMkwh(interpolatedKwh / 1000000);
  }
  
  // Money display has been removed from UI, but keep compatibility for other pages
  if (moneyDisplay) {
    moneyDisplay.textContent = formatDollars(interpolatedDollars);
  }
  
  // Continue animation
  requestAnimationFrame(animateCounters);
}

// Start updating immediately and then every 2 seconds
document.addEventListener('DOMContentLoaded', function() {
  fetchSolarClockData();
  setInterval(fetchSolarClockData, 2000);
});