(function() {
  'use strict';
  
  const KID_SOLAR_CONFIG = {
    scriptSrc: 'https://agent.d-id.com/v2/index.js',
    clientKey: 'YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==',
    agentId: 'v2_agt_vhYf_e_C',
    mode: 'fabio',
    name: 'did-agent',
    monitor: 'true',
    orientation: 'horizontal',
    position: 'right'
  };

  function injectDIDAgent() {
    if (document.querySelector('script[data-name="did-agent"]')) {
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = KID_SOLAR_CONFIG.scriptSrc;
    script.dataset.mode = KID_SOLAR_CONFIG.mode;
    script.dataset.clientKey = KID_SOLAR_CONFIG.clientKey;
    script.dataset.agentId = KID_SOLAR_CONFIG.agentId;
    script.dataset.name = KID_SOLAR_CONFIG.name;
    script.dataset.monitor = KID_SOLAR_CONFIG.monitor;
    script.dataset.orientation = KID_SOLAR_CONFIG.orientation;
    script.dataset.position = KID_SOLAR_CONFIG.position;
    
    document.body.appendChild(script);
    
    console.log('☀️ Kid Solar activated on', window.location.pathname);
  }

  function addKidSolarStyles() {
    const style = document.createElement('style');
    style.id = 'kid-solar-global-styles';
    style.textContent = `
      [data-name="did-agent"] {
        z-index: 9998 !important;
      }
      
      #kid-solar-context-badge {
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255, 140, 0, 0.9), rgba(255, 100, 0, 0.9));
        color: #000;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9997;
        box-shadow: 0 4px 15px rgba(255, 140, 0, 0.4);
        display: none;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      #kid-solar-context-badge:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255, 140, 0, 0.6);
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
        injectDIDAgent();
        createContextBadge();
      });
    } else {
      addKidSolarStyles();
      injectDIDAgent();
      createContextBadge();
    }
  }

  init();
  
  window.KidSolar = {
    getContext: getPageContext,
    refresh: injectDIDAgent
  };
})();
