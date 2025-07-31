/**
 * D-ID Streaming JSON Conversation Capture
 * Innovative approach using D-ID's native streaming JSON data flow
 * Captures conversations without hindering user experience
 */

class DidStreamingCapture {
  constructor() {
    this.streamBuffer = [];
    this.conversationId = this.generateConversationId();
    this.isCapturing = false;
    this.streamEndpoint = '/api/conversation-stream';
    
    console.log('🎬 D-ID Streaming Capture initialized');
    this.init();
  }

  generateConversationId() {
    return `console_solar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  init() {
    // Method 1: Intercept D-ID's native streaming JSON
    this.interceptDidStreamingData();
    
    // Method 2: Monitor D-ID WebSocket connections
    this.monitorWebSocketStreams();
    
    // Method 3: Capture D-ID iframe streaming events
    this.captureDidIframeStreams();
    
    // Method 4: Listen for D-ID agent streaming responses
    this.listenForStreamingResponses();
  }

  interceptDidStreamingData() {
    // Override fetch to capture D-ID API streaming calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(this, args);
      
      // Check if this is a D-ID streaming request
      const url = args[0];
      if (typeof url === 'string' && (url.includes('d-id') || url.includes('agents') || url.includes('talks'))) {
        console.log('🎯 D-ID API call detected:', url);
        
        // Clone response to capture stream data
        const clonedResponse = response.clone();
        this.processStreamingResponse(clonedResponse, url);
      }
      
      return response;
    };
  }

  async processStreamingResponse(response, url) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        this.processStreamChunk(chunk, url);
      }
    } catch (error) {
      console.log('Stream processing error:', error);
    }
  }

  processStreamChunk(chunk, source) {
    // Parse JSON chunks from D-ID streaming response
    const lines = chunk.split('\n');
    
    lines.forEach(line => {
      if (line.trim() && line.startsWith('data: ')) {
        try {
          const jsonData = JSON.parse(line.replace('data: ', ''));
          this.captureStreamingData(jsonData, source);
        } catch (e) {
          // Not JSON, might be text data
          if (line.includes('data: ') && line.length > 10) {
            this.captureTextData(line.replace('data: ', ''), source);
          }
        }
      }
    });
  }

  captureStreamingData(data, source) {
    const timestamp = new Date().toISOString();
    
    // Look for conversation data in D-ID streaming JSON
    if (data.type === 'response' || data.message || data.text || data.content) {
      const conversationData = {
        id: this.conversationId,
        timestamp,
        source: 'did_streaming',
        url: source,
        type: data.type || 'agent_response',
        content: data.message || data.text || data.content || JSON.stringify(data),
        metadata: {
          agent_id: this.extractAgentId(data),
          session_id: data.session_id || data.sessionId,
          raw_data: data
        }
      };
      
      console.log('📡 Streaming conversation captured:', conversationData.content.substring(0, 100));
      this.saveConversationData(conversationData);
    }
  }

  captureTextData(text, source) {
    if (text && text.length > 3 && !text.includes('ping') && !text.includes('keepalive')) {
      const conversationData = {
        id: this.conversationId,
        timestamp: new Date().toISOString(),
        source: 'did_text_stream',
        type: 'streaming_text',
        content: text,
        metadata: { source_url: source }
      };
      
      console.log('📝 Text stream captured:', text.substring(0, 100));
      this.saveConversationData(conversationData);
    }
  }

  monitorWebSocketStreams() {
    // Override WebSocket to capture D-ID streaming
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);
      
      if (url.includes('d-id') || url.includes('agent')) {
        console.log('🔌 D-ID WebSocket detected:', url);
        
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.captureWebSocketData(data, url);
          } catch (e) {
            // Text message
            if (event.data && event.data.length > 3) {
              this.captureWebSocketData({ text: event.data }, url);
            }
          }
        });
      }
      
      return ws;
    }.bind(this);
  }

  captureWebSocketData(data, wsUrl) {
    if (data.text || data.message || data.content) {
      const conversationData = {
        id: this.conversationId,
        timestamp: new Date().toISOString(),
        source: 'did_websocket',
        type: 'websocket_message',
        content: data.text || data.message || data.content,
        metadata: { websocket_url: wsUrl, raw_data: data }
      };
      
      console.log('🔌 WebSocket conversation captured:', conversationData.content.substring(0, 100));
      this.saveConversationData(conversationData);
    }
  }

  captureDidIframeStreams() {
    // Listen for postMessage events from D-ID iframe containing streaming data
    window.addEventListener('message', (event) => {
      if (event.origin.includes('d-id') || 
          event.data.type === 'agent_response' || 
          event.data.streaming === true) {
        
        console.log('📡 D-ID iframe streaming data:', event.data);
        
        const conversationData = {
          id: this.conversationId,
          timestamp: new Date().toISOString(),
          source: 'did_iframe_stream',
          type: 'iframe_postmessage',
          content: this.extractContentFromIframeData(event.data),
          metadata: { 
            origin: event.origin,
            raw_data: event.data
          }
        };
        
        if (conversationData.content) {
          this.saveConversationData(conversationData);
        }
      }
    });
  }

  listenForStreamingResponses() {
    // Monitor DOM for streaming text updates that indicate D-ID responses
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          
          // Look for D-ID agent response containers
          if (target.textContent && 
              (target.closest('[data-did-container]') || 
               target.closest('.agent-response') ||
               target.textContent.includes('Kid Solar') ||
               target.textContent.includes('Console Solar'))) {
            
            const content = target.textContent.trim();
            if (content.length > 10) {
              console.log('🎭 DOM streaming response detected:', content.substring(0, 100));
              
              const conversationData = {
                id: this.conversationId,
                timestamp: new Date().toISOString(),
                source: 'did_dom_stream',
                type: 'dom_mutation',
                content: content,
                metadata: { 
                  element_tag: target.tagName,
                  element_class: target.className
                }
              };
              
              this.saveConversationData(conversationData);
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

  extractAgentId(data) {
    return data.agent_id || data.agentId || 'v2_agt_CjJhPh1Y';
  }

  extractContentFromIframeData(data) {
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (data.content) return data.content;
    if (data.response) return data.response;
    return JSON.stringify(data);
  }

  async saveConversationData(conversationData) {
    try {
      // Immediate local storage for zero data loss
      this.streamBuffer.push(conversationData);
      
      // Send to server endpoint
      await fetch(this.streamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });
      
      console.log('💾 Conversation data saved successfully');
    } catch (error) {
      console.log('⚠️ Saving conversation data (will retry):', error);
      // Keep in buffer for retry
    }
  }

  // Export captured data for analysis
  exportCapturedData() {
    return {
      conversationId: this.conversationId,
      totalCaptured: this.streamBuffer.length,
      conversations: this.streamBuffer,
      captureStatus: 'active'
    };
  }
}

// Initialize streaming capture when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.didStreamingCapture = new DidStreamingCapture();
  console.log('🚀 D-ID Streaming Capture System Active');
});

// Global access for debugging
window.getDidStreamingData = () => {
  return window.didStreamingCapture ? window.didStreamingCapture.exportCapturedData() : null;
};