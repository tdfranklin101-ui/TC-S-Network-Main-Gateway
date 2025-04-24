/**
 * The Current-See Feature Toggle Utility
 * 
 * This script enables or disables specific features in the application.
 * Usage: node set-feature.js <feature> <true|false>
 * Example: node set-feature.js openai false
 */

const fs = require('fs');
const path = require('path');

// Available features
const AVAILABLE_FEATURES = [
  'solarClock',
  'database',
  'openai',
  'distributionSystem'
];

// Parse command line arguments
const featureName = process.argv[2];
const featureValue = process.argv[3];

// Validate arguments
if (!featureName || !featureValue) {
  console.error('Error: Missing required arguments');
  console.log('\nUsage: node set-feature.js <feature> <true|false>');
  console.log('Example: node set-feature.js openai false\n');
  console.log('Available features:');
  AVAILABLE_FEATURES.forEach(feature => console.log(`- ${feature}`));
  process.exit(1);
}

// Validate feature name
if (!AVAILABLE_FEATURES.includes(featureName)) {
  console.error(`Error: Unknown feature "${featureName}"`);
  console.log('\nAvailable features:');
  AVAILABLE_FEATURES.forEach(feature => console.log(`- ${feature}`));
  process.exit(1);
}

// Validate feature value
const boolValue = featureValue.toLowerCase();
if (boolValue !== 'true' && boolValue !== 'false') {
  console.error('Error: Feature value must be either "true" or "false"');
  process.exit(1);
}

// Convert string to boolean
const featureEnabled = boolValue === 'true';

// Path to features.json
const featuresPath = path.join(__dirname, 'features.json');

// Load existing features or create default
let features = {};
if (fs.existsSync(featuresPath)) {
  try {
    features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
  } catch (err) {
    console.error(`Error reading features.json: ${err.message}`);
    process.exit(1);
  }
} else {
  // Create default features
  AVAILABLE_FEATURES.forEach(feature => {
    features[feature] = true;
  });
}

// Update feature
const oldValue = features[featureName];
features[featureName] = featureEnabled;

// Write updated features
try {
  fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2), 'utf8');
  console.log(`Feature "${featureName}" ${featureEnabled ? 'enabled' : 'disabled'} (was ${oldValue ? 'enabled' : 'disabled'})`);
} catch (err) {
  console.error(`Error writing features.json: ${err.message}`);
  process.exit(1);
}

// Display all features
console.log('\nCurrent feature status:');
Object.entries(features).forEach(([key, value]) => {
  console.log(`- ${key}: ${value ? 'enabled' : 'disabled'}`);
});