/**
 * Timer UI Component - Visual interface for timer-gated progression
 * Integrates with ProgressionManager to display timers, buttons, and payment flows
 */

class TimerUI {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    
    this.contentType = options.contentType || 'unknown';
    this.contentId = options.contentId || 'unknown';
    this.solarCost = options.solarCost || 50;
    this.timerDuration = options.timerDuration || 60; // seconds
    this.previewDuration = options.previewDuration || 30; // seconds
    this.title = options.title || 'Content';
    this.description = options.description || '';
    
    this.currentState = 'loading';
    this.timeRemaining = 0;
    this.elements = {};
    
    this.init();
  }

  /**
   * Initialize the timer UI
   */
  init() {
    this.render();
    this.attachEventListeners();
    this.updateFromProgressionManager();
    
    // Listen to progression manager events
    if (window.ProgressionManager) {
      window.ProgressionManager.on('timerTick', (data) => {
        if (data.contentType === this.contentType && data.contentId === this.contentId) {
          this.updateTimer(data.timeRemaining);
        }
      });
      
      window.ProgressionManager.on('timerCompleted', (data) => {
        if (data.progression.contentType === this.contentType && data.progression.contentId === this.contentId) {
          this.updateState('timer_complete');
        }
      });
      
      window.ProgressionManager.on('contentUnlocked', (data) => {
        if (data.contentType === this.contentType && data.contentId === this.contentId) {
          this.updateState('unlocked');
        }
      });
      
      window.ProgressionManager.on('userRegistered', () => {
        this.updateFromProgressionManager();
      });
      
      window.ProgressionManager.on('balanceUpdated', () => {
        this.updateFromProgressionManager();
      });
    }
  }

  /**
   * Render the timer UI
   */
  render() {
    this.container.innerHTML = `
      <div class="timer-ui" data-testid="timer-ui-${this.contentId}">
        <div class="timer-header">
          <h3 class="timer-title" data-testid="timer-title">${this.title}</h3>
          <div class="timer-status" data-testid="timer-status">
            <span class="status-text">Loading...</span>
            <span class="status-icon">⏳</span>
          </div>
        </div>
        
        <div class="timer-content">
          <div class="timer-display" data-testid="timer-display">
            <div class="timer-circle">
              <svg class="timer-progress" width="120" height="120">
                <circle 
                  class="progress-track" 
                  cx="60" 
                  cy="60" 
                  r="50" 
                  fill="none" 
                  stroke="#333" 
                  stroke-width="8"
                />
                <circle 
                  class="progress-bar" 
                  cx="60" 
                  cy="60" 
                  r="50" 
                  fill="none" 
                  stroke="#FFD700" 
                  stroke-width="8" 
                  stroke-linecap="round"
                  transform="rotate(-90 60 60)"
                  stroke-dasharray="314.16"
                  stroke-dashoffset="314.16"
                />
              </svg>
              <div class="timer-text" data-testid="timer-text">
                <span class="time-remaining">--:--</span>
                <span class="timer-label">remaining</span>
              </div>
            </div>
          </div>
          
          <div class="timer-description" data-testid="timer-description">
            ${this.description}
          </div>
        </div>
        
        <div class="timer-actions">
          <button class="action-button primary" data-testid="primary-action-button" disabled>
            <span class="button-icon">🔒</span>
            <span class="button-text">Loading...</span>
          </button>
          
          <button class="action-button secondary" data-testid="secondary-action-button" style="display: none;">
            <span class="button-text">Register</span>
          </button>
          
          <div class="user-info" data-testid="user-info" style="display: none;">
            <div class="solar-balance">
              <span class="balance-icon">☀️</span>
              <span class="balance-text" data-testid="solar-balance">0 Solar</span>
            </div>
            <button class="topup-button" data-testid="topup-button">Top Up</button>
          </div>
        </div>
        
        <div class="timer-help" data-testid="timer-help">
          <p class="help-text"></p>
        </div>
      </div>
    `;
    
    // Cache element references
    this.elements = {
      statusText: this.container.querySelector('.status-text'),
      statusIcon: this.container.querySelector('.status-icon'),
      progressBar: this.container.querySelector('.progress-bar'),
      timeRemaining: this.container.querySelector('.time-remaining'),
      timerLabel: this.container.querySelector('.timer-label'),
      primaryButton: this.container.querySelector('.action-button.primary'),
      secondaryButton: this.container.querySelector('.action-button.secondary'),
      userInfo: this.container.querySelector('.user-info'),
      solarBalance: this.container.querySelector('.balance-text'),
      topupButton: this.container.querySelector('.topup-button'),
      helpText: this.container.querySelector('.help-text')
    };
    
    this.addStyles();
  }

  /**
   * Add CSS styles for the timer UI
   */
  addStyles() {
    if (document.getElementById('timer-ui-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'timer-ui-styles';
    style.textContent = `
      .timer-ui {
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #FFD700;
        border-radius: 15px;
        padding: 20px;
        color: white;
        font-family: Arial, sans-serif;
        max-width: 400px;
        margin: 0 auto;
        text-align: center;
      }
      
      .timer-header {
        margin-bottom: 20px;
      }
      
      .timer-title {
        color: #FFD700;
        margin: 0 0 10px 0;
        font-size: 1.5em;
      }
      
      .timer-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 1.1em;
      }
      
      .timer-display {
        margin: 20px 0;
      }
      
      .timer-circle {
        position: relative;
        display: inline-block;
      }
      
      .timer-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      
      .time-remaining {
        display: block;
        font-size: 1.8em;
        font-weight: bold;
        color: #FFD700;
        font-family: 'Courier New', monospace;
      }
      
      .timer-label {
        display: block;
        font-size: 0.9em;
        color: #ccc;
        margin-top: 4px;
      }
      
      .progress-track {
        opacity: 0.3;
      }
      
      .progress-bar {
        transition: stroke-dashoffset 0.5s ease;
      }
      
      .timer-description {
        color: #ccc;
        font-size: 0.95em;
        line-height: 1.4;
        margin: 15px 0;
      }
      
      .timer-actions {
        margin: 20px 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
      }
      
      .action-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 200px;
      }
      
      .action-button.primary {
        background: linear-gradient(45deg, #FFD700, #FFA500);
        color: #000;
      }
      
      .action-button.primary:hover:not(:disabled) {
        background: linear-gradient(45deg, #FFA500, #FF8C00);
        transform: translateY(-2px);
      }
      
      .action-button.primary:disabled {
        background: #666;
        color: #999;
        cursor: not-allowed;
        transform: none;
      }
      
      .action-button.secondary {
        background: transparent;
        border: 2px solid #FFD700;
        color: #FFD700;
      }
      
      .action-button.secondary:hover {
        background: #FFD700;
        color: #000;
      }
      
      .user-info {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-top: 10px;
      }
      
      .solar-balance {
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: bold;
        color: #FFD700;
      }
      
      .topup-button {
        padding: 6px 12px;
        background: #007AFF;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.9em;
        cursor: pointer;
        transition: background 0.3s ease;
      }
      
      .topup-button:hover {
        background: #0051D0;
      }
      
      .timer-help {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #333;
      }
      
      .help-text {
        color: #aaa;
        font-size: 0.9em;
        margin: 0;
        line-height: 1.3;
      }
      
      /* State-specific styles */
      .timer-ui.state-locked .progress-bar {
        stroke: #666;
      }
      
      .timer-ui.state-timer-active .progress-bar {
        stroke: #FFD700;
      }
      
      .timer-ui.state-timer-complete .progress-bar {
        stroke: #34C759;
      }
      
      .timer-ui.state-unlocked .progress-bar {
        stroke: #34C759;
      }
      
      /* Animations */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      .timer-ui.state-timer-active .timer-text {
        animation: pulse 2s infinite;
      }
      
      .timer-ui.state-timer-complete .status-icon {
        animation: pulse 1s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.elements.primaryButton.addEventListener('click', () => {
      this.handlePrimaryAction();
    });
    
    this.elements.secondaryButton.addEventListener('click', () => {
      this.handleSecondaryAction();
    });
    
    this.elements.topupButton.addEventListener('click', () => {
      this.handleTopUpAction();
    });
  }

  /**
   * Update UI based on ProgressionManager state
   */
  async updateFromProgressionManager() {
    if (!window.ProgressionManager?.initialized) {
      setTimeout(() => this.updateFromProgressionManager(), 100);
      return;
    }
    
    const progressionManager = window.ProgressionManager;
    
    // Get current progression status
    const status = progressionManager.getProgressionStatus(this.contentType, this.contentId);
    
    // Update state
    this.updateState(status.accessType, status);
    
    // Update user info
    if (progressionManager.isUserRegistered()) {
      this.showUserInfo();
      this.updateSolarBalance(progressionManager.getUserBalance());
    } else {
      this.hideUserInfo();
    }
  }

  /**
   * Update the current state
   */
  updateState(newState, statusData = {}) {
    this.currentState = newState;
    this.container.className = `timer-ui state-${newState}`;
    
    switch (newState) {
      case 'preview':
      case 'locked':
        this.showLockedState();
        break;
      case 'timer_active':
        this.showTimerActiveState(statusData.timeRemaining || 0);
        break;
      case 'timer_complete':
        this.showTimerCompleteState();
        break;
      case 'full':
      case 'unlocked':
        this.showUnlockedState();
        break;
      default:
        this.showLoadingState();
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.elements.statusText.textContent = 'Loading...';
    this.elements.statusIcon.textContent = '⏳';
    this.elements.primaryButton.disabled = true;
    this.elements.primaryButton.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Loading...</span>';
    this.elements.secondaryButton.style.display = 'none';
    this.elements.helpText.textContent = 'Checking access status...';
  }

  /**
   * Show locked/preview state
   */
  showLockedState() {
    this.elements.statusText.textContent = 'Preview Available';
    this.elements.statusIcon.textContent = '🔒';
    this.elements.timeRemaining.textContent = this.formatTime(this.previewDuration);
    this.elements.timerLabel.textContent = 'preview time';
    this.updateProgress(0);
    
    if (window.ProgressionManager?.isUserRegistered()) {
      // Registered user - show immediate payment option
      const canAfford = window.ProgressionManager.canAfford(this.solarCost);
      this.elements.primaryButton.disabled = !canAfford;
      this.elements.primaryButton.innerHTML = `
        <span class="button-icon">☀️</span>
        <span class="button-text">Unlock for ${this.solarCost} Solar</span>
      `;
      this.elements.secondaryButton.style.display = 'block';
      this.elements.secondaryButton.innerHTML = '<span class="button-text">Start Timer</span>';
      this.elements.helpText.textContent = canAfford 
        ? `Unlock instantly for ${this.solarCost} Solar or start a ${this.timerDuration}s timer.`
        : `Insufficient balance. Top up to unlock instantly or start a ${this.timerDuration}s timer.`;
    } else {
      // Anonymous user - show timer option
      this.elements.primaryButton.disabled = false;
      this.elements.primaryButton.innerHTML = `
        <span class="button-icon">⏱️</span>
        <span class="button-text">Start ${this.timerDuration}s Timer</span>
      `;
      this.elements.secondaryButton.style.display = 'block';
      this.elements.secondaryButton.innerHTML = '<span class="button-text">Register & Unlock</span>';
      this.elements.helpText.textContent = `Start a ${this.timerDuration}s timer for free access, or register to unlock instantly.`;
    }
  }

  /**
   * Show timer active state
   */
  showTimerActiveState(timeRemaining) {
    this.elements.statusText.textContent = 'Timer Active';
    this.elements.statusIcon.textContent = '⏱️';
    this.elements.timerLabel.textContent = 'remaining';
    this.updateTimer(timeRemaining);
    
    this.elements.primaryButton.disabled = true;
    this.elements.primaryButton.innerHTML = '<span class="button-icon">⏱️</span><span class="button-text">Timer Running...</span>';
    this.elements.secondaryButton.style.display = 'none';
    this.elements.helpText.textContent = 'Timer is running. Full access will be available when it completes.';
  }

  /**
   * Show timer complete state
   */
  showTimerCompleteState() {
    this.elements.statusText.textContent = 'Timer Complete!';
    this.elements.statusIcon.textContent = '✅';
    this.elements.timeRemaining.textContent = '00:00';
    this.elements.timerLabel.textContent = 'completed';
    this.updateProgress(100);
    
    if (window.ProgressionManager?.isUserRegistered()) {
      const canAfford = window.ProgressionManager.canAfford(this.solarCost);
      this.elements.primaryButton.disabled = !canAfford;
      this.elements.primaryButton.innerHTML = `
        <span class="button-icon">☀️</span>
        <span class="button-text">Unlock for ${this.solarCost} Solar</span>
      `;
      this.elements.secondaryButton.style.display = 'none';
      this.elements.helpText.textContent = canAfford 
        ? `Timer completed! Unlock now for ${this.solarCost} Solar.`
        : 'Timer completed! Top up your Solar balance to unlock.';
    } else {
      this.elements.primaryButton.disabled = false;
      this.elements.primaryButton.innerHTML = '<span class="button-icon">👤</span><span class="button-text">Register & Unlock</span>';
      this.elements.secondaryButton.style.display = 'none';
      this.elements.helpText.textContent = 'Timer completed! Register to unlock this content.';
    }
  }

  /**
   * Show unlocked state
   */
  showUnlockedState() {
    this.elements.statusText.textContent = 'Unlocked!';
    this.elements.statusIcon.textContent = '🎉';
    this.elements.timeRemaining.textContent = '∞';
    this.elements.timerLabel.textContent = 'unlimited';
    this.updateProgress(100);
    
    this.elements.primaryButton.disabled = false;
    this.elements.primaryButton.innerHTML = '<span class="button-icon">▶️</span><span class="button-text">Access Content</span>';
    this.elements.secondaryButton.style.display = 'none';
    this.elements.helpText.textContent = 'Content is unlocked! You have full access.';
  }

  /**
   * Update timer display
   */
  updateTimer(timeRemaining) {
    this.timeRemaining = timeRemaining;
    this.elements.timeRemaining.textContent = this.formatTime(timeRemaining);
    
    // Update progress bar
    const progress = timeRemaining > 0 ? ((this.timerDuration - timeRemaining) / this.timerDuration) * 100 : 100;
    this.updateProgress(progress);
  }

  /**
   * Update progress bar
   */
  updateProgress(percent) {
    const circumference = 314.16; // 2 * Math.PI * 50
    const offset = circumference - (percent / 100) * circumference;
    this.elements.progressBar.style.strokeDashoffset = offset;
  }

  /**
   * Handle primary button action
   */
  async handlePrimaryAction() {
    const progressionManager = window.ProgressionManager;
    
    if (!progressionManager) {
      console.error('ProgressionManager not available');
      return;
    }
    
    try {
      switch (this.currentState) {
        case 'preview':
        case 'locked':
          if (progressionManager.isUserRegistered()) {
            // Registered user - try to unlock with Solar
            await this.unlockWithSolar();
          } else {
            // Anonymous user - start timer
            await this.startTimer();
          }
          break;
          
        case 'timer_complete':
          if (progressionManager.isUserRegistered()) {
            await this.unlockWithSolar();
          } else {
            await this.showRegistrationModal();
          }
          break;
          
        case 'unlocked':
          this.emit('contentAccess', { contentType: this.contentType, contentId: this.contentId });
          break;
      }
    } catch (error) {
      console.error('Primary action failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Handle secondary button action
   */
  async handleSecondaryAction() {
    try {
      switch (this.currentState) {
        case 'preview':
        case 'locked':
          if (window.ProgressionManager?.isUserRegistered()) {
            await this.startTimer();
          } else {
            await this.showRegistrationModal();
          }
          break;
      }
    } catch (error) {
      console.error('Secondary action failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Handle top-up action
   */
  async handleTopUpAction() {
    this.showTopUpModal();
  }

  /**
   * Start timer
   */
  async startTimer() {
    const progressionManager = window.ProgressionManager;
    
    this.elements.primaryButton.disabled = true;
    this.elements.primaryButton.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Starting Timer...</span>';
    
    await progressionManager.startTimer(this.contentType, this.contentId, this.timerDuration);
  }

  /**
   * Unlock with Solar payment
   */
  async unlockWithSolar() {
    const progressionManager = window.ProgressionManager;
    
    if (!progressionManager.canAfford(this.solarCost)) {
      this.showTopUpModal();
      return;
    }
    
    this.elements.primaryButton.disabled = true;
    this.elements.primaryButton.innerHTML = '<span class="button-icon">⏳</span><span class="button-text">Unlocking...</span>';
    
    await progressionManager.unlockContent(this.contentType, this.contentId, this.solarCost);
  }

  /**
   * Show user info section
   */
  showUserInfo() {
    this.elements.userInfo.style.display = 'flex';
  }

  /**
   * Hide user info section
   */
  hideUserInfo() {
    this.elements.userInfo.style.display = 'none';
  }

  /**
   * Update Solar balance display
   */
  updateSolarBalance(balance) {
    this.elements.solarBalance.textContent = `${balance} Solar`;
  }

  /**
   * Show registration modal
   */
  showRegistrationModal() {
    this.emit('showRegistrationModal', { contentType: this.contentType, contentId: this.contentId });
  }

  /**
   * Show top-up modal
   */
  showTopUpModal() {
    this.emit('showTopUpModal', { contentType: this.contentType, contentId: this.contentId });
  }

  /**
   * Show error message
   */
  showError(message) {
    this.elements.helpText.textContent = `Error: ${message}`;
    this.elements.helpText.style.color = '#ff6b6b';
    
    setTimeout(() => {
      this.updateFromProgressionManager();
      this.elements.helpText.style.color = '#aaa';
    }, 3000);
  }

  /**
   * Format time for display
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Event emitter
   */
  emit(event, data) {
    const customEvent = new CustomEvent(`timerUI:${event}`, { detail: data });
    this.container.dispatchEvent(customEvent);
  }

  /**
   * Listen for events
   */
  on(event, callback) {
    this.container.addEventListener(`timerUI:${event}`, callback);
  }

  /**
   * Destroy the timer UI
   */
  destroy() {
    // Clean up timers and event listeners
    this.container.innerHTML = '';
  }
}

// Export for use
window.TimerUI = TimerUI;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerUI;
}