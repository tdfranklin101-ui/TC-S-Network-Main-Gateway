// Marketplace Frontend Logic
class MarketplaceApp {
    constructor() {
        this.currentMember = null;
        this.artifacts = [];
        this.members = [];
        this.transactions = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupNavigation();
    }

    setupEventListeners() {
        // Join form
        const joinForm = document.getElementById('joinForm');
        if (joinForm) {
            joinForm.addEventListener('submit', (e) => this.handleJoinSubmit(e));
        }

        // Upload form
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => this.handleUploadSubmit(e));
        }
    }

    setupNavigation() {
        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    async loadInitialData() {
        await Promise.all([
            this.loadArtifacts(),
            this.loadMembers(),
            this.loadTransactions()
        ]);
        this.updateStats();
    }

    async loadArtifacts() {
        try {
            const response = await fetch('/api/artifacts');
            if (response.ok) {
                const data = await response.json();
                this.artifacts = data.artifacts || [];
                this.displayArtifacts();
            }
        } catch (error) {
            console.error('Failed to load artifacts:', error);
            this.displayOfflineArtifacts();
        }
    }

    async loadMembers() {
        try {
            const response = await fetch('/api/members');
            if (response.ok) {
                const data = await response.json();
                this.members = data.members || [];
                this.displayMembers();
            }
        } catch (error) {
            console.error('Failed to load members:', error);
            this.displayOfflineMembers();
        }
    }

    async loadTransactions() {
        try {
            const response = await fetch('/api/transactions');
            if (response.ok) {
                const data = await response.json();
                this.transactions = data.transactions || [];
                this.displayTransactions();
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
        }
    }

    displayArtifacts() {
        const grid = document.getElementById('artifactsGrid');
        if (!grid) return;

        if (this.artifacts.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: #666;">No artifacts available yet. Be the first to upload!</p>';
            return;
        }

        grid.innerHTML = this.artifacts.map(artifact => `
            <div class="artifact-card ${artifact.featured ? 'featured' : ''}">
                <div class="artifact-title">${this.escapeHtml(artifact.title)}</div>
                <div class="artifact-description">${this.escapeHtml(artifact.description)}</div>
                <div class="artifact-meta">
                    <span class="artifact-price">${artifact.solarPrice} SOLAR</span>
                    <span class="artifact-category">${artifact.category}</span>
                </div>
                <div class="artifact-creator">By: ${this.escapeHtml(artifact.creator)}</div>
                <button class="purchase-btn" onclick="app.purchaseArtifact('${artifact.id}')">
                    Purchase with SOLAR
                </button>
            </div>
        `).join('');
    }

    displayMembers() {
        const list = document.getElementById('membersList');
        if (!list) return;

        if (this.members.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">No members yet. Join the network!</p>';
            return;
        }

        list.innerHTML = this.members.map(member => `
            <div class="member-card">
                <div class="member-name">${this.escapeHtml(member.name)}</div>
                <div class="member-balance">${member.solarBalance} SOLAR</div>
                <div class="member-since">Member since ${new Date(member.joinDate).toLocaleDateString()}</div>
            </div>
        `).join('');
    }

    displayTransactions() {
        const list = document.getElementById('transactionsList');
        if (!list) return;

        if (this.transactions.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">No transactions yet.</p>';
            return;
        }

        // Show latest 5 transactions
        const recentTransactions = this.transactions.slice(-5).reverse();
        
        list.innerHTML = recentTransactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-details">
                    <div class="transaction-type">Purchase</div>
                    <div class="transaction-time">${new Date(transaction.timestamp).toLocaleString()}</div>
                </div>
                <div class="transaction-amount">-${transaction.amount} SOLAR</div>
            </div>
        `).join('');
    }

    updateStats() {
        const artifactCount = document.getElementById('artifactCount');
        const memberCount = document.getElementById('memberCount');
        const transactionCount = document.getElementById('transactionCount');

        if (artifactCount) artifactCount.textContent = this.artifacts.length;
        if (memberCount) memberCount.textContent = this.members.length;
        if (transactionCount) transactionCount.textContent = this.transactions.length;
    }

    async handleJoinSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('memberName').value.trim();
        const email = document.getElementById('memberEmail').value.trim();

        if (!name || !email) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Welcome to the TC-S Network!', 'success');
                this.currentMember = data.member;
                document.getElementById('joinForm').reset();
                await this.loadMembers();
                this.updateStats();
            } else {
                this.showMessage(data.error || 'Failed to join network', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleUploadSubmit(e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('title', document.getElementById('artifactTitle').value);
        formData.append('description', document.getElementById('artifactDescription').value);
        formData.append('solarPrice', document.getElementById('artifactPrice').value);
        formData.append('creator', document.getElementById('artifactCreator').value);
        formData.append('category', document.getElementById('artifactCategory').value);

        const fileInput = document.getElementById('artifactFile');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/artifacts', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Artifact uploaded successfully!', 'success');
                document.getElementById('uploadForm').reset();
                await this.loadArtifacts();
                this.updateStats();
            } else {
                this.showMessage(data.error || 'Failed to upload artifact', 'error');
            }
        } catch (error) {
            this.showMessage('Upload failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async purchaseArtifact(artifactId) {
        if (!this.currentMember) {
            this.showMessage('Please join the network first to make purchases', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    artifactId: artifactId,
                    memberId: this.currentMember.id
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Purchase successful!', 'success');
                this.currentMember.solarBalance = data.newBalance;
                await this.loadTransactions();
                this.updateStats();
            } else {
                this.showMessage(data.error || 'Purchase failed', 'error');
            }
        } catch (error) {
            this.showMessage('Purchase failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayOfflineArtifacts() {
        // Fallback sample data for offline mode
        const sampleArtifacts = [
            {
                id: '1',
                title: 'Solar Sunrise Digital Art',
                description: 'Beautiful digital artwork capturing renewable energy essence',
                solarPrice: 250,
                creator: 'EcoArtist',
                category: 'Digital Art',
                featured: true
            },
            {
                id: '2',
                title: 'Sustainable Future NFT',
                description: 'A vision of our renewable energy future',
                solarPrice: 500,
                creator: 'FutureVision',
                category: 'NFT',
                featured: true
            }
        ];

        this.artifacts = sampleArtifacts;
        this.displayArtifacts();
    }

    displayOfflineMembers() {
        const sampleMembers = [
            {
                id: '1',
                name: 'Solar Pioneer',
                solarBalance: 2500,
                joinDate: new Date().toISOString()
            },
            {
                id: '2', 
                name: 'Renewable Creator',
                solarBalance: 1800,
                joinDate: new Date().toISOString()
            }
        ];

        this.members = sampleMembers;
        this.displayMembers();
    }

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (modal) {
            modal.style.display = show ? 'block' : 'none';
        }
    }

    showMessage(message, type = 'info') {
        // Create and show a temporary message
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 1rem 2rem;
            border-radius: 5px;
            z-index: 2000;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transition = 'opacity 0.3s';
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MarketplaceApp();
});

// Export for global access
window.MarketplaceApp = MarketplaceApp;