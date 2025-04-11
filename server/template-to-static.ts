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

// Generate all other pages from their templates (if they exist) or from direct file copying
try {
  // Map of page names to their titles and templates (if they exist)
  const pagesToGenerate = [
    {
      name: 'prototype',
      title: 'Prototype - The Current-See',
      contentFile: 'prototype.html',
      useExisting: true
    },
    {
      name: 'my-solar',
      title: 'My Solar - The Current-See',
      contentFile: 'my-solar.html',
      useExisting: true
    },
    {
      name: 'merch',
      title: 'Merchandise - The Current-See',
      contentFile: 'merch.html',
      useExisting: true
    },
    {
      name: 'whitepapers',
      title: 'White Papers - The Current-See',
      contentFile: 'whitepapers.html',
      useExisting: true
    },
    {
      name: 'declaration',
      title: 'Solar Declaration - The Current-See',
      contentFile: 'declaration.html',
      useExisting: true
    },
    {
      name: 'founder_note',
      title: 'Founder\'s Note - The Current-See',
      contentFile: 'founder_note.html',
      useExisting: true
    },
    {
      name: 'wallet',
      title: 'Solar Wallet - The Current-See',
      contentFile: 'wallet.html',
      useExisting: true
    }
  ];

  // Generate or copy each page
  for (const page of pagesToGenerate) {
    const sourcePath = path.join(process.cwd(), 'public', page.contentFile);
    const destinationPath = path.join(process.cwd(), 'public', `${page.name}.html`);
    
    if (page.useExisting && fs.existsSync(sourcePath)) {
      // If we're using an existing file, just ensure it exists (no need to copy as it's already in place)
      console.log(`Using existing file for ${page.name}.html`);
    } else if (fs.existsSync(path.join(templatesDir, `${page.name}-content.html`))) {
      // If a template exists for this page, use it to generate the page
      generateStaticPage(
        page.name,
        page.title,
        `${page.name}-content.html`
      );
    } else {
      console.log(`No template found for ${page.name}.html`);
    }
  }
} catch (error) {
  console.error('Error generating additional pages:', error);
}

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