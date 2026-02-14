// ecosystem-engine.js - Offloaded from ecosystem-test.html
// Data loaded from /data/ecosystem-config.json at runtime

let AGENTS = [];
let CAT_GROUPS = {};
let CATEGORIES = [];
let ITEM_PARTS = {};
let CREATION_ENGINES = {};
let AGENT_SPECIALTIES = {};
let MARKET_DEMAND = [];
let SEARCH_TERMS = [];
let VOUCHER_TEMPLATES = [];
let WEB_SAMPLE_ITEMS = [];
let FLAVOR_MAP = {};
let MANDATORY_BASIC_PURCHASES = 2;
let DAILY_CREATE_LIMIT = 5;
let DAILY_PURCHASE_LIMIT = 5;
let MAX_CONCURRENT_CREATORS = 3;

let state = {agents:[],items:[],searches:0,purchases:0,totalSolar:0,errors:0,successes:0,transactions:[]};

function $(id){return document.getElementById(id)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function randBetween(a,b){return Math.random()*(b-a)+a}
function timeStr(){return new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}

async function refreshAgentBalance(agent) {
  if (!agent.userId) return;
  try {
    var res = await fetch('/api/ecosystem/resolve-agent', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: agent.username})
    });
    var data = await res.json();
    if (data.success) {
      agent.balance = data.balance;
    }
  } catch(e) {}
}

function isAgentRunEnabled(code) {
  var key = 'agentConfig_' + code;
  var saved = localStorage.getItem(key);
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      return parsed.runEnabled !== false;
    } catch(e) {}
  }
  return true;
}

function initAgentCards(){
  const grid=$('agentsGrid');
  grid.innerHTML='';
  AGENTS.forEach(a=>{
    const el=document.createElement('div');
    el.className='agent-card';
    el.id='agent-'+a.code;
    el.innerHTML=`<div class="agent-icon">${a.icon}</div><div class="agent-name">Agent ${a.name}</div><div class="agent-balance">— ☀️</div><div class="agent-records" style="font-size:9px;color:#666;margin-top:2px"></div><div class="agent-status pending">loading...</div>`;
    el.addEventListener('click',()=>window.location.href='/agent-profile.html?code='+a.code);
    grid.appendChild(el);
  });
  loadPersistentAgentStatus();
}

async function loadPersistentAgentStatus(){
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    const res=await fetch('/api/agents/list',{signal:controller.signal});
    clearTimeout(timeout);
    const data=await res.json();
    if(data.success&&data.agents){
      const agentMap={};
      data.agents.forEach(a=>{ agentMap[a.username]=a; });
      AGENTS.forEach(a=>{
        const username='agent_eco_'+a.code;
        const dbAgent=agentMap[username];
        const el=$('agent-'+a.code);
        if(!el)return;
        if(dbAgent){
          el.querySelector('.agent-balance').textContent=dbAgent.balance.toFixed(1)+' ☀️';
          const s=el.querySelector('.agent-status');
          s.textContent='persistent member';
          s.className='agent-status ok';
          el.className='agent-card registered';
          a._dbMemberId=dbAgent.memberId;
          a._dbBalance=dbAgent.balance;
        } else {
          const s=el.querySelector('.agent-status');
          s.textContent='not registered';
          s.className='agent-status pending';
        }
      });
      const totalSolar=data.agents.reduce((s,a)=>s+a.balance,0);
      const feedTarget=$('cloudFeed');
      if(feedTarget){
        feedTarget.innerHTML=`<div class="feed-item"><span class="fi-icon">🤖</span><span class="fi-msg"><b>${data.count} persistent agent members</b> loaded — Total: <span class="solar">${totalSolar.toFixed(1)} ☀️</span></span></div><div class="feed-item"><span class="fi-icon">📊</span><span class="fi-msg">Agents receive daily <span class="solar">+1 Solar</span> alongside human members</span></div>`;
      }
      loadAgentRecordCounts(data.agents);
    } else {
      const feedTarget=$('cloudFeed');
      if(feedTarget) feedTarget.innerHTML='<div style="color:#888;padding:8px;font-size:12px">Agent data unavailable — run agents to populate</div>';
    }
  }catch(e){
    const feedTarget=$('cloudFeed');
    if(feedTarget) feedTarget.innerHTML='<div style="color:#ff4444;padding:8px;font-size:12px">Could not load agent data: '+e.message+'</div>';
  }
}

async function loadAgentRecordCounts(agentList){
  const batchSize=5;
  for(let i=0;i<AGENTS.length;i+=batchSize){
    const batch=AGENTS.slice(i,i+batchSize);
    await Promise.all(batch.map(async(a)=>{
      try{
        const res=await fetch('/api/agents/'+a.code);
        const data=await res.json();
        if(data.success){
          const el=$('agent-'+a.code);
          if(!el)return;
          const recDiv=el.querySelector('.agent-records');
          if(recDiv){
            const created=(data.created||[]).length;
            const purchased=(data.purchased||[]).length;
            recDiv.innerHTML=`<span style="color:var(--cyan)">${created} created</span> · <span style="color:var(--purple)">${purchased} bought</span>`;
          }
        }
      }catch(e){}
    }));
  }
}

async function loadCloudStats(){
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    const res=await fetch('/api/ecosystem-test/runs',{signal:controller.signal});
    clearTimeout(timeout);
    const data=await res.json();
    if(data.success){
      const c=data.cumulative||{};
      $('csRuns').textContent=c.totalRuns||0;
      $('csItems').textContent=c.totalItemsEver||0;
      $('csPurchases').textContent=c.totalPurchasesEver||0;
      $('csSolar').textContent=parseFloat(c.totalSolarEver||0).toFixed(1);
      $('csHealth').textContent=(c.avgHealthScore||'—')+'%';
      $('csVouchers').textContent=c.totalVouchersEver||0;
      if(c.lastRun){
        $('csLastRun').textContent=new Date(c.lastRun).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      }
    } else {
      $('csRuns').textContent='0';
      $('csLastRun').textContent='No runs yet';
    }
  }catch(e){
    console.error('Cloud stats error:',e);
    $('csRuns').textContent='—';
    $('csLastRun').textContent='unavailable';
  }
}

function updateAgentCard(agent,status,balance,cssClass){
  const el=$('agent-'+agent.code);
  if(!el)return;
  el.className='agent-card '+cssClass;
  el.querySelector('.agent-balance').textContent=balance!=null?(parseFloat(balance).toFixed(1)+' ☀️'):'— ☀️';
  const s=el.querySelector('.agent-status');
  s.textContent=status;
  s.className='agent-status '+(cssClass==='registered'?'ok':cssClass==='error'?'fail':cssClass==='exists'?'warn':'pending');
}

function addFeed(icon,msg){
  const feed=$('activityFeed');
  const el=document.createElement('div');
  el.className='feed-item';
  el.innerHTML=`<span class="fi-time">${timeStr()}</span><span class="fi-icon">${icon}</span><span class="fi-msg">${msg}</span>`;
  feed.appendChild(el);
  feed.scrollTop=feed.scrollHeight;
}

function setPhase(num,name,pct){
  $('phaseName').textContent=name;
  $('phaseNum').textContent=num+' / 4';
  $('progressFill').style.width=pct+'%';
}

function updateStats(){
  $('statAgents').textContent=state.agents.length;
  $('statItems').textContent=state.items.length;
  $('statSearches').textContent=state.searches;
  $('statPurchases').textContent=state.purchases;
  $('statSolar').textContent=state.totalSolar.toFixed(1);
  if(state.phase2){
    $('phase2StatsRow').style.display='';
    $('statAiCreated').textContent=state.phase2.aiCreated;
    $('statWebSourced').textContent=state.phase2.webSourced;
    $('statRealFiles').textContent=state.phase2.aiCreated+state.phase2.webSourced;
    $('statDiscoveries').textContent=(state.phase2.discoveries||[]).length;
  }
}

function calcGenesisSolar(){
  const GENESIS=new Date('2025-04-07T00:00:00Z');
  const now=new Date();
  const daysSinceGenesis=Math.floor((now-GENESIS)/(1000*60*60*24));
  return Math.max(daysSinceGenesis,1);
}

function generateBasicNeedsItem(agentName,existingNames){
  const p=ITEM_PARTS['Basic Needs'];
  const a=p.adj[Math.floor(Math.random()*p.adj.length)];
  const n=p.noun[Math.floor(Math.random()*p.noun.length)];
  const s=p.suffix[Math.floor(Math.random()*p.suffix.length)];
  let name=`${a} ${n} — ${s}`;
  let attempt=0;
  while(existingNames.some(t=>t===name)&&attempt<5){
    const a2=p.adj[Math.floor(Math.random()*p.adj.length)];
    name=`${a2} ${n} — ${s}`;
    attempt++;
  }
  const price=parseFloat(randBetween(0.002,0.08).toFixed(4));
  const desc=`${name} — a Basic Needs item created by Agent ${agentName} as a public good. Every member must purchase ${MANDATORY_BASIC_PURCHASES} basic needs items per day. Affordable, essential, community-sustaining.`;
  return {name,desc,price,isBasicNeed:true,category:'Basic Needs'};
}

function generateCreativeItem(agentName,cat,existingNames){
  const parts=ITEM_PARTS[cat];
  if(!parts) return {name:agentName+'\'s Creation',desc:'A unique artifact',price:0.01,isBasicNeed:false,category:cat};
  const a=parts.adj[Math.floor(Math.random()*parts.adj.length)];
  const n=parts.noun[Math.floor(Math.random()*parts.noun.length)];
  const s=parts.suffix[Math.floor(Math.random()*parts.suffix.length)];
  const combos=[[`${a} ${n} ${s}`],[`${a} ${n}`],[`${n} — ${s}`]];
  const pick=combos[Math.floor(Math.random()*combos.length)];
  let name=pick[0];
  const tries=existingNames||[];
  let attempt=0;
  while(tries.some(t=>t===name)&&attempt<5){
    const a2=parts.adj[Math.floor(Math.random()*parts.adj.length)];
    const n2=parts.noun[Math.floor(Math.random()*parts.noun.length)];
    name=`${a2} ${n2} ${s}`;
    attempt++;
  }
  const demandIdx=MARKET_DEMAND.indexOf(cat);
  const demandMultiplier=demandIdx>=0?(1+Math.max(0,(8-demandIdx))*0.08):1;
  const basePrice=parseFloat(randBetween(0.005,0.4).toFixed(4));
  const profitPrice=parseFloat((basePrice*demandMultiplier).toFixed(4));
  const groupName=Object.entries(CAT_GROUPS).find(([g,cats])=>cats.includes(cat))?.[0]||'';
  const flavor=FLAVOR_MAP[cat]||'High demand = profitable.';
  const desc=`${name} — crafted by Agent ${agentName}. ${flavor} [${groupName}]`;
  return {name,desc,price:profitPrice,isBasicNeed:false,category:cat};
}

