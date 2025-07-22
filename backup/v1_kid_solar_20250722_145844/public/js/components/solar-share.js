/**
 * Solar Achievement Sharing Component
 * 
 * This component makes it easy to share solar achievements
 * on social media or download achievement badges.
 */

class SolarShare {
  /**
   * Initialize the SolarShare component
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.location.origin;
    this.user = options.user || {};
    this.container = options.container || null;
    this.modalId = options.modalId || 'solar-share-modal';
    this.achievements = [];
    
    // Create share modal if container exists
    if (this.container) {
      this.createShareModal();
    }
  }
  
  /**
   * Create the share modal
   */
  createShareModal() {
    // Create modal container if selector is provided
    const container = typeof this.container === 'string' 
      ? document.querySelector(this.container) 
      : this.container;
    
    if (!container) {
      console.warn('Share container not found');
      return;
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'solar-share-modal';
    modal.style.display = 'none';
    
    // Create modal content
    modal.innerHTML = `
      <div class="solar-share-content">
        <span class="solar-share-close">&times;</span>
        <h2>Share Your Solar Achievement</h2>
        
        <div class="solar-share-badge-container">
          <img id="achievement-badge" src="" alt="Solar Achievement Badge" />
        </div>
        
        <div class="solar-share-options">
          <button class="solar-share-button twitter-share">
            <span class="share-icon">🐦</span>
            Share on Twitter
          </button>
          
          <button class="solar-share-button facebook-share">
            <span class="share-icon">📘</span>
            Share on Facebook
          </button>
          
          <button class="solar-share-button download-badge">
            <span class="share-icon">⬇️</span>
            Download Badge
          </button>
          
          <button class="solar-share-button copy-link">
            <span class="share-icon">🔗</span>
            Copy Link
          </button>
        </div>
        
        <div class="solar-share-link-container">
          <input type="text" id="share-link-input" readonly />
          <span class="copy-success-message">Link copied!</span>
        </div>
      </div>
    `;
    
    // Add modal to container
    container.appendChild(modal);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Add styles if not already present
    if (!document.getElementById('solar-share-styles')) {
      this.addStyles();
    }
  }
  
  /**
   * Set up event listeners for the share modal
   */
  setupEventListeners() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    
    // Close button
    const closeButton = modal.querySelector('.solar-share-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    
    // Close when clicking outside modal
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Twitter share
    const twitterBtn = modal.querySelector('.twitter-share');
    if (twitterBtn) {
      twitterBtn.addEventListener('click', () => {
        this.shareOnTwitter();
      });
    }
    
    // Facebook share
    const facebookBtn = modal.querySelector('.facebook-share');
    if (facebookBtn) {
      facebookBtn.addEventListener('click', () => {
        this.shareOnFacebook();
      });
    }
    
    // Download badge
    const downloadBtn = modal.querySelector('.download-badge');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.downloadBadge();
      });
    }
    
    // Copy link
    const copyBtn = modal.querySelector('.copy-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyShareLink();
      });
    }
  }
  
  /**
   * Add CSS styles for the share modal
   */
  addStyles() {
    const style = document.createElement('style');
    style.id = 'solar-share-styles';
    style.textContent = `
      .solar-share-modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        animation: fade-in 0.3s ease;
      }
      
      .solar-share-content {
        position: relative;
        background-color: white;
        margin: 10% auto;
        padding: 30px;
        width: 90%;
        max-width: 500px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        animation: slide-up 0.3s ease;
      }
      
      .solar-share-close {
        position: absolute;
        top: 15px;
        right: 20px;
        font-size: 28px;
        font-weight: bold;
        color: #aaa;
        cursor: pointer;
        transition: color 0.2s;
      }
      
      .solar-share-close:hover {
        color: #333;
      }
      
      .solar-share-modal h2 {
        margin-top: 0;
        color: #333;
        text-align: center;
        margin-bottom: 20px;
      }
      
      .solar-share-badge-container {
        width: 100%;
        height: 200px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 20px 0;
        background: #f8f9fa;
        border-radius: 10px;
        overflow: hidden;
      }
      
      #achievement-badge {
        max-width: 100%;
        max-height: 180px;
        object-fit: contain;
      }
      
      .solar-share-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
      }
      
      .solar-share-button {
        padding: 12px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 600;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
      
      .twitter-share {
        background-color: #1da1f2;
      }
      
      .facebook-share {
        background-color: #4267B2;
      }
      
      .download-badge {
        background-color: #7bc144;
      }
      
      .copy-link {
        background-color: #6c757d;
      }
      
      .solar-share-button:hover {
        opacity: 0.9;
      }
      
      .share-icon {
        margin-right: 8px;
        font-size: 16px;
      }
      
      .solar-share-link-container {
        position: relative;
        margin-top: 10px;
      }
      
      #share-link-input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
      }
      
      .copy-success-message {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 3px;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slide-up {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @media (max-width: 600px) {
        .solar-share-options {
          grid-template-columns: 1fr;
        }
        
        .solar-share-content {
          width: 95%;
          margin: 5% auto;
          padding: 20px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Open the share modal for a specific achievement
   * @param {Object} achievement - Achievement data
   */
  openShareModal(achievement) {
    if (!achievement) {
      console.warn('No achievement provided for sharing');
      return;
    }
    
    const modal = document.getElementById(this.modalId);
    if (!modal) {
      console.warn('Share modal not found');
      return;
    }
    
    // Generate badge URL
    const badgeUrl = this.generateBadgeUrl(achievement);
    
    // Update badge image
    const badgeImage = modal.querySelector('#achievement-badge');
    if (badgeImage) {
      badgeImage.src = badgeUrl;
      badgeImage.alt = `${this.user.name || 'Solar User'}'s Achievement`;
    }
    
    // Update share link
    const shareInput = modal.querySelector('#share-link-input');
    if (shareInput) {
      const shareUrl = this.generateShareUrl(achievement);
      shareInput.value = shareUrl;
    }
    
    // Store current achievement data
    this.currentAchievement = achievement;
    
    // Show the modal
    modal.style.display = 'block';
  }
  
  /**
   * Generate a URL for the achievement badge
   * @param {Object} achievement - Achievement data
   * @returns {string} Badge URL
   */
  generateBadgeUrl(achievement) {
    const name = encodeURIComponent(this.user.name || 'Solar User');
    const value = encodeURIComponent(achievement.value || '0');
    const type = encodeURIComponent(achievement.type || 'offset');
    
    return `${this.baseUrl}/badge?name=${name}&kwh=${value}&type=${type}`;
  }
  
  /**
   * Generate a share URL for the achievement
   * @param {Object} achievement - Achievement data
   * @returns {string} Share URL
   */
  generateShareUrl(achievement) {
    // Create a URL to the achievement page
    const shareUrl = new URL(`${this.baseUrl}/share`);
    
    // Add parameters
    shareUrl.searchParams.append('name', this.user.name || 'Solar User');
    shareUrl.searchParams.append('value', achievement.value || '0');
    shareUrl.searchParams.append('type', achievement.type || 'offset');
    
    return shareUrl.toString();
  }
  
  /**
   * Share achievement on Twitter
   */
  shareOnTwitter() {
    if (!this.currentAchievement) return;
    
    const text = this.generateShareText();
    const url = this.generateShareUrl(this.currentAchievement);
    
    const twitterUrl = new URL('https://twitter.com/intent/tweet');
    twitterUrl.searchParams.append('text', text);
    twitterUrl.searchParams.append('url', url);
    
    window.open(twitterUrl.toString(), '_blank');
  }
  
  /**
   * Share achievement on Facebook
   */
  shareOnFacebook() {
    if (!this.currentAchievement) return;
    
    const url = this.generateShareUrl(this.currentAchievement);
    
    const facebookUrl = new URL('https://www.facebook.com/sharer/sharer.php');
    facebookUrl.searchParams.append('u', url);
    
    window.open(facebookUrl.toString(), '_blank');
  }
  
  /**
   * Download the achievement badge
   */
  downloadBadge() {
    if (!this.currentAchievement) return;
    
    const badgeUrl = this.generateBadgeUrl(this.currentAchievement) + '&format=png';
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = badgeUrl;
    link.download = `solar-achievement-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Copy share link to clipboard
   */
  copyShareLink() {
    const linkInput = document.getElementById('share-link-input');
    if (!linkInput) return;
    
    // Select the text
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices
    
    // Copy to clipboard
    navigator.clipboard.writeText(linkInput.value)
      .then(() => {
        // Show success message
        const successMsg = document.querySelector('.copy-success-message');
        if (successMsg) {
          successMsg.style.opacity = '1';
          setTimeout(() => {
            successMsg.style.opacity = '0';
          }, 2000);
        }
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        
        // Fallback to older method
        try {
          document.execCommand('copy');
          
          // Show success message
          const successMsg = document.querySelector('.copy-success-message');
          if (successMsg) {
            successMsg.style.opacity = '1';
            setTimeout(() => {
              successMsg.style.opacity = '0';
            }, 2000);
          }
        } catch (e) {
          console.error('Failed to copy link (fallback):', e);
        }
      });
  }
  
  /**
   * Generate text for social media sharing
   * @returns {string} Share text
   */
  generateShareText() {
    if (!this.currentAchievement) return '';
    
    const name = this.user.name || 'I';
    const value = this.currentAchievement.value || '0';
    const type = this.currentAchievement.type || 'offset';
    
    // Customize message based on achievement type
    let message = '';
    
    switch (type) {
      case 'offset':
        message = `${name} just offset ${value} kWh of energy with The Current-See! 🌱⚡`;
        break;
      case 'generated':
        message = `${name} generated ${value} kWh of clean solar energy with The Current-See! ☀️⚡`;
        break;
      case 'saved':
        message = `${name} saved ${value} kWh of energy with The Current-See! 💚⚡`;
        break;
      default:
        message = `${name} just earned a solar achievement with The Current-See! ☀️`;
    }
    
    return message;
  }
  
  /**
   * Create a shareable achievement
   * @param {Object} achievementData - Achievement data
   * @returns {Object} Achievement object
   */
  createAchievement(achievementData) {
    const achievement = {
      id: achievementData.id || Date.now(),
      type: achievementData.type || 'offset',
      value: achievementData.value || '0',
      description: achievementData.description || 'Solar Achievement',
      timestamp: achievementData.timestamp || new Date().toISOString()
    };
    
    // Save to achievements array
    this.achievements.push(achievement);
    
    return achievement;
  }
  
  /**
   * Trigger an achievement and open the share modal
   * @param {Object} achievementData - Achievement data
   */
  triggerAchievement(achievementData) {
    // Create achievement
    const achievement = this.createAchievement(achievementData);
    
    // Dispatch achievement event
    const event = new CustomEvent('achievement:unlocked', {
      detail: achievement
    });
    document.dispatchEvent(event);
    
    // Open share modal
    this.openShareModal(achievement);
    
    return achievement;
  }
}

// Make globally available
window.SolarShare = SolarShare;