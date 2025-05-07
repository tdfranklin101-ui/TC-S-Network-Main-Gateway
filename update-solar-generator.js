/**
 * Update Solar Generator Page
 * 
 * This script directly updates the solar-generator.html and real_time_solar_counter.js
 * files in the public directory to add the Total SOLAR Units Generated feature.
 */

const fs = require('fs');
const path = require('path');

// Define the paths to the files we need to update
const publicDir = path.join(__dirname, 'public');
const solarGenHtmlPath = path.join(publicDir, 'solar-generator.html');
const counterJsPath = path.join(publicDir, 'js', 'real_time_solar_counter.js');

// Get current content
try {
  console.log('Reading solar-generator.html...');
  let htmlContent = fs.readFileSync(solarGenHtmlPath, 'utf8');
  
  // Update HTML - Replace counter section
  htmlContent = htmlContent.replace(
    /<div class="counter-container">[\s\S]*?<div class="counter solar-conversion-counter">[\s\S]*?<\/div>/gm,
    `<div class="counter-container">
                <div class="counter">
                    <div class="counter-label">Solar Energy Generated Since April 7, 2025 (12:00 AM GMT)</div>
                    <div id="energy-display" class="counter-value">0.000000</div>
                    <div class="counter-label">Million kWh (MkWh)</div>
                </div>
                
                <div class="counter solar-graphic-counter">
                    <div class="counter-label">Equivalent Monetary Value</div>
                    <div id="money-display" class="counter-value">$0</div>
                    <div class="counter-label">USD</div>
                    <div class="solar-icon-container">
                        <img src="/img/solar-icon-default.svg" alt="Solar Energy Icon" class="solar-icon" onerror="this.src='/img/solar-conversion-icon.svg';" />
                    </div>
                </div>
            </div>
            
            <div class="counter-container two-counters">
                <div class="counter solar-calculation-counter">
                    <div class="counter-label">Total SOLAR Units Generated</div>
                    <div id="total-solar-display" class="counter-value solar-value">0.0000</div>
                    <div class="counter-label">SOLAR</div>
                </div>
                
                <div class="counter solar-conversion-counter">
                    <div class="counter-label">Equivalent in SOLAR Units</div>
                    <div id="solar-display" class="counter-value">0.0000</div>
                    <div class="counter-label">SOLAR</div>
                </div>
            </div>`
  );
  
  // Add new CSS styles
  const cssToAdd = `
        .counter-container.two-counters {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin: 2rem auto;
        }
        
        .solar-conversion-counter, .solar-calculation-counter {
            flex: 1;
            max-width: 600px;
            padding: 1.5rem;
            background-color: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            text-align: center;
            position: relative;
        }
        
        .solar-calculation-counter {
            background-color: #f3faef;
            box-shadow: 0 2px 10px rgba(123, 193, 68, 0.15);
        }
        
        .solar-value {
            color: #2054a6;
            font-weight: 700;
        }`;
  
  // Replace existing styles
  htmlContent = htmlContent.replace(
    /\.solar-conversion-counter\s*{[^}]*}/,
    cssToAdd
  );
  
  // Update DOMContentLoaded script to include total solar display
  htmlContent = htmlContent.replace(
    /document\.addEventListener\('DOMContentLoaded',[\s\S]*?}\);/gm,
    `document.addEventListener('DOMContentLoaded', function() {
            console.log('Solar generator page initialized with real-time counter');
            
            // Start diagnostic animation to show it's working
            const energyDisplay = document.getElementById('energy-display');
            const moneyDisplay = document.getElementById('money-display');
            const solarDisplay = document.getElementById('solar-display');
            const totalSolarDisplay = document.getElementById('total-solar-display');
            
            if (energyDisplay && moneyDisplay) {
                // Brief flash to show it's active
                energyDisplay.style.transition = 'color 0.5s ease';
                moneyDisplay.style.transition = 'color 0.5s ease';
                if (solarDisplay) solarDisplay.style.transition = 'color 0.5s ease';
                if (totalSolarDisplay) totalSolarDisplay.style.transition = 'color 0.5s ease';
                
                energyDisplay.style.color = '#FFD700';
                moneyDisplay.style.color = '#FFD700';
                if (solarDisplay) solarDisplay.style.color = '#FFD700';
                if (totalSolarDisplay) totalSolarDisplay.style.color = '#FFD700';
                
                setTimeout(() => {
                    energyDisplay.style.color = '#7bc144';
                    moneyDisplay.style.color = '#7bc144';
                    if (solarDisplay) solarDisplay.style.color = '#7bc144';
                    if (totalSolarDisplay) totalSolarDisplay.style.color = '#2054a6';
                }, 500);
            }
            
            // Log to confirm total solar display is working
            console.log('Total SOLAR units display initialized: ' + (totalSolarDisplay ? 'YES' : 'NO'));
        });`
  );
  
  // Write updated HTML
  fs.writeFileSync(solarGenHtmlPath, htmlContent);
  console.log('✅ Updated solar-generator.html successfully');
  
  // Now update the JavaScript
  console.log('Reading real_time_solar_counter.js...');
  let jsContent = fs.readFileSync(counterJsPath, 'utf8');
  
  // Find where we need to add the new calculation code
  const solarDisplayRegex = /\/\/ Format SOLAR value with 4 decimal places[\s\S]*?solarDisplay[\s\S]*?}\s*\)/;
  const solarDisplayMatch = jsContent.match(solarDisplayRegex);
  
  if (solarDisplayMatch) {
    // Replace with updated code that includes total solar calculation
    jsContent = jsContent.replace(
      solarDisplayRegex,
      `// Format SOLAR value with 4 decimal places in W.0001 format for instantaneous display
  const solarDisplay = document.getElementById('solar-display');
  if (solarDisplay) {
    // Format with exactly 4 decimal places (W.0001 format)
    const formattedSolar = totalSOLAR.toFixed(4);
    formatWithDigitAnimation(
      formattedSolar,
      solarDisplay
    );
  }
  
  // Calculate total SOLAR units generated since starting date
  const totalSolarDisplay = document.getElementById('total-solar-display');
  if (totalSolarDisplay) {
    // Calculate total SOLAR units (MkWh / kWhPerSOLAR)
    const totalSolarUnits = currentMkWh * 1000000 / kwhPerSOLAR;
    // Format with exactly 4 decimal places (W.0001 format)
    const formattedTotalSolar = totalSolarUnits.toFixed(4);
    formatWithDigitAnimation(
      formattedTotalSolar,
      totalSolarDisplay
    );
  }`
    );
    
    // Write updated JS
    fs.writeFileSync(counterJsPath, jsContent);
    console.log('✅ Updated real_time_solar_counter.js successfully');
    
    console.log('🔄 Refresh the page to see the changes in effect');
  } else {
    console.error('❌ Could not find the right section in real_time_solar_counter.js');
  }
} catch (error) {
  console.error('❌ Error updating files:', error);
}