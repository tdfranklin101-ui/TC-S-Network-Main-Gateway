/**
 * Payment Modal Component - Registration and Top-up flows for Timer UI
 * Integrates with ProgressionManager and Stripe for Solar balance management
 */

class PaymentModal {
  constructor() {
    this.modalId = 'payment-modal';
    this.isOpen = false;
    this.currentFlow = null; // 'registration' or 'topup'
    this.contentContext = null; // Content that triggered the modal
    this.selectedAmount = null;
    this.elements = null;
    this.init();
  }

  async init() {
    // Solar-only payment system (no Stripe needed)
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'payment-modal-overlay';
    modal.style.display = 'none';
    
    modal.innerHTML = `
      <div class="payment-modal-content">
        <button class="payment-modal-close" data-testid="button-close-modal">&times;</button>
        
        <!-- Registration Flow -->
        <div class="payment-flow registration-flow" data-testid="registration-flow">
          <div class="payment-modal-header">
            <div class="solar-icon">☀️</div>
            <h2 data-testid="text-registration-title">Register & Unlock</h2>
            <p class="subtitle" data-testid="text-registration-subtitle">
              Get your daily Solar allocation and unlock content instantly
            </p>
          </div>

          <div class="payment-modal-body">
            <div class="solar-benefits">
              <div class="benefit-item">
                <span class="benefit-icon">⚡</span>
                <span class="benefit-text">1 Solar per day automatic</span>
              </div>
              <div class="benefit-item">
                <span class="benefit-icon">🎵</span>
                <span class="benefit-text">Instant content unlock</span>
              </div>
              <div class="benefit-item">
                <span class="benefit-icon">🤖</span>
                <span class="benefit-text">AI wallet assistance</span>
              </div>
            </div>

            <form class="registration-form" data-testid="form-registration">
              <div class="form-group">
                <label for="reg-email">Email Address *</label>
                <input 
                  type="email" 
                  id="reg-email" 
                  name="email" 
                  placeholder="your@email.com" 
                  data-testid="input-email"
                  required
                />
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="reg-first-name">First Name *</label>
                  <input 
                    type="text" 
                    id="reg-first-name" 
                    name="firstName" 
                    placeholder="First" 
                    data-testid="input-first-name"
                    required
                  />
                </div>
                
                <div class="form-group">
                  <label for="reg-last-name">Last Name *</label>
                  <input 
                    type="text" 
                    id="reg-last-name" 
                    name="lastName" 
                    placeholder="Last" 
                    data-testid="input-last-name"
                    required
                  />
                </div>
              </div>

              <div class="content-unlock-info" data-testid="content-unlock-info">
                <h4>After Registration:</h4>
                <div class="unlock-details">
                  <span class="content-title" data-testid="text-content-title"></span>
                  <span class="unlock-cost" data-testid="text-unlock-cost">Cost: 50 Solar</span>
                </div>
              </div>

              <button type="submit" class="payment-submit-btn registration-btn" data-testid="button-register">
                <span class="button-icon">👤</span>
                <span class="button-text">Register & Unlock</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Top-up Flow -->
        <div class="payment-flow topup-flow" data-testid="topup-flow" style="display: none;">
          <div class="payment-modal-header">
            <div class="solar-icon">☀️</div>
            <h2 data-testid="text-topup-title">Top Up Solar Balance</h2>
            <p class="subtitle" data-testid="text-topup-subtitle">
              Add Solar to your balance to unlock content
            </p>
          </div>

          <div class="payment-modal-body">
            <div class="current-balance" data-testid="current-balance">
              <span class="balance-label">Current Balance:</span>
              <span class="balance-amount" data-testid="text-current-balance">0 Solar</span>
            </div>

            <div class="content-unlock-info" data-testid="content-unlock-info-topup">
              <h4>Content to Unlock:</h4>
              <div class="unlock-details">
                <span class="content-title" data-testid="text-content-title-topup"></span>
                <span class="unlock-cost" data-testid="text-unlock-cost-topup">Cost: 50 Solar</span>
              </div>
            </div>

            <div class="topup-options" data-testid="topup-options">
              <h4>Select Amount:</h4>
              <div class="amount-buttons">
                <button class="amount-btn" data-testid="button-amount-100" data-amount="100">
                  <span class="amount-solar">100 Solar</span>
                  <span class="amount-price">$5.00</span>
                </button>
                <button class="amount-btn" data-testid="button-amount-250" data-amount="250">
                  <span class="amount-solar">250 Solar</span>
                  <span class="amount-price">$10.00</span>
                </button>
                <button class="amount-btn" data-testid="button-amount-500" data-amount="500">
                  <span class="amount-solar">500 Solar</span>
                  <span class="amount-price">$20.00</span>
                </button>
                <button class="amount-btn custom-amount-btn" data-testid="button-custom-amount">
                  <span class="amount-solar">Custom</span>
                  <span class="amount-price">Enter amount</span>
                </button>
              </div>
            </div>

            <div class="custom-amount-input" data-testid="custom-amount-input" style="display: none;">
              <label for="custom-amount">Custom Amount (Solar):</label>
              <input type="number" id="custom-amount" min="50" max="10000" placeholder="Enter amount">
            </div>

            <div class="solar-payment-info" data-testid="solar-payment-info">
              <h4>Payment Information:</h4>
              <div class="payment-note">
                <p>💡 This is a demo system. In a real implementation, you would integrate with your preferred payment processor to purchase Solar tokens.</p>
                <p>For now, you can only use existing Solar balance from registration bonuses.</p>
              </div>
            </div>

            <button class="payment-submit-btn topup-btn" data-testid="button-demo-topup" disabled>
              <span class="button-icon">🎭</span>
              <span class="button-text">Demo: Add Solar</span>
              <span class="button-amount" data-testid="button-payment-amount">(Demo only)</span>
            </button>
          </div>
        </div>

        <!-- Success State -->
        <div class="payment-flow success-flow" data-testid="success-flow" style="display: none;">
          <div class="payment-modal-header">
            <div class="success-icon">✅</div>
            <h2 data-testid="text-success-title">Success!</h2>
            <p class="subtitle" data-testid="text-success-subtitle">
              Content unlocked successfully
            </p>
          </div>

          <div class="payment-modal-body">
            <div class="success-details" data-testid="success-details">
              <div class="success-item">
                <span class="success-label">Content:</span>
                <span class="success-value" data-testid="text-success-content"></span>
              </div>
              <div class="success-item">
                <span class="success-label">Cost:</span>
                <span class="success-value" data-testid="text-success-cost"></span>
              </div>
              <div class="success-item">
                <span class="success-label">New Balance:</span>
                <span class="success-value" data-testid="text-success-balance"></span>
              </div>
            </div>

            <button class="payment-submit-btn access-content-btn" data-testid="button-access-content">
              <span class="button-icon">▶️</span>
              <span class="button-text">Access Content</span>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="payment-loading" data-testid="payment-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <p class="loading-text">Processing payment...</p>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
    document.body.appendChild(modal);
    
    // Cache element references
    this.cacheElements();
  }

  cacheElements() {
    this.elements = {
      modal: document.getElementById(this.modalId),
      closeButton: document.querySelector('.payment-modal-close'),
      registrationFlow: document.querySelector('.registration-flow'),
      topupFlow: document.querySelector('.topup-flow'),
      successFlow: document.querySelector('.success-flow'),
      loadingState: document.querySelector('.payment-loading'),
      
      // Registration form
      registrationForm: document.querySelector('.registration-form'),
      emailInput: document.getElementById('reg-email'),
      firstNameInput: document.getElementById('reg-first-name'),
      lastNameInput: document.getElementById('reg-last-name'),
      registerButton: document.querySelector('.registration-btn'),
      
      // Top-up form
      currentBalance: document.querySelector('.balance-amount'),
      amountButtons: document.querySelectorAll('.amount-btn'),
      customAmountInput: document.querySelector('.custom-amount-input'),
      customAmountField: document.getElementById('custom-amount'),
      paymentInfo: document.querySelector('.solar-payment-info'),
      payButton: document.querySelector('.topup-btn'),
      paymentAmount: document.querySelector('.button-payment-amount'),
      
      // Success state
      successContent: document.querySelector('[data-testid="text-success-content"]'),
      successCost: document.querySelector('[data-testid="text-success-cost"]'),
      successBalance: document.querySelector('[data-testid="text-success-balance"]'),
      accessContentButton: document.querySelector('.access-content-btn'),
      
      // Content info
      contentTitles: document.querySelectorAll('.content-title'),
      unlockCosts: document.querySelectorAll('.unlock-cost')
    };
  }

  attachEventListeners() {
    // Close modal
    this.elements.closeButton.addEventListener('click', () => this.close());
    this.elements.modal.addEventListener('click', (e) => {
      if (e.target === this.elements.modal) this.close();
    });

    // Registration form
    this.elements.registrationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegistration();
    });

    // Top-up amount selection (for demo purposes only)
    this.elements.amountButtons.forEach(button => {
      button.addEventListener('click', () => this.selectAmount(button));
    });

    // Custom amount input
    this.elements.customAmountField.addEventListener('input', () => {
      this.updatePaymentButton();
    });

    // Demo top-up button
    this.elements.payButton.addEventListener('click', () => {
      this.handleDemoTopUp();
    });

    // Success flow
    this.elements.accessContentButton.addEventListener('click', () => {
      this.accessContent();
    });
  }

  addStyles() {
    if (document.getElementById('payment-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'payment-modal-styles';
    style.textContent = `
      .payment-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }

