/**
 * Audio Feedback System for Current-See
 * 
 * This script provides ambient sound effects and voice feedback
 * for solar achievements and product scanning.
 * 
 * Features:
 * - Solar chimes on token earn
 * - "Wallet whisper" voice on scan
 * - General UI feedback sounds
 */

class SolarAudioFeedback {
  /**
   * Initialize the Audio Feedback system
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Feature flags - all enabled by default
    this.enableEarnChimes = options.enableEarnChimes !== false;
    this.enableScanWhisper = options.enableScanWhisper !== false;
    this.enableUiSounds = options.enableUiSounds !== false;
    
    // Volume settings (0.0 to 1.0)
    this.chimeVolume = options.chimeVolume || 0.5;
    this.voiceVolume = options.voiceVolume || 0.7;
    this.uiVolume = options.uiVolume || 0.3;
    
    // Speech synthesis options
    this.voiceRate = options.voiceRate || 1.0;
    this.voicePitch = options.voicePitch || 1.0;
    
    // Sound cache
    this.soundCache = {};
    
    // Initialize if audio is supported
    this.isAudioSupported = typeof window.AudioContext !== 'undefined' || 
                           typeof window.webkitAudioContext !== 'undefined';
    
    if (this.isAudioSupported) {
      this.init();
    } else {
      console.warn('Web Audio API not supported in this browser. Audio feedback disabled.');
    }
  }
  
  /**
   * Initialize the audio system
   */
  init() {
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
    
    // Load basic UI sounds
    if (this.enableUiSounds) {
      this.preloadSound('click', '/audio/ui-click.mp3');
      this.preloadSound('confirm', '/audio/ui-confirm.mp3');
      this.preloadSound('error', '/audio/ui-error.mp3');
    }
    
    // Load chime sounds for solar earnings
    if (this.enableEarnChimes) {
      this.preloadSound('earnChime', '/audio/solar-chime.mp3');
      this.preloadSound('achievement', '/audio/achievement.mp3');
    }
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Preload a sound file into cache
   * @param {string} id - Sound identifier
   * @param {string} url - Sound file URL
   */
  preloadSound(id, url) {
    // Don't attempt to load if URL doesn't exist in our file structure
    // This is a fallback for development environments
    
    // Create a placeholder that will be populated when sound is available
    this.soundCache[id] = {
      buffer: null,
      loading: true,
      source: null
    };
    
    // Try to fetch the sound, but don't fail if it doesn't exist
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Sound not found: ${url}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        this.soundCache[id].buffer = audioBuffer;
        this.soundCache[id].loading = false;
      })
      .catch(error => {
        console.warn(`Failed to load sound ${id}: ${error.message}`);
        this.soundCache[id].loading = false;
        
        // Create a silent buffer as fallback
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(2, sampleRate * 0.5, sampleRate);
        this.soundCache[id].buffer = buffer;
      });
  }
  
  /**
   * Play a sound from the cache
   * @param {string} id - Sound identifier
   * @param {Object} options - Playback options
   */
  playSound(id, options = {}) {
    // Skip if audio is not supported or disabled
    if (!this.isAudioSupported || !this.soundCache[id]) return;
    
    // If sound is still loading, wait a bit and try again
    if (this.soundCache[id].loading) {
      setTimeout(() => this.playSound(id, options), 100);
      return;
    }
    
    // Set up options with defaults
    const volume = options.volume || this.uiVolume;
    const loop = options.loop || false;
    const detune = options.detune || 0; // cents
    
    try {
      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = this.soundCache[id].buffer;
      source.loop = loop;
      if (detune !== 0) source.detune.value = detune;
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Store source for potential later manipulation
      this.soundCache[id].source = source;
      
      // Start playback
      source.start(0);
      
      // Return the source for caller to stop if needed
      return source;
    } catch (error) {
      console.warn(`Error playing sound ${id}: ${error.message}`);
    }
  }
  
  /**
   * Speak a message using speech synthesis
   * @param {string} message - Text to speak
   * @param {Object} options - Speech options
   */
  speak(message, options = {}) {
    // Skip if speech synthesis is not supported
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(message);
    
    // Set options with defaults
    utterance.rate = options.rate || this.voiceRate;
    utterance.pitch = options.pitch || this.voicePitch;
    utterance.volume = options.volume || this.voiceVolume;
    
    // Try to find a female voice if available
    if (!options.voice) {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('female') || 
        voice.name.includes('woman') ||
        voice.name.includes('girl')
      );
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
    } else {
      utterance.voice = options.voice;
    }
    
    // Speak the message
    window.speechSynthesis.speak(utterance);
  }
  
  /**
   * Set up event listeners for application events
   */
  setupEventListeners() {
    // Listen for solar earn events
    if (this.enableEarnChimes) {
      document.addEventListener('solar:earned', (event) => {
        this.playSolarEarnedSound(event.detail.amount);
      });
      
      document.addEventListener('achievement:unlocked', (event) => {
        this.playAchievementSound(event.detail);
      });
    }
    
    // Listen for product scan events
    if (this.enableScanWhisper) {
      document.addEventListener('product:scanned', (event) => {
        this.speakProductScanResult(event.detail);
      });
    }
    
    // Listen for UI interactions if enabled
    if (this.enableUiSounds) {
      document.addEventListener('click', (event) => {
        // Only play for buttons and links
        if (event.target.tagName === 'BUTTON' || 
            event.target.tagName === 'A' ||
            event.target.closest('button') ||
            event.target.closest('a')) {
          this.playSound('click', { volume: this.uiVolume });
        }
      });
    }
  }
  
  /**
   * Play a sound when solar tokens are earned
   * @param {number} amount - Amount of solar earned
   */
  playSolarEarnedSound(amount) {
    // Play a chime with pitch variance based on amount
    // Higher amounts = higher pitch
    const detune = Math.min(1200, amount * 100); // Maximum 1200 cents (one octave)
    this.playSound('earnChime', { 
      volume: this.chimeVolume,
      detune: detune
    });
    
    // Optionally speak the amount earned
    if (this.enableScanWhisper) {
      this.speak(`You earned ${amount} solar.`);
    }
  }
  
  /**
   * Play a sound when an achievement is unlocked
   * @param {Object} achievement - Achievement data
   */
  playAchievementSound(achievement) {
    this.playSound('achievement', { volume: this.chimeVolume * 1.2 });
    
    // Speak achievement details
    if (this.enableScanWhisper) {
      setTimeout(() => {
        this.speak(`Achievement unlocked: ${achievement.title}`, {
          rate: 0.9, // Slower for emphasis
          pitch: 1.2  // Higher pitch for excitement
        });
      }, 500); // Delay speech to let achievement sound play
    }
  }
  
  /**
   * Speak the result of a product scan
   * @param {Object} scanData - Product scan data
   */
  speakProductScanResult(scanData) {
    // Play a soft notification sound first
    this.playSound('confirm', { volume: this.uiVolume * 0.7 });
    
    // Construct the message based on scan data
    let message = '';
    
    if (scanData.name) {
      message += `${scanData.name}. `;
    }
    
    if (scanData.energyKwh) {
      message += `Energy impact: ${scanData.energyKwh} kilowatt hours. `;
    }
    
    if (scanData.ecoScore) {
      // Describe the eco score qualitatively
      let ecoDescription = 'neutral';
      if (scanData.ecoScore >= 80) ecoDescription = 'excellent';
      else if (scanData.ecoScore >= 60) ecoDescription = 'good';
      else if (scanData.ecoScore <= 30) ecoDescription = 'poor';
      
      message += `Eco score: ${ecoDescription}. `;
    }
    
    // Add recommendations if available
    if (scanData.recommendations && scanData.recommendations.length > 0) {
      message += 'Consider alternatives: ';
      scanData.recommendations.forEach((rec, index) => {
        if (index > 0) message += ', ';
        message += rec.name;
      });
      message += '.';
    }
    
    // Speak the complete message
    setTimeout(() => {
      this.speak(message, {
        rate: 1.1,
        pitch: 1.0
      });
    }, 300);
  }
  
  /**
   * Enable or disable audio features
   * @param {Object} options - Features to enable/disable
   */
  updateSettings(options = {}) {
    // Update feature flags
    if (options.enableEarnChimes !== undefined) {
      this.enableEarnChimes = options.enableEarnChimes;
    }
    
    if (options.enableScanWhisper !== undefined) {
      this.enableScanWhisper = options.enableScanWhisper;
    }
    
    if (options.enableUiSounds !== undefined) {
      this.enableUiSounds = options.enableUiSounds;
    }
    
    // Update volume settings
    if (options.chimeVolume !== undefined) {
      this.chimeVolume = options.chimeVolume;
    }
    
    if (options.voiceVolume !== undefined) {
      this.voiceVolume = options.voiceVolume;
    }
    
    if (options.uiVolume !== undefined) {
      this.uiVolume = options.uiVolume;
    }
    
    // Update speech synthesis options
    if (options.voiceRate !== undefined) {
      this.voiceRate = options.voiceRate;
    }
    
    if (options.voicePitch !== undefined) {
      this.voicePitch = options.voicePitch;
    }
  }
}

// Make globally available
window.SolarAudioFeedback = SolarAudioFeedback;