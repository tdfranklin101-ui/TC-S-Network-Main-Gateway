/**
 * The Current-See Header/Footer Fix Script
 * 
 * This script will automatically add the header and footer placeholders
 * to all HTML files that are missing them.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(PUBLIC_DIR, 'includes');

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Get all HTML files
function getAllHtmlFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat && stat.isDirectory() && !fullPath.includes('node_modules')) {
      // Recurse into subdirectories, but skip node_modules
      results.push(...getAllHtmlFiles(fullPath));
    } else if (fullPath.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  
  return results;
}

// Process HTML files to add header/footer placeholders
function addHeaderFooterPlaceholders() {
  const htmlFiles = getAllHtmlFiles(PUBLIC_DIR);
  log(`Found ${htmlFiles.length} HTML files to process`);
  
  let updatedCount = 0;
  
  htmlFiles.forEach(filePath => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Check if file has <head> but no HEADER_PLACEHOLDER
      if (content.includes('<head>') && !content.includes('<!-- HEADER_PLACEHOLDER -->')) {
        // Add header placeholder after any meta tags but before other content
        let headEndPos = content.indexOf('</head>');
        if (headEndPos !== -1) {
          // Find a good position to insert the header placeholder
          // Typically after meta tags, title, etc.
          const metaTagEnd = Math.max(
            content.lastIndexOf('</title>'),
            content.lastIndexOf('"/>'),
            content.lastIndexOf('">'),
          );
          
          const insertPos = metaTagEnd !== -1 ? metaTagEnd + 8 : content.indexOf('<head>') + 6;
          
          content = content.slice(0, insertPos) + 
                   '\n  <!-- HEADER_PLACEHOLDER -->\n  ' + 
                   content.slice(insertPos);
          modified = true;
        }
      }
      
      // Check if file has </body> but no FOOTER_PLACEHOLDER
      if (content.includes('</body>') && !content.includes('<!-- FOOTER_PLACEHOLDER -->')) {
        // Add footer placeholder before </body> tag
        const bodyEndPos = content.lastIndexOf('</body>');
        if (bodyEndPos !== -1) {
          content = content.slice(0, bodyEndPos) + 
                   '\n<!-- FOOTER_PLACEHOLDER -->\n\n' + 
                   content.slice(bodyEndPos);
          modified = true;
        }
      }
      
      // Save changes if modified
      if (modified) {
        fs.writeFileSync(filePath, content);
        updatedCount++;
        log(`Updated: ${path.relative(__dirname, filePath)}`);
      }
    } catch (error) {
      log(`Error processing ${filePath}: ${error.message}`, true);
    }
  });
  
  log(`Updated ${updatedCount} out of ${htmlFiles.length} HTML files`);
  
  return updatedCount;
}

// Process includes in HTML content
function processIncludes(html) {
  try {
    const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
    const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
    
    // Replace placeholders with actual content
    html = html.replace('<!-- HEADER_PLACEHOLDER -->', header);
    html = html.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    
    return html;
  } catch (error) {
    log(`Error processing includes: ${error.message}`, true);
    return html;
  }
}

// Main function
function main() {
  log('Starting header/footer fix script');
  
  // Verify that includes directory and files exist
  if (!fs.existsSync(INCLUDES_DIR)) {
    log(`Includes directory not found at ${INCLUDES_DIR}`, true);
    return;
  }
  
  const headerPath = path.join(INCLUDES_DIR, 'header.html');
  const footerPath = path.join(INCLUDES_DIR, 'footer.html');
  
  if (!fs.existsSync(headerPath)) {
    log(`Header file not found at ${headerPath}`, true);
    return;
  }
  
  if (!fs.existsSync(footerPath)) {
    log(`Footer file not found at ${footerPath}`, true);
    return;
  }
  
  log('Found header and footer files');
  
  // Add placeholders to HTML files
  const updatedCount = addHeaderFooterPlaceholders();
  
  if (updatedCount > 0) {
    log('Successfully updated HTML files with header/footer placeholders');
  } else {
    log('No HTML files needed updating');
  }
  
  log('Header/footer fix script completed');
}

// Run main function
main();