/**
 * Page Include System for The Current-See Website
 * 
 * This module provides functions to include common header and footer elements
 * in all HTML pages, ensuring consistent navigation and appearance across the site.
 */

const fs = require('fs');
const path = require('path');

// Cache for frequently accessed includes
const includesCache = {};

/**
 * Reads a file and caches its content
 * @param {string} filePath - Path to the file
 * @param {object} cache - Cache reference to store the content
 * @returns {string} - The file content
 */
function readWithCache(filePath, cache) {
  if (cache[filePath]) {
    return cache[filePath];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    cache[filePath] = content;
    return content;
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return '';
  }
}

/**
 * Processes an HTML file to include header and footer
 * @param {string} htmlContent - The HTML content to process
 * @param {object} options - Optional parameters for customization
 * @returns {string} - The processed HTML with header and footer
 */
function processIncludes(htmlContent, options = {}) {
  // Default paths for includes
  const headerPath = options.headerPath || path.join(__dirname, 'public', 'includes', 'header.html');
  const footerPath = options.footerPath || path.join(__dirname, 'public', 'includes', 'footer.html');
  
  // Common CSS file
  const commonCssPath = options.commonCssPath || '/css/common.css';
  const langSelectorCssPath = options.langSelectorCssPath || '/css/components/language-selector.css';
  
  // Extract title, body content, and any custom styles or scripts
  const title = extractTitle(htmlContent) || 'The Current-See';
  const bodyContent = extractBodyContent(htmlContent);
  const customCss = extractCustomCss(htmlContent);
  const customScripts = extractCustomScripts(htmlContent);
  
  // Read header and footer from files with caching
  const header = readWithCache(headerPath, includesCache);
  const footer = readWithCache(footerPath, includesCache);
  
  // Language translator script
  const langTranslatorScriptPath = options.langTranslatorScriptPath || '/js/language-translator.js';
  
  // Construct the full HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Common Styles -->
  <link rel="stylesheet" href="${commonCssPath}">
  <link rel="stylesheet" href="${langSelectorCssPath}">
  
  <!-- Page-specific styles -->
  ${customCss}
</head>
<body>
  ${header}
  
  <main>
    ${bodyContent}
  </main>
  
  ${footer}
  
  <!-- Language Translator -->
  <script src="${langTranslatorScriptPath}"></script>
  
  <!-- Page-specific scripts -->
  ${customScripts}
</body>
</html>`;
}

/**
 * Extracts just the body content from a complete HTML document
 * @param {string} html - The full HTML document
 * @returns {string} - The body content
 */
function extractBodyContent(html) {
  // Try to extract content between body tags first
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim();
  }
  
  // If no body tags, try to find content after potential head section
  const headEnd = html.toLowerCase().indexOf('</head>');
  if (headEnd !== -1) {
    const afterHead = html.substring(headEnd + 7);
    const bodyEnd = afterHead.toLowerCase().lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      return afterHead.substring(0, bodyEnd).trim();
    }
    return afterHead.trim();
  }
  
  // If no head or body tags, assume the entire content is the body
  return html.trim();
}

/**
 * Extracts the title from an HTML document
 * @param {string} html - The HTML document
 * @returns {string|null} - The title or null if not found
 */
function extractTitle(html) {
  const titleMatch = /<title[^>]*>(.*?)<\/title>/i.exec(html);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Extracts any custom CSS from the head section
 * @param {string} html - The HTML document
 * @returns {string} - The custom CSS or empty string
 */
function extractCustomCss(html) {
  const headRegex = /<head[^>]*>([\s\S]*?)<\/head>/i;
  const headMatch = headRegex.exec(html);
  
  if (!headMatch) {
    return '';
  }
  
  const headContent = headMatch[1];
  
  // Find all style tags and link[rel=stylesheet] tags
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>|<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  let match;
  let result = '';
  
  while ((match = styleRegex.exec(headContent)) !== null) {
    result += match[0] + '\n';
  }
  
  return result;
}

/**
 * Extracts any custom scripts from the document
 * @param {string} html - The HTML document
 * @returns {string} - The custom scripts or empty string
 */
function extractCustomScripts(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let result = '';
  
  // Collect all script tags
  while ((match = scriptRegex.exec(html)) !== null) {
    // Skip scripts with src attribute referring to common files
    if (!match[0].includes('language-translator.js')) {
      result += match[0] + '\n';
    }
  }
  
  return result;
}

/**
 * Creates a middleware function to process includes for HTML responses
 * @returns {function} - Express middleware function
 */
function createIncludesMiddleware() {
  return function(req, res, next) {
    // Store the original res.send to intercept HTML responses
    const originalSend = res.send;
    
    // Override res.send to process HTML content
    res.send = function(body) {
      // Only process HTML responses
      if (typeof body === 'string' && (body.trim().startsWith('<!DOCTYPE html') || body.trim().startsWith('<html'))) {
        console.log(`Processing includes for ${req.path}`);
        // Process includes
        const processedHtml = processIncludes(body);
        
        // Call the original send with the processed HTML
        return originalSend.call(this, processedHtml);
      }
      
      // For non-HTML responses, use the original send
      return originalSend.apply(this, arguments);
    };
    
    next();
  };
}

module.exports = {
  processIncludes,
  createIncludesMiddleware
};