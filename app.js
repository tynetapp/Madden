/* ============ TyNet OS — app.js ============ */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s??"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fm = n => (n<0?"-":"") + "$" + Math.round(Math.abs(n)).toLocaleString();
const fmc = n => (n<0?"-":"") + "$" + Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const fmk = n => Math.abs(n)>=1e6 ? (n<0?"-":"")+"$"+(Math.abs(n)/1e6).toFixed(2)+"M" : fm(n);
function seedRng(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19} return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return ((h^=h>>>16)>>>0)/4294967296} }
function gauss(rng){ let u=0,v=0; while(!u)u=rng(); while(!v)v=rng(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v) }

/* ---- tiny IndexedDB kv ---- */
const idb = {
  db:null,
  open(){ return new Promise((res,rej)=>{ const r=indexedDB.open("tynet",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("kv");
    r.onsuccess=()=>{idb.db=r.result;res()}; r.onerror=()=>rej(r.error); })},
  get(k){ return new Promise((res)=>{ const t=idb.db.transaction("kv").objectStore("kv").get(k); t.onsuccess=()=>res(t.result??null); t.onerror=()=>res(null); })},
  set(k,v){ return new Promise((res)=>{ const t=idb.db.transaction("kv","readwrite").objectStore("kv").put(v,k); t.onsuccess=()=>res(true); t.onerror=()=>res(false); })},
  del(k){ return new Promise((res)=>{ const t=idb.db.transaction("kv","readwrite").objectStore("kv").delete(k); t.onsuccess=()=>res(true); t.onerror=()=>res(false); })}
};

/* ---- global state ---- */
let META = null;   // {careers:[{id,label,team,pos,week}], activeId, settings:{apiKey,model,autogen,wallpaper,pfp}}
let S = null;      // active career state
let saveTimer = null;
function persist(){ clearTimeout(saveTimer); saveTimer=setTimeout(async()=>{ if(S) await idb.set("career/"+S.careerId, S); if(META) await idb.set("meta", META); }, 120); }

function newCareerState(blob){
  const p = blob.player;
  return {
    careerId: blob.careerId, createdAt: Date.now(),
    blob, appliedWeeks: [wkKey(blob.clock)],
    cash: { checking: 1750, savings: 0, tax: 0 },
    autosweep: false, sweepPct: {tax:30, savings:10},
    credit: { score: 620, cardBal: 0, cardLimit: 8000, cardApr: 24.9 },
    debts: [], properties: [], garage: [], boats: [], planes: [],
    invest: {}, // id -> {units, cost}
    investPx: seedPrices(blob.careerId),
    bills: [
      {id:"stay", n:"Extended-stay hotel (Florham Park)", amt:3400, cat:"housing"},
      {id:"phone", n:"Phone", amt:95, cat:"life"},
      {id:"stream", n:"Streaming bundle", amt:47, cat:"life"},
      {id:"food", n:"Food & groceries", amt:1400, cat:"life"},
      {id:"train", n:"Training & recovery", amt:600, cat:"career"}
    ],
    ledger: [ {t:"Camp stipend — Meridian deposit", amt:1750, wk:"PS1", kind:"income"} ],
    deals: [], perception: { draft:"Undrafted", stars:2, hs:"Unranked", college:"Juco, no tape", hometown:"", family:"Paycheck to paycheck", familyAsk:0, debtAmt:0, debtKind:"None", story:"" },
    world: { texts: structuredClone(D.SEED.texts), emails: structuredClone(D.SEED.emails),
             articles: [Object.assign({wk:"Preseason Wk 1"}, structuredClone(D.SEED.article))],
             earlier: structuredClone(D.SEED.earlier),
             chirps: structuredClone(D.SEED.chirps), huddle: structuredClone(D.SEED.huddle),
             podium: structuredClone(D.SEED.podium), clips: [], espnExtra: structuredClone(D.SEED.espnExtra),
             notifs: structuredClone(D.SEED.notifications) },
    votes: {}, reads: {}, cardTx: [], handle: "@"+(p.first+p.last).toLowerCase(),
  };
}
function seedPrices(cid){ const px={}; const rng=seedRng(cid+"px0");
  for(const a of D.INVEST){ px[a.id] = a.kind==="crypto" ? (a.id==="btc"?67000: a.id==="eth"?3400: 0.000021) : (a.kind==="index"?100: a.kind==="bonds"?100: 20+rng()*140); } return px; }

/* ---- economy ---- */
function liquid(){ return S.cash.checking + S.cash.savings; }
function monthlyBurn(){
  let b = S.bills.reduce((a,x)=>a+x.amt,0);
  b += S.debts.reduce((a,d)=>a+(d.pay||0),0);
  b += S.perception.familyAsk||0;
  if (S.credit.cardBal>0) b += Math.max(35, S.credit.cardBal*0.03);
  return b;
}
function runwayWeeks(){ const b=monthlyBurn(); if(b<=0) return 999; return Math.floor(liquid()/(b/4.333)); }
function psWeekly(){ return 6222; }
function activeWeekly(){ const c=S.blob.player.contract; const yr=(c?.salary?.[c.currentYear])??S.blob.player.capSalary; return Math.round(yr/18); }
function grossFor(status){ return status==="PracticeSquad" ? psWeekly() : activeWeekly(); }
function checkLines(status, road, oppState){
  const gross = grossFor(status);
  const lines = [["Gross ("+(status==="PracticeSquad"?"practice squad week":"active week")+")", gross]];
  const fed = -Math.round(gross*0.35); lines.push(["Federal withholding", fed]);
  const st = -Math.round(gross*0.0897); lines.push(["New Jersey state", st]);
  let jock=0; if(road && oppState){ jock = -Math.round(gross*0.35*(oppState.rate)); if(jock) lines.push(["Jock tax — "+oppState.n, jock]); }
  const agent = -Math.round(gross*0.03); lines.push(["Agent fee (3%) — Apex", agent]);
  const dues = -117; lines.push(["NFLPA dues", dues]);
  const net = gross+fed+st+jock+agent+dues;
  return {gross, net, lines};
}
const STATE_TAX = {"Titans":{n:"TN",rate:0},"Packers":{n:"WI",rate:.0765},"Lions":{n:"MI",rate:.0425},"Bears":{n:"IL",rate:.0495},"Patriots":{n:"MA",rate:.05},"Chiefs":{n:"MO",rate:.048},"Chargers":{n:"CA",rate:.133},"Dolphins":{n:"FL",rate:0},"Cardinals":{n:"AZ",rate:.025},"Bills":{n:"NY",rate:.0685},"Steelers":{n:"PA",rate:.0307},"Giants":{n:"NJ",rate:0}};
function tickInvest(rng){
  for (const a of D.INVEST){ const px=S.investPx[a.id]; const move = a.mu + a.sig*gauss(rng); S.investPx[a.id] = Math.max(px*(1+move), a.kind==="crypto"?0.0000001:0.5); }
}
function investValue(){ let v=0; for(const id in S.invest){ const h=S.invest[id]; v+=h.units*S.investPx[id]; } return v; }
function netWorth(){
  let nw = liquid()+S.cash.tax+investValue();
  nw += S.properties.reduce((a,p)=>a+p.value,0) + S.garage.reduce((a,c)=>a+c.value,0) + S.boats.reduce((a,b)=>a+b.value,0) + S.planes.reduce((a,b)=>a+b.value,0);
  nw -= S.debts.reduce((a,d)=>a+d.bal,0) + S.credit.cardBal;
  return nw;
}
function creditTouch(delta){ S.credit.score = Math.max(300, Math.min(850, S.credit.score+delta)); }
/* ---- crisp SVG icon marks ---- */
const SV = (p, extra="") => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const GLYPH = {
  messages: SV('<path d="M21 11.5c0 4.1-4 7.5-9 7.5-1.1 0-2.2-.16-3.2-.46L4 20l1.3-3.1C3.9 15.6 3 13.6 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z" fill="currentColor" stroke="none"/>'),
  meridian: '<span style="font-family:Georgia,serif;font-size:26px;font-weight:700">M</span>',
  huddle: '<span style="font-size:19px;font-weight:800;letter-spacing:-.5px">h/</span>',
  sync: SV('<path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/>'),
  chirper: SV('<path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke-width="2.6"/>'),
  tmail: SV('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>'),
  chron: '<span style="font-family:Georgia,serif;font-size:19px;font-weight:700;letter-spacing:-.5px">UC</span>',
  espn: '<span style="font-style:italic;font-size:12px;letter-spacing:-.3px">ESPN</span>',
  podium: SV('<rect x="9.2" y="3" width="5.6" height="11" rx="2.8"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6"/>'),
  keystone: SV('<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10.5V20h12v-9.5"/><rect x="10" y="14.5" width="4" height="5.5" fill="currentColor" stroke="none"/>'),
  octane: SV('<path d="M4 16.5a8.5 8.5 0 1 1 16 0"/><path d="M12 15.5l4.2-5" stroke-width="2.4"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/>'),
  apex: '<span style="font-size:15px;letter-spacing:.06em;font-weight:800">AX</span>',
  yachts: SV('<circle cx="12" cy="5" r="2.2"/><path d="M12 7.5V19M6 12h12M5 15c.8 3 3.6 5 7 5s6.2-2 7-5l-2.5 1M5 15l2.5 1"/>'),
  planes: SV('<path d="M10.5 13.5L3 11l1.5-1.5L11 10l4.5-4.5c.8-.8 2.2-.8 2.9 0 .8.8.8 2.1 0 2.9L14 13l.5 6.5L13 21l-2.5-7.5z" fill="currentColor" stroke="none"/>'),
  clip: SV('<path d="M8 5.8v12.4c0 .9 1 1.5 1.8 1L19 13c.8-.5.8-1.6 0-2.1L9.8 4.8C9 4.3 8 4.9 8 5.8z" fill="currentColor" stroke="none"/>'),
  contacts: SV('<circle cx="12" cy="8.4" r="3.6" fill="currentColor" stroke="none"/><path d="M4.8 20c.9-3.4 3.8-5.4 7.2-5.4s6.3 2 7.2 5.4" fill="currentColor" stroke="none"/>'),
  card: SV('<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4"/><path d="M3 10h18" stroke-width="2.6"/><path d="M6.5 15h5"/>'),
  settings: SV('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>'),
};
/* ---- OS shell ---- */
const APPS = [
  {id:"chirper", n:"Chirper", ic:"ic-chr"},
  {id:"tmail", n:"T-Mail", ic:"ic-tml"},
  {id:"chron", n:"Chronicle", ic:"ic-chron"},
  {id:"espn", n:"ESPN", ic:"ic-espn"},
  {id:"podium", n:"Podium", ic:"ic-pod"},
  {id:"keystone", n:"Keystone", ic:"ic-key"},
  {id:"octane", n:"Octane", ic:"ic-oct"},
  {id:"apex", n:"Apex", ic:"ic-apx"},
  {id:"yachts", n:"Harborline", ic:"ic-yct"},
  {id:"planes", n:"Stratos", ic:"ic-pln"},
  {id:"clip", n:"ClipHouse", ic:"ic-clip"},
  {id:"contacts", n:"Contacts", ic:"ic-con"},
  {id:"card", n:"Card", ic:"ic-card"},
  {id:"settings", n:"Settings", ic:"ic-set"},
];
const DOCK = [
  {id:"messages", n:"Messages", ic:"ic-msg"},
  {id:"meridian", n:"Meridian", ic:"ic-mer"},
  {id:"huddle", n:"The Huddle", ic:"ic-hud"},
  {id:"sync", n:"Sync", ic:"ic-sync"},
];
let curApp = null, appStack = [];

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("show"), 2600); }
function sheet(html){ $("#sheet").innerHTML=html; $("#dim").classList.remove("hidden"); }
function closeSheet(){ $("#dim").classList.add("hidden"); }
$("#dim") && document.addEventListener("click", e=>{ if(e.target.id==="dim") closeSheet(); });

function clockTick(){
  const d=new Date();
  const t=d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}).replace(/\s?[AP]M/i,"");
  $("#lk-time").textContent=t; $("#sb-time").textContent=t;
  $("#lk-date").textContent=d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"});
}
setInterval(clockTick, 5000);

function unlock(){ $("#lock").classList.add("hidden"); $("#home").classList.remove("hidden"); }
function lock(){ renderLock(); $("#lock").classList.remove("hidden"); $("#home").classList.add("hidden"); closeApp(true); }

