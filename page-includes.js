/**
 * Page Includes Processor
 * 
 * This module handles the processing of include directives in HTML files.
 * Support both comment-based placeholders and div container IDs.
 */

const fs = require('fs');
const path = require('path');

/**
 * Process includes in HTML content
 * @param {string} content - The HTML content to process
 * @returns {string} - Processed HTML with includes resolved
 */
function processIncludes(content) {
  // Get header content
  let headerContent = '';
  const headerPath = path.join(__dirname, 'public/includes/header.html');
  if (fs.existsSync(headerPath)) {
    headerContent = fs.readFileSync(headerPath, 'utf8');
  }

  // Get footer content
  let footerContent = '';
  const footerPath = path.join(__dirname, 'public/includes/footer.html');
  if (fs.existsSync(footerPath)) {
    footerContent = fs.readFileSync(footerPath, 'utf8');
  }

  // Get SEO content
  let seoContent = '';
  const seoPath = path.join(__dirname, 'public/includes/seo-meta.html');
  if (fs.existsSync(seoPath)) {
    seoContent = fs.readFileSync(seoPath, 'utf8');
  }
  
  // Process header placeholder (comment-based)
  if (content.includes('<!-- HEADER_PLACEHOLDER -->')) {
    content = content.replace('<!-- HEADER_PLACEHOLDER -->', headerContent);
  }
  
  // Process footer placeholder (comment-based)
  if (content.includes('<!-- FOOTER_PLACEHOLDER -->')) {
    content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footerContent);
  }
  
  // Process SEO meta tags placeholder
  if (content.includes('<!-- HEADER_SEO_PLACEHOLDER -->')) {
    content = content.replace('<!-- HEADER_SEO_PLACEHOLDER -->', seoContent);
  }

  // Process header container (div-based)
  if (content.includes('<div id="header-container"></div>')) {
    content = content.replace('<div id="header-container"></div>', `<div id="header-container">${headerContent}</div>`);
  }
  
  // Process footer container (div-based)
  if (content.includes('<div id="footer-container"></div>')) {
    content = content.replace('<div id="footer-container"></div>', `<div id="footer-container">${footerContent}</div>`);
  }
  
  return content;
}

/**
 * Create Express middleware for processing includes
 */
function createIncludesMiddleware() {
  return function(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(body) {
      if (typeof body === 'string' && 
         (body.includes('<!-- HEADER_PLACEHOLDER -->') || 
          body.includes('<!-- FOOTER_PLACEHOLDER -->') ||
          body.includes('<!-- HEADER_SEO_PLACEHOLDER -->') ||
          body.includes('<div id="header-container"></div>') ||
          body.includes('<div id="footer-container"></div>'))) {
        body = processIncludes(body);
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

module.exports = { processIncludes, createIncludesMiddleware };
