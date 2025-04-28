/**
 * Inject Header and Footer
 * 
 * This script injects the header and footer components directly into all HTML files.
 * This ensures that the components are properly displayed in the deployed version.
 */

const fs = require('fs');
const path = require('path');
const { processIncludes } = require('./page-includes');

// Function to process a single file
function processFile(filePath) {
  console.log(`Processing ${filePath}...`);
  try {
    // Read the file contents
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Process the includes
    const processed = processIncludes(content);
    
    // Write back to the file
    fs.writeFileSync(filePath, processed, 'utf8');
    
    console.log(`✓ Successfully processed ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Process all HTML files in the public folder
function processAllHtmlFiles() {
  const publicFolder = path.join(__dirname, 'public');
  let processedCount = 0;
  let errorCount = 0;
  
  function processFolder(folderPath) {
    const items = fs.readdirSync(folderPath);
    
    items.forEach(item => {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Recursively process subfolders
        processFolder(itemPath);
      } else if (stats.isFile() && item.endsWith('.html')) {
        // Process HTML files
        if (processFile(itemPath)) {
          processedCount++;
        } else {
          errorCount++;
        }
      }
    });
  }
  
  console.log('Starting HTML processing...');
  processFolder(publicFolder);
  console.log(`Processing complete: ${processedCount} files processed, ${errorCount} errors.`);
  
  return { processed: processedCount, errors: errorCount };
}

// Run the processing
const result = processAllHtmlFiles();
console.log(`Summary: ${result.processed} files processed with ${result.errors} errors.`);