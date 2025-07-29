/**
 * D-ID Real Conversation Capture System
 * Captures actual user-to-Console Solar conversations
 */

class DidConversationCapture {
  constructor() {
    this.sessionId = `console-solar-${Date.now()}`;
    this.conversationPairs = [];
    this.lastUserInput = '';
    this.lastAgentResponse = '';
    this.isMonitoring = false;
    
    console.log('🎯 Console Solar Conversation Capture initialized');
    this.startCapture();
  }
  
  startCapture() {
    this.isMonitoring = true;
    
    // Wait for D-ID agent to load, then start monitoring
    setTimeout(() => {
      this.monitorDidAgent();
      this.monitorUserInput();
      this.monitorAgentResponses();
    }, 3000);
    
    console.log('✅ Console Solar conversation monitoring active');
  }
  
  monitorDidAgent() {
    // Monitor for D-ID iframe and agent elements
    const checkForAgent = () => {
      const agentIframes = document.querySelectorAll('iframe[src*="d-id"]');
      const agentElements = document.querySelectorAll('[data-agent-id="v2_agt_vhYf_e_C"]');
      
      if (agentIframes.length > 0 || agentElements.length > 0) {
        console.log('🤖 Console Solar agent detected, starting conversation capture');
        this.attachToAgent();
      } else {
        setTimeout(checkForAgent, 2000);
      }
    };
    
    checkForAgent();
  }
  
  attachToAgent() {
    // Monitor text inputs that could be for the D-ID agent
    this.monitorTextInputs();
    
    // Monitor for agent response text
    this.monitorResponseText();
    
    // Listen for postMessage events from D-ID iframe
    this.listenForDidMessages();
  }
  
  monitorTextInputs() {
    // Find text inputs and attach listeners
    const textInputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
    
    textInputs.forEach(input => {
      // Listen for Enter key or form submission
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          this.captureUserInput(input.value.trim());
        }
      });
      
      // Listen for input changes that might trigger agent responses
      input.addEventListener('input', (e) => {
        if (e.target.value.trim()) {
          this.lastUserInput = e.target.value.trim();
        }
      });
    });
    
    // Also monitor for dynamic inputs that appear later
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newInputs = node.querySelectorAll && node.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
            if (newInputs && newInputs.length > 0) {
              newInputs.forEach(input => {
                input.addEventListener('keypress', (e) => {
                  if (e.key === 'Enter' && input.value.trim()) {
                    this.captureUserInput(input.value.trim());
                  }
                });
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  monitorResponseText() {
    // Monitor for text that appears and looks like agent responses
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            this.processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            this.processElementForAgentText(node);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  processElementForAgentText(element) {
    // Look for text that seems like agent responses
    const text = element.textContent || element.innerText;
    if (text && text.length > 20 && this.isLikelyAgentResponse(text)) {
      this.captureAgentResponse(text.trim());
    }
    
    // Check child elements recursively
    const children = element.children || [];
    for (let child of children) {
      this.processElementForAgentText(child);
    }
  }
  
  processTextNode(node) {
    const text = node.textContent || node.nodeValue;
    if (text && text.length > 20 && this.isLikelyAgentResponse(text)) {
      this.captureAgentResponse(text.trim());
    }
  }
  
  isLikelyAgentResponse(text) {
    // Heuristics to identify Console Solar responses
    const agentKeywords = [
      'solar', 'energy', 'renewable', 'sustainability', 'photovoltaic',
      'Hi there', 'Hello', 'I\'m Console Solar', 'Kid Solar', 'TC-S',
      'current-see', 'polymathic', 'assistant', 'efficiency'
    ];
    
    const hasKeywords = agentKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const hasProperLength = text.length > 30 && text.length < 2000;
    const hasProperStructure = text.includes(' ') && !text.includes('\n\n\n');
    
    return hasKeywords && hasProperLength && hasProperStructure;
  }
  
  listenForDidMessages() {
    window.addEventListener('message', (event) => {
      try {
        if (event.data && typeof event.data === 'object') {
          // Check for D-ID specific message patterns
          if (event.data.type && event.data.type.includes('response')) {
            const text = event.data.text || event.data.message || event.data.content;
            if (text && text.length > 10) {
              this.captureAgentResponse(text);
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
  }
  
  captureUserInput(input) {
    if (input && input !== this.lastUserInput) {
      this.lastUserInput = input;
      console.log('👤 User input captured:', input);
      
      // Store immediately
      this.storeConversation('user', input);
      
      // Wait for agent response
      setTimeout(() => {
        this.checkForAgentResponse();
      }, 2000);
    }
  }
  
  captureAgentResponse(response) {
    if (response && response !== this.lastAgentResponse && response.length > 20) {
      this.lastAgentResponse = response;
      console.log('🤖 Console Solar response captured:', response.substring(0, 100) + '...');
      
      // Store the response
      this.storeConversation('agent', response);
      
      // Create conversation pair if we have both user input and agent response
      if (this.lastUserInput) {
        this.createConversationPair(this.lastUserInput, response);
      }
    }
  }
  
  checkForAgentResponse() {
    // Scan the page for new text that might be an agent response
    const allText = document.body.innerText;
    const newTexts = allText.split('\n').filter(line => 
      line.trim().length > 30 && this.isLikelyAgentResponse(line.trim())
    );
    
    if (newTexts.length > 0) {
      const latestResponse = newTexts[newTexts.length - 1].trim();
      if (latestResponse !== this.lastAgentResponse) {
        this.captureAgentResponse(latestResponse);
      }
    }
  }
  
  createConversationPair(userInput, agentResponse) {
    const conversationPair = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      conversationType: 'Console Solar Conversation',
      userInput: userInput,
      agentResponse: agentResponse,
      messageType: 'real_conversation',
      captureSource: 'did_agent_live',
      captureProof: 'real_user_interaction'
    };
    
    this.conversationPairs.push(conversationPair);
    
    // Send to server for storage
    this.sendToServer(conversationPair);
    
    console.log('💬 Conversation pair created and stored:', {
      user: userInput.substring(0, 50) + '...',
      agent: agentResponse.substring(0, 50) + '...'
    });
  }
  
  storeConversation(type, text) {
    const conversation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      conversationType: 'Console Solar Session',
      messageType: type === 'user' ? 'user_input' : 'agent_response',
      messageText: text,
      captureSource: 'did_agent_conversation',
      captureProof: 'real_session_interaction'
    };
    
    this.sendToServer(conversation);
  }
  
  sendToServer(conversationData) {
    fetch('/api/kid-solar-conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(conversationData)
    })
    .then(response => response.json())
    .then(data => {
      console.log('✅ Conversation stored in memory system:', data);
    })
    .catch(error => {
      console.error('❌ Failed to store conversation:', error);
    });
  }
}

// Initialize the capture system when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for D-ID agent to load
  setTimeout(() => {
    window.didConversationCapture = new DidConversationCapture();
  }, 2000);
});

// Also initialize if page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    if (!window.didConversationCapture) {
      window.didConversationCapture = new DidConversationCapture();
    }
  }, 2000);
}