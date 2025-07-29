/**
 * Enhanced D-ID Console Solar Conversation Capture
 * Fixes "No message text" issue by properly intercepting D-ID agent conversations
 */

class EnhancedDidCapture {
  constructor() {
    this.sessionId = `console-solar-${Date.now()}`;
    this.capturedResponses = new Set();
    this.capturedInputs = new Set();
    this.isMonitoring = false;
    
    console.log('🎯 Enhanced Console Solar Capture initialized - ZERO DATA LOSS');
    this.startEnhancedCapture();
  }
  
  startEnhancedCapture() {
    this.isMonitoring = true;
    
    // Multiple capture methods for maximum reliability
    this.interceptDidMessages();
    this.monitorInputs();
    this.monitorOutputs();
    this.interceptNetworkRequests();
    this.monitorDomChanges();
    
    console.log('✅ Enhanced Console Solar capture ACTIVE - Multiple detection methods');
  }
  
  interceptDidMessages() {
    // Listen for postMessage events from D-ID iframe
    window.addEventListener('message', (event) => {
      try {
        const data = event.data;
        
        // Check for D-ID specific message patterns
        if (data && typeof data === 'object') {
          // Common D-ID message patterns
          if (data.type && (data.type.includes('agent') || data.type.includes('did'))) {
            console.log('🎯 D-ID message intercepted:', data);
            this.processDidMessage(data);
          }
          
          // Speech/audio messages
          if (data.speech || data.audio || data.transcript) {
            console.log('🎯 D-ID speech intercepted:', data);
            this.captureAgentSpeech(data.speech || data.audio || data.transcript);
          }
          
          // Text messages
          if (data.text || data.message) {
            console.log('🎯 D-ID text intercepted:', data);
            this.captureAgentResponse(data.text || data.message);
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
    
    console.log('📡 D-ID postMessage interception active');
  }
  
  monitorInputs() {
    // Enhanced input monitoring with multiple triggers
    const captureUserInput = (input, source) => {
      if (input && input.trim() && !this.capturedInputs.has(input.trim())) {
        console.log(`🎯 User input captured (${source}):`, input.trim());
        this.capturedInputs.add(input.trim());
        this.storeConversation('user', input.trim(), source);
      }
    };
    
    // Monitor all input types
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        const value = target.value || target.textContent || target.innerText;
        if (value && value.trim()) {
          captureUserInput(value.trim(), 'keydown-enter');
        }
      }
    });
    
    // Monitor form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      const inputs = form.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
      inputs.forEach(input => {
        const value = input.value || input.textContent || input.innerText;
        if (value && value.trim()) {
          captureUserInput(value.trim(), 'form-submit');
        }
      });
    });
    
    // Monitor click events on send buttons
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.textContent && (
        target.textContent.toLowerCase().includes('send') ||
        target.textContent.toLowerCase().includes('submit') ||
        target.className.includes('send') ||
        target.className.includes('submit')
      )) {
        // Look for nearby input fields
        const form = target.closest('form') || document;
        const inputs = form.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
        inputs.forEach(input => {
          const value = input.value || input.textContent || input.innerText;
          if (value && value.trim()) {
            captureUserInput(value.trim(), 'button-click');
          }
        });
      }
    });
    
    console.log('🎧 Enhanced input monitoring active');
  }
  
  monitorOutputs() {
    // Enhanced output monitoring for Console Solar responses
    const checkForConsoleSolarText = () => {
      // Look for text in various containers
      const selectors = [
        '[data-testid*="agent"]',
        '[class*="agent"]',
        '[class*="response"]',
        '[class*="chat"]',
        '[class*="message"]',
        '[role="log"]',
        '[aria-live]',
        'p', 'div', 'span'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const text = element.textContent?.trim();
            if (text && text.length > 10 && this.isConsoleSolarContent(text)) {
              if (!this.capturedResponses.has(text.substring(0, 50))) {
                console.log('🤖 Console Solar response detected:', text.substring(0, 100) + '...');
                this.capturedResponses.add(text.substring(0, 50));
                this.storeConversation('agent', text, 'dom-monitoring');
              }
            }
          });
        } catch (e) {
          // Continue with other selectors
        }
      });
    };
    
    // Check every 2 seconds
    setInterval(checkForConsoleSolarText, 2000);
    
    // Also check on DOM mutations
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.trim();
            if (text && text.length > 10 && this.isConsoleSolarContent(text)) {
              if (!this.capturedResponses.has(text.substring(0, 50))) {
                console.log('🤖 Console Solar response detected via mutation:', text.substring(0, 100) + '...');
                this.capturedResponses.add(text.substring(0, 50));
                this.storeConversation('agent', text, 'dom-mutation');
              }
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });
    
    console.log('👁️ Enhanced output monitoring active');
  }
  
  interceptNetworkRequests() {
    // Intercept fetch requests that might contain D-ID responses
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Clone response to read it without consuming
        const clonedResponse = response.clone();
        
        // Check if this might be a D-ID API response
        const url = args[0];
        if (typeof url === 'string' && (url.includes('d-id') || url.includes('agent'))) {
          try {
            const data = await clonedResponse.json();
            console.log('🌐 D-ID API response intercepted:', data);
            this.processApiResponse(data);
          } catch (e) {
            // Not JSON, try text
            try {
              const text = await clonedResponse.text();
              if (text && this.isConsoleSolarContent(text)) {
                console.log('🌐 D-ID text response intercepted:', text);
                this.storeConversation('agent', text, 'api-response');
              }
            } catch (e2) {
              // Ignore
            }
          }
        }
        
        return response;
      } catch (error) {
        console.error('Fetch interception error:', error);
        return originalFetch(...args);
      }
    };
    
    console.log('🌐 Network request interception active');
  }
  
  monitorDomChanges() {
    // Watch for specific D-ID agent container changes
    const targetSelectors = [
      '[id*="d-id"]',
      '[class*="d-id"]',
      '[data-agent-id]',
      'iframe[src*="d-id"]'
    ];
    
    targetSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
              const text = element.textContent?.trim();
              if (text && text.length > 10 && this.isConsoleSolarContent(text)) {
                if (!this.capturedResponses.has(text.substring(0, 50))) {
                  console.log('🎯 D-ID container change detected:', text.substring(0, 100) + '...');
                  this.capturedResponses.add(text.substring(0, 50));
                  this.storeConversation('agent', text, 'container-change');
                }
              }
            }
          });
        });
        
        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });
    });
    
    console.log('🔍 D-ID container monitoring active');
  }
  
  isConsoleSolarContent(text) {
    if (!text || text.length < 5) return false;
    
    const consoleSolarSignatures = [
      'Hello Human!',
      'What\'s up? The SUN!',
      'I am The Diamond Polymath',
      'Console Solar',
      'Kid Solar',
      'fantastic voyage',
      'solar energy',
      'renewable energy',
      'polymathic',
      'wisdom and creativity',
      'capture the essence',
      'symphony of words',
      'rhythmic rap',
      'blending wisdom',
      'lyrical magic',
      'energy mission',
      'sustainability',
      'Current-See',
      'SOLAR tokens',
      'clean energy',
      'photovoltaic',
      'kilowatt',
      'carbon footprint'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check for signature phrases
    for (const phrase of consoleSolarSignatures) {
      if (lowerText.includes(phrase.toLowerCase())) {
        return true;
      }
    }
    
    // Check for educational energy patterns
    const patterns = [
      /solar.{0,20}energy/i,
      /renewable.{0,20}energy/i,
      /energy.{0,20}solar/i,
      /sustainability.{0,20}future/i,
      /clean.{0,20}energy/i
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }
  
  processDidMessage(data) {
    // Process D-ID specific message data
    if (data.text || data.message || data.speech) {
      const text = data.text || data.message || data.speech;
      this.storeConversation('agent', text, 'did-message');
    }
  }
  
  processApiResponse(data) {
    // Process API response data
    if (data && typeof data === 'object') {
      const text = data.text || data.response || data.message || JSON.stringify(data);
      if (this.isConsoleSolarContent(text)) {
        this.storeConversation('agent', text, 'api-response');
      }
    }
  }
  
  captureAgentSpeech(speech) {
    if (speech && speech.trim()) {
      this.storeConversation('agent', speech, 'speech');
    }
  }
  
  captureAgentResponse(response) {
    if (response && response.trim()) {
      this.storeConversation('agent', response, 'response');
    }
  }
  
  async storeConversation(type, message, source) {
    try {
      const conversationData = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        messageType: type,
        messageText: message,
        captureSource: source,
        captureProof: 'enhanced_capture',
        retentionPriority: 'high',
        immediateCapture: true
      };
      
      const response = await fetch('/api/kid-solar-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });
      
      if (response.ok) {
        console.log(`✅ ${type} message stored via ${source}:`, message.substring(0, 50) + '...');
      } else {
        console.error('❌ Failed to store conversation:', response.status);
      }
    } catch (error) {
      console.error('❌ Conversation storage error:', error);
    }
  }
}

// Initialize enhanced capture when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.enhancedDidCapture = new EnhancedDidCapture();
  });
} else {
  window.enhancedDidCapture = new EnhancedDidCapture();
}

console.log('🚀 Enhanced D-ID Capture System loaded - Ready for Console Solar conversations');