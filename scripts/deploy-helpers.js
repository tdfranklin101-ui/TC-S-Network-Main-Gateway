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
    
    // Function to copy a file with logging
    function copyFileWithLogging(source, dest, fileName) {
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
        console.log(`✓ Copied ${fileName} successfully`);
      } else {
        console.error(`❌ Source file ${fileName} not found at ${source}`);
      }
    }
    
    // Function to copy directory recursively
    function copyDirectoryRecursive(sourceDir, destDir) {
      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // Read all files and directories in the source directory
      const items = fs.readdirSync(sourceDir, { withFileTypes: true });
      
      // Process each item
      for (const item of items) {
        const sourcePath = path.join(sourceDir, item.name);
        const destPath = path.join(destDir, item.name);
        
        if (item.isDirectory()) {
          // Recursively copy subdirectories
          copyDirectoryRecursive(sourcePath, destPath);
        } else {
          // Copy individual files
          copyFileWithLogging(sourcePath, destPath, `${path.relative(process.cwd(), sourcePath)}`);
        }
      }
    }
    
    // 1. Copy main JavaScript file
    copyFileWithLogging(
      path.resolve(__dirname, '../public/solar_counter.js'),
      path.resolve(__dirname, '../dist/public/solar_counter.js'),
      'solar_counter.js'
    );
    
    // 2. Copy style.css if it exists
    copyFileWithLogging(
      path.resolve(__dirname, '../public/style.css'),
      path.resolve(__dirname, '../dist/public/style.css'),
      'style.css'
    );
    
    // 3. Copy public/js directory with all files
    const publicJsDir = path.resolve(__dirname, '../public/js');
    const distJsDir = path.resolve(__dirname, '../dist/public/js');
    if (fs.existsSync(publicJsDir)) {
      copyDirectoryRecursive(publicJsDir, distJsDir);
      console.log('✓ Copied all files from public/js to dist/public/js');
    } else {
      console.error('❌ Source directory public/js not found');
    }
    
    // 4. Copy public/css directory with all files
    const publicCssDir = path.resolve(__dirname, '../public/css');
    const distCssDir = path.resolve(__dirname, '../dist/public/css');
    if (fs.existsSync(publicCssDir)) {
      copyDirectoryRecursive(publicCssDir, distCssDir);
      console.log('✓ Copied all files from public/css to dist/public/css');
    } else {
      console.error('❌ Source directory public/css not found');
    }
    
    // 5. Copy public/images directory if it exists
    const publicImagesDir = path.resolve(__dirname, '../public/images');
    const distImagesDir = path.resolve(__dirname, '../dist/public/images');
    if (fs.existsSync(publicImagesDir)) {
      copyDirectoryRecursive(publicImagesDir, distImagesDir);
      console.log('✓ Copied all files from public/images to dist/public/images');
    }
    
    // 6. Copy templates directory - critical for site functionality
    const publicTemplatesDir = path.resolve(__dirname, '../public/templates');
    const distTemplatesDir = path.resolve(__dirname, '../dist/public/templates');
    if (fs.existsSync(publicTemplatesDir)) {
      copyDirectoryRecursive(publicTemplatesDir, distTemplatesDir);
      console.log('✓ Copied all files from public/templates to dist/public/templates');
    } else {
      console.error('❌ Source directory public/templates not found');
    }
    
    // 7. Copy admin directory if it exists
    const publicAdminDir = path.resolve(__dirname, '../public/admin');
    const distAdminDir = path.resolve(__dirname, '../dist/public/admin');
    if (fs.existsSync(publicAdminDir)) {
      copyDirectoryRecursive(publicAdminDir, distAdminDir);
      console.log('✓ Copied all files from public/admin to dist/public/admin');
    }
    
    // 8. Copy all HTML files from the public directory
    const publicDir = path.resolve(__dirname, '../public');
    if (fs.existsSync(publicDir)) {
      const htmlFiles = fs.readdirSync(publicDir)
        .filter(file => file.endsWith('.html') && fs.statSync(path.join(publicDir, file)).isFile());
      
      for (const htmlFile of htmlFiles) {
        const sourcePath = path.join(publicDir, htmlFile);
        const destPath = path.join(distPublicDir, htmlFile);
        copyFileWithLogging(sourcePath, destPath, htmlFile);
      }
      console.log('✓ Copied all HTML files from public directory');
    }
    
    console.log('Deployment file preparation complete');
  } catch (error) {
    console.error('Error during deployment file preparation:', error);
  }
}

// Run the function
copyFilesToDist();