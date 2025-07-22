const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create dist directory if it doesn't exist
const distDir = path.resolve(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create dist/public directory if it doesn't exist
const distPublicDir = path.resolve(__dirname, '../dist/public');
if (!fs.existsSync(distPublicDir)) {
  fs.mkdirSync(distPublicDir, { recursive: true });
}

// Copy solar_counter.js to dist/public
const sourceFile = path.resolve(__dirname, '../public/solar_counter.js');
const targetFile = path.resolve(__dirname, '../dist/public/solar_counter.js');

try {
  fs.copyFileSync(sourceFile, targetFile);
  console.log('Successfully copied solar_counter.js to dist/public');
} catch (err) {
  console.error('Error copying solar_counter.js:', err);
}