/**
 * Enhanced D-ID Audio Response Capture System
 * Specifically designed to capture Console Solar voice responses
 * Handles low bandwidth and streaming audio scenarios
 */

class EnhancedDidAudioCapture {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.conversationBuffer = [];
    this.isListening = false;
    this.captureAttempts = 0;
    this.maxAttempts = 10;
    
    console.log('🎤 Enhanced Audio Capture System initialized');
    this.initializeCapture();
  }

  generateSessionId() {
    return `audio_capture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeCapture() {
    // Method 1: Monitor D-ID iframe for audio completion events
    this.monitorAudioCompletionEvents();
    
    // Method 2: Intercept D-ID's text-to-speech transcription
    this.interceptTextToSpeechData();
    
    // Method 3: Monitor DOM changes for response text
    this.monitorResponseTextChanges();
    
    // Method 4: Capture audio stream metadata
    this.captureAudioStreamMetadata();
    
    // Method 5: Backup capture via speech recognition
    this.setupSpeechRecognitionBackup();
    
    this.isListening = true;
    console.log('🔍 All audio capture methods active');
  }

  monitorAudioCompletionEvents() {
    // Listen for D-ID agent audio completion
    window.addEventListener('message', (event) => {
      try {
        const data = event.data;
        
        // Check for D-ID audio completion signals
        if (data && (data.type === 'agent-audio-complete' || 
                    data.type === 'agent-response-complete' ||
                    data.type === 'tts-complete' ||
                    data.audioComplete === true)) {
          
          console.log('🎯 Audio completion detected:', data);
          this.processAudioCompletionData(data);
        }
        
        // Check for D-ID streaming response data
        if (data && data.response && typeof data.response === 'string') {
          console.log('📝 Response text detected:', data.response.substring(0, 100) + '...');
          this.captureResponseText(data.response, 'audio-completion');
        }
      } catch (error) {
        console.log('Audio completion monitoring error:', error);
      }
    });
  }

  interceptTextToSpeechData() {
    // Override console methods to capture TTS logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const self = this;
    
    console.log = function(...args) {
      // Check for D-ID TTS or response data in logs
      const logString = args.join(' ');
      if (logString.includes('response') || logString.includes('tts') || 
          logString.includes('audio') || logString.includes('speak')) {
        self.analyzeCapturedLog(logString, args);
      }
      return originalLog.apply(console, args);
    };
    
    // Monitor for D-ID internal logging
    this.interceptDidInternalLogging();
  }

  monitorResponseTextChanges() {
    // Create mutation observer for chat interface changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
              this.analyzeNodeForResponse(node);
            }
          });
        }
        
        if (mutation.type === 'characterData') {
          this.analyzeTextContentForResponse(mutation.target.textContent);
        }
      });
    });
    
    // Observe the entire document for D-ID response changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  captureAudioStreamMetadata() {
    // Monitor WebRTC connections for audio metadata
    const originalRTCPeerConnection = window.RTCPeerConnection;
    const self = this;
    
    if (originalRTCPeerConnection) {
      window.RTCPeerConnection = function(...args) {
        const pc = new originalRTCPeerConnection(...args);
        
        pc.addEventListener('datachannel', (event) => {
          const channel = event.channel;
          channel.addEventListener('message', (msgEvent) => {
            self.processDataChannelMessage(msgEvent.data);
          });
        });
        
        return pc;
      };
    }
  }

  setupSpeechRecognitionBackup() {
    // Use Web Speech API as backup to capture spoken responses
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechRecognition = new SpeechRecognition();
        
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';
        
        this.speechRecognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          if (transcript.length > 10) { // Filter out short sounds
            console.log('🎙️ Speech recognition backup captured:', transcript.substring(0, 50) + '...');
            this.captureResponseText(transcript, 'speech-recognition-backup');
          }
        };
        
        // Start listening when D-ID agent is active
        this.startSpeechRecognitionWhenNeeded();
      } catch (error) {
        console.log('Speech recognition not available:', error);
      }
    }
  }

  processAudioCompletionData(data) {
    if (data.response || data.text || data.content) {
      const responseText = data.response || data.text || data.content;
      this.captureResponseText(responseText, 'audio-completion-event');
    }
  }

  analyzeNodeForResponse(node) {
    const text = node.textContent || node.innerText || '';
    if (text.length > 20 && this.looksLikeConsoleSolarResponse(text)) {
      console.log('🎯 Response found in DOM node:', text.substring(0, 50) + '...');
      this.captureResponseText(text, 'dom-monitoring');
    }
  }

  analyzeTextContentForResponse(text) {
    if (text && text.length > 20 && this.looksLikeConsoleSolarResponse(text)) {
      console.log('📝 Response found in text content:', text.substring(0, 50) + '...');
      this.captureResponseText(text, 'text-content-change');
    }
  }

  looksLikeConsoleSolarResponse(text) {
    // Identify Console Solar response patterns
    const consoleSolarPatterns = [
      /interesting question/i,
      /let me think/i,
      /from my perspective/i,
      /consider this/i,
      /that's a complex/i,
      /in terms of/i,
      /the principle/i,
      /interpretation/i,
      /communication/i,
      /actually/i,
      /there are/i,
      /it was easier/i,
      /sometimes/i,
      /matter of/i
    ];
    
    return consoleSolarPatterns.some(pattern => pattern.test(text)) && 
           text.length > 30 && 
           !text.includes('Type your message');
  }

  captureResponseText(responseText, source) {
    if (!responseText || responseText.length < 10) return;
    
    const timestamp = new Date().toISOString();
    const conversationEntry = {
      sessionId: this.sessionId,
      timestamp,
      responseText: responseText.trim(),
      source,
      type: 'console_solar_response'
    };
    
    console.log(`✅ Captured Console Solar response via ${source}:`, responseText.substring(0, 100) + '...');
    
    // Store immediately to prevent loss
    this.storeConversationEntry(conversationEntry);
  }

  async storeConversationEntry(entry) {
    try {
      const response = await fetch('/api/enhanced-conversation-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      
      if (response.ok) {
        console.log('💾 Console Solar response stored successfully');
      } else {
        console.log('⚠️ Storage failed, caching locally');
        this.conversationBuffer.push(entry);
        this.retryBufferedEntries();
      }
    } catch (error) {
      console.log('Storage error, buffering:', error);
      this.conversationBuffer.push(entry);
    }
  }

  async retryBufferedEntries() {
    if (this.conversationBuffer.length === 0) return;
    
    console.log(`🔄 Retrying ${this.conversationBuffer.length} buffered entries`);
    
    const entriesToRetry = [...this.conversationBuffer];
    this.conversationBuffer = [];
    
    for (const entry of entriesToRetry) {
      try {
        const response = await fetch('/api/enhanced-conversation-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        
        if (!response.ok) {
          this.conversationBuffer.push(entry); // Re-buffer failed entries
        }
      } catch (error) {
        this.conversationBuffer.push(entry); // Re-buffer failed entries
      }
    }
  }

  startSpeechRecognitionWhenNeeded() {
    // Monitor for D-ID agent activity to start speech recognition
    const checkForActivity = () => {
      const didElements = document.querySelectorAll('[class*="did"], [id*="did"], iframe[src*="d-id"]');
      if (didElements.length > 0 && this.speechRecognition) {
        try {
          this.speechRecognition.start();
          console.log('🎙️ Speech recognition backup activated');
        } catch (error) {
          // Already running or not available
        }
      }
    };
    
    // Check periodically
    setInterval(checkForActivity, 5000);
    checkForActivity();
  }

  interceptDidInternalLogging() {
    // Try to access D-ID's internal logging if available
    if (window.did || window.DID || window.DidAgent) {
      console.log('🎯 D-ID object detected, attempting to hook into internal logging');
      // Hook into D-ID's internal event system if accessible
    }
  }

  processDataChannelMessage(data) {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        if (parsed.type === 'response' || parsed.message) {
          this.captureResponseText(parsed.message || parsed.response, 'datachannel');
        }
      }
    } catch (error) {
      // Not JSON data
    }
  }
}

// Initialize enhanced capture system
const enhancedCapture = new EnhancedDidAudioCapture();

// Export for use in other scripts
window.enhancedDidCapture = enhancedCapture;