(function() {
  var apps = [
    { name: 'TC-S LifeLens', icon: '🔍', color: '#20B2AA', href: '/lifelens.html', desc: 'AI item identification + Robbins Maslow guidance' },
    { name: 'Satellite ID Anywhere', icon: '🛰️', color: '#00BFFF', href: 'https://replit-node-tdfranklin101.replit.app', desc: 'Track any satellite in orbit', external: true },
    { name: 'Seismic ID Anywhere', icon: '🌍', color: '#FF6B35', href: 'https://seismic-id-anywhere-tdfranklin101.replit.app', desc: 'Real-time global seismic monitoring', external: true },
    { name: 'Flare Now', icon: '☀️', color: '#FFD700', href: 'https://flare-now--tdfranklin101.replit.app', desc: 'Solar flares & space weather alerts', external: true },
    { name: 'Radio Astronomy Now', icon: '📡', color: '#9D4EDD', href: 'https://astro-events-live--tdfranklin101.replit.app', desc: 'Live deep space signals & cosmic events', external: true },
    { name: 'TC-S Network Events', icon: '⚡', color: '#00CED1', href: 'https://farm-ops--tdfranklin101.replit.app', desc: 'AI-powered event operations with IQ agents', external: true },
    { name: 'Commission Network', icon: '🌐', color: '#39ff14', href: '/commission-network.html', desc: 'Solar-backed network commissioning' },
    { name: 'Prompt a Movie', icon: '🎬', color: '#FF6EFF', href: 'https://continuity-locker.replit.app', desc: 'Custom AI films & music videos', external: true },
    { name: 'DMTXACTLY', icon: '🌀', color: '#8B5CF6', href: '/dmtxactly.html', desc: 'Tessellated visuals & generative art' },
    { name: 'Tessellated Envoy', icon: '🧠', color: '#A78BFA', href: 'https://chatgpt.com/g/g-692cfd47e3488191a43f3607e0b5b43a-the-tessellated-envoy', desc: 'AI behind DMTXACTLY prompts', external: true }
  ];

  var style = document.createElement('style');
  style.textContent = '' +
    '.apps-dropdown-wrap { position: relative; display: inline-block; z-index: 9990; }' +
    '.apps-dropdown-btn {' +
    '  background: linear-gradient(135deg, rgba(0,245,212,0.15), rgba(0,245,212,0.05));' +
    '  border: 1px solid rgba(0,245,212,0.4);' +
    '  color: #00f5d4;' +
    '  padding: 8px 16px;' +
    '  border-radius: 8px;' +
    '  font-size: 0.85rem;' +
    '  font-weight: 600;' +
    '  cursor: pointer;' +
    '  display: flex;' +
    '  align-items: center;' +
    '  gap: 6px;' +
    '  letter-spacing: 0.5px;' +
    '  transition: all 0.3s ease;' +
    '  font-family: inherit;' +
    '}' +
    '.apps-dropdown-btn:hover { background: linear-gradient(135deg, rgba(0,245,212,0.25), rgba(0,245,212,0.1)); box-shadow: 0 0 15px rgba(0,245,212,0.3); }' +
    '.apps-dropdown-btn .chevron { transition: transform 0.3s ease; font-size: 0.7rem; }' +
    '.apps-dropdown-wrap.open .chevron { transform: rotate(180deg); }' +
    '.apps-dropdown-panel {' +
    '  display: none;' +
    '  position: absolute;' +
    '  top: calc(100% + 8px);' +
    '  left: 50%;' +
    '  transform: translateX(-50%);' +
    '  width: 320px;' +
    '  max-height: 80vh;' +
    '  overflow-y: auto;' +
    '  background: rgba(10, 10, 15, 0.97);' +
    '  border: 1px solid rgba(0,245,212,0.3);' +
    '  border-radius: 12px;' +
    '  padding: 8px;' +
    '  box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,245,212,0.15);' +
    '  backdrop-filter: blur(20px);' +
    '}' +
    '.apps-dropdown-wrap.open .apps-dropdown-panel { display: block; }' +
    '.apps-dropdown-panel a {' +
    '  display: flex;' +
    '  align-items: center;' +
    '  gap: 12px;' +
    '  padding: 10px 12px;' +
    '  border-radius: 8px;' +
    '  text-decoration: none;' +
    '  transition: background 0.2s ease;' +
    '}' +
    '.apps-dropdown-panel a:hover { background: rgba(255,255,255,0.08); }' +
    '.apps-dropdown-panel .app-icon {' +
    '  font-size: 1.4rem;' +
    '  width: 36px;' +
    '  height: 36px;' +
    '  display: flex;' +
    '  align-items: center;' +
    '  justify-content: center;' +
    '  border-radius: 8px;' +
    '  background: rgba(255,255,255,0.05);' +
    '  flex-shrink: 0;' +
    '}' +
    '.apps-dropdown-panel .app-info { flex: 1; min-width: 0; }' +
    '.apps-dropdown-panel .app-name { font-size: 0.9rem; font-weight: 600; margin: 0; line-height: 1.3; }' +
    '.apps-dropdown-panel .app-desc { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin: 2px 0 0; line-height: 1.3; }' +
    '.apps-dropdown-panel .apps-footer {' +
    '  display: block;' +
    '  text-align: center;' +
    '  padding: 10px;' +
    '  margin-top: 4px;' +
    '  border-top: 1px solid rgba(255,255,255,0.1);' +
    '  color: #00f5d4;' +
    '  font-size: 0.8rem;' +
    '  font-weight: 600;' +
    '  text-decoration: none;' +
    '  border-radius: 0 0 8px 8px;' +
    '}' +
    '.apps-dropdown-panel .apps-footer:hover { background: rgba(0,245,212,0.1); }' +
    '@media (max-width: 480px) {' +
    '  .apps-dropdown-panel { width: 280px; left: 0; transform: translateX(-20%); }' +
    '}';
  document.head.appendChild(style);

  function createDropdown() {
    var wrap = document.createElement('div');
    wrap.className = 'apps-dropdown-wrap';

    var btn = document.createElement('button');
    btn.className = 'apps-dropdown-btn';
    btn.innerHTML = '⚡ Apps <span class="chevron">▼</span>';
    btn.onclick = function(e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
    };
    wrap.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'apps-dropdown-panel';

    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      var link = document.createElement('a');
      link.href = app.href;
      if (app.external) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
      link.innerHTML = '<div class="app-icon" style="border: 1px solid ' + app.color + ';">' + app.icon + '</div>' +
        '<div class="app-info">' +
        '<p class="app-name" style="color: ' + app.color + ';">' + app.name + '</p>' +
        '<p class="app-desc">' + app.desc + '</p>' +
        '</div>';
      panel.appendChild(link);
    }

    var footer = document.createElement('a');
    footer.href = '/homepage-full.html#foundation-apps';
    footer.className = 'apps-footer';
    footer.textContent = 'View All Apps →';
    panel.appendChild(footer);

    wrap.appendChild(panel);

    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
      }
    });

    return wrap;
  }

  var target = document.getElementById('apps-dropdown-target');
  if (target) {
    target.appendChild(createDropdown());
  } else {
    window.createAppsDropdown = createDropdown;
  }
})();
