/**
 * The Current-See Feature Flag Utility
 * 
 * This script enables or disables features in the APP_VERSION object in pure-deployment.js
 * Usage: node set-feature.js [feature] [true|false]
 * Example: node set-feature.js openai false
 */

const fs = require('fs');
const path = require('path');

// Main deployment file path
const deploymentFile = path.join(__dirname, 'pure-deployment.js');

// Get arguments
const feature = process.argv[2];
const enabled = process.argv[3]?.toLowerCase();

// Validate arguments
if (!feature || (enabled !== 'true' && enabled !== 'false')) {
  console.error('Error: Feature name and enabled status (true or false) are required.');
  console.log('Usage: node set-feature.js [feature] [true|false]');
  console.log('Example: node set-feature.js openai false');
  console.log('\nAvailable features:');
  console.log('- solarClock');
  console.log('- database');
  console.log('- openai');
  console.log('- distributionSystem');
  process.exit(1);
}

// Read deployment file
fs.readFile(deploymentFile, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading deployment file:', err.message);
    process.exit(1);
  }

  // Find feature in APP_VERSION
  const featureRegex = new RegExp(`(features: {[\\s\\S]*?${feature}: )(true|false)([\\s\\S]*?})`);
  const match = data.match(featureRegex);
  
  if (!match) {
    console.error(`Error: Could not find feature "${feature}" in the file.`);
    process.exit(1);
  }

  // Replace feature flag
  const updatedContent = data.replace(
    featureRegex, 
    `$1${enabled}$3`
  );

  // Write updated content back to file
  fs.writeFile(deploymentFile, updatedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error writing deployment file:', err.message);
      process.exit(1);
    }
    
    console.log(`✓ Feature "${feature}" set to "${enabled}" successfully`);
    
    // Additional instructions
    if (feature === 'openai') {
      if (enabled === 'false') {
        console.log('\n🔧 Remember to also run: node toggle-openai.js disable');
      } else {
        console.log('\n🔧 Remember to also run: node toggle-openai.js enable');
      }
    }
  });
});