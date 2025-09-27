// World ID Human Verification for TC-S Network
// Integrates with World.org's human verification protocol

class WorldIDVerification {
    constructor(config = {}) {
        this.appId = config.appId || 'app_staging_3a3e7e1f4c6b9c8a2b1d0e5f'; // Default staging app ID
        this.action = config.action || 'tc-s-member-registration';
        this.verificationLevel = config.verificationLevel || 'orb';
        this.onSuccess = config.onSuccess || this.defaultSuccessHandler;
        this.onError = config.onError || this.defaultErrorHandler;
        this.isLoaded = false;
        this.isVerifying = false;
        
        this.loadWorldIDScript();
    }
    
    loadWorldIDScript() {
        if (document.getElementById('worldid-script')) {
            this.initializeWorldID();
            return;
        }
        
        const script = document.createElement('script');
        script.id = 'worldid-script';
        script.src = 'https://cdn.worldcoin.org/js/idkit@2.4.0/dist/index.js';
        script.onload = () => {
            this.isLoaded = true;
            this.initializeWorldID();
        };
        script.onerror = () => {
            console.error('Failed to load World ID script');
            this.showError('Failed to load World ID verification system');
        };
        document.head.appendChild(script);
    }
    
    initializeWorldID() {
        if (!window.IDKit) {
            console.error('World ID SDK not available');
            return;
        }
        
        this.isLoaded = true;
        console.log('World ID verification system loaded');
    }
    
    async verifyHuman(options = {}) {
        if (!this.isLoaded) {
            this.showError('World ID system not loaded yet');
            return;
        }
        
        if (this.isVerifying) {
            this.showError('Verification already in progress');
            return;
        }
        
        this.isVerifying = true;
        this.showStatus('Initializing World ID verification...');
        
        try {
            const verificationOptions = {
                app_id: this.appId,
                action: this.action,
                verification_level: this.verificationLevel,
                signal: options.signal || '',
                onSuccess: (result) => this.handleVerificationSuccess(result),
                handleVerify: (proof) => this.handleProofVerification(proof),
                onError: (error) => this.handleVerificationError(error)
            };
            
            // Use World ID widget
            if (window.IDKit && window.IDKit.open) {
                window.IDKit.open(verificationOptions);
            } else {
                throw new Error('World ID widget not available');
            }
            
        } catch (error) {
            console.error('World ID verification error:', error);
            this.handleVerificationError(error);
        }
    }
    
    async handleProofVerification(proof) {
        try {
            this.showStatus('Verifying your proof with TC-S Network...');
            
            const response = await fetch('/api/verify-world-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nullifier_hash: proof.nullifier_hash,
                    merkle_root: proof.merkle_root,
                    proof: proof.proof,
                    verification_level: proof.verification_level,
                    action: this.action,
                    signal_hash: proof.signal_hash || ''
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                return result;
            } else {
                throw new Error(result.error || 'Verification failed');
            }
            
        } catch (error) {
            console.error('Proof verification failed:', error);
            throw error;
        }
    }
    
    handleVerificationSuccess(result) {
        this.isVerifying = false;
        this.showStatus('✅ Human verification successful!', 'success');
        
        // Store verification result
        localStorage.setItem('worldid_verified', JSON.stringify({
            verified: true,
            nullifier_hash: result.nullifier_hash,
            verification_level: result.verification_level,
            timestamp: Date.now()
        }));
        
        this.onSuccess(result);
    }
    
    handleVerificationError(error) {
        this.isVerifying = false;
        console.error('World ID verification error:', error);
        this.showStatus('❌ Verification failed. Please try again.', 'error');
        this.onError(error);
    }
    
    isUserVerified() {
        const stored = localStorage.getItem('worldid_verified');
        if (!stored) return false;
        
        try {
            const data = JSON.parse(stored);
            // Check if verification is recent (within 30 days)
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            return data.verified && (Date.now() - data.timestamp) < thirtyDaysMs;
        } catch {
            return false;
        }
    }
    
