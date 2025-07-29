/**
 * D-ID Text Capture System
 * Captures actual D-ID agent text responses and stores them in memory
 */

class DidTextCapture {
  constructor() {
    this.sessionId = `did-session-${Date.now()}`;
    this.capturedTexts = new Set(); // Prevent duplicates
    this.lastCaptureTime = 0;
    this.isMonitoring = false;
    
    console.log('🎯 D-ID Text Capture System initialized');
    this.startTextCapture();
  }
  
  startTextCapture() {
    this.isMonitoring = true;
    
    // Method 1: Monitor DOM mutations for new text
    this.observeTextChanges();
    
    // Method 2: Monitor iframe postMessage events
    this.captureIframeMessages();
    
    // Method 3: Scan for D-ID text every 2 seconds
    this.startPeriodicScan();
    
    // Method 4: Monitor input/output interactions
    this.monitorInteractions();
    
    console.log('✅ D-ID text capture active with 4 monitoring methods');
  }
  
  observeTextChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        // Check for new text nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            this.processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            this.processElementNode(node);
          }
        });
        
        // Check for text content changes
        if (mutation.type === 'characterData') {
          this.processTextNode(mutation.target);
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    console.log('📡 DOM text observer active');
  }
  
  captureIframeMessages() {
    window.addEventListener('message', (event) => {
      try {
        if (event.data && typeof event.data === 'object') {
          // Check for D-ID related messages
          if (this.isDidMessage(event.data)) {
            const text = this.extractMessageText(event.data);
            if (text) {
              this.captureDidText(text, 'iframe_message');
            }
          }
        }
      } catch (e) {
        // Silent catch for parsing errors
      }
    });
    
    console.log('📧 Iframe message capture active');
  }
  
  startPeriodicScan() {
    setInterval(() => {
      this.scanForDidText();
    }, 2000);
    
    console.log('🔍 Periodic text scan active (2s intervals)');
  }
  
  monitorInteractions() {
    // Monitor clicks that might trigger D-ID responses
    document.addEventListener('click', (e) => {
      if (this.isDidButton(e.target)) {
        setTimeout(() => {
          this.scanForDidText();
        }, 1000);
      }
    });
    
    // Monitor when user sends messages
    document.addEventListener('input', (e) => {
      if (this.isDidInput(e.target)) {
        // Capture user input
        const userText = e.target.value;
        if (userText.length > 5) {
          this.captureDidText(userText, 'user_input');
        }
      }
    });
    
    console.log('⚡ Interaction monitoring active');
  }
  
  processTextNode(node) {
    if (node.textContent && node.textContent.trim().length > 10) {
      const text = node.textContent.trim();
      this.evaluateTextForCapture(text, 'text_node');
    }
  }
  
  processElementNode(element) {
    if (element.textContent && element.textContent.trim().length > 10) {
      const text = element.textContent.trim();
      this.evaluateTextForCapture(text, 'element_content');
    }
  }
  
  scanForDidText() {
    // Scan all text elements for D-ID content
    const textElements = document.querySelectorAll('*');
    
    textElements.forEach(element => {
      if (element.textContent && element.textContent.trim().length > 10) {
        const text = element.textContent.trim();
        
        // Check if this looks like D-ID agent output
        if (this.isDidAgentText(text)) {
          this.evaluateTextForCapture(text, 'periodic_scan');
        }
      }
    });
  }
  
  evaluateTextForCapture(text, source) {
    // Skip if already captured recently
    if (this.capturedTexts.has(text)) return;
    
    // Skip if too short or common UI text
    if (text.length < 15 || this.isUIText(text)) return;
    
    // Check if this is D-ID agent content
    if (this.isDidAgentText(text)) {
      this.captureDidText(text, source);
    }
  }
  
  isDidAgentText(text) {
    const lowerText = text.toLowerCase();
    
    // Keywords that suggest D-ID agent response
    const agentKeywords = [
      'solar', 'energy', 'kid solar', 'console solar',
      'renewable', 'sustainability', 'current-see',
      'photovoltaic', 'kwh', 'power', 'green'
    ];
    
    // Check for substantive responses (not UI text)
    const hasAgentKeywords = agentKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
    // Check for conversation-like content
    const isConversational = lowerText.includes('i ') || 
                            lowerText.includes('you ') ||
                            lowerText.includes('can ') ||
                            lowerText.includes('will ') ||
                            text.length > 50;
    
    return hasAgentKeywords || isConversational;
  }
  
  isUIText(text) {
    const uiPhrases = [
      'type a message', 'send', 'click', 'button',
      'loading', 'error', 'retry', 'cancel'
    ];
    
    const lowerText = text.toLowerCase();
    return uiPhrases.some(phrase => lowerText.includes(phrase));
  }
  
  isDidMessage(data) {
    if (!data || typeof data !== 'object') return false;
    
    const dataStr = JSON.stringify(data).toLowerCase();
    return dataStr.includes('did') || 
           dataStr.includes('agent') || 
           dataStr.includes('message') ||
           dataStr.includes('text');
  }
  
  extractMessageText(data) {
    return data.text || data.message || data.content || 
           data.response || data.output || '';
  }
  
  isDidButton(element) {
    if (!element) return false;
    
    const text = element.textContent || '';
    const className = element.className || '';
    
    return text.toLowerCase().includes('send') ||
           className.includes('send') ||
           className.includes('submit');
  }
  
  isDidInput(element) {
    if (!element) return false;
    
    const placeholder = element.placeholder || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    
    return placeholder.toLowerCase().includes('message') ||
           placeholder.toLowerCase().includes('type') ||
           ariaLabel.toLowerCase().includes('input');
  }
  
  captureDidText(text, source) {
    // Prevent duplicate captures
    if (this.capturedTexts.has(text)) return;
    
    // Rate limiting - don't capture too frequently
    const now = Date.now();
    if (now - this.lastCaptureTime < 1000) return;
    
    this.capturedTexts.add(text);
    this.lastCaptureTime = now;
    
    const captureData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      messageType: source === 'user_input' ? 'user_input' : 'did_agent_response',
      messageText: text,
      captureSource: source,
      agentId: 'v2_agt_vhYf_e_C',
      retentionFirst: true,
      isDidSession: true
    };
    
    console.log(`📝 Captured D-ID text (${source}):`, text.substring(0, 50) + '...');
    
    // Store in memory system
    this.storeInMemory(captureData);
  }
  
  storeInMemory(captureData) {
    fetch('/api/kid-solar-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(captureData)
    })
    .then(response => {
      if (response.ok) {
        console.log('✅ D-ID text stored in memory system');
        return response.json();
      } else {
        throw new Error(`Storage failed: ${response.status}`);
      }
    })
    .then(data => {
      console.log('💾 Storage confirmed:', data.conversationId);
      
      // Trigger memory refresh
      this.refreshMemoryDisplay();
    })
    .catch(error => {
      console.log('⚠️ Storage queued for retry:', error.message);
    });
  }
  
  refreshMemoryDisplay() {
    // If on memory page, refresh the display
    if (window.location.pathname.includes('memory') || 
        window.location.pathname.includes('analytics')) {
      
      setTimeout(() => {
        if (typeof window.loadMemoryData === 'function') {
          window.loadMemoryData();
        }
      }, 1000);
    }
  }
  
  // Public method to manually capture current page text
  captureCurrentPageText() {
    console.log('🔍 Manual capture initiated...');
    this.scanForDidText();
    
    // Also capture any visible text that might be D-ID content
    const allText = document.body.innerText;
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    sentences.forEach(sentence => {
      if (this.isDidAgentText(sentence.trim())) {
        this.captureDidText(sentence.trim(), 'manual_capture');
      }
    });
  }
}

// Initialize capture system
window.didTextCapture = new DidTextCapture();

// Add manual capture button for testing
setTimeout(() => {
  const testButton = document.createElement('button');
  testButton.textContent = '📝 Capture D-ID Text Now';
  testButton.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(45deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  `;
  
  testButton.onclick = () => {
    window.didTextCapture.captureCurrentPageText();
    testButton.textContent = '✅ Captured!';
    setTimeout(() => {
      testButton.textContent = '📝 Capture D-ID Text Now';
    }, 2000);
  };
  
  document.body.appendChild(testButton);
}, 2000);

console.log('🎯 D-ID Text Capture System loaded - monitoring all text output');