async function phase1_registration(){
  const genesisBal=calcGenesisSolar();
  setPhase(1,'Phase 1 — Agent Registration',5);
  addFeed('🚀','<b>Phase 1</b> starting: Registering <b>20 AI agents</b>...');
  addFeed('☀️',`<b>Genesis:</b> April 7, 2025 → <span class="solar">${genesisBal} days = ${genesisBal} Solar</span> per member (1 Solar/day since Genesis)`);
  for(let i=0;i<AGENTS.length;i++){
    const a=AGENTS[i];
    if (!isAgentRunEnabled(a.code)) {
      updateAgentCard(a, 'skipped', null, 'exists');
      addFeed('⏭️', '<b>Agent ' + a.name + '</b> <span style="color:#888">skipped (toggled off)</span>');
      const pct=5+((i+1)/AGENTS.length)*20;
      setPhase(1,'Phase 1 — Agent Registration',pct);
      updateStats();
      continue;
    }
    const username='agent_eco_'+a.code;
    try{
      const resolveRes=await fetch('/api/ecosystem/resolve-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});
      const resolveData=await resolveRes.json().catch(()=>({}));
      if(resolveRes.ok&&resolveData.success){
        state.agents.push({...a,username,userId:resolveData.memberId,balance:resolveData.balance,session:null});
        state.totalSolar+=resolveData.balance;
        updateAgentCard(a,'DB synced',resolveData.balance,'registered');
        addFeed('✅',`<b>Agent ${a.name}</b> synced from DB: member #${resolveData.memberId} with <span class="solar">${resolveData.balance.toFixed(1)} Solar</span>`);
        state.successes++;
      } else {
        const email=username+'@tcs-test.network';
        const signupBody={username,email,password:'EcoTest2026!',firstName:'Agent '+a.name};
        const signupRes=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(signupBody),credentials:'include'});
        const signupData=await signupRes.json().catch(()=>({}));
        if(signupRes.ok&&signupData.success!==false){
          const bal=signupData.solarBalance||signupData.solar_balance||genesisBal;
          state.agents.push({...a,username,userId:signupData.userId||signupData.user_id||i+1,balance:parseFloat(bal),session:signupData.sessionId||null});
          state.totalSolar+=parseFloat(bal)||0;
          updateAgentCard(a,'registered',bal,'registered');
          addFeed('✅',`<b>Agent ${a.name}</b> registered with <span class="solar">${parseFloat(bal).toFixed(1)} Solar</span>`);
          state.successes++;
        } else {
          state.agents.push({...a,username,userId:null,balance:genesisBal,session:null});
          state.totalSolar+=genesisBal;
          updateAgentCard(a,'estimated',genesisBal,'exists');
          addFeed('⚠️',`<b>Agent ${a.name}</b> using estimated balance: <span class="solar">${genesisBal} Solar</span> (resolve: ${resolveData.error||'failed'}, signup: ${signupData.error||signupData.message||'failed'})`);
          state.successes++;
        }
      }
    }catch(e){
      state.agents.push({...a,username,userId:null,balance:genesisBal,session:null});
      state.totalSolar+=genesisBal;
      updateAgentCard(a,'offline',genesisBal,'exists');
      addFeed('⚠️',`<b>Agent ${a.name}</b> <span class="err">network error: ${e.message}</span> — using estimated <span class="solar">${genesisBal} Solar</span>`);
      state.errors++;
    }
    const pct=5+((i+1)/AGENTS.length)*20;
    setPhase(1,'Phase 1 — Agent Registration',pct);
    updateStats();
    await sleep(randBetween(200,400));
  }
  addFeed('🏁',`<b>Phase 1 complete:</b> ${state.agents.length} agents processed — each wallet: <span class="solar">${genesisBal} Solar</span> (1/day since Genesis April 7, 2025)`);
}