function iconEl(a, badge){
  return `<button class="app" onclick="openApp('${a.id}')"><b class="icon ${a.ic}">${GLYPH[a.id]||""}${badge?`<span class="badge">${badge}</span>`:""}</b><span>${a.n}</span></button>`;
}
function renderHome(){
  const unreadM = S.world.texts.filter(t=>!S.reads["t:"+t.id]).length;
  const unreadE = S.world.emails.filter(e=>e.unread && !S.reads["e:"+e.id]).length;
  $("#grid").innerHTML = APPS.map(a=>iconEl(a, a.id==="tmail"&&unreadE?unreadE:null)).join("");
  $("#dock").innerHTML = DOCK.map(a=>iconEl(a, a.id==="messages"&&unreadM?unreadM:null)).join("");
  renderWidget();
}
function renderWidget(){
  const p=S.blob.player;
  $("#wg-title").textContent = p.first+" "+p.last+" · "+p.teamShort;
  $("#wg-week").textContent = wkLabel(S.blob.clock);
  $("#wg-cash").textContent = fm(S.cash.checking);
  const rw = runwayWeeks(); $("#wg-run").textContent = rw>200?"∞":(rw+(rw===1?" wk":" wks"));
  const nx = nextGame();
  $("#wg-next").textContent = nx ? (nx[4]?"vs ":"@ ")+nx[3] : "—";
}
function wkLabel(c){ const t=c.weekType==="PreSeason"?"Pre Wk ":c.weekType==="RegularSeason"?"Week ":c.weekType+" "; return c.seasonYear+" · "+t+(c.week+1); }
function wkKey(c){ return c.seasonYear+"/"+c.weekType+"/"+c.week; }
function nextGame(){
  const c=S.blob.clock;
  const order = t => t==="PreSeason"?0 : t==="RegularSeason"?1 : 2;
  return S.blob.schedule.find(g => !g[7] && (order(g[1])>order(c.weekType) || (g[1]===c.weekType && g[0]>=c.week)));
}
function renderLock(){
  const n = S? S.world.notifs : D.SEED.notifications;
  const icons = {messages:"ic-msg",huddle:"ic-hud",tmail:"ic-tml",meridian:"ic-mer",chirper:"ic-chr",sync:"ic-sync",chron:"ic-chron",espn:"ic-espn"};
  $("#lk-notifs").innerHTML = n.slice(0,4).map(x=>`<button class="lk-card" onclick="unlock();openApp('${x.app}')">
    <span class="ic ${icons[x.app]||'ic-set'}">${GLYPH[x.app]||"•"}</span>
    <span style="min-width:0"><h4>${esc(x.t)}</h4><p>${esc(x.p)}</p></span></button>`).join("");
  $("#lk-careers").innerHTML = META.careers.map(c=>`<button class="career-pick ${c.id===META.activeId?'active':''}" onclick="switchCareer('${c.id}')">
    <span class="l"><h4>${esc(c.label)}</h4><p>${esc(c.sub||"")}</p></span><span class="go">${c.id===META.activeId?"Active":"Open"}</span></button>`).join("");
}
async function switchCareer(id){
  if (META.activeId!==id){ META.activeId=id; S = await idb.get("career/"+id); persist(); }
  unlock(); renderHome();
}
function openApp(id){
  curApp=id; appStack=[];
  const v=$("#appview"); v.classList.remove("hidden");
  requestAnimationFrame(()=>v.classList.add("open"));
  renderApp(id);
  $("#home").classList.add("hidden");
}
function closeApp(silent){
  const v=$("#appview"); v.classList.remove("open"); v.classList.add("hidden");
  curApp=null; if(!silent){ $("#home").classList.remove("hidden"); renderHome(); }
}
$("#hb").addEventListener("click", ()=>{ if(curApp) closeApp(); });
$("#lk-unlock").addEventListener("click", unlock);
$("#hs-widget").addEventListener("click", ()=>openApp("meridian"));

function aphead(title, opts={}){
  return `<div class="aphead">${opts.noback?"":`<button class="back" onclick="${opts.back||"closeApp()"}">‹ ${opts.backlabel||"Home"}</button>`}<h1>${title}</h1>${opts.act?`<button class="hact" onclick="${opts.actFn}">${opts.act}</button>`:""}</div>`;
}
function renderApp(id, sub){
  const b=$("#app-body");
  b.className="";
  const R = RENDER[id]; if(!R){ b.innerHTML=aphead(id)+`<div class="empty">Coming soon.</div>`; return; }
  R(b, sub);
}
/* ---- app renderers ---- */
const RENDER = {};
const avColor = s => { const r=seedRng("av"+s)(); return `hsl(${Math.floor(r*360)},42%,38%)`; };
const initials = s => s.split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();

/* Messages */
RENDER.messages = (b, sub)=>{
  b.className="msgs";
  if (sub && sub.thread!=null){
    const t=S.world.texts.find(x=>x.id===sub.thread);
    S.reads["t:"+t.id]=1; persist();
    b.innerHTML = aphead(esc(t.name), {back:"renderApp('messages')", backlabel:"Messages"}) +
      `<div class="apbody flush"><div class="chat">` + t.msgs.map(m=>{
        const me=m[0]==="me"; let who="", tx=m[1];
        if(t.group && !me && tx.includes("|")){ const i=tx.indexOf("|"); who=tx.slice(0,i); tx=tx.slice(i+1); }
        return `<div class="bub ${me?"me":"them"}">${who?`<span class="who">${esc(who)}</span>`:""}${esc(tx)}</div>`;
      }).join("") + `</div></div>
      <div class="composer"><input id="msgin" placeholder="Text ${esc(t.name.split(" ")[0])}" autocomplete="off"><button onclick="sendText('${t.id}')">Send</button></div>`;
    const body=b.querySelector(".apbody"); body.scrollTop=body.scrollHeight;
  } else {
    b.innerHTML = aphead("Messages") + `<div class="apbody flush">` + S.world.texts.map(t=>{
      const last=t.msgs[t.msgs.length-1]; const unread=!S.reads["t:"+t.id];
      let p=last[1]; if(t.group&&p.includes("|")) p=p.slice(p.indexOf("|")+1);
      return `<button class="thd" style="width:100%" onclick="renderApp('messages',{thread:'${t.id}'})">
        <span class="av" style="background:${t.color||avColor(t.name)}">${initials(t.name)}</span>
        <span class="tx"><h4>${esc(t.name)}${unread?' <span style="color:#2f7cf6">•</span>':''}<time>now</time></h4><p>${esc((last[0]==="me"?"You: ":""))+esc(p)}</p></span></button>`;
    }).join("") + `</div>`;
  }
};
async function sendText(tid){
  const inp=$("#msgin"); const v=inp.value.trim(); if(!v) return;
  const t=S.world.texts.find(x=>x.id===tid);
  t.msgs.push(["me", v]); inp.value=""; persist();
  renderApp("messages",{thread:tid});
  if (META.settings.apiKey){
    const reply = await aiReply(t, v);
    if (reply){ t.msgs.push(["them", reply]); persist(); if(curApp==="messages") renderApp("messages",{thread:tid}); }
  } else { toast("Delivered. Add an API key in Settings for replies."); }
}

/* Chirper */
RENDER.chirper = b=>{
  b.className="chirper";
  b.innerHTML = aphead("Chirper") + `<div class="apbody flush">` + S.world.chirps.map(c=>`
    <div class="chirp"><span class="av" style="background:${c.av||avColor(c.n)}">${initials(c.n)}</span>
    <div class="bx"><h4>${esc(c.n)} ${c.vf?'<span class="vf">✓</span>':''} <span class="hnd">${esc(c.h)} · ${esc(c.tm||"")}</span></h4>
    <p>${esc(c.t)}</p>
    <div class="acts"><span>💬 ${(c.rp/4|0)||3}</span><span>🔁 ${c.rp||0}</span><span>♥ ${c.li||0}</span><span>↗</span></div></div></div>`).join("") + `</div>`;
};

/* T-Mail */
RENDER.tmail = (b, sub)=>{
  b.className="tmail lightapp";
  if (sub && sub.mail){
    const m=S.world.emails.find(x=>x.id===sub.mail); m.unread=false; S.reads["e:"+m.id]=1; persist();
    b.innerHTML = aphead("T-Mail", {back:"renderApp('tmail')", backlabel:"Inbox"}) +
      `<div class="apbody flush"><div class="mailread"><h2>${esc(m.subj)}</h2><div class="mfrom">${esc(m.from)} · ${esc(m.time)}</div>${esc(m.body)}</div></div>`;
  } else {
    b.innerHTML = aphead("T-Mail") + `<div class="apbody flush">` + S.world.emails.map(m=>`
      <div class="mail ${m.unread&&!S.reads["e:"+m.id]?"unread":""}" onclick="renderApp('tmail',{mail:'${m.id}'})">
        <div class="frm"><b>${esc(m.from.split(" — ")[0])}</b><time>${esc(m.time)}</time></div>
        <h4>${esc(m.subj)}</h4><p>${esc(m.body.slice(0,140))}</p></div>`).join("") + `</div>`;
  }
};

