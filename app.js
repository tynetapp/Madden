/* ============ TyPhone OS — app.js ============ */
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
    deals: [], perception: { draft:"Undrafted free agent", state:"NJ", grew:"Small town", hs:"Local standout", college:"Mid-major starter", family:"Single mother household", rep:"Complete unknown", familyAsk:0, debtTotal:0, debtShares:null },
    world: { texts: structuredClone(D.SEED.texts), emails: structuredClone(D.SEED.emails),
             articles: [Object.assign({wk:"Preseason Wk 1"}, structuredClone(D.SEED.article))],
             earlier: structuredClone(D.SEED.earlier),
             chirps: structuredClone(D.SEED.chirps), huddle: structuredClone(D.SEED.huddle),
             podium: structuredClone(D.SEED.podium), clips: [], espnExtra: structuredClone(D.SEED.espnExtra),
             notifs: structuredClone(D.SEED.notifications) },
    votes: {}, reads: {}, cardTx: [], handle: "@"+(p.first+p.last).toLowerCase(),
    agent: null,
    chirp: { followers: 842, following: 63, delta: 0, posts: [] },
    last4: String(1000 + Math.floor(seedRng(blob.careerId+"card")()*9000)),
    acctNums: { checking: String(1000+Math.floor(seedRng(blob.careerId+"a1")()*9000)), savings: String(1000+Math.floor(seedRng(blob.careerId+"a2")()*9000)), tax: String(1000+Math.floor(seedRng(blob.careerId+"a3")()*9000)) },
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
  return assistMonthly() + b;
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
  const feePct = (S && S.agent) ? S.agent.fee : 3.0;
  const agent = -Math.round(gross*feePct/100); lines.push(["Agent fee ("+feePct+"%) — "+((S&&S.agent)?S.agent.n.split(" ").pop():"Apex"), agent]);
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
  chirper: SV('<path d="M20.5 6.5c-.6.3-1.2.5-1.9.6.7-.4 1.2-1 1.4-1.8-.6.4-1.3.7-2.1.8C17.3 5.4 16.4 5 15.4 5c-1.9 0-3.4 1.5-3.4 3.4 0 .3 0 .5.1.8-2.8-.1-5.3-1.5-7-3.6-.3.5-.5 1.1-.5 1.7 0 1.2.6 2.2 1.5 2.8-.6 0-1.1-.2-1.5-.4 0 1.6 1.2 3 2.7 3.3-.3.1-.6.1-.9.1-.2 0-.4 0-.6-.1.4 1.4 1.7 2.4 3.2 2.4-1.2.9-2.6 1.5-4.2 1.5H4c1.5 1 3.3 1.5 5.2 1.5 6.3 0 9.7-5.2 9.7-9.7v-.4c.7-.5 1.2-1.1 1.6-1.8z" fill="currentColor" stroke="none"/>'),
  tmail: SV('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>'),
  chron: '<span style="font-family:Georgia,serif;font-size:19px;font-weight:700;letter-spacing:-.5px">UC</span>',
  pylon: '<i class="py-ic"></i>',
  wager: '<span style="font-weight:900;font-size:19px;letter-spacing:-1px">W/</span>',
  assist: SV('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/><path d="M16.5 5.5l1.2 1.2M18.6 4.6l.9.9" stroke-width="1.4"/>'),
  podium: SV('<rect x="9.2" y="3" width="5.6" height="11" rx="2.8"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6"/>'),
  keystone: SV('<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10.5V20h12v-9.5"/><rect x="10" y="14.5" width="4" height="5.5" fill="currentColor" stroke="none"/>'),
  octane: SV('<path d="M4 16.5a8.5 8.5 0 1 1 16 0"/><path d="M12 15.5l4.2-5" stroke-width="2.4"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/>'),
  apex: '<span style="font-size:15px;letter-spacing:.06em;font-weight:800">AX</span>',
  yachts: SV('<circle cx="12" cy="5" r="2.2"/><path d="M12 7.5V19M6 12h12M5 15c.8 3 3.6 5 7 5s6.2-2 7-5l-2.5 1M5 15l2.5 1"/>'),
  planes: SV('<path d="M21 15.5v-1.7l-8-4.6V4.4c0-.8-.5-1.4-1-1.4s-1 .6-1 1.4v4.8l-8 4.6v1.7l8-2.4v4.6l-2.2 1.6v1.3l3.2-.9 3.2.9v-1.3L13 17.7v-4.6l8 2.4z" fill="currentColor" stroke="none"/>'),
  contacts: SV('<circle cx="12" cy="8.4" r="3.6" fill="currentColor" stroke="none"/><path d="M4.8 20c.9-3.4 3.8-5.4 7.2-5.4s6.3 2 7.2 5.4" fill="currentColor" stroke="none"/>'),
  card: SV('<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4"/><path d="M3 10h18" stroke-width="2.6"/><path d="M6.5 15h5"/>'),
  settings: SV('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>'),
};
/* ---- OS shell ---- */
const APPS = [
  {id:"huddle", n:"The Huddle", ic:"ic-hud"},
  {id:"chirper", n:"Chirper", ic:"ic-chr"},
  {id:"tmail", n:"T-Mail", ic:"ic-tml"},
  {id:"chron", n:"Chronicle", ic:"ic-chron"},
  {id:"pylon", n:"NFLSN", ic:"ic-pylon"},
  {id:"podium", n:"Podium", ic:"ic-pod"},
  {id:"keystone", n:"Keystone", ic:"ic-key"},
  {id:"octane", n:"Octane", ic:"ic-oct"},
  {id:"apex", n:"Apex", ic:"ic-apx"},
  {id:"yachts", n:"Harborline", ic:"ic-yct"},
  {id:"planes", n:"Stratos", ic:"ic-pln"},
  {id:"contacts", n:"Contacts", ic:"ic-con"},
  {id:"card", n:"Credit Card", ic:"ic-card"},
  {id:"wager", n:"WagerLines", ic:"ic-wgr"},
  {id:"assist", n:"Mara", ic:"ic-ast"},
];
const DOCK = [
  {id:"messages", n:"Messages", ic:"ic-msg"},
  {id:"meridian", n:"Meridian", ic:"ic-mer"},
  {id:"sync", n:"Sync", ic:"ic-sync"},
  {id:"settings", n:"Settings", ic:"ic-set"},
];
let curApp = null, appStack = [];

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("show"), 2600); }
function sheet(html){ $("#sheet").innerHTML=html; $("#dim").classList.remove("hidden"); }
function closeSheet(){ $("#dim").classList.add("hidden"); }
$("#dim") && document.addEventListener("click", e=>{ if(e.target.id==="dim") closeSheet(); });

function clockTick(){
  const d=phoneNow?phoneNow():new Date();
  const t=d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}).replace(/\s?[AP]M/i,"");
  $("#lk-time").textContent=t; $("#sb-time").textContent=t;
  $("#lk-date").textContent=d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"});
}
setInterval(clockTick, 5000);

function unlock(){ const hb=$('#homebar'); if(hb) hb.style.display='none'; $("#lock").classList.add("hidden"); $("#home").classList.remove("hidden"); }
function lock(){ renderLock(); $("#lock").classList.remove("hidden"); $("#home").classList.add("hidden"); closeApp(true); }

