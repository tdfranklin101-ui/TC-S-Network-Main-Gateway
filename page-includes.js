/**
 * Page Includes Processor
 * 
 * This module handles the processing of include directives in HTML files.
 */

const fs = require('fs');
const path = require('path');

/**
 * Process includes in HTML content
 * @param {string} content - The HTML content to process
 * @returns {string} - Processed HTML with includes resolved
 */
function processIncludes(content) {
  // Process header placeholder
  if (content.includes('<!-- HEADER_PLACEHOLDER -->')) {
    const headerPath = path.join(__dirname, 'public/includes/header.html');
    if (fs.existsSync(headerPath)) {
      const headerContent = fs.readFileSync(headerPath, 'utf8');
      content = content.replace('<!-- HEADER_PLACEHOLDER -->', headerContent);
    }
  }
  
  // Process footer placeholder
  if (content.includes('<!-- FOOTER_PLACEHOLDER -->')) {
    const footerPath = path.join(__dirname, 'public/includes/footer.html');
    if (fs.existsSync(footerPath)) {
      const footerContent = fs.readFileSync(footerPath, 'utf8');
      content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footerContent);
    }
  }
  
  // Process SEO meta tags placeholder
  if (content.includes('<!-- HEADER_SEO_PLACEHOLDER -->')) {
    const seoPath = path.join(__dirname, 'public/includes/seo-meta.html');
    if (fs.existsSync(seoPath)) {
      const seoContent = fs.readFileSync(seoPath, 'utf8');
      content = content.replace('<!-- HEADER_SEO_PLACEHOLDER -->', seoContent);
    }
  }
  
  return content;
}

module.exports = { processIncludes };