    getVerificationStatus() {
        const stored = localStorage.getItem('worldid_verified');
        if (!stored) return null;
        
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
    
    clearVerification() {
        localStorage.removeItem('worldid_verified');
    }
    
    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('world-id-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `world-id-status ${type}`;
            statusEl.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 5000);
            }
        }
    }
    
    showError(message) {
        this.showStatus(message, 'error');
    }
    
    defaultSuccessHandler(result) {
        console.log('World ID verification successful:', result);
        // Redirect to complete registration or unlock features
        if (window.location.pathname.includes('signup') || window.location.pathname.includes('register')) {
            window.location.href = '/dashboard';
        }
    }
    
    defaultErrorHandler(error) {
        console.error('World ID verification failed:', error);
    }
    
    createVerificationButton(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        
        const buttonText = options.buttonText || '🌍 Verify with World ID';
        const buttonClass = options.buttonClass || 'world-id-verify-btn';
        
        const buttonHTML = `
            <div class="world-id-verification-section">
                <button id="world-id-verify-btn" class="${buttonClass}" onclick="window.worldIDVerifier.verifyHuman()">
                    ${buttonText}
                </button>
                <div id="world-id-status" class="world-id-status" style="display: none;"></div>
                <div class="world-id-info">
                    <p style="font-size: 14px; color: #666; margin-top: 10px;">
                        🛡️ World ID provides sybil-resistant human verification while protecting your privacy through zero-knowledge proofs.
                    </p>
                </div>
            </div>
        `;
        
        container.innerHTML = buttonHTML;
        
        // Add styles
        this.addVerificationStyles();
    }
    
    addVerificationStyles() {
        if (document.getElementById('world-id-styles')) return;
        
        const styles = `
            <style id="world-id-styles">
                .world-id-verification-section {
                    text-align: center;
                    margin: 20px 0;
                    padding: 20px;
                    border: 2px solid rgba(18, 245, 192, 0.3);
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(18, 245, 192, 0.1), rgba(0, 204, 51, 0.1));
                }
                
                .world-id-verify-btn {
                    background: linear-gradient(135deg, #12f5c0, #00cc33);
                    border: none;
                    border-radius: 10px;
                    color: #000000;
                    font-size: 16px;
                    font-weight: bold;
                    padding: 15px 30px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    box-shadow: 0 4px 8px rgba(18, 245, 192, 0.3);
                }
                
                .world-id-verify-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 12px rgba(18, 245, 192, 0.4);
                }
                
                .world-id-verify-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                
                .world-id-status {
                    margin: 15px 0;
                    padding: 10px;
                    border-radius: 8px;
                    font-weight: bold;
                }
                
                .world-id-status.info {
                    background: rgba(0, 123, 255, 0.1);
                    color: #007bff;
                    border: 1px solid rgba(0, 123, 255, 0.2);
                }
                
                .world-id-status.success {
                    background: rgba(40, 167, 69, 0.1);
                    color: #28a745;
                    border: 1px solid rgba(40, 167, 69, 0.2);
                }
                
                .world-id-status.error {
                    background: rgba(220, 53, 69, 0.1);
                    color: #dc3545;
                    border: 1px solid rgba(220, 53, 69, 0.2);
                }
                
                .world-id-info p {
                    margin: 0;
                    text-align: center;
                    font-style: italic;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// Initialize global World ID verifier
window.worldIDVerifier = new WorldIDVerification({
    onSuccess: (result) => {
        console.log('TC-S Network: Human verification successful', result);
        // Show success message and enable registration
        document.dispatchEvent(new CustomEvent('worldid-verified', { 
            detail: { result, verified: true } 
        }));
    },
    onError: (error) => {
        console.error('TC-S Network: Human verification failed', error);
        document.dispatchEvent(new CustomEvent('worldid-error', { 
            detail: { error, verified: false } 
        }));
    }
});

// Utility functions for integration
window.WorldIDUtils = {
    isVerified: () => window.worldIDVerifier.isUserVerified(),
    getStatus: () => window.worldIDVerifier.getVerificationStatus(),
    verify: (options) => window.worldIDVerifier.verifyHuman(options),
    clear: () => window.worldIDVerifier.clearVerification(),
    createButton: (containerId, options) => window.worldIDVerifier.createVerificationButton(containerId, options)
};