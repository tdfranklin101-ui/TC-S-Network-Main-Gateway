/**
 * Solar Acquisition Modal Component
 * Unified Solar acquisition flow for The Current-See platform
 */

class SolarAcquisitionModal {
  constructor() {
    this.modalId = 'solar-acquisition-modal';
    this.isOpen = false;
    this.returnUrl = null;
    this.init();
  }

  init() {
    this.createModal();
    this.attachEventListeners();
    this.loadReturnUrl();
  }

  createModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'solar-modal-overlay';
    modal.style.display = 'none';
    
    modal.innerHTML = `
      <div class="solar-modal-content">
        <button class="solar-modal-close" data-testid="button-close-modal">&times;</button>
        
        <div class="solar-modal-header">
          <div class="solar-icon">☀️</div>
          <h2 data-testid="text-modal-title">Get Your Daily Solar</h2>
          <p class="solar-birthright" data-testid="text-birthright-message">
            <strong>1 Solar per day automatic</strong> - your rightful share of Earth's energy abundance
          </p>
        </div>

        <div class="solar-modal-body">
          <div class="solar-standard-info">
            <div class="solar-value">
              <span class="solar-amount">1 Solar</span>
              <span class="solar-equals">=</span>
              <span class="solar-kwh" data-testid="text-solar-value">4,913 kWh</span>
            </div>
            <p class="solar-description" data-testid="text-solar-description">
              Energy-backed value. Stable. Fair. Universal. Not crypto. Not a gift card. 
              Real renewable energy equivalency.
            </p>
          </div>

          <form class="solar-signup-form" data-testid="form-solar-signup">
            <div class="form-group">
              <label for="solar-name">Name (Optional)</label>
              <input 
                type="text" 
                id="solar-name" 
                name="name" 
                placeholder="Your name" 
                data-testid="input-name"
              />
            </div>
            
            <div class="form-group">
              <label for="solar-email">Email Address *</label>
              <input 
                type="email" 
                id="solar-email" 
                name="email" 
                placeholder="your@email.com" 
                required 
                data-testid="input-email"
              />
            </div>
            
            <div class="form-group">
              <label for="solar-interests">Interests (Optional)</label>
              <textarea 
                id="solar-interests" 
                name="interests" 
                placeholder="What interests you about solar energy and sustainable economics?" 
                rows="3"
                data-testid="input-interests"
              ></textarea>
            </div>

            <div class="solar-cta-hierarchy">
              <button 
                type="submit" 
                class="btn-primary solar-submit" 
                data-testid="button-get-solar"
              >
                🌟 Get Free Solar Now
              </button>
              
              <div class="secondary-actions">
                <a 
                  href="/wallet.html" 
                  class="btn-secondary" 
                  data-testid="link-try-demo"
                >
                  Try Demo First
                </a>
                <a 
                  href="/world.html" 
                  class="btn-secondary" 
                  data-testid="link-learn-more"
                >
                  Learn More
                </a>
              </div>
            </div>
          </form>

          <div class="solar-success-message" style="display: none;" data-testid="text-success-message">
            <div class="success-icon">✅</div>
            <h3>Welcome to The Current-See Network!</h3>
            <p>Your daily Solar allocation is now active. Check your email for next steps.</p>
            <button class="btn-primary continue-btn" data-testid="button-continue">
              Continue Where I Left Off
            </button>
          </div>

          <div class="solar-error-message" style="display: none;" data-testid="text-error-message">
            <div class="error-icon">⚠️</div>
            <p class="error-text"></p>
            <button class="btn-secondary retry-btn" data-testid="button-retry">
              Try Again
            </button>
          </div>
        </div>

        <div class="solar-modal-footer">
          <p class="solar-guarantee" data-testid="text-guarantee">
            🛡️ <strong>Your Birthright Guarantee:</strong> One Solar per human per day. No catch. No cost. 
            Just your share of renewable abundance.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  attachEventListeners() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Close modal events
    const closeBtn = modal.querySelector('.solar-modal-close');
    closeBtn.addEventListener('click', () => this.close());

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Form submission
    const form = modal.querySelector('.solar-signup-form');
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Continue button
    const continueBtn = modal.querySelector('.continue-btn');
    continueBtn?.addEventListener('click', () => this.handleContinue());

    // Retry button
    const retryBtn = modal.querySelector('.retry-btn');
    retryBtn?.addEventListener('click', () => this.showForm());
  }

  open(returnUrl = null) {
    this.returnUrl = returnUrl || window.location.href;
    this.saveReturnUrl();
    
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.isOpen = true;

    // Focus first input
    const firstInput = modal.querySelector('input[type="email"]');
    setTimeout(() => firstInput?.focus(), 100);
  }

  close() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    modal.style.display = 'none';
    document.body.style.overflow = '';
    this.isOpen = false;
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      interests: formData.get('interests')
    };

    // Show loading state
    const submitBtn = form.querySelector('.solar-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Activating Solar...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.showSuccess();
        // Save user state for continuity
        this.saveUserState({ email: data.email, name: data.name });
      } else {
        this.showError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showError('Network error. Please check your connection and try again.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  showSuccess() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    modal.querySelector('.solar-signup-form').style.display = 'none';
    modal.querySelector('.solar-error-message').style.display = 'none';
    modal.querySelector('.solar-success-message').style.display = 'block';
  }

  showError(message) {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    const errorDiv = modal.querySelector('.solar-error-message');
    const errorText = errorDiv.querySelector('.error-text');
    
    errorText.textContent = message;
    errorDiv.style.display = 'block';
    modal.querySelector('.solar-success-message').style.display = 'none';
  }

  showForm() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    modal.querySelector('.solar-signup-form').style.display = 'block';
    modal.querySelector('.solar-error-message').style.display = 'none';
    modal.querySelector('.solar-success-message').style.display = 'none';
  }

  handleContinue() {
    const returnUrl = this.getReturnUrl();
    this.close();
    
    if (returnUrl && returnUrl !== window.location.href) {
      window.location.href = returnUrl;
    }
  }

  saveReturnUrl() {
    if (this.returnUrl) {
      localStorage.setItem('solarReturnUrl', this.returnUrl);
    }
  }

  getReturnUrl() {
    return localStorage.getItem('solarReturnUrl') || '/';
  }

  loadReturnUrl() {
    this.returnUrl = this.getReturnUrl();
  }

  saveUserState(userData) {
    localStorage.setItem('solarUser', JSON.stringify({
      ...userData,
      registeredAt: new Date().toISOString(),
      hasSolar: true
    }));
  }

  getUserState() {
    const userData = localStorage.getItem('solarUser');
    return userData ? JSON.parse(userData) : null;
  }

  isUserRegistered() {
    const userData = this.getUserState();
    return userData && userData.hasSolar;
  }
}

// Global instance
window.solarModal = new SolarAcquisitionModal();

// Global helper function to open modal
window.openSolarModal = function(returnUrl) {
  window.solarModal.open(returnUrl);
};

// Auto-unlock content for registered users
document.addEventListener('DOMContentLoaded', function() {
  if (window.solarModal.isUserRegistered()) {
    // Add visual indicator for registered users
    const body = document.body;
    body.classList.add('solar-registered');
    
    // Show unlocked content indicators
    const lockedElements = document.querySelectorAll('[data-solar-locked]');
    lockedElements.forEach(el => {
      el.classList.add('solar-unlocked');
      el.removeAttribute('data-solar-locked');
    });
  }
});