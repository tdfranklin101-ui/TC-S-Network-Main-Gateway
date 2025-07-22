import fs from 'fs';
import path from 'path';

/**
 * Template Processor for The Current-See website
 * 
 * This module provides functions to process HTML templates with placeholders.
 * It enables a simple template system for the website.
 */

// Base path for templates
const TEMPLATES_PATH = path.join(process.cwd(), 'public', 'templates');

/**
 * Reads a template file and returns its content
 * @param templateName Name of the template file (without .html extension)
 * @returns Template content as string
 */
export function getTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATES_PATH, `${templateName}.html`);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error reading template ${templateName}: ${error}`);
    return '';
  }
}

/**
 * Combines header, content, and footer to create a complete HTML page
 * @param title Page title
 * @param content Main content HTML
 * @param additionalCss Optional CSS to include
 * @param additionalScripts Optional scripts to include
 * @returns Complete HTML page
 */
export function generatePage(
  title: string,
  content: string,
  additionalCss: string = '',
  additionalScripts: string = ''
): string {
  let header = getTemplate('header')
    .replace('<!-- PAGE_TITLE -->', title)
    .replace('<!-- ADDITIONAL_CSS -->', additionalCss);

  let footer = getTemplate('footer')
    .replace('<!-- ADDITIONAL_SCRIPTS -->', additionalScripts);

  return `${header.replace('<!-- CONTENT_STARTS_HERE -->', '')}
${content}
${footer.replace('<!-- CONTENT_ENDS_HERE -->', '')}`;
}

/**
 * Processes a template by replacing placeholders with actual values
 * @param template Template string with placeholders
 * @param replacements Object with placeholder keys and replacement values
 * @returns Processed template with replacements
 */
export function processTemplate(template: string, replacements: Record<string, string>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `<!-- ${key} -->`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return result;
}

/**
 * Helper function to create a page from a template
 * @param title Page title
 * @param templateName Template file name (without .html extension)
 * @param replacements Replacement values for the template
 * @param additionalCss Optional CSS to include
 * @param additionalScripts Optional scripts to include
 * @returns Complete HTML page
 */
export function createPageFromTemplate(
  title: string,
  templateName: string,
  replacements: Record<string, string> = {},
  additionalCss: string = '',
  additionalScripts: string = ''
): string {
  const template = getTemplate(templateName);
  const processedContent = processTemplate(template, replacements);
  return generatePage(title, processedContent, additionalCss, additionalScripts);
}