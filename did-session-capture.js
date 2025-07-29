/**
 * D-ID Session Capture System
 * Captures conversations from D-ID agent and routes to memory system
 */

class DidSessionCapture {
  constructor() {
    this.sessionId = 'did-session-' + Date.now();
    this.conversationBuffer = [];
    this.isCapturing = false;
    this.agentId = 'v2_agt_vhYf_e_C';
    
    console.log('🎤 D-ID Session Capture initialized for agent:', this.agentId);
    this.startCapture();
  }
  
  startCapture() {
    this.isCapturing = true;
    
    // Monitor for D-ID iframe messages
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object') {
        this.handleDidMessage(event.data);
      }
    });
    
    // Monitor DOM changes for D-ID text content
    this.monitorDidText();
    
    // Monitor input field interactions
    this.monitorUserInputs();
    
    console.log('✅ D-ID conversation monitoring active');
  }
  
  handleDidMessage(data) {
    if (data.type && (data.type.includes('did') || data.type.includes('agent'))) {
      console.log('📧 D-ID message captured:', data);
      
      const messageText = data.text || data.message || data.content || JSON.stringify(data);
      this.logConversation('did_agent_response', messageText);
    }
  }
  
  monitorDidText() {
    // Monitor for text changes in D-ID container
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          
          // Check if this looks like D-ID content
          if (this.isDidContent(target)) {
            const text = this.extractTextContent(target);
            if (text && text.length > 10) {
              console.log('🎭 D-ID visual content detected:', text.substring(0, 50) + '...');
              this.logConversation('did_visual_response', text);
            }
          }
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  monitorUserInputs() {
    // Monitor input fields for user messages to D-ID
    document.addEventListener('input', (event) => {
      const input = event.target;
      if (this.isDidInput(input) && input.value.length > 5) {
        console.log('👤 User input to D-ID:', input.value.substring(0, 30) + '...');
        this.logConversation('user_message_to_did', input.value);
      }
    });
    
    // Monitor button clicks for send actions
    document.addEventListener('click', (event) => {
      const button = event.target;
      if (this.isSendButton(button)) {
        console.log('📤 Send button clicked - capturing conversation');
        this.flushConversationBuffer();
      }
    });
  }
  
  isDidContent(element) {
    if (!element || !element.textContent) return false;
    
    const text = element.textContent.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    
    // Check for D-ID related identifiers
    return className.includes('did') || 
           id.includes('did') || 
           element.tagName === 'IFRAME' ||
           text.includes('console solar') ||
           text.includes('kid solar');
  }
  
  isDidInput(element) {
    if (!element) return false;
    
    const placeholder = element.placeholder || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const className = element.className || '';
    
    return placeholder.toLowerCase().includes('type') ||
           placeholder.toLowerCase().includes('message') ||
           ariaLabel.toLowerCase().includes('chat') ||
           className.includes('input');
  }
  
  isSendButton(element) {
    if (!element) return false;
    
    const text = element.textContent || element.innerHTML || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    
    return text.toLowerCase().includes('send') ||
           text.includes('▶') ||
           text.includes('➤') ||
           text.includes('→') ||
           ariaLabel.toLowerCase().includes('send');
  }
  
  extractTextContent(element) {
    if (!element) return '';
    
    // Get clean text content
    let text = element.textContent || element.innerText || '';
    
    // Clean up the text
    text = text.trim().replace(/\s+/g, ' ');
    
    return text;
  }
  
  logConversation(messageType, messageText) {
    if (!messageText || messageText.length < 3) return;
    
    const conversationData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      messageType: messageType,
      messageText: messageText,
      agentId: this.agentId,
      retentionFirst: true,
      hasImages: messageType.includes('photo') || messageType.includes('image'),
      isDidSession: true
    };
    
    // Add to buffer
    this.conversationBuffer.push(conversationData);
    
    // Send to memory system immediately
    this.sendToMemorySystem(conversationData);
  }
  
  sendToMemorySystem(conversationData) {
    console.log('📤 Sending D-ID conversation to memory system:', conversationData);
    
    fetch('/api/kid-solar-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(conversationData)
    })
    .then(response => response.json())
    .then(data => {
      console.log('✅ D-ID conversation stored in memory:', data);
      
      // Trigger memory page refresh if open
      this.triggerMemoryRefresh();
    })
    .catch(error => {
      console.error('❌ Failed to store D-ID conversation:', error);
    });
  }
  
  flushConversationBuffer() {
    if (this.conversationBuffer.length > 0) {
      console.log(`📊 Flushing ${this.conversationBuffer.length} D-ID conversations to memory`);
      
      // Send all buffered conversations
      this.conversationBuffer.forEach(conv => {
        this.sendToMemorySystem(conv);
      });
      
      // Clear buffer
      this.conversationBuffer = [];
    }
  }
  
  triggerMemoryRefresh() {
    // If memory page is open, refresh it
    if (window.location.pathname.includes('memory') || 
        window.location.pathname.includes('analytics')) {
      console.log('🔄 Triggering memory display refresh...');
      
      setTimeout(() => {
        if (typeof window.loadMemoryData === 'function') {
          window.loadMemoryData();
        }
        
        // Force page reload to show new data
        window.location.reload();
      }, 2000);
    }
  }
}

// Initialize capture system
window.didCapture = new DidSessionCapture();

console.log('🎯 D-ID Session Capture System loaded - monitoring for Console Solar conversations');