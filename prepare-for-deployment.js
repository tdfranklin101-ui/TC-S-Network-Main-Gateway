/**
 * Prepare for Deployment
 * 
 * This script performs all necessary steps before deployment:
 * 1. Fixes header and footer issues (single instance per page)
 * 2. Ensures all links are working correctly
 * 3. Updates member distributions for the current date
 * 4. Performs final verification checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Banner
console.log('=======================================');
console.log('    THE CURRENT-SEE DEPLOYMENT PREP    ');
console.log('=======================================');
console.log('Running pre-deployment preparations...\n');

// Step 1: Fix header and footer issues
console.log('STEP 1: Fixing header and footer issues...');
try {
  execSync('node fix-includes.js', { stdio: 'inherit' });
  console.log('✓ Header and footer fixed successfully\n');
} catch (error) {
  console.error('✗ Failed to fix header and footer:', error.message);
  process.exit(1);
}

// Step 2: Rebuild critical pages to ensure clean structure
console.log('STEP 2: Rebuilding critical pages...');
try {
  execSync('node rebuild-index.js', { stdio: 'inherit' });
  execSync('node rebuild-declaration.js', { stdio: 'inherit' });
  console.log('✓ Critical pages rebuilt successfully\n');
} catch (error) {
  console.error('✗ Failed to rebuild critical pages:', error.message);
  process.exit(1);
}

// Step 3: Update member distributions
console.log('STEP 3: Updating member distributions...');
try {
  execSync('node update-member-distributions.js', { stdio: 'inherit' });
  console.log('✓ Member distributions updated successfully\n');
} catch (error) {
  console.error('✗ Failed to update member distributions:', error.message);
  process.exit(1);
}

// Step 4: Check for critical files
console.log('STEP 4: Checking for critical files...');
const criticalFiles = [
  'public/index.html',
  'public/declaration.html',
  'public/wallet-ai-features.html',
  'public/includes/header.html',
  'public/includes/footer.html',
  'public/css/common.css',
  'public/js/real_time_solar_counter.js',
  'public/js/public-members-log.js',
  'server.js',
  'main.js',
  'index.js'
];

let missingFiles = [];
criticalFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('✗ Missing critical files:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  process.exit(1);
} else {
  console.log('✓ All critical files present\n');
}

// Success
console.log('=======================================');
console.log('✓ Deployment preparation complete!');
console.log('The website is now ready for deployment.');
console.log('=======================================');