      .payment-modal-content {
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 2px solid #FFD700;
        border-radius: 15px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        color: white;
        font-family: Arial, sans-serif;
      }

      .payment-modal-close {
        position: absolute;
        top: 15px;
        right: 20px;
        background: none;
        border: none;
        color: #FFD700;
        font-size: 24px;
        cursor: pointer;
        transition: color 0.3s ease;
      }

      .payment-modal-close:hover {
        color: #FFA500;
      }

      .payment-modal-header {
        text-align: center;
        margin-bottom: 25px;
      }

      .solar-icon, .success-icon {
        font-size: 3em;
        margin-bottom: 10px;
      }

      .payment-modal-header h2 {
        color: #FFD700;
        margin: 0 0 10px 0;
        font-size: 1.8em;
      }

      .subtitle {
        color: #ccc;
        margin: 0;
        font-size: 1em;
        line-height: 1.4;
      }

      .solar-benefits {
        margin-bottom: 25px;
      }

      .benefit-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        color: #FFD700;
        font-weight: bold;
      }

      .benefit-icon {
        font-size: 1.2em;
      }

      .form-group {
        margin-bottom: 15px;
      }

      .form-row {
        display: flex;
        gap: 15px;
      }

      .form-row .form-group {
        flex: 1;
      }

      .form-group label {
        display: block;
        color: #FFD700;
        margin-bottom: 5px;
        font-weight: bold;
      }

      .form-group input {
        width: 100%;
        padding: 10px;
        border: 2px solid #333;
        border-radius: 5px;
        background: #000;
        color: white;
        font-size: 16px;
        transition: border-color 0.3s ease;
      }

      .form-group input:focus {
        outline: none;
        border-color: #FFD700;
      }

      .content-unlock-info {
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid #FFD700;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
      }

      .content-unlock-info h4 {
        color: #FFD700;
        margin: 0 0 10px 0;
        font-size: 1.1em;
      }

      .unlock-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .content-title {
        font-weight: bold;
        color: white;
      }

      .unlock-cost {
        color: #FFD700;
        font-weight: bold;
      }

      .current-balance {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0, 0, 0, 0.5);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid #333;
      }

      .balance-label {
        color: #ccc;
      }

      .balance-amount {
        color: #FFD700;
        font-weight: bold;
        font-size: 1.2em;
      }

      .topup-options h4 {
        color: #FFD700;
        margin: 0 0 15px 0;
      }

      .amount-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
      }

      .amount-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 15px 10px;
        background: transparent;
        border: 2px solid #333;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .amount-btn:hover {
        border-color: #FFD700;
      }

      .amount-btn.selected {
        border-color: #FFD700;
        background: rgba(255, 215, 0, 0.1);
      }

      .amount-solar {
        font-weight: bold;
        color: #FFD700;
        margin-bottom: 5px;
      }

      .amount-price {
        color: #ccc;
        font-size: 0.9em;
      }

      .custom-amount-input {
        margin-bottom: 20px;
      }

      .custom-amount-input label {
        display: block;
        color: #FFD700;
        margin-bottom: 5px;
        font-weight: bold;
      }

      .custom-amount-input input {
        width: 100%;
        padding: 10px;
        border: 2px solid #333;
        border-radius: 5px;
        background: #000;
        color: white;
        font-size: 16px;
      }

      .stripe-payment-section h4 {
        color: #FFD700;
        margin: 0 0 15px 0;
      }

      .solar-payment-info {
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid #FFD700;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
      }

      .payment-note {
        color: #ccc;
        font-size: 0.9em;
        line-height: 1.4;
      }

      .payment-note p {
        margin: 8px 0;
      }

      .payment-submit-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 15px 20px;
        background: linear-gradient(45deg, #FFD700, #FFA500);
        color: #000;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 20px;
      }

      .payment-submit-btn:hover:not(:disabled) {
        background: linear-gradient(45deg, #FFA500, #FF8C00);
        transform: translateY(-2px);
      }

      .payment-submit-btn:disabled {
        background: #666;
        color: #999;
        cursor: not-allowed;
        transform: none;
      }

      .button-amount {
        margin-left: auto;
        color: #000;
        font-weight: bold;
      }

      .success-details {
        margin-bottom: 25px;
      }

      .success-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #333;
      }

      .success-item:last-child {
        border-bottom: none;
      }

      .success-label {
        color: #ccc;
      }

      .success-value {
        color: #FFD700;
        font-weight: bold;
      }

      .payment-loading {
        text-align: center;
        padding: 40px 20px;
      }

      .loading-spinner {
        border: 4px solid #333;
        border-top: 4px solid #FFD700;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-text {
        color: #FFD700;
        font-size: 1.1em;
        margin: 0;
      }

      /* Hide all flows by default */
      .payment-flow {
        display: none;
      }

      .payment-flow.active {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show registration modal
   */
  showRegistration(contentContext) {
    this.currentFlow = 'registration';
    this.contentContext = contentContext;
    this.updateContentInfo();
    this.showFlow('registration');
    this.open();
  }

  /**
   * Show top-up modal
   */
  showTopUp(contentContext) {
    this.currentFlow = 'topup';
    this.contentContext = contentContext;
    this.updateContentInfo();
    this.updateCurrentBalance();
    this.setupSolarPaymentInfo();
    this.showFlow('topup');
    this.open();
  }

  /**
   * Update content information in modal
   */
  updateContentInfo() {
    if (!this.contentContext) return;
    
    const title = this.contentContext.title || `${this.contentContext.contentType}:${this.contentContext.contentId}`;
    const cost = this.contentContext.solarCost || 50;
    
    this.elements.contentTitles.forEach(el => {
      el.textContent = title;
    });
    
    this.elements.unlockCosts.forEach(el => {
      el.textContent = `Cost: ${cost} Solar`;
    });
  }

  /**
   * Update current balance display
   */
  updateCurrentBalance() {
    if (window.ProgressionManager && window.ProgressionManager.isUserRegistered()) {
      const balance = window.ProgressionManager.getUserBalance();
      this.elements.currentBalance.textContent = `${balance} Solar`;
    }
  }

  /**
   * Setup Solar-only payment info
   */
  setupSolarPaymentInfo() {
    // Update the payment info section with current context
    if (this.elements.paymentInfo) {
      const noteElement = this.elements.paymentInfo.querySelector('.payment-note p:first-child');
      if (noteElement) {
        noteElement.innerHTML = '💡 This is a demo system. Solar tokens are earned through registration and daily bonuses.';
      }
    }
  }

  /**
   * Show specific flow
   */
  showFlow(flowName) {
    // Hide all flows
    this.elements.registrationFlow.style.display = 'none';
    this.elements.topupFlow.style.display = 'none';
    this.elements.successFlow.style.display = 'none';
    this.elements.loadingState.style.display = 'none';
    
    // Show requested flow
    switch (flowName) {
      case 'registration':
        this.elements.registrationFlow.style.display = 'block';
        break;
      case 'topup':
        this.elements.topupFlow.style.display = 'block';
        break;
      case 'success':
        this.elements.successFlow.style.display = 'block';
        break;
      case 'loading':
        this.elements.loadingState.style.display = 'block';
        break;
    }
  }

  /**
   * Handle amount selection
   */
  selectAmount(button) {
    // Remove selection from all buttons
    this.elements.amountButtons.forEach(btn => {
      btn.classList.remove('selected');
    });
    
    // Select clicked button
    button.classList.add('selected');
    
    // Handle custom amount
    if (button.classList.contains('custom-amount-btn')) {
      this.elements.customAmountInput.style.display = 'block';
      this.elements.customAmountField.focus();
      this.selectedAmount = null;
    } else {
      this.elements.customAmountInput.style.display = 'none';
      this.selectedAmount = parseInt(button.dataset.amount);
    }
    
    this.updatePaymentButton();
  }

  /**
   * Update payment button state
   */
  updatePaymentButton() {
    let amount = this.selectedAmount;
    
    // Check if custom amount is visible and has value
    if (this.elements.customAmountInput.style.display !== 'none') {
      amount = parseInt(this.elements.customAmountField.value) || 0;
    }
    
    if (amount && amount >= 50) {
      this.elements.payButton.disabled = false;
      this.elements.paymentAmount.textContent = `(${amount} Solar)`;
    } else {
      this.elements.payButton.disabled = true;
      this.elements.paymentAmount.textContent = '(Demo only)';
    }
  }

  /**
   * Handle user registration
   */
  async handleRegistration() {
    if (!window.ProgressionManager) {
      throw new Error('ProgressionManager not available');
    }

    const formData = new FormData(this.elements.registrationForm);
    const email = formData.get('email');
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');

    this.showFlow('loading');

    try {
      const result = await window.ProgressionManager.registerUser(email, firstName, lastName);
      
      // After registration, try to unlock content if user has enough balance
      if (this.contentContext) {
        const balance = window.ProgressionManager.getUserBalance();
        const cost = this.contentContext.solarCost || 50;
        
        if (balance >= cost) {
          await this.unlockContent();
          return;
        } else {
          // Not enough balance, show demo message
          this.showError('Registration successful! In a real system, you would purchase Solar tokens to unlock content. For this demo, users get daily Solar bonuses.');
        }
      } else {
        this.showSuccess('Registration completed successfully!');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Handle demo top-up (Solar-only system)
   */
  async handleDemoTopUp() {
    let amount = this.selectedAmount;
    if (this.elements.customAmountInput.style.display !== 'none') {
      amount = parseInt(this.elements.customAmountField.value) || 0;
    }

    if (!amount || amount < 50) {
      this.showError('Please select a valid amount (minimum 50 Solar)');
      return;
    }

    this.showFlow('loading');

    try {
      // In a real system, this would integrate with a payment processor
      // For demo purposes, we'll show that this feature is not implemented
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
      
      this.showError('Demo Mode: Solar top-up via payment is not implemented. Users earn Solar through registration bonuses and daily rewards in the full system.');
    } catch (error) {
      console.error('Demo top-up failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Unlock content after successful payment/registration
   */
  async unlockContent() {
    try {
      const cost = this.contentContext.solarCost || 50;
      await window.ProgressionManager.unlockContent(
        this.contentContext.contentType,
        this.contentContext.contentId,
        cost
      );
      
      // Show success state
      this.elements.successContent.textContent = this.contentContext.title || `${this.contentContext.contentType}:${this.contentContext.contentId}`;
      this.elements.successCost.textContent = `${cost} Solar`;
      this.elements.successBalance.textContent = `${window.ProgressionManager.getUserBalance()} Solar`;
      
      this.showFlow('success');
    } catch (error) {
      console.error('Content unlock failed:', error);
      this.showError(error.message);
    }
  }

  /**
   * Access unlocked content
   */
  accessContent() {
    this.close();
    
    // Emit event to notify TimerUI or other components
    document.dispatchEvent(new CustomEvent('contentUnlocked', {
      detail: this.contentContext
    }));
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.elements.successContent.textContent = message;
    this.showFlow('success');
  }

  /**
   * Show error message
   */
  showError(message) {
    // Show error and return to previous flow after 3 seconds
    alert(`Error: ${message}`);
    this.showFlow(this.currentFlow);
  }

  /**
   * Open modal
   */
  open() {
    this.isOpen = true;
    this.elements.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close modal
   */
  close() {
    this.isOpen = false;
    this.elements.modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Reset form states
    this.elements.registrationForm.reset();
    this.elements.amountButtons.forEach(btn => btn.classList.remove('selected'));
    this.elements.customAmountInput.style.display = 'none';
    this.selectedAmount = null;
  }
}

// Global instance
window.PaymentModal = new PaymentModal();

// Listen for TimerUI events
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('timerUI:showRegistrationModal', (event) => {
    window.PaymentModal.showRegistration(event.detail);
  });
  
  document.addEventListener('timerUI:showTopUpModal', (event) => {
    window.PaymentModal.showTopUp(event.detail);
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaymentModal;
}