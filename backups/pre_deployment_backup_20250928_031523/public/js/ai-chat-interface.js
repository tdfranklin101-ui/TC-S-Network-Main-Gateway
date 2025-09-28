/**
 * AI Chat Interface for The Current-See Solar Economy Platform
 * 
 * This module provides a comprehensive conversational AI interface that integrates
 * with the platform's existing AI services to offer:
 * - Natural language wallet queries and analysis
 * - Voice command support for wallet operations
 * - Multi-modal transaction analysis (image recognition, receipt processing)
 * - Real-time AI assistance during payment flows
 * - Contextual help and guidance
 * - Integration with existing Kid Solar assistant
 * 
 * Works with server-side AI Wallet Assistant and Market Intelligence services
 */

class AIChatInterface {
  constructor(options = {}) {
    // Configuration options
    this.options = {
      containerId: options.containerId || 'ai-chat-container',
      triggerId: options.triggerId || 'ai-chat-trigger', 
      apiBaseUrl: options.apiBaseUrl || '/api/ai',
      enableVoice: options.enableVoice !== false,
      enableImageAnalysis: options.enableImageAnalysis !== false,
      enableContextualHelp: options.enableContextualHelp !== false,
      theme: options.theme || 'solar',
      position: options.position || 'bottom-right',
      ...options
    };

    // State management
    this.state = {
      isOpen: false,
      isListening: false,
      isProcessing: false,
      conversationHistory: [],
      currentContext: null,
      userProfile: null,
      suggestions: []
    };

    // Voice recognition setup
    this.speechRecognition = null;
    this.speechSynthesis = window.speechSynthesis;
    this.voiceEnabled = false;

    // WebRTC for real-time features
    this.mediaStream = null;
    this.mediaRecorder = null;

    // Initialize the interface
    this.init();
  }

  /**
   * Initialize the AI Chat Interface
   */
  async init() {
    try {
      // Create DOM elements
      this.createChatInterface();
      
      // Set up voice recognition if supported and enabled
      if (this.options.enableVoice) {
        this.initializeVoiceRecognition();
      }

      // Set up image analysis if enabled
      if (this.options.enableImageAnalysis) {
        this.initializeImageAnalysis();
      }

      // Load user context
      await this.loadUserContext();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize contextual suggestions
      await this.loadContextualSuggestions();

      console.log('AI Chat Interface initialized successfully');

    } catch (error) {
      console.error('Failed to initialize AI Chat Interface:', error);
    }
  }

