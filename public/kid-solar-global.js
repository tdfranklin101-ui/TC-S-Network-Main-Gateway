(function() {
  'use strict';

  const DID_CONFIG = {
    src: 'https://agent.d-id.com/v2/index.js',
    mode: 'fabio',
    clientKey: 'YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==',
    agentId: 'v2_agt_vhYf_e_C',
    orientation: 'horizontal',
    position: 'right'
  };

  function addKidSolarStyles() {
    const style = document.createElement('style');
    style.id = 'kid-solar-global-styles';
    style.textContent = `
      /* D-ID agent styling - highest priority */
      [data-agent-id], [data-name="did-agent"], did-agent, .did-widget, .fabio-widget {
        position: fixed !important;
        z-index: 999999 !important;
        display: block !important;
        visibility: visible !important;
      }
      
      iframe[src*="d-id"] {
        z-index: 999999 !important;
      }
      
      /* Context badge */
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
        z-index: 999998;
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
      '/main-platform.html': { area: 'Main Platform', hint: 'Full platform overview' },
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

  function injectDIDAgent() {
    if (document.querySelector('script[data-agent-id="' + DID_CONFIG.agentId + '"]')) {
      console.log('☀️ D-ID already loaded');
      return;
    }
    
    const script = document.createElement('script');
    script.type = 'module';
    script.src = DID_CONFIG.src;
    script.setAttribute('data-mode', DID_CONFIG.mode);
    script.setAttribute('data-client-key', DID_CONFIG.clientKey);
    script.setAttribute('data-agent-id', DID_CONFIG.agentId);
    script.setAttribute('data-name', 'did-agent');
    script.setAttribute('data-monitor', 'true');
    script.setAttribute('data-orientation', DID_CONFIG.orientation);
    script.setAttribute('data-position', DID_CONFIG.position);
    
    script.onload = function() {
      console.log('☀️ D-ID Kid Solar loaded successfully');
    };
    
    script.onerror = function(e) {
      console.error('☀️ D-ID load error:', e);
    };
    
    document.body.appendChild(script);
    console.log('☀️ D-ID Kid Solar injected');
  }

  function createContextBadge() {
    if (document.getElementById('kid-solar-context-badge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'kid-solar-context-badge';
    const context = getPageContext();
    badge.innerHTML = `☀️ ${context.area}`;
    badge.title = context.hint;
    
    document.body.appendChild(badge);
    
    setTimeout(() => {
      badge.classList.add('visible');
    }, 2000);
  }

  function init() {
    addKidSolarStyles();
    createContextBadge();
    
    setTimeout(injectDIDAgent, 500);
    
    console.log('☀️ Kid Solar context ready on', window.location.pathname);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  window.KidSolar = {
    getContext: getPageContext,
    reload: injectDIDAgent
  };
})();
