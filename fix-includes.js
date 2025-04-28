/**
 * Fix Website Header and Footer
 * 
 * This script fixes the duplicate header and footer issue by:
 * 1. Using the clean header and footer templates
 * 2. Updating the page-includes.js to use these clean templates
 * 3. Reprocessing all HTML files with the correct includes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===========================================');
console.log('  THE CURRENT-SEE HEADER & FOOTER REPAIR  ');
console.log('===========================================');
console.log('Starting repair process...\n');

// Step 1: Replace the current header and footer with clean versions
console.log('STEP 1: Updating header and footer templates...');

// Replace header file
try {
  const headerClean = fs.readFileSync(path.join(__dirname, 'public/includes/header-clean.html'), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'public/includes/header.html'), headerClean, 'utf8');
  console.log('✓ Header file updated successfully');
} catch (error) {
  console.error('✗ Error updating header file:', error.message);
  process.exit(1);
}

// Replace footer file
try {
  const footerClean = fs.readFileSync(path.join(__dirname, 'public/includes/footer-clean.html'), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'public/includes/footer.html'), footerClean, 'utf8');
  console.log('✓ Footer file updated successfully\n');
} catch (error) {
  console.error('✗ Error updating footer file:', error.message);
  process.exit(1);
}

// Step 2: Create or update page-includes.js to handle includes cleanly
console.log('STEP 2: Updating page includes processor...');

const pageIncludesCode = `/**
 * Page Includes Processor
 * 
 * This module handles the processing of include directives in HTML files.
 */

const fs = require('fs');
const path = require('path');

/**
 * Process includes in HTML content
 * @param {string} content - The HTML content to process
 * @returns {string} - Processed HTML with includes resolved
 */
function processIncludes(content) {
  // Process header placeholder
  if (content.includes('<!-- HEADER_PLACEHOLDER -->')) {
    const headerPath = path.join(__dirname, 'public/includes/header.html');
    if (fs.existsSync(headerPath)) {
      const headerContent = fs.readFileSync(headerPath, 'utf8');
      content = content.replace('<!-- HEADER_PLACEHOLDER -->', headerContent);
    }
  }
  
  // Process footer placeholder
  if (content.includes('<!-- FOOTER_PLACEHOLDER -->')) {
    const footerPath = path.join(__dirname, 'public/includes/footer.html');
    if (fs.existsSync(footerPath)) {
      const footerContent = fs.readFileSync(footerPath, 'utf8');
      content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footerContent);
    }
  }
  
  // Process SEO meta tags placeholder
  if (content.includes('<!-- HEADER_SEO_PLACEHOLDER -->')) {
    const seoPath = path.join(__dirname, 'public/includes/seo-meta.html');
    if (fs.existsSync(seoPath)) {
      const seoContent = fs.readFileSync(seoPath, 'utf8');
      content = content.replace('<!-- HEADER_SEO_PLACEHOLDER -->', seoContent);
    }
  }
  
  return content;
}

module.exports = { processIncludes };
`;

try {
  fs.writeFileSync(path.join(__dirname, 'page-includes.js'), pageIncludesCode, 'utf8');
  console.log('✓ Page includes processor updated successfully\n');
} catch (error) {
  console.error('✗ Error updating page includes processor:', error.message);
  process.exit(1);
}

// Step 3: Fix template HTML files to use placeholders correctly
console.log('STEP 3: Checking and updating HTML template files...');

// Function to check and update index.html
function updateIndexHtml() {
  const indexPath = path.join(__dirname, 'public/index.html');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Check if the file has duplicate headers/footers
    const headerCount = (content.match(/site-header/g) || []).length;
    const footerCount = (content.match(/site-footer/g) || []).length;
    
    if (headerCount > 1 || footerCount > 1) {
      console.log(`Found ${headerCount} headers and ${footerCount} footers in index.html. Fixing...`);
      
      // Extract the main content (between header and footer)
      let mainContent = content;
      
      // Try to extract between markers if they exist
      if (content.includes('<main>') && content.includes('</main>')) {
        const mainStart = content.indexOf('<main>') + '<main>'.length;
        const mainEnd = content.lastIndexOf('</main>');
        if (mainStart < mainEnd) {
          mainContent = content.substring(mainStart, mainEnd);
        }
      }
      
      // Create a clean template with placeholders
      const cleanTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Current-See - Solar-Backed Global Economic System</title>
  
  <!-- Import SEO Meta Tags -->
  <!-- HEADER_SEO_PLACEHOLDER -->
  
  <!-- VR/XR Specific Discovery -->
  <link rel="alternate" type="application/json" href="/vr-discovery.json">
  <meta name="facebook-domain-verification" content="verification_token">
  <meta name="meta-vr-ready" content="true">
  
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/components/language-selector.css">
  <link rel="stylesheet" href="/css/solar-counter.css">
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="wrapper">
    <!-- HEADER_PLACEHOLDER -->

    <main>
      ${mainContent}
    </main>
    
    <!-- FOOTER_PLACEHOLDER -->
  </div>
  
  <!-- Page-specific scripts -->
  <script src="/js/real_time_solar_counter.js"></script>
  <script src="/js/join-form.js"></script>
</body>
</html>`;
      
      fs.writeFileSync(indexPath, cleanTemplate, 'utf8');
      console.log('✓ Updated index.html to use placeholders correctly');
    } else {
      console.log('✓ Index.html appears to be correctly structured');
    }
  } else {
    console.error('✗ Could not find index.html');
  }
}

try {
  updateIndexHtml();
  console.log('✓ HTML template files updated successfully\n');
} catch (error) {
  console.error('✗ Error updating HTML template files:', error.message);
}

// Step 4: Run the inject-includes.js script to process all HTML files
console.log('STEP 4: Reprocessing all HTML files with corrected includes...');
try {
  execSync('node inject-includes.js', { stdio: 'inherit' });
  console.log('✓ All HTML files processed successfully\n');
} catch (error) {
  console.error('✗ Error processing HTML files:', error.message);
  process.exit(1);
}

// Success
console.log('===========================================');
console.log('✓ Header and footer repair complete!');
console.log('All pages should now have correct navigation.');
console.log('===========================================');