/**
 * Update All Deployment Files
 * 
 * This script updates the solar-generator.html and real_time_solar_counter.js files
 * in all deployment directories and the production public directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define all possible locations
const directories = [
  './public',
  './pure-deploy/public',
  './minimal-deploy/public',
  './simple-deploy/public',
  './full-deployment/public'
];

// HTML content for the counter-container section
const newCounterContainerHTML = `<div class="counter-container">
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
            </div>`;

// CSS content for the new counter styles
const newCSSStyles = `
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

// JavaScript content for the total solar calculation
const newJavaScriptCode = `// Format SOLAR value with 4 decimal places in W.0001 format for instantaneous display
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
  }`;

// DOMContentLoaded script content
const newDOMContentLoadedScript = `document.addEventListener('DOMContentLoaded', function() {
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
        });`;

// Process each directory
for (const dir of directories) {
  try {
    const solarGenHtmlPath = path.join(dir, 'solar-generator.html');
    const counterJsPath = path.join(dir, 'js', 'real_time_solar_counter.js');
    
    // Check if solar-generator.html exists
    if (fs.existsSync(solarGenHtmlPath)) {
      console.log(`Processing ${solarGenHtmlPath}...`);
      let htmlContent = fs.readFileSync(solarGenHtmlPath, 'utf8');
      
      // Update counter container section
      const counterContainerRegex = /<div class="counter-container">[\s\S]*?<div class="counter solar-conversion-counter">[\s\S]*?<\/div>/g;
      if (htmlContent.match(counterContainerRegex)) {
        htmlContent = htmlContent.replace(counterContainerRegex, newCounterContainerHTML);
        console.log(`  - Updated counter container section`);
      } else {
        console.log(`  - Could not find counter container section in ${solarGenHtmlPath}`);
      }
      
      // Add CSS styles
      const solarConversionCounterRegex = /\.solar-conversion-counter\s*{[^}]*}/;
      if (htmlContent.match(solarConversionCounterRegex)) {
        htmlContent = htmlContent.replace(solarConversionCounterRegex, newCSSStyles);
        console.log(`  - Updated CSS styles`);
      } else {
        // Try to find the style tag and add it there
        const styleTagRegex = /<style>[\s\S]*?<\/style>/;
        if (htmlContent.match(styleTagRegex)) {
          htmlContent = htmlContent.replace(styleTagRegex, (match) => {
            return match.replace('</style>', `${newCSSStyles}\n    </style>`);
          });
          console.log(`  - Added CSS styles to style tag`);
        } else {
          console.log(`  - Could not find style tag in ${solarGenHtmlPath}`);
        }
      }
      
      // Update DOMContentLoaded script
      const domContentLoadedRegex = /document\.addEventListener\('DOMContentLoaded',[\s\S]*?}\);/;
      if (htmlContent.match(domContentLoadedRegex)) {
        htmlContent = htmlContent.replace(domContentLoadedRegex, newDOMContentLoadedScript);
        console.log(`  - Updated DOMContentLoaded script`);
      } else {
        console.log(`  - Could not find DOMContentLoaded script in ${solarGenHtmlPath}`);
      }
      
      // Write updated HTML
      fs.writeFileSync(solarGenHtmlPath, htmlContent);
      console.log(`✅ Updated ${solarGenHtmlPath}`);
    } else {
      console.log(`⚠️ File ${solarGenHtmlPath} not found, skipping...`);
    }
    
    // Check if real_time_solar_counter.js exists
    if (fs.existsSync(counterJsPath)) {
      console.log(`Processing ${counterJsPath}...`);
      let jsContent = fs.readFileSync(counterJsPath, 'utf8');
      
      // Find and replace the solar display code
      const solarDisplayRegex = /\/\/ Format SOLAR value[\s\S]*?solarDisplay[\s\S]*?}\s*\)/;
      if (jsContent.match(solarDisplayRegex)) {
        jsContent = jsContent.replace(solarDisplayRegex, newJavaScriptCode);
        console.log(`  - Updated solar display code`);
      } else {
        console.log(`  - Could not find solar display code in ${counterJsPath}`);
      }
      
      // Write updated JS
      fs.writeFileSync(counterJsPath, jsContent);
      console.log(`✅ Updated ${counterJsPath}`);
    } else {
      console.log(`⚠️ File ${counterJsPath} not found, skipping...`);
    }
  } catch (error) {
    console.error(`❌ Error processing files in ${dir}:`, error);
  }
}

// Restart the server
console.log('\nRestarting server...');
try {
  execSync('pkill -f "node main.js" || true');
  execSync('nohup node main.js > server.log 2>&1 &');
  console.log('✅ Server restarted');
} catch (error) {
  console.error('❌ Error restarting server:', error);
}

console.log('\n🔄 Refresh the page to see the changes in effect');