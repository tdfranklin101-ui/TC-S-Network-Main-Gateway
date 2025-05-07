/**
 * Dashboard Layer Enhancements for Current-See
 * 
 * This script provides dashboard functionality including:
 * - Visual Solar token flow (earn/spend graph)
 * - Lifetime energy impact score
 * - Scan history + eco habits heatmap
 */

class SolarDashboard {
  /**
   * Initialize the Solar Dashboard
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.container = options.container || '#dashboard-container';
    this.userId = options.userId;
    this.username = options.username || 'Solar User';
    this.totalSolar = options.totalSolar || 0;
    this.achievements = [];
    this.scanHistory = [];
    this.energyImpact = 0;
    this.chartInstance = null;
    
    // Initialize the dashboard
    this.init();
  }
  
  /**
   * Initialize the dashboard
   */
  async init() {
    // Create container if it doesn't exist
    const dashboardContainer = document.querySelector(this.container);
    if (!dashboardContainer) {
      console.warn(`Dashboard container ${this.container} not found`);
      return;
    }
    
    // Add animation class for loading effect
    dashboardContainer.classList.add('loading');
    
    try {
      // Load data for the dashboard
      await this.loadUserData();
      await this.loadScanHistory();
      await this.loadAchievements();
      
      // Create dashboard sections
      this.createStatCards();
      this.createSolarFlowGraph();
      this.createScanHistorySection();
      this.createEnergyImpactScore();
      
      // Add animation for solar token flow
      this.initSolarTokenAnimation();
      
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      dashboardContainer.innerHTML = `
        <div class="dashboard-error">
          <h3>Dashboard Error</h3>
          <p>Could not load dashboard data. Please try again later.</p>
          <p class="error-details">${error.message}</p>
        </div>
      `;
    } finally {
      // Remove loading class
      dashboardContainer.classList.remove('loading');
    }
  }
  
