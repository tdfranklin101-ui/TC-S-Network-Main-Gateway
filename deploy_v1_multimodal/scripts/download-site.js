/**
 * Site Download Script
 * 
 * This script helps create a downloadable package of the site for offline viewing.
 * It copies all necessary HTML, CSS, JS, and image files to a 'download' directory
 * that can be zipped and downloaded.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define directories
const publicDir = path.join(process.cwd(), 'public');
const downloadDir = path.join(process.cwd(), 'download');

// Create download directory if it doesn't exist
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
  console.log('Created download directory');
}

// Create directories for assets
const directories = [
  'css',
  'js',
  'images',
  'fonts'
];

directories.forEach(dir => {
  const dirPath = path.join(downloadDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
    console.log(`Created directory: ${dir}`);
  }
});

// HTML files to copy
const htmlFiles = [
  'index.html',
  'prototype.html',
  'my-solar.html',
  'merch.html',
  'whitepapers.html',
  'declaration.html',
  'founder_note.html',
  'wallet.html'
];

// CSS files to copy
const cssFiles = [
  'css/common.css',
  'style.css'
];

// JS files to copy
const jsFiles = [
  'js/public-members-log.js',
  'solar_counter.js'
];

// Image files to copy
const imageFiles = [
  'branding_logo.png',
  'solar_background.png',
  'solar_coin.png',
  'solar_spinner.png',
  'solar_tshirt.png'
];

// Copy HTML files
htmlFiles.forEach(file => {
  const sourcePath = path.join(publicDir, file);
  const destPath = path.join(downloadDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied HTML file: ${file}`);
  } else {
    console.log(`Warning: HTML file ${file} not found`);
  }
});

// Copy CSS files
cssFiles.forEach(file => {
  const sourcePath = path.join(publicDir, file);
  const destDirPath = path.join(downloadDir, path.dirname(file));
  const destPath = path.join(downloadDir, file);
  
  // Ensure destination directory exists
  if (!fs.existsSync(destDirPath)) {
    fs.mkdirSync(destDirPath, { recursive: true });
  }
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied CSS file: ${file}`);
  } else {
    console.log(`Warning: CSS file ${file} not found`);
  }
});

// Copy JS files
jsFiles.forEach(file => {
  const sourcePath = path.join(publicDir, file);
  const destDirPath = path.join(downloadDir, path.dirname(file));
  const destPath = path.join(downloadDir, file);
  
  // Ensure destination directory exists
  if (!fs.existsSync(destDirPath)) {
    fs.mkdirSync(destDirPath, { recursive: true });
  }
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied JS file: ${file}`);
  } else {
    console.log(`Warning: JS file ${file} not found`);
  }
});

// Copy image files
imageFiles.forEach(file => {
  const sourcePath = path.join(publicDir, file);
  const destPath = path.join(downloadDir, 'images', path.basename(file));
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied image file: ${file}`);
  } else {
    console.log(`Warning: Image file ${file} not found`);
  }
});

// Create dummy data file for offline testing
const dummyData = {
  solarCounter: {
    timestamp: new Date().toISOString(),
    baseTimestamp: "2025-04-07T00:00:00.000Z",
    totalKwh: 12.87702875,
    totalDollars: 1030162.3,
    kwhPerSecond: 0.0005,
    dollarPerKwh: 0.12,
    elapsedSeconds: 9 * 24 * 60 * 60 // 9 days in seconds
  },
  leaderboard: [
    {
      id: 1,
      accountNumber: "SOL-0000-0001",
      displayName: "Terry D. Franklin",
      joinDate: "2025-04-07T00:00:00.000Z",
      totalSolar: 0.0247,
      totalKwh: 43.7190,
      totalDollarValue: 5.2463
    },
    {
      id: 2,
      accountNumber: "SOL-0000-0002",
      displayName: "Jane Smith",
      joinDate: "2025-04-10T00:00:00.000Z",
      totalSolar: 0.0082,
      totalKwh: 14.5734,
      totalDollarValue: 1.7488
    }
  ],
  memberCount: {
    count: 2
  }
};

// Write dummy data file
fs.writeFileSync(
  path.join(downloadDir, 'js', 'dummy-data.js'),
  `const DUMMY_DATA = ${JSON.stringify(dummyData, null, 2)};`
);
console.log('Created dummy data file for offline viewing');

// Create README file with instructions
const readmeContent = `# The Current-See Website - Offline Version

This is an offline version of The Current-See website for reference purposes.

## How to Use

1. Open index.html in your web browser to start browsing the site
2. Note that some dynamic features (like real-time solar counter updates) may not work fully offline
3. The wallet component is included in wallet.html for development reference

## Structure

- HTML files: Main pages of the site
- /css: Stylesheet files
- /js: JavaScript files
- /images: Image assets

## Notes

This offline version was generated on ${new Date().toISOString().split('T')[0]} for development and reference purposes.
`;

fs.writeFileSync(path.join(downloadDir, 'README.md'), readmeContent);
console.log('Created README file with instructions');

// Create a modified version of solar_counter.js for offline viewing
const originalCounterJS = fs.readFileSync(path.join(publicDir, 'solar_counter.js'), 'utf8');
const modifiedCounterJS = originalCounterJS.replace(
  'function fetchSolarClockData() {',
  `function fetchSolarClockData() {
  // In offline mode, use dummy data instead of making API call
  if (typeof DUMMY_DATA !== 'undefined') {
    console.log('Using offline dummy data for Solar Clock');
    return Promise.resolve(DUMMY_DATA.solarCounter);
  }
  
  // Original API call for online mode`
);

fs.writeFileSync(path.join(downloadDir, 'solar_counter.js'), modifiedCounterJS);
console.log('Created modified solar_counter.js for offline viewing');

// Create a modified version of public-members-log.js for offline viewing
if (fs.existsSync(path.join(publicDir, 'js', 'public-members-log.js'))) {
  const originalMembersJS = fs.readFileSync(path.join(publicDir, 'js', 'public-members-log.js'), 'utf8');
  const modifiedMembersJS = originalMembersJS.replace(
    'async fetchMembers() {',
    `async fetchMembers() {
    // In offline mode, use dummy data instead of making API call
    if (typeof DUMMY_DATA !== 'undefined') {
      console.log('Using offline dummy data for Members Log');
      return DUMMY_DATA.leaderboard;
    }
    
    // Original API call for online mode`
  );

  fs.writeFileSync(path.join(downloadDir, 'js', 'public-members-log.js'), modifiedMembersJS);
  console.log('Created modified public-members-log.js for offline viewing');
}

// Update HTML files to include the dummy data script
htmlFiles.forEach(file => {
  const filePath = path.join(downloadDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add the dummy data script before the first script tag
    if (!content.includes('dummy-data.js')) {
      content = content.replace(
        '<script',
        '<script src="/js/dummy-data.js"></script>\n    <script'
      );
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${file} to include dummy data script`);
    }
  }
});

console.log('\nSite files prepared for offline viewing in the "download" directory');
console.log('You can now zip this directory and download it for offline reference.');