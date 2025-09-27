/**
 * Language Translator Component
 * 
 * This component implements a multi-language support system using Google Translate API.
 * It provides a dropdown menu with country flags for users to select their preferred language.
 */

class LanguageTranslator {
  constructor(containerId = 'language-selector') {
    this.containerId = containerId;
    this.languages = [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
      { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' },
      { code: 'ko', name: '한국어', flag: '🇰🇷' },
      { code: 'ar', name: 'العربية', flag: '🇸🇦' },
      { code: 'ru', name: 'Русский', flag: '🇷🇺' },
      { code: 'pt', name: 'Português', flag: '🇧🇷' },
      { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' }
    ];
    
    this.currentLanguage = localStorage.getItem('preferredLanguage') || 'en';
    this.initiated = false;
  }

  /**
   * Initialize the language selector component
   */
  init() {
    if (this.initiated) return;
    
    // Find or create the container
    let container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`Container #${this.containerId} not found. Creating it in the header.`);
      const header = document.querySelector('header');
      if (header) {
        container = document.createElement('div');
        container.id = this.containerId;
        container.className = 'language-selector';
        header.appendChild(container);
      } else {
        console.error('Cannot initialize language translator: No header found');
        return;
      }
    }
    
    // Create dropdown component
    this.createDropdown(container);
    
    // Initialize Google Translate
    this.initGoogleTranslate();
    
    // Set initial language
    this.setLanguage(this.currentLanguage);
    
    this.initiated = true;
    console.log('Language translator initialized');
  }
  
  /**
   * Create the language dropdown UI
   */
  createDropdown(container) {
    // Create dropdown toggle button
    const dropdownToggle = document.createElement('button');
    dropdownToggle.className = 'language-dropdown-toggle';
    
    const currentLang = this.languages.find(lang => lang.code === this.currentLanguage) || this.languages[0];
    dropdownToggle.innerHTML = `
      <span class="language-flag">${currentLang.flag}</span>
      <span class="language-name">${currentLang.name}</span>
      <span class="language-arrow">▼</span>
    `;
    
    // Create dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'language-dropdown-menu';
    
    // Add language options
    this.languages.forEach(language => {
      const option = document.createElement('a');
      option.className = 'language-option';
      option.setAttribute('data-lang', language.code);
      option.innerHTML = `
        <span class="language-flag">${language.flag}</span>
        <span class="language-name">${language.name}</span>
      `;
      
      option.addEventListener('click', (e) => {
        e.preventDefault();
        this.setLanguage(language.code);
        dropdownMenu.classList.remove('show');
        
        // Update button text
        dropdownToggle.innerHTML = `
          <span class="language-flag">${language.flag}</span>
          <span class="language-name">${language.name}</span>
          <span class="language-arrow">▼</span>
        `;
      });
      
      dropdownMenu.appendChild(option);
    });
    
    // Toggle dropdown on click
    dropdownToggle.addEventListener('click', () => {
      dropdownMenu.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
    
    // Add elements to container
    container.appendChild(dropdownToggle);
    container.appendChild(dropdownMenu);
  }
  
  /**
   * Initialize Google Translate API
   */
  initGoogleTranslate() {
    // Add Google Translate Script
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
    
    // Define global callback function
    window.googleTranslateElementInit = () => {
      this.translateElement = new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: this.languages.map(lang => lang.code).join(','),
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
      
      // Create hidden element for Google Translate
      const translateElement = document.createElement('div');
      translateElement.id = 'google_translate_element';
      translateElement.style.display = 'none';
      document.body.appendChild(translateElement);
    };
  }
  
  /**
   * Set the active language
   */
  setLanguage(languageCode) {
    if (this.currentLanguage === languageCode) return;
    
    this.currentLanguage = languageCode;
    localStorage.setItem('preferredLanguage', languageCode);
    
    // Use Google Translate API to change language
    if (window.google && window.google.translate) {
      const langSelect = document.querySelector('.goog-te-combo');
      if (langSelect) {
        langSelect.value = languageCode;
        langSelect.dispatchEvent(new Event('change'));
      }
    }
    
    // Update classes on the documentElement to help with RTL languages
    if (['ar', 'he', 'fa', 'ur'].includes(languageCode)) {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.classList.remove('rtl');
    }
    
    // Dispatch language change event
    const event = new CustomEvent('languageChanged', { detail: { language: languageCode } });
    document.dispatchEvent(event);
    
    console.log(`Language set to: ${languageCode}`);
  }
}

// Create global instance
window.languageTranslator = new LanguageTranslator();

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.languageTranslator.init();
});