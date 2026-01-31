(function() {
  'use strict';

  function addKidSolarStyles() {
    const style = document.createElement('style');
    style.id = 'kid-solar-global-styles';
    style.textContent = `
      /* Ensure D-ID agent is visible above all overlays */
      [data-agent-id], [data-name="did-agent"], did-agent, .did-widget, .fabio-widget {
        position: fixed !important;
        z-index: 999999 !important;
        display: block !important;
        visibility: visible !important;
      }
      
      /* D-ID widget container - above solar greeting (z-index 9999) */
      .did-agent-container, #did-agent, iframe[src*="d-id"] {
        position: fixed !important;
        z-index: 999999 !important;
      }
      
      /* Ensure solar greeting doesn't block D-ID */
      #solarGreetingOverlay {
        pointer-events: auto;
      }
      #solarGreetingOverlay.hidden {
        pointer-events: none !important;
      }
      
      #kid-solar-context-badge {
        position: fixed;
        bottom: 140px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255, 140, 0, 0.9), rgba(255, 100, 0, 0.9));
        color: #000;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        z-index: 9990;
        box-shadow: 0 4px 15px rgba(255, 140, 0, 0.4);
        display: none;
        pointer-events: none;
      }
      
      #kid-solar-context-badge.visible {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function getPageContext() {
    const path = window.location.pathname;
    const contexts = {
      '/': { area: 'Gateway', hint: 'Help users choose their path' },
      '/index.html': { area: 'Gateway', hint: 'Help users choose their path' },
      '/homepage-full.html': { area: 'Main Platform', hint: 'Full platform overview' },
      '/marketplace.html': { area: 'Marketplace', hint: 'Solar economy & trading' },
      '/commission-network.html': { area: 'Commission Network', hint: 'Organization pilots' },
      '/SolarStandard.html': { area: 'Solar Standard', hint: 'Protocol education' },
      '/agent.html': { area: 'Agent Center', hint: 'Personal AI agent' },
      '/wallet.html': { area: 'Solar Wallet', hint: 'Balance & transactions' },
      '/dmtxactly.html': { area: 'DMTXACTLY', hint: 'Creative platform' },
      '/whitepapers.html': { area: 'Whitepapers', hint: 'Documentation' },
      '/music-now.html': { area: 'Music Now', hint: 'Music streaming' },
      '/solar-dashboard.html': { area: 'Solar Dashboard', hint: 'Energy metrics' }
    };
    
    return contexts[path] || { area: 'TC-S Network', hint: 'General assistance' };
  }

  function createContextBadge() {
    const badge = document.createElement('div');
    badge.id = 'kid-solar-context-badge';
    const context = getPageContext();
    badge.innerHTML = `☀️ ${context.area}`;
    badge.title = context.hint;
    
    badge.addEventListener('click', function() {
      const agent = document.querySelector('[data-name="did-agent"]');
      if (agent && agent.shadowRoot) {
        const button = agent.shadowRoot.querySelector('button');
        if (button) button.click();
      }
    });
    
    document.body.appendChild(badge);
    
    setTimeout(() => {
      badge.classList.add('visible');
    }, 2000);
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        addKidSolarStyles();
        createContextBadge();
      });
    } else {
      addKidSolarStyles();
      createContextBadge();
    }
    console.log('☀️ Kid Solar context ready on', window.location.pathname);
  }

  init();
  
  window.KidSolar = {
    getContext: getPageContext
  };
})();
