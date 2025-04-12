/**
 * Solar Counter - A dynamic counter showing solar energy accumulation
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value
 * based on data accumulated since April 7, 2025.
 * 
 * Updated: April 12, 2025 - CommonJS deployment version
 */

// Constants
const START_DATE = new Date('2025-04-07T00:00:00Z');
const KWH_RATE_PER_SECOND = 4.176e+15 * 0.01 / (24 * 60 * 60);
const USD_PER_SOLAR = 136000;

// Helper function to style counter elements
function styleCounter(element) {
  if (!element) return;
  
  element.style.fontFamily = 'monospace, "Courier New", Courier';
  element.style.fontSize = '1.2rem';
  element.style.fontWeight = 'bold';
  element.style.padding = '8px 16px';
  element.style.borderRadius = '4px';
  element.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
  element.style.margin = '10px 0';
  element.style.display = 'inline-block';
}

// Function to get the base API URL
function getBaseApiUrl() {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}`;
}

// Function to fetch initial solar clock data
function fetchSolarClockData() {
  const apiUrl = `${getBaseApiUrl()}/api/solar-clock`;
  
  return fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error fetching solar clock data:', error);
      // Fallback to calculated values
      const now = new Date();
      const secondsElapsed = (now - START_DATE) / 1000;
      const kwhAccumulated = KWH_RATE_PER_SECOND * secondsElapsed;
      
      return {
        timestamp: now.toISOString(),
        kwh_accumulated: kwhAccumulated,
        monetary_value: kwhAccumulated * USD_PER_SOLAR / 1e15
      };
    });
}

// Initialize counter with fetched data
function initCounter(data) {
  // Get counter elements
  const energyCounter = document.getElementById('energy-counter');
  const valueCounter = document.getElementById('value-counter');
  const elapsedTimeElement = document.getElementById('elapsed-time');
  
  if (!energyCounter || !valueCounter) {
    console.error('Counter elements not found');
    return;
  }
  
  // Style counter elements
  styleCounter(energyCounter);
  styleCounter(valueCounter);
  if (elapsedTimeElement) styleCounter(elapsedTimeElement);
  
  // Initialize values from data
  let initialKWh = parseFloat(data.kwh_accumulated) || 0;
  let initialValue = parseFloat(data.monetary_value) || 0;
  
  // Set initial values in DOM
  energyCounter.textContent = `${(initialKWh / 1e6).toFixed(6)} MkWh`;
  valueCounter.textContent = `$${initialValue.toLocaleString('en-US')}`;
  
  // Start updating the counter
  updateCounter({
    startTime: new Date(),
    startKWh: initialKWh,
    startValue: initialValue
  });
  
  // Update elapsed time if element exists
  if (elapsedTimeElement) {
    setInterval(() => {
      const now = new Date();
      const secondsElapsed = Math.floor((now - START_DATE) / 1000);
      elapsedTimeElement.textContent = formatTime(secondsElapsed);
    }, 1000);
  }
}

// Update counter values continuously
function updateCounter(initialData) {
  const updateInterval = 100; // milliseconds
  
  let lastUpdateTime = initialData.startTime;
  let currentKWh = initialData.startKWh;
  let currentValue = initialData.startValue;
  
  // Get counter elements
  const energyCounter = document.getElementById('energy-counter');
  const valueCounter = document.getElementById('value-counter');
  
  if (!energyCounter || !valueCounter) return;
  
  // Update function
  function update() {
    const now = new Date();
    const secondsElapsed = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    
    // Calculate new values
    currentKWh += KWH_RATE_PER_SECOND * secondsElapsed;
    currentValue = currentKWh * USD_PER_SOLAR / 1e15;
    
    // Update display
    energyCounter.textContent = `${(currentKWh / 1e6).toFixed(6)} MkWh`;
    valueCounter.textContent = `$${currentValue.toLocaleString('en-US')}`;
    
    // Schedule next update
    requestAnimationFrame(update);
  }
  
  // Start updating
  update();
}

// Format time as days, hours, minutes, seconds
function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  // Get counter elements
  const energyCounter = document.getElementById('energy-counter');
  const valueCounter = document.getElementById('value-counter');
  
  if (energyCounter && valueCounter) {
    fetchSolarClockData().then(initCounter);
  }
});