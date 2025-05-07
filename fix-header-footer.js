/**
 * The Current-See Header/Footer Fix Script
 * 
 * This is a lightweight script designed to quickly verify that headers
 * and footers are working correctly in the deployment.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Logger
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Process HTML includes (simplified version)
function processIncludes(html) {
  try {
    const headerPath = path.join(__dirname, 'public', 'includes', 'header.html');
    const footerPath = path.join(__dirname, 'public', 'includes', 'footer.html');
    const seoMetaPath = path.join(__dirname, 'public', 'includes', 'seo-meta.html');
    
    let headerContent = '';
    let footerContent = '';
    let seoMetaContent = '';
    
    // Read header content
    if (fs.existsSync(headerPath)) {
      headerContent = fs.readFileSync(headerPath, 'utf8');
      log('Header file loaded successfully');
    } else {
      log(`Header file not found at ${headerPath}`, true);
    }
    
    // Read footer content
    if (fs.existsSync(footerPath)) {
      footerContent = fs.readFileSync(footerPath, 'utf8');
      log('Footer file loaded successfully');
    } else {
      log(`Footer file not found at ${footerPath}`, true);
    }
    
    // Read SEO meta content
    if (fs.existsSync(seoMetaPath)) {
      seoMetaContent = fs.readFileSync(seoMetaPath, 'utf8');
      log('SEO meta file loaded successfully');
    } else {
      log(`SEO meta file not found at ${seoMetaPath}`, true);
    }
    
    // Replace all placeholder variations
    html = html.replace(/<!-- HEADER_PLACEHOLDER -->/g, headerContent);
    html = html.replace(/<!-- #include file="includes\/header.html" -->/g, headerContent);
    html = html.replace(/<!-- includes\/header.html -->/g, headerContent);
    
    html = html.replace(/<!-- FOOTER_PLACEHOLDER -->/g, footerContent);
    html = html.replace(/<!-- #include file="includes\/footer.html" -->/g, footerContent);
    html = html.replace(/<!-- includes\/footer.html -->/g, footerContent);
    
    html = html.replace(/<!-- HEADER_SEO_PLACEHOLDER -->/g, seoMetaContent);
    html = html.replace(/<!-- #include file="includes\/seo-meta.html" -->/g, seoMetaContent);
    html = html.replace(/<!-- includes\/seo-meta.html -->/g, seoMetaContent);
    
    return html;
  } catch (err) {
    log(`Error processing includes: ${err.message}`, true);
    return html;
  }
}

// Static file middleware with HTML processing
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('.html')) {
    const filePath = path.join(__dirname, 'public', req.path);
    
    if (fs.existsSync(filePath)) {
      try {
        let htmlContent = fs.readFileSync(filePath, 'utf8');
        htmlContent = processIncludes(htmlContent);
        return res.send(htmlContent);
      } catch (err) {
        log(`Error processing ${req.path}: ${err.message}`, true);
      }
    }
  }
  
  next();
});

// Serve static files
app.use(express.static('public'));

// Root path handler with HTML processing
app.get('/', (req, res) => {
  try {
    let htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    htmlContent = processIncludes(htmlContent);
    res.send(htmlContent);
  } catch (err) {
    log(`Error serving index.html: ${err.message}`, true);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  log('=== The Current-See Header/Footer Fix Server ===');
  log(`Server running on port ${PORT}`);
  
  // Check for header and footer files
  const headerPath = path.join(__dirname, 'public', 'includes', 'header.html');
  const footerPath = path.join(__dirname, 'public', 'includes', 'footer.html');
  
  if (fs.existsSync(headerPath)) {
    log('Header file found');
  } else {
    log('Header file NOT found', true);
  }
  
  if (fs.existsSync(footerPath)) {
    log('Footer file found');
  } else {
    log('Footer file NOT found', true);
  }
  
  log('Ready to serve pages with header and footer includes');
});