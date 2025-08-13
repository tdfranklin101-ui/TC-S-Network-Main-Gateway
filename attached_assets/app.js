(() => {
  const recPct = document.getElementById('recPct');
  const ccPct = document.getElementById('ccPct');
  const usdPct = document.getElementById('usdPct');
  const raysPct = document.getElementById('raysPct');
  const commissionerPresent = document.getElementById('commissionerPresent');
  const noCommModeWrap = document.getElementById('noCommModeWrap');
  const onboardForm = document.getElementById('onboardForm');
  const preview = document.getElementById('preview');
  const saveMockBtn = document.getElementById('saveMock');
  const calcForm = document.getElementById('calcForm');
  const calcPreview = document.getElementById('calcPreview');

  function clampSplits(a, b) {
    let aVal = parseInt(a.value || '0', 10);
    let bVal = parseInt(b.value || '0', 10);
    if (aVal + bVal !== 100) {
      b.value = String(100 - aVal);
    }
  }
  function clampPayouts(a, b) {
    let aVal = parseInt(a.value || '0', 10);
    let bVal = parseInt(b.value || '0', 10);
    if (aVal + bVal !== 100) {
      b.value = String(100 - aVal);
    }
  }

  ['input','change'].forEach(evt => {
    recPct.addEventListener(evt, () => clampSplits(recPct, ccPct));
    ccPct.addEventListener(evt, () => clampSplits(ccPct, recPct));
    usdPct.addEventListener(evt, () => clampPayouts(usdPct, raysPct));
    raysPct.addEventListener(evt, () => clampPayouts(raysPct, usdPct));
  });

  commissionerPresent.addEventListener('change', () => {
    noCommModeWrap.classList.toggle('hidden', commissionerPresent.value !== 'no');
  });

  onboardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(onboardForm).entries());
    const cap = Number(data.capacityKw || 0);
    const estMwh = Number(data.estMwh || 0);
    const ef = Number(data.gridEF || 0);
    const rec = Number(data.recPct || 0)/100;
    const cc = Number(data.ccPct || 0)/100;

    const recMwh = estMwh * rec;
    const ccMwh = estMwh * cc;
    const ccTons = ccMwh * ef;

    const fork = data.commissionerPresent === 'yes' ? 'A' : 'B';
    const noComm = fork === 'B' ? (data.noCommissionerMode || 'KEEP') : '-';
    const usd = Number(data.usdPct || 0);
    const rays = Number(data.raysPct || 0);

    const out = [
      `Facility: ${data.generatorName} • ${data.location} • ${data.tech}`,
      `Capacity: ${cap} kW • Est. Annual Output: ${estMwh.toFixed(2)} MWh`,
      `Grid EF: ${ef.toFixed(3)} tCO₂e/MWh`,
      ``,
      `Split: REC ${Math.round(rec*100)}% / CC ${Math.round(cc*100)}%`,
      `→ REC side: ${recMwh.toFixed(2)} MWh ⇒ ${recMwh.toFixed(2)} RECs (1 REC/MWh)`,
      `→ CC side: ${ccMwh.toFixed(2)} MWh × ${ef.toFixed(3)} = ${ccTons.toFixed(3)} tCO₂e`,
      ``,
      `Fork: ${fork === 'A' ? 'Private Network (Commissioner present)' : 'No Commissioner (Generator-as-Commissioner)'}`,
      `${fork === 'B' ? `No‑Commissioner Mode: ${noComm}` : ''}`,
      `Payout Mix: USD ${usd}% / Solar Rays ${rays}%`,
      ``,
      `Note: Prototype/Mock — not live.`
    ].join('\n');

    preview.textContent = out;
    preview.classList.remove('hidden');
  });

  saveMockBtn.addEventListener('click', () => {
    const data = Object.fromEntries(new FormData(onboardForm).entries());
    const list = JSON.parse(localStorage.getItem('tcs_generators') || '[]');
    data._savedAt = new Date().toISOString();
    list.push(data);
    localStorage.setItem('tcs_generators', JSON.stringify(list));
    alert('Saved (locally) in your browser storage. Prototype only.');
  });

  calcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const base = Number(new FormData(onboardForm).get('recBase') || 0);
    const recPctVal = Number(document.getElementById('recPct').value || 0)/100;
    const data = Object.fromEntries(new FormData(calcForm).entries());
    const mwh = Number(data.periodMwh || 0);
    const recBase = Number(data.recBase || 0);
    const recPrice = Number(data.recPrice || 0);

    const recMwh = mwh * recPctVal;
    const basePaid = recMwh * recBase;
    const saleRevenue = recMwh * recPrice;
    const delta = Math.max(0, saleRevenue - basePaid);

    // Fork split logic demo
    const fork = document.getElementById('commissionerPresent').value === 'yes' ? 'A' : 'B';
    const noComm = document.getElementById('noCommissionerMode').value || 'KEEP';

    let split = '';
    if (fork === 'A') {
      split = `Delta split (A): Commissioner 1/3, Generator 1/3, TC‑S 1/3`;
    } else {
      split = noComm === 'KEEP' ?
        `Delta split (B1): Generator 2/3, TC‑S 1/3` :
        `Delta split (B2): GBI Fund 1/3, Generator 1/3, TC‑S 1/3`;
    }

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
})();