/* Chronicle */
RENDER.chron = (b, sub)=>{
  b.className="chron lightapp";
  const idx = sub?.a ?? 0; const A = S.world.articles[idx];
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹</button><span class="masthead">United Chronicle</span></div>
  <div class="dateline">${esc(A.wk||"")} · Sports</div>
  <div class="apbody flush"><div class="art">
    <div class="kick">${esc(A.kick)}</div><h1>${esc(A.head)}</h1>
    <div class="stand">${esc(A.stand)}</div><div class="byline">${esc(A.by)}</div>` +
    A.paras.map((p,i)=> (i===4&&A.pq?`<div class="pq">${esc(A.pq)}</div>`:"") + `<p>${esc(p)}</p>`).join("") +
  `</div><div class="more"><h3>Earlier coverage</h3>` +
    S.world.earlier.map(e=>`<span class="morelink">${esc(e.h)}<small>${esc(e.s)}</small></span>`).join("") +
    (S.world.articles.length>1? `<h3 style="margin-top:14px">Past features</h3>`+S.world.articles.map((a,i)=> i===idx?"":`<button class="morelink" style="width:100%" onclick="renderApp('chron',{a:${i}})">${esc(a.head)}<small>${esc(a.wk||"")}</small></button>`).join(""):"") +
  `</div></div>`;
};

/* ESPN */
const NETMAP = g => { const day=g[5], t=+g[6];
  if (g[1]==="PreSeason") return "NFLN";
  if (day==="Thursday") return "PRIME"; if (day==="Monday") return "ESPN"; if (day==="Saturday") return "NFLN";
  if (day==="Sunday"){ if (t>=1200) return "NBC"; return ["CBS","FOX"][g[0]%2]; } return "CBS"; };
RENDER.espn = b=>{
  b.className="espn";
  const played = S.blob.schedule.filter(g=>g[7]);
  const upcoming = S.blob.schedule.filter(g=>!g[7]).slice(0,3);
  const T=S.blob.player.team;
  const gcard = g=>{ const us=T, them=g[3], home=g[4];
    const sc=g[7]; const w = sc && sc[0]>sc[1];
    const rowA = home? [them, sc?sc[1]:null, !w] : [us, sc?sc[0]:null, w];
    const rowH = home? [us, sc?sc[0]:null, w] : [them, sc?sc[1]:null, !w];
    const status = sc? "FINAL · "+(g[1]==="PreSeason"?"PRE":"")+" WK "+(g[0]+1) : g[5].slice(0,3).toUpperCase()+" · "+(g[1]==="PreSeason"?"PRE ":"")+"WK "+(g[0]+1);
    return `<div class="scorecard"><div class="st"><span>${status}</span><span class="net ${NETMAP(g)}">${NETMAP(g)==="PRIME"?"Prime Video":NETMAP(g)==="PCOCK"?"Peacock":NETMAP(g)}</span></div>
      <div class="tm ${sc?(rowA[2]?"win":"lose"):""}"><span>${esc(rowA[0])}</span><b>${rowA[1]??""}</b></div>
      <div class="tm ${sc?(rowH[2]?"win":"lose"):""}"><span>${esc(rowH[0])}${home?"":" (H)"}</span><b>${rowH[1]??""}</b></div></div>`; };
  const rec = played.filter(g=>g[1]==="RegularSeason").reduce((a,g)=>{g[7][0]>g[7][1]?a[0]++:a[1]++;return a},[0,0]);
  b.innerHTML = aphead("ESPN") + `<div class="apbody">
    <div class="hoodhead" style="color:#fff"><h3>${esc(T)} · Scores</h3><span style="color:#8b939c">${rec[0]}-${rec[1]}</span></div>` +
    played.map(gcard).join("") + upcoming.map(gcard).join("") +
    `<div class="hoodhead" style="color:#fff;margin-top:18px"><h3>AFC East</h3><span style="color:#8b939c">${S.blob.clock.seasonYear}</span></div>
    <table class="stnd"><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th></tr>` +
    ["Bills","Dolphins","Patriots","Jets"].map(t=>{
      const you=t===T; const w=you?rec[0]:0, l=you?rec[1]:0;
      return `<tr class="${you?"you":""}"><td>${t}</td><td>${w}</td><td>${l}</td><td>${(w+l)?(w/(w+l)).toFixed(3).slice(1):".000"}</td></tr>`;}).join("") +
    `</table><p style="font-size:11.5px;color:#5c6570;margin-top:10px">Standings populate as league results sync from the desktop reader.</p></div>`;
};

/* The Huddle */
RENDER.huddle = (b, sub)=>{
  b.className="huddle";
  const vote = (id, v)=>{ S.votes[id]=S.votes[id]===v?0:v; persist(); renderApp("huddle", sub); };
  window._hv = vote;
  const score = (base,id)=> base + (S.votes[id]||0);
  const cmtHtml = (c, path, top)=>{
    const id=path; const sc=score(c.up, id); const mine=S.votes[id]||0;
    return `<div class="cmt ${top?"top":""}"><div class="vote">
      <button class="uv ${mine===1?"on":""}" onclick="_hv('${id}',1)">▲</button>
      <b class="${sc<0?"neg":""}">${sc>999?(sc/1000).toFixed(1)+"k":sc}</b>
      <button class="dv ${mine===-1?"on":""}" onclick="_hv('${id}',-1)">▼</button></div>
      <div class="cx"><div class="u"><b>${esc(c.u)}</b>${c.op?'<span class="op">OP</span>':''}${c.awd?`<span class="awd">${c.awd}</span>`:''}<span>· ${esc(c.tm)}</span></div>
      <p>${esc(c.t)}</p>
      ${(c.r||[]).map((r,i)=>`<div class="sub">${cmtHtml(r, id+"."+i, false)}</div>`).join("")}</div></div>`;
  };
  if (sub && sub.post){
    const P=S.world.huddle.find(h=>h.id===sub.post);
    const psc=score(P.up, P.id);
    b.innerHTML = aphead("h/jetsnation", {back:"renderApp('huddle')", backlabel:"Feed"}) +
    `<div class="apbody flush"><div class="hpost">
      <div class="meta"><span class="flair">${esc(P.flair)}</span><b>u/${esc(P.u)}</b><span>· ${esc(P.tm)}</span></div>
      <h3>${esc(P.h)}</h3><div class="body">${esc(P.b)}</div>
      <div class="stats"><span>▲ ${psc>999?(psc/1000).toFixed(1)+"k":psc}</span><span>💬 ${countCmts(P)}</span><span>Share</span></div></div>
    <div class="hud-sort"><span class="on">Best</span><span>Top</span><span>New</span><span>Controversial</span></div>` +
    P.cmts.map((c,i)=>cmtHtml(c, P.id+":"+i, true)).join("") + `<div style="height:26px"></div></div>`;
  } else {
    b.innerHTML = aphead("The Huddle") +
    `<div class="hud-sub"><span class="subav">h/</span><b>h/jetsnation</b><span>412k members · 8.1k here</span></div>
    <div class="apbody flush hlist">` + S.world.huddle.map(P=>{
      const psc=score(P.up,P.id);
      return `<div class="hpost" onclick="renderApp('huddle',{post:'${P.id}'})">
      <div class="meta"><span class="flair">${esc(P.flair)}</span><b>u/${esc(P.u)}</b><span>· ${esc(P.tm)}</span></div>
      <h3>${esc(P.h)}</h3><div class="body">${esc(P.b)}</div>
      <div class="stats"><span>▲ ${psc>999?(psc/1000).toFixed(1)+"k":psc}</span><span>💬 ${countCmts(P)}</span></div></div>`;}).join("") + `</div>`;
  }
};
function countCmts(P){ let n=0; const walk=cs=>{for(const c of cs){n++; if(c.r) walk(c.r);} }; walk(P.cmts); return n; }
/* Meridian */
let merTab = "overview";
RENDER.meridian = b=>{
  b.className="meridian";
  const rw = runwayWeeks(); const rwCls = rw>16?"ok":rw>8?"warn":"bad";
  const tabs = [["overview","Overview"],["pay","Paycheck"],["bills","Bills"],["loans","Credit & Loans"],["invest","Invest"],["sweep","Auto-Sweep"]];
  b.innerHTML = aphead("Meridian", {act:"Private Client"}) +
  `<div class="mer-hero"><small>Player Checking</small><b>${fmc(S.cash.checking)}</b>
   <div class="sub">Reserve ${fm(S.cash.savings)} · Tax Hold ${fm(S.cash.tax)} · Net worth ${fmk(netWorth())}</div></div>
  <div class="mer-nav">${tabs.map(t=>`<button class="${merTab===t[0]?"on":""}" onclick="merGo('${t[0]}')">${t[1]}</button>`).join("")}</div>
  <div class="apbody" id="merMain"></div>`;
  merBody();
};
function merGo(t){ merTab=t; merBody(); $$(".mer-nav button").forEach((x,i)=>x.classList.toggle("on", ["overview","pay","bills","loans","invest","sweep"][i]===t)); }
function merBody(){
  const m=$("#merMain"); const rw=runwayWeeks(); const rwCls=rw>16?"ok":rw>8?"warn":"bad";
  if (merTab==="overview"){
    m.innerHTML = `<div class="mercard"><h4>Runway <span>burn ${fm(monthlyBurn())}/mo</span></h4>
      <div class="runway"><div class="rw ${rwCls}"><small>Weeks</small><b>${rw>200?"∞":rw}</b></div>
      <div class="rw ok"><small>Liquid</small><b>${fmk(liquid())}</b></div>
      <div class="rw ${S.cash.tax>0?"ok":"warn"}"><small>Tax hold</small><b>${fmk(S.cash.tax)}</b></div></div></div>
    <div class="mercard"><h4>Activity</h4>` + S.ledger.slice(-8).reverse().map(l=>`<div class="payline ${l.amt<0?"neg":""}"><span>${esc(l.t)}</span><span>${fm(l.amt)}</span></div>`).join("") + `</div>
    <div class="mercard"><h4>Transfer</h4>
      <div style="display:flex;gap:8px"><select id="tFrom" class="field" style="margin:0"><option value="checking">Checking</option><option value="savings">Reserve</option><option value="tax">Tax Hold</option></select>
      <select id="tTo" class="field" style="margin:0"><option value="savings">Reserve</option><option value="checking">Checking</option><option value="tax">Tax Hold</option></select></div>
      <input id="tAmt" class="field" type="number" placeholder="Amount" style="margin-top:8px">
      <button class="btn" style="background:var(--mer-acc);color:#04170d" onclick="doTransfer()">Move money</button></div>`;
  }
  if (merTab==="pay"){
    const nx = nextGame(); const road = nx && !nx[4]; const st = road? STATE_TAX[nx[3]] : null;
    const ck = checkLines(S.blob.player.status, road, st);
    const isPre = S.blob.clock.weekType==="PreSeason";
    m.innerHTML = `<div class="mercard"><h4>${isPre?"Next season-week check (preview)":"Next check"} <span>${S.blob.player.status==="PracticeSquad"?"practice squad rate":"active roster rate"}</span></h4>` +
      ck.lines.map(l=>`<div class="payline ${l[1]<0?"neg":""}"><span>${esc(l[0])}</span><span>${fm(l[1])}</span></div>`).join("") +
      `<div class="payline tot"><span>Net deposit</span><span>${fm(ck.net)}</span></div></div>
      <div class="mercard"><h4>How you're paid</h4>
      <div style="font-size:13px;line-height:1.55;color:var(--dim)">Practice squad pays ${fm(psWeekly())} per week the roster exists — 18 weeks, ${fm(psWeekly()*18)} for the season. Game-day elevation pays the active weekly rate (${fm(activeWeekly())}) for that week. Signing to the 53 switches every remaining week to the active rate. ${isPre?"Preseason pays a camp stipend of $1,750 per week; real checks start Week 1.":""}</div></div>
      <div class="mercard"><h4>Deposits</h4>` + S.ledger.filter(l=>l.kind==="income").slice(-10).reverse().map(l=>`<div class="payline"><span>${esc(l.t)}</span><span>${fm(l.amt)}</span></div>`).join("") + `</div>`;
  }
  if (merTab==="bills"){
    m.innerHTML = `<div class="mercard"><h4>Monthly bills <span>autopay from checking</span></h4>` +
      S.bills.map(x=>`<div class="payline"><span>${esc(x.n)}</span><span>${fm(x.amt)}</span></div>`).join("") +
      (S.perception.familyAsk? `<div class="payline"><span>Family support (set in Settings)</span><span>${fm(S.perception.familyAsk)}</span></div>`:"") +
      S.debts.map(d=>`<div class="payline"><span>${esc(d.n)} — payment</span><span>${fm(d.pay)}</span></div>`).join("") +
      (S.credit.cardBal>0?`<div class="payline"><span>Card minimum</span><span>${fm(Math.max(35,S.credit.cardBal*0.03))}</span></div>`:"") +
      `<div class="payline tot"><span>Total burn</span><span>${fm(monthlyBurn())}/mo</span></div></div>
      <div class="mercard"><h4>Housing note</h4><div style="font-size:13px;color:var(--dim);line-height:1.5">The extended-stay bill disappears the week you close on a place in Keystone. Sometimes a mortgage is cheaper than a hotel. Sometimes.</div></div>`;
  }
  if (merTab==="loans"){
    m.innerHTML = `<div class="mercard"><h4>Credit score <span>Meridian model</span></h4>
      <b style="font-size:34px" class="mono">${S.credit.score}</b>
      <div style="font-size:12.5px;color:var(--dim);margin-top:4px">${S.credit.score>=740?"Excellent — best rates unlock.":S.credit.score>=700?"Good — prime offers available.":S.credit.score>=640?"Fair — standard rates.":"Building — expect painful APRs."}</div></div>` +
      D.LOANS.map(L=>{
        const ok = S.credit.score>=L.minScore;
        return `<div class="mercard"><h4>${esc(L.n)} <span>${L.apr.toFixed(1)}% APR · ${L.term} mo</span></h4>
        <div style="font-size:13px;color:var(--dim);margin-bottom:8px">Up to ${fm(L.max)}. ${L.trap? esc(L.note):""} ${!ok?"Requires score "+L.minScore+".":""}</div>
        ${ok?`<div style="display:flex;gap:8px"><input class="field" style="margin:0" type="number" id="ln-${L.id}" placeholder="Amount"><button class="btn sm" style="background:${L.trap?"var(--bad)":"var(--mer-acc)"};color:#04170d;white-space:nowrap" onclick="takeLoan('${L.id}')">Take loan</button></div>`:""}</div>`;
      }).join("") +
      (S.debts.length?`<div class="mercard"><h4>Your debts</h4>`+S.debts.map((d,i)=>`<div class="payline"><span>${esc(d.n)} · ${d.apr}%</span><span>${fm(d.bal)}</span></div>`).join("")+`</div>`:"");
  }
  if (merTab==="invest"){
    const total=investValue();
    m.innerHTML = `<div class="mercard"><h4>Portfolio <span>${fm(total)}</span></h4>` +
      (Object.keys(S.invest).length? Object.keys(S.invest).map(id=>{
        const a=D.INVEST.find(x=>x.id===id); const h=S.invest[id]; const v=h.units*S.investPx[id]; const pl=v-h.cost;
        return `<div class="invrow"><div class="l"><b>${esc(a.n)}</b><small>${esc(a.kind)}</small></div>
        <div class="r"><b>${fm(v)}</b><small class="${pl>=0?"up":"dn"}">${pl>=0?"+":""}${fm(pl)}</small></div></div>`;}).join("") : `<div style="font-size:13px;color:var(--dim)">Nothing invested yet. Money sleeping in checking loses to inflation; money in the wrong coin loses to gravity.</div>`) + `</div>
    <div class="mercard"><h4>Markets <span>move weekly at sync</span></h4>` +
      D.INVEST.map(a=>`<div class="invrow"><div class="l"><b>${esc(a.n)}</b><small>${esc(a.d)}</small></div>
        <div class="r"><b class="mono">${a.kind==="crypto"&&S.investPx[a.id]<1? "$"+S.investPx[a.id].toFixed(7): fm(S.investPx[a.id])}</b>
        <button class="btn sm" style="background:rgba(47,208,140,.2);color:var(--mer-acc);margin-top:3px" onclick="buySheet('${a.id}')">Trade</button></div></div>`).join("") + `</div>`;
  }
  if (merTab==="sweep"){
    m.innerHTML = `<div class="mercard"><h4>Auto-Sweep <span>${S.autosweep?"ON":"OFF"}</span></h4>
      <div style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:10px">Every deposit splits before you can touch it: ${S.sweepPct.tax}% to Tax Hold, ${S.sweepPct.savings}% to Reserve. The players who end year one right turned this on in August.</div>
      <button class="btn" style="background:${S.autosweep?"rgba(255,255,255,.12)":"var(--mer-acc)"};color:${S.autosweep?"var(--ink)":"#04170d"}" onclick="S.autosweep=!S.autosweep;persist();merBody()">${S.autosweep?"Turn off":"Turn on Auto-Sweep"}</button></div>`;
  }
}
function doTransfer(){
  const f=$("#tFrom").value, t=$("#tTo").value, a=+$("#tAmt").value;
  if(!a||a<=0||f===t) return toast("Pick a real amount.");
  if(S.cash[f]<a) return toast("Insufficient funds in that account.");
  S.cash[f]-=a; S.cash[t]+=a; S.ledger.push({t:`Transfer ${f} → ${t}`, amt:0, kind:"move"});
  persist(); merBody(); renderWidget(); toast("Moved "+fm(a));
}
function takeLoan(id){
  const L=D.LOANS.find(x=>x.id===id); const amt=+$("#ln-"+id).value;
  if(!amt||amt<1000) return toast("Minimum $1,000.");
  if(amt>L.max) return toast("Max "+fm(L.max)+" on this product.");
  const r=L.apr/100/12, n=L.term, pay=Math.round(amt*r/(1-Math.pow(1+r,-n)));
  S.debts.push({n:L.n, bal:amt, apr:L.apr, pay, kind:"personal"});
  S.cash.checking+=amt; S.ledger.push({t:L.n+" funded", amt:amt, kind:"income"});
  creditTouch(L.trap?-25:-8); persist(); merBody(); renderWidget();
  toast(L.trap? "Advance funded. That APR is real." : "Loan funded.");
}
function buySheet(id){
  const a=D.INVEST.find(x=>x.id===id); const px=S.investPx[id]; const held=S.invest[id];
  sheet(`<h3>${esc(a.n)}</h3><p class="sp">${esc(a.d)} · Price ${a.kind==="crypto"&&px<1?"$"+px.toFixed(7):fm(px)}${a.buyin?` · Buy-in ${fm(a.buyin)}`:""}${held?` · You hold ${fm(held.units*px)}`:""}</p>
  ${a.buyin? `<button class="btn" style="background:var(--mer-acc);color:#04170d" onclick="doInvest('${id}',${a.buyin})">Buy in — ${fm(a.buyin)}</button>` :
  `<input class="field" type="number" id="invAmt" placeholder="Dollar amount">
   <button class="btn" style="background:var(--mer-acc);color:#04170d" onclick="doInvest('${id}')">Buy</button>`}
  ${held? `<button class="btn" style="background:rgba(244,100,92,.2);color:#ff9d94" onclick="sellInvest('${id}')">Sell all — ${fm(held.units*px)}</button>`:""}
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function doInvest(id, fixed){
  const amt = fixed || +$("#invAmt").value;
  if(!amt||amt<=0) return toast("Enter an amount.");
  if(S.cash.checking<amt) return toast("Not enough in checking.");
  const px=S.investPx[id];
  S.cash.checking-=amt;
  S.invest[id]=S.invest[id]||{units:0,cost:0};
  S.invest[id].units+=amt/px; S.invest[id].cost+=amt;
  S.ledger.push({t:"Invested — "+D.INVEST.find(x=>x.id===id).n, amt:-amt, kind:"spend"});
  persist(); closeSheet(); merBody(); renderWidget(); toast("Position opened.");
}
function sellInvest(id){
  const h=S.invest[id]; const v=h.units*S.investPx[id];
  S.cash.checking+=v; delete S.invest[id];
  S.ledger.push({t:"Sold — "+D.INVEST.find(x=>x.id===id).n, amt:v, kind:"income"});
  persist(); closeSheet(); merBody(); renderWidget(); toast("Sold for "+fm(v));
}
/* ---- catalogs: procedural generators ---- */
function houseArt(seedStr, tier){
  const r=seedRng("h"+seedStr);
  const hues=[[210,18],[28,26],[16,30],[200,10],[95,12]]; const h=hues[Math.floor(r()*hues.length)];
  const sky=`hsl(${h[0]},${h[1]+22}%,${72+r()*10|0}%)`; const wall=`hsl(${26+r()*20|0},${18+r()*14|0}%,${tier>1.2?30+r()*12|0:52+r()*16|0}%)`;
  const roof=`hsl(${h[0]},${h[1]}%,${20+r()*10|0}%)`;
  return `<div class="art-house" style="background:linear-gradient(${sky},hsl(${h[0]},${h[1]}%,84%) 62%,#3e5a37 62.5%)">
   <div style="position:absolute;left:14%;right:14%;bottom:20%;top:44%;background:${wall};border-radius:3px"></div>
   <div style="position:absolute;left:9%;right:9%;top:26%;height:20%;background:${roof};clip-path:polygon(0 100%,50% 0,100% 100%)"></div>
   <div style="position:absolute;left:44%;width:12%;bottom:20%;height:16%;background:#2c2620"></div>
   ${[22,66].map(x=>`<div style="position:absolute;left:${x}%;width:11%;top:52%;height:12%;background:#cfe3ee;border:2px solid #24303a"></div>`).join("")}
  </div>`;
}
function vehArt(seedStr, body, price){
  const r=seedRng("v"+seedStr);
  const cols=["#8f1d22","#14213d","#1b1b1d","#e2e4e8","#3c4f2f","#5b5f66","#7a1f3d","#0f3d5c","#caa64b","#f5f6f7"];
  const c=cols[Math.floor(r()*cols.length)];
  const low = body==="sports"||body==="exotic";
  const bg = price>150000? "radial-gradient(120% 90% at 50% 0%,#2b2622,#141110)" : "radial-gradient(120% 90% at 50% 0%,#252220,#141110)";
  return `<div class="art-veh" style="background:${bg}"><div class="veh-sil" style="${low?"height:26%":""}">
   <div class="bod" style="background:linear-gradient(180deg,${c},#0d0d0f)"></div>
   <div class="cab" style="background:linear-gradient(180deg,rgba(255,255,255,.25),rgba(0,0,0,.4)),${c};${body==="truck"?"right:44%":""}${low?";bottom:44%":""}"></div>
   <div class="wh f"></div><div class="wh r"></div></div></div>`;
}
function boatArt(seedStr){
  const r=seedRng("b"+seedStr);
  return `<div class="art-veh" style="background:linear-gradient(180deg,hsl(${198+r()*14|0},52%,${70+r()*12|0}%) 58%,hsl(200,55%,38%) 58%)"><div class="boat-sil">
   <div class="hull" style="background:linear-gradient(180deg,#f2f4f6,#c9d2d8)"></div>
   <div class="deck" style="background:#e7ebee"></div><div class="brg" style="background:#d4dade"></div></div></div>`;
}
function planeArt(seedStr){
  const r=seedRng("p"+seedStr);
  return `<div class="art-veh" style="background:linear-gradient(180deg,hsl(${215+r()*20|0},40%,${16+r()*8|0}%),#0e1420)"><div class="plane-sil">
   <div class="fus" style="background:linear-gradient(180deg,#eef1f5,#b9c2cd)"></div>
   <div class="tail" style="background:#dde3ea"></div><div class="wing" style="background:#cdd5de"></div></div></div>`;
}
function genHomes(){
  const T = D.METROS[S.blob.player.team] || D.METROS["Jets"];
  const wk = wkKey(S.blob.clock);
  const out=[];
  T.hoods.forEach((H,hi)=>{
    const rng=seedRng(S.careerId+"|homes|"+H[0]+"|"+wk.split("/")[0]);
    for(let i=0;i<5;i++){
      const beds=2+Math.floor(rng()*4), baths=Math.max(1.5, beds-1+Math.round(rng())*.5);
      const sq=1100+Math.floor(rng()*2600)+(H[1]>1.5?800:0);
      const base=H[1]*1e6; const price=Math.round((base*(0.55+rng()*0.9) + sq*180*H[1])/5000)*5000;
      const num=100+Math.floor(rng()*880);
      const st=D.STREETS[Math.floor(rng()*D.STREETS.length)]+" "+D.STTYPES[Math.floor(rng()*D.STTYPES.length)];
      const kind = sq>2800?"Single family":beds<=2?"Condo":rng()>0.5?"Townhouse":"Single family";
      out.push({id:"h"+hi+"-"+i, hood:H[0], addr:num+" "+st, beds, baths, sq, price, kind, tier:H[1]});
    }
  });
  return out;
}
function genCars(){
  const wk=wkKey(S.blob.clock); const out=[];
  for (const [make,model,body,baseK,yr0,hot] of D.CARDATA){
    const rng=seedRng(S.careerId+"|car|"+make+model+"|"+wk.split("/")[0]);
    const years=[]; for(let y=yr0;y<=2026;y++) years.push(y);
    const pick = years.filter(()=>rng()>0.45).slice(0,6);
    if(!pick.length) pick.push(2026);
    for (const y of pick){
      const age=2026-y; const mi = age===0? Math.floor(rng()*40)*10 : Math.floor((6+rng()*10)*1000*age);
      const dep=Math.pow(0.87,age);
      const price=Math.round(baseK*1000*hot*dep*(0.92+rng()*0.16)/250)*250;
      out.push({id:(make+model+y+mi).replace(/\W/g,""), make, model, body, yr:y, mi, price});
    }
  }
  return out.sort((a,b)=>a.price-b.price);
}
function genBoats(){
  const wk=wkKey(S.blob.clock); const out=[];
  for (const [maker,model,type,len,pM,yr0] of D.YACHTDATA){
    const rng=seedRng(S.careerId+"|boat|"+maker+model+"|"+wk.split("/")[0]);
    const years=[]; for(let y=yr0;y<=2026;y++) if(rng()>0.4) years.push(y);
    if(!years.length) years.push(2026);
    for (const y of years.slice(0,4)){
      const age=2026-y; const price=Math.round(pM*1e6*Math.pow(0.93,age)*(0.9+rng()*0.2)/5000)*5000;
      out.push({id:(maker+model+y).replace(/\W/g,""), maker, model, type, len, yr:y, price, hrs:age?Math.floor((80+rng()*220)*age):0});
    }
  }
  return out.sort((a,b)=>a.price-b.price);
}
function genPlanes(){
  const wk=wkKey(S.blob.clock); const out=[];
  for (const [maker,model,cls,pM,yr0,seats] of D.PLANEDATA){
    const rng=seedRng(S.careerId+"|pln|"+maker+model+"|"+wk.split("/")[0]);
    const years=[]; for(let y=yr0;y<=2026;y++) if(rng()>0.5) years.push(y);
    if(!years.length) years.push(2026);
    for (const y of years.slice(0,3)){
      const age=2026-y; const price=Math.round(pM*1e6*Math.pow(0.94,age)*(0.9+rng()*0.18)/25000)*25000;
      out.push({id:(maker+model+y).replace(/\W/g,""), maker, model, cls, seats, yr:y, price, hrs:age?Math.floor((250+rng()*400)*age):0});
    }
  }
  return out.sort((a,b)=>a.price-b.price);
}

/* Keystone */
let keyMode="browse";
RENDER.keystone = (b,sub)=>{
  b.className="keystone lightapp";
  const homes=genHomes(); const T=D.METROS[S.blob.player.team]||D.METROS["Jets"];
  if (sub && sub.h){
    const H=homes.find(x=>x.id===sub.h);
    b.innerHTML = aphead("Keystone",{back:"renderApp('keystone')",backlabel:"Listings"}) + `<div class="apbody">
    <div class="listing" style="cursor:default"><div class="lphoto">${houseArt(H.id+S.careerId,H.tier)}<span class="price">${fm(H.price)}</span></div>
    <div class="linfo"><h4>${esc(H.addr)}</h4><p>${esc(H.hood)} · ${esc(H.kind)}</p>
    <div class="specs"><span>${H.beds} bd</span><span>${H.baths} ba</span><span>${H.sq.toLocaleString()} sqft</span></div></div></div>
    ${mortgageOptions(H.price, H.id)}
    </div>`;
    return;
  }
  b.innerHTML = aphead("Keystone", {act: keyMode==="browse"?"Build your own":"Browse", actFn:"keyMode=keyMode==='browse'?'build':'browse';renderApp('keystone')"}) +
  `<div class="apbody" id="keyBody"></div>`;
  const kb=$("#keyBody");
  if (keyMode==="build"){
    kb.innerHTML = `<div class="hoodhead"><h3>Design & build</h3><span>${esc(T.city)} metro</span></div>
    <label class="flabel">Neighborhood (land)</label>
    <select id="bHood" class="field">${T.hoods.map((h,i)=>`<option value="${i}">${esc(h[0])} — lots from ${fm(h[1]*1e6*0.28)}</option>`).join("")}</select>
    <label class="flabel">Bedrooms</label><select id="bBeds" class="field">${[3,4,5,6,7,8].map(n=>`<option>${n}</option>`).join("")}</select>
    <label class="flabel">Bathrooms</label><select id="bBaths" class="field">${[2,3,4,5,6,7].map(n=>`<option>${n}</option>`).join("")}</select>
    <label class="flabel">Square footage</label><input id="bSq" class="field" type="number" value="3500">
    <label class="flabel">Finish level</label><select id="bFin" class="field"><option value="1">Builder grade</option><option value="1.35">Designer</option><option value="1.8">Luxury</option><option value="2.6">Statement</option></select>
    <button class="btn" style="background:var(--key-acc);color:#fff" onclick="priceBuild()">Price it</button>
    <div id="bOut"></div>`;
    return;
  }
  let html="";
  for (const H of T.hoods){
    html+=`<div class="hoodhead"><h3>${esc(H[0])}</h3><span>5 listings</span></div>`;
    html+=homes.filter(x=>x.hood===H[0]).map(H2=>`
    <div class="listing" onclick="renderApp('keystone',{h:'${H2.id}'})">
      <div class="lphoto">${houseArt(H2.id+S.careerId,H2.tier)}<span class="price">${fm(H2.price)}</span></div>
      <div class="linfo"><h4>${esc(H2.addr)}</h4><p>${esc(H2.kind)}</p>
      <div class="specs"><span>${H2.beds} bd</span><span>${H2.baths} ba</span><span>${H2.sq.toLocaleString()} sqft</span></div></div></div>`).join("");
  }
  kb.innerHTML=html;
};
function priceBuild(){
  const T=D.METROS[S.blob.player.team]||D.METROS["Jets"];
  const hood=T.hoods[+$("#bHood").value]; const beds=+$("#bBeds").value, baths=+$("#bBaths").value, sq=+$("#bSq").value, fin=+$("#bFin").value;
  if(!sq||sq<800) return toast("Square footage too small to permit.");
  const land=Math.round(hood[1]*1e6*0.28/5000)*5000;
  const build=Math.round(sq*(240*fin)*(1+ (beds+baths)*0.012)/5000)*5000;
  const total=land+build;
  const id="build-"+Date.now();
  $("#bOut").innerHTML=`<div class="listing" style="cursor:default;margin-top:12px"><div class="linfo">
   <h4>Custom build — ${esc(hood[0])}</h4><p>${beds} bd · ${baths} ba · ${sq.toLocaleString()} sqft</p>
   <div class="payline"><span>Land</span><span>${fm(land)}</span></div>
   <div class="payline"><span>Construction (${fin===1?"builder":fin===1.35?"designer":fin===1.8?"luxury":"statement"} grade)</span><span>${fm(build)}</span></div>
   <div class="payline tot" style="font-weight:800"><span>Total</span><span>${fm(total)}</span></div></div></div>` +
   mortgageOptions(total, id, {custom:{hood:hood[0], beds, baths, sq}});
}
function mortgageOptions(price, hid, extra){
  const opts=[[0.20, 6.1, 30],[0.10, 6.6, 30],[0.35, 5.7, 15]];
  const rows=opts.map((o,i)=>{
    const dn=Math.round(price*o[0]); const principal=price-dn;
    const r=o[1]/100/12, n=o[2]*12; const pay=Math.round(principal*r/(1-Math.pow(1+r,-n)));
    return `<button class="btn" style="background:#fff;color:var(--key-ink);box-shadow:0 2px 8px rgba(19,26,34,.1);text-align:left;display:flex;justify-content:space-between" onclick='buyHouse(${price},${dn},${pay},${o[1]},"${hid}",${JSON.stringify(extra?.custom||null)})'>
    <span>${Math.round(o[0]*100)}% down · ${o[2]}yr @ ${o[1]}%</span><span>${fm(pay)}/mo</span></button>`;}).join("");
  return `<div class="hoodhead"><h3>Financing</h3><span>Meridian pre-approval</span></div>${rows}
  <button class="btn" style="background:var(--key-acc);color:#fff" onclick='buyHouse(${price},${price},0,0,"${hid}",${JSON.stringify(extra?.custom||null)})'>Buy in cash — ${fm(price)}</button>`;
}
function buyHouse(price, down, pay, apr, hid, custom){
  if (S.cash.checking < down) return toast("You need "+fm(down)+" in checking. You have "+fm(S.cash.checking)+".");
  const homes=genHomes(); const H=homes.find(x=>x.id===hid);
  const label = H? H.addr+", "+H.hood : "Custom build — "+(custom?custom.hood:"");
  sheet(`<h3>Close on it?</h3><p class="sp">${esc(label)} for ${fm(price)}${pay?` — ${fm(down)} down, ${fm(pay)}/mo`:" in cash"}. Your extended-stay bill (${fm(3400)}/mo) ends at closing.</p>
  <button class="btn" style="background:var(--key-acc);color:#fff" onclick='confirmHouse(${price},${down},${pay},${apr},${JSON.stringify(label)})'>Sign & close</button>
  <button class="btn" style="background:rgba(127,127,127,.15)" onclick="closeSheet()">Walk away</button>`);
}
function confirmHouse(price, down, pay, apr, label){
  S.cash.checking-=down;
  S.properties.push({n:label, value:price, bought:price});
  if (pay) S.debts.push({n:"Mortgage — "+label, bal:price-down, apr, pay, kind:"mortgage"});
  S.bills = S.bills.filter(x=>x.id!=="stay");
  S.bills.push({id:"homeown", n:"Property tax, insurance & upkeep", amt:Math.round(price*0.02/12), cat:"housing"});
  S.ledger.push({t:"Closed — "+label, amt:-down, kind:"spend"});
  creditTouch(pay?-12:4);
  persist(); closeSheet(); toast("Keys are yours."); renderApp("keystone"); renderWidget();
}
/* Octane */
let octF={q:"",make:"",body:"",max:""};
RENDER.octane = (b,sub)=>{
  b.className="octane darkapp";
  const cars=genCars();
  if (sub && sub.c){
    const C=cars.find(x=>x.id===sub.c);
    b.innerHTML=aphead("Octane",{back:"renderApp('octane')",backlabel:"Showroom"})+`<div class="apbody">
    <div class="listing" style="cursor:default"><div class="lphoto" style="height:150px">${vehArt(C.id,C.body,C.price)}<span class="price">${fm(C.price)}</span></div>
    <div class="linfo"><h4>${C.yr} ${esc(C.make)} ${esc(C.model)}</h4><p>${esc(C.body)} · ${C.mi.toLocaleString()} miles</p></div></div>
    ${finOptions(C)}</div>`;
    return;
  }
  const makes=[...new Set(D.CARDATA.map(x=>x[0]))].sort();
  const list=cars.filter(c=> (!octF.q || (c.make+" "+c.model).toLowerCase().includes(octF.q.toLowerCase()))
    && (!octF.make||c.make===octF.make) && (!octF.body||c.body===octF.body) && (!octF.max||c.price<=+octF.max));
  b.innerHTML = aphead("Octane", {act: S.garage.length? "Garage ("+S.garage.length+")":"", actFn:"garSheet()"}) +
  `<div class="filters">
    <input placeholder="Search" value="${esc(octF.q)}" oninput="octF.q=this.value;octList()">
    <select onchange="octF.make=this.value;octList()"><option value="">All makes</option>${makes.map(m=>`<option ${octF.make===m?"selected":""}>${m}</option>`).join("")}</select>
    <select onchange="octF.body=this.value;octList()"><option value="">All bodies</option>${["sedan","suv","truck","sports","exotic"].map(m=>`<option ${octF.body===m?"selected":""}>${m}</option>`).join("")}</select>
    <select onchange="octF.max=this.value;octList()"><option value="">Any price</option><option value="30000">Under $30k</option><option value="60000">Under $60k</option><option value="120000">Under $120k</option><option value="300000">Under $300k</option><option value="99999999">Sky's the limit</option></select>
  </div>
  <div class="oct-count" id="octCount">${list.length} vehicles</div>
  <div class="apbody" id="octList"></div>`;
  octList();
};
function octList(){
  const cars=genCars();
  const list=cars.filter(c=> (!octF.q || (c.make+" "+c.model).toLowerCase().includes(octF.q.toLowerCase()))
    && (!octF.make||c.make===octF.make) && (!octF.body||c.body===octF.body) && (!octF.max||c.price<=+octF.max));
  $("#octCount")&&($("#octCount").textContent=list.length+" vehicles");
  const el=$("#octList"); if(!el) return;
  el.innerHTML = list.slice(0,80).map(C=>`
    <div class="listing" onclick="renderApp('octane',{c:'${C.id}'})">
      <div class="lphoto">${vehArt(C.id,C.body,C.price)}<span class="price">${fm(C.price)}</span></div>
      <div class="linfo"><h4>${C.yr} ${esc(C.make)} ${esc(C.model)}</h4><p>${C.mi.toLocaleString()} mi · ${esc(C.body)}</p></div></div>`).join("")
    + (list.length>80?`<div class="empty">Showing 80 of ${list.length}. Tighten the filters.</div>`:"");
}
function finOptions(C){
  const dn=Math.round(C.price*0.1); const r=0.079/12, n=60, pay=Math.round((C.price-dn)*r/(1-Math.pow(1+r,-n)));
  return `<div class="hoodhead" style="color:var(--ink)"><h3>Drive it home</h3><span style="color:var(--faint)">Octane Finance</span></div>
  <button class="btn" style="background:var(--oct-acc);color:#1a0f05" onclick='buyVeh("${C.id}",0)'>Cash — ${fm(C.price)}</button>
  <button class="btn" style="background:rgba(240,127,36,.16);color:var(--oct-acc)" onclick='buyVeh("${C.id}",1)'>${fm(dn)} down · 60mo @ 7.9% — ${fm(pay)}/mo</button>`;
}
function buyVeh(id, fin){
  const C=genCars().find(x=>x.id===id);
  const dn=fin? Math.round(C.price*0.1) : C.price;
  if (S.cash.checking<dn) return toast("You need "+fm(dn)+". Checking has "+fm(S.cash.checking)+".");
  S.cash.checking-=dn;
  S.garage.push({n:C.yr+" "+C.make+" "+C.model, value:C.price, body:C.body, id:C.id});
  if (fin){ const r=0.079/12,n=60,pay=Math.round((C.price-dn)*r/(1-Math.pow(1+r,-n)));
    S.debts.push({n:"Auto — "+C.make+" "+C.model, bal:C.price-dn, apr:7.9, pay, kind:"auto"}); creditTouch(-8); }
  S.bills.find(x=>x.id==="carins") || S.bills.push({id:"carins", n:"Auto insurance", amt:0, cat:"life"});
  S.bills.find(x=>x.id==="carins").amt = Math.round(S.garage.reduce((a,c)=>a+c.value,0)*0.00045)+120;
  S.ledger.push({t:"Octane — "+C.yr+" "+C.make+" "+C.model, amt:-dn, kind:"spend"});
  persist(); toast("It's yours. Insurance adjusted."); renderApp("octane"); renderWidget();
}
function garSheet(){
  sheet(`<h3>Garage</h3>` + (S.garage.length? S.garage.map((c,i)=>`<div class="rowline"><div class="l"><h4>${esc(c.n)}</h4><p>Value ${fm(c.value)} (drops weekly)</p></div><button class="btn sm" style="background:rgba(244,100,92,.2);color:#ff9d94" onclick="sellVeh(${i})">Sell</button></div>`).join("") : `<p class="sp">Empty. The team facility has a shuttle, but let's be honest.</p>`) +
  `<button class="btn" style="background:rgba(255,255,255,.1);margin-top:10px" onclick="closeSheet()">Close</button>`);
}
function sellVeh(i){
  const c=S.garage[i]; const got=Math.round(c.value*0.94);
  S.cash.checking+=got; S.garage.splice(i,1);
  S.ledger.push({t:"Sold — "+c.n, amt:got, kind:"income"});
  persist(); closeSheet(); toast("Sold for "+fm(got)+" (6% under value — dealers eat)."); renderWidget();
}

