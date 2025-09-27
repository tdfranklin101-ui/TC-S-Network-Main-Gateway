import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script is meant to be executed before deploying
console.log('=== Preparing deployment files ===');

// First run a normal build
try {
  console.log('Running build process...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build process failed:', error);
  process.exit(1);
}

// Then copy necessary files
try {
  console.log('Running deploy-helpers script to copy files...');
  execSync('node scripts/deploy-helpers.js', { stdio: 'inherit' });
  console.log('File copying completed successfully');
} catch (error) {
  console.error('Error copying files:', error);
  process.exit(1);
}

console.log('=== Deployment preparation completed ===');