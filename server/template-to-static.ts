/**
 * Template to Static File Generator
 * 
 * This script processes template files and generates static HTML files.
 * It's used to convert the template-based structure to static files
 * that can be served by the server's static file middleware.
 */

import fs from 'fs';
import path from 'path';
import { generatePage, getTemplate } from './template-processor';

// Ensure public/templates directory exists
const templatesDir = path.join(process.cwd(), 'public', 'templates');
if (!fs.existsSync(templatesDir)) {
  console.error(`Templates directory not found: ${templatesDir}`);
  process.exit(1);
}

// Generate homepage
console.log('Generating homepage from templates...');
try {
  // Read template files
  const homeContent = fs.readFileSync(path.join(templatesDir, 'home-content.html'), 'utf8');
  const homeScripts = fs.readFileSync(path.join(templatesDir, 'home-page-scripts.html'), 'utf8');
  
  // Generate the complete HTML
  const htmlContent = generatePage(
    'The Current-See - Solar-Backed Worldwide Economy',
    homeContent,
    '', // No additional CSS
    homeScripts
  );
  
  // Write to index.html
  fs.writeFileSync(path.join(process.cwd(), 'public', 'index.html'), htmlContent);
  console.log('Homepage generated successfully');
} catch (error) {
  console.error('Error generating homepage:', error);
  process.exit(1);
}

// Additional pages could be added in the future
// For example:
// generateStaticPage('prototype', 'Prototype - The Current-See', 'prototype-content.html');

console.log('All pages generated successfully');

/**
 * Helper function to generate a static page
 * 
 * @param pageName Name of the page file (without extension)
 * @param title Page title
 * @param contentTemplateName Content template filename 
 * @param additionalCss Optional CSS
 * @param additionalScripts Optional scripts
 */
function generateStaticPage(
  pageName: string, 
  title: string, 
  contentTemplateName: string,
  additionalCss: string = '',
  additionalScripts: string = ''
) {
  console.log(`Generating ${pageName}.html...`);
  try {
    // Read content template
    const contentTemplate = getTemplate(contentTemplateName);
    
    // Generate the complete HTML
    const htmlContent = generatePage(
      title,
      contentTemplate,
      additionalCss,
      additionalScripts
    );
    
    // Write to file
    fs.writeFileSync(path.join(process.cwd(), 'public', `${pageName}.html`), htmlContent);
    console.log(`${pageName}.html generated successfully`);
  } catch (error) {
    console.error(`Error generating ${pageName}.html:`, error);
  }
}