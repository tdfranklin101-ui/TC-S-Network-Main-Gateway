/**
 * Page Includes Processor
 * 
 * This module handles the processing of include directives in HTML files
 * and provides Express middleware for dynamic includes.
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

/**
 * Express middleware to process includes in HTML responses
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
function createIncludesMiddleware(options = {}) {
  return function(req, res, next) {
    // Store the original send function
    const originalSend = res.send;
    
    // Override the send function
    res.send = function(body) {
      // Only process HTML responses
      if (typeof body === 'string' && 
          res.get('Content-Type') && 
          res.get('Content-Type').includes('text/html')) {
        // Process includes in the HTML content
        body = processIncludes(body);
      }
      
      // Call the original send function with the processed body
      return originalSend.call(this, body);
    };
    
    next();
  };
}

module.exports = { processIncludes, createIncludesMiddleware };