  /**
   * Load user data from the API
   */
  async loadUserData() {
    try {
      const response = await fetch(`/api/members?id=${this.userId}`);
      if (!response.ok) throw new Error('Failed to load user data');
      
      const data = await response.json();
      if (data && data.length > 0) {
        const userData = data[0];
        this.username = userData.name;
        this.totalSolar = userData.totalSolar;
        this.joinDate = userData.joinedDate;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Continue with default values
    }
  }
  
  /**
   * Load scan history from the API
   */
  async loadScanHistory() {
    try {
      const response = await fetch('/api/scan-history');
      if (!response.ok) throw new Error('Failed to load scan history');
      
      this.scanHistory = await response.json();
    } catch (error) {
      console.error('Error loading scan history:', error);
      // Continue with empty scan history
    }
  }
  
  /**
   * Load achievements from the API
   */
  async loadAchievements() {
    try {
      const response = await fetch('/api/achievements');
      if (!response.ok) throw new Error('Failed to load achievements');
      
      this.achievements = await response.json();
    } catch (error) {
      console.error('Error loading achievements:', error);
      // Continue with empty achievements
    }
  }
  
  /**
   * Create stat cards at the top of the dashboard
   */
  createStatCards() {
    const container = document.querySelector(this.container);
    
    // Create stat cards container
    const statCardsSection = document.createElement('div');
    statCardsSection.className = 'dashboard-stat-cards';
    
    // Total SOLAR card
    const solarCard = document.createElement('div');
    solarCard.className = 'dashboard-stat-card solar-card';
    solarCard.innerHTML = `
      <div class="stat-icon">☀️</div>
      <div class="stat-value">${this.totalSolar.toFixed(2)}</div>
      <div class="stat-label">Total SOLAR</div>
    `;
    
    // Calculate energy saved
    const energySavedKwh = this.totalSolar * 4913; // 1 SOLAR = 4,913 kWh
    
    // Energy Saved card
    const energyCard = document.createElement('div');
    energyCard.className = 'dashboard-stat-card energy-card';
    energyCard.innerHTML = `
      <div class="stat-icon">⚡</div>
      <div class="stat-value">${(energySavedKwh / 1000).toFixed(2)}</div>
      <div class="stat-label">MWh Energy Impact</div>
    `;
    
    // Scans completed card
    const scansCard = document.createElement('div');
    scansCard.className = 'dashboard-stat-card scans-card';
    scansCard.innerHTML = `
      <div class="stat-icon">🔍</div>
      <div class="stat-value">${this.scanHistory.length}</div>
      <div class="stat-label">Products Scanned</div>
    `;
    
    // Achievements card
    const achievementsCard = document.createElement('div');
    achievementsCard.className = 'dashboard-stat-card achievements-card';
    achievementsCard.innerHTML = `
      <div class="stat-icon">🏆</div>
      <div class="stat-value">${this.achievements.length}</div>
      <div class="stat-label">Achievements</div>
    `;
    
    // Add all cards to the container
    statCardsSection.appendChild(solarCard);
    statCardsSection.appendChild(energyCard);
    statCardsSection.appendChild(scansCard);
    statCardsSection.appendChild(achievementsCard);
    
    // Add to main container
    container.appendChild(statCardsSection);
  }
  
  /**
   * Create solar flow graph (earn/spend visualization)
   */
  createSolarFlowGraph() {
    const container = document.querySelector(this.container);
    
    // Create graph container
    const graphSection = document.createElement('div');
    graphSection.className = 'dashboard-graph-section';
    graphSection.innerHTML = `
      <h3>Solar Flow (Last 30 Days)</h3>
      <div class="solar-flow-graph">
        <canvas id="solarFlowChart" width="800" height="300"></canvas>
      </div>
    `;
    
    container.appendChild(graphSection);
    
    // Simple mock data for the graph - in a real implementation, this would come from the API
    const dates = [];
    const solarEarned = [];
    const solarSpent = [];
    
    // Generate dates for the last 30 days
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      // Daily solar earned (1 per day)
      solarEarned.push(1);
      
      // Random solar spent (simulating product purchases or offsets)
      const spent = Math.random() > 0.7 ? (Math.random() * 0.5).toFixed(2) : 0;
      solarSpent.push(spent);
    }
    
    // Check if Chart.js is available
    if (window.Chart) {
      const ctx = document.getElementById('solarFlowChart').getContext('2d');
      this.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: dates,
          datasets: [
            {
              label: 'Solar Earned',
              data: solarEarned,
              backgroundColor: 'rgba(255, 215, 0, 0.7)',
              borderColor: 'rgba(255, 215, 0, 1)',
              borderWidth: 1
            },
            {
              label: 'Solar Spent',
              data: solarSpent,
              backgroundColor: 'rgba(123, 193, 68, 0.7)',
              borderColor: 'rgba(123, 193, 68, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: false,
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              stacked: false,
              title: {
                display: true,
                text: 'SOLAR'
              }
            }
          }
        }
      });
    } else {
      console.warn('Chart.js not available. Solar flow graph not rendered.');
    }
  }
  
  /**
   * Create scan history section
   */
  createScanHistorySection() {
    const container = document.querySelector(this.container);
    
    // Create scan history section
    const scanSection = document.createElement('div');
    scanSection.className = 'dashboard-scan-history';
    scanSection.innerHTML = `
      <h3>Recent Product Scans</h3>
      <div class="scan-history-list"></div>
    `;
    
    container.appendChild(scanSection);
    
    const scanList = scanSection.querySelector('.scan-history-list');
    
    // Add scan history items (most recent first)
    const recentScans = this.scanHistory.slice(0, 5); // Show only most recent 5
    
    if (recentScans.length === 0) {
      scanList.innerHTML = `
        <div class="empty-scan-history">
          <p>No product scans yet. Scan your first product to see energy data here!</p>
        </div>
      `;
    } else {
      recentScans.forEach(scan => {
        const scanItem = document.createElement('div');
        scanItem.className = 'scan-item';
        
        // Calculate eco score class based on value
        let ecoScoreClass = 'neutral';
        if (scan.ecoScore >= 80) ecoScoreClass = 'excellent';
        else if (scan.ecoScore >= 60) ecoScoreClass = 'good';
        else if (scan.ecoScore <= 30) ecoScoreClass = 'poor';
        
        // Format date
        const scanDate = new Date(scan.timestamp);
        const dateString = scanDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        
        scanItem.innerHTML = `
          <div class="scan-product-info">
            <div class="scan-product-name">${scan.productName}</div>
            <div class="scan-product-location">${scan.city || 'Unknown'}, ${scan.country || 'Unknown'}</div>
            <div class="scan-date">${dateString}</div>
          </div>
          <div class="scan-energy-info">
            <div class="scan-energy-value">${scan.energyKwh.toFixed(2)} kWh</div>
            <div class="scan-eco-score ${ecoScoreClass}">Eco Score: ${scan.ecoScore || 'N/A'}</div>
          </div>
        `;
        
        scanList.appendChild(scanItem);
      });
    }
  }
  
  /**
   * Create energy impact score visualization
   */
  createEnergyImpactScore() {
    const container = document.querySelector(this.container);
    
    // Calculate total energy impact
    const totalEnergyKwh = this.scanHistory.reduce((total, scan) => total + scan.energyKwh, 0);
    const solarEnergyKwh = this.totalSolar * 4913; // 1 SOLAR = 4,913 kWh
    const totalImpact = totalEnergyKwh + solarEnergyKwh;
    
    // Convert to different units for better understanding
    const impactInMwh = totalImpact / 1000;
    
    // Calculate equivalents
    const treeMonths = Math.round(totalImpact / 0.5); // 0.5 kWh per tree per month
    const homesDays = Math.round(totalImpact / 30); // 30 kWh average home daily usage
    
    // Create impact section
    const impactSection = document.createElement('div');
    impactSection.className = 'dashboard-impact-section';
    impactSection.innerHTML = `
      <h3>Your Energy Impact</h3>
      <div class="impact-score-container">
        <div class="impact-score">
          <div class="impact-value">${impactInMwh.toFixed(2)}</div>
          <div class="impact-unit">MWh</div>
        </div>
        <div class="impact-equivalents">
          <div class="impact-equivalent">
            <div class="equivalent-icon">🌳</div>
            <div class="equivalent-value">${treeMonths}</div>
            <div class="equivalent-label">Tree-Months</div>
          </div>
          <div class="impact-equivalent">
            <div class="equivalent-icon">🏠</div>
            <div class="equivalent-value">${homesDays}</div>
            <div class="equivalent-label">Home-Days</div>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(impactSection);
  }
  
  /**
   * Initialize solar token animation
   */
  initSolarTokenAnimation() {
    const container = document.querySelector(this.container);
    
    // Create animated token flow container
    const tokenFlowContainer = document.createElement('div');
    tokenFlowContainer.className = 'solar-token-flow';
    container.appendChild(tokenFlowContainer);
    
    // Create animated tokens
    const createToken = () => {
      const token = document.createElement('div');
      token.className = 'token-particle';
      
      // Random starting and ending positions
      const startX = Math.random() * 100;
      const endX = startX + (Math.random() * 40 - 20);
      
      // Set custom properties for the animation
      token.style.setProperty('--start-x', `${startX}%`);
      token.style.setProperty('--end-x', `${endX}%`);
      
      tokenFlowContainer.appendChild(token);
      
      // Remove the token after animation completes
      setTimeout(() => {
        token.remove();
      }, 3100); // Animation is 3s, add a little buffer
    };
    
    // Create particles at random intervals
    setInterval(createToken, 500);
  }
}

// Make globally available
window.SolarDashboard = SolarDashboard;