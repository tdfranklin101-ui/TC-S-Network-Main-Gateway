/**
 * Rebuild Index.html
 * 
 * This script completely rebuilds the index.html file with a clean structure
 * and proper header/footer placeholders.
 */

const fs = require('fs');
const path = require('path');

console.log('Rebuilding index.html...');

// Create a clean template
const cleanTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Current-See - Solar-Backed Global Economic System</title>
  
  <!-- SEO Meta Tags -->
  <meta name="description" content="The Current-See: A revolutionary solar-backed global economic system empowering humanity through equitable energy distribution.">
  <meta name="keywords" content="solar currency, economic system, renewable energy, solar power, global economy">
  <meta name="author" content="The Current-See PBC, Inc.">
  <meta property="og:title" content="The Current-See - Solar-Backed Global Economic System">
  <meta property="og:description" content="Empowering a Planet of Billionaires with Solar Currency">
  <meta property="og:image" content="/img/social-preview.jpg">
  <meta property="og:url" content="https://thecurrentsee.org">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  
  <!-- Favicon -->
  <link rel="icon" href="/img/favicon.ico">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/components/language-selector.css">
  <link rel="stylesheet" href="/css/solar-counter.css">
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="wrapper">
    <!-- HEADER_PLACEHOLDER -->

    <main>
      <!-- Hero Section with Solar Ray Watermark -->
      <section class="hero-solar">
        <div class="container">
          <div class="solar-counter-header">
            <img src="/img/solar-conversion-icon.svg" alt="Solar Conversion" class="solar-app-icon" onerror="this.src='/img/solar-icon-default.svg'; this.onerror=null;">
            <h1>Welcome to The Current-See</h1>
          </div>
          <div class="hero-container">
            <div class="hero-text">
              <h2>Empowering a Planet of Billionaires with Solar Currency</h2>
              <div class="hero-links">
                <a href="/wallet-ai-features.html" class="home-link">My Solar</a>
                <a href="/declaration.html" class="home-link">Solar Declaration</a>
                <a href="/founder_note.html" class="home-link">Founder's Note</a>
                <a href="/whitepapers.html" class="home-link">White Papers</a>
                <a href="/business_plan.html" class="home-link">Business Plan</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Join Section -->
      <section id="join-section" class="join-section">
        <div class="container">
          <h2 class="join-header">Join Now & Start Getting Solars</h2>
          <div class="join-form-container">
            <form id="join-form" class="join-form">
              <div class="form-group">
                <label for="name">Your Name</label>
                <input type="text" id="name" name="name" required>
              </div>
              <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required>
              </div>
              <button type="submit" class="submit-button">Join the Movement</button>
            </form>
          </div>
        </div>
      </section>

      <!-- Solar Generator Section -->
      <section class="solar-generator">
        <div class="container">
          <h2>Solar Generator</h2>
          <div class="solar-counter-container">
            <div class="counter-box">
              <h3>Total Energy Generated</h3>
              <div id="energy-counter" class="counter">0.000000 MkWh</div>
              <div class="counter-description">Since April 7, 2025</div>
            </div>
            <div class="counter-divider"></div>
            <div class="counter-box">
              <h3>Equivalent Value</h3>
              <div id="value-counter" class="counter">$0.00</div>
              <div class="counter-description">At $136,000 per SOLAR</div>
            </div>
          </div>
          <div class="counter-info">
            <p>The Current-See converts solar energy into global economic value, distributed daily to all members. Each SOLAR represents 4,913 kWh of clean energy.</p>
          </div>
        </div>
      </section>
    </main>
    
    <!-- FOOTER_PLACEHOLDER -->
  </div>
  
  <!-- Page-specific scripts -->
  <script src="/js/real_time_solar_counter.js"></script>
  <script src="/js/join-form.js"></script>
</body>
</html>`;

try {
  // Write the clean template to index.html
  fs.writeFileSync(path.join(__dirname, 'public/index.html'), cleanTemplate, 'utf8');
  console.log('✓ Successfully rebuilt index.html with clean template');
} catch (error) {
  console.error('✗ Error rebuilding index.html:', error.message);
  process.exit(1);
}

// Process the includes
try {
  const { processIncludes } = require('./page-includes');
  const processedContent = processIncludes(cleanTemplate);
  fs.writeFileSync(path.join(__dirname, 'public/index.html'), processedContent, 'utf8');
  console.log('✓ Successfully processed includes in index.html');
} catch (error) {
  console.error('✗ Error processing includes:', error.message);
  process.exit(1);
}

console.log('Index.html rebuild complete!');