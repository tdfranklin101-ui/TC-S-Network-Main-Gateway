/**
 * Language Translator Loader
 * This script ensures the language translator is properly loaded on all pages
 * It will be included in the footer template for consistent functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // First, add the language translator CSS if not already present
  if (!document.querySelector('link[href*="language-translator.css"]')) {
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = '/css/language-translator.css';
    document.head.appendChild(linkElement);
  }

  // Next, add the language translator script if not already loaded
  if (typeof window.languageTranslator === 'undefined') {
    // Create Google Translate element
    const googleElement = document.createElement('div');
    googleElement.id = 'google_translate_element';
    googleElement.style.display = 'none';
    document.body.appendChild(googleElement);
    
    // Load the language translator script
    const scriptElement = document.createElement('script');
    scriptElement.src = '/js/language-translator.js';
    scriptElement.onload = function() {
      console.log('Language translator loaded successfully');
      // Initialize the translator if it hasn't been automatically initialized
      if (window.languageTranslator && !window.languageTranslator.initiated) {
        window.languageTranslator.init();
      }
    };
    document.body.appendChild(scriptElement);
  } else {
    // Language translator already exists, make sure it's initialized
    if (!window.languageTranslator.initiated) {
      window.languageTranslator.init();
    }
  }
});