function iconEl(a, badge){
  return `<button class="app" onclick="openApp('${a.id}')"><b class="icon ${a.ic}">${GLYPH[a.id]||""}${badge?`<span class="badge">${badge}</span>`:""}</b><span>${a.n}</span></button>`;
}
function orderedApps(){
  const ord = META.settings.appOrder||{};
  return APPS.slice().sort((a,b)=> ((a.id in ord)? ord[a.id]-0.5 : APPS.indexOf(a)) - ((b.id in ord)? ord[b.id]-0.5 : APPS.indexOf(b)) );
}
function renderHome(){
  const unreadM = S.world.texts.filter(t=>!S.reads["t:"+t.id]).length;
  const unreadE = S.world.emails.filter(e=>e.unread && !S.reads["e:"+e.id]).length;
  $("#grid").innerHTML = APPS.map(a=>iconEl(a, a.id==="tmail"&&unreadE?unreadE:null)).join("");
  $("#dock").innerHTML = DOCK.map(a=>iconEl(a, a.id==="messages"&&unreadM?unreadM:null)).join("");
  renderWidget();
}
function buzzTier(f){ return f>2000000?"Household name":f>500000?"National story":f>120000?"League-wide buzz":f>25000?"Local hero":f>6000?"Beat-writer radar":f>1500?"Local curiosity":"Unknown"; }
function gameDate(clock){
  // anchor: RS week 1 = second Thursday after Labor Day-ish; approximations by design
  const y=clock.seasonYear||2026;
  let base;
  if (clock.weekType==="PreSeason") base = new Date(y,7,7 + clock.week*7);       // Aug 7 + wk
  else if (clock.weekType==="RegularSeason") base = new Date(y,8,10 + clock.week*7); // Sep 10 + wk
  else if (clock.weekType==="OffSeason") base = new Date(y+1,2,15);
  else base = new Date(y+1,0,11 + (clock.week||0)*7); // playoffs
  return base.toLocaleDateString(undefined,{weekday:"short", month:"short", day:"numeric"});
}
function phoneNow(){
  const d=new Date();
  if (META.settings.clockOffsetMin) d.setMinutes(d.getMinutes()+META.settings.clockOffsetMin);
  return d;
}
function renderWidget(){
  const p=S.blob.player;
  $("#wg-title").textContent = p.first+" "+p.last+" · #"+p.jersey+" "+p.pos+" · "+p.teamShort;
  $("#wg-week").textContent = gameDate(S.blob.clock)+" · "+wkLabel(S.blob.clock);
  const st = p.status==="PracticeSquad"?"Practice Squad":p.isIR?"Injured Reserve":p.status==="Signed"?"Active Roster":p.status;
  $("#wg-cash").textContent = st;
  $("#wg-run").textContent = buzzTier(S.chirp?S.chirp.followers:0);
  const nx = nextGame();
  $("#wg-next").textContent = nx ? (nx[4]?"vs ":"@ ")+nx[3] : "—";
}
function wkLabel(c){ const t=c.weekType==="PreSeason"?"Pre Wk ":c.weekType==="RegularSeason"?"Week ":c.weekType+" "; return c.seasonYear+" · "+t+(c.week+1); }
function wkKey(c){ return c.seasonYear+"/"+c.weekType+"/"+c.week; }
function nextGame(){
  const c=S.blob.clock;
  const order = t => t==="PreSeason"?0 : t==="RegularSeason"?1 : 2;
  const cands = S.blob.schedule.filter(g => !g[7] && (order(g[1])>order(c.weekType) || (g[1]===c.weekType && g[0]>=c.week)));
  cands.sort((x,y)=> (order(x[1])-order(y[1])) || (x[0]-y[0]));
  return cands[0];
}
function liveNotifs(){
  const base = (S? S.world.notifs : D.SEED.notifications)||[];
  const out = base.filter(x=> !(S && S.reads["n:"+(x.t+x.p).slice(0,40)]));
  // live unread signals
  if (S){
    const unreadTexts = S.world.texts.filter(t=>t.msgs.length && t.msgs[t.msgs.length-1][0]!=="me" && !S.reads["t:"+t.id]);
    for (const t of unreadTexts.slice(0,2)){
      let p=t.msgs[t.msgs.length-1][1]; if(t.group&&p.includes("|")) p=p.slice(p.indexOf("|")+1);
      out.unshift({app:"messages", t:t.name, p});
    }
    const unreadMail=(S.world.emails||[]).filter(e=>!S.reads["e:"+e.id]);
    if (unreadMail.length) out.unshift({app:"tmail", t:"T-Mail", p:unreadMail.length+" unread — "+unreadMail[0].s});
  }
  return out;
}
function markNotifRead(app){
  if (!S) return;
  for (const x of (S.world.notifs||[])) if (x.app===app) S.reads["n:"+(x.t+x.p).slice(0,40)]=1;
  persist(); 
}
function renderLock(){
  const n = liveNotifs();
  const icons = {messages:"ic-msg",huddle:"ic-hud",tmail:"ic-tml",meridian:"ic-mer",chirper:"ic-chr",sync:"ic-sync",chron:"ic-chron",pylon:"ic-pylon"};
  $("#lk-notifs").innerHTML = n.slice(0,4).map(x=>`<button class="lk-card" onclick="unlock();markNotifRead('${x.app}');openApp('${x.app}')">
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
  markNotifRead(id);
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
      const last=t.msgs[t.msgs.length-1]||["them",""]; const unread=t.msgs.length&&!S.reads["t:"+t.id];
      let p=last[1]||"Say something."; if(t.group&&p.includes("|")) p=p.slice(p.indexOf("|")+1);
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
  if (aiKey()){
    const reply = await aiReply(t, v);
    if (reply){ t.msgs.push(["them", reply]); persist(); if(curApp==="messages") renderApp("messages",{thread:tid}); }
  } else { toast("Delivered. Add an API key in Settings for replies."); }
}

/* Chirper */
let chTab="feed"; let chThread=null;
RENDER.chirper = (b,sub)=>{
  b.className="chirper darkapp";
  if (sub && sub.t!==undefined){ chThread=sub.t; }
  const me = S.handle;
  if (chThread!==null){
    const c = chGet(chThread);
    if (!c){ chThread=null; } else {
      b.innerHTML = aphead("Post",{back:"chThread=null;renderApp('chirper')",backlabel:"Chirper"}) + `<div class="apbody flush" style="padding:0 16px 90px">
      <div class="chirp big">
        <div class="ch-row"><span class="av chav" style="background:${c.av||avColor(c.n||"me")}">${c.n?initials(c.n):(META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last))}</span><div class="ch-main">
        <div class="ch-h"><b>${esc(c.n||S.blob.player.first+" "+S.blob.player.last)}</b>${c.vf?'<i class="vfk">✔</i>':""}<span>${esc(c.h||me)}</span></div></div></div>
        <p style="margin-top:8px">${esc(c.t)}</p>
        <div class="ch-meta">${(c.li||0).toLocaleString()} likes · ${(c.rp||0).toLocaleString()} rechirps</div>
        <div class="ch-act"><button onclick="chLike('${c.id}')">♡ Like</button><button onclick="chReplyBox()">↩ Reply</button></div>
      </div>
      <div id="chReplyBox"></div>
      <div class="hoodhead" style="color:var(--ink)"><h3>Replies</h3><span style="color:var(--faint)">${(c.replies||[]).length}</span></div>
      ${(c.replies||[]).map(r=>`<div class="chirp reply"><div class="ch-row"><span class="av chav sm" style="background:${avColor(r.a)}">${r.h===S.handle&&META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(r.a)}</span><div class="ch-main"><div class="ch-h"><b>${esc(r.a)}</b><span>${esc(r.h)}</span></div><p>${esc(r.x)}</p></div></div></div>`).join("") || '<div class="empty">No replies yet.</div>'}
      </div>`;
      return;
    }
  }
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹</button><h1>Chirper</h1><button class="hact" onclick="chCompose()">Post</button></div>
  <div class="ch-profile">
    <button class="ch-av" onclick="pickPfpFromChirper()" title="Change photo">${META.settings.pfp?`<img src="${META.settings.pfp}">`:esc(S.blob.player.first[0]+S.blob.player.last[0])}</button>
    <div class="ch-pinfo">
      <b>${esc(S.blob.player.first+" "+S.blob.player.last)}</b>
      <span>${esc(me)} · ${esc(S.blob.player.pos)}, ${esc(S.blob.player.teamShort)}</span>
      <div class="ch-follow"><span><b>${S.chirp.followers.toLocaleString()}</b> Followers ${S.chirp.delta? `<i class="${S.chirp.delta>0?"up2":"dn2"}">${S.chirp.delta>0?"+":""}${S.chirp.delta.toLocaleString()} this wk</i>`:""}</span><span><b>${S.chirp.following}</b> Following</span></div>
    </div>
  </div>
  <div class="ch-compose"><span class="av chav sm" style="background:#2b6b4f">${META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last)}</span><input id="chQuick" placeholder="What's happening, ${esc(me)}?" onkeydown="if(event.key==='Enter')chQuickPost()"><button onclick="chQuickPost()">Post</button></div>
  <div class="seg segc" style="background:rgba(255,255,255,.07)">${[["feed","Feed"],["mine","Your Posts"]].map(t=>`<button class="${chTab===t[0]?"on":""}" onclick="chTab='${t[0]}';renderApp('chirper')">${t[1]}</button>`).join("")}</div>
  <div class="apbody flush" id="chList" style="padding:0 16px 90px"></div>`;
  const el=$("#chList");
  if (chTab==="feed"){
    el.innerHTML = S.world.chirps.map((c,i)=>`<button class="chirp" onclick="renderApp('chirper',{t:'w${i}'})">
      <div class="ch-row"><span class="av chav" style="background:${c.av||avColor(c.n)}">${initials(c.n)}</span><div class="ch-main">
      <div class="ch-h"><b>${esc(c.n)}</b>${c.vf?'<i class="vfk">✔</i>':""}<span>${esc(c.h)} · ${esc(c.tm||"")}</span></div><p>${esc(c.t)}</p>
      <div class="ch-meta">${(c.li||0).toLocaleString()} likes · ${(c.replies||[]).length} replies</div></div></div></button>`).join("") || '<div class="empty">Quiet out there.</div>';
  } else {
    el.innerHTML = (S.chirp.posts||[]).slice().reverse().map(c=>`<button class="chirp" onclick="renderApp('chirper',{t:'${c.id}'})">
      <div class="ch-row"><span class="av chav" style="background:#2b6b4f">${META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last)}</span><div class="ch-main">
      <div class="ch-h"><b>You</b><span>${esc(me)}</span></div><p>${esc(c.t)}</p>
      <div class="ch-meta">${(c.li||0).toLocaleString()} likes · ${(c.replies||[]).length} replies</div></div></div></button>`).join("") || '<div class="empty">You have not posted. Silence is a strategy too.</div>';
  }
};
function chGet(id){ if(String(id).startsWith("w")) return S.world.chirps[+String(id).slice(1)]; return (S.chirp.posts||[]).find(x=>x.id===id); }
function chLike(id){ const c=chGet(id); if(c){c.li=(c.li||0)+1; persist(); renderApp('chirper',{t:id});} }
function chReplyBox(){
  $("#chReplyBox").innerHTML = `<div class="chirp" style="border-style:dashed"><textarea id="chRTxt" class="field" style="margin:0 0 8px" rows="2" placeholder="Reply as ${esc(S.handle)}"></textarea>
  <button class="btn sm" style="background:var(--ch-acc);color:#fff" onclick="chSendReply()">Reply</button></div>`;
}
async function chSendReply(){
  const txt=$("#chRTxt").value.trim(); if(!txt) return;
  const c=chGet(chThread);
  c.replies=c.replies||[]; c.replies.push({a:S.blob.player.first+" "+S.blob.player.last, h:S.handle, x:txt});
  persist(); renderApp('chirper',{t:chThread});
  if (aiKey()){
    const rep = await aiChirpReply(c, txt);
    if (rep){ for (const r of rep) c.replies.push(r); persist(); if(chThread===c.id) renderApp('chirper',{t:c.id}); }
  }
}
async function aiChirpReply(c, mine){
  try{
    const out = await callAI("You write replies on a fake social platform in an NFL life sim. Original post by "+(c.n||"the player")+": \""+c.t+"\". The player ("+S.handle+", a practice squad rookie QB) just replied: \""+mine+"\". Write 2 short realistic replies from OTHER fans or accounts reacting to the player's reply. Mixed tones. Do not use em dashes. Reply ONLY with JSON: [{\"a\":\"display name\",\"h\":\"@handle\",\"x\":\"reply text\"}]", "Write the replies now.", 400);
    const arr = JSON.parse(out.replace(/```json|```/g,"").trim());
    return Array.isArray(arr)? arr.slice(0,3) : null;
  }catch(e){ return null; }
}
function pickPfpFromChirper(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>pickFromInput(inp,"pfp") || setTimeout(()=>renderApp("chirper"),600);
  inp.click();
}
function chQuickPost(){
  const el=$("#chQuick"); const txt=el&&el.value.trim(); if(!txt) return;
  const rng=seedRng(S.careerId+txt);
  S.chirp.posts=S.chirp.posts||[];
  S.chirp.posts.push({id:"me"+Date.now(), t:txt, li:Math.floor(S.chirp.followers*(0.02+rng()*0.08)), replies:[]});
  persist(); chTab="mine"; renderApp("chirper"); toast("Posted.");
}
function chCompose(){
  sheet(`<h3>New post</h3><textarea id="chNew" class="field" rows="3" placeholder="What's happening, ${esc(S.handle)}?"></textarea>
  <button class="btn" style="background:var(--ch-acc);color:#fff" onclick="chPost()">Post</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function chPost(){
  const txt=$("#chNew").value.trim(); if(!txt) return;
  S.chirp.posts=S.chirp.posts||[];
  const rng=seedRng(S.careerId+txt);
  S.chirp.posts.push({id:"me"+Date.now(), t:txt, li:Math.floor(S.chirp.followers*(0.02+rng()*0.08)), replies:[]});
  closeSheet(); persist(); chTab="mine"; renderApp('chirper'); toast("Posted.");
}
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

/* Pylon — the sports network */
const NETMAP = g => { const day=g[5], t=+g[6];
  if (g[1]==="PreSeason") return "NFLN";
  if (day==="Thursday") return "PRIME"; if (day==="Monday") return "ESPN"; if (day==="Saturday") return "NFLN";
  if (day==="Sunday"){ if (t>=1200) return "NBC"; return ["CBS","FOX"][g[0]%2]; } return "CBS"; };
let pyTab="scores";
RENDER.pylon = b=>{
  b.className="espn";
  b.innerHTML = `<div class="aphead pylon-head"><button class="back" onclick="closeApp()">‹</button><h1><i class="py-mark"></i>NFLSN</h1><span class="hact" style="opacity:.6;font-size:10px">NFL STATS NETWORK</span></div>
  <div class="seg segc" style="background:rgba(255,255,255,.08)">${[["scores","Scores"],["standings","Standings"],["me","My Season"],["leaders","Leaders"]].map(t=>`<button class="${pyTab===t[0]?"on":""}" onclick="pyGo('${t[0]}')">${t[1]}</button>`).join("")}</div>
  <div class="apbody" id="pyMain"></div>`;
  pyBody();
};
function pyGo(t){ pyTab=t; pyBody(); $$(".espn .seg button").forEach((x,i)=>x.classList.toggle("on", ["scores","standings","me","leaders"][i]===t)); }
function pyBody(){
  const m=$("#pyMain"); if(!m) return;
  const T=S.blob.player.team;
  const gcard = g=>{ const them=g[3], home=g[4];
    const sc=g[7]; const w = sc && sc[0]>sc[1];
    const rowA = home? [them, sc?sc[1]:null, sc&&!w] : [T, sc?sc[0]:null, w];
    const rowH = home? [T, sc?sc[0]:null, w] : [them, sc?sc[1]:null, sc&&!w];
    const status = sc? "FINAL · "+(g[1]==="PreSeason"?"PRE ":"")+"WK "+(g[0]+1) : g[5].slice(0,3).toUpperCase()+" · "+(g[1]==="PreSeason"?"PRE ":"")+"WK "+(g[0]+1);
    return `<div class="scorecard"><div class="st"><span>${status}</span><span class="net ${NETMAP(g)}">${NETMAP(g)==="PRIME"?"Prime Video":NETMAP(g)}</span></div>
      <div class="tm ${sc?(rowA[2]?"win":"lose"):""}"><span>${esc(rowA[0])}</span><b>${rowA[1]??""}</b></div>
      <div class="tm ${sc?(rowH[2]?"win":"lose"):""}"><span>${esc(rowH[0])}</span><b>${rowH[1]??""}</b></div></div>`; };
  if (pyTab==="scores"){
    const played = S.blob.schedule.filter(g=>g[7]);
    const upcoming = S.blob.schedule.filter(g=>!g[7]).slice(0,3);
    let leagueHtml = "";
    if (S.blob.league && S.blob.league.games && S.blob.league.games.length){
      const wkNow = S.blob.clock.week; const tp = S.blob.clock.weekType;
      const recent = S.blob.league.games.filter(g=>g.t===tp && g.w>=wkNow-1 && (g.played||g.hs+g.as>0)).slice(0,24);
      leagueHtml = `<div class="hoodhead" style="color:#fff;margin-top:18px"><h3>Around the league</h3><span style="color:#8b939c">wk ${wkNow}</span></div>` +
        recent.map(g=>`<div class="scorecard"><div class="st"><span>FINAL · WK ${g.w+1}</span></div>
        <div class="tm ${g.as>g.hs?"win":"lose"}"><span>${esc(g.a)}</span><b>${g.as}</b></div>
        <div class="tm ${g.hs>g.as?"win":"lose"}"><span>${esc(g.h)}</span><b>${g.hs}</b></div></div>`).join("");
    } else {
      leagueHtml = `<p style="font-size:12px;color:#5c6570;margin-top:14px">League-wide scores arrive with your next desktop sync (extractor v2 reads every game in the save).</p>`;
    }
    m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${esc(T)}</h3><span style="color:#8b939c">${wkLabel(S.blob.clock)}</span></div>` +
      played.map(gcard).join("") + upcoming.map(gcard).join("") + leagueHtml;
  }
  if (pyTab==="standings"){
    if (S.blob.league && S.blob.league.teams){
      const recs={}; for (const t of S.blob.league.teams) recs[t.n]={w:0,l:0,ti:0,div:t.d};
      for (const g of (S.blob.league.games||[])){ if(g.t!=="RegularSeason"||!(g.played||g.hs+g.as>0)) continue;
        if(g.hs>g.as){recs[g.h].w++;recs[g.a].l++;} else if(g.as>g.hs){recs[g.a].w++;recs[g.h].l++;} else {recs[g.h].ti++;recs[g.a].ti++;} }
      const divs={}; for(const n in recs){ (divs[recs[n].div]=divs[recs[n].div]||[]).push([n,recs[n]]); }
      m.innerHTML = Object.keys(divs).sort().map(d=>`<div class="hoodhead" style="color:#fff"><h3>${esc(d)}</h3></div>
        <table class="stnd"><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th></tr>` +
        divs[d].sort((a,b)=> (b[1].w/(b[1].w+b[1].l||1)) - (a[1].w/(a[1].w+a[1].l||1)) ).map(x=>
          `<tr class="${x[0]===T?"you":""}"><td>${esc(x[0])}</td><td>${x[1].w}</td><td>${x[1].l}</td><td>${(x[1].w+x[1].l)?(x[1].w/(x[1].w+x[1].l)).toFixed(3).replace(/^0/,""):".000"}</td></tr>`).join("") + `</table>`).join("");
    } else {
      const played = S.blob.schedule.filter(g=>g[7]&&g[1]==="RegularSeason");
      const rec = played.reduce((a,g)=>{g[7][0]>g[7][1]?a[0]++:a[1]++;return a},[0,0]);
      m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${esc(T)}</h3></div>
      <table class="stnd"><tr><th>Team</th><th>W</th><th>L</th></tr><tr class="you"><td>${esc(T)}</td><td>${rec[0]}</td><td>${rec[1]}</td></tr></table>
      <p style="font-size:12px;color:#5c6570;margin-top:12px">Full league standings arrive with your next desktop sync.</p>`;
    }
  }
  if (pyTab==="me"){
    const p=S.blob.player;
    const stats = (S.blob.seasonStats||[]).find(s=>s.table&&s.table.includes("Offensive")) || {};
    const rows = [["Games played", stats.GAMESPLAYED||0],["Games started", stats.GAMESSTARTED||0],["Pass yards", stats.PASSYDS||0],["Pass TD", stats.PASSTDS||0],["INT", stats.PASSINTS||0],["Rush yards", stats.RUSHYDS||0],["Rush TD", stats.RUSHTDS||0]];
    m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${esc(p.first+" "+p.last)}</h3><span style="color:#8b939c">${esc(p.pos)} · #${p.jersey} · ${esc(p.team)}</span></div>
    <div class="scorecard">${rows.map(r=>`<div class="tm"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>
    <div class="scorecard"><div class="st"><span>Availability</span></div>
      <div class="tm"><span>Status</span><b style="font-size:13px">${p.status==="PracticeSquad"?"Practice Squad":esc(p.status)}</b></div>
      <div class="tm"><span>Health</span><b style="font-size:13px">${p.injury&&p.injury.status!=="Uninjured"?esc(p.injury.status):"Healthy"}</b></div>
      <div class="tm"><span>Confidence</span><b>${p.confidence}</b></div></div>
    ${!stats.GAMESPLAYED?'<p style="font-size:12px;color:#5c6570">Regular season stats populate as you sync played weeks.</p>':""}`;
  }
  if (pyTab==="leaders"){
    if (S.blob.league && S.blob.league.leaders){
      const L=S.blob.league.leaders;
      m.innerHTML = Object.keys(L).map(cat=>`<div class="hoodhead" style="color:#fff"><h3>${esc(cat)}</h3></div>
      <table class="stnd"><tr><th>Player</th><th>Team</th><th>${esc(L[cat].unit||"")}</th></tr>` +
      L[cat].rows.map(r=>`<tr class="${r[0]===(S.blob.player.first+" "+S.blob.player.last)?"you":""}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${r[2]}</td></tr>`).join("") + `</table>`).join("");
    } else {
      m.innerHTML = `<div class="empty" style="color:#8b939c">League leaders arrive with your next desktop sync. Extractor v2 reads every stat line in the save: passing, rushing, receiving, sacks, picks.</div>`;
    }
  }
}
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
/* Meridian — real-bank layout */
let merTab = "accounts";
let merShow = {};
RENDER.meridian = b=>{
  b.className="meridian lightapp";
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹</button><h1><span class="mer-logo">M</span> Meridian</h1><span class="hact" style="color:#8a919c;font-size:11px;font-weight:600">Banking for the long season</span></div>
  <div class="apbody flush" id="merMain" style="padding-bottom:76px"></div>
  <div class="mer-tabs">
    ${[["accounts","Accounts","$"],["pay","Pay/Transfer","⇄"],["paycheck","Paycheck","▤"],["loans","Loans","%"],["invest","Invest","▲"]].map(t=>
      `<button class="${merTab===t[0]?"on":""}" onclick="merGo('${t[0]}')"><i>${t[2]}</i>${t[1]}</button>`).join("")}
  </div>`;
  merBody();
};
function merGo(t){ merTab=t; merBody(); $$(".mer-tabs button").forEach((x,i)=>x.classList.toggle("on", ["accounts","pay","paycheck","loans","invest"][i]===t)); }
function acctCard(label, key, bal, extra){
  const open = merShow[key];
  return `<div class="acct">
    <div class="acct-top"><span class="acct-name">${label} <span class="acct-num">*******${S.acctNums[key]||"0000"}</span> ›</span></div>
    <div class="acct-sub">Available Balance**</div>
    <div class="acct-bal">${fmc(bal)}</div>
    <button class="acct-more" onclick="merShow['${key}']=!merShow['${key}'];merBody()">Show ${open?"less":"more"} ${open?"▴":"▾"}</button>
    ${open? `<div class="acct-detail">${extra||recentFor(key)}</div>`:""}
  </div>`;
}
function acctRows(key){
  return S.ledger.filter(l=> (l.acct||"checking")===key || (l.kind==="move" && (l.from===key||l.to===key)) );
}
function moveLabel(l,key){
  if (l.kind!=="move") return [l.t, l.amt];
  if (l.from===key) return ["Transfer to "+cap(l.to), -l.mv];
  return ["Transfer from "+cap(l.from), l.mv];
}
function cap(s){ return s==="tax"?"Tax Hold":s[0].toUpperCase()+s.slice(1); }
function recentFor(key){
  const rows = acctRows(key).slice(-6).reverse().map(l=>{const [t,a]=moveLabel(l,key);return {t,amt:a};});
  return rows.map(l=>`<div class="payline ${l.amt<0?"neg":""}"><span>${esc(l.t)}</span><span>${l.amt?fm(l.amt):""}</span></div>`).join("") || '<div style="font-size:13px;opacity:.6">No recent activity.</div>';
}
function merBody(){
  const m=$("#merMain"); if(!m) return;
  const rw=runwayWeeks();
  if (merTab==="accounts"){
    m.innerHTML = `<div class="mer-sechead">Internal Accounts <span>▾</span></div>
    <div class="acct-group">
      ${acctCard("Checking","checking",S.cash.checking)}
      ${acctCard("Savings","savings",S.cash.savings)}
      ${acctCard("Tax Hold","tax",S.cash.tax,'<div style="font-size:13px;opacity:.65;line-height:1.5">Set aside for federal and state obligations. Auto-Sweep can fund this from every deposit.</div>')}
    </div>
    <div class="mer-sechead">Position</div>
    <div class="acct-group"><div class="acct">
      <div class="payline"><span>Monthly burn</span><span>${fm(monthlyBurn())}</span></div>
      <div class="payline"><span>Runway</span><span>${rw>200?"Indefinite":rw+" weeks"}</span></div>
      <div class="payline"><span>Invested</span><span>${fm(investValue())}</span></div>
      <div class="payline"><span>Net worth</span><span>${fmk(netWorth())}</span></div>
      <div class="payline"><span>Auto-Sweep</span><span><button class="mer-link" onclick="S.autosweep=!S.autosweep;persist();merBody()">${S.autosweep?"On · "+S.sweepPct.tax+"% tax / "+S.sweepPct.savings+"% savings":"Off · turn on"}</button></span></div>
    </div></div>
    <div class="mer-sechead">Bills on autopay</div>
    <div class="acct-group"><div class="acct">
      ${S.bills.map(x=>`<div class="payline"><span>${esc(x.n)}</span><span>${fm(x.amt)}</span></div>`).join("")}
      ${S.perception.familyAsk?`<div class="payline"><span>Family support</span><span>${fm(S.perception.familyAsk)}</span></div>`:""}
      ${S.debts.map(d=>`<div class="payline"><span>${esc(d.n)}</span><span>${fm(d.pay)}/mo</span></div>`).join("")}
    </div></div>`;
  }
  if (merTab==="pay"){
    m.innerHTML = `<div class="mer-sechead">Move money</div>
    <div class="acct-group"><div class="acct">
      <label class="flabel">From</label><select id="tFrom" class="field"><option value="checking">Checking</option><option value="savings">Savings</option><option value="tax">Tax Hold</option></select>
      <label class="flabel">To</label><select id="tTo" class="field"><option value="savings">Savings</option><option value="checking">Checking</option><option value="tax">Tax Hold</option></select>
      <label class="flabel">Amount</label><input id="tAmt" class="field" type="number" placeholder="$0.00">
      <button class="btn" style="background:#0b5cad;color:#fff" onclick="doTransfer()">Transfer</button>
    </div></div>
    <div class="mer-sechead">Recent activity</div>
    <div class="acct-group"><div class="acct">${S.ledger.slice(-14).reverse().map(l=>{const a=l.kind==="move"?l.mv:l.amt;return `<div class="payline ${l.amt<0?"neg":""}"><span>${esc(l.t)}</span><span>${a?fm(l.kind==="move"?a:l.amt):""}</span></div>`}).join("")}</div></div>`;
  }
  if (merTab==="paycheck"){
    const nx = nextGame(); const road = nx && !nx[4]; const st = road? STATE_TAX[nx[3]] : null;
    const ck = checkLines(S.blob.player.status, road, st);
    const isPre = S.blob.clock.weekType==="PreSeason";
    m.innerHTML = `<div class="mer-sechead">${isPre?"Season-week check (preview)":"Next check"}</div>
    <div class="acct-group"><div class="acct">
      ${ck.lines.map(l=>`<div class="payline ${l[1]<0?"neg":""}"><span>${esc(l[0])}</span><span>${fm(l[1])}</span></div>`).join("")}
      <div class="payline tot"><span>Net deposit</span><span>${fm(ck.net)}</span></div></div></div>
    <div class="mer-sechead">How you're paid</div>
    <div class="acct-group"><div class="acct"><div style="font-size:13.5px;line-height:1.55;opacity:.75">Practice squad pays ${fm(psWeekly())} per week for 18 weeks (${fm(psWeekly()*18)} a season). A game-day elevation pays the active weekly rate of ${fm(activeWeekly())} for that week. Signing to the 53 switches every remaining week to the active rate. ${isPre?"Preseason pays a $1,750 weekly camp stipend; real checks start Week 1.":""}</div></div></div>
    <div class="mer-sechead">Deposit history</div>
    <div class="acct-group"><div class="acct">${S.ledger.filter(l=>l.kind==="income").slice(-10).reverse().map(l=>`<div class="payline"><span>${esc(l.t)}</span><span>${fm(l.amt)}</span></div>`).join("")}</div></div>`;
  }
  if (merTab==="loans"){
    m.innerHTML = `<div class="mer-sechead">Credit score</div>
    <div class="acct-group"><div class="acct"><div class="acct-bal" style="font-size:34px">${S.credit.score}</div>
    <div style="font-size:13px;opacity:.65">${S.credit.score>=740?"Excellent. Best rates unlock.":S.credit.score>=700?"Good. Prime offers available.":S.credit.score>=640?"Fair. Standard rates.":"Building. Expect painful APRs."}</div></div></div>
    <div class="mer-sechead">Products</div>
    <div class="acct-group">${D.LOANS.map(L=>{
      const ok = S.credit.score>=L.minScore;
      return `<div class="acct"><div class="acct-top"><span class="acct-name">${esc(L.n)}</span><span style="font-size:12px;opacity:.6">${L.apr.toFixed(1)}% · ${L.term}mo</span></div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 8px">Up to ${fm(L.max)}. ${L.trap? esc(L.note):""} ${!ok?"Requires score "+L.minScore+".":""}</div>
      ${ok?`<div style="display:flex;gap:8px"><input class="field" style="margin:0" type="number" id="ln-${L.id}" placeholder="Amount"><button class="btn sm" style="background:${L.trap?"#c0392b":"#0b5cad"};color:#fff;white-space:nowrap" onclick="takeLoan('${L.id}')">Take loan</button></div>`:""}</div>`;
    }).join("")}</div>
    ${S.debts.length?`<div class="mer-sechead">Your debts</div><div class="acct-group"><div class="acct">${S.debts.map(d=>`<div class="payline"><span>${esc(d.n)} · ${d.apr}%</span><span>${fm(d.bal)}</span></div>`).join("")}</div></div>`:""}`;
  }
  if (merTab==="invest"){
    const total=investValue();
    m.innerHTML = `<div class="mer-sechead">Portfolio · ${fm(total)}</div>
    <div class="acct-group"><div class="acct">${Object.keys(S.invest).length? Object.keys(S.invest).map(id=>{
      const a=D.INVEST.find(x=>x.id===id); const h=S.invest[id]; const v=h.units*S.investPx[id]; const pl=v-h.cost;
      return `<div class="invrow"><div class="l"><b>${esc(a.n)}</b><small>${esc(a.kind)}</small></div>
      <div class="r"><b>${fm(v)}</b><small class="${pl>=0?"up2":"dn2"}">${pl>=0?"+":""}${fm(pl)}</small></div></div>`;}).join("") : '<div style="font-size:13px;opacity:.65">Nothing invested. Money in checking loses to inflation; money in the wrong coin loses to gravity.</div>'}</div></div>
    <div class="mer-sechead">Markets · move weekly at sync</div>
    <div class="acct-group">${D.INVEST.map(a=>`<div class="acct" style="padding:12px 16px"><div class="invrow" style="border:none;padding:0"><div class="l"><b>${esc(a.n)}</b><small>${esc(a.d)}</small></div>
      <div class="r"><b class="mono">${a.kind==="crypto"&&S.investPx[a.id]<1? "$"+S.investPx[a.id].toFixed(7): fm(S.investPx[a.id])}</b>
      <button class="btn sm" style="background:#e7f0f8;color:#0b5cad;margin-top:3px" onclick="buySheet('${a.id}')">Trade</button></div></div></div>`).join("")}</div>`;
  }
}

function doTransfer(){
  const f=$("#tFrom").value, t=$("#tTo").value, a=+$("#tAmt").value;
  if(!a||a<=0||f===t) return toast("Pick a real amount.");
  if(S.cash[f]<a) return toast("Insufficient funds in that account.");
  S.cash[f]-=a; S.cash[t]+=a; S.ledger.push({t:`Transfer ${cap(f)} to ${cap(t)}`, amt:0, mv:a, from:f, to:t, kind:"move"});
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
  ${a.buyin? `<button class="btn" style="background:#0b5cad;color:#fff" onclick="doInvest('${id}',${a.buyin})">Buy in — ${fm(a.buyin)}</button>` :
  `<input class="field" type="number" id="invAmt" placeholder="Dollar amount">
   <button class="btn" style="background:#0b5cad;color:#fff" onclick="doInvest('${id}')">Buy</button>`}
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
  const infl = Math.pow(1.035, Math.max(0,(S.blob.clock.seasonYear||2026)-2026));
  const out=[];
  T.hoods.forEach((H,hi)=>{
    const rng=seedRng(S.careerId+"|homes|"+H[0]+"|"+wk.split("/")[0]);
    for(let i=0;i<5;i++){
      const beds=2+Math.floor(rng()*7), baths=Math.max(1.5, beds-1+Math.round(rng())*.5);
      const lot=+( (H[2]*(0.6+rng()*1.6)).toFixed(2) );
      const sq=1100+Math.floor(rng()*3400)+(H[1]>1.5?900:0);
      const base=H[1]*1e6;
      const lshare = Math.min(0.85, Math.max(0.12, 0.2 + 0.18*Math.log(H[1]) + 0.25*Math.min(1, 0.15/Math.max(H[2],0.02))));
      const perAcre = base*lshare/Math.max(H[2],0.02);
      const psf = 140 + H[1]*420;
      const price=Math.round(infl*( sq*psf*(0.8+rng()*0.5) + lot*perAcre*0.85 )/5000)*5000;
      const num=100+Math.floor(rng()*880);
      const st=D.STREETS[Math.floor(rng()*D.STREETS.length)]+" "+D.STTYPES[Math.floor(rng()*D.STTYPES.length)];
      const kind = sq>2800?"Single family":beds<=2?"Condo":rng()>0.5?"Townhouse":"Single family";
      out.push({id:"h"+hi+"-"+i, hood:H[0], addr:num+" "+st, beds, baths, lot, sq, price, kind, tier:H[1]});
    }
  });
  return out;
}
function inflMult(){ return Math.pow(1.035, Math.max(0, (S.blob.clock.seasonYear||2026) - 2026)); }
function genCars(){
  const wk=wkKey(S.blob.clock); const out=[]; const infl=inflMult();
  for (const [make,model,body,seg,baseK,yr0,yrEnd] of D.CARDATA){
    const rng=seedRng(S.careerId+"|car|"+make+model+"|"+wk.split("/")[0]);
    const nowYr = S.blob.clock.seasonYear||2026;
    const last = Math.min(yrEnd, nowYr);
    const years=[]; for(let y=yr0;y<=last;y++) years.push(y);
    for (const y of years){
      const age=nowYr-y; const mi = age===0? Math.floor(rng()*40)*10 : Math.floor((5+rng()*11)*1000*age);
      const collect = (seg==="hyper" || (seg==="exotic" && yrEnd<nowYr-1) || (yrEnd<1996));
      const dep = collect? Math.pow(0.985,Math.min(age,30)) : age>25? Math.pow(0.88,25)*Math.pow(1.02,age-25) : Math.pow(0.88,age);
      const price=Math.round(baseK*1000*infl*dep*(0.92+rng()*0.16)/250)*250;
      out.push({id:(make+model+y+mi).replace(/\W/g,""), make, model, body, seg, yr:y, mi, price});
    }
  }
  return out;
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
    <div class="veh-detail light">
      <div class="vd-title">${esc(H.addr)}</div>
      <div style="font-size:13px;opacity:.6;margin-top:-4px;margin-bottom:8px">${esc(H.hood)} · ${esc(H.kind)}</div>
      <div class="vd-price">${fm(H.price)}</div>
      <div class="payline"><span>Bedrooms</span><span>${H.beds}</span></div>
      <div class="payline"><span>Bathrooms</span><span>${H.baths}</span></div>
      <div class="payline"><span>Interior</span><span>${H.sq.toLocaleString()} sqft</span></div>
      <div class="payline"><span>Lot</span><span>${H.lot} acres</span></div>
      <div class="payline"><span>Property tax & upkeep</span><span>${fm(Math.round(H.price*0.02/12))}/mo</span></div>
    </div>
    ${mortgageOptions(H.price, H.id)}
    </div>`;
    return;
  }
  b.innerHTML = `<div class="brandhead key"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">⌂</div><div><h1>Keystone</h1><small>Homes and land, every market</small></div><button class="hact" style="margin-left:auto;color:#fff" onclick="keyMode=keyMode==='browse'?'build':'browse';renderApp('keystone')">${keyMode==="browse"?"Build your own":"Browse"}</button></div>` +
  `<div class="apbody" id="keyBody"></div>`;
  const kb=$("#keyBody");
  if (keyMode==="build"){
    kb.innerHTML = `<div class="hoodhead"><h3>Design & build</h3><span>${esc(T.city)} area</span></div>
    <label class="flabel">Area (buys the land)</label>
    <select id="bHood" class="field">${T.hoods.map((h,i)=>`<option value="${i}">${esc(h[0])}</option>`).join("")}</select>
    <label class="flabel">Lot size (acres)</label>
    <select id="bLot" class="field">${[0.15,0.25,0.5,0.75,1,1.5,2,3,5,10].map(a=>`<option value="${a}">${a} acres</option>`).join("")}</select>
    <label class="flabel">Bedrooms</label><select id="bBeds" class="field">${[3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n=>`<option>${n}</option>`).join("")}</select>
    <label class="flabel">Bathrooms</label><select id="bBaths" class="field">${[2,3,4,5,6,7,8,9,10,11,12,13,14].map(n=>`<option>${n}</option>`).join("")}</select>
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
    <button class="veh-row light" onclick="renderApp('keystone',{h:'${H2.id}'})">
      <span class="vr-l"><b>${esc(H2.addr)}</b><small>${H2.beds} bd · ${H2.baths} ba · ${H2.sq.toLocaleString()} sqft · ${H2.lot} ac · ${esc(H2.kind)}</small></span>
      <span class="vr-r">${fm(H2.price)}</span></button>`).join("");
  }
  kb.innerHTML=html;
};
function priceBuild(){
  const T=D.METROS[S.blob.player.team]||D.METROS["Jets"];
  const hood=T.hoods[+$("#bHood").value]; const lot=+$("#bLot").value;
  const beds=+$("#bBeds").value, baths=+$("#bBaths").value, sq=+$("#bSq").value, fin=+$("#bFin").value;
  if(!sq||sq<800) return toast("Square footage too small to permit.");
  const infl=Math.pow(1.035, Math.max(0,(S.blob.clock.seasonYear||2026)-2026));
  const lshare = Math.min(0.85, Math.max(0.12, 0.2 + 0.18*Math.log(hood[1]) + 0.25*Math.min(1, 0.15/Math.max(hood[2],0.02))));
  const perAcre = hood[1]*1e6*lshare/Math.max(hood[2],0.02);
  const typ = hood[2];
  const eff = lot<=typ? lot : typ + (lot-typ)*0.88; // slight bulk discount past typical
  const land=Math.round(infl*perAcre*eff/5000)*5000;
  if (lot > typ*20) toast("Assembling "+lot+" acres in "+hood[0].split(",")[0]+" means buying out neighbors. Priced accordingly.");
  const build=Math.round(infl*sq*(240*fin)*(1+(beds+baths)*0.012)/5000)*5000;
  const total=land+build;
  const id="build-"+Date.now();
  $("#bOut").innerHTML=`<div class="veh-detail light" style="margin-top:12px">
   <div class="vd-title" style="font-size:19px">Custom build — ${esc(hood[0])}</div>
   <div style="font-size:13px;opacity:.6;margin-bottom:8px">${beds} bd · ${baths} ba · ${sq.toLocaleString()} sqft · ${lot} acres</div>
   <div class="payline"><span>Land (${lot} ac)</span><span>${fm(land)}</span></div>
   <div class="payline"><span>Construction (${fin===1?"builder":fin===1.35?"designer":fin===1.8?"luxury":"statement"} grade)</span><span>${fm(build)}</span></div>
   <div class="payline tot"><span>Total</span><span>${fm(total)}</span></div></div>` +
   mortgageOptions(total, id, {custom:{hood:hood[0], beds, baths, sq, lot}});
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
let octF={q:"",make:"",body:"",seg:"",yr:"",max:"",sort:"az"};
RENDER.octane = (b,sub)=>{
  b.className="octane darkapp";
  const cars=genCars();
  if (sub && sub.c){
    const C=cars.find(x=>x.id===sub.c);
    b.innerHTML=aphead("Octane",{back:"renderApp('octane')",backlabel:"Inventory"})+`<div class="apbody">
    <div class="veh-detail">
      <div class="vd-title">${C.yr} ${esc(C.make)}<br>${esc(C.model)}</div>
      <div class="vd-price">${fm(C.price)}</div>
      <div class="payline"><span>Mileage</span><span>${C.mi.toLocaleString()} mi</span></div>
      <div class="payline"><span>Body</span><span style="text-transform:capitalize">${esc(C.body)}</span></div>
      <div class="payline"><span>Class</span><span style="text-transform:capitalize">${esc(C.seg)}</span></div>
      <div class="payline"><span>Est. insurance</span><span>${fm(Math.round(C.price*0.00045*12)+1400)}/yr</span></div>
      <div class="payline"><span>Est. maintenance</span><span>${fm(Math.round(C.price*(C.seg==="hyper"||C.seg==="exotic"?0.035:0.012)))}/yr</span></div>
    </div>
    ${finOptions(C)}</div>`;
    return;
  }
  const makes=[...new Set(D.CARDATA.map(x=>x[0]))].sort();
  const yrs=[...new Set(cars.map(c=>c.yr))].sort((a,b)=>b-a);
  b.innerHTML = `<div class="brandhead oct"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">◉</div><div><h1>Octane</h1><small>Every make. Every year.</small></div>${S.garage.length?`<button class="hact" style="margin-left:auto;color:#ffb35c" onclick="garSheet()">Garage (${S.garage.length})</button>`:""}</div>` +
  `<div class="filters">
    <input placeholder="Search" value="${esc(octF.q)}" oninput="octF.q=this.value;octList()">
    <select onchange="octF.make=this.value;octList()"><option value="">All makes</option>${makes.map(m=>`<option ${octF.make===m?"selected":""}>${m}</option>`).join("")}</select>
    <select onchange="octF.body=this.value;octList()"><option value="">All bodies</option>${["sedan","coupe","suv","truck","convertible","hatchback","wagon","van"].map(m=>`<option ${octF.body===m?"selected":""}>${m}</option>`).join("")}</select>
    <select onchange="octF.seg=this.value;octList()"><option value="">All classes</option>${["economy","mainstream","premium","luxury","performance","exotic","hyper"].map(m=>`<option ${octF.seg===m?"selected":""}>${m}</option>`).join("")}</select>
    <select onchange="octF.yr=this.value;octList()"><option value="">Any year</option>${yrs.map(y=>`<option ${octF.yr==y?"selected":""}>${y}</option>`).join("")}</select>
    <select onchange="octF.max=this.value;octList()"><option value="">Any price</option><option value="30000">Under $30k</option><option value="60000">Under $60k</option><option value="120000">Under $120k</option><option value="300000">Under $300k</option><option value="1000000">Under $1M</option><option value="99999999">No limit</option></select>
    <select onchange="octF.sort=this.value;octList()"><option value="az">Make A-Z</option><option value="plo" ${octF.sort==="plo"?"selected":""}>Price: low</option><option value="phi" ${octF.sort==="phi"?"selected":""}>Price: high</option><option value="new" ${octF.sort==="new"?"selected":""}>Year: newest</option></select>
  </div>
  <div class="oct-count" id="octCount"></div>
  <div class="apbody flush" id="octList" style="padding:0 16px 28px"></div>`;
  octList();
};
function octFilter(cars){
  return cars.filter(c=> (!octF.q || (c.make+" "+c.model).toLowerCase().includes(octF.q.toLowerCase()))
    && (!octF.make||c.make===octF.make) && (!octF.body||c.body===octF.body)
    && (!octF.seg||c.seg===octF.seg) && (!octF.yr||c.yr===+octF.yr) && (!octF.max||c.price<=+octF.max));
}
function octList(){
  const cars=genCars();
  let list=octFilter(cars);
  if (octF.sort==="plo") list.sort((a,b)=>a.price-b.price);
  else if (octF.sort==="phi") list.sort((a,b)=>b.price-a.price);
  else if (octF.sort==="new") list.sort((a,b)=>b.yr-a.yr||a.price-b.price);
  else list.sort((a,b)=>a.make.localeCompare(b.make)||a.model.localeCompare(b.model)||b.yr-a.yr);
  $("#octCount")&&($("#octCount").textContent=list.length+" vehicles in inventory");
  const el=$("#octList"); if(!el) return;
  let html=""; let lastMake="";
  for (const C of list.slice(0,140)){
    if (octF.sort==="az" && C.make!==lastMake){ lastMake=C.make; html+=`<div class="oct-make">${esc(C.make)}</div>`; }
    html+=`<button class="veh-row" onclick="renderApp('octane',{c:'${C.id}'})">
      <span class="vr-l"><b>${C.yr} ${esc(C.make)} ${esc(C.model)}</b><small>${C.mi.toLocaleString()} mi · ${esc(C.body)} · ${esc(C.seg)}</small></span>
      <span class="vr-r">${fm(C.price)}</span></button>`;
  }
  if (list.length>140) html+=`<div class="empty">Showing 140 of ${list.length}. Tighten the filters.</div>`;
  el.innerHTML=html || '<div class="empty">Nothing matches. Loosen a filter.</div>';
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
    const dock=Y.len*450, mx=Math.round(Y.price*0.08);
    b.innerHTML=aphead("Harborline",{back:"renderApp('yachts')",backlabel:"Brokerage"})+`<div class="apbody">
    <div class="veh-detail light">
      <div class="vd-title">${Y.yr} ${esc(Y.maker)}<br>${esc(Y.model)}</div>
      <div class="vd-price">${fmk(Y.price)}</div>
      <div class="payline"><span>Length</span><span>${Y.len} ft</span></div>
      <div class="payline"><span>Type</span><span style="text-transform:capitalize">${esc(Y.type)}</span></div>
      <div class="payline"><span>Engine hours</span><span>${Y.hrs.toLocaleString()}</span></div>
      <div class="payline"><span>Dockage & storage</span><span>${fm(dock)}/yr</span></div>
      <div class="payline"><span>Maintenance & crew</span><span>${fm(mx)}/yr</span></div>
      <div class="payline tot"><span>All-in upkeep</span><span>${fm(Math.round((dock+mx)/12))}/mo</span></div>
    </div>
    <button class="btn" style="background:var(--yct-acc);color:#fff;margin-top:10px" onclick='buyBoat("${Y.id}")'>Buy — ${fmk(Y.price)}</button></div>`;
    return;
  }
  const groups=["fishing","dayboat","wake","cruiser","sport","flybridge","sportfish","catamaran","classic","superyacht"];
  b.innerHTML = `<div class="brandhead yct"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">⚓</div><div><h1>Harborline</h1><small>Yacht brokerage since 1958</small></div></div><div class="apbody">` + groups.map(g=>{
    const rows=boats.filter(x=>x.type===g); if(!rows.length) return "";
    return `<div class="hoodhead"><h3 style="text-transform:capitalize">${g==="sportfish"?"Sportfishing":g}</h3><span>${rows.length} vessels</span></div>` +
    rows.map(Y=>`<button class="veh-row light" onclick="renderApp('yachts',{y:'${Y.id}'})">
      <span class="vr-l"><b>${Y.yr} ${esc(Y.maker)} ${esc(Y.model)}</b><small>${Y.len} ft · ${Y.hrs} hrs · upkeep ${fm(Math.round((Y.len*450+Y.price*0.08)/12))}/mo</small></span>
      <span class="vr-r">${fmk(Y.price)}</span></button>`).join("");
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
    const fixed=Math.round(P.price*0.06), hourly=Math.round(1200+P.price/25000);
    b.innerHTML=aphead("Stratos Air",{back:"renderApp('planes')",backlabel:"Hangar"})+`<div class="apbody">
    <div class="veh-detail">
      <div class="vd-title">${P.yr} ${esc(P.maker)}<br>${esc(P.model)}</div>
      <div class="vd-price">${fmk(P.price)}</div>
      <div class="payline"><span>Class</span><span style="text-transform:capitalize">${esc(P.cls)}</span></div>
      <div class="payline"><span>Seats</span><span>${P.seats}</span></div>
      <div class="payline"><span>Airframe hours</span><span>${P.hrs.toLocaleString()}</span></div>
      <div class="payline"><span>Crew, hangar, insurance</span><span>${fm(fixed)}/yr</span></div>
      <div class="payline"><span>Direct cost per flight hour</span><span>${fm(hourly)}</span></div>
      <div class="payline tot"><span>Fixed upkeep</span><span>${fm(Math.round(fixed/12))}/mo</span></div>
    </div>
    <button class="btn" style="background:var(--pln-acc);color:#0e1420;margin-top:10px" onclick='buyPlane("${P.id}")'>Acquire — ${fmk(P.price)}</button>
    <p style="font-size:12px;color:var(--faint);margin-top:10px">Charter tiers arrive next iteration. Whole ownership only, like a maniac.</p></div>`;
    return;
  }
  b.innerHTML = `<div class="brandhead pln"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">✈</div><div><h1>Stratos Air</h1><small>Private aviation, whole ownership</small></div></div><div class="apbody">` +
  ["piston","vlj","turboprop","light","midsize","super-mid","large","ultra","bizliner"].map(g=>{
    const rows=planes.filter(x=>x.cls===g); if(!rows.length) return "";
    const label={piston:"Piston",vlj:"Very Light Jets",turboprop:"Turboprops",light:"Light Jets",midsize:"Midsize",["super-mid"]:"Super-Midsize",large:"Large Cabin",ultra:"Ultra Long Range",bizliner:"Bizliners"}[g];
    return `<div class="hoodhead" style="color:var(--ink)"><h3>${label}</h3><span style="color:var(--faint)">${rows.length} aircraft</span></div>` +
    rows.map(P=>`<button class="veh-row" onclick="renderApp('planes',{p:'${P.id}'})">
      <span class="vr-l"><b>${P.yr} ${esc(P.maker)} ${esc(P.model)}</b><small>${P.seats} seats · ${P.hrs} hrs · fixed ${fm(Math.round(P.price*0.06/12))}/mo</small></span>
      <span class="vr-r">${fmk(P.price)}</span></button>`).join("");
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
RENDER.apex = (b,sub)=>{
  b.className="apex lightapp";
  if (sub && sub.a){
    const A=D.AGENTS.find(x=>x.id===sub.a);
    const mine = S.agent && S.agent.id===A.id;
    const bar = v=>`<span class="agbar"><i style="width:${v*10}%"></i></span>`;
    b.innerHTML = aphead("Apex Sports Group",{back:"renderApp('apex')",backlabel:"Agents"}) + `<div class="apbody">
    <div class="veh-detail light">
      <div class="vd-title">${esc(A.n)}</div>
      <div style="font-size:13px;opacity:.6;margin:-2px 0 10px">Age ${A.age} · ${A.yrs} years experience · takes ${A.fee.toFixed(2)}% of playing contracts</div>
      <div class="payline"><span>Contract negotiation<br><small style="opacity:.55">How much money he squeezes out of a front office</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.neg)}<b>${A.neg}/10</b></span></div>
      <div class="payline"><span>Endorsement reach<br><small style="opacity:.55">Which brands pick up when he calls</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.end)}<b>${A.end}/10</b></span></div>
      <div class="payline"><span>Aggressiveness<br><small style="opacity:.55">High wins fights and burns bridges; low keeps doors open</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.agg)}<b>${A.agg}/10</b></span></div>
      <div class="payline"><span>Takes on</span><span style="max-width:55%;text-align:right;font-size:12.5px">${esc(A.willing)}</span></div>
      <p style="font-size:13.5px;line-height:1.55;opacity:.8;margin-top:10px">${esc(A.style)}</p>
    </div>
    ${mine? `<button class="btn" style="background:#e8e2d4;color:#6d5a1f" disabled>Your current agent</button>` :
      `<button class="btn" style="background:var(--apx-acc);color:#fff" onclick="signAgent('${A.id}')">${S.agent? "Switch to "+esc(A.n.split(" ")[0]) : "Sign with "+esc(A.n.split(" ")[0])}</button>`}
    <p style="font-size:12px;opacity:.55;margin-top:8px">The fee comes out of every playing check. Switching mid-relationship is legal, common, and remembered.</p></div>`;
    return;
  }
  b.innerHTML = `<div class="brandhead apx"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">AX</div><div><h1>Apex Sports Group</h1><small>Representation for the whole career</small></div></div><div class="apbody">
    <div class="hoodhead"><h3>${S.agent? "Your representation" : "Choose your representation"}</h3></div>
    ${S.agent? `<div class="veh-detail light" style="margin-bottom:14px"><div class="vd-title" style="font-size:19px">${esc(S.agent.n)}</div>
      <div style="font-size:13px;opacity:.6">${S.agent.fee.toFixed(2)}% of playing contracts · negotiating ${S.agent.neg}/10 · endorsements ${S.agent.end}/10</div></div>` :
      `<p style="font-size:13.5px;line-height:1.55;opacity:.75;margin-bottom:14px">Twelve agents at Apex have your camp tape. Every one of them takes a different cut, negotiates differently, and opens different doors. Nothing moves on contracts or endorsements until you pick one.</p>`}
    <div class="hoodhead"><h3>The Roster</h3><span>12 agents at Apex</span></div>
    ${D.AGENTS.map(A=>`<button class="veh-row light" onclick="renderApp('apex',{a:'${A.id}'})">
      <span class="vr-l"><b>${esc(A.n)} ${S.agent&&S.agent.id===A.id?"· ✓ yours":""}</b><small>Negotiation ${A.neg}/10 · Endorsements ${A.end}/10 · Fee ${A.fee.toFixed(2)}%</small></span>
      <span class="vr-r" style="font-size:12px;opacity:.6">${A.yrs} years experience</span></button>`).join("")}
    <div class="hoodhead" style="margin-top:16px"><h3>Endorsement pipeline</h3><span>updates at sync</span></div>
    <div class="veh-detail light" style="margin-bottom:10px"><div class="vd-title" style="font-size:17px">Crestline Automotive — regional ambassador</div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 6px">$120,000/yr + vehicle · requires active-roster status.${S.agent? " "+esc(S.agent.n.split(" ")[0])+"'s note: sit tight, do not buy anything stupid." : " No agent on file to work the clause."}</div>
      <div style="font-size:12px;opacity:.5">On hold · arrival clause · autos exclusivity</div></div>
    <div class="veh-detail light" style="margin-bottom:10px"><div class="vd-title" style="font-size:17px">Florham Park Deli — name & likeness</div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 8px">$4,500 flat for a sandwich named after you. The "Number Zero": chicken cutlet, vodka sauce, fresh mozz.</div>
      ${S.deals.find(d=>d.id==="deli")? '<div style="font-size:13px;color:#2e7d32">Signed. The sandwich is in rotation.</div>' :
      `<button class="btn sm" style="background:var(--apx-acc);color:#fff" onclick="signDeli()">${S.agent? "Sign it — $4,500" : "Need an agent first"}</button>`}</div>
    <div class="hoodhead" style="margin-top:16px"><h3>Contract status</h3><span>from the save</span></div>
    <div class="veh-detail light">
      <div class="payline"><span>${esc(S.blob.player.team)}</span><span>${esc(S.blob.player.status==="PracticeSquad"?"Practice Squad":S.blob.player.status)}</span></div>
      <div class="payline"><span>PS weekly</span><span>${fm(psWeekly())}</span></div>
      <div class="payline"><span>Active contract on file</span><span>${fm((S.blob.player.contract?.salary?.[0])||S.blob.player.capSalary)}/yr</span></div>
      <div class="payline"><span>Elevations used</span><span>0 of 3</span></div></div>
  </div>`;
};
function signAgent(id){
  const A=D.AGENTS.find(x=>x.id===id);
  const prev=S.agent;
  S.agent={id:A.id,n:A.n,fee:A.fee,neg:A.neg,end:A.end,agg:A.agg};
  persist();
  toast(prev? A.n.split(" ")[0]+" it is. "+prev.n.split(" ")[0]+" will hear about it." : "Signed with "+A.n+".");
  renderApp('apex');
}
/* Contacts */
RENDER.contacts = b=>{
  b.className="settings darkapp";
  const roster=S.blob.roster;
  const world=[["Mom","Family","#5a3a56","mom"],["Mara Quinn","Personal assistant","#7a4a2e","mara"],[(S.agent?S.agent.n:"Apex Front Desk"),"Agent — Apex","#6b5b2a","agent"],["Marcus Ellery","United Chronicle","#1160a8","ellery"],["Equipment Room","Team ops","#31404f","equip"]];
  b.innerHTML = aphead("Contacts") + `<div class="apbody flush">
  <div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Your world</h3></div>` +
  world.map(w=>`<button class="contact" style="width:100%;text-align:left" onclick="textContact('${w[3]}','${esc(w[0]).replace(/'/g,"\\'")}','${w[2]}')"><span class="av" style="background:${w[2]}">${initials(w[0])}</span><div><h4>${esc(w[0])}</h4><p>${esc(w[1])}</p></div></button>`).join("") +
  `<div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Locker room · ${roster.length}</h3></div>` +
  roster.map(r=>{const nm=r[0]+" "+r[1]; const id="p"+(r[0]+r[1]).replace(/\W/g,"").toLowerCase();
   return `<button class="contact" style="width:100%;text-align:left" onclick="textContact('${id}','${esc(nm).replace(/'/g,"\\'")}','${avColor(nm)}')"><span class="av" style="background:${avColor(nm)}">${initials(nm)}</span><div><h4>${esc(nm)}</h4><p>${esc(r[2])} · #${r[4]}${r[5]==="PracticeSquad"?" · PS":""}</p></div></button>`;}).join("") + `</div>`;
};
function textContact(id, name, color){
  let t=S.world.texts.find(x=>x.id===id);
  if (!t){ t={id, name, color, msgs:[]}; S.world.texts.unshift(t); persist(); }
  openApp("messages"); renderApp("messages",{thread:id});
}
/* Card */
RENDER.card = b=>{
  b.className="cardapp";
  const min=Math.max(35, S.credit.cardBal*0.03);
  b.innerHTML = aphead("Credit Card") +
  `<div class="thecard"><div style="display:flex;justify-content:space-between"><span class="tn">MERIDIAN CREDIT</span><span style="color:#9aa2ac;font-size:11px">WORLD ELITE</span></div>
   <div class="num">•••• •••• •••• ${S.last4||"4417"}</div>
   <div class="bot"><span>${esc((S.blob.player.first+" "+S.blob.player.last).toUpperCase())}</span><span>EXP 08/29</span></div></div>
  <div class="apbody">
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Balance <span>limit ${fm(S.credit.cardLimit)} · ${S.credit.cardApr}% APR</span></h4>
    <b style="font-size:30px" class="mono">${fmc(S.credit.cardBal)}</b>
    ${S.credit.cardBal>0?`<div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn sm" style="background:#cfd6df;color:#17191d" onclick="payCard(${min})">Pay minimum ${fm(min)}</button>
      <button class="btn sm" style="background:rgba(207,214,223,.15);color:#cfd6df" onclick="payCard(${S.credit.cardBal})">Pay in full</button></div>`:
      `<div style="font-size:13px;color:var(--dim);margin-top:6px">Zero balance. Spend anywhere in-world and it lands here; autopay pulls the minimum monthly.</div>`}</div>
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Statement</h4>` +
  (S.cardTx.length? S.cardTx.slice(-12).reverse().map(t=>`<div class="payline"><span>${esc(t.n)}</span><span>${fm(t.amt)}</span></div>`).join("") : `<div style="font-size:13px;color:var(--dim)">No activity.</div>`) + `</div></div>`;
};
function payCard(amt){
  amt=Math.min(amt, S.credit.cardBal);
  if (S.cash.checking<amt) return toast("Checking can't cover that payment.");
  S.cash.checking-=amt; S.credit.cardBal-=amt; creditTouch(3);
  S.ledger.push({t:"Card payment", amt:-amt, kind:"spend"});
  persist(); renderApp("card"); renderWidget(); toast("Payment posted.");
}
/* WagerLines — the book */
function teamPower(name){
  // power rating from league record if present, else seeded
  let w=0,l=0;
  if (S.blob.league){ for(const g of S.blob.league.games){ if(g.t!=="RegularSeason"||!(g.played||g.hs+g.as>0)) continue;
    if(g.h===name){ g.hs>g.as?w++:l++; } if(g.a===name){ g.as>g.hs?w++:l++; } } }
  const base = seedRng("pow"+name+(S.blob.clock.seasonYear||2026))()*6-3;
  return base + (w+l>0 ? (w-l)*1.1 : 0);
}
function gameLines(list){
  return list.map(g=>{
    const rng=seedRng(S.careerId+"|line|"+g.h+g.a+g.w);
    let spread = (teamPower(g.h)-teamPower(g.a)) + 1.8; // home edge
    spread = Math.round(spread*2)/2;
    const total = Math.round((41 + rng()*10 + Math.abs(spread)*0.3)*2)/2;
    const mlH = spread<=0? Math.round(100+Math.abs(spread)*38) : -Math.round(100+spread*38);
    return {...g, spread, total, mlH, mlA: mlH>0? -Math.round(mlH*0.9) : Math.round(Math.abs(mlH)*0.84)};
  });
}
RENDER.wager = b=>{
  b.className="wager darkapp";
  const wkNow=S.blob.clock.week, tp=S.blob.clock.weekType;
  let games;
  if (S.blob.league && S.blob.league.games.length){
    games = S.blob.league.games.filter(g=>g.t===tp && g.w===wkNow && !(g.played||g.hs+g.as>0));
    if (!games.length) games = S.blob.league.games.filter(g=>g.t===tp && g.w===wkNow+ (tp==="PreSeason"?0:0)+0);
    if (!games.length) games = S.blob.league.games.filter(g=>g.t===tp && g.w===wkNow);
  } else {
    const n=nextGame();
    games = n? [{w:n[0], t:n[1], h:n[4]?S.blob.player.team:n[3], a:n[4]?n[3]:S.blob.player.team, hs:0, as:0}] : [];
  }
  const lines = gameLines(games);
  const mine = S.blob.player.team;
  b.innerHTML = `<div class="brandhead wgr"><div class="bh-mark">W/</div><div><h1>WagerLines</h1><small>Lines move. Discipline doesn't.</small></div></div>
  <div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>${tp==="PreSeason"?"Preseason":"Week"} ${wkNow+1} board</h3><span style="color:var(--faint)">${lines.length} games</span></div>
  ${lines.map((g,i)=>`<div class="veh-detail" style="margin-bottom:10px;${(g.h===mine||g.a===mine)?"border-color:rgba(127,212,160,.4)":""}">
    <div class="payline" style="border:none;padding:2px 0"><span><b>${esc(g.a)}</b> at <b>${esc(g.h)}</b>${(g.h===mine||g.a===mine)?' <span style="color:#7fd4a0;font-size:11px">YOUR GAME</span>':""}</span></div>
    <div class="payline"><span>Spread</span><span>${g.spread===0? "PK (pick em)" : esc(g.h)+" "+(g.spread>0?"-":"+")+Math.abs(g.spread).toFixed(1)}</span></div>
    <div class="payline"><span>Total</span><span>O/U ${g.total.toFixed(1)}</span></div>
    <div class="payline"><span>Moneyline</span><span>${esc(g.h)} ${g.mlH>0?"+":""}${g.mlH} · ${esc(g.a)} ${g.mlA>0?"+":""}${g.mlA}</span></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="betSheet(${i},'h')">${esc(g.h)}</button>
      <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="betSheet(${i},'a')">${esc(g.a)}</button>
    </div></div>`).join("") || '<div class="empty">No lines this week. Books are closed.</div>'}
  ${S.bets && S.bets.length? `<div class="hoodhead" style="color:var(--ink)"><h3>Open tickets</h3></div>
   ${S.bets.map(bt=>`<div class="veh-detail" style="margin-bottom:8px"><div class="payline" style="border:none"><span>${esc(bt.label)}</span><span>${fm(bt.stake)}${bt.settled? (bt.won?' <b style="color:#7fd4a0">WON '+fm(bt.pay)+'</b>':' <b style="color:#ff9d94">LOST</b>'):""}</span></div></div>`).join("")}`:""}
  <p style="font-size:11px;color:var(--faint);margin-top:14px">Lines are the book's opinion of your world, generated from real records in the save. Tickets settle when the week's results sync in. League policy on players betting is a story mechanic for another day.</p>
  </div>`;
  window._wlines = lines;
};
function betSheet(i, side){
  const g=window._wlines[i];
  const team = side==="h"? g.h : g.a;
  const line = side==="h"? (g.spread>0?"-":"+")+Math.abs(g.spread).toFixed(1) : (g.spread>0?"+":"-")+Math.abs(g.spread).toFixed(1);
  sheet(`<h3>${esc(team)} ${line}</h3><p class="sp">Against the spread, standard -110. Stake comes out of checking now; pays at sync when the result is in.</p>
  <input class="field" type="number" id="betAmt" placeholder="Stake ($)">
  <button class="btn" style="background:#2b6b4f;color:#fff" onclick="placeBet(${i},'${side}')">Place bet</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function placeBet(i, side){
  const g=window._wlines[i]; const amt=+$("#betAmt").value;
  if(!amt||amt<10) return toast("Minimum $10.");
  if(S.cash.checking<amt) return toast("Stake exceeds checking.");
  S.cash.checking-=amt;
  S.bets=S.bets||[];
  const team = side==="h"? g.h : g.a;
  const line = side==="h"? -g.spread : g.spread;
  S.bets.push({w:g.w, t:g.t, h:g.h, a:g.a, side, line, stake:amt, label:team+" "+(line>0?"+":"")+line.toFixed(1)+" vs "+(side==="h"?g.a:g.h), settled:false});
  S.ledger.push({t:"WagerLines stake — "+team, amt:-amt, kind:"spend"});
  persist(); closeSheet(); renderApp("wager"); toast("Ticket booked.");
}
function settleBets(){
  if (!S.bets || !S.blob.league) return;
  for (const bt of S.bets){
    if (bt.settled) continue;
    const g = S.blob.league.games.find(x=>x.t===bt.t && x.w===bt.w && x.h===bt.h && x.a===bt.a && (x.played||x.hs+x.as>0));
    if (!g) continue;
    const margin = g.hs - g.as; // home margin
    const cover = bt.side==="h" ? (margin + bt.line > 0) : (-margin + bt.line > 0);
    bt.settled=true; bt.won=cover;
    if (cover){ bt.pay=Math.round(bt.stake*(1+100/110)); S.cash.checking+=bt.pay;
      S.ledger.push({t:"WagerLines payout — "+bt.label, amt:bt.pay, kind:"income"}); }
  }
}

/* Mara — personal assistant */
RENDER.assist = b=>{
  b.className="assist darkapp";
  S.assistTiers = S.assistTiers || D.ASSIST.cats.map(_=>0);
  const total = D.ASSIST.cats.reduce((a,c,i)=>a+c[1][S.assistTiers[i]][1],0);
  b.innerHTML = `<div class="brandhead ast"><div class="bh-mark">MQ</div><div><h1>Mara Quinn</h1><small>${esc(D.ASSIST.title)}</small></div></div>
  <div class="apbody">
  <p style="font-size:13px;color:var(--faint);line-height:1.55;margin-bottom:12px">I track how you actually live so the bank account stops being a surprise. Pick a lane per category; it lands in your monthly burn and Meridian sees it immediately. Text me from Messages if something changes.</p>
  ${D.ASSIST.cats.map((c,i)=>`<div class="hoodhead" style="color:var(--ink)"><h3>${esc(c[0])}</h3><span style="color:var(--faint)">${fm(c[1][S.assistTiers[i]][1])}/mo</span></div>
  <select class="field" onchange="setAssist(${i},+this.value)">${c[1].map((t,n)=>`<option value="${n}" ${S.assistTiers[i]===n?"selected":""}>${esc(t[0])} · ${t[1]?fm(t[1])+"/mo":"free"}</option>`).join("")}</select>`).join("")}
  <div class="veh-detail" style="margin-top:14px">
    <div class="payline"><span>Lifestyle total</span><span>${fm(total)}/mo</span></div>
    <div class="payline"><span>Fixed bills</span><span>${fm(S.bills.reduce((a,x)=>a+x.amt,0))}/mo</span></div>
    <div class="payline tot"><span>Total monthly burn</span><span>${fm(monthlyBurn())}/mo</span></div>
  </div>
  </div>`;
};
function setAssist(i, v){
  S.assistTiers[i]=v; persist(); renderApp("assist"); renderWidget();
  toast("Noted. "+D.ASSIST.cats[i][1][v][0]+".");
}
function assistMonthly(){
  if (!S.assistTiers) return 0;
  return D.ASSIST.cats.reduce((a,c,i)=>a+c[1][S.assistTiers[i]||0][1],0);
}

/* Podium — podcasts */
RENDER.podium = b=>{
  b.className="podium darkapp";
  const P=S.world.podium;
  b.innerHTML = `<div class="brandhead pod"><button class="back" onclick="closeApp()">‹</button><div class="bh-mark">🎙</div><div><h1>Podium</h1><small>${esc(P.show)} · ${esc(P.hosts)}</small></div></div>
  <div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>Episodes</h3></div>
  ${P.eps.map(e=>`<div class="veh-detail" style="margin-bottom:10px">
    <div class="vd-title" style="font-size:16px;line-height:1.3">${esc(e.t)}</div>
    <div style="font-size:12px;opacity:.55;margin:4px 0 8px">${esc(e.dur||"")}${e.link?` · <a href="${esc(e.link)}" target="_blank" style="color:#9db8ff">listen ↗</a>`:""}</div>
    <p style="font-size:13px;line-height:1.5;opacity:.8">${esc(e.d)}</p>
    ${e.script?`<button class="btn sm" style="background:rgba(255,255,255,.1);margin-top:8px" onclick="showScript('${e.id}')">Read the brief</button>`:""}
  </div>`).join("")}
  <div class="hoodhead" style="color:var(--ink);margin-top:16px"><h3>Make this week's episode</h3></div>
  <div class="veh-detail">
    <p style="font-size:13px;line-height:1.55;opacity:.8">The pipeline: 1) Generate the episode brief here (uses your AI engine). 2) Open <b>notebooklm.google.com</b>, new notebook, paste the brief as a source. 3) Hit Audio Overview; two hosts argue about your week for ten minutes. 4) Paste the share link back here so the episode lives in the feed.</p>
    <button class="btn" style="background:#4a3a76;color:#fff;margin-top:10px" onclick="genEpisodeBrief()">Generate episode brief</button>
    <input class="field" id="epLink" placeholder="Paste NotebookLM share link" style="margin-top:8px">
    <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="attachEpLink()">Attach link to latest episode</button>
    <label class="flabel" style="margin-top:12px">Google API key (for future direct NotebookLM automation)</label>
    <input class="field" type="password" placeholder="AIza..." value="${esc((META.settings.keys&&META.settings.keys.google)||"")}" onchange="META.settings.keys=META.settings.keys||{};META.settings.keys.google=this.value.trim();saveMeta();toast('Google key saved.')">
  </div>
  </div>`;
};
function showScript(id){
  const e=S.world.podium.eps.find(x=>x.id===id);
  window._brief=e.script;
  sheet(`<h3 style="font-size:16px">${esc(e.t)}</h3><div style="max-height:50vh;overflow:auto;font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(e.script)}</div>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="navigator.clipboard.writeText(window._brief).then(()=>toast('Copied for NotebookLM.'))">Copy brief</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}
async function genEpisodeBrief(){
  if (!aiKey()) return toast("Add an API key first (Settings).");
  toast("Writing the brief…");
  try{
    const last = S.blob.schedule.filter(g=>g[7]).pop();
    const out = await callAI(
      "You write a detailed podcast episode brief for a fictional NFL talk show called "+S.world.podium.show+" hosted by "+S.world.podium.hosts+". League-wide stories first; the player's storyline earns a segment near the end, proportionate to his actual profile. Grounded, specific, funny in places. No em dashes. 600-900 words, formatted as segment blocks with timestamps.",
      worldFacts(S.blob, last)+"\nWrite this week's episode brief now.", 3000);
    const ep={id:"ep"+Date.now(), t:"Ep. "+(41+S.world.podium.eps.length)+", "+wkLabel(S.blob.clock), dur:"", d:out.split("\n").find(l=>l.trim().length>40)||"This week's episode.", script:out};
    S.world.podium.eps.unshift(ep); persist(); renderApp("podium"); toast("Brief ready. Feed it to NotebookLM.");
  }catch(e){ toast("Generation failed: "+e.message); }
}
function attachEpLink(){
  const v=$("#epLink").value.trim(); if(!v) return;
  S.world.podium.eps[0].link=v; persist(); renderApp("podium"); toast("Episode linked.");
}
/* Settings */
const COLLEGE_TIERS = {elite:["Ohio State","Michigan","Alabama","Georgia","Texas","Oregon","Notre Dame","USC","Penn State","LSU","Clemson","Florida State","Oklahoma","Tennessee","Ole Miss"], mid:["Louisville","Iowa","Kansas State","Utah","UCF","Boise State","Memphis","Tulane","Appalachian State","Toledo","Marshall","San Diego State"], small:["Howard","Monmouth","Villanova","North Dakota State","Montana","Yale","Fordham","Lehigh","Grambling State","Jackson State"]};
function collegePrestige(name){
  if(!name) return "unknown";
  if(COLLEGE_TIERS.elite.some(c=>name.includes(c))) return "blue blood";
  if(COLLEGE_TIERS.small.some(c=>name.includes(c))) return "small school";
  return "mid-tier";
}
function autoReputation(){
  const p=S.blob.player, pc=S.perception;
  if (p.yearsPro>=6) return "Established veteran";
  if (p.yearsPro>=2) return "Known quantity";
  const d=pc.draft||"Undrafted free agent";
  if (d==="First rounder") return "Polarizing and watched";
  if (d==="Day 2 pick") return "Hyped and doubted";
  if (d==="Day 3 pick"||d==="Seventh round flier") return "Camp curiosity";
  return "Complete unknown";
}
function startingCash(pc){
  const draft={"First rounder":900000,"Day 2 pick":220000,"Day 3 pick":60000,"Seventh round flier":22000,"Undrafted free agent":4000}[pc.draft||"Undrafted free agent"];
  const famM={"Single parent household":0.6,"Both parents, tight money":0.8,"Middle class, stable":1.1,"Family is comfortable":1.6,"It's complicated":0.9}[pc.family||"Single parent household"];
  const nil={"blue blood":45000,"mid-tier":12000,"small school":2000,"unknown":5000}[collegePrestige(pc.collegeName)]||5000;
  return Math.round((draft*famM+nil)/250)*250;
}
RENDER.settings = b=>{
  b.className="settings darkapp";
  const pc = S.perception;
  const dd = (id,opts,cur)=>`<select id="${id}" class="field" onchange="savePerception()">${opts.map(o=>`<option ${o===cur?"selected":""}>${o}</option>`).join("")}</select>`;
  const prov = META.settings.provider||"anthropic";
  b.innerHTML = aphead("Settings") + `<div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>Initial information</h3></div>
  <p style="font-size:12.5px;color:var(--faint);line-height:1.5;margin-bottom:12px">Who you were before the league. The world's perception is dynamic from here: it moves with your play, your posts, and your results. Money facts still come only from the save.</p>
  <label class="flabel">Hometown state</label>${dd("pcState", D.STATES, pc.state||"NJ")}
  <label class="flabel">Where you grew up (town, area, whatever you want the world to know)</label>
  <input class="field" id="pcGrew" value="${esc(pc.grew||"")}" placeholder="e.g. Toms River, small town off the parkway" onchange="savePerception()">
  <label class="flabel">High school profile</label>${dd("pcHS", ["Unranked nobody","Local standout","State champion","National recruit"], pc.hs||"Local standout")}
  <label class="flabel">College</label>
  <input class="field" id="pcColName" value="${esc(pc.collegeName||"")}" placeholder="School name (auto-fills from the save at next sync)" onchange="savePerception()">
  <div style="font-size:11.5px;color:var(--faint);margin:-6px 0 8px">Prestige is read automatically: ${esc(collegePrestige(pc.collegeName))}.</div>
  <label class="flabel">College career</label>${dd("pcCol", ["Multi-year starter","Late-career starter","Career backup","Good career, bad ending","Poor career","Walk-on, never played"], pc.college||"Career backup")}
  <label class="flabel">Family situation</label>${dd("pcFam", ["Single parent household","Both parents, tight money","Middle class, stable","Family is comfortable","It's complicated"], pc.family||"Single parent household")}
  <label class="flabel">Monthly support you send home ($)</label>
  <input class="field" id="pcAsk" type="number" min="0" step="50" value="${pc.familyAsk||0}" onchange="savePerception()">
  <label class="flabel">Draft story</label>${dd("pcDraft", ["Undrafted free agent","Seventh round flier","Day 3 pick","Day 2 pick","First rounder"], pc.draft||"Undrafted free agent")}
  <label class="flabel">Public reputation (set by the league, not by you)</label>
  <div class="field" style="opacity:.75">${esc(autoReputation())}</div>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Debt you brought with you</h3></div>
  <p style="font-size:12px;color:var(--faint);margin:0 0 10px">Fill in what you actually owe. Credit card debt lands on the Meridian Credit card. Starting bank balance is seeded automatically from your profile (draft money, NIL, family) on new careers.</p>
  ${D.DEBTCATS.map((c,i)=>`<label class="flabel">${c} ($)</label>
   <input class="field" type="number" min="0" step="100" id="pcDebt${i}" value="${(pc.debtAmts&&pc.debtAmts[i])||0}" onchange="savePerception()">`).join("")}
  <div style="font-size:12px;color:var(--faint)">Profile-seeded starting balance for this background: <b>${fm(startingCash(pc))}</b>${S.appliedWeeks.length<=1? ` · <button class="mer-link" style="color:#7fd4a0" onclick="applySeedCash()">apply to this career</button>`:" (locked once weeks are applied)"}</div>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>AI world engine</h3></div>
  <label class="flabel">Provider</label>
  <select class="field" onchange="META.settings.provider=this.value;saveMeta();renderApp('settings')">${Object.keys(D.AI).map(k=>`<option value="${k}" ${prov===k?"selected":""}>${D.AI[k].label}</option>`).join("")}</select>
  <label class="flabel">Model</label>
  <select class="field" onchange="META.settings.model=this.value;saveMeta()">${D.AI[prov].models.map(m=>`<option ${META.settings.model===m?"selected":""}>${m}</option>`).join("")}</select>
  <label class="flabel">${D.AI[prov].label} API key</label>
  <input class="field" type="password" placeholder="${D.AI[prov].keyHint}" value="${esc((META.settings.keys&&META.settings.keys[prov])||"")}" onchange="META.settings.keys=META.settings.keys||{};META.settings.keys['${prov}']=this.value.trim();saveMeta();toast('Key saved.')">
  <label class="flabel" style="display:flex;justify-content:space-between;align-items:center">Auto-generate week content on sync
  <input type="checkbox" ${META.settings.autogen?"checked":""} onchange="META.settings.autogen=this.checked;saveMeta()"></label>
  <p style="font-size:11.5px;color:var(--faint)">Podcast generation and the NotebookLM pipeline live in the Podium app.</p>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Phone</h3></div>
  <label class="flabel" style="display:flex;justify-content:space-between;align-items:center">App theme
  <select class="field" style="width:auto;margin:0" onchange="META.settings.theme=this.value;saveMeta();applyTheme()"><option value="dark" ${META.settings.theme!=="light"?"selected":""}>Dark</option><option value="light" ${META.settings.theme==="light"?"selected":""}>Light</option></select></label>
  <label class="flabel">Phone clock</label>
  <select class="field" onchange="META.settings.clockOffsetMin=+this.value;saveMeta();clockTick()">
    ${[["0","Real time"],["-360","Evening mode (-6h)"],["-480","Game night (-8h)"],["240","+4h"],["480","+8h"],["720","+12h"]].map(o=>`<option value="${o[0]}" ${String(META.settings.clockOffsetMin||0)===o[0]?"selected":""}>${o[1]}</option>`).join("")}
  </select>
  <label class="flabel">Wallpaper</label>
  <input class="field" type="file" accept="image/*" onchange="setWallpaper(this)">
  <button class="btn" style="background:rgba(255,255,255,.08)" onclick="META.settings.wallpaper=null;saveMeta();applyWallpaper();toast('Wallpaper reset.')">Reset wallpaper</button>
  <label class="flabel">Profile photo (used on Chirper)</label>
  <input class="field" type="file" accept="image/*" onchange="setPfp(this)">

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Home screen order</h3></div>
  <p style="font-size:12px;color:var(--faint);margin:0 0 10px">Pick a slot number for each app. Saved on this phone; survives updates and refreshes.</p>
  ${APPS.map((a,i)=>{const cur=(META.settings.appOrder&&META.settings.appOrder[a.id])??i;return `<label class="flabel" style="display:flex;justify-content:space-between;align-items:center">${a.n}
   <select class="field" style="width:76px;margin:0" onchange="META.settings.appOrder=META.settings.appOrder||{};META.settings.appOrder['${a.id}']=+this.value;saveMeta();renderHome()">${APPS.map((_,n)=>`<option value="${n}" ${cur===n?"selected":""}>#${n+1}</option>`).join("")}</select></label>`}).join("")}

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Career</h3></div>
  <button class="btn" style="background:rgba(255,255,255,.08)" onclick="location.hash='#debug';location.reload()">Debug readout</button>
  <button class="btn" style="background:rgba(244,100,92,.15);color:#ff9d94" onclick="resetCareer()">Reset this career</button>
  </div>`;
};
function applySeedCash(){
  const target=startingCash(S.perception);
  S.cash.checking=target;
  S.ledger=S.ledger.filter(l=>l.kind!=="seed");
  S.ledger.push({t:"Starting balance (profile seed)", amt:target, kind:"seed"});
  persist(); toast("Starting balance set to "+fm(target)+"."); renderApp("settings"); renderWidget();
}
function savePerception(){
  const pc=S.perception;
  const gv=id=>{const el=$("#"+id);return el?el.value:null;};
  pc.state=gv("pcState")||pc.state; pc.grew=gv("pcGrew")??pc.grew; pc.hs=gv("pcHS")||pc.hs;
  pc.collegeName=gv("pcColName")??pc.collegeName;
  pc.college=gv("pcCol")||pc.college; pc.draft=gv("pcDraft")||pc.draft; pc.family=gv("pcFam")||pc.family;
  const ask=gv("pcAsk"); if(ask!==null) pc.familyAsk=Math.max(0,+ask||0);
  pc.debtAmts = D.DEBTCATS.map((_,i)=> Math.max(0, +(gv("pcDebt"+i)||0)) );
  pc.rep = autoReputation();
  // rebuild legacy debts; credit card debt goes to the card, not a loan row
  S.debts = S.debts.filter(d=>d.kind!=="legacy");
  const aprs=[5.5,0,0,7.9,11.5,0];
  D.DEBTCATS.forEach((c,i)=>{
    const bal=pc.debtAmts[i]||0;
    if (i===1){ S.credit.cardBal = bal; return; } // credit cards -> card page
    if (bal>=250){
      const apr=aprs[i]; const pay = apr>0? Math.max(25, Math.round(bal*(apr/100/12)/(1-Math.pow(1+apr/100/12,-48)))) : Math.max(25, Math.round(bal/60));
      S.debts.push({n:c, bal, apr, pay, kind:"legacy"});
    }
  });
  persist();
}
function applyTheme(){
  document.body.dataset.theme = META.settings.theme==="light" ? "light" : "dark";
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

function saveMeta(){ persist(); }
function aiKey(){ const p=META.settings.provider||"anthropic";
  if (!META.settings.keys) META.settings.keys={};
  if (!META.settings.keys.anthropic && META.settings["api"+"Key"]) META.settings.keys.anthropic = META.settings["api"+"Key"]; // migrate v1.1 stored key
  if (!META.settings.keys.google && META.settings.googleKey) META.settings.keys.google = META.settings.googleKey;
  return META.settings.keys[p] || ""; }
function setWallpaper(inp){ pickFromInput(inp, "wall"); }
function setPfp(inp){ pickFromInput(inp, "pfp"); }
function pickFromInput(inp, kind){
  const f=inp.files && inp.files[0]; if(!f) return;
  const img=new Image(); img.onload=()=>{
    const c=document.createElement("canvas");
    const w = kind==="wall"? 480 : 128; const h = kind==="wall"? Math.round(w*img.height/img.width) : 128;
    c.width=w; c.height=h; const x=c.getContext("2d");
    x.drawImage(img,0,0,w,h);
    if (kind==="wall"){
      let g=x.createLinearGradient(0,0,0,h*0.16); g.addColorStop(0,"rgba(0,0,0,.92)"); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g; x.fillRect(0,0,w,h*0.16);
      g=x.createLinearGradient(0,h*0.80,0,h); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"#000"); x.fillStyle=g; x.fillRect(0,h*0.80,w,h*0.20);
    }
    const data=c.toDataURL("image/jpeg",0.82);
    if (kind==="wall"){ META.settings.wallpaper=data; applyWallpaper(); toast("Wallpaper set, edges faded."); }
    else { META.settings.pfp=data; toast("Profile photo set."); }
    persist();
  };
  img.src=URL.createObjectURL(f);
}
function resetCareer(){
  sheet(`<h3>Reset this career?</h3><p class="sp">Wipes phone-side history for ${esc(S.blob.player.first)} ${esc(S.blob.player.last)}: money moves, purchases, threads, applied weeks. The baked save facts stay.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick="doResetCareer()">Reset it</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Keep everything</button>`);
}
async function doResetCareer(){
  const blob=S.blob; S=newCareerState(blob);
  await idb.set("career/"+S.careerId, S);
  closeSheet(); toast("Fresh start."); renderHome(); renderLock(); renderApp("settings");
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
  if (!code.startsWith("TYNET1.")) throw new Error("Not a TyPhone code.");
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
const NFL_DIVS = {"Bills":"AFC East","Dolphins":"AFC East","Patriots":"AFC East","Jets":"AFC East","Ravens":"AFC North","Bengals":"AFC North","Browns":"AFC North","Steelers":"AFC North","Texans":"AFC South","Colts":"AFC South","Jaguars":"AFC South","Titans":"AFC South","Broncos":"AFC West","Chiefs":"AFC West","Raiders":"AFC West","Chargers":"AFC West","Cowboys":"NFC East","Giants":"NFC East","Eagles":"NFC East","Commanders":"NFC East","Bears":"NFC North","Lions":"NFC North","Packers":"NFC North","Vikings":"NFC North","Falcons":"NFC South","Panthers":"NFC South","Saints":"NFC South","Buccaneers":"NFC South","Cardinals":"NFC West","Rams":"NFC West","49ers":"NFC West","Seahawks":"NFC West"};
function autoFromSave(blob){
  const p=blob.player; if(!p) return;
  const pc=S? S.perception : null; if(!pc) return;
  if (p.college && !pc.collegeName) pc.collegeName = p.college;
  if (p.draftRound!=null){
    pc.draft = p.draftRound>=63||p.draftRound<1 ? "Undrafted free agent" : p.draftRound===1? "First rounder" : p.draftRound<=3? "Day 2 pick" : p.draftRound<=6? "Day 3 pick" : "Seventh round flier";
  }
  pc.rep = (typeof autoReputation==="function")? autoReputation() : pc.rep;
}
function normalizeLeague(blob){
  const L=blob.league; if(!L) return;
  if (Array.isArray(L.teams) && typeof L.teams[0]==="string"){
    const names=L.teams;
    L.teams = names.map(n=>({n, d: NFL_DIVS[n]||"Other"}));
    if (Array.isArray(L.games) && Array.isArray(L.games[0])){
      L.games = L.games.map(g=>({ t: g[0]===0?"PreSeason":"RegularSeason", w:g[1], h:names[g[2]], a:names[g[3]],
        hs: g[4]<0?0:g[4], as: g[5]<0?0:g[5], played: g[4]>=0 }));
    }
  }
}
async function backupCode(){
  const code="TYNETB."+await deflateStr(JSON.stringify(S));
  await navigator.clipboard.writeText(code); toast("Backup copied — "+(code.length/1024).toFixed(1)+" KB");
}
async function applyCode(fromHash){
  let raw = fromHash || $("#syncIn")?.value;
  if (!raw || !raw.trim()) return toast("Paste a code first.");
  raw = raw.trim();
  // multi-part QR: TYNETP.<i>.<n>.<chunk>
  const pm = raw.match(/^TYNETP\.(\d+)\.(\d+)\.(.*)$/s);
  if (pm){
    const i=+pm[1], n=+pm[2];
    META.syncParts = META.syncParts || {};
    if (META.syncParts.n !== n){ META.syncParts = { n, got: {} }; }
    META.syncParts.got[i] = pm[3]; saveMeta();
    const have = Object.keys(META.syncParts.got).length;
    if (have < n){ return toast("Part "+i+" of "+n+" scanned. "+(n-have)+" more to go."); }
    raw = Array.from({length:n},(_,k)=>META.syncParts.got[k+1]).join("");
    META.syncParts = null; saveMeta();
    toast("All "+n+" parts in. Applying.");
  }
  let dec;
  try { dec = await decodeCode(raw); } catch(e){ return toast("Code didn't decode: "+e.message); }
  if (dec.backup){ return restoreSheet(dec.data); }
  const blob=dec.blob;
  normalizeLeague(blob); autoFromSave(blob);
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
  if (last) S.world.notifs.push({app:"pylon", t:"Final", p:(last[4]?"vs ":"@ ")+last[3]+" — "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" W":" L")});
  events.forEach(e=>S.world.notifs.push({app:"meridian", t:"Meridian", p:e}));
  persist();
  toast("Synced to "+wkLabel(newC));
  closeSheet(); renderHome(); if(curApp) renderApp(curApp);
  // eager generation
  if (aiKey() && META.settings.autogen){ generateWeek(blob, last).catch(e=>toast("Generation failed: "+e.message)); }
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
  S.world.huddle.unshift({id:"pw"+wkKey(blob.clock).replace(/\W/g,""), flair:"DISCUSSION", u:"weekly_bot", tm:"5h", up:77,
    h:"Weekly practice squad + roster watch: who's trending",
    b:"Recurring thread. Elevations, injuries, snap counts, and whatever the coaches say that means the opposite.", cmts:[
    {u:"depth_chart_dan",tm:"4h",up:52,t:"reminder that elevations are capped at three per player. every one they burn is information"},
    {u:"FlightBoysZn",tm:"3h",up:29,t:"the QB room math is getting funnier every week"},
    {u:"casual_since_2015",tm:"2h",up:-8,t:"can someone explain why we keep four quarterbacks like i'm five"}]});
  S.world.huddle.unshift({id:"pg"+wkKey(blob.clock).replace(/\W/g,""), flair:"GAME THREAD", u:"AutoModerator", tm:"3h", up:won?400:150,
    h:"Post-Game Thread: "+(last[4]?"Jets ":"")+(won?"win ":"fall ")+last[7][0]+"-"+last[7][1]+(last[4]?" vs ":" at ")+last[3],
    b:"Final from "+(last[4]?"home":"the road")+". Score updates synced from the save. Full write-ups, quotes, and box context arrive when an API key is in Settings; until then the thread runs on vibes.", cmts:[
    {u:"FlightBoysZn",tm:"2h",up:won?220:80,t:won?"WE ARE SO BACK":"it's august for the soul all year with this team"},
    {u:"stat_daddy_nyj",tm:"2h",up:64,t:"early read from the broadcast: "+(won?"o-line held up in the second half and the score says the rest":"tackling was optional in the third quarter and it snowballed"),r:[
      {u:"CoachTapeAndCoffee",tm:"1h",up:41,t:"charting it tonight. early numbers "+(won?"support the eye test":"are uglier than the score")},
      {u:"gang_green_therapy",tm:"55m",up:-12,t:"we do not need charts to know what we watched"}]},
    {u:"MetLifeParkingLot",tm:"2h",up:won?95:12,t:won?"road trips hit different when you win. drive home was a party":"18 dollars for a beer to watch that"},
    {u:"jerseyshoreQBclub",tm:"1h",up:33,t:"any word on which QBs got the late reps? asking for reasons",r:[
      {u:"PS_Insider_Burner",tm:"49m",up:88,t:"you know exactly why you're asking. and yes."}]},
    {u:"tannenbaum_truther",tm:"1h",up:-31,t:"fire everyone. every single person in the building. the janitor too"}]});
  persist();
}
/* ---- AI generation (user's own key, phone-side) ---- */
async function callAI(system, user, maxTokens){
  const prov = META.settings.provider||"anthropic";
  const model = META.settings.model || D.AI[prov].models[0];
  if (!D.AI[prov].models.includes(model)) {/* model from another provider selected */ }
  if (prov==="anthropic"){
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":aiKey(),
        "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
      body: JSON.stringify({ model: D.AI.anthropic.models.includes(model)?model:"claude-sonnet-4-6", max_tokens: maxTokens||8000,
        system, messages:[{role:"user", content:user}] })
    });
    if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
    const data=await r.json();
    return data.content.filter(x=>x.type==="text").map(x=>x.text).join("\n");
  }
  if (prov==="openai"){
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+aiKey() },
      body: JSON.stringify({ model: D.AI.openai.models.includes(model)?model:"gpt-5.6-terra", max_tokens: maxTokens||8000,
        messages:[{role:"system",content:system},{role:"user",content:user}] })
    });
    if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
    const data=await r.json();
    return data.choices[0].message.content;
  }
  // google
  const gm = D.AI.google.models.includes(model)?model:"gemini-3.6-flash";
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+gm+":generateContent?key="+encodeURIComponent(aiKey()), {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ system_instruction:{parts:[{text:system}]}, contents:[{role:"user",parts:[{text:user}]}],
      generationConfig:{ maxOutputTokens: maxTokens||8000 } })
  });
  if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
  const data=await r.json();
  return (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("\n");
}
const callClaude = callAI; // legacy alias
function worldFacts(blob, last){
  const p=blob.player; const per=S.perception;
  return `PLAYER (save truth): ${p.first} ${p.last}, ${p.pos}, ${p.team}, jersey #${p.jersey}, age ${p.age}, status ${p.status}${p.isIR?" (IR)":""}, confidence ${p.confidence}/99.
CLOCK: ${wkLabel(blob.clock)}.
LAST RESULT: ${last? (last[4]?"home vs ":"away at ")+last[3]+", "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" WIN":" LOSS") : "none"}.
NEXT: ${(()=>{const n=nextGame(); return n? (n[4]?"home vs ":"at ")+n[3]+" ("+n[5]+")":"unknown"})()}.
KEY TEAMMATES: ${blob.roster.slice(0,10).map(r=>r[0]+" "+r[1]+" ("+r[2]+" #"+r[4]+")").join(", ")}.
QB ROOM: ${blob.roster.filter(r=>r[2]==="QB").map(r=>r[0]+" "+r[1]).join(", ")}.
MONEY: practice squad $6,222/wk; checking ${fm(S.cash.checking)}; runway ${runwayWeeks()} weeks.
PERCEPTION (who the world believes he is): ${per.draft||"Undrafted"}, grew up ${per.grew||"unknown"} in ${per.state||"?"}, HS: ${per.hs||"unranked"}, college: ${per.college||"unknown"}, family: ${per.family||"unknown"}${per.familyAsk?", sends home "+fm(per.familyAsk)+"/mo":""}${per.debtTotal?", carrying "+fm(per.debtTotal)+" of personal debt ("+(per.debtShares? D.DEBTCATS.filter((c,i)=>per.debtShares[i]>0).join(", "):"mixed")+")":""}. Public reputation: ${per.rep||"Complete unknown"}. FOLLOWERS on Chirper: ${S.chirp?S.chirp.followers.toLocaleString():"n/a"} (${buzzTier(S.chirp?S.chirp.followers:0)}).`;
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
  if (!thread.persona){
    const r = S.blob.roster.find(x=> (x[0]+" "+x[1])===thread.name);
    if (r) thread.persona = thread.name+" is a "+r[2]+" on the "+S.blob.player.team+", jersey #"+r[4]+", overall talent "+r[3]+"/99"+(r[5]==="PracticeSquad"?", also on the practice squad":"")+". A teammate texting casually.";
    if (thread.id==="mara") thread.persona = "Mara Quinn, the player's sharp personal assistant from Apex client services. Practical, dry, keeps his spending honest.";
  }
  try{
    const sys=`You are ${thread.name} texting ${S.blob.player.first} ${S.blob.player.last} (${S.blob.player.pos}, ${S.blob.player.team}, ${S.blob.player.status}). ${thread.persona? thread.persona+" ":""}Stay perfectly in character based on the conversation so far. Reply with ONLY the text message content, under 40 words, lowercase texting style unless the character wouldn't. No em dashes.`;
    const hist=thread.msgs.map(m=>(m[0]==="me"?"THEM: ":"YOU: ")+m[1]).join("\n");
    return await callClaude(sys, hist+"\nTHEM: "+userMsg+"\nYour reply:", 200);
  }catch(e){ toast("Reply failed: "+e.message); return null; }
}

/* ---- service worker + boot ---- */
const VER="v1.2.0";
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
function setVH(){ document.documentElement.style.setProperty("--vh", (window.innerHeight*0.01)+"px"); }
setVH(); window.addEventListener("resize", setVH); window.addEventListener("orientationchange", ()=>setTimeout(setVH,300));
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
  if (S && S.blob) { normalizeLeague(S.blob); autoFromSave(S.blob); persist(); }
  applyWallpaper(); applyTheme();
  clockTick(); renderLock(); renderHome();
  // QR path: #sync=CODE
  const m=location.hash.match(/^#sync=(.+)/);
  if (m){ unlock(); openApp("sync"); setTimeout(()=>applyCode(decodeURIComponent(m[1])), 400); history.replaceState(null,"",location.pathname); }
})();
