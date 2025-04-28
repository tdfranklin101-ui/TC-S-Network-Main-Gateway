
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
 * Create middleware for Express that processes HTML includes
 * @returns {Function} Express middleware function
 */
function createIncludesMiddleware() {
  return (req, res, next) => {
    // Only intercept HTML files
    if (!req.path.endsWith('.html') && req.path !== '/') {
      return next();
    }
    
    // Store original send function
    const originalSend = res.send;
    
    // Override send method to inject includes for HTML responses
    res.send = function(body) {
      // Only process HTML content
      if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
        body = processIncludes(body);
      }
      
      // Call original send with modified body
      return originalSend.call(this, body);
    };
    
    next();
  };
}

module.exports = { processIncludes, createIncludesMiddleware };
