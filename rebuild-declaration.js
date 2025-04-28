/**
 * Rebuild declaration.html
 * 
 * This script rebuilds the declaration.html file with clean structure
 * and proper header/footer placeholders.
 */

const fs = require('fs');
const path = require('path');

console.log('Rebuilding declaration.html...');

// Create a clean template
const cleanTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solar Declaration - The Current-See</title>
  
  <!-- SEO Meta Tags -->
  <meta name="description" content="The Current-See Solar Declaration: Our founding principles and vision for a solar-backed global economic system.">
  <meta name="keywords" content="solar declaration, solar currency, economic system, renewable energy, solar power">
  <meta name="author" content="The Current-See PBC, Inc.">
  <meta property="og:title" content="Solar Declaration - The Current-See">
  <meta property="og:description" content="Our founding principles for a solar-backed global economic system">
  <meta property="og:image" content="/img/social-preview.jpg">
  <meta property="og:url" content="https://thecurrentsee.org/declaration.html">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  
  <!-- Favicon -->
  <link rel="icon" href="/img/favicon.ico">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/components/language-selector.css">
  <link rel="stylesheet" href="/css/declaration.css">
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="wrapper">
    <!-- HEADER_PLACEHOLDER -->

    <main>
      <!-- Solar Declaration Section -->
      <section class="declaration-section">
        <div class="container">
          <div class="declaration-header">
            <h1>The Solar Declaration</h1>
            <div class="declaration-date">Established April 7, 2025</div>
          </div>
          
          <div class="declaration-content">
            <p class="declaration-intro">We, the founding members of The Current-See, hereby declare the following principles as the foundation of our solar-backed economic system:</p>
            
            <div class="declaration-points">
              <div class="declaration-point">
                <h3>1. Energy as Currency</h3>
                <p>We declare that solar energy production shall serve as the fundamental basis for our economic system, with each unit of SOLAR representing a specific amount of clean energy generation.</p>
              </div>
              
              <div class="declaration-point">
                <h3>2. Equitable Distribution</h3>
                <p>We commit to the principle that solar energy value shall be distributed fairly among all members of our global community, with transparent and consistent distribution mechanisms.</p>
              </div>
              
              <div class="declaration-point">
                <h3>3. Environmental Stewardship</h3>
                <p>We affirm our dedication to environmental sustainability, with our economic system designed to accelerate the transition to renewable energy and reduce dependency on fossil fuels.</p>
              </div>
              
              <div class="declaration-point">
                <h3>4. Technological Innovation</h3>
                <p>We pledge to continuously advance the technologies that enable our solar-backed system, making them more efficient, accessible, and beneficial for all participants.</p>
              </div>
              
              <div class="declaration-point">
                <h3>5. Global Inclusion</h3>
                <p>We commit to building an inclusive system that welcomes participation from people of all nations, backgrounds, and circumstances, with special focus on providing economic opportunities to underserved communities.</p>
              </div>
              
              <div class="declaration-point">
                <h3>6. Transparency and Trust</h3>
                <p>We will maintain the highest standards of transparency in our operations, with publicly verifiable mechanisms for tracking solar production, value calculation, and distribution.</p>
              </div>
              
              <div class="declaration-point">
                <h3>7. Education and Empowerment</h3>
                <p>We dedicate ourselves to educating the global community about solar energy, sustainable economics, and personal financial empowerment through our platform.</p>
              </div>
            </div>
            
            <div class="declaration-conclusion">
              <p>With these principles as our foundation, we embark on the mission to create a more equitable, sustainable, and prosperous future for humanity through The Current-See solar-backed economic system.</p>
              <p class="declaration-signature">— The Founding Members</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    
    <!-- FOOTER_PLACEHOLDER -->
  </div>
</body>
</html>`;

try {
  // Write the clean template to declaration.html
  fs.writeFileSync(path.join(__dirname, 'public/declaration.html'), cleanTemplate, 'utf8');
  console.log('✓ Successfully rebuilt declaration.html with clean template');
} catch (error) {
  console.error('✗ Error rebuilding declaration.html:', error.message);
  process.exit(1);
}

// Process the includes
try {
  const { processIncludes } = require('./page-includes');
  const processedContent = processIncludes(cleanTemplate);
  fs.writeFileSync(path.join(__dirname, 'public/declaration.html'), processedContent, 'utf8');
  console.log('✓ Successfully processed includes in declaration.html');
} catch (error) {
  console.error('✗ Error processing includes:', error.message);
  process.exit(1);
}

console.log('declaration.html rebuild complete!');