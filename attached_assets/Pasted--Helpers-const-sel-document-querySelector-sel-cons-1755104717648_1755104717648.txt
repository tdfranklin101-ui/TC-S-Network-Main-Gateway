(() => {
  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const recPct = $('#recPct');
  const ccPct = $('#ccPct');
  const usdPct = $('#usdPct');
  const raysPct = $('#raysPct');
  const commissionerPresent = $('#commissionerPresent');
  const noCommModeWrap = $('#noCommModeWrap');

  const onboardForm = $('#onboardForm');
  const preview = $('#preview');
  const saveMockBtn = $('#saveMock');

  const calcForm = $('#calcForm');
  const calcPreview = $('#calcPreview');

  function clampPair(a,b){
    const av = parseInt(a.value||'0',10);
    b.value = String(Math.max(0, Math.min(100, 100 - av)));
  }

  ['input','change'].forEach(evt => {
    recPct.addEventListener(evt, () => clampPair(recPct, ccPct));
    ccPct.addEventListener(evt, () => clampPair(ccPct, recPct));
    usdPct.addEventListener(evt, () => clampPair(usdPct, raysPct));
    raysPct.addEventListener(evt, () => clampPair(raysPct, usdPct));
  });

  commissionerPresent.addEventListener('change', () => {
    noCommModeWrap.classList.toggle('hidden', commissionerPresent.value !== 'no');
  });

  onboardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(onboardForm).entries());
    const estMwh = Number(data.estMwh||0);
    const ef = Number(data.gridEF||0);
    const rec = Number(data.recPct||0)/100;
    const cc  = Number(data.ccPct||0)/100;

    const recMwh = estMwh * rec;
    const ccMwh  = estMwh * cc;
    const ccTons = ccMwh * ef;

    const fork = data.commissionerPresent === 'yes' ? 'A' : 'B';
    const noComm = fork==='B' ? (data.noCommissionerMode||'KEEP') : '-';

    const out = [
      `Facility: ${data.generatorName} • ${data.location} • ${data.tech}`,
      `Est. Annual Output: ${estMwh.toFixed(2)} MWh`,
      `Grid EF: ${ef.toFixed(3)} tCO₂e/MWh`,
      ``,
      `Split: REC ${Math.round(rec*100)}% / CC ${Math.round(cc*100)}%`,
      `→ REC side: ${recMwh.toFixed(2)} MWh ⇒ ${recMwh.toFixed(2)} RECs`,
      `→ CC side: ${ccMwh.toFixed(2)} MWh × ${ef.toFixed(3)} = ${ccTons.toFixed(3)} tCO₂e`,
      ``,
      `Fork: ${fork==='A'?'Private Network (Commissioner present)':'No Commissioner (Generator-as-Commissioner)'}`,
      `${fork==='B'?`No-Commissioner Mode: ${noComm}`:''}`,
      `Payout Mix: USD ${data.usdPct}% / Solar Rays ${data.raysPct}%`,
      ``,
      `Note: Prototype/Mock — not live.`
    ].join('\n');

    preview.textContent = out;
    preview.classList.remove('hidden');
  });

  saveMockBtn.addEventListener('click', () => {
    const data = Object.fromEntries(new FormData(onboardForm).entries());
    const list = JSON.parse(localStorage.getItem('tcs_generators')||'[]');
    data._savedAt = new Date().toISOString();
    list.push(data);
    localStorage.setItem('tcs_generators', JSON.stringify(list));
    alert('Saved locally (browser storage). Prototype only.');
  });

  // ---------- Calculation demo ----------
  calcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(calcForm).entries());
    const mwh = Number(data.periodMwh||0);
    const recBase = Number(data.recBase||0);
    const recPrice = Number(data.recPrice||0);
    const recPctVal = Number($('#recPct').value||0)/100;

    const recMwh = mwh * recPctVal;
    const basePaid = recMwh * recBase;
    const saleRevenue = recMwh * recPrice;
    const delta = Math.max(0, saleRevenue - basePaid);

    const fork = $('#commissionerPresent').value==='yes' ? 'A':'B';
    const noComm = $('#noCommissionerMode').value || 'KEEP';
    const split = fork==='A'
      ? 'Delta split (A): Commissioner 1/3, Generator 1/3, TC-S 1/3'
      : (noComm==='KEEP'
          ? 'Delta split (B1): Generator 2/3, TC-S 1/3'
          : 'Delta split (B2): GBI Fund 1/3, Generator 1/3, TC-S 1/3');

    const out = [
      `Period MWh: ${mwh.toFixed(2)}`,
      `REC side MWh: ${recMwh.toFixed(2)}`,
      `Base paid: $${basePaid.toFixed(2)}`,
      `Sale revenue: $${saleRevenue.toFixed(2)}`,
      `Delta: $${delta.toFixed(2)}`,
      split,
      ``,
      `Note: Prototype/Mock — not live.`
    ].join('\n');

    calcPreview.textContent = out;
    calcPreview.classList.remove('hidden');
  });

  // ---------- Modal + Signature Pads ----------
  // Basic modal open/close
  function openModal(id){ const el = document.getElementById(id); el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); }
  function closeModal(id){ const el = document.getElementById(id); el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); }

  document.body.addEventListener('click', (e) => {
    const closeId = e.target.getAttribute('data-close');
    if (closeId) closeModal(closeId);
  });

  // Prefill PPA
  $('#openPpa').addEventListener('click', () => {
    $('#ppaGenerator').value = $('#generatorName').value || '';
    $('#ppaLocation').value  = $('#location').value || '';
    $('#ppaTech').value      = $('#tech').value || '';
    $('#ppaRecPct').value    = $('#recPct').value || 55;
    $('#ppaCcPct').value     = $('#ccPct').value || 45;
    $('#ppaBase').value      = '20.00';
    openModal('ppaModal');
  });

  // Prefill REC Purchase Agreement
  $('#openRecPa').addEventListener('click', () => {
    $('#recGenerator').value = $('#generatorName').value || '';
    $('#recRegistry').value  = ($('#location').value || 'WREGIS') + ' / ' + ($('#location').value ? 'REGION' : 'REGION');
    $('#recQty').value       = '550';
    $('#recPriceUnit').value = '28.00';
    $('#recBaseUnit').value  = '20.00';
    openModal('recPaModal');
  });

  // Signature pad logic (no libs)
  function SigPad(canvasId){
    const c = document.getElementById(canvasId);
    const ctx = c.getContext('2d');
    let drawing = false, prev = null;

    function pos(e){
      const r = c.getBoundingClientRect();
      const x = (e.touches? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches? e.touches[0].clientY : e.clientY) - r.top;
      return {x,y};
    }
    function start(e){ drawing = true; prev = pos(e); e.preventDefault(); }
    function move(e){
      if(!drawing) return;
      const p = pos(e);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
      e.preventDefault();
    }
    function end(){ drawing = false; prev = null; }

    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    c.addEventListener('touchstart', start, {passive:false});
    c.addEventListener('touchmove', move, {passive:false});
    c.addEventListener('touchend', end);

    return {
      clear(){ ctx.clearRect(0,0,c.width,c.height); },
      toDataURL(){ return c.toDataURL('image/png'); }
    };
  }

  // instantiate pads
  const pads = {
    ppaSigGen: SigPad('ppaSigGen'),
    ppaSigTcs: SigPad('ppaSigTcs'),
    recSigBuyer: SigPad('recSigBuyer'),
    recSigGen: SigPad('recSigGen'),
    recSigTcs: SigPad('recSigTcs'),
  };

  // clear buttons
  document.body.addEventListener('click', (e) => {
    const targetId = e.target.getAttribute('data-clear');
    if (targetId && pads[targetId]) pads[targetId].clear();
  });

  // Save PPA (mock)
  $('#ppaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const doc = {
      kind: 'PPA',
      generator: $('#ppaGenerator').value,
      location: $('#ppaLocation').value,
      tech: $('#ppaTech').value,
      basePrice: Number($('#ppaBase').value||0),
      recPct: Number($('#ppaRecPct').value||0),
      ccPct: Number($('#ppaCcPct').value||0),
      sigGen: pads.ppaSigGen.toDataURL(),
      sigTcs: pads.ppaSigTcs.toDataURL(),
      createdAt: new Date().toISOString()
    };
    const store = JSON.parse(localStorage.getItem('tcs_docs')||'[]');
    store.push(doc);
    localStorage.setItem('tcs_docs', JSON.stringify(store));
    alert('PPA mock-signed and saved locally.');
    closeModal('ppaModal');
  });

  // Save REC Purchase Agreement (mock)
  $('#recPaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const qty = Number($('#recQty').value||0);
    const unit = Number($('#recPriceUnit').value||0);
    const base = Number($('#recBaseUnit').value||0);
    const delta = Math.max(0,(qty*unit) - (qty*base));

    const doc = {
      kind: 'REC_PURCHASE',
      purchaser: $('#recBuyer').value,
      generator: $('#recGenerator').value,
      registry: $('#recRegistry').value,
      quantity: qty,
      priceUnit: unit,
      baseUnit: base,
      delta: delta,
      sigBuyer: pads.recSigBuyer.toDataURL(),
      sigGen: pads.recSigGen.toDataURL(),
      sigTcs: pads.recSigTcs.toDataURL(),
      createdAt: new Date().toISOString()
    };
    const store = JSON.parse(localStorage.getItem('tcs_docs')||'[]');
    store.push(doc);
    localStorage.setItem('tcs_docs', JSON.stringify(store));
    alert('REC Purchase Agreement mock-signed and saved locally.');
    closeModal('recPaModal');
  });

})();