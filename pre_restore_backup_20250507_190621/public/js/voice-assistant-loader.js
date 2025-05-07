/**
 * Voice Assistant Loader
 * This script ensures the voice assistant is properly loaded on all pages
 * It will be included in the footer template for consistent functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Check if the voice assistant script is already loaded
  if (typeof window.voiceAssistant === 'undefined') {
    // Create voice assistant container if it doesn't exist
    if (!document.getElementById('voice-assistant-container')) {
      const containerElement = document.createElement('div');
      containerElement.id = 'voice-assistant-container';
      document.body.appendChild(containerElement);
    }
    
    // Load the voice assistant script
    const scriptElement = document.createElement('script');
    scriptElement.src = '/js/voice-assistant.js';
    scriptElement.onload = function() {
      console.log('Voice assistant loaded successfully');
      // Voice assistant will auto-initialize due to its DOMContentLoaded listener
    };
    document.body.appendChild(scriptElement);
  }
});