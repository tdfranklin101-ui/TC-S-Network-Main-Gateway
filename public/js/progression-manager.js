/**
 * Progression Manager - Timer-gated content progression system
 * Handles user sessions, timers, payments, and content access control
 */

class ProgressionManager {
  constructor() {
    this.sessionId = null;
    this.userId = null;
    this.userProfile = null;
    this.progressions = new Map(); // contentType:contentId -> progression data
    this.entitlements = new Map(); // contentType:contentId -> entitlement data
    this.timers = new Map(); // progressionId -> timer info
    this.apiBase = '/api';
    this.eventListeners = new Map(); // event type -> callbacks
    this.initialized = false;
    
    // Auto-initialize
    this.init();
  }

  /**
   * Initialize the progression manager
   */
  async init() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Progression Manager...');
    
    // Load or create session
    await this.loadSession();
    
    // Load user data if logged in
    await this.loadUserData();
    
    // Load progressions and entitlements
    await this.loadUserProgressions();
    await this.loadUserEntitlements();
    
    // Start timer monitoring
    this.startTimerMonitoring();
    
    this.initialized = true;
    this.emit('initialized', { userId: this.userId, sessionId: this.sessionId });
    
    console.log('✅ Progression Manager initialized');
  }

  /**
   * Load or create session
   */
  async loadSession() {
    // Try to get sessionId from localStorage
    this.sessionId = localStorage.getItem('progressionSessionId');
    
    if (!this.sessionId) {
      try {
        const response = await fetch(`${this.apiBase}/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) })
        });
        
        if (response.ok) {
          const data = await response.json();
          this.sessionId = data.sessionId;
          localStorage.setItem('progressionSessionId', this.sessionId);
          console.log('📝 Created new session:', this.sessionId);
        }
      } catch (error) {
        console.error('Failed to create session:', error);
        // Generate fallback session ID
        this.sessionId = 'fallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('progressionSessionId', this.sessionId);
      }
    }
  }

  /**
   * Load user data if authenticated
   */
  async loadUserData() {
    // Check for user ID in localStorage or cookies
    this.userId = localStorage.getItem('userId') || this.getCookie('userId');
    
    if (this.userId) {
      try {
        const response = await fetch(`${this.apiBase}/profile`);
        if (response.ok) {
          this.userProfile = await response.json();
          console.log('👤 Loaded user profile:', this.userProfile);
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    }
  }

  /**
   * Load user progressions
   */
  async loadUserProgressions() {
    try {
      const params = new URLSearchParams();
      if (this.userId) {
        const response = await fetch(`${this.apiBase}/progressions?sessionId=${this.sessionId}`);
        if (response.ok) {
          const progressions = await response.json();
          progressions.forEach(prog => {
            const key = `${prog.contentType}:${prog.contentId}`;
            this.progressions.set(key, prog);
          });
          console.log('📊 Loaded progressions:', progressions.length);
        }
      }
    } catch (error) {
      console.error('Failed to load progressions:', error);
    }
  }

  /**
   * Load user entitlements
   */
  async loadUserEntitlements() {
    try {
      const params = new URLSearchParams();
      if (this.userId) params.append('userId', this.userId);
      if (this.sessionId) params.append('sessionId', this.sessionId);
      
      const response = await fetch(`${this.apiBase}/entitlements?${params}`);
      if (response.ok) {
        const entitlements = await response.json();
        entitlements.forEach(ent => {
          const key = `${ent.contentType}:${ent.contentId}`;
          this.entitlements.set(key, ent);
        });
        console.log('🎫 Loaded entitlements:', entitlements.length);
      }
    } catch (error) {
      console.error('Failed to load entitlements:', error);
    }
  }

  /**
   * Check content access status
   */
  async checkContentAccess(contentType, contentId) {
    try {
      const params = new URLSearchParams({
        contentType,
        contentId
      });
      if (this.userId) params.append('userId', this.userId);
      if (this.sessionId) params.append('sessionId', this.sessionId);
      
      const response = await fetch(`${this.apiBase}/content/${contentType}/${contentId}/access?${params}`);
      if (response.ok) {
        const accessInfo = await response.json();
        
        // Update local cache
        if (accessInfo.progression) {
          const key = `${contentType}:${contentId}`;
          this.progressions.set(key, accessInfo.progression);
        }
        
        return accessInfo;
      } else {
        throw new Error('Failed to check access');
      }
    } catch (error) {
      console.error('Access check failed:', error);
      return {
        canAccess: true,
        accessType: 'preview',
        solarCost: 0
      };
    }
  }

  /**
   * Start a timer for content progression
   */
  async startTimer(contentType, contentId, duration) {
    try {
      const response = await fetch(`${this.apiBase}/content/${contentType}/${contentId}/start-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration
        })
      });

      if (response.ok) {
        const progression = await response.json();
        const key = `${contentType}:${contentId}`;
        this.progressions.set(key, progression);
        
        // Start local timer
        this.startLocalTimer(progression);
        
        console.log(`⏱️ Started timer for ${contentType}:${contentId} (${duration}s)`);
        this.emit('timerStarted', { contentType, contentId, duration, progression });
        
        return progression;
      } else {
        throw new Error('Failed to start timer');
      }
    } catch (error) {
      console.error('Timer start failed:', error);
      throw error;
    }
  }

  /**
   * Start local timer monitoring
   */
  startLocalTimer(progression) {
    const timerId = setInterval(() => {
      const now = new Date();
      const endTime = new Date(progression.timerEndTime);
      const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      
      this.emit('timerTick', {
        progressionId: progression.id,
        contentType: progression.contentType,
        contentId: progression.contentId,
        timeRemaining,
        isComplete: timeRemaining === 0
      });
      
      // Auto-complete when timer reaches zero
      if (timeRemaining === 0) {
        clearInterval(timerId);
        this.timers.delete(progression.id);
        this.completeTimer(progression.id);
      }
    }, 1000);
    
    this.timers.set(progression.id, {
      intervalId: timerId,
      progression
    });
  }

  /**
   * Complete a timer
   */
  async completeTimer(progressionId) {
    try {
      const response = await fetch(`${this.apiBase}/progression/${progressionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const progression = await response.json();
        const key = `${progression.contentType}:${progression.contentId}`;
        this.progressions.set(key, progression);
        
        console.log(`✅ Timer completed: ${progression.contentType}:${progression.contentId}`);
        this.emit('timerCompleted', { progression });
        
        return progression;
      }
    } catch (error) {
      console.error('Timer completion failed:', error);
    }
  }

  /**
   * Start timer monitoring for existing active timers
   */
  startTimerMonitoring() {
    this.progressions.forEach(progression => {
      if (progression.status === 'timer_active' && progression.timerEndTime) {
        const now = new Date();
        const endTime = new Date(progression.timerEndTime);
        const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
        
        if (timeRemaining > 0) {
          this.startLocalTimer(progression);
        } else {
          // Timer already expired, complete it
          this.completeTimer(progression.id);
        }
      }
    });
  }

  /**
   * Unlock content with Solar payment
   */
  async unlockContent(contentType, contentId, solarCost) {
    if (!this.userId) {
      throw new Error('User must be registered to make payments');
    }

    try {
      const response = await fetch(`${this.apiBase}/content/${contentType}/${contentId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solarCost
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        const key = `${contentType}:${contentId}`;
        if (result.entitlement) {
          this.entitlements.set(key, result.entitlement);
        }
        
        // Refresh user profile to get updated balance
        await this.loadUserData();
        
        console.log(`💰 Content unlocked: ${contentType}:${contentId}`);
        this.emit('contentUnlocked', { contentType, contentId, result });
        
        return result;
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Content unlock failed:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   */
  async registerUser(email, firstName, lastName) {
    try {
      const response = await fetch(`${this.apiBase}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        this.userId = data.user.id;
        this.userProfile = data.profile;
        
        // Store in localStorage
        localStorage.setItem('userId', this.userId);
        
        console.log('👤 User registered:', data.user);
        this.emit('userRegistered', data);
        
        // Reload progressions and entitlements for the new user
        await this.loadUserProgressions();
        await this.loadUserEntitlements();
        
        return data;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Get Solar balance and daily earnings info
   */
  async getSolarBalance() {
    if (!this.userId) {
      return {
        balance: 0,
        registered: false,
        message: 'Register to track your Solar balance and earn daily tokens'
      };
    }

    try {
      const response = await fetch(`${this.apiBase}/profile`);
      
      if (response.ok) {
        const data = await response.json();
        this.userProfile = {
          ...this.userProfile,
          solarBalance: data.profile.solarBalance,
          totalEarned: data.profile.totalEarned,
          totalSpent: data.profile.totalSpent
        };
        
        console.log(`⚡ Solar balance: ${data.profile.solarBalance} tokens`);
        this.emit('balanceUpdated', { profile: this.userProfile, data: data.profile });
        
        return data.profile;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get balance');
      }
    } catch (error) {
      console.error('Failed to get Solar balance:', error);
      throw error;
    }
  }

  /**
   * Get progression status for content
   */
  getProgressionStatus(contentType, contentId) {
    const key = `${contentType}:${contentId}`;
    const progression = this.progressions.get(key);
    const entitlement = this.entitlements.get(key);
    
    // Check entitlement first
    if (entitlement && entitlement.accessType === 'full') {
      return {
        status: 'unlocked',
        accessType: 'full',
        hasAccess: true
      };
    }
    
    // Check progression
    if (progression) {
      const now = new Date();
      
      if (progression.status === 'timer_active' && progression.timerEndTime) {
        const endTime = new Date(progression.timerEndTime);
        const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
        
        return {
          status: 'timer_active',
          accessType: 'timer_active',
          timeRemaining,
          hasAccess: true,
          progression
        };
      }
      
      if (progression.status === 'timer_complete') {
        return {
          status: 'timer_complete',
          accessType: 'timer_complete',
          hasAccess: true,
          progression
        };
      }
      
      if (progression.status === 'unlocked') {
        return {
          status: 'unlocked',
          accessType: 'full',
          hasAccess: true,
          progression
        };
      }
    }
    
    // Default to preview/locked
    return {
      status: 'locked',
      accessType: 'preview',
      hasAccess: true
    };
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Utility methods
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  isUserRegistered() {
    return this.userId !== null;
  }

  getUserBalance() {
    return this.userProfile ? this.userProfile.solarBalance : 0;
  }

  canAfford(solarCost) {
    return this.getUserBalance() >= solarCost;
  }

  /**
   * Format time remaining for display
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Create global instance
window.ProgressionManager = new ProgressionManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressionManager;
}