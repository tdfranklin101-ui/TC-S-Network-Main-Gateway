/**
 * Voice-Guided Energy Tracking Assistant for The Current-See
 * 
 * This module provides voice-based interaction with an AI assistant
 * focused on energy conservation, solar tracking, and The Current-See ecosystem.
 * Features multilingual support and accessibility features.
 */

class VoiceAssistant {
  constructor(options = {}) {
    // Configuration options
    this.options = {
      containerId: 'voice-assistant-container',
      triggerButtonId: 'voice-assistant-trigger',
      apiEndpoint: '/api/voice-assistant',
      defaultLanguage: 'en',
      voiceName: null, // Will be set based on language
      ...options
    };
    
    // State management
    this.state = {
      listening: false,
      speaking: false,
      processingQuery: false,
      currentLanguage: localStorage.getItem('preferredLanguage') || this.options.defaultLanguage,
      transcript: '',
      conversationHistory: []
    };
    
    // Speech recognition setup
    this.recognition = null;
    this.speechSynthesis = window.speechSynthesis;
    
    // Knowledge base about energy conservation and The Current-See
    this.knowledgeBase = {
      energyConservation: [
        "Turning off lights when not in use can save up to 10% on your energy bills",
        "Energy-efficient appliances can reduce your energy consumption by 30-50%",
        "Smart thermostats can reduce heating and cooling costs by 10-15%",
        "Solar panels typically pay for themselves in 6-10 years through energy savings",
        "LED bulbs use up to 80% less energy than traditional incandescent bulbs"
      ],
      solarBenefits: [
        "Solar energy is renewable, abundant, and produces no harmful emissions",
        "The sun delivers more energy to Earth in one hour than humanity uses in a year",
        "Solar panel efficiency has improved dramatically while costs have decreased by 70% since 2010",
        "Distributed solar systems reduce strain on the electrical grid during peak demand",
        "Solar energy creates jobs and economic opportunities in manufacturing and installation"
      ],
      currentSeeSystem: [
        "The Current-See tracks global solar energy production in real-time",
        "Each user receives a daily SOLAR token allocation representing real energy value",
        "SOLAR tokens are backed by the actual kilowatt-hours of energy produced globally",
        "The Current-See creates a more equitable distribution of energy value worldwide",
        "Your SOLAR balance represents your share of the global solar energy economy"
      ]
    };
    
    // Initialize the assistant when the DOM is ready
    document.addEventListener('DOMContentLoaded', () => this.init());
  }
  
  /**
   * Initialize the voice assistant
   */
  init() {
    this.setupDOMElements();
    this.setupSpeechRecognition();
    this.setupEventListeners();
    
    // Listen for language changes from the language translator
    document.addEventListener('languageChanged', (e) => {
      this.setLanguage(e.detail.language);
    });
    
    console.log('Voice Assistant initialized');
  }
  
  /**
   * Set up the DOM elements needed for the voice assistant
   */
  setupDOMElements() {
    // Get or create the container
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = this.options.containerId;
      document.body.appendChild(this.container);
    }
    
    // Style the container
    this.container.classList.add('voice-assistant');
    