/* Harborline Yachts */
RENDER.yachts = (b,sub)=>{
  b.className="yachts lightapp";
  const boats=genBoats();
  if (sub&&sub.y){
    const Y=boats.find(x=>x.id===sub.y);
    b.innerHTML=aphead("Harborline",{back:"renderApp('yachts')",backlabel:"Brokerage"})+`<div class="apbody">
    <div class="listing" style="cursor:default"><div class="lphoto" style="height:150px">${boatArt(Y.id)}<span class="price">${fmk(Y.price)}</span></div>
    <div class="linfo"><h4>${Y.yr} ${esc(Y.maker)} ${esc(Y.model)}</h4><p>${Y.len} ft ${esc(Y.type)} · ${Y.hrs} engine hrs</p></div></div>
    <div class="hoodhead"><h3>Ownership costs</h3><span>annual</span></div>
    <div class="listing" style="cursor:default"><div class="linfo">
      <div class="payline"><span>Dockage & storage</span><span>${fm(Y.len*450)}</span></div>
      <div class="payline"><span>Maintenance & crew</span><span>${fm(Math.round(Y.price*0.08))}</span></div></div></div>
    <button class="btn" style="background:var(--yct-acc);color:#fff;margin-top:8px" onclick='buyBoat("${Y.id}")'>Buy — ${fmk(Y.price)}</button></div>`;
    return;
  }
  const groups=["fishing","dayboat","wake","cruiser","sport","flybridge","sportfish","catamaran","classic","superyacht"];
  b.innerHTML = aphead("Harborline") + `<div class="apbody">` + groups.map(g=>{
    const rows=boats.filter(x=>x.type===g); if(!rows.length) return "";
    return `<div class="hoodhead"><h3 style="text-transform:capitalize">${g==="sportfish"?"Sportfishing":g}</h3><span>${rows.length} vessels</span></div>` +
    rows.slice(0,10).map(Y=>`<div class="listing" onclick="renderApp('yachts',{y:'${Y.id}'})">
      <div class="lphoto">${boatArt(Y.id)}<span class="price">${fmk(Y.price)}</span></div>
      <div class="linfo"><h4>${Y.yr} ${esc(Y.maker)} ${esc(Y.model)}</h4><p>${Y.len} ft · ${Y.hrs} hrs</p></div></div>`).join("");
  }).join("") + `</div>`;
};
function buyBoat(id){
  const Y=genBoats().find(x=>x.id===id);
  if (S.cash.checking<Y.price) return toast("You need "+fmk(Y.price)+" liquid. Not yet.");
  S.cash.checking-=Y.price;
  S.boats.push({n:Y.yr+" "+Y.maker+" "+Y.model, value:Y.price});
  S.bills.push({id:"dock"+Date.now(), n:"Dockage & yacht upkeep", amt:Math.round((Y.len*450+Y.price*0.08)/12), cat:"toys"});
  S.ledger.push({t:"Harborline — "+Y.maker+" "+Y.model, amt:-Y.price, kind:"spend"});
  persist(); toast("Welcome aboard."); renderApp("yachts"); renderWidget();
}

