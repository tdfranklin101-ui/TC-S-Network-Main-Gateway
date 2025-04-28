/**
 * Real-Time Solar Conversion Clock
 * 
 * This script creates a live counter showing the accumulation of solar energy
 * and its monetary value based on data since April 7, 2025.
 * 
 * Display format: MkWh (million kilowatt-hours) with 6 decimal places
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log("Real-time solar counter initializing...");
  
  // Find the solar counter element
  const counterElement = document.getElementById('solar-counter');
  if (!counterElement) {
    console.error("Solar counter container not found!");
    return;
  }
  
  // Initialize counter with loading state
  counterElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
      <div style="font-weight: bold; color: #0057B8;">☀️ Live Solar Generation</div>
      <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #FF0000; margin-left: 8px; animation: blink 1s infinite;"></div>
    </div>
    <div id="main-counter" style="font-size: 16px; font-weight: bold; color: #0057B8;">
      <span class="loading-text">Loading solar data...</span>
    </div>
    <div id="counter-details" style="overflow: hidden; max-height: 0; opacity: 0; transition: all 0.5s ease; margin-top: 10px; font-size: 12px;"></div>
  `;
  
  // Add animation style
  if (!document.getElementById('blink-animation-style')) {
    const style = document.createElement('style');
    style.id = 'blink-animation-style';
    style.textContent = `
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0.2; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add click handler for showing/hiding details
  let expanded = false;
  counterElement.addEventListener('click', function() {
    const detailsElement = document.getElementById('counter-details');
    if (detailsElement) {
      expanded = !expanded;
      detailsElement.style.maxHeight = expanded ? '300px' : '0';
      detailsElement.style.opacity = expanded ? '1' : '0';
    }
  });
  
  // Start fetching data
  fetchSolarData();
  
  // Refresh data every 5 minutes
  setInterval(fetchSolarData, 300000);
});

/**
 * Fetch solar data from the API
 */
function fetchSolarData() {
  // Fetch data from the API
  fetch('/api/solar-clock')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch solar clock data');
      }
      return response.json();
    })
    .then(data => {
      // Initialize counter animation with fetched data
      startCounterAnimation(data);
    })
    .catch(error => {
      console.error('Error fetching solar clock data:', error);
      
      // Show error in counter
      const counterElement = document.getElementById('main-counter');
      if (counterElement) {
        counterElement.innerHTML = '<div style="color: #d9534f">⚠️ Solar data unavailable</div>';
      }
    });
}

/**
 * Start the counter animation with initial data
 */
function startCounterAnimation(initialData) {
  const startDate = new Date(initialData.startDate);
  const kwhPerSecond = initialData.kwhPerSecond;
  const dollarPerKwh = initialData.dollarPerKwh;
  
  // Get initial values
  const fetchTime = new Date();
  const totalSecondsSinceStart = Math.floor((fetchTime - startDate) / 1000);
  const totalKwh = totalSecondsSinceStart * kwhPerSecond;
  const totalDollars = totalKwh * dollarPerKwh;
  
  // Store values for animation
  const animationData = {
    fetchTime: fetchTime,
    startDate: startDate,
    kwhPerSecond: kwhPerSecond,
    dollarPerKwh: dollarPerKwh,
    totalKwh: totalKwh,
    totalDollars: totalDollars
  };
  
  // Update counter details
  updateCounterDetails(animationData);
  
  // Start animation
  requestAnimationFrame(() => updateCounter(animationData));
}

/**
 * Update counter details section
 */
function updateCounterDetails(data) {
  const detailsElement = document.getElementById('counter-details');
  if (!detailsElement) return;
  
  const startDate = data.startDate;
  const currentDate = new Date();
  
  // Calculate days, hours, minutes since start
  const totalSeconds = Math.floor((currentDate - startDate) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  // Calculate other metrics
  const kwhPerHour = data.kwhPerSecond * 3600;
  const mkwhPerHour = kwhPerHour / 1000000;
  const dollarPerKwh = data.dollarPerKwh;
  const co2Saved = data.totalKwh * 0.85; // kg of CO2 saved per kWh
  const co2SavedTons = co2Saved / 1000; // Convert to metric tons
  const homesPowered = data.totalKwh / 1.5; // Homes powered based on average consumption
  
  // Update details content
  detailsElement.innerHTML = `
    <div style="margin-bottom: 5px; color: #0057B8;">Base Date: April 7, 2025</div>
    <div style="margin-bottom: 5px; color: #0057B8;">Total Days: ${days} days, ${hours} hours, ${minutes} minutes</div>
    <div style="margin-bottom: 5px; color: #0057B8;">Generation Rate: ${mkwhPerHour.toFixed(8)} MkWh/hour</div>
    <div style="margin-bottom: 5px; color: #0057B8;">CO₂ Saved: ${co2SavedTons.toLocaleString(undefined, {maximumFractionDigits: 2})} metric tons</div>
    <div style="margin-bottom: 5px; color: #0057B8;">Homes Powered: ${homesPowered.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
    <div style="font-size: 10px; margin-top: 10px; color: #666; opacity: 0.8">Click to toggle details</div>
  `;
}

/**
 * Update the counter values in real-time
 */
function updateCounter(data) {
  const counterElement = document.getElementById('main-counter');
  if (!counterElement) return;
  
  // Calculate current values based on elapsed time
  const now = new Date();
  const secondsElapsed = (now - data.fetchTime) / 1000;
  
  // Calculate current total kWh and dollars
  const currentKwh = data.totalKwh + (secondsElapsed * data.kwhPerSecond);
  const currentDollars = currentKwh * data.dollarPerKwh;
  
  // Convert kWh to MkWh (million kWh) for display
  const currentMkWh = currentKwh / 1000000;
  
  // Format with exactly 6 decimal places
  const formattedMkWh = currentMkWh.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  });
  
  const formattedDollars = currentDollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Generate HTML with animation for changing digits
  const mkwhParts = formattedMkWh.split('');
  const dollarParts = formattedDollars.split('');
  
  let mkwhHtml = '';
  for (let i = 0; i < mkwhParts.length; i++) {
    // Make decimal digits animated
    const isDecimal = mkwhParts[i] !== ',' && mkwhParts[i] !== '.';
    const isAfterDecimal = formattedMkWh.indexOf('.') !== -1 && i > formattedMkWh.indexOf('.');
    
    // Add more animation to the last 6 decimal digits
    const isHighlighted = isDecimal && isAfterDecimal && (mkwhParts.length - i <= 3);
    const isAnimated = isDecimal && isAfterDecimal && (mkwhParts.length - i <= 6);
    
    if (isHighlighted) {
      mkwhHtml += `<span class="digit-highlight">${mkwhParts[i]}</span>`;
    } else if (isAnimated) {
      mkwhHtml += `<span class="digit-animate">${mkwhParts[i]}</span>`;
    } else {
      mkwhHtml += mkwhParts[i];
    }
  }
  
  // Update the counter HTML
  counterElement.innerHTML = `${mkwhHtml} MkWh = $${formattedDollars}`;
  
  // Continue animation
  requestAnimationFrame(() => updateCounter(data));
}