    // Create the UI components
    this.createUI();
  }
  
  /**
   * Create the UI for the voice assistant
   */
  createUI() {
    this.container.innerHTML = `
      <button id="${this.options.triggerButtonId}" class="voice-trigger" aria-label="Activate voice assistant">
        <div class="voice-icon">
          <span class="mic-icon"></span>
          <span class="pulse-ring"></span>
        </div>
      </button>
      <div class="voice-panel">
        <div class="voice-panel-header">
          <h3 class="voice-panel-title">Energy Assistant</h3>
          <button class="voice-panel-close" aria-label="Close voice assistant">×</button>
        </div>
        <div class="voice-conversation">
          <div class="voice-messages"></div>
        </div>
        <div class="voice-input-container">
          <input type="text" class="voice-text-input" placeholder="Ask about energy conservation..." />
          <button class="voice-send-btn" aria-label="Send message">Send</button>
          <button class="voice-mic-btn" aria-label="Speak">
            <span class="mic-icon"></span>
          </button>
        </div>
        <div class="voice-suggestions">
          <button class="suggestion-chip">How does solar tracking work?</button>
          <button class="suggestion-chip">Energy conservation tips</button>
          <button class="suggestion-chip">My SOLAR balance</button>
          <button class="suggestion-chip">Current-See ecosystem</button>
        </div>
      </div>
    `;
    
    // Get references to the UI elements
    this.triggerButton = document.getElementById(this.options.triggerButtonId);
    this.voicePanel = this.container.querySelector('.voice-panel');
    this.closeButton = this.container.querySelector('.voice-panel-close');
    this.messagesContainer = this.container.querySelector('.voice-messages');
    this.textInput = this.container.querySelector('.voice-text-input');
    this.sendButton = this.container.querySelector('.voice-send-btn');
    this.micButton = this.container.querySelector('.voice-mic-btn');
    this.suggestionChips = this.container.querySelectorAll('.suggestion-chip');
    
    // Style the voice assistant based on the site's theme
    this.applyThemeStyles();
  }
  
  /**
   * Apply theme styles to match the website
   */
  applyThemeStyles() {
    // Add the CSS to the document
    if (!document.getElementById('voice-assistant-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'voice-assistant-styles';
      styleSheet.textContent = `
        .voice-assistant {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .voice-trigger {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: var(--primary-color, #7bc144);
          border: none;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        
        .voice-trigger:hover {
          transform: scale(1.05);
          background-color: var(--primary-dark, #5a9c28);
        }
        
        .voice-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .mic-icon {
          width: 24px;
          height: 24px;
          background-color: white;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z'%3E%3C/path%3E%3Cpath d='M19 10v2a7 7 0 0 1-14 0v-2'%3E%3C/path%3E%3Cline x1='12' x2='12' y1='19' y2='22'%3E%3C/line%3E%3C/svg%3E") no-repeat 50% 50%;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z'%3E%3C/path%3E%3Cpath d='M19 10v2a7 7 0 0 1-14 0v-2'%3E%3C/path%3E%3Cline x1='12' x2='12' y1='19' y2='22'%3E%3C/line%3E%3C/svg%3E") no-repeat 50% 50%;
        }
        
        .pulse-ring {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid white;
          opacity: 0;
          transform: scale(0.8);
        }
        
        .listening .pulse-ring {
          animation: pulse 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        
        @keyframes pulse {
          0% {
            opacity: 0.5;
            transform: scale(0.8);
          }
          50% {
            opacity: 0;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(0.8);
          }
        }
        
        .voice-panel {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 350px;
          max-width: 100vw;
          max-height: 500px;
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform-origin: bottom right;
          transform: scale(0);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        .voice-panel.active {
          transform: scale(1);
          opacity: 1;
        }
        
        .voice-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px;
          background-color: var(--primary-color, #7bc144);
          color: white;
        }
        
        .voice-panel-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .voice-panel-close {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        
        .voice-conversation {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 300px;
        }
        
        .voice-messages {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .message {
          max-width: 80%;
          padding: 10px 15px;
          border-radius: 18px;
          margin-bottom: 5px;
          position: relative;
          animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
          align-self: flex-end;
          background-color: var(--primary-light, #a0d86c);
          color: var(--text-dark, #333);
          border-bottom-right-radius: 5px;
        }
        
        .message.assistant {
          align-self: flex-start;
          background-color: var(--bg-medium, #f3f3f3);
          color: var(--text-dark, #333);
          border-bottom-left-radius: 5px;
        }
        
        .voice-input-container {
          display: flex;
          padding: 10px;
          border-top: 1px solid var(--bg-medium, #f3f3f3);
        }
        
        .voice-text-input {
          flex: 1;
          border: 1px solid var(--bg-medium, #f3f3f3);
          border-radius: 20px;
          padding: 8px 15px;
          font-size: 0.9rem;
        }
        
        .voice-send-btn, .voice-mic-btn {
          background-color: var(--primary-color, #7bc144);
          color: white;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          margin-left: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease;
        }
        
        .voice-send-btn:hover, .voice-mic-btn:hover {
          background-color: var(--primary-dark, #5a9c28);
        }
        
        .voice-mic-btn .mic-icon {
          width: 18px;
          height: 18px;
        }
        
        .voice-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid var(--bg-medium, #f3f3f3);
        }
        
        .suggestion-chip {
          background-color: var(--bg-light, #f9f9f9);
          border: 1px solid var(--bg-medium, #f3f3f3);
          border-radius: 16px;
          padding: 5px 12px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background-color 0.2s ease;
          white-space: nowrap;
        }
        
        .suggestion-chip:hover {
          background-color: var(--bg-medium, #f3f3f3);
        }
        
        /* Mobile responsive styles */
        @media (max-width: 480px) {
          .voice-panel {
            width: calc(100vw - 40px);
            max-height: 70vh;
            bottom: 70px;
          }
          
          .voice-trigger {
            width: 50px;
            height: 50px;
          }
          
          .mic-icon {
            width: 20px;
            height: 20px;
          }
        }
        
        /* Accessibility styles */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
        
        /* Listening state */
        .listening .mic-icon {
          animation: pulse-mic 1.5s infinite;
        }
        
        @keyframes pulse-mic {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        /* Additional accessibility features */
        .voice-trigger:focus, .voice-panel-close:focus, .voice-text-input:focus,
        .voice-send-btn:focus, .voice-mic-btn:focus, .suggestion-chip:focus {
          outline: 2px solid var(--secondary-color, #3498db);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }
  
  /**
   * Set up speech recognition
   */
  setupSpeechRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      this.showUnsupportedMessage();
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = this.mapLanguageCode(this.state.currentLanguage);
    
    // Set up recognition event handlers
    this.recognition.onstart = () => {
      this.setState({ listening: true });
      this.micButton.classList.add('listening');
      this.triggerButton.classList.add('listening');
    };
    
    this.recognition.onend = () => {
      this.setState({ listening: false });
      this.micButton.classList.remove('listening');
      this.triggerButton.classList.remove('listening');
      
      // If we have transcript and are not still processing, handle it
      if (this.state.transcript && !this.state.processingQuery) {
        this.handleUserInput(this.state.transcript);
      }
    };
    
    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      
      this.setState({ transcript });
      this.textInput.value = transcript;
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      this.addMessage(
        'I had trouble hearing you. Please try again or type your question.',
        'assistant'
      );
      this.setState({ listening: false });
      this.micButton.classList.remove('listening');
      this.triggerButton.classList.remove('listening');
    };
  }
  
  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Toggle voice panel visibility
    this.triggerButton.addEventListener('click', () => {
      this.togglePanel();
    });
    
    // Close panel with the X button
    this.closeButton.addEventListener('click', () => {
      this.hidePanel();
    });
    
    // Handle send button clicks
    this.sendButton.addEventListener('click', () => {
      const text = this.textInput.value.trim();
      if (text) {
        this.handleUserInput(text);
      }
    });
    
    // Handle microphone button clicks
    this.micButton.addEventListener('click', () => {
      if (this.state.listening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
    
    // Handle input field keypress (Enter)
    this.textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const text = this.textInput.value.trim();
        if (text) {
          this.handleUserInput(text);
        }
      }
    });
    
    // Handle suggestion chips
    this.suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim();
        this.handleUserInput(text);
      });
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.voicePanel.classList.contains('active') && 
          !this.container.contains(e.target)) {
        this.hidePanel();
      }
    });
    
    // Handle keyboard accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.voicePanel.classList.contains('active')) {
        this.hidePanel();
      }
    });
  }
  
  /**
   * Toggle the visibility of the voice assistant panel
   */
  togglePanel() {
    if (this.voicePanel.classList.contains('active')) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }
  
  /**
   * Show the voice assistant panel
   */
  showPanel() {
    this.voicePanel.classList.add('active');
    this.textInput.focus();
    
    // If this is the first time showing the panel, add a welcome message
    if (this.state.conversationHistory.length === 0) {
      this.addWelcomeMessage();
    }
  }
  
  /**
   * Hide the voice assistant panel
   */
  hidePanel() {
    this.voicePanel.classList.remove('active');
    if (this.state.listening) {
      this.stopListening();
    }
  }
  
  /**
   * Add a welcome message when the assistant is first opened
   */
  addWelcomeMessage() {
    const now = new Date();
    const hour = now.getHours();
    
    let greeting = 'Hello';
    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 18) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }
    
    const welcomeMessage = `${greeting}! I'm your Current-See Energy Assistant. I can help you track energy usage, learn about solar energy, and understand The Current-See ecosystem. How can I assist you today?`;
    
    this.addMessage(welcomeMessage, 'assistant');
  }
  
  /**
   * Start listening for voice input
   */
  startListening() {
    if (!this.recognition) {
      this.setupSpeechRecognition();
      if (!this.recognition) return;
    }
    
    try {
      this.recognition.start();
      this.setState({ transcript: '' });
    } catch (error) {
      console.error('Error starting speech recognition', error);
    }
  }
  
  /**
   * Stop listening for voice input
   */
  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition', error);
      }
    }
  }
  
  /**
   * Handle user input from either voice or text
   */
  handleUserInput(text) {
    if (!text) return;
    
    // Add the user's message to the conversation
    this.addMessage(text, 'user');
    
    // Clear the input field
    this.textInput.value = '';
    this.setState({ transcript: '', processingQuery: true });
    
    // Process the query
    this.processQuery(text)
      .then(response => {
        // Add the assistant's response
        this.addMessage(response, 'assistant');
        
        // Speak the response if appropriate
        if (this.shouldSpeak()) {
          this.speakText(response);
        }
      })
      .catch(error => {
        console.error('Error processing query', error);
        this.addMessage("I'm sorry, I encountered an error processing your request. Please try again.", 'assistant');
      })
      .finally(() => {
        this.setState({ processingQuery: false });
      });
  }
  
  /**
   * Process a query and generate a response
   */
  async processQuery(query) {
    // First, check if we can answer from our knowledge base
    const localResponse = this.getResponseFromKnowledgeBase(query);
    if (localResponse) {
      return localResponse;
    }
    
    // Try to get a response from the server API
    try {
      // Add typing indicator
      this.addTypingIndicator();
      
      // Try to use the API endpoint if it's available
      const response = await fetch(this.options.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          language: this.state.currentLanguage,
          history: this.state.conversationHistory
        }),
      });
      
      // Remove typing indicator
      this.removeTypingIndicator();
      
      if (!response.ok) {
        throw new Error('Error fetching response from API');
      }
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error calling API, falling back to local response', error);
      
      // Remove typing indicator
      this.removeTypingIndicator();
      
      // Fallback to a generic response about The Current-See
      return this.getFallbackResponse(query);
    }
  }
  
  /**
   * Get a response from the local knowledge base
   */
  getResponseFromKnowledgeBase(query) {
    query = query.toLowerCase();
    
    // Check for energy conservation queries
    if (query.includes('energy conservation') || 
        query.includes('save energy') || 
        query.includes('energy tips')) {
      return `Here are some energy conservation tips:\n\n${this.getRandomItemsFromArray(this.knowledgeBase.energyConservation, 3).join('\n\n')}`;
    }
    
    // Check for solar benefit queries
    if (query.includes('solar benefit') || 
        query.includes('why solar') || 
        query.includes('solar energy')) {
      return `Here are some benefits of solar energy:\n\n${this.getRandomItemsFromArray(this.knowledgeBase.solarBenefits, 3).join('\n\n')}`;
    }
    
    // Check for Current-See system queries
    if (query.includes('current-see') || 
        query.includes('how does it work') || 
        query.includes('solar token') ||
        query.includes('system')) {
      return `Here's how The Current-See works:\n\n${this.getRandomItemsFromArray(this.knowledgeBase.currentSeeSystem, 3).join('\n\n')}`;
    }
    
    // Check for specific balance questions
    if (query.includes('my balance') || 
        query.includes('my solar') || 
        query.includes('my token')) {
      return "To view your SOLAR balance, you need to log in to your Current-See wallet. You can access it by clicking on the 'Wallet Demo' button in the navigation menu. Once logged in, your balance will be displayed on your dashboard.";
    }
    
    // If no match, return null to try the API
    return null;
  }
  
  /**
   * Get random items from an array
   */
  getRandomItemsFromArray(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
  }
  
  /**
   * Get a fallback response when the API is not available
   */
  getFallbackResponse(query) {
    const fallbackResponses = [
      "The Current-See is a solar-backed global economic system that distributes daily energy value to all participants. Would you like to learn more about how it works?",
      "Solar energy is the most abundant energy source on Earth. The Current-See tracks global solar generation and distributes its value equitably. How else can I help you understand our system?",
      "Our mission is to create a more equitable financial future through solar energy distribution. Each user receives SOLAR tokens daily representing real energy value. Would you like more details on this process?",
      "Energy conservation is a key part of creating a sustainable future. The Current-See rewards efficient energy use and solar adoption. Can I share some energy-saving tips with you?",
      "As a Current-See member, you're part of a global community working toward a more sustainable and equitable energy economy. How else can I assist you today?"
    ];
    
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }
  
  /**
   * Add a message to the conversation
   */
  addMessage(text, sender) {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = text;
    
    // Add to conversation history
    this.state.conversationHistory.push({
      role: sender,
      content: text
    });
    
    // Add to UI
    this.messagesContainer.appendChild(messageElement);
    
    // Scroll to the bottom
    this.scrollToBottom();
  }
  
  /**
   * Add a typing indicator while waiting for a response
   */
  addTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'assistant', 'typing-indicator');
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    this.messagesContainer.appendChild(typingIndicator);
    this.scrollToBottom();
  }
  
  /**
   * Remove the typing indicator
   */
  removeTypingIndicator() {
    const typingIndicator = this.messagesContainer.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  /**
   * Scroll the conversation to the bottom
   */
  scrollToBottom() {
    const conversation = this.container.querySelector('.voice-conversation');
    conversation.scrollTop = conversation.scrollHeight;
  }
  
  /**
   * Determine if the assistant should speak its responses
   */
  shouldSpeak() {
    // By default, speak responses after voice input
    return this.state.listening || 
           localStorage.getItem('assistantSpeakResponses') === 'true';
  }
  
  /**
   * Speak text using the Web Speech API
   */
  speakText(text) {
    if (!this.speechSynthesis) return;
    
    // Stop any current speech
    this.speechSynthesis.cancel();
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language and voice
    utterance.lang = this.mapLanguageCode(this.state.currentLanguage);
    
    // Try to find an appropriate voice
    const voices = this.speechSynthesis.getVoices();
    const languageVoices = voices.filter(voice => voice.lang.startsWith(utterance.lang.split('-')[0]));
    
    if (languageVoices.length > 0) {
      // Prefer female voices if available (they tend to be clearer)
      const femaleVoices = languageVoices.filter(voice => voice.name.includes('Female') || voice.name.includes('female'));
      if (femaleVoices.length > 0) {
        utterance.voice = femaleVoices[0];
      } else {
        utterance.voice = languageVoices[0];
      }
    }
    
    // Set other properties
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Set state and speak
    this.setState({ speaking: true });
    
    utterance.onend = () => {
      this.setState({ speaking: false });
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error', event);
      this.setState({ speaking: false });
    };
    
    this.speechSynthesis.speak(utterance);
  }
  
  /**
   * Set the language for the voice assistant
   */
  setLanguage(languageCode) {
    this.setState({ currentLanguage: languageCode });
    
    if (this.recognition) {
      this.recognition.lang = this.mapLanguageCode(languageCode);
    }
    
    // Update placeholder text based on language
    if (this.textInput) {
      switch (languageCode) {
        case 'es':
          this.textInput.placeholder = 'Pregunte sobre conservación de energía...';
          break;
        case 'fr':
          this.textInput.placeholder = 'Demandez sur l\'économie d\'énergie...';
          break;
        case 'de':
          this.textInput.placeholder = 'Fragen Sie zur Energieeinsparung...';
          break;
        case 'zh-CN':
          this.textInput.placeholder = '询问关于节能的问题...';
          break;
        case 'ja':
          this.textInput.placeholder = 'エネルギー節約について質問してください...';
          break;
        default:
          this.textInput.placeholder = 'Ask about energy conservation...';
      }
    }
  }
  
  /**
   * Map language codes to speech recognition format
   */
  mapLanguageCode(code) {
    const languageMap = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'zh-CN': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'ru': 'ru-RU',
      'pt': 'pt-BR',
      'hi': 'hi-IN'
    };
    
    return languageMap[code] || 'en-US';
  }
  
  /**
   * Show a message when speech recognition is not supported
   */
  showUnsupportedMessage() {
    // Add a message to the container indicating lack of support
    const unsupportedMessage = document.createElement('div');
    unsupportedMessage.classList.add('unsupported-message');
    unsupportedMessage.innerHTML = `
      <p>Your browser doesn't support voice recognition.</p>
      <p>You can still type your questions!</p>
    `;
    
    // Add this to the UI when needed
    if (this.messagesContainer) {
      this.messagesContainer.appendChild(unsupportedMessage);
    }
  }
  
  /**
   * Update the assistant's state
   */
  setState(newState) {
    this.state = {
      ...this.state,
      ...newState
    };
  }
}

// Create a global instance
window.voiceAssistant = new VoiceAssistant();

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.voiceAssistant.init();
});