/* Stratos Air */
RENDER.planes = (b,sub)=>{
  b.className="planes darkapp";
  const planes=genPlanes();
  if (sub&&sub.p){
    const P=planes.find(x=>x.id===sub.p);
    b.innerHTML=aphead("Stratos Air",{back:"renderApp('planes')",backlabel:"Hangar"})+`<div class="apbody">
    <div class="listing" style="cursor:default"><div class="lphoto" style="height:150px">${planeArt(P.id)}<span class="price">${fmk(P.price)}</span></div>
    <div class="linfo" style="color:var(--ink)"><h4 style="color:var(--ink)">${P.yr} ${esc(P.maker)} ${esc(P.model)}</h4><p style="color:var(--faint)">${esc(P.cls)} · ${P.seats} seats · ${P.hrs} hrs</p></div></div>
    <div class="hoodhead" style="color:var(--ink)"><h3>Annual ownership</h3><span style="color:var(--faint)">crew, hangar, mx</span></div>
    <div class="listing" style="cursor:default"><div class="linfo" style="color:var(--ink)">
      <div class="payline"><span>Fixed costs</span><span>${fm(Math.round(P.price*0.06))}</span></div>
      <div class="payline"><span>Per flight hour</span><span>${fm(Math.round(1200+P.price/25000))}</span></div></div></div>
    <button class="btn" style="background:var(--pln-acc);color:#0e1420;margin-top:8px" onclick='buyPlane("${P.id}")'>Acquire — ${fmk(P.price)}</button>
    <p style="font-size:12px;color:var(--faint);margin-top:10px">Charter membership tiers arrive next iteration. Whole ownership only, like a maniac.</p></div>`;
    return;
  }
  b.innerHTML = aphead("Stratos Air") + `<div class="apbody">` +
  ["piston","vlj","turboprop","light","midsize","super-mid","large","ultra","bizliner"].map(g=>{
    const rows=planes.filter(x=>x.cls===g); if(!rows.length) return "";
    const label={piston:"Piston",vlj:"Very Light Jets",turboprop:"Turboprops",light:"Light Jets",midsize:"Midsize",["super-mid"]:"Super-Midsize",large:"Large Cabin",ultra:"Ultra Long Range",bizliner:"Bizliners"}[g];
    return `<div class="hoodhead" style="color:var(--ink)"><h3>${label}</h3><span style="color:var(--faint)">${rows.length} aircraft</span></div>` +
    rows.map(P=>`<div class="listing" onclick="renderApp('planes',{p:'${P.id}'})">
      <div class="lphoto">${planeArt(P.id)}<span class="price">${fmk(P.price)}</span></div>
      <div class="linfo" style="color:var(--ink)"><h4 style="color:var(--ink)">${P.yr} ${esc(P.maker)} ${esc(P.model)}</h4><p style="color:var(--faint)">${P.seats} seats · ${P.hrs} hrs</p></div></div>`).join("");
  }).join("") + `</div>`;
};
function buyPlane(id){
  const P=genPlanes().find(x=>x.id===id);
  if (S.cash.checking<P.price) return toast("You need "+fmk(P.price)+" liquid for this. The runway metaphor becomes literal.");
  S.cash.checking-=P.price;
  S.planes.push({n:P.yr+" "+P.maker+" "+P.model, value:P.price});
  S.bills.push({id:"hangar"+Date.now(), n:"Aircraft fixed costs", amt:Math.round(P.price*0.06/12), cat:"toys"});
  S.ledger.push({t:"Stratos — "+P.maker+" "+P.model, amt:-P.price, kind:"spend"});
  persist(); toast("Wheels up."); renderApp("planes"); renderWidget();
}
/* Apex */
RENDER.apex = b=>{
  b.className="apex lightapp";
  b.innerHTML = aphead("Apex Sports Group") + `<div class="apbody">
  <div class="listing" style="cursor:default;background:#fffdf6"><div class="linfo">
    <span class="pill" style="background:#efe6cd;color:#6b5b2a">Your representation</span>
    <h4 style="margin-top:8px">${esc(D.CAST.agent.name)}</h4><p>Senior agent · playing contracts 3% · endorsements negotiated per deal</p></div></div>
  <div class="hoodhead"><h3>Endorsement pipeline</h3><span>updates at sync</span></div>
  <div class="listing" style="cursor:default;background:#fffdf6"><div class="linfo">
    <span class="pill" style="background:#e8d9b8;color:#6b5b2a">On hold</span>
    <h4 style="margin-top:8px">Crestline Automotive — regional ambassador</h4>
    <p>$120,000/yr + vehicle · requires active-roster status. Dre's note: "Sit tight. Don't buy anything stupid."</p>
    <div class="specs"><span>Exclusivity: autos</span><span>Arrival clause</span></div></div></div>
  <div class="listing" style="cursor:default;background:#fffdf6"><div class="linfo">
    <span class="pill" style="background:#e2e8dd;color:#3c5a3f">Open — local</span>
    <h4 style="margin-top:8px">Florham Park Deli — name & likeness</h4>
    <p>$4,500 flat for a sandwich named after you. The "Number Zero": chicken cutlet, vodka sauce, fresh mozz. Dre thinks it's beneath you. Dre is wrong.</p>
    <button class="btn sm" style="background:var(--apx-acc);color:#fff;margin-top:8px" onclick="signDeli()">Sign it</button></div></div>
  <div class="hoodhead"><h3>Contract status</h3><span>from the save</span></div>
  <div class="listing" style="cursor:default;background:#fffdf6"><div class="linfo">
    <h4>${esc(S.blob.player.team)} — ${esc(S.blob.player.status==="PracticeSquad"?"Practice Squad":S.blob.player.status)}</h4>
    <div class="payline"><span>PS weekly</span><span>${fm(psWeekly())}</span></div>
    <div class="payline"><span>Active contract on file</span><span>${fm((S.blob.player.contract?.salary?.[0])||S.blob.player.capSalary)}/yr</span></div>
    <div class="payline"><span>Elevations used</span><span>0 of 3</span></div></div></div>
  </div>`;
};
function signDeli(){
  if (S.deals.find(d=>d.id==="deli")) return toast("Already signed. The sandwich is in rotation.");
  S.deals.push({id:"deli", n:"Florham Park Deli", amt:4500});
  S.cash.checking+=4500; S.ledger.push({t:"Endorsement — Florham Park Deli", amt:4500, kind:"income"});
  persist(); toast("Signed. $4,500 deposited."); renderApp("apex"); renderWidget();
}

