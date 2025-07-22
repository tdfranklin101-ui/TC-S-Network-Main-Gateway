/**
 * The Current-See Version Update Utility
 * 
 * This script updates the version information in pure-deployment.js
 * Usage: node update-version.js [version] [build]
 * Example: node update-version.js 1.2.1 2025.04.25
 */

const fs = require('fs');
const path = require('path');

// Main deployment file path
const deploymentFile = path.join(__dirname, 'pure-deployment.js');

// Get arguments
const newVersion = process.argv[2];
const newBuild = process.argv[3] || new Date().toISOString().split('T')[0].replace(/-/g, '.');

// Validate arguments
if (!newVersion) {
  console.error('Error: Version number is required.');
  console.log('Usage: node update-version.js [version] [build]');
  console.log('Example: node update-version.js 1.2.1 2025.04.25');
  process.exit(1);
}

// Read deployment file
fs.readFile(deploymentFile, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading deployment file:', err.message);
    process.exit(1);
  }

  // Find version information section
  const versionRegex = /(const APP_VERSION = \{[\s\S]*?version: ['"])(.*?)(['"][\s\S]*?build: ['"])(.*?)(['"][\s\S]*?\};)/;
  const match = data.match(versionRegex);
  
  if (!match) {
    console.error('Error: Could not find version information in the file.');
    process.exit(1);
  }

  // Replace version and build
  const updatedContent = data.replace(
    versionRegex, 
    `$1${newVersion}$3${newBuild}$5`
  );

  // Write updated content back to file
  fs.writeFile(deploymentFile, updatedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error writing deployment file:', err.message);
      process.exit(1);
    }
    
    console.log(`✓ Version updated successfully to ${newVersion} (Build ${newBuild})`);
    console.log('📋 Changelog entry suggestion:');
    console.log('\nv' + newVersion + ' (' + newBuild + '):');
    console.log('- [Add your changes here]');
    console.log('- [Add your changes here]');
    console.log('- [Add your changes here]');
  });
});