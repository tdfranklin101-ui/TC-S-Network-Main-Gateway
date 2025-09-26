// Solar Counter Management
class SolarCounter {
    constructor() {
        this.currentSolar = 150000000;
        this.solarPerSecond = 2.5;
        this.lastUpdate = Date.now();
        this.counterElement = null;
        this.init();
    }

    init() {
        this.counterElement = document.getElementById('solarCounter');
        if (this.counterElement) {
            this.startCounter();
            this.fetchLatestSolar();
        }
    }

    startCounter() {
        // Update counter every second
        setInterval(() => {
            this.updateLocalCounter();
        }, 1000);

        // Fetch from server every 30 seconds
        setInterval(() => {
            this.fetchLatestSolar();
        }, 30000);
    }

    updateLocalCounter() {
        const now = Date.now();
        const seconds = (now - this.lastUpdate) / 1000;
        this.currentSolar += seconds * this.solarPerSecond;
        this.lastUpdate = now;
        
        this.displaySolar(Math.floor(this.currentSolar));
    }

    async fetchLatestSolar() {
        try {
            const response = await fetch('/api/solar');
            if (response.ok) {
                const data = await response.json();
                this.currentSolar = data.totalSolar;
                this.solarPerSecond = data.perSecond;
                this.lastUpdate = data.timestamp;
                this.displaySolar(data.totalSolar);
            }
        } catch (error) {
            console.log('Solar counter running in offline mode');
        }
    }

    displaySolar(amount) {
        if (this.counterElement) {
            const formatted = this.formatNumber(amount);
            this.counterElement.textContent = formatted;
            
            // Add flash animation
            this.counterElement.classList.add('counter-update');
            setTimeout(() => {
                this.counterElement.classList.remove('counter-update');
            }, 500);
        }
    }

    formatNumber(num) {
        return new Intl.NumberFormat('en-US').format(num);
    }
}

// Initialize solar counter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.solarCounter = new SolarCounter();
});

// Export for use in other scripts
window.SolarCounter = SolarCounter;