  /**
   * Create the chat interface DOM elements
   */
  createChatInterface() {
    // Remove existing interface if it exists
    const existing = document.getElementById(this.options.containerId);
    if (existing) {
      existing.remove();
    }

    // Create main container
    const container = document.createElement('div');
    container.id = this.options.containerId;
    container.className = `ai-chat-interface ${this.options.theme} ${this.options.position}`;
    
    // Apply positioning styles
    const positionStyles = this.getPositionStyles();
    Object.assign(container.style, positionStyles);

    container.innerHTML = `
      <!-- Chat Trigger Button -->
      <div id="${this.options.triggerId}" class="chat-trigger" title="Ask AI Assistant">
        <div class="trigger-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9" cy="9" r="1"/>
            <circle cx="15" cy="9" r="1"/>
            <path d="8 13s1.5 2 4 2 4-2 4-2"/>
          </svg>
        </div>
        <div class="trigger-pulse"></div>
      </div>

      <!-- Main Chat Window -->
      <div class="chat-window" id="chat-window" style="display: none;">
        <!-- Header -->
        <div class="chat-header">
          <div class="header-info">
            <div class="ai-avatar">
              <div class="solar-icon">☀️</div>
            </div>
            <div class="ai-info">
              <h3>Solar AI Assistant</h3>
              <span class="status-text" id="ai-status">Ready to help</span>
            </div>
          </div>
          <div class="header-controls">
            <button class="voice-toggle" id="voice-toggle" title="Voice Commands" ${!this.options.enableVoice ? 'style="display:none"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button class="minimize-btn" id="minimize-chat" title="Minimize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Quick Actions Bar -->
        <div class="quick-actions" id="quick-actions">
          <button class="quick-action" data-action="balance">
            <span class="action-icon">💰</span>
            <span>My Balance</span>
          </button>
          <button class="quick-action" data-action="transactions">
            <span class="action-icon">📊</span>
            <span>Recent Activity</span>
          </button>
          <button class="quick-action" data-action="recommendations">
            <span class="action-icon">🎯</span>
            <span>Suggestions</span>
          </button>
          <button class="quick-action" data-action="market">
            <span class="action-icon">📈</span>
            <span>Market Trends</span>
          </button>
        </div>

        <!-- Chat Messages -->
        <div class="chat-messages" id="chat-messages">
          <div class="welcome-message">
            <div class="message ai-message">
              <div class="message-avatar">☀️</div>
              <div class="message-content">
                <p>Hi! I'm your Solar AI Assistant. I can help you with:</p>
                <ul>
                  <li>💰 Check your Solar balance and spending patterns</li>
                  <li>📊 Analyze your transactions and provide insights</li>
                  <li>🎯 Recommend content based on your preferences</li>
                  <li>📈 Share market trends and pricing insights</li>
                  <li>🎤 Answer questions with voice commands</li>
                </ul>
                <p>Try asking: "How much Solar do I have?" or "What did I buy this week?"</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Suggestion Chips -->
        <div class="suggestion-chips" id="suggestion-chips">
          <!-- Dynamic suggestions will be loaded here -->
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <!-- File Upload for Images/Receipts -->
          <div class="file-upload-area" id="file-upload-area" style="display: none;" ${!this.options.enableImageAnalysis ? 'style="display:none"' : ''}>
            <div class="upload-indicator">
              <span>📎 Analyzing image...</span>
              <button class="cancel-upload" id="cancel-upload">✕</button>
            </div>
          </div>

          <div class="input-container">
            <button class="attach-btn" id="attach-btn" title="Upload image or receipt" ${!this.options.enableImageAnalysis ? 'style="display:none"' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
              </svg>
            </button>
            
            <input type="file" id="image-input" accept="image/*" style="display: none;">
            
            <div class="text-input-container">
              <textarea 
                id="chat-input" 
                placeholder="Ask me about your Solar wallet, market trends, or anything else..."
                rows="1"
              ></textarea>
              <button class="voice-input-btn" id="voice-input" title="Voice input" ${!this.options.enableVoice ? 'style="display:none"' : ''}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
              </button>
            </div>
            
            <button class="send-btn" id="send-message" title="Send message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22,2 15,22 11,13 2,9 22,2"/>
              </svg>
            </button>
          </div>

          <!-- Voice Recording Indicator -->
          <div class="voice-recording" id="voice-recording" style="display: none;">
            <div class="recording-animation">
              <div class="pulse"></div>
              <div class="mic-icon">🎤</div>
            </div>
            <span>Listening... Speak now</span>
            <button class="stop-recording" id="stop-recording">Stop</button>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    this.addStyles();

    // Append to body
    document.body.appendChild(container);
  }

  /**
   * Add CSS styles for the chat interface
   */
  addStyles() {
    const styleId = 'ai-chat-interface-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .ai-chat-interface {
        position: fixed;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .ai-chat-interface.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .ai-chat-interface.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .chat-trigger {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #FF8C00, #FFD700);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(255, 140, 0, 0.3);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }

      .chat-trigger:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 25px rgba(255, 140, 0, 0.4);
      }

      .trigger-icon {
        color: white;
        font-size: 24px;
        z-index: 2;
      }

      .trigger-pulse {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.4);
        }
        70% {
          box-shadow: 0 0 0 20px rgba(255, 140, 0, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(255, 140, 0, 0);
        }
      }

      .chat-window {
        width: 380px;
        height: 600px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: absolute;
        bottom: 80px;
        right: 0;
        transition: all 0.3s ease;
        border: 2px solid #FF8C00;
      }

      .chat-header {
        background: linear-gradient(135deg, #FF8C00, #FFD700);
        color: white;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .ai-avatar {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .ai-info h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .status-text {
        font-size: 12px;
        opacity: 0.9;
      }

      .header-controls {
        display: flex;
        gap: 8px;
      }

      .header-controls button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .header-controls button:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .quick-actions {
        display: flex;
        gap: 8px;
        padding: 15px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
        overflow-x: auto;
      }

      .quick-action {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 20px;
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        white-space: nowrap;
        transition: all 0.2s;
      }

      .quick-action:hover {
        background: #FF8C00;
        color: white;
        transform: translateY(-1px);
      }

      .chat-messages {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #f8f9fa;
      }

      .message {
        margin-bottom: 16px;
        display: flex;
        gap: 12px;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }

      .ai-message .message-avatar {
        background: linear-gradient(135deg, #FF8C00, #FFD700);
      }

      .user-message .message-avatar {
        background: #6c757d;
        color: white;
      }

      .message-content {
        background: white;
        padding: 12px 16px;
        border-radius: 18px;
        max-width: 280px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .user-message .message-content {
        background: #FF8C00;
        color: white;
        margin-left: auto;
      }

      .message-content p {
        margin: 0 0 8px 0;
      }

      .message-content p:last-child {
        margin-bottom: 0;
      }

      .message-content ul {
        margin: 8px 0;
        padding-left: 20px;
      }

      .message-content li {
        margin-bottom: 4px;
      }

      .suggestion-chips {
        padding: 0 20px 15px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .suggestion-chip {
        background: #e9ecef;
        border: none;
        border-radius: 15px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .suggestion-chip:hover {
        background: #FF8C00;
        color: white;
      }

      .chat-input-area {
        border-top: 1px solid #e9ecef;
        background: white;
      }

      .input-container {
        display: flex;
        align-items: flex-end;
        padding: 15px 20px;
        gap: 12px;
      }

      .attach-btn, .send-btn, .voice-input-btn {
        background: none;
        border: none;
        color: #6c757d;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .attach-btn:hover, .voice-input-btn:hover {
        background: #f8f9fa;
        color: #FF8C00;
      }

      .send-btn:hover {
        background: #FF8C00;
        color: white;
      }

      .text-input-container {
        flex: 1;
        position: relative;
        display: flex;
        align-items: flex-end;
      }

      #chat-input {
        flex: 1;
        border: 1px solid #dee2e6;
        border-radius: 20px;
        padding: 12px 50px 12px 16px;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        outline: none;
        max-height: 100px;
        min-height: 44px;
      }

      #chat-input:focus {
        border-color: #FF8C00;
        box-shadow: 0 0 0 2px rgba(255, 140, 0, 0.2);
      }

      .voice-input-btn {
        position: absolute;
        right: 8px;
        bottom: 8px;
      }

      .voice-recording {
        padding: 15px 20px;
        background: linear-gradient(135deg, #FF8C00, #FFD700);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        font-weight: 500;
      }

      .recording-animation {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pulse {
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        animation: recording-pulse 1s infinite;
      }

      @keyframes recording-pulse {
        0% {
          transform: scale(0.8);
          opacity: 1;
        }
        100% {
          transform: scale(1.4);
          opacity: 0;
        }
      }

      .mic-icon {
        font-size: 20px;
        z-index: 2;
      }

      .stop-recording {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        border-radius: 15px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
      }

      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: white;
        border-radius: 18px;
        margin-bottom: 16px;
      }

      .typing-dots {
        display: flex;
        gap: 4px;
      }

      .typing-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #FF8C00;
        animation: typing 1.4s infinite;
      }

      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% {
          transform: translateY(0);
        }
        30% {
          transform: translateY(-10px);
        }
      }

      .file-upload-area {
        background: #fff3cd;
        border-bottom: 1px solid #ffeaa7;
        padding: 12px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .upload-indicator {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: #856404;
      }

      .cancel-upload {
        background: none;
        border: none;
        color: #856404;
        cursor: pointer;
        font-weight: bold;
      }

      /* Responsive styles */
      @media (max-width: 480px) {
        .chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 100px);
          bottom: 80px;
          right: 20px;
          left: 20px;
        }
      }

      /* Animation classes */
      .slide-in {
        animation: slideIn 0.3s ease-out;
      }

      .slide-out {
        animation: slideOut 0.3s ease-in;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Get positioning styles based on options
   */
  getPositionStyles() {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' }
    };

    return positions[this.options.position] || positions['bottom-right'];
  }

  /**
   * Initialize voice recognition
   */
  initializeVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognition = new SpeechRecognition();
    
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onstart = () => {
      this.state.isListening = true;
      this.updateVoiceUI(true);
    };

    this.speechRecognition.onend = () => {
      this.state.isListening = false;
      this.updateVoiceUI(false);
    };

    this.speechRecognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        this.handleVoiceInput(transcript);
      }
    };

    this.speechRecognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.state.isListening = false;
      this.updateVoiceUI(false);
    };

    this.voiceEnabled = true;
  }

  /**
   * Initialize image analysis capabilities
   */
  initializeImageAnalysis() {
    // Set up drag and drop for images
    const chatWindow = document.getElementById('chat-window');
    
    if (chatWindow) {
      chatWindow.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatWindow.classList.add('drag-over');
      });

      chatWindow.addEventListener('dragleave', (e) => {
        e.preventDefault();
        chatWindow.classList.remove('drag-over');
      });

      chatWindow.addEventListener('drop', (e) => {
        e.preventDefault();
        chatWindow.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          this.handleImageUpload(imageFiles[0]);
        }
      });
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    const trigger = document.getElementById(this.options.triggerId);
    const chatWindow = document.getElementById('chat-window');
    const minimizeBtn = document.getElementById('minimize-chat');
    const sendBtn = document.getElementById('send-message');
    const chatInput = document.getElementById('chat-input');
    const voiceBtn = document.getElementById('voice-input');
    const attachBtn = document.getElementById('attach-btn');
    const imageInput = document.getElementById('image-input');
    const quickActions = document.querySelectorAll('.quick-action');

    // Chat trigger
    if (trigger) {
      trigger.addEventListener('click', () => this.toggleChat());
    }

    // Minimize chat
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.closeChat());
    }

    // Send message
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Input handling
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
      });
    }

    // Voice input
    if (voiceBtn && this.voiceEnabled) {
      voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
    }

    // File attachment
    if (attachBtn && imageInput) {
      attachBtn.addEventListener('click', () => imageInput.click());
      imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleImageUpload(e.target.files[0]);
        }
      });
    }

    // Quick actions
    quickActions.forEach(action => {
      action.addEventListener('click', () => {
        const actionType = action.dataset.action;
        this.handleQuickAction(actionType);
      });
    });

    // Close chat when clicking outside
    document.addEventListener('click', (e) => {
      if (this.state.isOpen && !e.target.closest('.ai-chat-interface')) {
        this.closeChat();
      }
    });
  }

  /**
   * Load user context and preferences
   */
  async loadUserContext() {
    try {
      const response = await fetch(`${this.options.apiBaseUrl}/user-context`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        this.state.userProfile = await response.json();
        this.updateUserContext();
      }
    } catch (error) {
      console.error('Failed to load user context:', error);
    }
  }

  /**
   * Load contextual suggestions based on current page and user state
   */
  async loadContextualSuggestions() {
    try {
      const currentPage = window.location.pathname;
      const context = {
        page: currentPage,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };

      const response = await fetch(`${this.options.apiBaseUrl}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(context)
      });

      if (response.ok) {
        const suggestions = await response.json();
        this.updateSuggestionChips(suggestions.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  }

  /**
   * Toggle chat window open/closed
   */
  toggleChat() {
    if (this.state.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  /**
   * Open chat window
   */
  openChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
      chatWindow.style.display = 'flex';
      chatWindow.classList.add('slide-in');
      this.state.isOpen = true;
      
      // Focus input
      setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
      }, 300);
    }
  }

  /**
   * Close chat window
   */
  closeChat() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
      chatWindow.classList.add('slide-out');
      setTimeout(() => {
        chatWindow.style.display = 'none';
        chatWindow.classList.remove('slide-in', 'slide-out');
      }, 300);
      this.state.isOpen = false;
    }
  }

  /**
   * Send message to AI
   */
  async sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message to chat
    this.addMessage(message, 'user');

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send to AI backend
      const response = await fetch(`${this.options.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          context: this.state.currentContext,
          conversationHistory: this.state.conversationHistory.slice(-10) // Last 10 messages
        })
      });

      this.hideTypingIndicator();

      if (response.ok) {
        const aiResponse = await response.json();
        this.handleAIResponse(aiResponse);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('Sorry, I encountered an error processing your request. Please try again.', 'ai');
      console.error('Error sending message:', error);
    }
  }

  /**
   * Handle AI response and display appropriate content
   */
  handleAIResponse(response) {
    // Add to conversation history
    this.state.conversationHistory.push({
      type: 'ai',
      content: response,
      timestamp: Date.now()
    });

    // Display main response
    if (response.message) {
      this.addMessage(response.message, 'ai');
    }

    // Handle structured data responses
    if (response.data) {
      this.displayStructuredData(response.data);
    }

    // Update suggestions if provided
    if (response.suggestions) {
      this.updateSuggestionChips(response.suggestions);
    }

    // Handle voice response if enabled
    if (response.speak && this.speechSynthesis) {
      this.speakResponse(response.speak);
    }

    // Update context for follow-up questions
    if (response.context) {
      this.state.currentContext = response.context;
    }
  }

  /**
   * Add message to chat display
   */
  addMessage(content, sender) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'ai' ? '☀️' : '👤';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (typeof content === 'string') {
      contentDiv.innerHTML = this.formatMessageContent(content);
    } else {
      contentDiv.appendChild(content);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add to conversation history
    this.state.conversationHistory.push({
      type: sender,
      content: typeof content === 'string' ? content : content.outerHTML,
      timestamp: Date.now()
    });
  }

  /**
   * Format message content with basic HTML and emoji support
   */
  formatMessageContent(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Display structured data responses (charts, tables, etc.)
   */
  displayStructuredData(data) {
    const container = document.createElement('div');
    container.className = 'structured-data';

    if (data.type === 'wallet_analysis') {
      container.appendChild(this.createWalletAnalysisWidget(data));
    } else if (data.type === 'transaction_list') {
      container.appendChild(this.createTransactionListWidget(data));
    } else if (data.type === 'recommendations') {
      container.appendChild(this.createRecommendationsWidget(data));
    } else if (data.type === 'market_trends') {
      container.appendChild(this.createMarketTrendsWidget(data));
    }

    this.addMessage(container, 'ai');
  }

  /**
   * Create wallet analysis widget
   */
  createWalletAnalysisWidget(data) {
    const widget = document.createElement('div');
    widget.className = 'wallet-analysis-widget';
    
    widget.innerHTML = `
      <div class="widget-header">
        <h4>💰 Wallet Analysis</h4>
      </div>
      <div class="balance-info">
        <div class="balance-item">
          <span class="label">Current Balance:</span>
          <span class="value">${data.balance || 0} SOLAR</span>
        </div>
        <div class="balance-item">
          <span class="label">This Week's Spending:</span>
          <span class="value">${data.weeklySpending || 0} SOLAR</span>
        </div>
        <div class="balance-item">
          <span class="label">Health Score:</span>
          <span class="value">${data.healthScore || 0}/100</span>
        </div>
      </div>
      ${data.insights ? `
        <div class="insights">
          <h5>Key Insights:</h5>
          <ul>
            ${data.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    return widget;
  }

  /**
   * Handle quick action buttons
   */
  async handleQuickAction(actionType) {
    const actions = {
      balance: "What's my current Solar balance and recent activity?",
      transactions: "Show me my recent transactions and spending patterns",
      recommendations: "What content do you recommend for me?",
      market: "What are the current market trends and pricing?"
    };

    if (actions[actionType]) {
      // Simulate typing the question
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = actions[actionType];
        await this.sendMessage();
      }
    }
  }

  /**
   * Handle voice input toggle
   */
  toggleVoiceInput() {
    if (this.state.isListening) {
      this.stopVoiceInput();
    } else {
      this.startVoiceInput();
    }
  }

  /**
   * Start voice input
   */
  startVoiceInput() {
    if (!this.speechRecognition) return;

    try {
      this.speechRecognition.start();
    } catch (error) {
      console.error('Error starting voice recognition:', error);
    }
  }

  /**
   * Stop voice input
   */
  stopVoiceInput() {
    if (this.speechRecognition) {
      this.speechRecognition.stop();
    }
  }

  /**
   * Handle voice input result
   */
  async handleVoiceInput(transcript) {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = transcript;
      await this.sendMessage();
    }
  }

  /**
   * Update voice UI state
   */
  updateVoiceUI(isListening) {
    const voiceRecording = document.getElementById('voice-recording');
    const inputContainer = document.querySelector('.input-container');
    
    if (voiceRecording && inputContainer) {
      if (isListening) {
        voiceRecording.style.display = 'flex';
        inputContainer.style.display = 'none';
      } else {
        voiceRecording.style.display = 'none';
        inputContainer.style.display = 'flex';
      }
    }
  }

  /**
   * Handle image upload for analysis
   */
  async handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;

    // Show upload indicator
    this.showUploadIndicator();

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('context', JSON.stringify(this.state.currentContext));

      const response = await fetch(`${this.options.apiBaseUrl}/analyze-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      this.hideUploadIndicator();

      if (response.ok) {
        const analysis = await response.json();
        this.handleImageAnalysisResponse(analysis);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      this.hideUploadIndicator();
      this.addMessage('Sorry, I had trouble analyzing that image. Please try again.', 'ai');
      console.error('Error analyzing image:', error);
    }
  }

  /**
   * Handle image analysis response
   */
  handleImageAnalysisResponse(analysis) {
    // Display the uploaded image
    const imageContainer = document.createElement('div');
    imageContainer.className = 'uploaded-image';
    
    const img = document.createElement('img');
    img.src = analysis.imageUrl || URL.createObjectURL(analysis.file);
    img.style.maxWidth = '200px';
    img.style.borderRadius = '8px';
    
    imageContainer.appendChild(img);
    this.addMessage(imageContainer, 'user');

    // Display AI analysis
    if (analysis.analysis) {
      this.addMessage(analysis.analysis, 'ai');
    }

    // Handle structured data from image
    if (analysis.data) {
      this.displayStructuredData(analysis.data);
    }
  }

  /**
   * Show/hide UI indicators
   */
  showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message ai-message';
    indicator.innerHTML = `
      <div class="message-avatar">☀️</div>
      <div class="typing-indicator">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span>Analyzing...</span>
      </div>
    `;

    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  showUploadIndicator() {
    const uploadArea = document.getElementById('file-upload-area');
    if (uploadArea) {
      uploadArea.style.display = 'flex';
    }
  }

  hideUploadIndicator() {
    const uploadArea = document.getElementById('file-upload-area');
    if (uploadArea) {
      uploadArea.style.display = 'none';
    }
  }

  /**
   * Update suggestion chips
   */
  updateSuggestionChips(suggestions) {
    const container = document.getElementById('suggestion-chips');
    if (!container) return;

    container.innerHTML = '';

    suggestions.slice(0, 4).forEach(suggestion => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = suggestion.text || suggestion;
      chip.addEventListener('click', async () => {
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = suggestion.text || suggestion;
          await this.sendMessage();
        }
      });
      container.appendChild(chip);
    });
  }

  /**
   * Speak AI response using text-to-speech
   */
  speakResponse(text) {
    if (!this.speechSynthesis) return;

    // Cancel any ongoing speech
    this.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;

    // Try to use a more natural voice if available
    const voices = this.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || voice.name.includes('Microsoft')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.speechSynthesis.speak(utterance);
  }

  /**
   * Update user context display
   */
  updateUserContext() {
    if (!this.state.userProfile) return;

    const statusText = document.getElementById('ai-status');
    if (statusText) {
      const balance = this.state.userProfile.solarBalance || 0;
      statusText.textContent = `${balance} SOLAR available`;
    }
  }

  /**
   * Public API methods
   */

  // Open chat programmatically
  open() {
    this.openChat();
  }

  // Close chat programmatically  
  close() {
    this.closeChat();
  }

  // Send message programmatically
  async sendQuery(message) {
    if (!this.state.isOpen) {
      this.openChat();
    }

    const input = document.getElementById('chat-input');
    if (input) {
      input.value = message;
      await this.sendMessage();
    }
  }

  // Update configuration
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  // Get conversation history
  getConversationHistory() {
    return this.state.conversationHistory;
  }

  // Clear conversation
  clearConversation() {
    this.state.conversationHistory = [];
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="message ai-message">
            <div class="message-avatar">☀️</div>
            <div class="message-content">
              <p>Conversation cleared. How can I help you?</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// Auto-initialize if not in module context
if (typeof window !== 'undefined' && !window.aiChatInterface) {
  window.aiChatInterface = new AIChatInterface();
}

// Export for module usage
export default AIChatInterface;