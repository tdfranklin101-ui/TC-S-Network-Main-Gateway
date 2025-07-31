/**
 * D-ID Network Interceptor - Advanced Streaming Capture
 * Innovative approach capturing D-ID's network-level streaming JSON
 * Zero interference with user experience
 */

class DidNetworkInterceptor {
  constructor() {
    this.conversationBuffer = new Map();
    this.streamingEndpoints = new Set();
    this.isActive = false;
    
    console.log('🌐 D-ID Network Interceptor initializing...');
    this.initializeInterceptors();
  }

  initializeInterceptors() {
    // Method 1: XMLHttpRequest Interception
    this.interceptXMLHttpRequests();
    
    // Method 2: Fetch API Interception
    this.interceptFetchAPI();
    
    // Method 3: WebSocket Interception
    this.interceptWebSocketConnections();
    
    // Method 4: Service Worker Message Interception
    this.interceptServiceWorkerMessages();
    
    this.isActive = true;
    console.log('🚀 All network interceptors active');
  }

  interceptXMLHttpRequests() {
    const originalXHR = window.XMLHttpRequest;
    const self = this;
    
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...args) {
        if (this.isDidEndpoint(url)) {
          console.log('🎯 D-ID XHR detected:', method, url);
          this.didUrl = url;
          this.didMethod = method;
        }
        return originalOpen.apply(this, [method, url, ...args]);
      }.bind(self);
      
      xhr.send = function(data) {
        if (this.didUrl) {
          // Capture request data
          self.captureRequest(this.didMethod, this.didUrl, data);
          
          // Setup response capture
          this.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && this.status === 200) {
              self.captureResponse(this.didUrl, this.responseText);
            }
          });
        }
        return originalSend.apply(this, arguments);
      };
      
      return xhr;
    };
  }

  interceptFetchAPI() {
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function(input, init = {}) {
      const url = typeof input === 'string' ? input : input.url;
      
      if (self.isDidEndpoint(url)) {
        console.log('🎯 D-ID Fetch detected:', init.method || 'GET', url);
        
        // Capture request
        const requestData = init.body || null;
        self.captureRequest(init.method || 'GET', url, requestData);
        
        // Execute original fetch
        const response = await originalFetch.apply(this, arguments);
        
        // Clone response for capture without affecting original
        const clonedResponse = response.clone();
        self.captureStreamingFetchResponse(url, clonedResponse);
        
        return response;
      }
      
      return originalFetch.apply(this, arguments);
    };
  }

  async captureStreamingFetchResponse(url, response) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process streaming chunks in real-time
        this.processStreamingChunk(chunk, url);
      }
      
      // Process final buffer
      this.captureResponse(url, buffer);
    } catch (error) {
      console.log('Streaming capture error:', error);
    }
  }

  processStreamingChunk(chunk, url) {
    // Look for JSON streaming patterns
    const lines = chunk.split('\n');
    
    lines.forEach(line => {
      // Server-Sent Events format
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        this.processDidStreamingData(data, url, 'sse');
      }
      
      // JSON streaming format
      if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
        this.processDidStreamingData(line.trim(), url, 'json_stream');
      }
    });
  }

  interceptWebSocketConnections() {
    const originalWebSocket = window.WebSocket;
    const self = this;
    
    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);
      
      if (self.isDidEndpoint(url)) {
        console.log('🔌 D-ID WebSocket intercepted:', url);
        
        // Capture outgoing messages
        const originalSend = ws.send;
        ws.send = function(data) {
          self.captureWebSocketMessage('outgoing', url, data);
          return originalSend.apply(this, arguments);
        };
        
        // Capture incoming messages
        ws.addEventListener('message', (event) => {
          self.captureWebSocketMessage('incoming', url, event.data);
        });
      }
      
      return ws;
    };
  }

  interceptServiceWorkerMessages() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'did-streaming-data') {
          console.log('📡 Service Worker D-ID data:', event.data);
          this.processDidStreamingData(event.data.content, event.data.url, 'service_worker');
        }
      });
    }
  }

  isDidEndpoint(url) {
    if (!url) return false;
    
    const didPatterns = [
      'd-id.com',
      'agents.d-id.com',
      'talks.d-id.com',
      'api.d-id.com',
      '/agents/',
      '/talks/',
      'agent-id',
      'v2_agt_'
    ];
    
    return didPatterns.some(pattern => url.includes(pattern));
  }

  captureRequest(method, url, data) {
    const requestId = this.generateRequestId();
    
    const requestData = {
      id: requestId,
      timestamp: new Date().toISOString(),
      type: 'request',
      method,
      url,
      data: this.safeStringify(data),
      agent_id: this.extractAgentId(url)
    };
    
    console.log('📤 D-ID Request captured:', method, url.substring(0, 50));
    this.saveConversationData(requestData);
  }

  captureResponse(url, responseText) {
    try {
      const responseData = {
        id: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        type: 'response',
        url,
        content: responseText,
        agent_id: this.extractAgentId(url)
      };
      
      console.log('📥 D-ID Response captured:', responseText.substring(0, 100));
      this.saveConversationData(responseData);
    } catch (error) {
      console.log('Response capture error:', error);
    }
  }

  processDidStreamingData(data, url, source) {
    try {
      let content = data;
      
      // Try to parse as JSON
      if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
        try {
          const parsed = JSON.parse(data);
          content = this.extractContentFromParsedData(parsed);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      
      if (content && content.length > 3) {
        const streamData = {
          id: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          type: 'streaming_data',
          source,
          url,
          content,
          agent_id: this.extractAgentId(url)
        };
        
        console.log(`📡 ${source.toUpperCase()} streaming data:`, content.substring(0, 100));
        this.saveConversationData(streamData);
      }
    } catch (error) {
      console.log('Streaming data processing error:', error);
    }
  }

  captureWebSocketMessage(direction, url, data) {
    const messageData = {
      id: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      type: `websocket_${direction}`,
      url,
      content: this.safeStringify(data),
      agent_id: this.extractAgentId(url)
    };
    
    console.log(`🔌 WebSocket ${direction}:`, data.toString().substring(0, 100));
    this.saveConversationData(messageData);
  }

  extractContentFromParsedData(data) {
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (data.content) return data.content;
    if (data.response) return data.response;
    if (data.transcript) return data.transcript;
    return JSON.stringify(data);
  }

  extractAgentId(url) {
    const match = url.match(/v2_agt_[a-zA-Z0-9_]+/);
    return match ? match[0] : 'unknown';
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  safeStringify(data) {
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data);
    } catch (e) {
      return data.toString();
    }
  }

  async saveConversationData(data) {
    try {
      // Local buffer for zero data loss
      this.conversationBuffer.set(data.id, data);
      
      // Send to server
      await fetch('/api/conversation-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      console.log('💾 Network intercepted data saved:', data.type);
    } catch (error) {
      console.log('⚠️ Save error (buffered):', error);
    }
  }

  // Get all captured data
  exportAllData() {
    return {
      totalCaptured: this.conversationBuffer.size,
      conversations: Array.from(this.conversationBuffer.values()),
      interceptorStatus: this.isActive ? 'active' : 'inactive',
      endpoints: Array.from(this.streamingEndpoints)
    };
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.didNetworkInterceptor = new DidNetworkInterceptor();
  console.log('🌐 D-ID Network Interceptor Active - Ready for streaming capture');
});

// Global debugging access
window.getDidNetworkData = () => {
  return window.didNetworkInterceptor ? window.didNetworkInterceptor.exportAllData() : null;
};