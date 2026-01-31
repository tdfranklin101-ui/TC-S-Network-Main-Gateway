(function() {
  'use strict';
  
  const KID_SOLAR_CONFIG = {
    agentId: 'v2_agt_lmJp1s6K',
    clientKey: 'Z29vZ2xlLW9hdXRoMnwxMDcyNjAyNzY5Njc4NTMyMjY1MjM6NEt2UC1nU1hRZmFDUTJvcUZKdzY2',
    scriptSrc: 'https://agent.d-id.com/v2/index.js'
  };

  const SESSION_KEY = 'kidSolarActive';
  const CONVERSATION_KEY = 'kidSolarConversation';

  function isSessionActive() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  function activateSession() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    console.log('☀️ Kid Solar session activated');
    injectDidAgent();
    showSignOffButton();
  }

  function deactivateSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(CONVERSATION_KEY);
    console.log('👋 Kid Solar session ended');
    removeDidAgent();
    hideSignOffButton();
    showActivateButton();
  }

  function injectDidAgent() {
    if (document.querySelector('script[data-agent-id="' + KID_SOLAR_CONFIG.agentId + '"]')) {
      console.log('☀️ Kid Solar already loaded');
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = KID_SOLAR_CONFIG.scriptSrc;
    script.setAttribute('data-mode', 'fabio');
    script.setAttribute('data-client-key', KID_SOLAR_CONFIG.clientKey);
    script.setAttribute('data-agent-id', KID_SOLAR_CONFIG.agentId);
    script.setAttribute('data-name', 'did-agent');
    script.setAttribute('data-monitor', 'true');
    script.setAttribute('data-orientation', 'horizontal');
    script.setAttribute('data-position', 'right');
    
    document.body.appendChild(script);
    console.log('☀️ Kid Solar D-ID agent injected');
  }

  function removeDidAgent() {
    const script = document.querySelector('script[data-agent-id="' + KID_SOLAR_CONFIG.agentId + '"]');
    if (script) {
      script.remove();
    }
    const agentElements = document.querySelectorAll('[data-agent-id], [data-name="did-agent"]');
    agentElements.forEach(el => el.remove());
    
    const iframes = document.querySelectorAll('iframe[src*="d-id"]');
    iframes.forEach(el => el.remove());
  }

  function createSignOffButton() {
    if (document.getElementById('kid-solar-signoff')) return;
    
    const btn = document.createElement('button');
    btn.id = 'kid-solar-signoff';
    btn.innerHTML = '👋 Sign Off Kid Solar';
    btn.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      z-index: 999997;
      background: linear-gradient(135deg, #ff6b35, #f7931e);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
      transition: all 0.3s ease;
      display: none;
    `;
    btn.onmouseover = function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.6)';
    };
    btn.onmouseout = function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.4)';
    };
    btn.onclick = function() {
      if (confirm('Are you sure you want to sign off Kid Solar?')) {
        deactivateSession();
      }
    };
    
    document.body.appendChild(btn);
    return btn;
  }

  function createActivateButton() {
    if (document.getElementById('kid-solar-activate')) return;
    
    const btn = document.createElement('button');
    btn.id = 'kid-solar-activate';
    btn.innerHTML = '☀️ Activate Kid Solar';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999997;
      background: linear-gradient(135deg, #00d4aa, #00b894);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 212, 170, 0.4);
      transition: all 0.3s ease;
      display: none;
    `;
    btn.onmouseover = function() {
      this.style.transform = 'scale(1.05)';
    };
    btn.onmouseout = function() {
      this.style.transform = 'scale(1)';
    };
    btn.onclick = function() {
      activateSession();
      btn.style.display = 'none';
    };
    
    document.body.appendChild(btn);
    return btn;
  }

  function showSignOffButton() {
    const btn = document.getElementById('kid-solar-signoff') || createSignOffButton();
    btn.style.display = 'block';
  }

  function hideSignOffButton() {
    const btn = document.getElementById('kid-solar-signoff');
    if (btn) btn.style.display = 'none';
  }

  function showActivateButton() {
    const btn = document.getElementById('kid-solar-activate') || createActivateButton();
    btn.style.display = 'block';
  }

  function hideActivateButton() {
    const btn = document.getElementById('kid-solar-activate');
    if (btn) btn.style.display = 'none';
  }

  function init() {
    createSignOffButton();
    createActivateButton();
    
    if (isSessionActive()) {
      console.log('☀️ Kid Solar session restored');
      injectDidAgent();
      showSignOffButton();
      hideActivateButton();
    } else {
      hideSignOffButton();
      showActivateButton();
    }
  }

  window.KidSolarController = {
    activate: activateSession,
    deactivate: deactivateSession,
    isActive: isSessionActive,
    config: KID_SOLAR_CONFIG
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('☀️ Kid Solar Controller loaded');
})();