async function phaseDailyDistribution(){
  setPhase(1,'Daily Solar Distribution — 01:00 UTC',23);
  addFeed('🌅','<b>Daily Distribution</b> — Real DB-backed Solar distribution: <span class="solar">+1 Solar</span> to every member account...');
  const now=new Date();
  const distTime=new Date(now);
  distTime.setUTCHours(1,0,0,0);
  addFeed('🕐',`<b>Distribution time:</b> ${distTime.toUTCString()} — 1 Solar/day per member (DB ledger entries)`);
  await sleep(300);
  let distributed=0,dbDistributed=0,fallbackDistributed=0;
  for(let i=0;i<state.agents.length;i++){
    const agent=state.agents[i];
    const prevBal=agent.balance;
    if(agent.userId){
      try{
        const res=await fetch('/api/ecosystem/distribute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:agent.userId,amount:1})});
        const data=await res.json();
        if(data.success){
          agent.balance=data.newBalance;
          dbDistributed++;
        } else {
          addFeed('⚠️','<b>'+agent.name+'</b> distribution failed: '+(data.error||'unknown'));
          state.errors++;
          fallbackDistributed++;
        }
      }catch(e){
        addFeed('⚠️','<b>'+agent.name+'</b> distribution error: '+e.message);
        state.errors++;
        fallbackDistributed++;
      }
    } else {
      addFeed('⚠️','<b>'+agent.name+'</b> has no userId — cannot distribute');
      state.errors++;
      fallbackDistributed++;
    }
    distributed++;
    state.transactions.push({type:'distribute',agent:agent.code,amount:1,prevBalance:prevBal,newBalance:agent.balance,time:Date.now()});
    updateAgentCard(agent,'+1 ☀️',agent.balance,'registered');
    if(i%5===0||i===state.agents.length-1){
      const src=agent.userId?'DB':'local';
      addFeed('☀️',`<b>Agent ${agent.name}</b> received daily Solar [${src}]: <span class="solar">${prevBal.toFixed(1)} → ${agent.balance.toFixed(1)} ☀️</span> (+1)`);
    }
    await sleep(randBetween(30,80));
  }
  const totalWallets=state.agents.reduce((s,a)=>s+a.balance,0);
  addFeed('🏁',`<b>Daily distribution complete:</b> <span class="ok">${distributed} agents received +1 Solar</span> (${dbDistributed} DB-backed, ${fallbackDistributed} local) | Total network wallets: <span class="solar">${totalWallets.toFixed(1)} ☀️</span>`);
}

async function phase2_items(){
  setPhase(2,'Phase 2 — AI Self-Creation & Marketplace Posting',25);
  addFeed('🚀','<b>Phase 2</b> starting: Agents using <b>AI Self-Creation</b> to produce 5 real artifacts/day (1 Basic Needs public good + specialty items)...');
  addFeed('📏',`<b>Daily rules:</b> 5 artifacts created | 5 purchases (2 mandatory Basic Needs) | positive balance required`);
  addFeed('🏪','<b>16 categories</b> across TC-S Market, Creative & Media, AI-Enhanced, Technical & Other');
  addFeed('🤖','<b>AI Engines:</b> DALL-E 3 (Art/Photo/Culture) | GPT-4o (Writing/Docs/Code) | TTS-1 (Music/Audio) | Web Discovery (Fallback)');
  addFeed('🔄','<b>Priority:</b> AI self-creates first → if impossible, agent searches free web sources → discoveries shared with all agents');
  addFeed('📋', `<b>Queue Protocol:</b> Max ${MAX_CONCURRENT_CREATORS} agents create simultaneously | others wait in queue | trading blocked until ALL agents finish`);

  try { await fetch('/api/ecosystem-test/reset-budget',{method:'POST',credentials:'include'}); } catch(e){}

  $('itemsPanel').style.display='block';
  const grid=$('itemsGrid');
  let posted=0,failed=0,basicNeedsCreated=0;
  let aiCreated=0,webSourced=0,metadataOnly=0;
  const usedNames=[];

  if(!state.phase2) state.phase2={aiCreated:0,webSourced:0,metadataOnly:0,discoveries:[],budgetStatus:null,fileTypes:{}};

  const totalAgents = state.agents.length;
  let completedAgents = 0;

  addFeed('📋', `<b>Agent Queue Protocol:</b> ${MAX_CONCURRENT_CREATORS} agents create at a time | ${totalAgents} agents total | Queue active`);

  for(let batchStart = 0; batchStart < totalAgents; batchStart += MAX_CONCURRENT_CREATORS) {
    const batchEnd = Math.min(batchStart + MAX_CONCURRENT_CREATORS, totalAgents);
    const batchAgents = state.agents.slice(batchStart, batchEnd);
    const queueRemaining = totalAgents - batchEnd;
    
    addFeed('🔄', `<b>Creating batch ${Math.floor(batchStart/MAX_CONCURRENT_CREATORS)+1}:</b> ${batchAgents.map(a=>a.name).join(', ')} | <span style="color:#888">${queueRemaining} agents queued</span>`);

    const batchPromises = batchAgents.map(async (agent, batchIdx) => {
      const i = batchStart + batchIdx;
      if (!isAgentRunEnabled(agent.code)) {
        updateAgentCard(agent, 'skipped', agent.balance, 'exists');
        addFeed('⏭️', '<b>Agent ' + agent.name + '</b> <span style="color:#888">skipped (toggled off)</span>');
        completedAgents++;
        return;
      }
      agent.dailyCreates = 0;
      agent.dailyPurchases = 0;
      agent.basicNeedsPurchases = 0;
      const specialty = AGENT_SPECIALTIES[agent.name] || CATEGORIES[i % CATEGORIES.length];
      
      updateAgentCard(agent, 'creating...', agent.balance, 'registered');

      for(let j = 0; j < DAILY_CREATE_LIMIT; j++) {
        let gen, cat, isBasic = false;
        if(j === 0) {
          gen = generateBasicNeedsItem(agent.name, usedNames);
          cat = 'Basic Needs';
          isBasic = true;
        } else if(j <= 2) {
          cat = specialty;
          gen = generateCreativeItem(agent.name, cat, usedNames);
        } else {
          const otherCats = CATEGORIES.filter(c => c !== 'Basic Needs' && c !== specialty);
          cat = otherCats[Math.floor(Math.random() * otherCats.length)];
          gen = generateCreativeItem(agent.name, cat, usedNames);
        }
        const itemName = gen.name;
        usedNames.push(itemName);
        const price = gen.price;
        const kwhEq = (price * 4913).toFixed(1);
        const item = {name:itemName, category:cat, price, creator:agent.name, creatorCode:agent.code, agentIdx:i, itemId:null, isBasicNeed:isBasic, hasRealFile:false, creationSource:'none', creationMethod:'none', fileUrl:null, fileType:null, previewType:null, threeCopyMastered:false};

        try {
          const res = await fetch('/api/ecosystem-test/create-artifact', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title:itemName, description:gen.desc, category:cat, priceSolar:price, creatorUsername:agent.username, creatorId:agent.userId}),
            credentials: 'include'
          });
          const data = await res.json().catch(() => ({}));
          if(res.ok && data.success) {
            item.itemId = data.itemId;
            item.hasRealFile = data.hasRealFile || false;
            item.creationSource = data.creationSource || 'none';
            item.creationMethod = data.creationMethod || 'none';
            item.fileUrl = data.fileUrl || null;
            item.fileType = data.fileType || null;
            item.previewType = data.previewType || null;
            item.threeCopyMastered = data.threeCopyMastered || false;
            posted++;
            agent.dailyCreates++;
            if(isBasic) basicNeedsCreated++;
            state.successes++;
            if(data.hasRealFile) {
              if(data.creationSource === 'ai-self-creation') { aiCreated++; state.phase2.aiCreated++; }
              else if(data.creationSource === 'web-discovery') { webSourced++; state.phase2.webSourced++; }
              if(data.fileType) state.phase2.fileTypes[data.fileType] = (state.phase2.fileTypes[data.fileType] || 0) + 1;
            } else {
              metadataOnly++; state.phase2.metadataOnly++;
            }
          } else {
            failed++;
            state.errors++;
          }
        } catch(e) { failed++; state.errors++; }
        state.items.push(item);
        if(item.itemId){state.transactions.push({type:'create',agent:agent.code,title:item.name,category:cat,price:item.price,method:item.creationMethod||'unknown',time:Date.now()})}
        
        if(j < DAILY_CREATE_LIMIT - 1) await new Promise(r => setTimeout(r, 800));

        const basicTag = isBasic ? '<span style="color:var(--gold);font-size:8px"> 🏠 PUBLIC GOOD</span>' : '';
        const specTag = cat === specialty && !isBasic ? '<span style="font-size:8px;color:var(--cyan)"> ★ specialty</span>' : '';
        const masteredTag = item.threeCopyMastered ? '<span style="font-size:8px;color:#ff0"> ⚡ 3-COPY</span>' : '';
        const fileTag = item.hasRealFile ? `<span style="font-size:8px;color:var(--green)"> 📁 ${item.creationMethod}</span>` : '';
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.borderColor = isBasic ? 'var(--gold)' : item.threeCopyMastered ? '#ff0' : item.hasRealFile ? 'var(--green)' : item.itemId ? 'var(--cyan)' : 'var(--border)';
        if(isBasic) card.style.background = 'rgba(255,215,0,0.05)';
        if(item.hasRealFile) card.style.background = 'rgba(57,255,20,0.04)';

        let previewHtml = '';
        if(item.hasRealFile && item.fileUrl) {
          if(item.previewType === 'image') previewHtml = `<div style="margin:6px 0"><img src="${item.fileUrl}" alt="${itemName}" style="width:100%;max-height:100px;object-fit:cover;border-radius:4px;border:1px solid var(--border)"></div>`;
          else if(item.previewType === 'audio') previewHtml = `<div style="margin:6px 0"><audio controls style="width:100%;height:28px" preload="none"><source src="${item.fileUrl}" type="audio/mpeg"></audio></div>`;
          else if(item.previewType === 'text' || item.previewType === 'code') previewHtml = `<div style="margin:4px 0;font-size:9px;color:var(--cyan)">📄 ${item.fileType || 'text'} file ready</div>`;
        }

        const sourceIcon = item.creationSource === 'ai-self-creation' ? '🤖' : item.creationSource === 'web-discovery' ? '🌐' : '📦';
        const engLbl = item.creationMethod !== 'none' ? item.creationMethod : (CREATION_ENGINES[cat] ? CREATION_ENGINES[cat].engines[Math.floor(Math.random() * CREATION_ENGINES[cat].engines.length)] : 'Direct');

        card.innerHTML = `<div class="item-cat">${cat}${basicTag}${specTag}${masteredTag}${fileTag}</div><div class="item-name">${itemName}</div>${previewHtml}<div class="item-price">${price.toFixed(4)} ☀️ <span style="font-size:9px;color:#666">(${kwhEq} kWh)</span></div><div class="item-creator">by ${agent.name} ${sourceIcon} <span style="color:var(--cyan)">${engLbl}</span> ${item.itemId ? '<span style="color:var(--green)">✓</span>' : '<span style="color:#ff4444">✗</span>'} [${agent.dailyCreates}/5]</div>`;
        grid.appendChild(card);

        const engine = CREATION_ENGINES[cat];
        const engineIcon = engine ? engine.icon : '📦';
        item.creationEngine = engLbl;
        item.mcpFlow = engine ? engine.flow : 'Create → List';

        if(j === 0) {
          const methodNote = item.hasRealFile ? ` <span style="color:var(--green)">[REAL FILE via ${item.creationMethod}]</span>` : '';
          addFeed('🏠', `<b>${agent.name}</b> created Basic Needs: "<span class="solar">${itemName}</span>" → <span class="solar">${price.toFixed(4)} ☀️</span> <span style="color:var(--gold)">[PUBLIC GOOD]</span>${methodNote}`);
        } else if(j <= 2) {
          if(item.hasRealFile) {
            const srcEmoji = item.creationSource === 'ai-self-creation' ? '🤖' : '🌐';
            addFeed(srcEmoji, `<b>${agent.name}</b> AI-created "<span class="ok">${itemName}</span>" [${cat}] via <span style="color:var(--cyan)">${item.creationMethod}</span> → <span class="solar">${price.toFixed(4)} ☀️</span> <span style="color:var(--green)">📁 real file</span>`);
          } else {
            addFeed(engineIcon, `<b>${agent.name}</b> listed "<span class="ok">${itemName}</span>" [${cat}] → <span class="solar">${price.toFixed(4)} ☀️</span>`);
          }
        }
        updateStats();
      }

      completedAgents++;
      updateAgentCard(agent, 'items ready', agent.balance, 'registered');
      addFeed('✅', `<b>${agent.name}</b> completed daily creation (${agent.dailyCreates}/5 items) | <span style="color:#888">${completedAgents}/${totalAgents} agents done</span>`);
    });

    await Promise.all(batchPromises);
    
    const pct = 25 + (batchEnd / totalAgents) * 25;
    setPhase(2, `Phase 2 — AI Self-Creation (${aiCreated} AI / ${webSourced} web / ${metadataOnly} metadata) [${completedAgents}/${totalAgents} agents]`, pct);
    
    if(batchEnd < totalAgents) {
      addFeed('⏱️', `<b>Queue:</b> Batch complete. Next ${Math.min(MAX_CONCURRENT_CREATORS, totalAgents - batchEnd)} agents deploying...`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  state.basicNeedsCreated=basicNeedsCreated;

  try{
    const statusRes=await fetch('/api/ecosystem-test/creation-status',{credentials:'include'});
    const statusData=await statusRes.json().catch(()=>({}));
    state.phase2.budgetStatus=statusData.budget;
    if(statusData.discoveryLedger){
      state.phase2.discoveries=statusData.discoveryLedger.sources||[];
      if(state.phase2.discoveries.length>0){
        addFeed('📡',`<b>Discovery Ledger:</b> ${state.phase2.discoveries.length} free sources discovered and shared across all agents`);
      }
    }
  }catch(e){}

  const fileTypeList=Object.entries(state.phase2.fileTypes).map(([t,c])=>`${t}:${c}`).join(', ')||'none';
  addFeed('🏁',`<b>Phase 2 complete:</b> <span class="ok">${posted} items posted</span> (${failed} failed) | <span style="color:var(--green)">🤖 ${aiCreated} AI self-created</span> | <span style="color:var(--cyan)">🌐 ${webSourced} web-sourced</span> | <span style="color:#888">📦 ${metadataOnly} metadata-only</span>`);
  addFeed('📊',`<b>Files generated:</b> ${fileTypeList} | <span style="color:var(--gold)">${basicNeedsCreated} Basic Needs public goods</span>`);
}

async function phase3_search(){
  setPhase(3,'Phase 3 — Three-Tier Search Cascade',50);
  addFeed('🚀','<b>Phase 3</b> starting: Agents executing <b>three-tier search cascade</b>...');
  addFeed('📋','<b>Tier 1:</b> TC-S Network member listings (☀️ Solar — <span class="ok">PURCHASABLE</span>)');
  addFeed('📋','<b>Tier 2:</b> AI-curated web sources → <span class="ok">Posted as Solar sample listings</span> (simulated — not buying to place online)');
  addFeed('📋','<b>Tier 3:</b> Open fulfillment request (📢 Bulletin — <span class="err">NO PURCHASE ROUTE</span>)');
  await sleep(400);
  const usedTerms=new Set();
  let tier1Hits=0,tier2Hits=0,tier2SamplePosts=0,tier3Hits=0;
  for(let i=0;i<state.agents.length;i++){
    const agent=state.agents[i];
    const numSearches=Math.floor(randBetween(2,4));
    for(let s=0;s<numSearches;s++){
      let term=SEARCH_TERMS[Math.floor(Math.random()*SEARCH_TERMS.length)];
      let t1Count=0;
      try{
        const res=await fetch('/api/market/search?q='+encodeURIComponent(term));
        const data=await res.json().catch(()=>({}));
        t1Count=data.total||data.count||(data.items?data.items.length:0);
        tier1Hits+=t1Count;
        state.searches++;
        state.successes++;
      }catch(e){state.searches++;state.errors++}
      const t2Found=Math.floor(randBetween(2,6));
      tier2Hits+=t2Found;
      for(let w=0;w<Math.min(t2Found,2);w++){
        const webItem=WEB_SAMPLE_ITEMS[Math.floor(Math.random()*WEB_SAMPLE_ITEMS.length)];
        const solarPrice=(webItem.fiat/491).toFixed(4);
        tier2SamplePosts++;
        state.items.push({name:webItem.name,price:parseFloat(solarPrice),agentIdx:i,tier:'T2_SAMPLE',fiatOrigin:webItem.fiat});
      }
      tier3Hits++;
      if(!usedTerms.has(term)){
        usedTerms.add(term);
        const webSample=WEB_SAMPLE_ITEMS[Math.floor(Math.random()*WEB_SAMPLE_ITEMS.length)];
        const sampleSolar=(webSample.fiat/491).toFixed(4);
        addFeed('🔍',`<b>Agent ${agent.name}</b> searched "<b>${term}</b>" → <span class="ok">T1: ${t1Count} Solar</span> | <span class="ok">T2: ${t2Found} web → sample listed</span> | <span style="color:#888">T3: 1 open slot (🚫)</span>`);
        addFeed('🌐',`<span style="color:var(--purple)">T2 Sample:</span> "<b>${webSample.name}</b>" ($${webSample.fiat} fiat → <span class="solar">${sampleSolar} ☀️ Solar equivalent</span>) — <span class="ok">posted as sample sale</span>`);
      }
      updateStats();
    }
    const pct=50+((i+1)/state.agents.length)*20;
    setPhase(3,'Phase 3 — Three-Tier Search Cascade',pct);
    await sleep(randBetween(100,200));
  }
  state.tier1Hits=tier1Hits;state.tier2Hits=tier2Hits;state.tier2SamplePosts=tier2SamplePosts;state.tier3Hits=tier3Hits;
  addFeed('🏁',`<b>Phase 3 complete:</b> ${state.searches} searches | T1: ${tier1Hits} purchasable | T2: ${tier2Hits} web items → <span class="ok">${tier2SamplePosts} posted as Solar samples</span> | T3: ${tier3Hits} open slots (no route)`);
}

async function phase4_purchases(){
  setPhase(4,'Phase 4 — Tier 1 Solar Purchases Only',70);
  addFeed('🚀','<b>Phase 4</b> starting: Inter-agent <b>Solar purchases</b> (Tier 1 + Tier 2 sample sales)...');
  addFeed('☀️','<span class="ok">Tier 1 (member listings) + Tier 2 (web sample sales) are purchasable with Solar</span>');
  addFeed('🏠',`<span style="color:var(--gold)"><b>MANDATORY:</b> First ${MANDATORY_BASIC_PURCHASES} of 5 daily purchases must be Basic Needs items (public good)</span>`);
  addFeed('📏',`<b>Rules:</b> Max ${DAILY_PURCHASE_LIMIT} purchases/day | ${MANDATORY_BASIC_PURCHASES} Basic Needs required | positive balance | sellers receive Solar`);
  addFeed('🚫','<span style="color:#888">Tier 3 (open fulfillment requests) has NO purchase route — bulletin board only</span>');
  await sleep(300);
  let catalogItems = [];
  try {
    const catalogRes = await fetch('/api/artifacts/available', { credentials: 'include' });
    const catalogData = await catalogRes.json().catch(() => ({}));
    const allArtifacts = catalogData.artifacts || catalogData.items || [];
    catalogItems = allArtifacts
      .filter(a => a.active !== false)
      .map(a => ({
        name: a.title || a.name || 'Untitled',
        price: parseFloat(a.solar_amount_s || a.solarPrice || a.price_solar) || 0.01,
        category: a.category || 'other',
        agentIdx: -1,
        tier: 'T1_CATALOG',
        isBasicNeed: false,
        artifactId: a.id,
        fileType: a.file_type || a.fileType || ''
      }));
    
    const musicVideoCount = catalogItems.filter(it => 
      it.fileType.startsWith('audio/') || it.fileType.startsWith('video/') || 
      it.category.toLowerCase().includes('music') || it.category.toLowerCase().includes('video') ||
      it.category.toLowerCase().includes('audio')
    ).length;
    
    addFeed('🎵', `<b>Marketplace catalog loaded:</b> ${catalogItems.length} total items available | <span style="color:var(--cyan)">${musicVideoCount} songs & videos</span> ready for purchase`);
  } catch (e) {
    addFeed('⚠️', `<b>Catalog fetch warning:</b> ${e.message} — agents will trade from locally tracked items only`);
  }
  $('networkPanel').style.display='block';
  const viz=$('networkViz');
  const vizW=viz.offsetWidth||500;
  const vizH=250;
  const cx=vizW/2,cy=vizH/2,radius=Math.min(cx,cy)-20;
  const nodeEls=[];
  state.agents.forEach((agent,i)=>{
    const angle=(i/state.agents.length)*Math.PI*2 - Math.PI/2;
    const x=cx+Math.cos(angle)*radius;
    const y=cy+Math.sin(angle)*radius;
    const node=document.createElement('div');
    node.className='node';
    node.style.left=(x-8)+'px';
    node.style.top=(y-8)+'px';
    node.textContent=agent.code;
    node.title='Agent '+agent.name;
    viz.appendChild(node);
    nodeEls.push({el:node,x,y});
  });

  let tier3Blocked=0,balanceBlocked=0,limitBlocked=0;
  let t1Purchases=0,t2SamplePurchases=0,basicNeedsPurchased=0,catalogPurchases=0;
  let totalSellerRevenue=0;
  const purchaseEdges=[];
  const t1Items=[...state.items.filter(it=>!it.tier||it.tier!=='T2_SAMPLE'), ...catalogItems];
  const t2Items=state.items.filter(it=>it.tier==='T2_SAMPLE');
  const basicNeedsPool=t1Items.filter(it=>it.isBasicNeed);
  for(let i=0;i<state.agents.length;i++){
    const buyer=state.agents[i];
    if (!isAgentRunEnabled(buyer.code)) {
      updateAgentCard(buyer, 'skipped', buyer.balance, 'exists');
      continue;
    }
    buyer.dailyPurchases=buyer.dailyPurchases||0;
    buyer.basicNeedsPurchases=buyer.basicNeedsPurchases||0;
    const attemptCount=Math.floor(randBetween(5,7));
    for(let b=0;b<attemptCount;b++){
      if(buyer.dailyPurchases>=DAILY_PURCHASE_LIMIT){
        limitBlocked++;
        if(limitBlocked<=4){
          addFeed('📏',`<b>Agent ${buyer.name}</b> hit daily purchase limit (${DAILY_PURCHASE_LIMIT}/day) — <span style="color:var(--orange)">BLOCKED</span> | Balance: <span class="solar">${buyer.balance.toFixed(2)} ☀️</span>`);
        }
        continue;
      }
      if(b===attemptCount-1&&Math.random()<0.3){
        tier3Blocked++;
        if(tier3Blocked<=4){
          addFeed('🚫',`<b>Agent ${buyer.name}</b> attempted Tier 3 fulfillment purchase → <span class="err">BLOCKED — bulletin board only</span>`);
        }
        continue;
      }
      let sellerIdx;
      do{sellerIdx=Math.floor(Math.random()*state.agents.length)}while(sellerIdx===i);
      const seller=state.agents[sellerIdx];
      let item,tierLabel;
      const needsBasic=buyer.basicNeedsPurchases<MANDATORY_BASIC_PURCHASES;
      if(needsBasic){
        const bnPool=basicNeedsPool.filter(it=>it.agentIdx!==i);
        item=bnPool.length>0?bnPool[Math.floor(Math.random()*bnPool.length)]:{name:'Community Solar Water Filter',price:0.01,isBasicNeed:true,category:'Basic Needs'};
        tierLabel='T1 ☀️ 🏠';
        if(buyer.basicNeedsPurchases===0){
          addFeed('🏠',`<span style="color:var(--gold)"><b>${buyer.name}</b> fulfilling mandatory Basic Needs (${buyer.basicNeedsPurchases+1}/${MANDATORY_BASIC_PURCHASES}): "<span class="solar">${item.name}</span>"</span>`);
        }
        sellerIdx=item.agentIdx!==undefined?item.agentIdx:sellerIdx;
      } else if(b<3||t2Items.length===0){
        let itemPool=t1Items.filter(it=>it.agentIdx===sellerIdx&&!it.isBasicNeed);
        if(itemPool.length===0||Math.random()<0.35){
          const catPool=t1Items.filter(it=>it.agentIdx===-1);
          if(catPool.length>0){
            item=catPool[Math.floor(Math.random()*catPool.length)];
            tierLabel='T1 🎵 CATALOG';
          } else {
            item=itemPool.length>0?itemPool[Math.floor(Math.random()*itemPool.length)]:{name:'Solar Widget',price:0.01};
            tierLabel='T1 ☀️';
          }
        } else {
          item=itemPool[Math.floor(Math.random()*itemPool.length)];
          tierLabel='T1 ☀️';
        }
      }else{
        const samplePool=t2Items.filter(it=>it.agentIdx===sellerIdx);
        item=samplePool.length>0?samplePool[Math.floor(Math.random()*samplePool.length)]:{name:'Web Sample Item',price:0.05,fiatOrigin:24.55};
        tierLabel='T2 Sample ☀️';
      }
      const price=item.price||0.01;
      const actualSeller=state.agents[sellerIdx];
      if(buyer.balance-price<0){
        balanceBlocked++;
        if(balanceBlocked<=4){
          addFeed('🔴',`<b>Agent ${buyer.name}</b> cannot afford "${item.name}" (${price.toFixed(4)} ☀️) — <span class="err">INSUFFICIENT BALANCE</span> (${buyer.balance.toFixed(2)} ☀️) — must maintain positive balance`);
        }
        state.errors++;
        continue;
      }
      let dbPurchase=false;
      const artId=item.itemId||item.artifactId||item.id||null;
      if(buyer.userId){
        try{
          let pRes, pData;
          if(artId){
            pRes=await fetch('/api/artifacts/purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              userId:buyer.userId,artifactId:artId
            }),credentials:'include'});
          } else {
            pRes=await fetch('/api/ecosystem/purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              buyerId:buyer.userId,sellerId:actualSeller.userId,amount:price,
              artifactId:null,itemName:item.name
            })});
          }
          pData=await pRes.json();
          if(pRes.ok&&pData.success){
            buyer.balance = artId ? pData.newBalance : pData.buyer.balance;
            if(pData.seller&&pData.seller.balance!==undefined){
              const realSeller=state.agents.find(ag=>ag.userId===pData.seller.id);
              if(realSeller){realSeller.balance=pData.seller.balance;updateAgentCard(realSeller,'sold!',realSeller.balance,'registered')}
              else{actualSeller.balance=pData.seller.balance}
            }
            dbPurchase=true;
            if(artId){state.platformPurchases=(state.platformPurchases||0)+1}
          } else {
            if(pData.error==='Insufficient Solar balance'){
              balanceBlocked++;
              if(balanceBlocked<=4){addFeed('🔴',`<b>Agent ${buyer.name}</b> DB balance insufficient for "${item.name}" — <span class="err">${pData.error}</span>`);}
              state.errors++;continue;
            }
            if(pData.error&&pData.error.includes('already own')){continue}
            if(pData.error&&pData.error.includes('cannot purchase your own')){continue}
            state.errors++;continue;
          }
        }catch(e){
          state.errors++;continue;
        }
      } else {
        state.errors++;continue;
      }
      totalSellerRevenue+=price;
      buyer.dailyPurchases++;
      if(needsBasic||item.isBasicNeed){buyer.basicNeedsPurchases++;basicNeedsPurchased++}
      if(tierLabel.includes('CATALOG')){catalogPurchases++;t1Purchases++}else if(tierLabel.startsWith('T1')){t1Purchases++}else{t2SamplePurchases++}
      state.purchases++;
      state.totalSolar+=price;
      state.successes++;
      if(dbPurchase){state.dbPurchases=(state.dbPurchases||0)+1}
      updateAgentCard(buyer,'buying',buyer.balance,'registered');
      updateAgentCard(actualSeller,'sold!',actualSeller.balance,'registered');

      const bNode=nodeEls[i],sNode=nodeEls[sellerIdx];
      const dx=sNode.x-bNode.x,dy=sNode.y-bNode.y;
      const len=Math.sqrt(dx*dx+dy*dy);
      const angle=Math.atan2(dy,dx)*180/Math.PI;
      const edge=document.createElement('div');
      edge.className='edge';
      edge.style.left=bNode.x+'px';
      edge.style.top=bNode.y+'px';
      edge.style.width=len+'px';
      edge.style.transform='rotate('+angle+'deg)';
      viz.appendChild(edge);
      bNode.el.classList.add('buyer');

      state.transactions.push({type:'purchase',buyer:buyer.code,seller:actualSeller.code,title:item.name,price:price,tier:tierLabel,dbBacked:dbPurchase,time:Date.now()});
      purchaseEdges.push({buyer:buyer.name,seller:actualSeller.name,item:item.name,price,tierLabel,fiatOrigin:item.fiatOrigin,buyerBal:buyer.balance,sellerBal:actualSeller.balance,isBasicNeed:needsBasic||item.isBasicNeed});
      updateStats();
    }
    if(purchaseEdges.length>0&&(i%3===0||i===state.agents.length-1)){
      const last=purchaseEdges[purchaseEdges.length-1];
      const fiatNote=last.fiatOrigin?` <span style="color:#888">(web $${last.fiatOrigin} → Solar)</span>`:'';
      const bnTag=last.isBasicNeed?' <span style="color:var(--gold)">[PUBLIC GOOD]</span>':'';
      addFeed('💸',`<b>${last.buyer}</b> → <b>${last.seller}</b>: "<span class="ok">${last.item}</span>" for <span class="solar">${last.price.toFixed(4)} ☀️</span> [${last.tierLabel}]${bnTag}${fiatNote} | Buyer: ${last.buyerBal.toFixed(2)} ☀️ | Seller: +${last.price.toFixed(4)} ☀️`);
    }
    const pct=70+((i+1)/state.agents.length)*25;
    setPhase(4,'Phase 4 — Solar Economy (T1 + T2 Samples)',pct);
    await sleep(randBetween(80,180));
  }
  state.tier3Blocked=tier3Blocked;
  state.balanceBlocked=balanceBlocked;
  state.limitBlocked=limitBlocked;
  state.t1Purchases=t1Purchases;
  state.t2SamplePurchases=t2SamplePurchases;
  state.totalSellerRevenue=totalSellerRevenue;
  state.basicNeedsPurchased=basicNeedsPurchased;
  const bnCompliance=state.agents.filter(a=>a.basicNeedsPurchases>=MANDATORY_BASIC_PURCHASES).length;
  addFeed('🏠',`<span style="color:var(--gold)"><b>Basic Needs compliance:</b> ${bnCompliance}/${state.agents.length} agents fulfilled ${MANDATORY_BASIC_PURCHASES} mandatory purchases (${basicNeedsPurchased} total)</span>`);
  state.dbPurchases=state.dbPurchases||0;
  state.platformPurchases=state.platformPurchases||0;
  addFeed('🏁',`<b>Phase 4 complete:</b> ${t1Purchases} T1 (${catalogPurchases} catalog 🎵) + ${t2SamplePurchases} T2 = <span class="ok">${state.purchases} transactions</span> | <span style="color:var(--cyan)">${state.dbPurchases} DB-ledgered (${state.platformPurchases} via platform purchaseArtifact)</span> | <span style="color:var(--gold)">${basicNeedsPurchased} Basic Needs</span> | ${balanceBlocked} insufficient | ${limitBlocked} limit | ${tier3Blocked} T3 blocked | Revenue: <span class="solar">${totalSellerRevenue.toFixed(2)} ☀️</span>`);

  addFeed('🔄','<b>Syncing balances from database...</b>');
  for(let i=0;i<state.agents.length;i++){
    await refreshAgentBalance(state.agents[i]);
    updateAgentCard(state.agents[i],'synced',state.agents[i].balance,'registered');
  }
  addFeed('✅','<b>All agent balances synced from DB ledger</b>');
}

