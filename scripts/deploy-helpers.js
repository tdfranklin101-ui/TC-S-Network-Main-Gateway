import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script is meant to be executed before deploying
// It ensures that critical files like solar_counter.js are available in the production environment

function copyFilesToDist() {
  console.log('Copying files for deployment...');
  
  try {
    // Ensure dist directory exists
    const distDir = path.resolve(__dirname, '../dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Ensure dist/public directory exists
    const distPublicDir = path.resolve(__dirname, '../dist/public');
    if (!fs.existsSync(distPublicDir)) {
      fs.mkdirSync(distPublicDir, { recursive: true });
    }
    
    // Copy solar_counter.js
    const solarCounterSourcePath = path.resolve(__dirname, '../public/solar_counter.js');
    const solarCounterDestPath = path.resolve(__dirname, '../dist/public/solar_counter.js');
    
    if (fs.existsSync(solarCounterSourcePath)) {
      fs.copyFileSync(solarCounterSourcePath, solarCounterDestPath);
      console.log('✓ Copied solar_counter.js to dist/public');
    } else {
      console.error('❌ Source file solar_counter.js not found in public directory');
    }
    
    console.log('Deployment file preparation complete');
  } catch (error) {
    console.error('Error during deployment file preparation:', error);
  }
}

// Run the function
copyFilesToDist();