/* ClipHouse */
RENDER.clip = b=>{
  b.className="cliph";
  b.innerHTML = aphead("ClipHouse", {act:"+ Add clip", actFn:"addClipSheet()"}) + `<div class="apbody">` +
  (S.world.clips.length? S.world.clips.map((c,i)=>`<div class="clip" onclick="window.open('${esc(c.url)}','_blank')">
    <span class="play">▶</span><span class="src pill" style="background:rgba(255,61,113,.2);color:#ff8fb0">clip</span>
    <div class="ct"><h4>${esc(c.t)}</h4><p>${esc(c.d||"")}</p></div></div>`).join("")
  : `<div class="empty">No clips yet.\n\nDrop real highlight links here (TikTok, YouTube) and they live inside the ClipHouse skin — real footage, fictional wrapper. Week syncs will suggest searches that match your box scores.</div>`) + `</div>`;
};
function addClipSheet(){
  sheet(`<h3>Add a clip</h3><p class="sp">Paste a link to real footage. It plays out to the source; ClipHouse is the wrapper.</p>
  <input class="field" id="clUrl" placeholder="https://…">
  <input class="field" id="clT" placeholder="Caption (e.g. 'the back shoulder throw')">
  <button class="btn" style="background:var(--clip-acc);color:#fff" onclick="addClip()">Add to feed</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function addClip(){
  const url=$("#clUrl").value.trim(), t=$("#clT").value.trim()||"Untitled clip";
  if(!/^https?:\/\//.test(url)) return toast("That's not a link.");
  S.world.clips.unshift({url, t, d:"added by you"});
  persist(); closeSheet(); renderApp("clip");
}

/* Podium */
RENDER.podium = b=>{
  b.className="podium";
  const P=S.world.podium;
  b.innerHTML = aphead("Podium") +
  `<div style="padding:0 16px 6px"><b style="font-size:17px">${esc(P.show)}</b><div style="font-size:12.5px;color:var(--dim)">${esc(P.hosts)} · The only show that matters</div></div>
  <div class="ritual"><h4>This week's episode brief</h4><p>${esc(P.srcNote)}</p>
    <div style="display:flex;gap:8px"><button class="btn sm" style="background:var(--pod-acc);color:#130f1e" onclick="podiumBrief()">Generate brief</button>
    <button class="btn sm" style="background:rgba(159,123,255,.18);color:var(--pod-acc)" onclick="podiumAttach()">Attach episode</button></div></div>
  <div class="apbody flush">` + P.eps.map((e,i)=>`<button class="ep" style="width:100%" onclick="playEp(${i})">
    <span class="art2">◉</span><span class="tx"><h4>${esc(e.t)}</h4><p>${esc(e.d)}</p><div class="dur">${esc(e.dur)}${e.url?" · linked":""}</div></span></button>`).join("") + `</div>
  <div class="playbar"><span class="pb-art">◉</span><span class="pb-tx"><b id="pbT">${esc(P.eps[0].t)}</b><small id="pbS">Not playing</small></span><button class="pb-btn" onclick="toast('Attach the NotebookLM file or link to this episode to play it.')">▶</button></div>`;
};
function playEp(i){
  const e=S.world.podium.eps[i];
  if (e.url) window.open(e.url,"_blank");
  else sheet(`<h3>${esc(e.t)}</h3><p class="sp">${esc(e.d)}</p><p class="sp">No audio attached yet. Generate the brief, run it through NotebookLM, then attach the link or file here.</p>
  <button class="btn" style="background:var(--pod-acc);color:#130f1e" onclick="closeSheet();podiumAttach()">Attach episode</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}
function podiumAttach(){
  sheet(`<h3>Attach this week's episode</h3><p class="sp">Paste the NotebookLM share link (or any hosted audio URL).</p>
  <input class="field" id="epUrl" placeholder="https://notebooklm.google.com/…">
  <button class="btn" style="background:var(--pod-acc);color:#130f1e" onclick="doAttach()">Attach</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function doAttach(){
  const u=$("#epUrl").value.trim(); if(!/^https?:/.test(u)) return toast("Paste a link.");
  S.world.podium.eps[0].url=u; persist(); closeSheet(); renderApp("podium"); toast("Episode linked.");
}
function podiumBrief(){
  const p=S.blob.player; const nx=nextGame(); const last=[...S.blob.schedule].reverse().find(g=>g[7]);
  const brief =
`THE WALKTHROUGH — WEEKLY EPISODE BRIEF (${wkLabel(S.blob.clock)})
Format: two hosts (${D.CAST.podcast.hosts.join(" & ")}), 7 to 10 minutes, league-wide NFL talk. Natural banter, real analysis. This document is the only source of truth. Do not invent games or injuries beyond it.

SEGMENT 1, Around the league (4-5 min): open with the state of the preseason league-wide. Storylines to riff on: contenders managing snap counts, one surprise injury scare (invent nothing specific, speak generally), rookie classes making noise, roster-cut anxiety as final cuts approach.

SEGMENT 2, Team check-in (2-3 min): The ${p.team}. ${last? `Last result: ${last[4]?"vs":"at"} ${last[3]}, ${last[7][0]}-${last[7][1]} ${last[7][0]>last[7][1]?"win":"loss"}.`:""} ${nx? `Next: ${nx[4]?"home vs":"at"} ${nx[3]} (${nx[5]}).`:""} Coach Aaron Glenn's roster is thin but disciplined.

SEGMENT 3, The closer (1-2 min, only if it earns it): a practice-squad quarterback named ${p.first} ${p.last}, No. ${p.jersey}, ${p.age} years old, undrafted, went 6-of-9 in garbage time and scouts noticed. He makes $6,222 a week. Mention him like insiders do: skeptical but intrigued. He is NOT a star yet. Keep it to a tease.

Tone: realistic NFL podcast. No hype voice. The hosts disagree sometimes.`;
  sheet(`<h3>Episode brief</h3><p class="sp">Copy this into NotebookLM as a source, generate the Audio Overview, then attach the link back here.</p>
  <textarea class="field" style="height:200px;font-size:12px" id="briefTx">${esc(brief)}</textarea>
  <button class="btn" style="background:var(--pod-acc);color:#130f1e" onclick="navigator.clipboard.writeText(document.getElementById('briefTx').value).then(()=>toast('Brief copied.'))">Copy brief</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}

/* Contacts */
RENDER.contacts = b=>{
  b.className="settings";
  const roster=S.blob.roster.slice(0,16);
  const world=[["Dre Holloway","Agent — Apex","#6b5b2a"],["Mom","Family","#5a3a56"],["Meridian Private Client","Bank","#134534"],["Marcus Ellery","United Chronicle","#1160a8"],["Equipment Room","Team ops","#31404f"]];
  b.innerHTML = aphead("Contacts") + `<div class="apbody flush">
  <div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Your world</h3></div>` +
  world.map(w=>`<div class="contact"><span class="av" style="background:${w[2]}">${initials(w[0])}</span><div><h4>${esc(w[0])}</h4><p>${esc(w[1])}</p></div></div>`).join("") +
  `<div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Locker room</h3></div>` +
  roster.map(r=>`<div class="contact"><span class="av" style="background:${avColor(r[0]+r[1])}">${initials(r[0]+" "+r[1])}</span><div><h4>${esc(r[0]+" "+r[1])}</h4><p>${esc(r[2])} · #${r[4]}${r[5]==="PracticeSquad"?" · PS":""}</p></div></div>`).join("") + `</div>`;
};

/* Card */
RENDER.card = b=>{
  b.className="cardapp";
  const min=Math.max(35, S.credit.cardBal*0.03);
  b.innerHTML = aphead("Card") +
  `<div class="thecard"><div style="display:flex;justify-content:space-between"><span class="tn">TYNET CARD</span><span style="color:#9aa2ac;font-size:11px">WORLD ELITE</span></div>
   <div class="num">•••• •••• •••• 0${String(S.blob.player.jersey).padStart(3,"0")}</div>
   <div class="bot"><span>${esc((S.blob.player.first+" "+S.blob.player.last).toUpperCase())}</span><span>EXP 08/29</span></div></div>
  <div class="apbody">
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Balance <span>limit ${fm(S.credit.cardLimit)} · ${S.credit.cardApr}% APR</span></h4>
    <b style="font-size:30px" class="mono">${fmc(S.credit.cardBal)}</b>
    ${S.credit.cardBal>0?`<div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn sm" style="background:#cfd6df;color:#17191d" onclick="payCard(${min})">Pay minimum ${fm(min)}</button>
      <button class="btn sm" style="background:rgba(207,214,223,.15);color:#cfd6df" onclick="payCard(${S.credit.cardBal})">Pay in full</button></div>`:
      `<div style="font-size:13px;color:var(--dim);margin-top:6px">Zero balance. Spend anywhere in-world and it lands here; autopay pulls the minimum monthly.</div>`}</div>
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Statement</h4>` +
  (S.cardTx.length? S.cardTx.slice(-12).reverse().map(t=>`<div class="payline"><span>${esc(t.n)}</span><span>${fm(t.amt)}</span></div>`).join("") : `<div style="font-size:13px;color:var(--dim)">No activity. Every in-world storefront takes the card next iteration; this cycle it covers the rookie dinner when it comes.</div>`) + `</div></div>`;
};
function payCard(amt){
  amt=Math.min(amt, S.credit.cardBal);
  if (S.cash.checking<amt) return toast("Checking can't cover that payment.");
  S.cash.checking-=amt; S.credit.cardBal-=amt; creditTouch(3);
  S.ledger.push({t:"Card payment", amt:-amt, kind:"spend"});
  persist(); renderApp("card"); renderWidget(); toast("Payment posted.");
}
/* Settings */
RENDER.settings = b=>{
  b.className="settings";
  const st=META.settings; const P=S.perception;
  b.innerHTML = aphead("Settings") + `<div class="apbody">
  <div class="setgroup">
    <div class="setrow"><span class="si" style="background:#2f7cf6">🖼</span><div class="stx">Wallpaper<small>Auto-fades top and bottom into black. The letterbox fix</small></div><button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="pickImage('wall')">Choose</button></div>
    <div class="setrow"><span class="si" style="background:#8e44ad">☺</span><div class="stx">Profile photo<small>Shows in Chirper, group chats, articles</small></div><button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="pickImage('pfp')">Choose</button></div>
  </div>
  <label class="flabel">World perception — who the world thinks you are</label>
  <div class="setgroup" style="padding:12px 14px">
    <label class="flabel">Draft status</label>
    <select class="field" id="pDraft">${["Undrafted","7th round","Day 3 pick","Day 2 pick","1st round pick"].map(x=>`<option ${P.draft===x?"selected":""}>${x}</option>`).join("")}</select>
    <label class="flabel">Recruit stars (HS)</label>
    <select class="field" id="pStars">${[0,1,2,3,4,5].map(x=>`<option value="${x}" ${P.stars===x?"selected":""}>${"★".repeat(x)||"No stars"}</option>`).join("")}</select>
    <label class="flabel">High school rep</label><input class="field" id="pHs" value="${esc(P.hs)}">
    <label class="flabel">College rep</label><input class="field" id="pCol" value="${esc(P.college)}">
    <label class="flabel">Hometown</label><input class="field" id="pHome" value="${esc(P.hometown)}" placeholder="e.g. Youngstown, OH">
    <label class="flabel">Family situation</label>
    <select class="field" id="pFam">${["Comfortable","Stable","Paycheck to paycheck","Struggling","Rock bottom, you're the way out"].map(x=>`<option ${P.family===x?"selected":""}>${x}</option>`).join("")}</select>
    <label class="flabel">Monthly family support you send</label><input class="field" id="pAsk" type="number" value="${P.familyAsk||0}">
    <label class="flabel">Debt you brought into the league</label><input class="field" id="pDebtAmt" type="number" value="${P.debtAmt||0}">
    <select class="field" id="pDebtKind">${["None","Student loans","Family loans","Credit cards","A guy back home"].map(x=>`<option ${P.debtKind===x?"selected":""}>${x}</option>`).join("")}</select>
    <label class="flabel">Your story (feeds the world's writing)</label>
    <textarea class="field" id="pStory" style="height:70px" placeholder="The bio the world half-knows…">${esc(P.story)}</textarea>
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="savePerception()">Save perception</button>
  </div>
  <label class="flabel">World generation</label>
  <div class="setgroup" style="padding:12px 14px">
    <label class="flabel">Anthropic API key (stays on this phone)</label>
    <input class="field" id="sKey" type="password" value="${esc(st.apiKey||"")}" placeholder="sk-ant-…">
    <label class="flabel">Model</label>
    <select class="field" id="sModel">${["claude-sonnet-4-6","claude-opus-4-8","claude-fable-5"].map(m=>`<option ${st.model===m?"selected":""}>${m}</option>`).join("")}</select>
    <div class="setrow" style="padding:8px 0"><div class="stx">Generate eagerly at sync<small>Full-fat weekly world. Costs what it costs.</small></div>
      <button class="switch ${st.autogen?"on":""}" onclick="META.settings.autogen=!META.settings.autogen;persist();renderApp('settings')"><i></i></button></div>
    <button class="btn" style="background:rgba(255,255,255,.12)" onclick="saveGenSettings()">Save keys</button>
  </div>
  <label class="flabel">Careers</label>
  <div class="setgroup">${META.careers.map(c=>`<div class="setrow"><span class="si" style="background:#134534">🏈</span>
    <div class="stx">${esc(c.label)}<small>${esc(c.sub||"")}</small></div>
    ${META.careers.length>1?`<button class="btn sm" style="background:rgba(244,100,92,.2);color:#ff9d94" onclick="delCareer('${c.id}')">Delete</button>`:""}</div>`).join("")}
  </div>
  <div class="empty" style="padding:16px">TyNet ${VER} · append #debug to the URL for the viewport readout</div></div>`;
};
function savePerception(){
  const P=S.perception;
  P.draft=$("#pDraft").value; P.stars=+$("#pStars").value; P.hs=$("#pHs").value; P.college=$("#pCol").value;
  P.hometown=$("#pHome").value; P.family=$("#pFam").value; P.familyAsk=+$("#pAsk").value||0;
  const newDebt=+$("#pDebtAmt").value||0; P.debtKind=$("#pDebtKind").value;
  if (newDebt!==P.debtAmt){
    S.debts=S.debts.filter(d=>d.kind!=="legacy");
    if (newDebt>0){ const apr=P.debtKind==="Credit cards"?24.9:P.debtKind==="A guy back home"?0:7.5;
      const pay=P.debtKind==="A guy back home"?Math.round(newDebt/24):Math.round(newDebt*0.022);
      S.debts.push({n:"Pre-league debt — "+P.debtKind, bal:newDebt, apr, pay, kind:"legacy"}); }
    P.debtAmt=newDebt;
  }
  P.story=$("#pStory").value;
  persist(); toast("The world now knows what you told it."); renderWidget();
}
function saveGenSettings(){ META.settings.apiKey=$("#sKey").value.trim(); META.settings.model=$("#sModel").value; persist(); toast("Saved."); }
async function delCareer(id){
  sheet(`<h3>Delete career?</h3><p class="sp">This erases the phone's copy — ledger, world, everything. The Madden save is untouched.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick="reallyDel('${id}')">Delete forever</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Keep it</button>`);
}
async function reallyDel(id){
  META.careers=META.careers.filter(c=>c.id!==id);
  await idb.del("career/"+id);
  if (META.activeId===id){ META.activeId=META.careers[0].id; S=await idb.get("career/"+META.activeId); }
  persist(); closeSheet(); renderApp("settings"); toast("Career deleted.");
}
function pickImage(kind){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
    const img=new Image(); img.onload=()=>{
      const c=document.createElement("canvas");
      const w = kind==="wall"? 480 : 128; const h = kind==="wall"? Math.round(w*img.height/img.width) : 128;
      c.width=w; c.height=h; const x=c.getContext("2d");
      x.drawImage(img,0,0,w,h);
      if (kind==="wall"){
        // THE FADE LAW: melt top and bottom into true black so any OS letterbox is invisible
        let g=x.createLinearGradient(0,0,0,h*0.16); g.addColorStop(0,"rgba(0,0,0,.92)"); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g; x.fillRect(0,0,w,h*0.16);
        g=x.createLinearGradient(0,h*0.80,0,h); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"#000"); x.fillStyle=g; x.fillRect(0,h*0.80,w,h*0.20);
      }
      const data=c.toDataURL("image/jpeg",0.82);
      if (kind==="wall"){ META.settings.wallpaper=data; applyWallpaper(); toast("Wallpaper set, edges faded."); }
      else { META.settings.pfp=data; toast("Profile photo set."); }
      persist();
    };
    img.src=URL.createObjectURL(f);
  };
  inp.click();
}
function applyWallpaper(){
  if (META.settings.wallpaper){
    document.getElementById("screen").style.setProperty("--customwall", `url(${META.settings.wallpaper})`);
    document.getElementById("screen").classList.add("customwall");
  }
}
/* ---- Sync: codec, apply, rewind ---- */
RENDER.sync = b=>{
  b.className="sync";
  b.innerHTML = aphead("Sync") + `<div class="apbody">
  <div class="synccard"><h4>How it works</h4><p>The desktop reader turns your Madden save into a code. The code IS the save's facts, nothing rides the internet. Scan the QR with your camera (it opens here and applies itself) or paste the code below.</p>
  <textarea class="field" id="syncIn" placeholder="TYNET1.…"></textarea>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="applyCode()">Apply code</button></div>
  <div class="synccard"><h4>Applied weeks — ${esc(S.blob.player.first)} ${esc(S.blob.player.last)}</h4>
  <p>${S.appliedWeeks.map(esc).join(" · ")}</p></div>
  <div class="synccard"><h4>Backup</h4><p>Emits this career's full phone-side history as a code (covers iOS eviction and phone-to-phone moves).</p>
  <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="backupCode()">Copy backup code</button></div></div>`;
};
async function decodeCode(code){
  code=code.trim();
  if (code.startsWith("TYNETB.")) return {backup:true, data: JSON.parse(await inflate(code.slice(7)))};
  if (!code.startsWith("TYNET1.")) throw new Error("Not a TyNet code.");
  return {blob: JSON.parse(await inflate(code.slice(7)))};
}
async function inflate(b64u){
  const bin=Uint8Array.from(atob(b64u.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
  const ds=new DecompressionStream("deflate-raw");
  const out=await new Response(new Blob([bin]).stream().pipeThrough(ds)).arrayBuffer();
  return new TextDecoder().decode(out);
}
async function deflateStr(str){
  const cs=new CompressionStream("deflate-raw");
  const out=await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(out))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function backupCode(){
  const code="TYNETB."+await deflateStr(JSON.stringify(S));
  await navigator.clipboard.writeText(code); toast("Backup copied — "+(code.length/1024).toFixed(1)+" KB");
}
async function applyCode(fromHash){
  const raw = fromHash || $("#syncIn")?.value;
  if (!raw || !raw.trim()) return toast("Paste a code first.");
  let dec;
  try { dec = await decodeCode(raw); } catch(e){ return toast("Code didn't decode: "+e.message); }
  if (dec.backup){ return restoreSheet(dec.data); }
  const blob=dec.blob;
  if (!S || blob.careerId!==S.careerId){ return newCareerSheet(blob); }
  const k=wkKey(blob.clock);
  if (S.appliedWeeks.includes(k)) return toast("That week is already applied. Codes work once.");
  const ord = c => c.seasonYear*1000 + (c.weekType==="PreSeason"?0:c.weekType==="RegularSeason"?100:500) + c.week;
  if (ord(blob.clock) < ord(S.blob.clock)) return rewindSheet(blob);
  await advanceTo(blob);
}
function newCareerSheet(blob){
  const p=blob.player;
  sheet(`<h3>New career detected</h3><p class="sp">${esc(p.first)} ${esc(p.last)} — ${esc(p.pos)}, ${esc(p.team)} (${esc(wkLabel(blob.clock))}). Add it as a separate phone profile?</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick='addCareer(${JSON.stringify(JSON.stringify(blob))})'>Add career</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
async function addCareer(blobJson){
  const blob=JSON.parse(blobJson);
  const st=newCareerState(blob);
  await idb.set("career/"+blob.careerId, st);
  META.careers.push({id:blob.careerId, label:blob.player.first+" "+blob.player.last, sub:blob.player.pos+" · "+blob.player.team+" · "+wkLabel(blob.clock)});
  META.activeId=blob.careerId; S=st; persist(); closeSheet(); toast("Career added."); renderHome(); renderLock();
  if (curApp) renderApp(curApp);
}
function rewindSheet(blob){
  sheet(`<h3>Older save detected</h3><p class="sp">This code is from ${esc(wkLabel(blob.clock))}; the phone is at ${esc(wkLabel(S.blob.clock))}. Rewinding deletes everything newer — deposits, articles, threads, purchases stay only if they existed then.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick='doRewind(${JSON.stringify(JSON.stringify(blob))})'>Rewind (deletes newer)</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Ignore this code</button>`);
}
async function doRewind(blobJson){
  const blob=JSON.parse(blobJson);
  // v1 rewind: reset to a fresh state at that blob, preserving settings/perception
  const per=S.perception; const st=newCareerState(blob); st.perception=per;
  S=st; await idb.set("career/"+S.careerId, S);
  const c=META.careers.find(x=>x.id===S.careerId); if(c) c.sub=blob.player.pos+" · "+blob.player.team+" · "+wkLabel(blob.clock);
  persist(); closeSheet(); toast("Rewound to "+wkLabel(blob.clock)); renderHome(); if(curApp) renderApp(curApp);
}
function restoreSheet(data){
  sheet(`<h3>Restore backup?</h3><p class="sp">Career "${esc(data.blob.player.first+" "+data.blob.player.last)}" at ${esc(wkLabel(data.blob.clock))}. Overwrites any existing copy of the same career.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick='doRestore(${JSON.stringify(JSON.stringify(data))})'>Restore</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
async function doRestore(json){
  const data=JSON.parse(json);
  await idb.set("career/"+data.careerId, data);
  if (!META.careers.find(c=>c.id===data.careerId)) META.careers.push({id:data.careerId, label:data.blob.player.first+" "+data.blob.player.last, sub:wkLabel(data.blob.clock)});
  META.activeId=data.careerId; S=data; persist(); closeSheet(); toast("Restored."); renderHome();
}

/* ---- the week engine ---- */
async function advanceTo(blob){
  const oldC=S.blob.clock, newC=blob.clock;
  const rng=seedRng(S.careerId+"|wk|"+wkKey(newC));
  const events=[];
  // elapsed regular-season weeks → paychecks
  const wksElapsed=[];
  if (newC.weekType==="RegularSeason"){
    const start = oldC.weekType==="RegularSeason"? oldC.week : 0;
    for (let w=start; w<newC.week; w++) wksElapsed.push(w);
  }
  if (oldC.weekType==="PreSeason"){
    const preWeeks = (newC.weekType==="PreSeason"? newC.week : 3) - oldC.week;
    for (let i=0;i<preWeeks;i++){ deposit("Camp stipend — week "+(oldC.week+i+1), 1750); events.push("Camp stipend $1,750"); }
  }
  for (const w of wksElapsed){
    const g=blob.schedule.find(x=>x[1]==="RegularSeason"&&x[0]===w);
    const road=g&&!g[4]; const st=road? STATE_TAX[g[3]]:null;
    const ck=checkLines(blob.player.status, road, st);
    let net=ck.net;
    if (S.autosweep){ const tx=Math.round(net*S.sweepPct.tax/100), sv=Math.round(net*S.sweepPct.savings/100);
      S.cash.tax+=tx; S.cash.savings+=sv; net-=tx+sv; }
    deposit("Game check — Week "+(w+1)+(road?" (@ "+g[3]+")":""), net);
    events.push("Week "+(w+1)+" check "+fm(net));
    burnWeek(); tickInvest(rng); cardCycle(w);
  }
  if (!wksElapsed.length){ burnWeek(); tickInvest(rng); }
  // adopt the new truth
  S.blob=blob; S.appliedWeeks.push(wkKey(newC));
  const c=META.careers.find(x=>x.id===S.careerId); if(c) c.sub=blob.player.pos+" · "+blob.player.team+" · "+wkLabel(newC);
  // status change events
  const last=[...blob.schedule].reverse().find(g=>g[7]&&g[1]===newC.weekType);
  S.world.notifs=[];
  if (last) S.world.notifs.push({app:"espn", t:"Final", p:(last[4]?"vs ":"@ ")+last[3]+" — "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" W":" L")});
  events.forEach(e=>S.world.notifs.push({app:"meridian", t:"Meridian", p:e}));
  persist();
  toast("Synced to "+wkLabel(newC));
  closeSheet(); renderHome(); if(curApp) renderApp(curApp);
  // eager generation
  if (META.settings.apiKey && META.settings.autogen){ generateWeek(blob, last).catch(e=>toast("Generation failed: "+e.message)); }
  else if (last){ placeholderWeek(blob, last); }
}
function deposit(label, amt){ S.cash.checking+=amt; S.ledger.push({t:label, amt, kind:"income"}); }
function burnWeek(){
  const wk=monthlyBurn()/4.333;
  S.cash.checking-=wk;
  S.ledger.push({t:"Weekly burn (bills, payments, life)", amt:-Math.round(wk), kind:"spend"});
  if (S.cash.checking<0){ creditTouch(-15); S.ledger.push({t:"Overdraft fee", amt:-35, kind:"spend"}); S.cash.checking-=35; }
  // debt amortization
  for (const d of S.debts){ const int=d.bal*(d.apr/100/52); d.bal=Math.max(0, d.bal+int-(d.pay/4.333)); }
  S.debts=S.debts.filter(d=>d.bal>1);
  // asset decay
  for (const car of S.garage) car.value=Math.round(car.value*0.9965);
  for (const bt of S.boats) bt.value=Math.round(bt.value*0.998);
}
function cardCycle(w){
  if (S.credit.cardBal>0){ const min=Math.max(35,S.credit.cardBal*0.03);
    if (S.cash.checking>=min){ S.cash.checking-=min; S.credit.cardBal=Math.max(0, S.credit.cardBal*(1+S.credit.cardApr/100/12)-min); }
    else { creditTouch(-20); S.credit.cardBal*= (1+S.credit.cardApr/100/12); } }
}
function placeholderWeek(blob, last){
  const won=last[7][0]>last[7][1];
  S.world.chirps.unshift({n:"Jets Videos",h:"@snyjets",vf:1,av:"#1a7a41",t:"FINAL: "+(last[4]?"Jets "+last[7][0]+", "+last[3]+" "+last[7][1] : last[3]+" "+last[7][1]+", Jets "+last[7][0])+".", li:800+((last[7][0]*37)%900), rp:120, tm:"1h"});
  S.world.huddle.unshift({id:"pg"+wkKey(blob.clock).replace(/\W/g,""), flair:"GAME THREAD", u:"AutoModerator", tm:"3h", up:won?400:150,
    h:"Post-Game Thread: "+(last[4]?"Jets ":"")+(won?"win ":"fall ")+last[7][0]+"-"+last[7][1]+(last[4]?" vs ":" at ")+last[3],
    b:"Add an API key in Settings and the world writes itself every sync — article, threads, texts, all of it. This is the placeholder economy.", cmts:[
    {u:"FlightBoysZn",tm:"2h",up:won?220:80,t:won?"WE ARE SO BACK":"it's august for the soul all year with this team"},
    {u:"stat_daddy_nyj",tm:"2h",up:60,t:"box score breakdown when the full feed generates. bones of a "+(won?"real win":"rough one")+" here"}]});
  persist();
}
/* ---- AI generation (user's own key, phone-side) ---- */
async function callClaude(system, user, maxTokens){
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":META.settings.apiKey,
      "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
    body: JSON.stringify({ model: META.settings.model||"claude-sonnet-4-6", max_tokens: maxTokens||8000,
      system, messages:[{role:"user", content:user}] })
  });
  if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
  const data=await r.json();
  return data.content.filter(x=>x.type==="text").map(x=>x.text).join("\n");
}
function worldFacts(blob, last){
  const p=blob.player; const per=S.perception;
  return `PLAYER (save truth): ${p.first} ${p.last}, ${p.pos}, ${p.team}, jersey #${p.jersey}, age ${p.age}, status ${p.status}${p.isIR?" (IR)":""}, confidence ${p.confidence}/99.
CLOCK: ${wkLabel(blob.clock)}.
LAST RESULT: ${last? (last[4]?"home vs ":"away at ")+last[3]+", "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" WIN":" LOSS") : "none"}.
NEXT: ${(()=>{const n=nextGame(); return n? (n[4]?"home vs ":"at ")+n[3]+" ("+n[5]+")":"unknown"})()}.
KEY TEAMMATES: ${blob.roster.slice(0,10).map(r=>r[0]+" "+r[1]+" ("+r[2]+" #"+r[4]+")").join(", ")}.
QB ROOM: ${blob.roster.filter(r=>r[2]==="QB").map(r=>r[0]+" "+r[1]).join(", ")}.
MONEY: practice squad $6,222/wk; checking ${fm(S.cash.checking)}; runway ${runwayWeeks()} weeks.
PERCEPTION (who the world believes he is): ${per.draft}, ${per.stars}-star HS recruit, HS: ${per.hs}, college: ${per.college}, hometown: ${per.hometown||"unknown"}, family: ${per.family}${per.familyAsk?", sends home "+fm(per.familyAsk)+"/mo":""}${per.debtAmt?", carrying "+fm(per.debtAmt)+" of "+per.debtKind:""}. Story: ${per.story||"(none given)"}.`;
}
async function generateWeek(blob, last){
  toast("Generating the week's world…");
  const sys = `You write the living world of a fictional NFL life-sim phone. Everything is fiction anchored to the SAVE FACTS given. Never contradict a fact. No em dashes anywhere. Invent plausible box-score details consistent with the final score, and realistic fan/journalist voices with distinct personalities. The player is NOT famous unless the facts imply it. Output STRICT JSON only, no markdown fences, matching:
{"article":{"kick":"","head":"","stand":"","by":"Marcus Ellery · United Chronicle Sports","paras":["8-12 paragraphs, feature length"],"pq":"one pull quote"},
"chirps":[{"n":"","h":"@handle","vf":0,"t":"","li":0,"rp":0,"tm":"2h"} x6-9],
"huddle":[{"id":"unique","flair":"DISCUSSION|GAME THREAD","u":"","tm":"3h","up":0,"h":"","b":"","cmts":[{"u":"","tm":"","up":0,"t":"","r":[{"u":"","tm":"","up":0,"t":""}]} x10-14, at least two nested reply chains 2-3 deep, include some negative-score comments]} x2],
"texts":[{"thread":"braelon|qbroom|agent|mom","msgs":[["them","..."]]} x2-4 additions],
"emails":[{"id":"unique","from":"","subj":"","time":"","unread":true,"body":""} x1-2]}`;
  const out = await callClaude(sys, worldFacts(blob,last)+"\n\nWrite this week's full world.", 16000);
  let j;
  try { j = JSON.parse(out.replace(/^```json?/,"").replace(/```$/,"").trim()); }
  catch(e){ throw new Error("bad JSON from model"); }
  if (j.article){ j.article.wk=wkLabel(blob.clock); S.world.articles.unshift(j.article); }
  if (j.chirps) S.world.chirps=[...j.chirps, ...S.world.chirps].slice(0,40);
  if (j.huddle) S.world.huddle=[...j.huddle, ...S.world.huddle].slice(0,20);
  if (j.texts) for (const t of j.texts){ const th=S.world.texts.find(x=>x.id===t.thread); if(th) th.msgs.push(...t.msgs); }
  if (j.emails) S.world.emails=[...j.emails, ...S.world.emails];
  S.world.notifs.unshift({app:"huddle", t:"h/jetsnation", p:j.huddle?.[0]?.h||"New threads"});
  persist(); toast("The world caught up."); if(curApp) renderApp(curApp);
}
async function aiReply(thread, userMsg){
  try{
    const sys=`You are ${thread.name} texting ${S.blob.player.first} ${S.blob.player.last} (${S.blob.player.pos}, ${S.blob.player.team}, ${S.blob.player.status}). Stay perfectly in character based on the conversation so far. Reply with ONLY the text message content, under 40 words, lowercase texting style unless the character wouldn't. No em dashes.`;
    const hist=thread.msgs.map(m=>(m[0]==="me"?"THEM: ":"YOU: ")+m[1]).join("\n");
    return await callClaude(sys, hist+"\nTHEM: "+userMsg+"\nYour reply:", 200);
  }catch(e){ toast("Reply failed: "+e.message); return null; }
}

/* ---- service worker + boot ---- */
const VER="v1.0.0";
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    reg.addEventListener("updatefound", ()=>{
      const nw=reg.installing;
      nw.addEventListener("statechange", ()=>{
        if (nw.state==="installed" && navigator.serviceWorker.controller){
          const t=$("#toast"); t.innerHTML="Update ready — tap to reload"; t.classList.add("show");
          t.style.pointerEvents="auto"; t.onclick=()=>location.reload();
        }
      });
    });
  }).catch(()=>{});
}
if (location.hash==="#debug"){
  const d=document.createElement("div");
  d.style.cssText="position:fixed;top:60px;left:10px;z-index:999;background:rgba(0,0,0,.8);color:#0f0;font:11px monospace;padding:6px;border-radius:6px;pointer-events:none";
  const upd=()=>{d.textContent=`inner ${innerWidth}x${innerHeight} dpr ${devicePixelRatio} vv ${visualViewport?visualViewport.width.toFixed(0)+"x"+visualViewport.height.toFixed(0):"-"} standalone ${navigator.standalone}`};
  upd(); addEventListener("resize",upd); document.body.appendChild(d);
}
(async function boot(){
  await idb.open();
  META = await idb.get("meta");
  if (!META){
    META = { careers:[], activeId:null, settings:{apiKey:"", model:"claude-sonnet-4-6", autogen:true, wallpaper:null, pfp:null} };
    const st=newCareerState(D.BLOB);
    await idb.set("career/"+D.BLOB.careerId, st);
    META.careers.push({id:D.BLOB.careerId, label:D.BLOB.player.first+" "+D.BLOB.player.last, sub:D.BLOB.player.pos+" · "+D.BLOB.player.team+" · "+wkLabel(D.BLOB.clock)});
    META.activeId=D.BLOB.careerId;
    await idb.set("meta", META);
    S=st;
  } else {
    S = await idb.get("career/"+META.activeId);
    if (!S){ S=newCareerState(D.BLOB); META.activeId=D.BLOB.careerId; }
  }
  applyWallpaper();
  clockTick(); renderLock(); renderHome();
  // QR path: #sync=CODE
  const m=location.hash.match(/^#sync=(.+)/);
  if (m){ unlock(); openApp("sync"); setTimeout(()=>applyCode(decodeURIComponent(m[1])), 400); history.replaceState(null,"",location.pathname); }
})();
