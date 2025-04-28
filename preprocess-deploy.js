/**
 * Preprocess Deployment
 * 
 * This script performs all necessary preprocessing steps before deployment:
 * 1. Updates member distributions for the current date
 * 2. Injects header and footer includes into all HTML files
 * 3. Checks for any missing critical files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Banner
console.log('=======================================');
console.log('    THE CURRENT-SEE DEPLOYMENT PREP    ');
console.log('=======================================');
console.log('Running pre-deployment preparations...\n');

// Step 1: Update member distributions
console.log('STEP 1: Updating member distributions...');
try {
  execSync('node update-member-distributions.js', { stdio: 'inherit' });
  console.log('✓ Member distributions updated successfully\n');
} catch (error) {
  console.error('✗ Failed to update member distributions:', error.message);
  process.exit(1);
}

// Step 2: Inject header and footer components
console.log('STEP 2: Injecting header and footer components...');
try {
  execSync('node inject-includes.js', { stdio: 'inherit' });
  console.log('✓ Header and footer components injected successfully\n');
} catch (error) {
  console.error('✗ Failed to inject components:', error.message);
  process.exit(1);
}

// Step 3: Check for missing critical files
console.log('STEP 3: Checking for critical files...');
const criticalFiles = [
  'public/index.html',
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
console.log('You can now deploy your application.');
console.log('=======================================');