function showReport(){
  setPhase(4,'Complete',100);
  const total=state.successes+state.errors;
  const healthPct=total>0?Math.round((state.successes/total)*100):0;
  const scoreEl=$('healthScore');
  scoreEl.textContent=healthPct+'%';
  scoreEl.className='health-score '+(healthPct>=90?'excellent':healthPct>=70?'good':healthPct>=50?'fair':'poor');
  $('healthVerdict').textContent=healthPct>=90?'🌟 Excellent — Network is thriving!':healthPct>=70?'✅ Good — Minor issues detected':healthPct>=50?'⚠️ Fair — Some failures need attention':'🔴 Poor — Significant issues found';
  const detail=$('reportDetail');
  detail.innerHTML='';
  const engineUsage={};
  state.items.forEach(it=>{
    if(it.creationEngine){engineUsage[it.creationEngine]=(engineUsage[it.creationEngine]||0)+1}
  });
  const topEngines=Object.entries(engineUsage).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]+' ('+e[1]+')').join(', ');
  const totalDistributed=state.agents.reduce((s,a)=>s+(a.genesisBalance||0)+1,0);
  const totalEndBalances=state.agents.reduce((s,a)=>s+a.balance,0);
  const items=[
    {l:'Agents Registered',v:state.agents.length+' / 22',section:'Network'},
    {l:'Items Created',v:state.items.length+' / 110',section:'Network'},
    {l:'Basic Needs Created',v:(state.basicNeedsCreated||0)+' 🏠',section:'Basic Needs'},
    {l:'Basic Needs Purchased',v:(state.basicNeedsPurchased||0)+' 🏠',section:'Basic Needs'},
    {l:'BN Purchase Compliance',v:state.agents.filter(a=>a.basicNeedsPurchases>=2).length+'/'+state.agents.length+' agents',section:'Basic Needs'},
    {l:'Top MCP Engines',v:topEngines||'N/A',section:'MCP Engines'},
    {l:'Searches Executed',v:state.searches,section:'Search'},
    {l:'T1 Solar Purchases',v:state.t1Purchases||0,section:'Purchases'},
    {l:'T2 Sample Sales',v:state.t2SamplePurchases||0,section:'Purchases'},
    {l:'DB-Ledgered Transactions',v:(state.dbPurchases||0)+' total ('+(state.platformPurchases||0)+' via platform purchaseArtifact)',section:'Purchases'},
    {l:'Insufficient Balance',v:(state.balanceBlocked||0)+' 🔴',section:'Purchases'},
    {l:'Daily Limit Hit',v:(state.limitBlocked||0)+' 📏',section:'Purchases'},
    {l:'T3 Requests Blocked',v:(state.tier3Blocked||0)+' 🚫',section:'Purchases'},
    {l:'Solar Distributed (Genesis+Daily)',v:totalDistributed.toFixed(2)+' ☀️',section:'Ledger'},
    {l:'Solar Circulated (Purchases)',v:state.totalSolar.toFixed(2)+' ☀️',section:'Ledger'},
    {l:'Seller Revenue',v:(state.totalSellerRevenue||0).toFixed(2)+' ☀️',section:'Ledger'},
    {l:'Total End Balances',v:totalEndBalances.toFixed(2)+' ☀️',section:'Ledger'},
    {l:'T1 Search Hits',v:state.tier1Hits||0,section:'Search'},
    {l:'T2 Web → Samples Posted',v:(state.tier2SamplePosts||0)+' / '+(state.tier2Hits||0)+' found',section:'Search'},
    {l:'T3 Open Slots',v:state.tier3Hits||0,section:'Search'},
    {l:'🤖 AI Self-Created Files',v:(state.phase2?state.phase2.aiCreated:0),section:'Phase 2 AI Creation'},
    {l:'🌐 Web-Sourced Files',v:(state.phase2?state.phase2.webSourced:0),section:'Phase 2 AI Creation'},
    {l:'📁 Total Real Files',v:(state.phase2?(state.phase2.aiCreated+state.phase2.webSourced):0),section:'Phase 2 AI Creation'},
    {l:'📦 Metadata Only',v:(state.phase2?state.phase2.metadataOnly:0),section:'Phase 2 AI Creation'},
    {l:'📡 Discoveries Shared',v:(state.phase2&&state.phase2.discoveries?state.phase2.discoveries.length:0),section:'Phase 2 AI Creation'},
    {l:'File Types',v:(state.phase2&&state.phase2.fileTypes?Object.entries(state.phase2.fileTypes).map(([t,c])=>t.split('/')[1]+':'+c).join(', '):'N/A'),section:'Phase 2 AI Creation'},
    {l:'Vouchers Created',v:(state.vouchersCreated||0)+' 🎟️',section:'Vouchers'},
    {l:'Vouchers Purchased',v:(state.vouchersPurchased||0)+' 💳',section:'Vouchers'},
    {l:'Vouchers Redeemed',v:(state.vouchersRedeemed||0)+' ✅',section:'Vouchers'},
    {l:'Voucher Errors',v:(state.voucherErrors||0),section:'Vouchers'},
    {l:'Successful Ops',v:state.successes,section:'Health'},
    {l:'Failed Ops',v:state.errors,section:'Health'},
    {l:'Health Score',v:healthPct+'%',section:'Health'}
  ];
  let lastSection='';
  items.forEach(it=>{
    if(it.section!==lastSection){
      lastSection=it.section;
      const hdr=document.createElement('div');
      hdr.style.cssText='grid-column:1/-1;padding:6px 0 2px;font-size:11px;color:var(--cyan);border-top:1px solid rgba(0,255,255,0.15);margin-top:4px;font-weight:bold';
      hdr.textContent=it.section.toUpperCase();
      detail.appendChild(hdr);
    }
    const d=document.createElement('div');
    d.className='rd-item';
    d.innerHTML=`<div class="rd-label">${it.l}</div><div class="rd-val">${it.v}</div>`;
    detail.appendChild(d);
  });

  const ledgerEl=document.createElement('div');
  ledgerEl.style.cssText='grid-column:1/-1;margin-top:12px;padding:10px;background:rgba(0,0,0,0.3);border:1px solid var(--gold);border-radius:8px';
  ledgerEl.innerHTML=`<div style="color:var(--gold);font-weight:bold;margin-bottom:8px;font-size:13px">📒 DAILY ACCOUNTING LEDGER</div>
    <table style="width:100%;font-size:10px;border-collapse:collapse;color:var(--text)">
    <thead><tr style="color:var(--cyan);border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:3px">Agent</th><th>Genesis</th><th>+Daily</th><th>Created</th><th>Bought</th><th>BN🏠</th><th>🎟️</th><th>Revenue</th><th>End ☀️</th>
    </tr></thead>
    <tbody>${state.agents.map(a=>{
      const idx=state.agents.indexOf(a);
      const created=state.items.filter(it=>it.agentIdx===idx&&(!it.tier||it.tier!=='T2_SAMPLE')).length;
      const vCreated=(state.vouchers||[]).filter(v=>v.creator===a.name).length;
      const vBought=(state.vouchers||[]).filter(v=>v.buyer===a.name).length;
      const vLabel=vCreated>0?vCreated+'C':(vBought>0?vBought+'B':'—');
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
        <td style="padding:2px 4px;color:var(--green)">${a.code} ${a.name}</td>
        <td style="text-align:center">${(a.genesisBalance||0).toFixed(1)}</td>
        <td style="text-align:center;color:var(--green)">+1.0</td>
        <td style="text-align:center">${a.dailyCreates||0}/5</td>
        <td style="text-align:center">${a.dailyPurchases||0}/5</td>
        <td style="text-align:center;color:var(--gold)">${a.basicNeedsPurchases||0}/2</td>
        <td style="text-align:center;color:var(--gold)">${vLabel}</td>
        <td style="text-align:center;color:var(--cyan)">${(a.balance-(a.genesisBalance||0)-1+state.totalSolar/state.agents.length).toFixed(2)}</td>
        <td style="text-align:center;font-weight:bold">${a.balance.toFixed(2)}</td>
      </tr>`}).join('')}
    </tbody></table>
    <div style="margin-top:8px;font-size:9px;color:#888">Solar Standard: 1 ☀️ = 4,913 kWh ≈ $491 USD (educational only, no fiat exchange)</div>`;
  detail.appendChild(ledgerEl);

  $('reportCard').classList.add('visible');
  addFeed('🌐',`<b>AGENT CONTROL DASHBOARD COMPLETE</b> — Health: <span class="${healthPct>=70?'ok':'err'}">${healthPct}%</span> | MCP Engines active | Basic Needs enforced`);

  try {
    const safeTotalDistributed = Number(totalDistributed) || 0;
    const safeTotalEndBalances = Number(totalEndBalances) || 0;

    const catBreakdown={};
    state.items.forEach(it=>{if(it.category){catBreakdown[it.category]=(catBreakdown[it.category]||0)+1}});
    const agentLedger=state.agents.map((a,idx)=>{
      const created=state.items.filter(it=>it.agentIdx===idx).length;
      const vCreated=(state.vouchers||[]).filter(v=>v.creator===a.name).length;
      const vBought=(state.vouchers||[]).filter(v=>v.buyer===a.name).length;
      return {name:a.name,code:a.code,genesis:Number(a.genesisBalance)||0,created:Number(created)||0,purchases:Number(a.dailyPurchases)||0,
        basicNeeds:Number(a.basicNeedsPurchases)||0,vouchersCreated:Number(vCreated)||0,vouchersBought:Number(vBought)||0,endBalance:Number(a.balance)||0};
    });
    const voucherSummary=(state.vouchers||[]).map(v=>({title:v.title,type:v.type,creator:v.creator,buyer:v.buyer||null,redeemed:v.redeemed||false}));

    fetch('/api/ecosystem-test/save-run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      agentCount:Number(state.agents.length)||AGENTS.length||22,itemsCreated:Number(state.items.length)||0,basicNeedsCreated:Number(state.basicNeedsCreated)||0,
      searchesExecuted:Number(state.searches)||0,t1Purchases:Number(state.t1Purchases)||0,t2SamplePurchases:Number(state.t2SamplePurchases)||0,
      totalPurchases:Number(state.t1Purchases||0)+Number(state.t2SamplePurchases||0),dbLedgeredPurchases:Number(state.dbPurchases)||0,platformPurchases:Number(state.platformPurchases)||0,basicNeedsPurchased:Number(state.basicNeedsPurchased)||0,
      basicNeedsCompliance:Number(state.agents.filter(a=>a.basicNeedsPurchases>=2).length)||0,
      solarDistributed:safeTotalDistributed,solarCirculated:Number(state.totalSolar)||0,sellerRevenue:Number(state.totalSellerRevenue)||0,
      totalEndBalances:safeTotalEndBalances,vouchersCreated:Number(state.vouchersCreated)||0,vouchersPurchased:Number(state.vouchersPurchased)||0,
      vouchersRedeemed:Number(state.vouchersRedeemed)||0,tier1Hits:Number(state.tier1Hits)||0,tier2Hits:Number(state.tier2Hits)||0,
      tier2SamplePosts:Number(state.tier2SamplePosts)||0,tier3Hits:Number(state.tier3Hits)||0,balanceBlocked:Number(state.balanceBlocked)||0,
      limitBlocked:Number(state.limitBlocked)||0,tier3Blocked:Number(state.tier3Blocked)||0,successfulOps:Number(state.successes)||0,failedOps:Number(state.errors)||0,
      healthScore:Number(healthPct)||0,agentLedger,mcpEngineUsage:engineUsage||{},categoryBreakdown:catBreakdown,voucherDetails:voucherSummary,
      phase2:{
        aiCreated:state.phase2?state.phase2.aiCreated:0,
        webSourced:state.phase2?state.phase2.webSourced:0,
        metadataOnly:state.phase2?state.phase2.metadataOnly:0,
        totalRealFiles:state.phase2?(state.phase2.aiCreated+state.phase2.webSourced):0,
        discoveries:state.phase2&&state.phase2.discoveries?state.phase2.discoveries.length:0,
        fileTypes:state.phase2?state.phase2.fileTypes:{},
        budgetStatus:state.phase2?state.phase2.budgetStatus:null
      },
      metadata:{runDate:new Date().toISOString(),version:'2.0-phase2'}
    })}).then(r=>r.json()).then(d=>{
      if(d.success) addFeed('💾',`<b>RUN SAVED</b> — ID: ${d.runId} — <a href="/ecosystem-analysis.html" style="color:var(--cyan)">View Analysis Dashboard →</a>`);
      else addFeed('⚠️','Run save failed: '+(d.error||'unknown'));
    }).catch(e=>addFeed('⚠️','Run save error: '+e.message));
  } catch(saveErr) {
    console.error('Auto-save error:', saveErr);
    addFeed('⚠️','Run auto-save failed (report still valid): '+saveErr.message);
  }
}

async function phase5_vouchers(){
  setPhase(4,'Phase 5 — Voucher Fulfillment',95);
  addFeed('🎟️','<b>Phase 5</b> starting: Agents fulfilling <b>provisions via Voucher Tab</b>...');
  addFeed('📋','<b>Voucher types:</b> Service | Access | Product — primarily Basic Needs provisions');
  addFeed('🔧','<b>Workflow:</b> Create voucher listing → Purchase voucher → Redeem for service/goods');
  let vouchersCreated=0,vouchersPurchased=0,vouchersRedeemed=0,voucherErrors=0;
  state.vouchers=[];

  const voucherCreators=state.agents.filter(a=>{
    const spec=AGENT_SPECIALTIES[a.name];
    return spec==='Basic Needs'||spec==='Energy'||spec==='Utilities'||spec==='Culture'||Math.random()<0.3;
  }).slice(0,10);

  for(let i=0;i<voucherCreators.length;i++){
    const agent=voucherCreators[i];
    const template=VOUCHER_TEMPLATES[i%VOUCHER_TEMPLATES.length];
    const solarPrice=(template.priceRays/1000).toFixed(4);
    try{
      const res=await fetch('/api/vouchers/listings/create',{
        method:'POST',
        headers:{'Content-Type':'application/json','Cookie':`sessionId=${agent.sessionId||''}`},
        body:JSON.stringify({
          title:template.title+' — by '+agent.name,
          description:template.desc,
          voucher_type:template.type,
          price_rays:template.priceRays,
          category:template.cat,
          redemption_location:'TC-S Community Hub',
          redemption_instructions:'Present voucher code at service point. Agent '+agent.name+' will fulfill.',
          quantity_available:5,
          redemption_hours:'09:00-17:00 UTC',
          transferable:true
        }),
        credentials:'include'
      });
      const data=await res.json().catch(()=>({}));
      if(res.ok&&data.success){
        vouchersCreated++;
        state.successes++;
        state.vouchers.push({creator:agent.name,title:template.title,type:template.type,cat:template.cat,priceRays:template.priceRays,solarPrice,listingId:data.listingId||data.id,status:'listed'});
        state.transactions.push({type:'voucher_create',agent:agent.code,title:template.title,price:parseFloat(solarPrice),time:Date.now()});
        addFeed('🎟️',`<b>${agent.name}</b> created voucher: "<span style="color:var(--gold)">${template.title}</span>" [${template.type}/${template.cat}] → <span class="solar">${solarPrice} ☀️</span> (${template.priceRays} Rays)`);
      }else{
        voucherErrors++;
        state.errors++;
        state.vouchers.push({creator:agent.name,title:template.title,type:template.type,cat:template.cat,priceRays:template.priceRays,solarPrice,status:'failed'});
        addFeed('⚠️',`<b>${agent.name}</b> voucher creation failed: "${template.title}" — <span class="err">${data.error||'API error'}</span>`);
      }
    }catch(e){
      voucherErrors++;
      state.errors++;
      state.vouchers.push({creator:agent.name,title:template.title,status:'error'});
    }
    updateStats();
    await sleep(randBetween(60,150));
  }

  const buyers=state.agents.filter(a=>!voucherCreators.includes(a));
  const availableVouchers=state.vouchers.filter(v=>v.status==='listed'&&v.listingId);
  for(let i=0;i<Math.min(buyers.length,availableVouchers.length);i++){
    const buyer=buyers[i];
    const voucher=availableVouchers[i];
    try{
      const res=await fetch('/api/vouchers/purchase',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({listing_id:voucher.listingId,buyer_name:buyer.name,buyer_contact:buyer.username+'@tcs.network'}),
        credentials:'include'
      });
      const data=await res.json().catch(()=>({}));
      if(res.ok&&data.success){
        vouchersPurchased++;
        state.successes++;
        voucher.status='purchased';
        voucher.buyer=buyer.name;
        voucher.voucherCode=data.voucher_code||data.code||'TCS-'+Math.random().toString(36).substr(2,8).toUpperCase();
        state.transactions.push({type:'voucher_purchase',agent:buyer.code,title:voucher.title,price:parseFloat(voucher.solarPrice||0),time:Date.now()});
        addFeed('💳',`<b>${buyer.name}</b> purchased voucher: "<span style="color:var(--gold)">${voucher.title}</span>" from <b>${voucher.creator}</b> → code: <span style="color:var(--green);font-family:monospace">${voucher.voucherCode}</span>`);
      }else{
        voucherErrors++;
        state.errors++;
      }
    }catch(e){voucherErrors++;state.errors++}
    updateStats();
    await sleep(randBetween(40,100));
  }

  const purchasedVouchers=state.vouchers.filter(v=>v.status==='purchased'&&v.voucherCode);
  for(let i=0;i<Math.min(purchasedVouchers.length,5);i++){
    const v=purchasedVouchers[i];
    try{
      const valRes=await fetch('/api/vouchers/redeem/validate',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({voucher_code:v.voucherCode}),
        credentials:'include'
      });
      const valData=await valRes.json().catch(()=>({}));
      if(valRes.ok&&valData.success){
        const redeemRes=await fetch('/api/vouchers/redeem/confirm',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({voucher_code:v.voucherCode}),
          credentials:'include'
        });
        const redeemData=await redeemRes.json().catch(()=>({}));
        if(redeemRes.ok&&redeemData.success){
          vouchersRedeemed++;
          state.successes++;
          v.status='redeemed';
          addFeed('✅',`<b>${v.buyer}</b> redeemed voucher: "<span style="color:var(--gold)">${v.title}</span>" from <b>${v.creator}</b> → <span style="color:var(--green)">SERVICE FULFILLED</span>`);
        }else{voucherErrors++;state.errors++}
      }else{
        voucherErrors++;
        state.errors++;
        addFeed('🎟️',`<b>${v.buyer}</b> voucher validation: "<span style="color:var(--gold)">${v.title}</span>" — <span style="color:#888">${valData.error||'validation pending'}</span>`);
      }
    }catch(e){voucherErrors++;state.errors++}
    updateStats();
    await sleep(randBetween(50,120));
  }

  state.vouchersCreated=vouchersCreated;
  state.vouchersPurchased=vouchersPurchased;
  state.vouchersRedeemed=vouchersRedeemed;
  state.voucherErrors=voucherErrors;
  addFeed('🏁',`<b>Phase 5 complete:</b> <span style="color:var(--gold)">${vouchersCreated} vouchers listed</span> | ${vouchersPurchased} purchased | <span style="color:var(--green)">${vouchersRedeemed} redeemed (fulfilled)</span> | ${voucherErrors} errors`);
}

function openAgentPanel(agentCode){
  const agentDef=AGENTS.find(a=>a.code===agentCode);
  if(!agentDef)return;
  const agentIdx=state.agents.findIndex(a=>a.code===agentCode);
  const agent=agentIdx>=0?state.agents[agentIdx]:null;
  const balance=agent?agent.balance.toFixed(2):'—';
  const statusText=agent?'Active':'Waiting';
  const specialty=AGENT_SPECIALTIES[agentDef.name]||CATEGORIES[0];

  const txs=(state.transactions||[]).filter(t=>t.agent===agentCode||t.buyer===agentCode||t.seller===agentCode);
  const createdItems=state.items.filter(it=>it.agentIdx===agentIdx&&(!it.tier||it.tier!=='T2_SAMPLE'));
  const purchases=txs.filter(t=>t.type==='purchase'&&t.buyer===agentCode);
  const sales=txs.filter(t=>t.type==='purchase'&&t.seller===agentCode);
  const distributions=txs.filter(t=>t.type==='distribute'&&t.agent===agentCode);
  const voucherTxs=txs.filter(t=>(t.type==='voucher_create'||t.type==='voucher_purchase')&&t.agent===agentCode);
  const vouchers=(state.vouchers||[]).filter(v=>v.creator===agentDef.name||v.buyer===agentDef.name);

  function txTime(t){return t?new Date(t).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}
  function renderTxList(arr,emptyMsg){
    if(!arr.length)return `<div class="ap-empty">${emptyMsg}</div>`;
    return arr.map(h=>h).join('');
  }

  let createdHtml=createdItems.map(it=>`<div class="ap-tx"><span class="tx-label">📦 ${it.name}</span><span class="tx-cat">${it.category}</span><span class="tx-amount">+${it.price.toFixed(4)} ☀️</span></div>`).join('');
  let purchasesHtml=purchases.map(t=>{
    const sellerAgent=AGENTS.find(a=>a.code===t.seller);
    return `<div class="ap-tx"><span class="tx-label">🛒 ${t.title}</span><span class="tx-cat">from ${sellerAgent?sellerAgent.name:t.seller}</span><span class="tx-amount">-${t.price.toFixed(4)} ☀️</span><span class="tx-time">${txTime(t.time)}</span></div>`;
  }).join('');
  let salesHtml=sales.map(t=>{
    const buyerAgent=AGENTS.find(a=>a.code===t.buyer);
    return `<div class="ap-tx"><span class="tx-label">💰 ${t.title}</span><span class="tx-cat">to ${buyerAgent?buyerAgent.name:t.buyer}</span><span class="tx-amount">+${t.price.toFixed(4)} ☀️</span><span class="tx-time">${txTime(t.time)}</span></div>`;
  }).join('');
  let distHtml=distributions.map(t=>`<div class="ap-tx"><span class="tx-label">☀️ Daily Solar Distribution</span><span class="tx-cat">${t.prevBalance.toFixed(1)}→${t.newBalance.toFixed(1)}</span><span class="tx-amount">+1 ☀️</span><span class="tx-time">${txTime(t.time)}</span></div>`).join('');
  let voucherHtml=vouchers.map(v=>{
    const isCreator=v.creator===agentDef.name;
    return `<div class="ap-tx"><span class="tx-label">${isCreator?'🎟️ Created':'💳 Purchased'}: ${v.title}</span><span class="tx-cat">${v.type||''}</span><span class="tx-amount">${v.solarPrice||'—'} ☀️</span></div>`;
  }).join('');

  const saved=JSON.parse(localStorage.getItem('agentConfig_'+agentCode)||'null');
  const cfg=saved||{spendingStyle:'balanced',categories:CATEGORIES.slice(),maxSpend:0.5,creationFocus:specialty};

  const catCheckboxes=CATEGORIES.map(c=>{
    const checked=cfg.categories.includes(c)?'checked':'';
    return `<label><input type="checkbox" value="${c}" ${checked} onchange="saveAgentConfig('${agentCode}')">${c}</label>`;
  }).join('');

  const panel=$('agentPanel');
  panel.innerHTML=`
    <div class="ap-header">
      <div class="ap-icon">${agentDef.icon}</div>
      <div class="ap-info">
        <div class="ap-name">Agent ${agentDef.name}</div>
        <div class="ap-bal">${balance} ☀️</div>
        <div class="ap-status">${statusText} · Specialty: ${specialty}</div>
      </div>
      <button class="ap-close" onclick="closeAgentPanel()">✕</button>
    </div>
    <div class="ap-tabs">
      <div class="ap-tab active" onclick="switchApTab(this,0)">Transaction History</div>
      <div class="ap-tab" onclick="switchApTab(this,1)">Programming</div>
    </div>
    <div class="ap-tab-content active" id="apTabHistory">
      <div class="ap-section"><div class="ap-section-title">📦 Items Created (${createdItems.length})</div>${createdHtml||'<div class="ap-empty">No items created yet</div>'}</div>
      <div class="ap-section"><div class="ap-section-title">🛒 Purchases Made (${purchases.length})</div>${purchasesHtml||'<div class="ap-empty">No purchases yet</div>'}</div>
      <div class="ap-section"><div class="ap-section-title">💰 Sales Made (${sales.length})</div>${salesHtml||'<div class="ap-empty">No sales yet</div>'}</div>
      <div class="ap-section"><div class="ap-section-title">☀️ Distributions (${distributions.length})</div>${distHtml||'<div class="ap-empty">No distributions yet</div>'}</div>
      <div class="ap-section"><div class="ap-section-title">🎟️ Vouchers (${vouchers.length})</div>${voucherHtml||'<div class="ap-empty">No voucher activity</div>'}</div>
    </div>
    <div class="ap-tab-content" id="apTabProgramming">
      <div class="ap-ctrl">
        <label>Spending Style</label>
        <div class="ap-radio-group">
          <label><input type="radio" name="apSpend" value="conservative" ${cfg.spendingStyle==='conservative'?'checked':''} onchange="saveAgentConfig('${agentCode}')">Conservative</label>
          <label><input type="radio" name="apSpend" value="balanced" ${cfg.spendingStyle==='balanced'?'checked':''} onchange="saveAgentConfig('${agentCode}')">Balanced</label>
          <label><input type="radio" name="apSpend" value="aggressive" ${cfg.spendingStyle==='aggressive'?'checked':''} onchange="saveAgentConfig('${agentCode}')">Aggressive</label>
        </div>
      </div>
      <div class="ap-ctrl">
        <label>Preferred Categories</label>
        <div class="ap-cat-grid" id="apCatGrid">${catCheckboxes}</div>
      </div>
      <div class="ap-ctrl">
        <label>Max Spend Per Transaction</label>
        <div class="ap-range-wrap">
          <input type="range" id="apMaxSpend" min="0.01" max="1.0" step="0.01" value="${cfg.maxSpend}" oninput="$('apMaxSpendVal').textContent=this.value+' ☀️';saveAgentConfig('${agentCode}')">
          <span class="ap-range-val" id="apMaxSpendVal">${cfg.maxSpend} ☀️</span>
        </div>
      </div>
      <div class="ap-ctrl">
        <label>Creation Focus</label>
        <select class="ap-select" id="apCreationFocus" onchange="saveAgentConfig('${agentCode}')">
          ${CATEGORIES.map(c=>`<option value="${c}" ${cfg.creationFocus===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
  $('agentPanelOverlay').classList.add('open');
}

function closeAgentPanel(){
  $('agentPanelOverlay').classList.remove('open');
}

function switchApTab(el,idx){
  const tabs=el.parentElement.querySelectorAll('.ap-tab');
  const contents=el.parentElement.parentElement.querySelectorAll('.ap-tab-content');
  tabs.forEach((t,i)=>{t.classList.toggle('active',i===idx)});
  contents.forEach((c,i)=>{c.classList.toggle('active',i===idx)});
}

function saveAgentConfig(agentCode){
  const spendEl=document.querySelector('input[name="apSpend"]:checked');
  const catEls=document.querySelectorAll('#apCatGrid input[type=checkbox]:checked');
  const maxSpendEl=$('apMaxSpend');
  const focusEl=$('apCreationFocus');
  const cfg={
    spendingStyle:spendEl?spendEl.value:'balanced',
    categories:Array.from(catEls).map(c=>c.value),
    maxSpend:maxSpendEl?parseFloat(maxSpendEl.value):0.5,
    creationFocus:focusEl?focusEl.value:CATEGORIES[0]
  };
  localStorage.setItem('agentConfig_'+agentCode,JSON.stringify(cfg));
}

async function runEcosystemTest(){
  const btn=$('runBtn');
  btn.disabled=true;
  btn.textContent='⏳ RUNNING TEST...';
  btn.querySelector('.pulse')?.remove();
  state={agents:[],items:[],searches:0,purchases:0,totalSolar:0,errors:0,successes:0,transactions:[]};
  $('dashboard').classList.add('visible');
  $('activityFeed').innerHTML='';
  $('itemsGrid').innerHTML='';
  $('itemsPanel').style.display='none';
  $('networkPanel').style.display='none';
  $('reportCard').classList.remove('visible');
  const vizEl=$('networkViz');
  vizEl.innerHTML='';
  AGENTS.forEach(a => updateAgentCard(a, 'loading...', null, ''));
  updateStats();
  addFeed('🌐','<b>TC-S Network Agent Control Dashboard</b> initialized');
  await sleep(500);
  try{
    await phase1_registration();
    await sleep(600);
    await phaseDailyDistribution();
    await sleep(400);
    await phase2_items();
    addFeed('🚪', '<b style="color:var(--green)">══════ CREATION COMPLETE ══════</b>');
    addFeed('🏪', `<b>Trading Gate OPEN:</b> All ${state.agents.length} agents have completed daily generation. <span style="color:var(--green)">${state.items.length} items now available in /marketplace for everyone.</span>`);
    addFeed('🔔', '<b>All items are now visible and available for purchase by all agents.</b>');
    await sleep(1000);
    await phase3_search();
    await sleep(600);
    await phase4_purchases();
    await sleep(400);
    await phase5_vouchers();
    await sleep(400);
    showReport();
  }catch(e){
    addFeed('💥',`<span class="err">Unexpected error: ${e.message}</span>`);
  }
  btn.textContent='🔄 RUN AGAIN';
  btn.disabled=false;
}

async function initEcosystem() {
  try {
    const res = await fetch('/data/ecosystem-config.json');
    const config = await res.json();
    AGENTS = config.agents;
    CAT_GROUPS = config.catGroups;
    CATEGORIES = Object.values(CAT_GROUPS).flat();
    ITEM_PARTS = config.itemParts;
    CREATION_ENGINES = config.creationEngines;
    AGENT_SPECIALTIES = config.agentSpecialties;
    MARKET_DEMAND = config.marketDemand;
    SEARCH_TERMS = config.searchTerms;
    VOUCHER_TEMPLATES = config.voucherTemplates;
    WEB_SAMPLE_ITEMS = config.webSampleItems;
    FLAVOR_MAP = config.flavorMap;
    MANDATORY_BASIC_PURCHASES = config.mandatoryBasicPurchases;
    DAILY_CREATE_LIMIT = config.dailyCreateLimit;
    DAILY_PURCHASE_LIMIT = config.dailyPurchaseLimit;
    MAX_CONCURRENT_CREATORS = config.maxConcurrentCreators;
    initAgentCards();
    loadCloudStats();
    initCustomRunPanel();
  } catch(e) {
    console.error('Failed to load ecosystem config:', e);
    document.getElementById('activityFeed').innerHTML = '<div style="color:#ff4444;padding:12px">Failed to load ecosystem configuration. Please refresh the page.</div>';
  }
}

function initCustomRunPanel() {
  var sel = document.getElementById('crAgentSelect');
  if (!sel) return;
  sel.innerHTML = '';
  AGENTS.forEach(function(a) {
    var opt = document.createElement('option');
    opt.value = a.code;
    opt.textContent = a.icon + ' ' + a.name + ' (' + a.code + ')';
    sel.appendChild(opt);
  });
  var grid = document.getElementById('crCategoryGrid');
  if (!grid) return;
  grid.innerHTML = '';
  CATEGORIES.forEach(function(cat) {
    var lbl = document.createElement('label');
    lbl.innerHTML = '<input type="checkbox" value="' + cat + '"> ' + cat;
    grid.appendChild(lbl);
  });
}

async function runCustomTask() {
  var btn = document.getElementById('crRunBtn');
  var statusEl = document.getElementById('crStatus');
  var resultsEl = document.getElementById('crResults');
  var agentCode = document.getElementById('crAgentSelect').value;
  var purpose = document.getElementById('crPurpose').value.trim();
  var checked = Array.from(document.querySelectorAll('#crCategoryGrid input[type=checkbox]:checked')).map(function(cb) { return cb.value; });

  if (!agentCode) { statusEl.textContent = '⚠️ Select an agent'; statusEl.style.color = '#ff4444'; return; }
  if (checked.length < 1 || checked.length > 5) { statusEl.textContent = '⚠️ Select 1–5 categories'; statusEl.style.color = '#ff4444'; return; }
  if (!purpose) { statusEl.textContent = '⚠️ Enter a purpose'; statusEl.style.color = '#ff4444'; return; }

  btn.disabled = true;
  btn.textContent = '⏳ Running...';
  statusEl.textContent = 'Executing custom run...';
  statusEl.style.color = 'var(--cyan)';
  resultsEl.style.display = 'none';

  try {
    var res = await fetch('/api/agents/daily-tasks/custom-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentCode: agentCode, categories: checked, purpose: purpose })
    });
    var data = await res.json();
    resultsEl.style.display = 'block';
    if (data.success) {
      statusEl.textContent = '✅ Custom run complete';
      statusEl.style.color = 'var(--green)';
      var html = '<div style="margin-bottom:8px;font-family:Orbitron,sans-serif;color:var(--green);font-size:14px">🎯 Custom Run Results</div>';
      html += '<div style="color:var(--cyan)">Run Type: <b>' + (data.runType || 'custom') + '</b></div>';
      html += '<div style="color:var(--gold)">Purpose: <b>' + (data.purpose || purpose) + '</b></div>';
      html += '<div>Categories: <b>' + (data.customCategories || checked).join(', ') + '</b></div>';
      html += '<div>Items Created: <b style="color:var(--green)">' + (data.totalCreated || 0) + '</b></div>';
      html += '<div>Purchases: <b style="color:var(--purple)">' + (data.totalPurchased || 0) + '</b></div>';
      html += '<div>Health: <b style="color:var(--green)">' + (data.healthPercent || 0) + '%</b></div>';
      if (data.agentResults && data.agentResults.length > 0) {
        var ar = data.agentResults[0];
        if (ar.created && ar.created.length > 0) {
          html += '<div style="margin-top:8px;color:var(--cyan);font-weight:600">Created Items:</div>';
          ar.created.forEach(function(item) {
            html += '<div style="padding:4px 0;border-bottom:1px solid #1a1a1a">📦 <b>' + (item.title || item.name || 'Untitled') + '</b> <span style="color:var(--purple);font-size:10px">' + (item.category || '') + '</span> <span style="color:var(--gold);font-size:10px">' + (item.price || '') + ' ☀️</span></div>';
          });
        }
      }
      html += '<div style="margin-top:8px;font-size:10px;color:#555">Timestamp: ' + (data.timestamp || new Date().toISOString()) + '</div>';
      resultsEl.innerHTML = html;
    } else {
      statusEl.textContent = '❌ Run failed';
      statusEl.style.color = '#ff4444';
      resultsEl.innerHTML = '<div style="color:#ff4444">Error: ' + (data.error || 'Unknown error') + '</div>';
    }
  } catch (e) {
    statusEl.textContent = '❌ Network error';
    statusEl.style.color = '#ff4444';
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="color:#ff4444">Error: ' + e.message + '</div>';
  }

  btn.disabled = false;
  btn.textContent = '🎯 Run Custom';
}

initEcosystem();
