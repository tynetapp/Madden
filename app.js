/* TyPhone app.js — v1.13.1 (Aug 11 2026) — THE ONE MEDIA SESSION + THE STRIPPED SYNC + THE OVERRULE (Ty's flow ruling: postgame+lookahead in one room at sync, no media card ever, unseen hand lives in the review page, coach calls deniable from upstairs, boot self-heal for silent weeks) (prior: v1.13.0 THE POWERHOUSE) */
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

function newCareerState(blob, opts){
  const p = blob.player;
  /* v1.11.0 PRIVACY EDITION: no baked demo career ships on the public build (D.BLOB is null).
     isCanon keys ONLY on the baked careerId when a blob is baked; the name/team fallback died. */
  const isCanon = !(opts&&opts.generic) && !!D.BLOB && blob.careerId===D.BLOB.careerId;
  const world = isCanon ? {
    texts: structuredClone(D.SEED.texts), emails: structuredClone(D.SEED.emails),
    articles: [Object.assign({wk:"Preseason Wk 1"}, structuredClone(D.SEED.article))],
    earlier: structuredClone(D.SEED.earlier),
    chirps: structuredClone(D.SEED.chirps), huddle: structuredClone(D.SEED.huddle),
    podium: structuredClone(D.SEED.podium), clips: [], espnExtra: structuredClone(D.SEED.espnExtra),
    notifs: structuredClone(D.SEED.notifications)
  } : genericSeed(blob);
  const st = {
    careerId: blob.careerId, createdAt: Date.now(),
    blob, appliedWeeks: [wkKey(blob.clock)],
    cash: { checking: 1750, savings: 0, tax: 0 },
    autosweep: false, sweepPct: {tax:30, savings:10},
    credit: { score: 620, cardBal: 0, cardLimit: 8000, cardApr: 24.9, ledger: [] },
    debts: [], properties: [], garage: [], boats: [], planes: [],
    invest: {}, // id -> {units, cost}
    investPx: seedPrices(blob.careerId),
    bills: [
      {id:"stay", n:"Extended-stay hotel ("+(isCanon?"Florham Park":(D.METROS[p.team]?D.METROS[p.team].city:"team city"))+")", amt:3400, cat:"housing"},
      {id:"phone", n:"Phone", amt:95, cat:"life"},
      {id:"stream", n:"Streaming bundle", amt:47, cat:"life"},
      {id:"food", n:"Food & groceries", amt:1400, cat:"life"},
      {id:"train", n:"Training & recovery", amt:600, cat:"career"}
    ],
    ledger: [ {t:"Camp stipend — Meridian deposit", amt:1750, wk:"PS1", kind:"income"} ],
    deals: [], perception: { draft:"Undrafted free agent", state:"", grew:"Small town", hs:"Local standout", college:"Mid-major starter", family:"Single mother household", rep:"Complete unknown", familyAsk:0, debtTotal:0, debtShares:null },   /* v1.11.0: state starts blank — the player sets it in Settings. v1.12.2: save geography fills the blanks below (typed values still win forever). */
    world,
    votes: {}, reads: {}, cardTx: [], handle: "@"+(p.first+p.last).replace(/\W/g,"").toLowerCase(),
    agent: null,
    chirp: { followers: 842, following: 63, delta: 0, posts: [] },
    last4: String(1000 + Math.floor(seedRng(blob.careerId+"card")()*9000)),
    acctNums: { checking: String(1000+Math.floor(seedRng(blob.careerId+"a1")()*9000)), savings: String(1000+Math.floor(seedRng(blob.careerId+"a2")()*9000)), tax: String(1000+Math.floor(seedRng(blob.careerId+"a3")()*9000)) },
  };
  homeFillPerception(st.perception, p);   /* v1.12.2 THE GEOGRAPHY: save truth fills the blank state + grew-up at birth */
  return st;
}
/* Neutral week-zero world for any non-canon career, templated entirely from its blob.
   Real content arrives at the first AI generation; this just makes every app open clean. */
function genericSeed(blob){
  const p=blob.player, team=p.team;
  const ps = p.status==="PracticeSquad";
  const cash = (p.contract?.salary?.[p.contract?.currentYear||0]) ?? p.capSalary;
  const wkPay = ps? 6222 : Math.round(cash/18);
  const payLine = ps
    ? "You are on the "+team+" practice squad. That pays $6,222 per week the roster exists (18 weeks), roughly $112,000 for the season. Elevations pay the active-week rate instead."
    : "You are on the "+team+" active roster. The contract on file pays "+fm(cash)+" this year, landing as "+fm(wkPay)+" per regular-season check before taxes.";
  return {
    texts: [
      {id:"agent", name:"Apex Sports Group", color:"#6b5b2a", msgs:[
        ["them","Front desk at Apex. Welcome to "+team+" life, "+p.first+". Your rep situation is open."],
        ["them","Open the Apex app when you get a minute and pick who represents you. Nothing moves on contracts or endorsements until you do."]]}
      // v1.6.8 (Ty): NO default family. You pick your people in Settings -> Family first;
      // they become the contacts and text threads. Nobody gets a mom they didn't write.
    ],
    emails: [
      {id:"nflpa", from:"NFLPA Member Services", subj:"Welcome to the NFLPA, dues & benefits enrollment", time:"7:02 AM", unread:true,
       body:"Dear "+p.first+" "+p.last+",\n\nWelcome to the National Football League Players Association.\n\nKey items for your first month:\n\n• Union dues of "+fm(nflpaDues(blob))+" are deducted from each game-week paycheck during the season (3.75% of the league rookie minimum salary, split across 18 checks).\n• Your 401(k) enrollment window is open. The league matches 2-for-1 after your first credited season.\n• Health coverage begins immediately and continues through the plan year.\n• Free financial counseling is available to every member. We recommend using it before your first major purchase, not after.\n\nIn solidarity,\nNFLPA Member Services"},
      {id:"apex1", from:"Apex Sports Group", subj:"How you actually get paid", time:"Yesterday", unread:true,
       body:p.first+",\n\nPutting this in writing like we do for everyone.\n\nYOUR DEAL. "+payLine+"\n\nOUR CUT. Apex takes a percentage of playing contract money only, set by whichever agent you sign with. Endorsements are negotiated separately.\n\nTHE PART EVERYONE SKIPS. Taxes will take roughly 40% of every check. The check that hits your account is NOT your money to spend, it is your money to allocate. Meridian will set up the tax hold account this week.\n\nDon't buy anything with a motor yet.\n\nApex Sports Group"}
    ],
    articles: [], earlier: [],
    chirps: [
      {n:team+" Videos", h:"@"+p.teamShort.toLowerCase()+"clips", vf:1, av:"#1a5a41", t:"Camp continues in "+(D.METROS[team]?D.METROS[team].city:team)+". Full "+team+" coverage all season.", li:412, rp:38, tm:"3h"}
    ],
    huddle: [
      {id:"gw1", flair:"DISCUSSION", u:"AutoModerator", tm:"6h", up:120,
       h:"Weekly "+team+" roster and camp thread",
       b:"Depth chart talk, camp reports, and whatever the coaches say that means the opposite. New faces get discussed here.",
       cmts:[
        {u:"depth_chart_watcher", tm:"5h", up:44, t:"tracking every "+p.pos+" rep this week. the room is more interesting than people think"},
        {u:"section_314_lifer", tm:"4h", up:21, t:"just let the season start already"}]}
    ],
    podium: { show:"The Walkthrough", hosts:"Rachel Otani & Dom Whitfield", eps:[],
      srcNote:"Generate the episode source here, run it through the Gemini Notebook app (Audio Overview), paste the link back. The source keeps the hosts honest: the show tours the league, and your name only comes up if the week earned it." },
    clips: [], espnExtra: [], notifs: []
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
function activeWeekly(pl){ const p=pl||S.blob.player; const c=p.contract; const yr=(c?.salary?.[c.currentYear])??p.capSalary; return Math.round(yr/18); }
function grossFor(status, pl){ return status==="PracticeSquad" ? psWeekly() : activeWeekly(pl); }
/* v1.12.2 THE FORMULA (Ty's spec): NFLPA dues = 3.75% of the ROOKIE MINIMUM, split across the
   18 game checks. The save carries its own rookie minimum (SalaryInfo.PlayerMinSalaryTable,
   exe v1.7.1 ships it as blob.minRookieSalary in dollars — $880,000 on his era = $1,833/check),
   so the number scales with the franchise's cap growth forever. Legacy codes without the field
   fall back to the flat honest figure. ONE door: checkLines and the NFLPA welcome email both
   read here. */
function nflpaDues(blob){
  const m = (blob && blob.minRookieSalary) || (typeof S!=="undefined" && S && S.blob && S.blob.minRookieSalary) || 0;
  return m>0 ? Math.round(m*0.0375/18) : 1845;
}
/* v1.12.2 THE GEOGRAPHY (Ty: "the save has it sitting right there"): PLYR_HOME_STATE comes
   CamelCased ("NewJersey"); deCamel renders it for humans. homeSeed builds the perception
   fill from save truth — used at career birth AND as a blank-only backfill at every sync
   (typed values are HIS data and are never touched). Roster idx14/15 carry every teammate's
   geography for the Ledger's later use; rosterHome is the one length-guarded read door. */
function deCamel(s){ return String(s||"").replace(/([a-z])([A-Z])/g, "$1 $2"); }
/* v1.12.3 (Ty's screenshot: "AL"): the Settings state field is a SELECT of two-letter
   abbreviations — filling it with "New Jersey" matched nothing and the browser showed the
   first option. The fill speaks the select's language now. Keys are the save's own CamelCase. */
const STATE_ABBR = {Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV",NewHampshire:"NH",NewJersey:"NJ",NewMexico:"NM",NewYork:"NY",NorthCarolina:"NC",NorthDakota:"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA",RhodeIsland:"RI",SouthCarolina:"SC",SouthDakota:"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA",WestVirginia:"WV",Wisconsin:"WI",Wyoming:"WY",DistrictofColumbia:"DC",WashingtonDC:"DC"};
function stateAbbrFor(saveCamel){ return STATE_ABBR[String(saveCamel||"").replace(/\s+/g,"")] || null; }
function rosterHome(r){ return (Array.isArray(r) && r.length>15) ? {state:deCamel(r[14]), town:String(r[15]||"")} : null; }
function homeFillPerception(per, player){
  if (!per || !player) return false;
  let did=false;
  const hsFull=deCamel(player.homeState||""), ht=String(player.homeTown||"");
  const ab=stateAbbrFor(player.homeState);                                   /* v1.12.3: the select speaks abbreviations */
  if (ab && !String(per.state||"").trim() && per.stateOther===undefined){ per.state=ab; did=true; }
  if (ht && (!String(per.grew||"").trim() || per.grew==="Small town")){ per.grew=ht + (hsFull? ", "+hsFull : ""); did=true; }   /* the untouched factory default counts as blank */
  return did;
}
function checkLines(status, road, oppState, pl){
  const gross = grossFor(status, pl);
  const lines = [["Gross ("+(status==="PracticeSquad"?"practice squad week":"active week")+")", gross]];
  const fed = -Math.round(gross*0.35); lines.push(["Federal withholding", fed]);
  /* v1.6.3: home-state tax follows the TEAM (identity law) — a Florida or Texas player
     pays no state income tax; the old line hardcoded New Jersey from the fixture era. */
  const home = STATE_TAX[(pl&&pl.team)||""];
  const st = home && home.rate>0 ? -Math.round(gross*home.rate) : 0;
  if (st) lines.push([home.n+" state", st]);
  let jock=0; if(road && oppState){ jock = -Math.round(gross*0.35*(oppState.rate)); if(jock) lines.push(["Jock tax — "+oppState.n, jock]); }
  const feePct = (S && S.agent) ? S.agent.fee : 3.0;
  const agent = -Math.round(gross*feePct/100); if (agent) lines.push(["Agent fee ("+feePct+"%) — "+((S&&S.agent)?S.agent.n.split(" ").pop():"Apex"), agent]);   /* v1.9.0: self-rep fee 0 — no line, all his */
  const dues = -nflpaDues(); lines.push(["NFLPA dues", dues]);   // v1.12.2: derived from the save's rookie minimum — the $117 flat era is over
  const net = gross+fed+st+jock+agent+dues;
  return {gross, net, lines};
}
/* v1.6.3: full 32-team state-tax map (was a 12-team road-game partial — a Jets player had
   no home-state entry at all). Full state names; home line and road jock tax share it. */
const STATE_TAX = {
  "Dolphins":{n:"Florida",rate:0},"Jaguars":{n:"Florida",rate:0},"Buccaneers":{n:"Florida",rate:0},
  "Cowboys":{n:"Texas",rate:0},"Texans":{n:"Texas",rate:0},"Titans":{n:"Tennessee",rate:0},
  "Seahawks":{n:"Washington",rate:0},"Raiders":{n:"Nevada",rate:0},
  "Chargers":{n:"California",rate:.133},"Rams":{n:"California",rate:.133},"49ers":{n:"California",rate:.133},
  "Jets":{n:"New Jersey",rate:.1075},"Giants":{n:"New Jersey",rate:.1075},
  "Bills":{n:"New York",rate:.109},"Patriots":{n:"Massachusetts",rate:.09},
  "Steelers":{n:"Pennsylvania",rate:.0307},"Eagles":{n:"Pennsylvania",rate:.0307},
  "Bengals":{n:"Ohio",rate:.035},"Browns":{n:"Ohio",rate:.035},
  "Ravens":{n:"Maryland",rate:.0575},"Commanders":{n:"Maryland",rate:.0575},
  "Panthers":{n:"North Carolina",rate:.0425},"Falcons":{n:"Georgia",rate:.0539},
  "Saints":{n:"Louisiana",rate:.03},"Bears":{n:"Illinois",rate:.0495},
  "Lions":{n:"Michigan",rate:.0425},"Packers":{n:"Wisconsin",rate:.0765},
  "Vikings":{n:"Minnesota",rate:.0985},"Chiefs":{n:"Missouri",rate:.047},
  "Colts":{n:"Indiana",rate:.03},"Cardinals":{n:"Arizona",rate:.025},"Broncos":{n:"Colorado",rate:.044}
};
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
  meridian: '<span style="font-family:Georgia,serif;font-size:25px;font-weight:700">$</span>', /* v1.7.7 (Ty): the bank reads as money */
  huddle: '<span style="font-size:19px;font-weight:800;letter-spacing:-.5px">h/</span>',
  sync: SV('<path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/>'),
  chirper: SV('<path d="M8.2 20.5c3.1.6 6.4-.2 8.4-2.6 1.7-2 2.3-4.8 1.6-7.3l1.9-1.2-2.4-.4c-.5-.9-1.3-1.7-2.3-2.2l1-2.1-2.3.9C10.9 4.4 7.5 6 6.4 9c-.8 2.2-.4 4.7 1 6.5-1.1 1.3-2.6 2-4.4 2.1 1.4 1.5 3.2 2.5 5.2 2.9z" fill="currentColor" stroke="none"/><circle cx="13.4" cy="9.6" r="1" fill="var(--ch-bg,#000)" stroke="none"/><path d="M19.5 4.5l2-1M20 6.6l2.2-.2" stroke-width="1.5"/>'),
  tmail: SV('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>'),
  chron: SV('<path d="M4 4.8h13.2v13a2.2 2.2 0 0 0 2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8z"/><path d="M17.2 8.6h1.4a1.4 1.4 0 0 1 1.4 1.4v8" stroke-width="1.7"/><path d="M6.6 8.2h8M6.6 11.2h3.6M6.6 13.9h3.6M6.6 16.6h8" stroke-width="1.6"/><rect x="11.6" y="10.4" width="3" height="4.4" rx="0.5" fill="currentColor" stroke="none"/>'), /* v1.7.5 (Ty): a folded front page, not initials */
  pylon: SV('<ellipse cx="12" cy="12" rx="9.6" ry="6.1" transform="rotate(-32 12 12)" fill="#8a4a25" stroke="#e8edf3" stroke-width="1.5"/><path d="M9.1 13.9l5.8-3.8M10.2 11.4l1.3 2.1M12.1 10.2l1.3 2.1M13.9 9l1.3 2.1" stroke="#fff" stroke-width="1.4"/>', 'style="overflow:visible"'), /* v1.6 (Ty #3): a football, not the orange mystery square. .py-ic CSS kept dead per helper-deletion law */
  wager: SV('<path d="M3.5 8.5v-2A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.3 2.3 0 0 0 0 7v2A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.3 2.3 0 0 0 0-7z"/><path d="M9 5v14" stroke-dasharray="1.6 2.2"/><path d="M12.5 10.5h5M12.5 13.5h3.5" stroke-width="1.6"/>'),
  cal: SV('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5"/><circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none"/><rect x="14.7" y="16" width="3" height="2.2" rx="0.6" fill="currentColor" stroke="none"/>'),
  assist: SV('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/><path d="M16.5 5.5l1.2 1.2M18.6 4.6l.9.9" stroke-width="1.4"/>'),
  podium: SV('<rect x="9.2" y="3" width="5.6" height="11" rx="2.8"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6"/>'),
  keystone: SV('<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10.5V20h12v-9.5"/><rect x="10" y="14.5" width="4" height="5.5" fill="currentColor" stroke="none"/>'),
  octane: SV('<path d="M4 16.5a8.5 8.5 0 1 1 16 0"/><path d="M12 15.5l4.2-5" stroke-width="2.4"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/>'),
  apex: SV('<rect x="3.2" y="7.6" width="17.6" height="12" rx="2.2"/><path d="M9 7.6V6.2A1.9 1.9 0 0 1 10.9 4.3h2.2A1.9 1.9 0 0 1 15 6.2v1.4M3.2 12.4h17.6M12 11v2.8" stroke-width="1.8"/>'), /* v1.7.5 (Ty): the briefcase, an agency, not letters */
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
  {id:"apex", n:"Apex Agency", ic:"ic-apx"}, /* v1.7.5 (Ty) */
  {id:"yachts", n:"Harborline", ic:"ic-yct"},
  {id:"planes", n:"Stratos", ic:"ic-pln"},
  {id:"contacts", n:"Contacts", ic:"ic-con"},
  {id:"card", n:"Credit Card", ic:"ic-card"},
  {id:"wager", n:"WagerLines", ic:"ic-wgr"},
  {id:"assist", n:"Client Services", ic:"ic-ast"},
  {id:"cal", n:"Calendar", ic:"ic-cal"},
];
const DOCK = [
  {id:"messages", n:"Messages", ic:"ic-msg"},
  {id:"meridian", n:"Meridian", ic:"ic-mer"},
  {id:"sync", n:"Sync", ic:"ic-sync"},
  {id:"settings", n:"Settings", ic:"ic-set"},
];
let curApp = null, appStack = [];

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("show"), Math.max(2600, Math.min(6000, 1400+String(msg).length*45))); }   /* v1.9.6: toasts wrap now, so long ones stay up long enough to read */
function sheet(html){ $("#sheet").innerHTML=html; $("#dim").classList.remove("hidden"); }
function closeSheet(){ $("#dim").classList.add("hidden"); if(typeof mailPendingApply!=="undefined") mailPendingApply=null; /* v1.8.0: a cancelled sheet abandons any mailbox apply-in-flight — both consume sites run BEFORE their closeSheet, so a completed apply is never touched */ }
$("#dim") && document.addEventListener("click", e=>{ if(e.target.id==="dim") closeSheet(); });

function clockTick(){
  if (!META) return; // interval can fire before boot finishes
  const d=phoneNow?phoneNow():new Date();
  const t=d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}).replace(/\s?[AP]M/i,"");
  $("#lk-time").textContent=t; $("#sb-time").textContent=t;
  $("#lk-date").textContent = (typeof S!=="undefined" && S && S.blob) ? gameDateLong(S.blob.clock) : d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"});
}
setInterval(clockTick, 5000);

function unlock(){ const hb=$('#homebar'); if(hb) hb.style.display='none'; $("#lock").classList.add("hidden"); $("#home").classList.remove("hidden"); }
function lock(){ renderLock(); $("#lock").classList.remove("hidden"); $("#home").classList.add("hidden"); closeApp(true); }

function iconEl(a, badge){
  return `<button class="app" onclick="openApp('${a.id}')"><b class="icon ${a.ic}">${GLYPH[a.id]||""}${badge?`<span class="badge">${badge}</span>`:""}</b><span>${a.n}</span></button>`;
}
function orderedApps(){ return gridApps(); }
function orderedApps_old(){
  const ord = META.settings.appOrder||{};
  return APPS.slice().sort((a,b)=> ((a.id in ord)? ord[a.id]-0.5 : APPS.indexOf(a)) - ((b.id in ord)? ord[b.id]-0.5 : APPS.indexOf(b)) );
}
function renderHome(){
  const unreadM = S.world.texts.filter(t=>!S.reads["t:"+t.id]).length;
  const unreadE = S.world.emails.filter(e=>e.unread && !S.reads["e:"+e.id]).length;
  /* v1.8.3 (Ty: "midweek is a sync too"): midweek not played + waiting coach rulings BOTH
     badge Sync — everything that means sync lives there now. */
  const mwPend = (S.midweek&&S.midweek[wkKey(S.blob.clock)])? 0 : 1;
  const stN = staffState().orders.length;
  /* v1.7.6 (Ty: "coach made a call" landed but no bubble on Messages): the unread-texts badge
     was wired ONLY into the dock's map — Messages living on the grid never got one. One badge
     rule now serves both surfaces. */
  const bdg = a => a.id==="messages"&&unreadM?unreadM : a.id==="tmail"&&unreadE?unreadE : a.id==="sync"&&(stN+mwPend)?(stN+mwPend) : null;
  $("#grid").innerHTML = gridApps().map(a=>iconEl(a, bdg(a))).join("");
  $("#dock").innerHTML = dockIds().map(id=>appPool().find(a=>a.id===id)).map(a=>iconEl(a, bdg(a))).join("");
  renderWidget();
}
/* v1.7.0 (Ty): in preseason there IS no practice squad or 53 — everyone is in camp. Display
   truth only; pay math keeps the save's real status underneath.
   v1.12.1 (Ty's field ruling): the GAME counts preseason rosters as 75, not 90 — the label
   says exactly what Madden says. */
function rosterLabel(){
  const c=S.blob.clock||{}; const p=S.blob.player;
  if ((c.weekType||c.stage)==="PreSeason") return "Training Camp · 75-man";
  return p.status==="PracticeSquad"?"Practice Squad":p.isIR?"Injured Reserve":p.status==="Signed"?"Active Roster":p.status;
}
function povDesc(){ const p=S.blob.player; return (p.status==="PracticeSquad"?"practice squad ":"")+(p.yearsPro===0?"rookie ":p.yearsPro>=6?"veteran ":"")+p.pos; }
/* v1.5.1: 14-tier fame ladder, Unknown to global icon. Top of the scale is Ronaldo/LeBron/MJ
   territory — a 10-ring record-breaker in this world outgrows the sport itself. */
function buzzTier(f){
  return f>1000000000?"Bigger than the game"
       : f>350000000?"One of one"
       : f>120000000?"Global icon"
       : f>50000000?"Transcends the sport"
       : f>20000000?"Face of the league"
       : f>8000000?"Superstar"
       : f>3000000?"Household name"
       : f>1000000?"National story"
       : f>400000?"League-wide buzz"
       : f>120000?"Fan favorite"
       : f>25000?"Local hero"
       : f>6000?"Beat-writer radar"
       : f>1500?"Local curiosity"
       : "Unknown";
}
function fmFoll(n){
  n=n||0;
  if (n>=1e9) return (n/1e9).toFixed(2).replace(/\.?0+$/,"")+"B";
  if (n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,"")+"M";
  if (n>=10000) return Math.round(n/1000)+"K";
  return n.toLocaleString();
}
/* v1.6 (Ty #6 calendar bug): the raw week anchor is whatever weekday the math lands on,
   so the header could read "Fri Oct 29" while the TODAY pill sat on Thu Oct 28. ONE truth
   now: every displayed date derives from the Tuesday-anchored in-game week + how far the
   week has played (sync day Tue, Thu once midweek runs). gameDateObj stays raw — it only
   measures deltas between saves. */
function weekAnchorTue(clock){
  const a = gameDateObj(clock);
  while (a.getDay()!==2) a.setDate(a.getDate()-1);
  return a;
}
function worldToday(clock){
  const a = weekAnchorTue(clock);
  const done = (typeof S!=="undefined" && S && S.midweek && S.midweek[wkKey(clock)]);
  if (done) a.setDate(a.getDate()+2);
  return a;
}
function gameDate(clock){
  return worldToday(clock).toLocaleDateString(undefined,{weekday:"short", month:"short", day:"numeric"});
}
function gameDateLong(clock){
  return worldToday(clock).toLocaleDateString(undefined,{weekday:"long", month:"long", day:"numeric"});
}
function phoneNow(){
  const d=new Date();
  if (META.settings.clockOffsetMin) d.setMinutes(d.getMinutes()+META.settings.clockOffsetMin);
  return d;
}
function gameDateObj(clock){
  const y=clock.seasonYear||2026;
  if (clock.weekType==="PreSeason") return new Date(y,7,14 + clock.week*7); // v1.7.2 (Ty): PS wk1 lands Aug 14, not Aug 7 — the HOF game owns the week before
  if (clock.weekType==="RegularSeason") return new Date(y,8,10 + clock.week*7);
  if (clock.weekType==="OffSeason") return new Date(y+1,2,15);
  return new Date(y+1,0,11 + Math.max(0,(clock.week||0)-18)*7); // playoffs / Pro Bowl (global week count)
}
/* v1.4: relative age labels for world content ("3w", "8mo", "2y") */
function agoFull(ts){ const l=agoLabel(ts); return l==="now"? "now" : l+" ago"; }   /* v1.7.7 (Ty: an email said "now ago") */
function agoLabel(ts){
  const d = Date.now()-ts;
  if (d < 90*1000) return "now";
  const m=d/60000, h=m/60, dy=h/24, w=dy/7, mo=dy/30.4, y=dy/365;
  if (m<60) return Math.round(m)+"m";
  if (h<24) return Math.round(h)+"h";
  if (dy<7) return Math.round(dy)+"d";
  if (w<5)  return Math.round(w)+"w";
  if (mo<12) return Math.round(mo)+"mo";
  return (y<2? "1y" : Math.round(y)+"y");
}
function gapLabel(ms){
  const dy=ms/86400000, w=dy/7, mo=dy/30.4, y=dy/365;
  if (dy<10) return Math.round(dy)+" days later";
  if (w<6)   return Math.round(w)+" weeks later";
  if (mo<12) return Math.round(mo)+" months later";
  return (Math.round(y*10)/10)+" years later";
}
/* Everything already on the phone ages by GAME time when a sync jumps the clock. */
function shiftWorldTime(ms){
  if (!(ms>0)) return;
  const sh = x => (x && typeof x==="number") ? x-ms : x;
  for (const t of (S.world.texts||[])){
    if (t.last) t.last = sh(t.last);
    for (const m of t.msgs) if (m[2]) m[2] = sh(m[2]);
  }
  for (const e of (S.world.emails||[])) if (e.ts) e.ts = sh(e.ts);
  for (const c of (S.world.chirps||[])) if (c.ts) c.ts = sh(c.ts);
  for (const h of (S.world.huddle||[])) if (h.ts) h.ts = sh(h.ts);
  for (const p of ((S.chirp&&S.chirp.posts)||[])) if (p.ts) p.ts = sh(p.ts);
  for (const a of (S.world.articles||[])) if (a.ts) a.ts = sh(a.ts);
}
/* One-time stamps for content that predates the ts model (staggered so it doesn't all read "now"). */
function stampWorld(){
  let i=0; const base=Date.now();
  for (const c of (S.world.chirps||[])) if (!c.ts) c.ts = base - (2+i++)*3600000;
  i=0; for (const h of (S.world.huddle||[])) if (!h.ts) h.ts = base - (4+i++)*3600000;
  i=0; for (const e of (S.world.emails||[])) if (!e.ts) e.ts = base - (3+i++)*5400000;
  for (const t of (S.world.texts||[])){
    if (!t.last) t.last = base - 7200000;
    const n=t.msgs.length;
    t.msgs.forEach((m,k)=>{ if(!m[2]) m[2] = t.last - (n-1-k)*240000; });
  }
  for (const p of ((S.chirp&&S.chirp.posts)||[])) if (!p.ts) p.ts = base - 3600000;
  for (const a of (S.world.articles||[])) if (!a.ts) a.ts = base - 86400000;
}
/* v1.4.2 BETA DIALS: hand-set practice/film meters (0-10) that the whole world treats as truth.
   Placeholder for the future practice engine; lives per-career in S.beta. */
function betaDials(){ S.beta = S.beta || {practice:5, film:5}; return S.beta; }
function dialLabel(v){ return v<=1?"disastrous":v<=3?"poor":v<=4?"shaky":v<=6?"solid":v<=8?"sharp":"exceptional"; }
function practiceLine(){
  const b=betaDials();
  return `PRACTICE THIS WEEK (coach's private evaluation, treat as ground truth that leaks into how insiders talk): on-field practice ${b.practice}/10 (${dialLabel(b.practice)}), film study / mental prep ${b.film}/10 (${dialLabel(b.film)}). Low numbers show up as coach frustration, lost reps, trade-rumor energy; high numbers as earned trust, first-team reps chatter, "coaches love him" energy. Scale the reaction to how extreme the number is, and ALWAYS judge relative to the player's actual ability level and role: a limited player's 10/10 week means effort, growth, and turning heads ("kid is outworking everyone"), never sudden stardom; a star's 3/10 week is an alarming story. Practice quality moves TRUST and OPPORTUNITY talk, not talent.`;
}
/* v1.4: group texts arrive as "Name|message" but models sometimes write "Name: message" — accept both. */
function splitGroupMsg(tx, members){
  const i=tx.indexOf("|");
  if (i>0 && i<30) return { who: tx.slice(0,i), tx: tx.slice(i+1) };
  const m=tx.match(/^([A-Z][A-Za-z.'\- ]{1,26}?):\s+(.*)$/s);
  if (m && (!members || !members.length || members.some(n=>n.toLowerCase().startsWith(m[1].toLowerCase().split(" ")[0]))||m[1].split(" ").length<=3))
    return { who: m[1], tx: m[2] };
  return { who: "", tx };
}
/* v1.4: follower engine. Deterministic target from save truth + market + production;
   followers only climb toward it (nobody sheds fans for syncing). */
const MARKET = {"Jets":1.7,"Giants":1.7,"Cowboys":1.8,"Eagles":1.4,"Bears":1.4,"49ers":1.4,"Rams":1.3,"Chargers":1.1,"Patriots":1.3,"Steelers":1.35,"Packers":1.3,"Dolphins":1.15,"Falcons":1.05,"Texans":1.1,"Broncos":1.1,"Seahawks":1.1,"Commanders":1.15,"Browns":1,"Bengals":1,"Ravens":1.05,"Vikings":1,"Lions":1.05,"Buccaneers":1,"Saints":1,"Panthers":.9,"Colts":.95,"Titans":.9,"Cardinals":.95,"Raiders":1.15,"Chiefs":1.25,"Bills":1.05,"Jaguars":.85};
function seasonProd(blob){
  let prod=0, yds=0, tds=0;
  for (const line of (blob.seasonStats||[])) for (const k in line){
    if (/YARDS$/.test(k)) { prod += line[k]; yds += line[k]; }
    if (/TDS$/.test(k)) { prod += line[k]*120; tds += line[k]; }
    if (k==="DLINESACKS"||k==="DSECINTS") prod += line[k]*400;
  }
  return {prod, yds, tds};
}
function isPlayoffType(t){ return t!=="PreSeason" && t!=="RegularSeason" && t!=="OffSeason"; }
/* Bank a finished season into the career ledger (called when a sync crosses into a new season). */
function bankSeason(oldBlob){
  S.legacy = S.legacy || {seasons:0, wins:0, titles:0, yds:0, tds:0};
  S.legacy.teams = S.legacy.teams || {};
  S.legacy.teams[oldBlob.clock.seasonIndex] = oldBlob.player.team;   // v1.6: who he played for, per season (title truth needs it)
  const sp=seasonProd(oldBlob);
  const wins=(oldBlob.schedule||[]).filter(g=>g[1]==="RegularSeason"&&g[7]&&g[7][0]>g[7][1]).length;
  const po=(oldBlob.schedule||[]).filter(g=>isPlayoffType(g[1])&&g[7]).sort((a,b)=>a[0]-b[0]);
  const wonTitle = po.length>=1 && po.every(g=>g[7][0]>g[7][1]) && po.length>=3; // ran the table through 3+ playoff rounds (heuristic; flagged in log)
  S.legacy.seasons++; S.legacy.wins+=wins; S.legacy.yds+=sp.yds; S.legacy.tds+=sp.tds;
  /* v1.7.4 (Ty: "historical year stats from past seasons" in My Season): bank a readable
     per-year snapshot from the OLD blob before it's replaced. Save truth only. */
  try{
    S.legacy.years = S.legacy.years||[];
    const yr=(oldBlob.clock.seasonYear||0); const merged={};
    for (const s of (oldBlob.seasonStats||[])) for (const k in s){ if (k!=="table" && typeof s[k]==="number") merged[k]=Math.max(merged[k]||0, s[k]); }
    const LB={GAMESPLAYED:"GP",GAMESSTARTED:"GS",PASSYARDS:"Pass yds",PASSTDS:"Pass TD",PASSINTS:"INT",RUSHYARDS:"Rush yds",RUSHTDS:"Rush TD",RECEIVECATCHES:"Rec",RECEIVEYARDS:"Rec yds",RECEIVETDS:"Rec TD",DEFTACKLES:"Tackles",DLINESACKS:"Sacks",DSECINTS:"INTs",KICKFGMADE:"FG",PUNTATTEMPTS:"Punts",OLINEPANCAKES:"Pancakes"};
    const rows=[["GP",merged.GAMESPLAYED||0],["GS",merged.GAMESSTARTED||0]];
    for (const f of posStatFields(oldBlob.player.pos)) if (merged[f]) rows.push([LB[f]||f, merged[f]]);
    if (!S.legacy.years.find(x=>x.y===yr)) S.legacy.years.push({y:yr, team:oldBlob.player.team, rows:rows.slice(0,8)});
  }catch(e){}
  /* v1.6 (Ty #13, TITLE LAW): when the blob carries YearSummary history, champions come
     from save truth and the swept-3+ heuristic is DEAD. Heuristic survives only as the
     fallback for blobs from older extractors. */
  if (S.blob && S.blob.history && S.blob.history.length) { /* recomputeTitles() owns it */ }
  else if (wonTitle) S.legacy.titles++;
}
function followerTarget(blob){
  const p=blob.player;
  const L = S.legacy || {seasons:0, wins:0, titles:0, yds:0, tds:0};
  const draftBase = p.draftRound<=1? 160000 : p.draftRound===2? 55000 : p.draftRound===3? 22000 : p.draftRound<=5? 8000 : p.draftRound<=7? 3000 : 800;
  const ovrK = Math.max(0, (p.ovr||60)-62); let base = draftBase + ovrK*ovrK*22;
  base *= (MARKET[p.team]||1);
  base *= p.status==="PracticeSquad"? 0.25 : p.status==="Signed"? 1 : 0.6;
  base *= 1 + Math.min(p.yearsPro||0, 8)*0.18;
  base += seasonProd(blob).prod*90*(MARKET[p.team]||1);
  const wins=(blob.schedule||[]).filter(g=>g[7]&&g[7][0]>g[7][1]).length;
  base *= 1+wins*0.04;
  // career body of work: banked seasons, banked production, and rings (each ring is a fame doubling force)
  base += L.yds*45 + L.tds*6000 + L.wins*3500;
  base *= (1 + L.seasons*0.12) * Math.pow(1.5, L.titles);
  // fame compounds superlinearly past a million: stardom generates its own gravity.
  // A decade-long dynasty run lands in LeBron/Ronaldo territory (hundreds of millions).
  if (base > 1e6) base = 1e6 * Math.pow(base/1e6, 1.26);
  const rng=seedRng(blob.careerId+"|foll|"+wkKey(blob.clock));
  return Math.round(Math.min(base*(0.92+rng()*0.16), 2.5e9));
}
function reseedFollowers(blob){
  const target=followerTarget(blob);
  const cur=S.chirp.followers||842;
  if (target>cur){
    const next = cur + Math.round((target-cur)*0.75);
    S.chirp.delta = next-cur; S.chirp.followers = next;
  } else S.chirp.delta = 0;
  S.chirp.seedv = 2;
}
function renderWidget(){
  const p=S.blob.player;
  $("#wg-title").textContent = p.first+" "+p.last+" · #"+p.jersey+" "+p.pos+" · "+p.teamShort;
  $("#wg-week").textContent = gameDate(S.blob.clock)+" · "+wkLabel(S.blob.clock);
  $("#wg-cash").textContent = rosterLabel();
  $("#wg-run").textContent = buzzTier(S.chirp?S.chirp.followers:0);
  const _bi=buzzIdx(); $("#wg-lv").textContent = "Level "+(_bi+1)+"/14";   // v1.6.2 (Ty): show the ladder
  renderNextBar(); renderTrophyBar();
}
/* v1.6 (Ty #1): next-game info slot between the apps and the dock — gametime, network,
   weather + temp. Time is save truth (minutes past midnight); weather is seeded fiction
   from the host city's climate. Dome games say Dome. */
function fmClock(min){
  min=+min; if(!isFinite(min)||min<=0) return "";
  let h=Math.floor(min/60), m=min%60; const ap=h>=12?"PM":"AM"; h=h%12||12;
  return h+":"+String(m).padStart(2,"0")+" "+ap;
}
/* [dome, Jan avg F, Jul avg F] per team city — coarse climate, not a forecast */
const TEAMWX={Bills:[0,25,71],Dolphins:[0,68,84],Patriots:[0,29,74],Jets:[0,33,77],Ravens:[0,35,80],Bengals:[0,32,77],Browns:[0,28,73],Steelers:[0,28,73],Texans:[1,53,85],Colts:[1,28,75],Jaguars:[0,53,82],Titans:[0,38,80],Broncos:[0,31,74],Chiefs:[0,31,81],Raiders:[1,48,92],Chargers:[1,57,70],Cowboys:[1,45,86],Giants:[0,33,77],Eagles:[0,33,78],Commanders:[0,36,80],Bears:[0,26,75],Lions:[1,26,74],Packers:[0,22,71],Vikings:[1,16,74],Falcons:[1,44,81],Panthers:[0,42,80],Saints:[1,54,84],Buccaneers:[0,61,83],Cardinals:[1,56,95],Rams:[1,58,74],"49ers":[0,50,67],Seahawks:[0,42,67]};
function gameWeather(g){
  const host = g[4] ? S.blob.player.team : g[3];
  const wx = TEAMWX[host]; if(!wx) return null;
  if (wx[0]) return {dome:true, label:"Dome"};
  const d = worldToday(S.blob.clock); const mo=d.getMonth();
  const t = wx[1] + (wx[2]-wx[1]) * (1 - Math.abs(mo-6.5)/6.5);   // Jan<->Jul cosine-ish
  const rng = seedRng(S.careerId+"|wx|"+host+wkKey(S.blob.clock));
  const temp = Math.round(t + (rng()*14-7));
  const roll = rng();
  const cond = temp<=32 && roll<0.28 ? "Snow" : roll<0.14 ? "Rain" : roll<0.30 ? "Windy" : roll<0.58 ? "Partly cloudy" : roll<0.74 ? "Overcast" : "Clear";
  return {dome:false, temp, cond, label: temp+"\u00B0F "+cond};
}
/* ---- v1.6.2 (Ty): the trophy case. A slim bar above the next-game strip; opens a sheet
   of what he actually won and when — rings from banked seasons matched against YearSummary
   truth, awards straight from the save. Nothing invented; empty case says so. ---- */
function trophyPieces(){
  const out=[];
  const b=S.blob||{}; const ck=b.clock||{}; const base=(ck.seasonYear||2026)-(ck.seasonIndex||0);
  const teams=(S.legacy&&S.legacy.teams)||{};
  for (const h of (b.history||[])){
    if (teams[h.season] && teams[h.season]===h.champ)
      out.push({ic:"\u{1F3C6}", t:"Super Bowl Champion", sub:(base+h.season)+" \u00b7 "+h.champ+" over "+h.runnerUp+" "+h.hs+"-"+h.as});
  }
  const weekly={};
  for (const a of (b.awards||[])){
    if (!a||!a.type) continue;
    if (/_of_Week$/i.test(a.type)) weekly[a.type]=(weekly[a.type]||0)+1;
    else out.push({ic:"\u{1F3C5}", t:a.type.replace(/_/g," "), sub:(a.season!=null? String(a.season<100? base+a.season : a.season) : "")});
  }
  for (const [t,n] of Object.entries(weekly)) out.push({ic:"\u2B50", t:t.replace(/_/g," "), sub:n>1? "\u00d7"+n : ""});
  return out;
}
function renderTrophyBar(){
  /* v1.7.4 (Ty): My Season took the trophy case's spot on the home strip — the case lives
     INSIDE the sheet now, with past seasons and availability. Element id keeps its name. */
  const el=$("#trophybar"); if(!el) return;
  const p=trophyPieces();
  let gp=0; try{ gp=seasonGP(); }catch(e){}
  el.classList.remove("hidden");
  el.innerHTML = `<span class="tb-ic">\u{1F4CA}</span><span>My Player</span><span class="tb-n">${gp} GP \u00b7 ${p.length? p.length+(p.length===1?" trophy":" trophies") : "case empty"}</span>`;
}
function trophySheet(){
  const p=trophyPieces();
  sheet(`<h3>Trophy case</h3>` + (p.length?
    p.map(x=>`<div class="trophy-row"><span class="t-ic">${x.ic}</span><div><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></div></div>`).join("") :
    `<p class="sp">Nothing in here yet. Rings and hardware land as you win them \u2014 the case only holds what the save says you took.</p>`) +
    `<button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}
function renderNextBar(){
  const bar=$("#nextbar"); if(!bar) return;
  const g=nextGame();
  if(!g){ bar.classList.add("hidden"); return; }
  bar.classList.remove("hidden");
  const day=(g[5]||"Sunday").slice(0,3).toUpperCase();
  const time=fmClock(g[6]);
  const wx=gameWeather(g);
  bar.innerHTML = `<span class="nb-when"><b>${day}</b>${time?" "+time:""}</span>
    <span class="nb-opp"><b>${g[4]?"vs":"@"}</b>${tlogoImg(g[3],"tlogo nb")}</span>
    <span class="nb-net">${netChip(NETMAP(g))}</span>
    ${wx? `<span class="nb-wx">${esc(wx.label)}</span>`:""}`;
}
/* v1.6.1: real saves carry WildcardPlayoff / DivisionalPlayoff / ConferencePlayoff /
   SuperBowl / ProBowl / OffSeason — label them like a human, and never append the raw
   global week number ("ProBowl 22") to a phase that IS the label. */
const WKNAMES={WildcardPlayoff:"Wild Card",DivisionalPlayoff:"Divisional",ConferencePlayoff:"Conf. Championship",SuperBowl:"Super Bowl",ProBowl:"Pro Bowl",OffSeason:"Offseason"};
function wkLabel(c){
  if (c.weekType==="PreSeason") return c.seasonYear+" · Pre Wk "+(c.week+1);
  if (c.weekType==="RegularSeason") return c.seasonYear+" · Week "+(c.week+1);
  return c.seasonYear+" · "+(WKNAMES[c.weekType]||c.weekType);
}
function wkKey(c){ return c.seasonYear+"/"+c.weekType+"/"+c.week; }
function wkKeyLabel(k){ const p=String(k||"").split("/"); return p.length===3? wkLabel({seasonYear:p[0], weekType:p[1], week:+p[2]}) : String(k); }   /* v1.13.1 (Ty: "PreSeason/1" vs "Pre Wk 2" read as two different weeks): one human format everywhere */
function nextGame(){
  const c=S.blob.clock;
  const order = t => t==="PreSeason"?0 : t==="RegularSeason"?1 : 2;
  const cands = S.blob.schedule.filter(g => !g[7] && (order(g[1])>order(c.weekType) || (g[1]===c.weekType && g[0]>=c.week)));
  cands.sort((x,y)=> (order(x[1])-order(y[1])) || (x[0]-y[0]));
  return cands[0];
}
/* Chronologically last played game. The schedule array interleaves PreSeason and
   RegularSeason weeks (both are 0-indexed), so .filter(played).pop() returns a
   preseason game during early RS weeks. Sort by (season, type, week) instead. */
function schedOrd(g){ const t = g[1]==="PreSeason"?0 : g[1]==="RegularSeason"?1 : 2; return (g[2]||0)*10000 + t*100 + g[0]; }
function lastPlayed(sched, type){
  return (sched||S.blob.schedule).filter(g=>g[7] && (!type || g[1]===type)).sort((a,b)=>schedOrd(a)-schedOrd(b)).pop() || null;
}
function notifKey(x){ return "n:"+x.app+":"+(x.t+"|"+x.p).slice(0,60); }
function liveNotifs(includeSeen){
  const out = [];
  const base = (S? S.world.notifs : (D.SEED&&D.SEED.notifications))||[];   /* v1.11.0: no baked seed on the public build */
  for (const x of base) out.push({...x, key:notifKey(x)});
  if (S){
    S.notifSeen = S.notifSeen || {mail:[], texts:{}};
    if (Array.isArray(S.notifSeen.texts)) S.notifSeen.texts={};
    const unreadTexts = S.world.texts.filter(t=>t.msgs.length && t.msgs[t.msgs.length-1][0]!=="me" && !S.reads["t:"+t.id] && (S.notifSeen.texts[t.id]||0) < t.msgs.length);
    for (const t of unreadTexts.slice(0,2)){
      let p=t.msgs[t.msgs.length-1][1]; { const g=splitGroupMsg(p, t.group?t.members:null); if(t.group||g.who) p=g.tx; }
      out.unshift({app:"messages", t:t.name, p, key:"n:messages:"+t.id});
    }
    const unreadMail=(S.world.emails||[]).filter(e=>!S.reads["e:"+e.id] && !S.notifSeen.mail.includes(e.id));
    if (unreadMail.length) out.unshift({app:"tmail", t:"T-Mail", p:unreadMail.length+" unread — "+(unreadMail[0].subj||unreadMail[0].s||""), key:"n:tmail:batch"});
  }
  return includeSeen? out : out.filter(x=> !(S && S.reads[x.key]));
}
function markNotifRead(app){
  if (!S) return;
  for (const x of liveNotifs(true)){
    if (x.app!==app) continue;
    S.reads[x.key]=1;
  }
  S.notifSeen = S.notifSeen || {mail:[], texts:{}};
  if (Array.isArray(S.notifSeen.texts)) S.notifSeen.texts={};
  if (app==="tmail") for (const e of (S.world.emails||[])) if(!S.notifSeen.mail.includes(e.id)) S.notifSeen.mail.push(e.id);
  if (app==="messages") for (const t of S.world.texts) S.notifSeen.texts[t.id]=t.msgs.length;
  persist();
}
function renderLock(){
  const n = liveNotifs();
  const icons = {messages:"ic-msg",huddle:"ic-hud",tmail:"ic-tml",meridian:"ic-mer",chirper:"ic-chr",sync:"ic-sync",chron:"ic-chron",pylon:"ic-pylon",podium:"ic-pod",cal:"ic-cal"};
  $("#lk-notifs").innerHTML = n.slice(0,4).map(x=>`<button class="lk-card" onclick="unlock();markNotifRead('${x.app}');openApp('${x.app}')">
    <span class="ic ${icons[x.app]||'ic-set'}">${GLYPH[x.app]||"•"}</span>
    <span style="min-width:0"><h4>${esc(x.t)}</h4><p>${esc(x.p)}</p></span></button>`).join("");
  $("#lk-careers").innerHTML = META.careers.map(c=>`<button class="career-pick ${c.id===META.activeId?'active':''}" onclick="switchCareer('${c.id}')">
    <span class="l"><h4>${esc(c.label)}</h4><p>${esc(c.sub||"")}</p></span><span class="go">${c.id===META.activeId?"Active":"Open"}</span></button>`).join("")
    + (META.settings.mailToken? `<button class="career-pick" onclick="addCareerFromMailbox()"><span class="l"><h4>+ Add a career from the mailbox</h4><p>Any player synced on this token joins with one tap</p></span><span class="go">Scan</span></button>` : "");   /* v1.12.3 THE SECOND-CAREER DOOR */
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
  /* v1.9.7 (Ty's recording): home STAYS ALIVE under the app layer. Hiding it mid-fade left
     two half-transparent layers over the black body — the dark dip then the pop. The app
     layer is fully opaque; there was never anything to hide. lock()'s own home-hide is
     untouched. */
}
function closeApp(silent){
  /* v1.9.7: the home refresh runs BEFORE the cover leaves — the repaint happens invisibly
     under the opaque app layer, and the close reveals a home that's already fresh. */
  curApp=null;
  if(!silent){ $("#home").classList.remove("hidden"); renderHome(); }
  const v=$("#appview"); v.classList.remove("open"); v.classList.add("hidden");
}
$("#hb").addEventListener("click", ()=>{ if(curApp) closeApp(); });
$("#lk-unlock").addEventListener("click", unlock);


function aphead(title, opts={}){
  return `<div class="aphead">${opts.noback?"":`<button class="back" onclick="${opts.back||"closeApp()"}">‹ ${opts.backlabel||"Home"}</button>`}<h1>${title}</h1>${opts.act?`<button class="hact${opts.actCls?" "+opts.actCls:""}" onclick="${opts.actFn}">${opts.act}</button>`:""}</div>`;
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
    if (!t){ RENDER.messages(b); return; }               // v1.7.5: pruning made dangling ids possible — fall back to the list
    S.reads["t:"+t.id]=1; persist();
    b.innerHTML = aphead(esc(t.name), {back:"renderApp('messages')", backlabel:"Messages", act:"i", actCls:"hinfo", actFn:`convoInfo('${t.id}')`}) +   /* v1.9.0 honesty box; v1.9.6: red-filled and a touch bigger (Ty) */
      `<div class="apbody flush"><div class="chat">` + t.msgs.map((m,mi)=>{
        const me=m[0]==="me"; let who="", tx=m[1];
        if(t.group && !me){ const g=splitGroupMsg(tx, t.members); who=g.who; tx=g.tx; }
        else if(!t.group && !me){ const g=splitGroupMsg(tx); if(g.who) tx=g.tx; } // v1.6.8: leaked pipe prefixes never render in 1:1
        let gap="";
        if (mi>0 && m[2] && t.msgs[mi-1][2] && (m[2]-t.msgs[mi-1][2])>7*86400000)
          gap = `<div class="day">${gapLabel(m[2]-t.msgs[mi-1][2])}</div>`;
        return gap+`<div class="bub ${me?"me":"them"}">${who?`<span class="who">${esc(who)}</span>`:""}${esc(tx)}</div>`;
      }).join("") + `</div></div>
      ${t.id==="agent"&&S.agent? `<div style="padding:4px 12px 0"><button class="btn sm" style="background:rgba(127,212,160,.16);color:#7fd4a0;width:100%" onclick="reqChooser()">\u2691 Make something official</button></div>`:""}
      <div class="composer"><input id="msgin" placeholder="Text ${esc(t.name.split(" ")[0])}" autocomplete="off"><button onclick="sendText('${t.id}')">Send</button></div>`;
    const body=b.querySelector(".apbody"); body.scrollTop=body.scrollHeight;
  } else {
    pruneEmptyThreads(window._openThread); // v1.7.4: a contact you opened and never texted leaves no thread
    /* v1.9.5 THREAD VOLUME (Ty's spec K): a decade of threads has to stay readable. The 20
       most recent stay visible; everything older is ARCHIVED — never erased, searchable.
       Deleting removes only the VIEW; the Ledger keeps the relationship, and a new inbound
       message reopens the thread with history intact. Family and the agent can't be deleted
       at all — hide only, and they resurface on the next inbound. */
    const q=(window._msgQ||"").toLowerCase();
    const all=S.world.texts.slice().filter(t=>!ledgerBlockedNow(t)&&!t.hidden).sort((a,b2)=>(b2.last||0)-(a.last||0));
    const match=t=>!q || t.name.toLowerCase().includes(q) || (t.msgs||[]).some(m=>String(m[1]||"").toLowerCase().includes(q));
    /* v1.9.9 (Ty's report: "i archived a chat and it didnt move"): the old split never
       excluded t.arch from the visible list, and a top-20 archived thread only reached the
       Archived section when it DIDN'T match the search — with no search everything matches,
       so archiving did nothing visible in a small list. Now: visible = the 20 most recent
       NON-archived threads (archiving one frees the slot and the 21st live thread returns);
       Archived = every manual archive + the overflow past 20, search-filtered, newest first. */
    const live=all.filter(t=>!t.arch);
    const vis=live.slice(0,20).filter(match);
    const arch=all.filter(t=>t.arch).concat(live.slice(20)).filter(match).sort((a,b2)=>(b2.last||0)-(a.last||0));
    const row=t=>{
      const last=t.msgs[t.msgs.length-1]||["them",""]; const unread=t.msgs.length&&!S.reads["t:"+t.id];
      let p=last[1]||"Say something."; if(t.group) p=splitGroupMsg(p, t.members).tx;
      return `<button class="thd" style="width:100%" onclick="renderApp('messages',{thread:'${t.id}'})">
        <span class="av" style="background:${t.color||avColor(t.name)}">${initials(t.name)}</span>
        <span class="tx"><h4>${esc(t.name)}${unread?' <span style="color:#2f7cf6">•</span>':''}<time>${t.last?agoLabel(t.last):""}</time></h4><p>${esc((last[0]==="me"?"You: ":""))+esc(p)}</p></span>
        <span class="hact" style="font-size:15px;opacity:.4;padding:6px" onclick="event.stopPropagation();threadSheet('${t.id}')">⋯</span></button>`;
    };
    b.innerHTML = aphead("Messages", {act:"✓ all", actFn:"msgMarkAllRead()"}) + `<div class="apbody flush">
      <div style="padding:6px 14px"><input class="field" placeholder="Search people and messages" value="${esc(window._msgQ||"")}" oninput="window._msgQ=this.value;renderApp('messages')"></div>` +
      (vis.length? vis.map(row).join("") : `<div class="empty" style="color:#8b939c">${q? "Nothing matches.":"No conversations yet."}</div>`) +
      (arch.length? `<div class="hoodhead" style="padding:8px 16px 0;color:var(--ink)"><h3>Archived · ${arch.length}</h3><span onclick="window._msgArch=!window._msgArch;renderApp('messages')" style="cursor:pointer">${(window._msgArch||q)?"hide":"show"}</span></div>`+((window._msgArch||q)? arch.map(row).join(""):""):"") + `</div>`;
  }
};
function threadProtected(t){ return /^(mom|fam\d+|agent)$/.test(t.id); }
function threadSheet(tid){
  const t=S.world.texts.find(x=>x.id===tid); if(!t) return;
  const prot=threadProtected(t);
  /* v1.9.6 (Ty): the two options say plainly what they do — Archive tidies, Delete view
     erases YOUR view only; the Ledger and their memory of him are never touched. */
  sheet(`<h3 style="font-size:16px">${esc(t.name)}</h3>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="const t=S.world.texts.find(x=>x.id==='${tid}');t.arch=!t.arch;persist();closeSheet();renderApp('messages')">${t.arch?"Unarchive":"Archive"}</button>
  <p style="font-size:12px;opacity:.55;margin:4px 2px 10px;line-height:1.5">${t.arch?"Puts the thread back in your main Messages list.":"Tidies the thread into the Archived section below your list. Nothing is deleted, it stays searchable, and you can unarchive it anytime."}</p>
  ${prot? `<p style="font-size:12px;opacity:.55;margin-top:8px;line-height:1.5">Family and your representation can be archived, never deleted; they resurface when they reach out.</p>`
        : `<button class="btn" style="background:rgba(192,57,43,.2);color:#e08074" onclick="const t=S.world.texts.find(x=>x.id==='${tid}');t.hidden=1;persist();closeSheet();renderApp('messages');toast('Thread hidden. They still remember; a new message reopens it.')">Delete view</button>
  <p style="font-size:12px;opacity:.55;margin:4px 2px 0;line-height:1.5">Clears the thread off your phone entirely. It only deletes YOUR view: they keep every memory of how you've treated each other, and any new message from them brings the whole thread back.</p>`}
  <button class="btn" style="background:rgba(255,255,255,.1);margin-top:12px" onclick="closeSheet()">Close</button>`);
}
function msgMarkAllRead(){
  for (const t of S.world.texts) S.reads["t:"+t.id]=1;
  persist(); renderApp('messages'); toast("All read.");
}
async function sendText(tid){
  const inp=$("#msgin"); const v=inp.value.trim(); if(!v) return;
  const t=S.world.texts.find(x=>x.id===tid);
  t.msgs.push(["me", v, Date.now()]); t.last=Date.now(); inp.value=""; ledgerTouchOut(t, v); ledgerGroupFallout(t); persist();   /* v1.9.0/1: the Ledger remembers; the room reacts */
  renderApp("messages",{thread:tid});
  maybeMarkerOffer(t, v);
  if (aiKey()){
    const wait=replyDelayFor(t);
    if (wait){
      /* v1.9.6: a cooler teammate answers when the world next moves — the reply is owed
         in SYNCS (midweek or weekly), never on a wall clock */
      S.pendingReplies=(S.pendingReplies||[]).slice(-9);
      S.pendingReplies.push({tid:t.id, msg:v, epoch:(S.syncEpoch||0), syncs:wait});
      persist(); return;
    }
    const reply = await aiReply(t, v);
    if (reply){ t.msgs.push(["them", reply, Date.now()]); t.last=Date.now(); ledgerTouchIn(t, reply); persist(); if(curApp==="messages") renderApp("messages",{thread:tid}); }
    else maybeDeputy(t, v);   /* v1.9.4: the third time you trash the same guy, he doesn't reply — a teammate does */
  } else { toast("Delivered. Add an API key in Sync for replies."); }
}
async function maybeDeputy(target, userMsg){
  /* escalation, not repetition (Ty's spec 5): a silenced-by-streak teammate stays silent;
     someone with standing steps in instead. Once a week per target, ever only for real
     roster people, always through the stance gate (in-house), always role-prompted. */
  try{
    if (target.group) return;
    const tr=S.blob.roster.find(x=>(x[0]+" "+x[1])===target.name); if(!tr) return;
    const rec=ledgerGet(ledgerKeyFor(target));
    if ((rec.hostileStreak||0)<3 || convoIntent(userMsg)!=="trash") return;
    rec.flags=rec.flags||{}; const wk=wkKey(S.blob.clock);
    if (rec.flags.deputyWk===wk) return; rec.flags.deputyWk=wk;
    const me=S.blob.player.first+" "+S.blob.player.last;
    const dep=S.blob.roster.filter(x=>{const nm=x[0]+" "+x[1]; return nm!==me && nm!==target.name && x[3]>=76;})
      .sort((a,b)=>{const pa=ledgerPersonality(a[0]+" "+a[1]).indexOf("leader")>=0?1:0; const pb=ledgerPersonality(b[0]+" "+b[1]).indexOf("leader")>=0?1:0; return (pb-pa)||(b[3]-a[3]);})[0];
    if (!dep) return;
    const depName=dep[0]+" "+dep[1];
    const sys="You are "+rolePhrase(dep)+", a teammate on the "+S.blob.player.team+", texting "+me+" ("+S.blob.player.pos+"). He has repeatedly been going at "+rolePhrase(tr)+" over text and that teammate has gone quiet. STANCE (the game already chose it; you ONLY word it): "+STANCE_LIB.inhouse+"."+(rosterIsReal(dep)? realSpeechLaw():"")+" Output ONLY the message. Under 35 words. Real texting voice. Never sign or state a name. No em dashes.";
    const line=await callAI(sys, "Write the text now.", 160);
    if (!line) return;
    let th=S.world.texts.find(x=>x.name===depName && !x.group);
    if (!th){ th={id:"dep"+ledgerSlug(depName), name:depName, color:avColor(depName), msgs:[], last:Date.now()}; S.world.texts.unshift(th); }
    th.msgs.push(["them", line.trim(), Date.now()]); th.last=Date.now(); delete S.reads["t:"+th.id];
    ledgerNote(ledgerKeyFor(th), "stepped in over how he was talking to a teammate");
    ledgerNote(ledgerKeyFor(target), "a teammate stepped in on his behalf");
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"messages", t:depName, p:"New message"});
    persist(); if(curApp==="messages") renderApp("messages");
  }catch(e){}
}

/* Chirper */
/* v1.4.1: real art. Files live in phone/img/; every use degrades gracefully if a file is missing. */
const TEAMKEYS = new Set(["jets","giants","patriots","bills","dolphins","steelers","ravens","bengals","browns","texans","colts","titans","jaguars","chiefs","raiders","chargers","broncos","cowboys","eagles","commanders","49ers","seahawks","rams","cardinals","packers","bears","vikings","lions","buccaneers","saints","falcons","panthers"]);
/* v1.5.4: art lives at the REPO ROOT (Ty's uploads land there) — try root first, img/ second,
   then each site's own last resort. artE(el) returns true while retries remain. */
function artE(el){
  if (!el.dataset.r){ el.dataset.r="1"; el.src="img/"+el.src.split("/").pop(); return true; }
  return false;
}
function teamLogo(name){ const k=String(name||"").toLowerCase(); return TEAMKEYS.has(k)? "team-"+k+".png" : null; }
/* v1.7.9 (Ty: the home-strip next game "cuts off the team name"): the bar is one line on a phone —
   full names never reliably fit next to day, time, network chip and weather. Standard NFL
   abbreviations instead; unknown/custom team names fall back to their first three letters. */
const TEAM_ABBR={jets:"NYJ",giants:"NYG",patriots:"NE",bills:"BUF",dolphins:"MIA",steelers:"PIT",ravens:"BAL",bengals:"CIN",browns:"CLE",texans:"HOU",colts:"IND",titans:"TEN",jaguars:"JAX",chiefs:"KC",raiders:"LV",chargers:"LAC",broncos:"DEN",cowboys:"DAL",eagles:"PHI",commanders:"WAS","49ers":"SF",seahawks:"SEA",rams:"LAR",cardinals:"ARI",packers:"GB",bears:"CHI",vikings:"MIN",lions:"DET",buccaneers:"TB",saints:"NO",falcons:"ATL",panthers:"CAR"};
function teamAbbr(name){ return TEAM_ABBR[String(name||"").toLowerCase()] || String(name||"").slice(0,3).toUpperCase(); }
function tlogoImg(name, cls){ const src=teamLogo(name); return src? `<img class="${cls||"tlogo"}" src="${src}" alt="" onerror="if(!artE(this))this.remove()">` : ""; }
/* ---- v1.6.4 (Ty art drop): the pfp pool. World accounts draw a stable profile photo
   from Ty's art by GENDER: pfp-m-N (male people), pfp-f-N (female people), pfp-x-N
   (fan pages, team accounts, meme/pet/scene avatars). The world engine tags every
   invented author with g. Same handle = same photo forever (seeded by handle hash).
   Missing art or an untagged account falls back to initials exactly like before.
   Counts below match the shipped pack; they get bumped whenever Ty sends more art. ---- */
const PFP_COUNTS = { m: 18, f: 0, x: 13 };
function pfpFor(g, key){
  const n = PFP_COUNTS[g] || 0;
  if (!n) return null;
  let h = 0; const k = String(key || "");
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return "pfp-" + g + "-" + (1 + (h % n)) + ".jpg";
}
function chAvatar(c, sm){
  const cls = "av chav" + (sm ? " sm" : "");
  const src = c.n? teamLogo((c.n||"").split(" ")[0]) : null; // "Jets Videos", "Jets" official
  if (src) return `<span class="${cls} teamav"><img src="${src}" alt="" onerror="if(!artE(this))this.parentNode.textContent='${(c.n||"?")[0]}'"></span>`;
  const p = pfpFor(c.g, c.h || c.n);
  if (p) return `<span class="${cls}" style="background:${c.av||avColor(c.n||"?")}"><img src="${p}" alt="" onerror="if(!artE(this))this.remove()"></span>`;
  return `<span class="${cls}" style="background:${c.av||avColor(c.n||"me")}">${initials(c.n||"?")}</span>`;
}
/* v1.7.5 (Ty): whoever has a checkmark in the feed has it in the replies — and a TEAMMATE
   reply is a real verified person with team-style initials, never a random fan headshot. */
function rosterNameSet(){ const set=new Set(); for (const r of (S.blob.roster||[])) set.add((r[0]+" "+r[1]).toLowerCase()); return set; }
/* v1.7.7 (Ty: "a nobody really doesn't need a blue checkmark"): the PLAYER'S own checkmark is
   earned at buzz tier 4 — Local hero, 25k+ followers. Below that, no badge anywhere, even
   though his name is on the roster (teammates keep theirs; he has to grow into his). */
function myVF(){ return (S.chirp && S.chirp.followers||0) > 25000; }
function replyBadge(r){
  const nm=String(r.a||"").toLowerCase();
  const meNm=(S.blob.player.first+" "+S.blob.player.last).toLowerCase();
  if (r.h===S.handle || nm===meNm) return {vf: myVF()?1:0, tm:0};   // v1.7.7: his own badge is earned, not roster-granted
  if (rosterNameSet().has(nm)) return {vf:1, tm:1};
  if (r.vf) return {vf:1, tm:0};
  const h=String(r.h||"").toLowerCase();
  const w=(S.world.chirps||[]).find(c=>String(c.h||"").toLowerCase()===h && c.vf);
  return {vf: w?1:0, tm:0};
}
function replyAvatar(r, bd){
  if (r.h===S.handle && META.settings.pfp) return `<span class="av chav sm"><img src="${META.settings.pfp}"></span>`;
  if (bd.tm) return `<span class="av chav sm" style="background:${avColor(r.a||"?")}">${initials(r.a||"?")}</span>`;
  return chAvatar({n:r.a, h:r.h, g:r.g}, true);
}
const VF = '<i class="vfk"><img src="chirper-verified.png" width="15" height="15" alt="" onerror="if(!artE(this))this.outerHTML=&quot;<svg viewBox=\'0 0 22 22\' width=\'15\' height=\'15\'><circle cx=\'11\' cy=\'11\' r=\'10.5\' fill=\'#1d9bf0\'/><path d=\'M6.2 11.4l3.1 3.1 6.3-6.6\' fill=\'none\' stroke=\'#fff\' stroke-width=\'2.2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>&quot;"></i>';
/* v1.7.7 (Ty: "same person posting basically the same message just to fill it out"):
   dedupe at every merge — same handle + (near-)identical normalized text is dropped, whether
   it collides inside one generation batch or with a chirp already on the feed. */
function normChText(t){ return String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function chDupe(a,b){ if(!a||!b) return false; if(a===b) return true; return (a.length>25&&b.length>25)&&(a.includes(b)||b.includes(a)); }
function dedupeChirps(fresh, existing){
  const seen=(existing||[]).map(c=>({h:String(c.h||"").toLowerCase(), t:normChText(c.t)}));
  const out=[];
  for (const c of (fresh||[])){
    const h=String(c.h||"").toLowerCase(), t=normChText(c.t);
    if (seen.some(x=>x.h===h && chDupe(x.t,t))) continue;
    seen.push({h,t}); out.push(c);
  }
  return out;
}
function dedupeReplies(fresh, existing){
  const seen=(existing||[]).map(r=>({h:String(r.h||"").toLowerCase(), t:normChText(r.x)}));
  const out=[];
  for (const r of (fresh||[])){
    const h=String(r.h||"").toLowerCase(), t=normChText(r.x);
    if (seen.some(x=>x.h===h && chDupe(x.t,t))) continue;
    seen.push({h,t}); out.push(r);
  }
  return out;
}
function chText(t){
  return esc(t).replace(/@([A-Za-z0-9_]+)/g, '<span class="mention">@$1</span>');
}
let chTab="feed"; let chThread=null;
RENDER.chirper = (b,sub)=>{
  b.className="chirper darkapp";
  if (sub && sub.t!==undefined){ chThread=sub.t; }
  const me = S.handle;
  if (chThread!==null){
    const c = chGet(chThread);
    if (!c){ chThread=null; } else {
      if (c.id && aiKey() && (c.rc||0)>0 && !(c.replies||[]).length && !c._fetching) fetchReplies(c.id);   // v1.6.5 self-heal
      b.innerHTML = aphead("Post",{back:"chThread=null;renderApp('chirper')",backlabel:"Chirper"}) + `<div class="apbody flush" style="padding:0 16px 90px">
      <div class="chirp big">
        <div class="ch-row">${c.n? chAvatar(c) : `<span class="av chav" style="background:${c.av||avColor("me")}">${META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last)}</span>`}<div class="ch-main">
        <div class="ch-h"><b>${esc(c.n||S.blob.player.first+" "+S.blob.player.last)}</b>${(c.n? c.vf : myVF())?VF:""}<span>${esc(c.h||me)}</span></div></div></div>
        <p style="margin-top:8px">${chText(c.t)}</p>
        <div class="ch-meta">${fmFoll(c.li||0)} likes · ${fmFoll(Math.max(c.rc||0,(c.replies||[]).length))} replies · ${fmFoll(c.rp||0)} rechirps</div>
        <div class="ch-act"><button onclick="chLike(chThread)">${S.chirpLiked&&S.chirpLiked[chThread]?"♥ Liked":"♡ Like"}</button><button onclick="chReplyBox()">↩ Reply</button></div>
      </div>
      <div id="chReplyBox"></div>
      ${(function(){
      /* v1.7.6 (Ty: "whoever the last reply is from always has an empty text box"): root cause —
         a model reply array cut off at the token limit gets salvaged by the truncation repair,
         which can close the FINAL object right after its name/handle, before "x" ever arrived.
         That husk (a real author, no words) then rendered as a silent bubble. Textless replies
         are dropped at render (which also heals husks already saved), and every reply-array
         intake filters them at the door. */
      const reps=(c.replies||[]).filter(r=>r&&String(r.x||"").trim());
      return `<div class="hoodhead" style="color:var(--ink)"><h3>Replies</h3><span style="color:var(--faint)">${reps.length? ((c.rc||0)>reps.length? "showing the "+reps.length+" most popular of "+fmFoll(c.rc) : reps.length) : ((c.rc||0)>0? "the top replies are still landing" : "0")}</span></div>
      ${reps.map(r=>{const bd=replyBadge(r); return `<div class="chirp reply"><div class="ch-row">${replyAvatar(r,bd)}<div class="ch-main"><div class="ch-h"><b>${esc(r.a)}</b>${bd.vf?VF:""}<span>${esc(r.h)}</span></div><p>${chText(r.x)}</p></div></div></div>`;}).join("") || ((c.rc||0)>0 && c.id? `<div class="empty">The reply section hasn't loaded. ${aiKey()? `<button class="btn sm" style="background:rgba(255,255,255,.12);margin-top:8px" onclick="fetchReplies('${c.id}')">Fetch the top replies</button>` : "Add an API key in Sync to pull them."}</div>` : '<div class="empty">No replies yet.</div>')}`;
      })()}
      </div>`;
      return;
    }
  }
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹ Home</button><h1>Chirper</h1><button class="hact" onclick="editHandle()" style="font-size:12.5px">Edit @</button></div>
  <div class="ch-profile">
    <button class="ch-av" onclick="pickPfpFromChirper()" title="Change photo">${META.settings.pfp?`<img src="${META.settings.pfp}">`:esc(S.blob.player.first[0]+S.blob.player.last[0])}</button>
    <div class="ch-pinfo">
      <b>${esc(S.blob.player.first+" "+S.blob.player.last)}</b>
      <span><button class="hlink" onclick="editHandle()">${esc(me)} ✎</button> · ${esc(S.blob.player.pos)}, ${esc(S.blob.player.teamShort)}</span>
      <div class="ch-follow"><span><b>${fmFoll(S.chirp.followers)}</b> Followers ${S.chirp.delta? `<i class="${S.chirp.delta>0?"up2":"dn2"}">${S.chirp.delta>0?"+":""}${fmFoll(Math.abs(S.chirp.delta))} this wk</i>`:""}</span><span><b>${S.chirp.following}</b> Following</span></div>
    </div>
  </div>
  <div id="chSuggTop"></div><div class="ch-compose"><span class="av chav sm" style="background:#2b6b4f">${META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last)}</span><input id="chQuick" placeholder="What's happening, ${esc(me)}?" oninput="chMention(this)" onkeydown="if(event.key==='Enter')chQuickPost()"><button onclick="chQuickPost()">Post</button></div>
  <div class="apbody flush" id="chList" style="padding:6px 16px 90px"></div>`;
  const el=$("#chList");
  const worldLen = S.world.chirps.length;
  const own = (S.chirp.posts||[]).slice().reverse().map(p=>({own:true, p, pos: Math.max(0, Math.min(worldLen, worldLen - (p.worldMark ?? worldLen)))}));
  const rows=[];
  const renderOwn = p => `<button class="chirp mine" onclick="renderApp('chirper',{t:'${p.id}'})">
      <div class="ch-row"><span class="av chav" style="background:#2b6b4f">${META.settings.pfp?`<img src="${META.settings.pfp}">`:initials(S.blob.player.first+" "+S.blob.player.last)}</span><div class="ch-main">
      <div class="ch-h"><b>${esc(S.blob.player.first+" "+S.blob.player.last)}</b>${myVF()?VF:""}<span>${esc(me)} · you</span></div><p>${chText(p.t)}</p>
      <div class="ch-meta"><span class="chlk" style="opacity:.8">♡ ${fmFoll(p.li||0)}</span> · ${fmFoll(Math.max(p.rc||0,(p.replies||[]).length))} replies · ${fmFoll(p.rp||0)} rechirps</div></div></div></button>`;
  const renderWorld = (c,i) => `<button class="chirp" onclick="renderApp('chirper',{t:'w${i}'})">
      <div class="ch-row">${chAvatar(c)}<div class="ch-main">
      <div class="ch-h"><b>${esc(c.n)}</b>${c.vf?VF:""}<span>${esc(c.h)} · ${c.ts?agoLabel(c.ts):esc(c.tm||"")}</span></div><p>${chText(c.t)}</p>
      <div class="ch-meta"><span class="chlk ${S.chirpLiked&&S.chirpLiked["w"+i]?"on":""}" onclick="event.stopPropagation();chLike('w${i}')">${S.chirpLiked&&S.chirpLiked["w"+i]?"♥":"♡"} ${fmFoll(c.li||0)}</span> · ${fmFoll(Math.max(c.rc||0,(c.replies||[]).length))} replies${c.rp? ` · ${fmFoll(c.rp)} rechirps`:""}</div></div></div></button>`;
  for (let i=0;i<=worldLen;i++){
    for (const o of own) if (o.pos===i) rows.push(renderOwn(o.p));
    if (i<worldLen) rows.push(renderWorld(S.world.chirps[i], i));
  }
  el.innerHTML = rows.join("") || '<div class="empty">Quiet out there.</div>';
};
function chGet(id){ if(String(id).startsWith("w")) return S.world.chirps[+String(id).slice(1)]; return (S.chirp.posts||[]).find(x=>x.id===id); }
function chLike(id){
  const c=chGet(id); if(!c) return;
  S.chirpLiked=S.chirpLiked||{};
  const list=$("#chList"); const sc=list?list.scrollTop:null;
  if (S.chirpLiked[id]){ delete S.chirpLiked[id]; c.li=Math.max(0,(c.li||0)-1); }
  else { S.chirpLiked[id]=1; c.li=(c.li||0)+1; }
  persist();
  if (chThread!==null) renderApp('chirper',{t:chThread});
  else { renderApp('chirper'); requestAnimationFrame(()=>{const nl=$("#chList"); if(nl&&sc!==null) nl.scrollTop=sc;}); }
}
function editHandle(){
  sheet(`<h3>Your handle</h3><p class="sp">This is your @. The world will use it going forward.</p>
  <input class="field" id="hIn" value="${esc(S.handle)}" maxlength="20">
  <button class="btn" style="background:var(--ch-acc);color:#fff" onclick="saveHandle()">Save</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function saveHandle(){
  let v=$("#hIn").value.trim().replace(/\s+/g,"");
  if(!v.startsWith("@")) v="@"+v;
  if(v.length<3) return toast("Too short.");
  S.handle=v; persist(); closeSheet(); renderApp('chirper'); toast("Handle updated to "+v+".");
}
function chReplyBox(){
  $("#chReplyBox").innerHTML = `<div class="chirp" style="border-style:dashed"><textarea id="chRTxt" class="field" style="margin:0 0 8px" rows="2" placeholder="Reply as ${esc(S.handle)}" oninput="chMention(this)"></textarea><div id="chSugg"></div>
  <button class="btn sm" style="background:var(--ch-acc);color:#fff" onclick="chSendReply()">Reply</button></div>`;
}
async function chSendReply(){
  const txt=$("#chRTxt").value.trim(); if(!txt) return;
  const c=chGet(chThread);
  c.replies=c.replies||[]; c.replies.push({a:S.blob.player.first+" "+S.blob.player.last, h:S.handle, x:txt});
  ledgerPublicPost(txt);   /* v1.9.0: public replies count as public words */
  persist(); renderApp('chirper',{t:chThread});
  if (aiKey()){
    const rep = await aiChirpReply(c, txt);
    if (rep){ for (const r of dedupeReplies(rep.filter(r=>r&&String(r.x||"").trim()), c.replies)) c.replies.push(r); persist(); if(chThread===c.id) renderApp('chirper',{t:c.id}); }   // v1.7.6 husks + v1.7.7 dupes filtered
  }
}
async function aiChirpReply(c, mine){
  try{
    const out = await callAI("You write replies on a fake social platform in an NFL life sim. NEVER use real-world journalists, media personalities, or celebrities; only players and coaches from this save may be real, everyone else is invented (naming a real TV network as the broadcast a game aired on is fine). Original post by "+(c.n||"the player")+": \""+c.t+"\". The player ("+S.handle+", a "+povDesc()+") just replied: \""+mine+"\". "+((c.replies&&c.replies.length>1)? "The reply thread so far (continue it, do not restart it): "+c.replies.slice(-6).map(r=>r.a+": \""+r.x+"\"").join(" / ")+". ":"")+careerFactsLine()+" "+accountVoiceLaw()+" Write 2 short realistic replies from OTHER fans or accounts reacting to the player's reply. Mixed tones. Do not use em dashes. Reply ONLY with JSON: [{\"a\":\"display name\",\"h\":\"@handle\",\"g\":\"m|f|x\",\"vf\":0,\"x\":\"reply text\"}] (g: m male, f female, x fan/brand; vf 1 ONLY for teammates, media outlets, and official accounts, fans 0)", "Write the replies now.", 400);
    const arr = JSON.parse(out.replace(/```json|```/g,"").trim());
    return Array.isArray(arr)? arr.slice(0,3) : null;
  }catch(e){ return null; }
}
function pickPfpFromChirper(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>pickFromInput(inp,"pfp") || setTimeout(()=>renderApp("chirper"),600);
  inp.click();
}
function mentionPool(){
  const pool=[];
  for (const r of S.blob.roster.slice(0,75)){
    const h="@"+(r[0][0]+r[1]).replace(/\W/g,"").toLowerCase();
    pool.push({n:r[0]+" "+r[1], h});
  }
  for (const c of S.world.chirps) if(c.h) pool.push({n:c.n, h:c.h});
  const seen={}; return pool.filter(p=>{ if(seen[p.h])return false; seen[p.h]=1; return true; });
}
function chMention(inp){
  const box = inp.id==="chQuick" ? $("#chSuggTop") : $("#chSugg");
  if (!box) return;
  const v=inp.value; const m=v.match(/@([A-Za-z0-9_]*)$/);
  if (!m){ box.innerHTML=""; return; }
  const q=m[1].toLowerCase();
  const hits = mentionPool().filter(p=> p.h.slice(1).toLowerCase().startsWith(q) || p.n.toLowerCase().includes(q)).slice(0,4);
  box.innerHTML = hits.map(p=>`<button class="mchip" onclick="insMention('${inp.id}','${p.h}')">${esc(p.n)} <small>${esc(p.h)}</small></button>`).join("");
}
function insMention(inpId, h){
  const inp=$("#"+inpId); if(!inp) return;
  inp.value = inp.value.replace(/@([A-Za-z0-9_]*)$/, h+" ");
  const box = inpId==="chQuick" ? $("#chSuggTop") : $("#chSugg");
  if (box) box.innerHTML=""; inp.focus();
}
async function aiPostReplies(post, attempt){
  if (!aiKey()) return;
  const f = S.chirp.followers||0;
  /* v1.6 (Ty #10): render only the 5-10 most popular replies for a loud account; small
     accounts still get small-account reply counts. log-scaled, floor 2, ceiling 10. */
  const nReplies = Math.max(2, Math.min(10, Math.round(2 + Math.log10(f+10)*1.55)));
  try{
    const out = await callAI("You write replies on a fake social platform in an NFL life sim. NEVER use real-world journalists, media personalities, or celebrities; only players and coaches from this save may be real, everyone else is invented (naming a real TV network as the broadcast a game aired on is fine). "+S.handle+" ("+povDesc()+", "+S.blob.player.team+", "+f.toLocaleString()+" followers, buzz level: "+buzzTier(f)+") just posted: \""+post.t+"\". "+careerFactsLine()+" "+myPostsLine()+" "+accountVoiceLaw()+chPersonaNote(post.t)+" Write EXACTLY "+nReplies+" short realistic replies. These are the MOST POPULAR replies under the post, scaled to that follower count (a small account gets small-account energy, not viral treatment; a big account's top replies feel like a real viral reply section). Fans, media, or teammates. If a teammate handle is mentioned in the post, one reply MUST be from that teammate. Mixed tones, no em dashes. Output ONLY a JSON array, no prose, no fences: [{\"a\":\"name\",\"h\":\"@handle\",\"g\":\"m|f|x\",\"vf\":0,\"x\":\"text\"}] (g: m male, f female, x fan/brand accounts; vf 1 ONLY for teammates, media outlets, and official accounts — fans 0)", "Write the replies now.", Math.max(600, 220+130*nReplies));
    let arr = parseModelJSON(out);                      // v1.6.2: same hardened ladder as the world call
    if (!Array.isArray(arr)){ arr = arr.replies||arr.items|| (Object.values(arr||{}).find(v=>Array.isArray(v))) || []; }
    if (Array.isArray(arr)) arr = arr.filter(r=>r&&String(r.x||"").trim()); // v1.7.6: a truncation-salvaged husk (author, no words) never gets stored
    if (Array.isArray(arr)) arr = dedupeReplies(arr, post.replies);          // v1.7.7: same account never says the same thing twice
    if (!Array.isArray(arr) || !arr.length) throw new Error("not an array");
    post.replies=(post.replies||[]).concat(arr.slice(0,nReplies));
    post.li=(post.li||0)+Math.round(f*(0.005+Math.random()*0.02));
    if ((post.rc||0)<post.replies.length) post.rc=post.replies.length;
    persist(); if(curApp==="chirper") renderApp("chirper", chThread!==null?{t:chThread}:undefined);
  }catch(e){
    if (!attempt) return aiPostReplies(post, 1);
    toast("Replies didn't generate: "+e.message);
  }
}
/* v1.6.5: a post whose reply fetch failed (pre-armor API hiccup) can heal itself */
function fetchReplies(id){
  const p=(S.chirp.posts||[]).find(x=>x.id===id); if(!p) return;
  if (p._fetching) return; p._fetching=1;
  toast("Pulling the reply section\u2026");
  aiPostReplies(p).finally(()=>{ delete p._fetching; });
}
/* v1.6 (Ty #10): realistic engagement math. A post's TOTAL reply/rechirp counts scale with
   followers; the AI only writes the 5-10 most popular replies for a big account. */
function postEngagement(txt){
  const rng=seedRng(S.careerId+txt);
  const f=S.chirp.followers||0;
  const li=Math.floor(f*(0.02+rng()*0.08));
  const rc=Math.max(0, Math.floor(f*(0.002+rng()*0.010)));
  const rp=Math.floor(li*(0.08+rng()*0.14));
  return {li, rc, rp};
}
function chQuickPost(){
  const el=$("#chQuick"); const txt=el&&el.value.trim(); if(!txt) return;
  S.chirp.posts=S.chirp.posts||[];
  const eng=postEngagement(txt);
  const post={id:"me"+Date.now(), t:txt, li:eng.li, rc:eng.rc, rp:eng.rp, replies:[], worldMark:S.world.chirps.length};
  S.chirp.posts.push(post);
  persist(); renderApp("chirper"); toast("Posted.");
  wlScanPost(post);                                  // v1.7.4: the book reads his posts
  ledgerPublicPost(post.t);                          // v1.9.0: named teammates remember public words
  aiPostReplies(post);
}
function chCompose(){
  sheet(`<h3>New post</h3><textarea id="chNew" class="field" rows="3" placeholder="What's happening, ${esc(S.handle)}?"></textarea>
  <button class="btn" style="background:var(--ch-acc);color:#fff" onclick="chPost()">Post</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function chPost(){
  const txt=$("#chNew").value.trim(); if(!txt) return;
  S.chirp.posts=S.chirp.posts||[];
  const eng=postEngagement(txt);
  const post={id:"me"+Date.now(), t:txt, li:eng.li, rc:eng.rc, rp:eng.rp, replies:[], worldMark:S.world.chirps.length};
  S.chirp.posts.push(post);
  closeSheet(); persist(); renderApp('chirper'); toast("Posted.");
  wlScanPost(post);                                  // v1.7.4: the book reads his posts
  ledgerPublicPost(post.t);                          // v1.9.0: named teammates remember public words
  aiPostReplies(post);
}
/* T-Mail */
RENDER.tmail = (b, sub)=>{
  b.className="tmail lightapp";
  if (sub && sub.mail){
    const m=S.world.emails.find(x=>x.id===sub.mail); m.unread=false; S.reads["e:"+m.id]=1; persist();
    b.innerHTML = aphead("T-Mail", {back:"renderApp('tmail')", backlabel:"Inbox"}) +
      `<div class="apbody flush"><div class="mailread"><h2>${esc(m.subj)}</h2><div class="mfrom">${esc(m.from)} · ${m.ts?agoFull(m.ts):esc(m.time)}</div>${esc(m.body)}</div></div>`;
  } else {
    b.innerHTML = aphead("T-Mail") + `<div class="apbody flush">` + S.world.emails.map(m=>`
      <div class="mail ${m.unread&&!S.reads["e:"+m.id]?"unread":""}" onclick="renderApp('tmail',{mail:'${m.id}'})">
        <div class="frm"><b>${esc(m.from.split(" — ")[0])}</b><time>${m.ts?agoLabel(m.ts):esc(m.time)}</time></div>
        <h4>${esc(m.subj)}</h4><p>${esc(m.body.slice(0,140))}</p></div>`).join("") + `</div>`;
  }
};

/* Chronicle */
/* v1.7.9: the retry card for a story the failed article pass still owes (chronRetry lives with
   writeGameStory beside generateWeek). Shows only while a played game has no story on file. */
function chronRetryBtn(){
  const l=storyOwed(); if(!l) return "";
  const game=(l[4]?"vs ":"@ ")+l[3]+" ("+l[7][0]+"-"+l[7][1]+")";
  return `<div style="padding:10px 0">` + (chronBusy? `<p style="font-size:13px;opacity:.7">${BUSYL}</p>` :
    aiKey()? `<button class="btn sm" style="background:var(--ok);color:#04170d;width:100%" onclick="chronRetry()">Write the game story \u2014 ${esc(game)}</button>
      <p style="font-size:11.5px;opacity:.6;margin:6px 0 0">The sync's story pass failed for this game; this retries it (one model call).</p>`
    : `<p style="font-size:12.5px;opacity:.7">The ${esc(game)} game is played but its story never wrote. Add an API key in Sync and the Chronicle can write it.</p>`) + `</div>`;
}
RENDER.chron = (b, sub)=>{
  b.className="chron lightapp";
  const idx = sub?.a ?? 0; const A = S.world.articles[idx];
  if (!A){
    /* v1.7.9 (Ty): if a played game's story never wrote, say so — and offer to write it. */
    b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹ Home</button><span class="masthead">United Chronicle</span></div>
    <div class="apbody"><div class="empty">${storyOwed()? "Your last game is in the books, but its story never wrote \u2014 the sync's article pass failed." : "No stories on your career yet. The paper writes with your first sync."}</div>${chronRetryBtn()}</div>`;
    return;
  }
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹ Home</button><span class="masthead">United Chronicle</span></div>
  <div class="dateline">${esc(A.wk||"")} · Sports</div>
  <div class="apbody flush"><div class="art">
    <div class="kick">${esc(A.kick)}</div><h1>${esc(A.head)}</h1>
    <div class="stand">${esc(A.stand)}</div><div class="byline">${esc(A.by)}</div>` +
    A.paras.map((p,i)=> (i===4&&A.pq?`<div class="pq">${esc(A.pq)}</div>`:"") + `<p>${esc(p)}</p>`).join("") +
  `</div><div class="more">${chronRetryBtn()}<h3>Earlier coverage</h3>` +
    S.world.earlier.map(e=>`<span class="morelink">${esc(e.h)}<small>${esc(e.s)}</small></span>`).join("") +
    (S.world.articles.length>1? `<h3 style="margin-top:14px">Past features</h3>`+S.world.articles.map((a,i)=> i===idx?"":`<button class="morelink" style="width:100%" onclick="renderApp('chron',{a:${i}})">${esc(a.head)}<small>${esc(a.wk||"")}</small></button>`).join(""):"") +
  `</div></div>`;
};

/* v1.7.4 (Ty): "My Season" left the network — it lives where the trophy case was, on the
   home strip. These helpers feed that sheet. */
function seasonGP(){ let gp=0; for (const r of (S.blob.seasonStats||[])) gp=Math.max(gp,(r&&r.GAMESPLAYED)||0); return gp; } /* v1.7.5: max-merge like everything else — summing across stat tables double-counted games */
function mySeasonStatRows(){
    const p=S.blob.player;
    const merged={};
    for (const s of (S.blob.seasonStats||[])) for (const k in s){ if (k!=="table" && typeof s[k]==="number") merged[k]=Math.max(merged[k]||0, s[k]); }
    const LBL={GAMESPLAYED:"Games played",GAMESSTARTED:"Games started",PASSYARDS:"Pass yards",PASSTDS:"Pass TD",PASSINTS:"INTs thrown",PASSCOMPLETED:"Completions",PASSATTEMPTS:"Attempts",PASSSACKED:"Times sacked",PASSLONGEST:"Longest pass",RUSHYARDS:"Rush yards",RUSHTDS:"Rush TD",RUSHATTEMPTS:"Carries",RUSHLONGEST:"Longest run",RUSHFUMBLES:"Fumbles",RECEIVECATCHES:"Receptions",RECEIVEYARDS:"Receiving yards",RECEIVETDS:"Receiving TD",RECEIVEDROPS:"Drops",RECEIVELONGEST:"Longest catch",DEFTACKLES:"Tackles",ASSDEFTACKLES:"Assisted tackles",DEFTACKLESFORLOSS:"Tackles for loss",DLINESACKS:"Sacks",DLINEHALFSACK:"Half sacks",DSECINTS:"Interceptions",DSECINTTDS:"Pick sixes",DEFPASSDEFLECTIONS:"Pass deflections",DLINEFORCEDFUMBLES:"Forced fumbles",DLINEFUMBLERECOVERIES:"Fumble recoveries",BIGHITS:"Big hits",KICKFGMADE:"FG made",KICKFGATTEMPTS:"FG attempts",KICKFGLONGEST:"Longest FG",KICKEPMADE:"XP made",KICKEPATTEMPTS:"XP attempts",PUNTATTEMPTS:"Punts",PUNTYARDS:"Punt yards",PUNTNETYARDS:"Net punt yards",PUNTIN20:"Inside the 20",PUNTLONGEST:"Longest punt",KRETYARDS:"Kick return yards",KRETTDS:"Kick return TD",PRETYARDS:"Punt return yards",PRETTDS:"Punt return TD",OLINEPANCAKES:"Pancakes",OLINESACKSALLOWED:"Sacks allowed","4QCOMEBACKS":"4th-qtr comebacks",FIRSTDOWNS:"First downs"};
    const NOISE=new Set(["DOWNSPLAYED","STAT_KEEP","SEAS_YEAR","YEARBYYEARTEAMINDEX","GAMERATING","RUSHYARDSAFTER1STHIT","RECEIVEYARDSAFTER","RUSHBROKENTACKLES","RUSH20YARDRUNS","CTHALLOWED","DSECINTRETURNYARDS","DSECINTLONGESTRETURN","DLINEFUMBLERECOVERYYARDS","DLINEBLOCKS","DLINESAFETIES","DLINEFUMBLETDS","KICKNUMKICKOFFS","KICKTOUCHBACKS","PUNTTOUCHBACKS","PUNTBLOCKED","KICKFGBLOCKED","KICKEPBLOCKED","GAMEWINFGSMADE","GAMEWINFGATTEMPTS","KRETATTEMPTS","KRETLONGEST","PRETATTEMPTS","PRETLONGEST"]);
    const want = posStatFields(p.pos);
    const rows = [["Games played", merged.GAMESPLAYED||0],["Games started", merged.GAMESSTARTED||0]];
    for (const f of want) rows.push([LBL[f]||f, merged[f]||0]);
    const shown=new Set(["GAMESPLAYED","GAMESSTARTED",...want]);
    for (const k in merged){ if (!shown.has(k) && !NOISE.has(k) && merged[k]>0 && rows.length<12) rows.push([LBL[k]|| k.toLowerCase().replace(/^./,c=>c.toUpperCase()), merged[k]]); }
    return {rows, merged};
}
function mySeasonSheet(){
    const p=S.blob.player;
    const {rows, merged}=mySeasonStatRows();
    const yrs=(S.legacy&&S.legacy.years)||[];
    const tp=trophyPieces();
    sheet(`<h3>My Player</h3>
    <div style="max-height:62vh;overflow:auto">
    <div class="hoodhead" style="color:var(--ink)"><h3>${esc(p.first+" "+p.last)}</h3><span style="color:var(--faint)">${esc(p.pos)} · #${p.jersey} · ${esc(p.team)} · ${esc(wkLabel(S.blob.clock))}</span></div>
    <div class="scorecard">${rows.map(r=>`<div class="tm"><span>${esc(r[0])}</span><b>${r[1]}</b></div>`).join("")}</div>
    <div class="scorecard"><div class="st"><span>Availability</span></div>
      <div class="tm"><span>Status</span><b style="font-size:13px">${esc(rosterLabel())}</b></div>
      <div class="tm"><span>Health</span><b style="font-size:13px">${p.injury&&p.injury.status!=="Uninjured"?esc(p.injury.status):"Healthy"}</b></div>
      <div class="tm"><span>Confidence</span><b>${p.confidence}</b></div></div>
    ${!merged.GAMESPLAYED?'<p style="font-size:12px;color:var(--faint)">Regular season stats populate as you sync played weeks.</p>':""}
    <div class="hoodhead" style="color:var(--ink);margin-top:10px"><h3>Past seasons</h3></div>
    ${yrs.length? yrs.slice().reverse().map(y=>`<div class="scorecard"><div class="st"><span>${y.y} · ${esc(y.team)}</span></div>
      ${(y.rows||[]).map(r=>`<div class="tm"><span>${esc(r[0])}</span><b>${r[1]}</b></div>`).join("")||'<div class="tm"><span>No stat lines banked</span><b></b></div>'}</div>`).join("")
      : `<p style="font-size:12.5px;color:var(--faint)">Seasons bank here as each year rolls over. The phone can only keep the seasons it lived through.</p>`}
    <div class="hoodhead" style="color:var(--ink);margin-top:10px"><h3>Trophy case</h3></div>
    ${tp.length? tp.map(x=>`<div class="trophy-row"><span class="t-ic">${x.ic}</span><div><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></div></div>`).join("")
      : `<p style="font-size:12.5px;color:var(--faint)">Nothing in the case yet. Rings and hardware land as you win them. It only holds what the save says you took.</p>`}
    </div>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}
/* Pylon — the sports network */
const NETMAP = g => { const day=g[5], t=+g[6];
  if (g[1]==="PreSeason") return "NFLN";
  if (day==="Thursday") return "PRIME"; if (day==="Monday") return "ESPN"; if (day==="Saturday") return "NFLN";
  if (day==="Sunday"){ if (t>=1200) return "NBC"; return ["CBS","FOX"][g[0]%2]; } return "CBS"; };
const NETIMG = {ESPN:"net-espn", NBC:"net-nbc", CBS:"net-cbs-dark", FOX:"net-fox", PRIME:"net-prime", ABC:"net-abc", SNF:"broadcast-sunday-night-football", TNF:"broadcast-thursday-night-football", MNF:"broadcast-monday-night-football", NFLN:"broadcast-nfl-network"};
function netChip(net){
  const f=NETIMG[net];
  if (f) return `<span class="netimg"><img src="${f}.png" alt="${net}" onerror="if(!artE(this))this.parentNode.outerHTML=NETFALL('${net}')"></span>`;
  return NETFALL(net);
}
function NETFALL(net){ return `<span class="net ${net}">${net==="PRIME"?"Prime Video":net}</span>`; }
let pyTab="scores";
RENDER.pylon = b=>{
  b.className="espn";
  b.innerHTML = `<div class="aphead pylon-head"><button class="back" onclick="closeApp()">‹ Home</button><h1><img class="nflsn-emblem" src="nflsn-emblem.png" alt="" onerror="if(!artE(this))this.remove()">NFLSN</h1><span class="hact" style="opacity:.6;font-size:10px">NFL STATS NETWORK</span></div>
  <div class="seg segc" style="background:rgba(255,255,255,.08)">${[["scores","Scores"],["standings","Standings"],["leaders","Leaders"],["records","Records"]].map(t=>`<button class="${pyTab===t[0]?"on":""}" onclick="pyGo('${t[0]}')">${t[1]}</button>`).join("")}</div>
  <div class="apbody" id="pyMain"></div>`;
  pyBody();
};
function pyGo(t){ pyTab=t; pyBody(); $$(".espn .seg button").forEach((x,i)=>x.classList.toggle("on", ["scores","standings","leaders","records"][i]===t)); }
let pyScope="career"; // v1.7.4 Records tab scope
function pyScopeGo(s){ pyScope=s; pyBody(); }
function pyBody(){
  const m=$("#pyMain"); if(!m) return;
  const T=S.blob.player.team;
  const gcard = g=>{ const them=g[3], home=g[4];
    const sc=g[7]; const w = sc && sc[0]>sc[1];
    const rowA = home? [them, sc?sc[1]:null, sc&&!w] : [T, sc?sc[0]:null, w];
    const rowH = home? [T, sc?sc[0]:null, w] : [them, sc?sc[1]:null, sc&&!w];
    const status = sc? "FINAL · "+(g[1]==="PreSeason"?"PRE ":"")+"WK "+(g[0]+1) : g[5].slice(0,3).toUpperCase()+" · "+(g[1]==="PreSeason"?"PRE ":"")+"WK "+(g[0]+1);
    return `<div class="scorecard"><div class="st"><span>${status}</span>${netChip(NETMAP(g))}</div>
      <div class="tm ${sc?(rowA[2]?"win":"lose"):""}"><span>${tlogoImg(rowA[0])}${esc(rowA[0])}</span><b>${rowA[1]??""}</b></div>
      <div class="tm ${sc?(rowH[2]?"win":"lose"):""}"><span>${tlogoImg(rowH[0])}${esc(rowH[0])}</span><b>${rowH[1]??""}</b></div></div>`; };
  if (pyTab==="scores"){
    /* v1.5.7 — character in world, not world around the character (Ty's law). Scores IS the
       league scoreboard: this week's full slate in broadcast order (THU, Sunday windows, SNF,
       MNF), finals with scores, upcoming with day + network. Last week's finals below.
       No my-team history; the game itself has that. The Jets card is just one of sixteen. */
    if (S.blob.league && S.blob.league.games && S.blob.league.games.length){
      const wkNow = S.blob.clock.week; const tp = S.blob.clock.weekType;
      const tn=S.blob.league.teams;
      const all=S.blob.league.games.map(g=>Array.isArray(g)? {t:g[0]===0?"PreSeason":"RegularSeason", w:g[1], h:tn[g[2]], a:tn[g[3]], hs:g[4], as:g[5], played:g[4]>=0} : g).map(g=>Object.assign({}, g, {played: !!g.played && gameRevealed(g.t, g.w)}));   // v1.7.8 reveal law, array AND object games
      const card = (x, wkTag)=>{ const g=x.g;
        /* v1.6.2 (Ty): finals were dropping the broadcast chip and kickoff time — a played
           game still aired somewhere at some time. Keep both on every card. */
        const status = g.played? `FINAL · ${x.day} ${x.time||""} · ${wkTag}` : `${x.day} ${x.time||""} · ${wkTag}`;
        return `<div class="scorecard"><div class="st"><span>${status}</span>${netChip(x.net)}</div>
        <div class="tm ${g.played?(g.as>g.hs?"win":"lose"):""}"><span>${tlogoImg(g.a)}${esc(g.a)}</span><b>${g.played? g.as : ""}</b></div>
        <div class="tm ${g.played?(g.hs>g.as?"win":"lose"):""}"><span>${tlogoImg(g.h)}${esc(g.h)}</span><b>${g.played? g.hs : ""}</b></div></div>`; };
      /* v1.6.1 (live-save bug): league games only carry Pre/RS weeks, so a postseason or
         offseason sync (P10 Pro Bowl, P11 OffSeason) rendered a totally empty slate. Once
         the calendar leaves the regular season, show the season's FINAL week instead. */
      let viewTp=tp, viewWk=wkNow, seasonOver=false;
      if (tp!=="PreSeason" && tp!=="RegularSeason"){
        seasonOver=true; viewTp="RegularSeason";
        const rsWks=all.filter(g=>g.t==="RegularSeason"&&(g.played||g.hs+g.as>0)).map(g=>g.w);
        viewWk=rsWks.length? Math.max(...rsWks) : 0;
      }
      const wkTag = w => (viewTp==="PreSeason"?"PRE ":"")+"WK "+(w+1);
      const thisWk = weekWindows(all.filter(g=>g.t===viewTp && g.w===viewWk), S.careerId+"|"+viewTp+viewWk);
      const lastWk = viewWk>0? weekWindows(all.filter(g=>g.t===viewTp && g.w===viewWk-1 && (g.played||g.hs+g.as>0)), S.careerId+"|"+viewTp+(viewWk-1)) : [];
      m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${seasonOver? "Season finale":"This week"}</h3><span style="color:#8b939c">${seasonOver? wkLabel(S.blob.clock).split(" · ")[1]+" · "+wkTag(viewWk) : wkTag(viewWk)}</span></div>` +
        thisWk.map(x=>card(x, wkTag(viewWk))).join("") +
        (lastWk.length? `<div class="hoodhead" style="color:#fff;margin-top:18px"><h3>${seasonOver? "The week before":"Last week"}</h3><span style="color:#8b939c">${wkTag(viewWk-1)}</span></div>` +
        lastWk.filter(x=>x.g.played).map(x=>card(x, wkTag(viewWk-1))).join("") : "");
    } else {
      const played = S.blob.schedule.filter(g=>g[7]).slice(-2);
      const upcoming = S.blob.schedule.filter(g=>!g[7]).slice(0,2);
      m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${esc(T)}</h3><span style="color:#8b939c">${wkLabel(S.blob.clock)}</span></div>` +
        played.map(gcard).join("") + upcoming.map(gcard).join("") +
        `<p style="font-size:12px;color:#5c6570;margin-top:14px">League-wide scores arrive with your next desktop sync.</p>`;
    }
  }
  if (pyTab==="standings"){
    if (S.blob.league && S.blob.league.teams){
      const recs={}; for (const t of S.blob.league.teams) recs[t.n]={w:0,l:0,ti:0,div:t.d};
      /* v1.7.8: compact-array games never matched .t here (same class of bug the board fixed in
         v1.4) — map first; and the reveal law keeps this week's simmed results out of the table. */
      const stG=(S.blob.league.games||[]).map(g=>Array.isArray(g)? {t:g[0]===0?"PreSeason":"RegularSeason", w:g[1], h:S.blob.league.teams[g[2]].n||S.blob.league.teams[g[2]], a:S.blob.league.teams[g[3]].n||S.blob.league.teams[g[3]], hs:g[4], as:g[5], played:g[4]>=0} : g);
      for (const g of stG){ if(g.t!=="RegularSeason"||!(g.played||g.hs+g.as>0)||!gameRevealed(g.t,g.w)) continue;
        if(g.hs>g.as){recs[g.h].w++;recs[g.a].l++;} else if(g.as>g.hs){recs[g.a].w++;recs[g.h].l++;} else {recs[g.h].ti++;recs[g.a].ti++;} }
      const divs={}; for(const n in recs){ (divs[recs[n].div]=divs[recs[n].div]||[]).push([n,recs[n]]); }
      m.innerHTML = Object.keys(divs).sort().map(d=>`<div class="hoodhead" style="color:#fff"><h3>${esc(d)}</h3></div>
        <table class="stnd"><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th></tr>` +
        divs[d].sort((a,b)=>{const pc=r=>((r.w+0.5*(r.ti||0))/((r.w+r.l+(r.ti||0))||1)); return pc(b[1])-pc(a[1]);}).map(x=>
          `<tr class="${x[0]===T?"you":""}"><td><span class="stnd-team">${tlogoImg(x[0],"tlogo st")}${esc(x[0])}</span></td><td>${x[1].w}</td><td>${x[1].l}</td><td>${(x[1].w+x[1].l+(x[1].ti||0))?(((x[1].w+0.5*(x[1].ti||0))/(x[1].w+x[1].l+(x[1].ti||0))).toFixed(3)).replace(/^0/,""):".000"}</td></tr>`).join("") + `</table>`).join("");
    } else {
      const played = S.blob.schedule.filter(g=>g[7]&&g[1]==="RegularSeason");
      const rec = played.reduce((a,g)=>{g[7][0]>g[7][1]?a[0]++:a[1]++;return a},[0,0]);
      m.innerHTML = `<div class="hoodhead" style="color:#fff"><h3>${esc(T)}</h3></div>
      <table class="stnd"><tr><th>Team</th><th>W</th><th>L</th></tr><tr class="you"><td>${esc(T)}</td><td>${rec[0]}</td><td>${rec[1]}</td></tr></table>
      <p style="font-size:12px;color:#5c6570;margin-top:12px">Full league standings arrive with your next desktop sync.</p>`;
    }
  }
  if (pyTab==="records"){
    /* v1.7.4 (Ty): the record books, straight from the save (exe v1.5.7 ships them).
       League record + this franchise's own record, five scopes, nine categories. */
    const R=S.blob.records;
    if (!R){
      m.innerHTML = `<div class="empty" style="color:#8b939c">The record books ride the sync code once the desktop app is on v1.5.7 or newer. Update TyPhone Sync, resync, and every league and team record the game tracks lands here.</div>`;
    } else {
      const SC=[["career","Career"],["season","Season"],["game","Game"],["rookieSeason","Rook. season"],["rookieGame","Rook. game"]];
      if (!R[pyScope]) pyScope="career";
      /* v1.7.6 (Ty: "team records text ui is a little funky... nfl records look clean"): root cause —
         the exe's LEAGUE rows carry statTypes it overrides to the 9 canonical keys, but the TEAM rows
         carry the save's RAW keys (PassTds, ReceiveTDs, ReceiveCatches, DefensiveTackles...), which
         missed the label map and printed as camelCase mush in a random order. Normalize every key
         to canon, label it, and render BOTH books in the same fixed category order. */
      const RL={PassYards:"Pass yards",PassTDS:"Pass TD",RushYards:"Rush yards",RushTDS:"Rush TD",ReceivingYards:"Receiving yards",ReceivingTDS:"Receiving TD",ReceivingCatches:"Receptions",DefensiveSacks:"Sacks",DefensiveInts:"Interceptions",DefensiveTackles:"Tackles"};
      const CANONMAP={passyards:"PassYards",passtds:"PassTDS",rushyards:"RushYards",rushtds:"RushTDS",receiveyards:"ReceivingYards",receivingyards:"ReceivingYards",receivetds:"ReceivingTDS",receivingtds:"ReceivingTDS",receivecatches:"ReceivingCatches",receivingcatches:"ReceivingCatches",defensivesacks:"DefensiveSacks",defensiveints:"DefensiveInts",defensivetackles:"DefensiveTackles"};
      const CANON=k=>CANONMAP[String(k||"").toLowerCase()]||String(k||"");
      const RORD=["PassYards","PassTDS","RushYards","RushTDS","ReceivingYards","ReceivingTDS","ReceivingCatches","DefensiveSacks","DefensiveInts","DefensiveTackles"];
      const rlabel=k=>{ const c=CANON(k); return RL[c]||c.replace(/([a-z])([A-Z])/g,"$1 $2"); };
      const dedupe=rows=>{ const by={}; for (const r of (rows||[])){ const k=CANON(r[0]); if(!by[k]||r[1]>by[k][1]) by[k]=r; }
        return Object.keys(by).sort((a,b)=>((i=>i<0?99:i)(RORD.indexOf(a)))-((i=>i<0?99:i)(RORD.indexOf(b)))).map(k=>by[k]); };
      const row=(r,showTeam)=>`<div class="tm"><span>${esc(rlabel(r[0]))}</span><b style="font-size:12.5px;text-align:right">${(+r[1]).toLocaleString()} · ${esc(r[2])}${showTeam&&r[4]?", "+esc(r[4]):""}${r[5]?" ("+r[5]+")":""}</b></div>`;
      const T2=S.blob.player.team;
      m.innerHTML = `<div class="seg segc" style="background:rgba(255,255,255,.08);margin:0 0 10px">${SC.map(s=>`<button class="${pyScope===s[0]?"on":""}" style="font-size:11px" onclick="pyScopeGo('${s[0]}')">${s[1]}</button>`).join("")}</div>
      <div class="hoodhead" style="color:#fff"><h3>${esc(T2)} records</h3><span style="color:#8b939c">franchise book</span></div>
      <div class="scorecard">${dedupe(R[pyScope].team).map(r=>row(r,false)).join("")||'<div class="tm"><span>Nothing tracked</span><b></b></div>'}</div>
      <div class="hoodhead" style="color:#fff"><h3>NFL records</h3><span style="color:#8b939c">league book</span></div>
      <div class="scorecard">${dedupe(R[pyScope].league).map(r=>row(r,true)).join("")}</div>`;
    }
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
/* v1.7.4 (Ty: "united chronicle doesnt need a single writer... they have multiple writers"):
   an invented staff pool; the byline is picked deterministically per piece, never by the model. */
const CHRON_POOL=["Dana Okafor","Rafael Castellanos","June Whitaker","Minh Tran","Sade Adeyemi","Piotr Kowalski","Aaron Renfro","Keiko Nakagawa","Luc Boudreaux","Carrie Marsh","Elena Vidal","Hal Strand"];
function chronWriter(key){ return CHRON_POOL[Math.floor(seedRng(S.careerId+"|chron|"+key)()*CHRON_POOL.length)]; }
function hudSub(){ return "h/"+S.blob.player.team.replace(/\W/g,"").toLowerCase()+"nation"; }
/* The Huddle */
RENDER.huddle = (b, sub)=>{
  b.className="huddle";
  /* v1.8.7 (Ty: "clicking upvote brings you to the top"): the vote re-render rebuilds the
     .apbody scroller, which resets scrollTop — capture it and put the reader back. */
  const vote = (id, v)=>{ const sc=b.querySelector(".apbody"); const y=sc? sc.scrollTop : 0;
    S.votes[id]=S.votes[id]===v?0:v; persist(); renderApp("huddle", sub);
    const sc2=b.querySelector(".apbody"); if(sc2) sc2.scrollTop=y; };
  window._hv = vote;
  const score = (base,id)=> base + (S.votes[id]||0);
  const cmtHtml = (c, path, top)=>{
    const id=path; const sc=score(c.up, id); const mine=S.votes[id]||0;
    return `<div class="cmt ${top?"top":""}"><div class="vote">
      <button class="uv ${mine===1?"on":""}" onclick="_hv('${id}',1)">▲</button>
      <b class="${sc<0?"neg":""}">${sc>999?(sc/1000).toFixed(1)+"k":sc}</b>
      <button class="dv ${mine===-1?"on":""}" onclick="_hv('${id}',-1)">▼</button></div>
      <div class="cx"><div class="u"><b>${esc(c.u)}</b>${c.op?'<span class="op">OP</span>':''}${c.awd?`<span class="awd">${c.awd}</span>`:''}<span>· ${(_hOld?"":esc(c.tm))}</span></div>
      <p>${esc(c.t)}</p>
      ${(c.r||[]).map((r,i)=>`<div class="sub">${cmtHtml(r, id+"."+i, false)}</div>`).join("")}</div></div>`;
  };
  if (sub && sub.post){
    const P=S.world.huddle.find(h=>h.id===sub.post);
    window._hOld = !!(P.ts && Date.now()-P.ts > 7*86400000); // old thread: comment "3h" stamps would lie, hide them
    const psc=score(P.up, P.id);
    b.innerHTML = aphead(esc(hudSub()), {back:"renderApp('huddle')", backlabel:"Feed"}) +
    `<div class="apbody flush"><div class="hpost">
      <div class="meta"><span class="flair">${esc(P.flair)}</span><b>u/${esc(P.u)}</b><span>· ${P.ts?agoLabel(P.ts):esc(P.tm)}</span></div>
      <h3>${esc(P.h)}</h3><div class="body">${esc(P.b)}</div>
      <div class="stats"><span>▲ ${psc>999?(psc/1000).toFixed(1)+"k":psc}</span><span>💬 ${countCmts(P)}</span><span>Share</span></div></div>
    <div class="hud-sort"><span class="on">Best</span><span>Top</span><span>New</span><span>Controversial</span></div>` +
    P.cmts.map((c,i)=>cmtHtml(c, P.id+":"+i, true)).join("") + `<div style="height:26px"></div></div>`;
  } else {
    b.innerHTML = aphead("The Huddle") +
    `<div class="hud-sub"><span class="subav">h/</span><b>${esc(hudSub())}</b><span>${112+Math.floor(seedRng("sub"+S.blob.player.team)()*380)}k members · ${(2+Math.floor(seedRng("here"+S.blob.player.team)()*9)).toFixed(1)}k here</span></div>
    <div class="apbody flush hlist">` + S.world.huddle.map(P=>{
      const psc=score(P.up,P.id);
      return `<div class="hpost" onclick="renderApp('huddle',{post:'${P.id}'})">
      <div class="meta"><span class="flair">${esc(P.flair)}</span><b>u/${esc(P.u)}</b><span>· ${P.ts?agoLabel(P.ts):esc(P.tm)}</span></div>
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
  b.innerHTML = `<div class="aphead"><button class="back" onclick="closeApp()">‹ Home</button><h1><span class="mer-logo">M</span> Meridian</h1><span class="hact" style="color:#8a919c;font-size:11px;font-weight:600">Banking for the long season</span></div>
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
    <div class="acct-bal${bal<0?" neg":""}">${fmc(bal)}</div>
    <button class="acct-more" onclick="merShow['${key}']=!merShow['${key}'];merBody()">Show ${open?"less":"more"} ${open?"▴":"▾"}</button>
    ${open? `<div class="acct-detail">${extra||recentFor(key)}</div>`:""}
  </div>`;
}
function acctRows(key){
  return S.ledger.filter(l=> (l.acct||"checking")===key || (l.kind==="move" && (l.from===key||l.to===key)) );
}
function moveLabel(l,key){
  /* v1.8.8 (Ty: "accounts page froze"): four sites push kind:"move" NOTES with no route —
     "paid in full" (extra-principal zero, full payoff, weekly amortization zero) and
     "deal expired". cap(undefined) threw, killing the whole Accounts render every time
     the Checking activity list drew. A routeless move is a note: plain line, no math. */
  if (l.kind!=="move" || (!l.from && !l.to)) return [l.t, l.amt];
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
    m.innerHTML = `${S.cash.checking<0? `<div class="odban"><b>OVERDRAWN</b> Checking is ${fmc(S.cash.checking)}. Overdraft protection pulls from Savings first ($12 transfer fee); an uncovered negative costs $35 plus a credit-score hit at every weekly rollover until you're positive.</div>`:""}
    <div class="mer-sechead">Internal Accounts <span>▾</span></div>
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
    <div class="acct-group"><div class="acct"><div style="font-size:13.5px;line-height:1.55;opacity:.75">${S.blob.player.status==="PracticeSquad"? `Practice squad pays ${fm(psWeekly())} per week for 18 weeks (${fm(psWeekly()*18)} a season). A game-day elevation pays the active weekly rate of ${fm(activeWeekly())} for that week. Signing to the 53 switches every remaining week to the active rate.` : `Active roster: your contract cash lands as ${fm(activeWeekly())} per regular-season week across 18 checks.`} ${isPre?"Preseason pays a $1,750 weekly camp stipend; real checks start Week 1.":""}</div></div></div>
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
    ${S.debts.length?`<div class="mer-sechead">Your debts</div><div class="acct-group">${S.debts.map((d,i)=>{
      const payoffMo = d.pay>0? payoffMonths(d) : null;
      const prog = d.orig? Math.max(0, Math.min(100, Math.round(100*(1-d.bal/d.orig)))) : null;
      return `<div class="acct"><div class="acct-top"><span class="acct-name">${esc(d.n)}</span><span style="font-size:12px;opacity:.6">${d.apr}% APR · ${fm(d.pay)}/mo autopay</span></div>
      <div class="acct-bal" style="font-size:22px">${fm(Math.round(d.bal))}</div>
      ${prog!==null? `<div class="debtbar"><i style="width:${prog}%"></i></div><div style="font-size:11.5px;opacity:.55;margin:2px 0 6px">${prog}% paid down${payoffMo!==null? " · ~"+payoffTxt(payoffMo)+" at this pace":""}</div>` : (payoffMo!==null? `<div style="font-size:11.5px;opacity:.55;margin:2px 0 6px">~${payoffTxt(payoffMo)} at this pace</div>`:"")}
      <div style="display:flex;gap:8px"><button class="btn sm" style="background:#e7f0f8;color:#0b5cad" onclick="payDebtSheet(${i})">Pay extra</button>
      <button class="btn sm" style="background:#0b5cad;color:#fff" onclick="payDebtOff(${i})">Pay off — ${fm(Math.round(d.bal))}</button></div></div>`;}).join("")}</div>`:""}
    <div class="mer-sechead">Your word — markers</div>
    <div class="acct-group"><div class="acct">
    ${markers().length? markers().map((m,i)=>`<div class="payline"><span>${esc(m.dir==="owed"? m.who+" owes you":"You owe "+m.who)} · ${esc(m.what)}<br><small style="opacity:.55">${esc(m.wk)}</small></span>
      <span style="text-align:right">${m.amt>0? fm(m.amt):"TBD"}<br>${m.amt>0?"":`<button class="mer-link" style="color:#8fb8e8" onclick="setMarkerAmt(${i})">Set $</button> `}<button class="mer-link" style="color:#7fd4a0" onclick="settleMarker(${i})">Settle</button> <button class="mer-link" style="color:#ff9d94" onclick="dropMarker(${i})">✕</button></span></div>`).join("")
    : `<div style="font-size:13px;opacity:.65">Nothing on your word yet. Rookie dinners, number deals, promises to family, locker-room bets — when a text turns into an obligation, log it and it lives here until you settle.</div>`}
    <button class="btn sm" style="background:rgba(255,255,255,.1);margin-top:8px" onclick="addMarkerSheet()">+ Log a marker</button>
    </div></div>`;
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
  if(f===t) return toast("Same account selected twice.");
  if(!a||a<=0) return toast("Pick a real amount.");
  if(S.cash[f]<a) return toast("Insufficient funds in that account.");
  S.cash[f]-=a; S.cash[t]+=a; S.ledger.push({t:`Transfer ${cap(f)} to ${cap(t)}`, amt:0, mv:a, from:f, to:t, kind:"move"});
  persist(); merBody(); renderWidget(); toast("Moved "+fm(a));
}
/* v1.6.8 (Ty): MARKERS — your word is a debt. Rookie dinner tabs, jersey-number deals,
   "I'll send you something" texts, friendly bets: log them, the world remembers them, and
   they sit in Meridian until you settle up. Amount can be TBD (a dinner tab isn't a number
   until the check comes). Settling moves real money and writes the ledger. The phone never
   invents a marker — only you log them (it offers when your own text sounds like a promise). */
function markers(){ S.markers=S.markers||[]; return S.markers; }
function myPostsLine(){
  const posts=(S.chirp&&S.chirp.posts||[]).slice(-3).filter(p=>p.t);
  if (!posts.length) return "";
  return "HIS RECENT PUBLIC POSTS (real, public, quotable as his own words; the world reacts to these and ONLY these; never invent posts he didn't make): "+posts.map(p=>'"'+p.t+'" ('+(p.li||0).toLocaleString()+" likes)").join(" | ")+".";
}
function threadMarkerNote(thread){
  const mine=markers().filter(m=> m.tid===thread.id || m.who===thread.name || (thread.group && (thread.members||[]).includes(m.who)));
  if (!mine.length) return "";
  return " THIS conversation is party to these markers (you may bring them up naturally, nag about them, or joke about them): "+mine.map(m=>(m.dir==="owed"? "YOU owe him":"he owes YOU")+" — "+m.what+(m.amt>0?" ("+fm(m.amt)+")":" (amount still TBD)")).join("; ")+".";
}
function markerLine(){
  const mk=markers(); if(!mk.length) return "";
  return "PROMISES ON THE BOOKS (the player's own word, logged by him; the world may bring these up naturally but they are UNPAID until he settles, and the world must NEVER invent other debts or promises): "
    + mk.map(m=>(m.dir==="owed"? m.who+" owes him":"he owes "+m.who)+" — "+m.what+(m.amt>0? " ("+fm(m.amt)+")":" (amount TBD)")).join("; ")+".";
}
function markerPeople(){
  const me=S.blob.player.first+" "+S.blob.player.last;
  const out=[];
  for (const t of S.world.texts.filter(t=>t.group)) out.push({who:t.name, tid:t.id, tag:"group chat"});
  for (const f of (S.perception.familyPeople||[]).filter(f=>f.name)) out.push({who:f.name, tid:"", tag:f.rel+" — family"});
  out.push({who:((S.agent&&S.agent.id!=="self")?S.agent.n:"Apex Front Desk"), tid:"agent", tag:"agent"});
  out.push({who:"Mara Quinn", tid:"mara", tag:"assistant"});
  for (const r of S.blob.roster){ const nm=r[0]+" "+r[1]; if(nm!==me) out.push({who:nm, tid:"", tag:r[2]+" · teammate"}); }
  return out;
}
function addMarkerSheet(prefWho, prefWhat, prefTid){
  const ppl=markerPeople();
  sheet(`<h3>Log a marker</h3><p class="sp">Your word, on the books. Pick a real person or a whole group chat — they'll know about it and can bring it up. Only settling makes it money.</p>
  <label class="flabel">Who</label><select class="field" id="mkWho">${ppl.map(x=>`<option value="${esc(x.who).replace(/"/g,"&quot;")}" data-tid="${x.tid}" ${(prefTid&&x.tid===prefTid)||(!prefTid&&prefWho&&x.who===prefWho)?"selected":""}>${esc(x.who)} · ${esc(x.tag)}</option>`).join("")}</select>
  <label class="flabel">What you said</label><input class="field" id="mkWhat" value="${esc(prefWhat||"")}" placeholder="rookie dinner tab">
  <label class="flabel">Amount ($ — leave blank if TBD)</label><input class="field" id="mkAmt" type="number" min="0" placeholder="TBD">
  <label class="flabel">Direction</label><select class="field" id="mkDir"><option value="owe" selected>I owe them</option><option value="owed">They owe me</option></select>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="addMarkerGo()">Put it on the books</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function addMarkerGo(){
  const sel=$("#mkWho"); const who=(sel.value||"").trim(), what=($("#mkWhat").value||"").trim();
  const tid=(sel.selectedOptions[0]&&sel.selectedOptions[0].dataset.tid)||"";
  if(!who||!what) return toast("Who and what, minimum.");
  const amt=Math.max(0, +$("#mkAmt").value||0);
  markers().push({id:"mk"+Date.now(), who, tid, what, amt, dir:$("#mkDir").value==="owed"?"owed":"owe", wk:wkLabel(S.blob.clock)});
  persist(); closeSheet(); toast("On the books. "+who+" knows."); if(curApp==="meridian") merBody();
}
function settleMarker(i){
  const m=markers()[i]; if(!m) return;
  if (!(m.amt>0)){
    sheet(`<h3>Settle: ${esc(m.what)}</h3><p class="sp">${esc(m.dir==="owed"? m.who+" owes you":"You owe "+m.who)}. What did the number turn out to be?</p>
    <input class="field" id="mkSettleAmt" type="number" min="1" placeholder="Real amount">
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="settleMarkerGo(${i})">Settle it</button>
    ${m.dir!=="owed"? `<button class="btn" style="background:rgba(207,214,223,.14);color:#cfd6df" onclick="window._mkCard=true;settleMarkerGo(${i})">Settle on the Meridian card${cardTier().cb?" ("+cardTier().cb+"% back)":""}</button>`:""}
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
    return;
  }
  settleMarkerGo(i, m.amt);
}
function settleMarkerGo(i, amt){
  const m=markers()[i]; if(!m) return;
  const a = amt || Math.max(1, +$("#mkSettleAmt").value||0);
  if(!(a>0)) return toast("Needs a real number.");
  if (m.dir==="owed"){ S.cash.checking+=a; S.ledger.push({t:"Collected from "+m.who+" — "+m.what, amt:a, kind:"income"}); }
  else if (window._mkCard){ window._mkCard=false; if(!payWithCard(a, "Marker — "+m.who+" ("+m.what+")")) return; }   /* v1.10.0: settle on the card */
  else { S.cash.checking-=a; S.ledger.push({t:"Settled with "+m.who+" — "+m.what, amt:-a, kind:"spend"}); odNotice(); } // checking can go negative like any spend; weekly overdraft rules bite at the burn, the notice fires now
  markers().splice(i,1);
  persist(); closeSheet(); toast(m.dir==="owed"? "Collected "+fm(a)+".":"Settled. Word kept."); if(curApp==="meridian") merBody(); renderWidget();
}
function setMarkerAmt(i){
  const m=markers()[i]; if(!m) return;
  sheet(`<h3>The number came in.</h3><p class="sp">${esc(m.what)} — ${esc(m.dir==="owed"? m.who+" owes you":"you owe "+m.who)}. Set the real amount; it stays on the books until you settle.</p>
  <input class="field" id="mkAmtEdit" type="number" min="1" placeholder="Real amount">
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="setMarkerAmtGo(${i})">Set it</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function setMarkerAmtGo(i){
  const m=markers()[i]; if(!m) return;
  const a=Math.max(1,+$("#mkAmtEdit").value||0); if(!(a>0)) return toast("Needs a real number.");
  m.amt=a; persist(); closeSheet(); if(curApp==="meridian") merBody(); toast(fm(a)+" on the books.");
}
function dropMarker(i){ markers().splice(i,1); persist(); if(curApp==="meridian") merBody(); toast("Off the books."); }
function maybeMarkerOffer(t, msg){
  if (t.id==="coach") return;
  if (!/\b(i(?:'|\u2019)?ll (?:pay|cover|send|get|buy|handle)|i got ?(?:you|chu|u)\b|deal\b|\bbet\b|my treat|put it on me|i owe you|you owe me|tab(?:'s)? on me)\b/i.test(msg)) return;
  S._mkAsk=S._mkAsk||{}; const now=Date.now();
  if (S._mkAsk[t.id] && now-S._mkAsk[t.id]<10*60*1000) return;
  S._mkAsk[t.id]=now;
  const who = t.group? "" : t.name;
  setTimeout(()=>{ sheet(`<h3>That sounded like a promise.</h3><p class="sp">"${esc(msg.slice(0,110))}${msg.length>110?"\u2026":""}"</p>
  <p class="sp">Want it on the books? Markers live in Meridian \u2192 Loans until you settle up, and the world remembers them.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="closeSheet();addMarkerSheet('${esc(t.name).replace(/'/g,"\\'")}','${esc(msg.slice(0,60)).replace(/'/g,"\\'")}','${t.id}')">Log a marker</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Just talk</button>`); }, 350);
}
(D.LOANS.find(l=>l.id==="adv")||{}).apr=28.0; // v1.6.8 Ty ruling: the Salary Advance trap is 28% — data.js stays frozen, the override rides here
function takeLoan(id){
  const L=D.LOANS.find(x=>x.id===id); const amt=+$("#ln-"+id).value;
  if(!amt||amt<1000) return toast("Minimum $1,000.");
  if(amt>L.max) return toast("Max "+fm(L.max)+" on this product.");
  const r=L.apr/100/12, n=L.term, pay=Math.round(amt*r/(1-Math.pow(1+r,-n)));
  S.debts.push({n:L.n, bal:amt, orig:amt, apr:L.apr, pay, kind:"personal"});
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
/* v1.7.7 (Ty: "not a single place for rent and everything is over $1 million... I just need an
   option to live in an apartment or condo for rent close to the training facility"): ONE honest
   rental per market. Rent derives from the metro's cheapest neighborhood index, first month +
   security deposit at signing, replaces the extended-stay bill, deposit comes back when the
   lease ends (or at closing on a bought home). A trade auto-ends the lease. */
function rentInfo(){
  const T=D.METROS[S.blob.player.team]||D.METROS["Jets"];
  const minIdx=Math.min.apply(null, T.hoods.map(h=>h[1]));
  const rent=Math.round((800+1900*minIdx)/25)*25;
  return {city:T.city, rent, dep:rent};
}
function rentSheet(){
  const R=rentInfo();
  sheet(`<h3>1bd apartment near the facility</h3><p class="sp">A clean one-bedroom in a rental building minutes from the practice facility (${esc(R.city)} market). ${fm(R.rent)}/mo. Signing costs first month + security deposit — ${fm(R.rent+R.dep)} total. Your extended-stay hotel bill (${fm(3400)}/mo) ends the day you get keys; the deposit comes back when the lease does.</p>
  <button class="btn" style="background:var(--key-acc);color:#fff" onclick="signLease()">Sign the lease — ${fm(R.rent+R.dep)} today</button>
  <button class="btn" style="background:rgba(127,127,127,.15)" onclick="closeSheet()">Not yet</button>`);
}
function signLease(){
  const R=rentInfo();
  if (S.cash.checking < R.rent+R.dep) return toast("You need "+fm(R.rent+R.dep)+" in checking. You have "+fm(S.cash.checking)+".");
  S.cash.checking-=(R.rent+R.dep);
  S.rental={city:R.city, amt:R.rent, dep:R.dep};
  S.bills=S.bills.filter(x=>x.id!=="stay");
  S.bills.push({id:"rent", n:"Apartment lease near the facility ("+R.city+")", amt:R.rent, cat:"housing"});
  S.ledger.push({t:"Lease signed — first month + deposit ("+R.city+")", amt:-(R.rent+R.dep), kind:"spend"});
  persist(); closeSheet(); toast("Keys in hand. The hotel era is over."); renderApp("keystone"); renderWidget();
}
function endLease(quiet){
  if (!S.rental) return;
  const R=S.rental;
  S.cash.checking+=R.dep;
  S.ledger.push({t:"Security deposit returned — lease ended ("+R.city+")", amt:R.dep, kind:"income"});
  S.rental=null;
  S.bills=S.bills.filter(x=>x.id!=="rent");
  if (!S.properties.length && !S.bills.find(x=>x.id==="stay"))
    S.bills.push({id:"stay", n:"Extended-stay hotel ("+((D.METROS[S.blob.player.team]||{}).city||"team city")+")", amt:3400, cat:"housing"});
  persist();
  if (!quiet){ closeSheet(); toast("Lease ended. Deposit back, hotel bill returns."); if(curApp==="keystone") renderApp("keystone"); renderWidget(); }
}
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
  b.innerHTML = `<div class="brandhead key"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">⌂</div><div><h1>Keystone</h1><small>Homes and land, every market</small></div><button class="hact" style="margin-left:auto;color:#fff" onclick="keyMode=keyMode==='browse'?'build':'browse';renderApp('keystone')">${keyMode==="browse"?"Build your own":"Browse"}</button></div>` +
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
  {
    const R=rentInfo();
    html += S.rental
      ? `<div class="hoodhead"><h3>Your lease</h3><span>renting</span></div>
        <div class="veh-detail light" style="margin-bottom:12px"><div class="vd-title" style="font-size:18px">1bd apartment near the facility</div>
        <div style="font-size:13px;opacity:.6;margin-bottom:6px">${esc(S.rental.city)} · ${fm(S.rental.amt)}/mo · deposit ${fm(S.rental.dep)} held</div>
        <button class="btn sm" style="background:rgba(244,100,92,.15);color:#c0392b" onclick="endLease()">End the lease — deposit back</button></div>`
      : `<div class="hoodhead"><h3>Rentals</h3><span>near the facility</span></div>
        <button class="veh-row light" style="margin-bottom:12px" onclick="rentSheet()">
        <span class="vr-l"><b>1bd apartment near the facility</b><small>${esc(R.city)} market · rental building · no purchase, no mortgage</small></span>
        <span class="vr-r">${fm(R.rent)}/mo</span></button>`;
  }
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
let _mort=null;   // {price, hid, custom, opts:[[dnPct,apr,yrs]...]}
let _closing=null; // {price, down, pay, apr, label}
function mortgageOptions(price, hid, extra){
  const opts=[[0.20, 6.1, 30],[0.10, 6.6, 30],[0.35, 5.7, 15]];
  _mort={price, hid, custom:extra?.custom||null, opts};
  const rows=opts.map((o,i)=>{
    const dn=Math.round(price*o[0]); const principal=price-dn;
    const r=o[1]/100/12, n=o[2]*12; const pay=Math.round(principal*r/(1-Math.pow(1+r,-n)));
    return `<button class="btn" style="background:#fff;color:var(--key-ink);box-shadow:0 2px 8px rgba(19,26,34,.1);text-align:left;display:flex;justify-content:space-between" onclick="buyHouseOpt(${i})">
    <span>${Math.round(o[0]*100)}% down · ${o[2]}yr @ ${o[1]}%</span><span>${fm(pay)}/mo</span></button>`;}).join("");
  return `<div class="hoodhead"><h3>Financing</h3><span>Meridian pre-approval</span></div>${rows}
  <button class="btn" style="background:var(--key-acc);color:#fff" onclick="buyHouseOpt(-1)">Buy in cash — ${fm(price)}</button>`;
}
function buyHouseOpt(i){
  if (!_mort) return;
  const {price, hid, custom, opts}=_mort;
  if (i<0) return buyHouse(price, price, 0, 0, hid, custom);
  const o=opts[i]; const dn=Math.round(price*o[0]);
  const r=o[1]/100/12, n=o[2]*12; const pay=Math.round((price-dn)*r/(1-Math.pow(1+r,-n)));
  buyHouse(price, dn, pay, o[1], hid, custom);
}
function buyHouse(price, down, pay, apr, hid, custom){
  if (S.cash.checking < down) return toast("You need "+fm(down)+" in checking. You have "+fm(S.cash.checking)+".");
  const homes=genHomes(); const H=homes.find(x=>x.id===hid);
  const label = H? H.addr+", "+H.hood : "Custom build — "+(custom?custom.hood:"");
  _closing={price, down, pay, apr, label};
  sheet(`<h3>Close on it?</h3><p class="sp">${esc(label)} for ${fm(price)}${pay?` — ${fm(down)} down, ${fm(pay)}/mo`:" in cash"}. Your extended-stay bill (${fm(3400)}/mo) ends at closing.</p>
  <button class="btn" style="background:var(--key-acc);color:#fff" onclick="confirmHousePending()">Sign & close</button>
  <button class="btn" style="background:rgba(127,127,127,.15)" onclick="_closing=null;closeSheet()">Walk away</button>`);
}
function confirmHousePending(){ const c=_closing; _closing=null; if(c) confirmHouse(c.price, c.down, c.pay, c.apr, c.label); }
function confirmHouse(price, down, pay, apr, label){
  S.cash.checking-=down;
  S.properties.push({n:label, value:price, bought:price});
  if (pay) S.debts.push({n:"Mortgage — "+label, bal:price-down, orig:price-down, apr, pay, kind:"mortgage"});
  if (S.rental){ S.cash.checking+=S.rental.dep; S.ledger.push({t:"Security deposit returned — lease ended at closing", amt:S.rental.dep, kind:"income"}); S.rental=null; }
  S.bills = S.bills.filter(x=>x.id!=="stay" && x.id!=="rent");
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
  b.innerHTML = `<div class="brandhead oct"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">◉</div><div><h1>Octane</h1><small>Every make. Every year.</small></div><button class="hact" style="margin-left:auto;color:#ffb35c" onclick="garSheet()">Garage (${S.garage.length})</button></div>` +
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
  <button class="btn" style="background:rgba(240,127,36,.16);color:var(--oct-acc)" onclick='buyVeh("${C.id}",1)'>${fm(dn)} down · 60mo @ 7.9% — ${fm(pay)}/mo</button>
  <button class="btn" style="background:rgba(207,214,223,.14);color:#cfd6df" onclick='buyVeh("${C.id}",2)'>Meridian card — ${fm(C.price)}${cardTier().cb?` (${cardTier().cb}% back)`:""}</button>`;
}
function buyVeh(id, fin){
  /* v1.10.0: fin 0 = cash, 1 = Octane finance, 2 = FULL PRICE ON THE MERIDIAN CARD */
  const C=genCars().find(x=>x.id===id);
  if (fin===2){ if(!payWithCard(C.price, "Octane — "+C.yr+" "+C.make+" "+C.model)) return; }
  else { const dn=fin? Math.round(C.price*0.1) : C.price;
    if (S.cash.checking<dn) return toast("You need "+fm(dn)+". Checking has "+fm(S.cash.checking)+"."); S.cash.checking-=dn; }
  S.garage.push({n:C.yr+" "+C.make+" "+C.model, value:C.price, body:C.body, id:C.id});
  if (fin===1){ const dn=Math.round(C.price*0.1); const r=0.079/12,n=60,pay=Math.round((C.price-dn)*r/(1-Math.pow(1+r,-n)));
    S.debts.push({n:"Auto — "+C.make+" "+C.model, bal:C.price-dn, orig:C.price-dn, apr:7.9, pay, kind:"auto"}); creditTouch(-8); }   /* v1.10.0: ===1, a card buy is NOT a financing */
  S.bills.find(x=>x.id==="carins") || S.bills.push({id:"carins", n:"Auto insurance", amt:0, cat:"life"});
  S.bills.find(x=>x.id==="carins").amt = Math.round(S.garage.reduce((a,c)=>a+c.value,0)*0.00045)+120;
  if (fin!==2){ const dn2=fin===1? Math.round(C.price*0.1):C.price; S.ledger.push({t:"Octane — "+C.yr+" "+C.make+" "+C.model, amt:-dn2, kind:"spend"}); }
  persist(); toast("It's yours. Insurance adjusted."); renderApp("octane"); renderWidget();
}
const PAINTS=[["Gloss Black","#111",650],["Pearl White","#f2f0ea",800],["Nardo Gray","#7a8087",750],["Racing Red","#c8102e",700],["Miami Blue","#00b1c8",900],["British Green","#0b3d2e",750],["Midnight Purple","#2e1a47",1200],["Chalk","#d9d5cc",850],["Solar Yellow","#f5c400",700],["Copper","#b45f2a",950],["Frozen Matte Black","#1a1a1a",1500],["Chrome Wrap","#c9ced4",2200],["Lime Green","#7ed321",850],["Acid Lime","#c6ff00",950],["Hot Pink","#ff2d78",900],["Rose Pink","#f4a6c6",850],["Magenta Pearl","#c2185b",1100],["Liquid Silver Metallic","#aeb6bf",1050],["Gunmetal Metallic","#4a545e",1000],["Champagne Gold Metallic","#c9a86a",1150],["Deep Ocean Metallic","#123a5e",1050],["Sunset Orange Metallic","#e2571b",1000]];
function garSheet(){
  sheet(`<h3>Garage</h3>` + (S.garage.length? S.garage.map((c,i)=>`<div class="rowline"><div class="l"><h4>${c.color?`<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${c.color};margin-right:6px;border:1px solid rgba(255,255,255,.3)"></span>`:""}${esc(c.n)}</h4><p>${c.colorName?esc(c.colorName)+" · ":""}Value ${fm(c.value)} (drops monthly)</p></div><span style="display:flex;gap:6px"><button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="paintSheet(${i})">Paint</button><button class="btn sm" style="background:rgba(244,100,92,.2);color:#ff9d94" onclick="sellVeh(${i})">Sell</button></span></div>`).join("") : `<p class="sp">Empty. The team facility has a shuttle, but let's be honest.</p>`) +
  `<h4 style="margin:14px 0 4px">Gameday arrival</h4>
  <p class="sp" style="margin:0 0 8px">How you pull up to HOME games. Drive your own car and the players' lot might notice; roll in chauffeured and nobody gets a look. Pure theater — the save never sees it. The chauffeur bills you, though: the fee hits checking for each home game you actually play.</p>` +
  S.garage.map(c=>arrRow("drive","Drive the "+c.n+(c.colorName?" ("+c.colorName+")":""),c.id)).join("") +
  arrRow("sprinter","Chauffeured Sprinter, blacked out \u00b7 $850 per home game") + arrRow("limo","Tinted limo \u00b7 $1,200 per home game") + arrRow("shuttle","Team shuttle (default \u00b7 free)") +
  `<button class="btn sm" style="background:${S.arrival&&S.arrival.card?"rgba(207,214,223,.22)":"rgba(255,255,255,.08)"};color:#cfd6df;margin-top:8px" onclick="S.arrival=S.arrival||{};S.arrival.card=!S.arrival.card;persist();garSheet()">${S.arrival&&S.arrival.card?"\u2713 ":""}Bill rides to the Meridian card</button>
  <button class="btn" style="background:rgba(255,255,255,.1);margin-top:10px" onclick="closeSheet()">Close</button>`);
}
/* v1.7.9 (Ty: "still need option to drive car to home game so people can react to it (or not
   react if chauffeured in a sprinter or tinted limo)"): a Garage setting, pure phone-fiction like
   markers — the save never sees it, THE WALL is untouched. Drive yourself and the world MAY react,
   scaled to real fame; chauffeured means nobody got a look and the law forbids inventing one. */
function arrRow(mode,label,carId){
  const a=S.arrival||{mode:"shuttle"};
  const on = a.mode===mode && (mode!=="drive" || a.carId===carId);
  return `<button class="btn sm" style="display:block;width:100%;text-align:left;margin:4px 0;background:${on?"rgba(255,179,92,.22)":"rgba(255,255,255,.08)"};border:1px solid ${on?"rgba(255,179,92,.5)":"transparent"}" onclick="setArrival('${mode}'${carId?",'"+carId+"'":""})">${on?"\u25cf ":""}${esc(label)}</button>`;
}
function setArrival(mode, carId){ S.arrival={mode:mode||"shuttle", carId:carId||null}; persist(); toast("Gameday arrival set."); garSheet(); }
/* v1.8.9 (Ty's fame-and-fortune flavor, save untouched): a real jet (light and up — piston,
   turboprop, and the owner-flown VLJ are hobby aircraft) carries family and friends to away
   games; at 11+/14 buzz AND real importance to the team, the club lets HIM skip the charter.
   Family seating scales with the same ladder: 14/14 = a suite every game anywhere; 2/14 buys
   their own like anyone. Both are worldFacts truths — texts, chirps, and stories reflect
   exactly this and never better. */
const JET_CLASSES=new Set(["light","midsize","super-mid","large","ultra","bizliner"]);
function ownsJet(){
  for (const pl of (S.planes||[])){
    if (pl.cls){ if (JET_CLASSES.has(pl.cls)) return pl; continue; }
    const hit=(D.PLANEDATA||[]).find(r=> pl.n && pl.n.includes(r[0]+" "+r[1]));   // pre-v1.8.9 purchases carried no class — match the catalog
    if (hit && JET_CLASSES.has(hit[2])) return pl;
  }
  return null;
}
function travelLine(){
  const j=ownsJet(); if(!j) return "";
  const L=buzzIdx()+1;
  const clout = L>=11 && pullTier().score>=45;
  return "\nPRIVATE JET (flavor truth): he owns a "+j.n+". His family and friends fly it to AWAY games — jet-setting family content is fair game. "+(clout
    ? "At his standing ("+L+"/14 buzz, central to the team) the club lets HIM fly it to road games too instead of the team charter; travel content may show him arriving separately."
    : "HE still travels with the team to road games — his standing doesn't buy him off the team plane yet; NEVER write him flying himself to an away game.");
}
function famSeatsLine(){
  const L=buzzIdx()+1;
  const t = L>=14? "the club hands his family and friends a SUITE at every game, home AND away"
    : L>=11? "his family and friends sit in club-level comps, home and away"
    : L>=8?  "his family gets good lower-bowl comps at home; road teams leave a decent pair for away games"
    : L>=5?  "his family gets a pair of comps at home games; on the road they buy their own"
    : L>=3?  "a couple of comp tickets sometimes reach his family when the list isn't tight; mostly they buy their own"
    :        "no comps — his family and friends buy their own tickets like anyone else";
  return "\nFAMILY SEATS (flavor truth, scaled to his standing "+L+"/14): "+t+". Texts, chirps, and stories may reflect exactly this and never better.";
}
function arrivalLine(){
  const a=S.arrival; if(!a || a.mode==="shuttle") return "";
  const n=nextGame(), l=lastPlayed();
  const homeNext = n && n[4], homeLast = l && l[4];
  if (!homeNext && !homeLast) return "";
  const at = homeNext? "arrives at the coming home game" : "arrived at the last home game";
  if (a.mode==="drive"){
    const c=S.garage.find(x=>x.id===a.carId); if(!c) return "";
    return "\nGAMEDAY ARRIVAL: he "+at+" driving his own "+(c.colorName? c.colorName+" ":"")+c.n+" into the players' lot. Fans and lot cameras MAY notice and react (a chirp, a comment, a mention — scaled to his actual fame; a camp body's car draws a shrug or nothing, and that is fine).";
  }
  return "\nGAMEDAY ARRIVAL: he "+at+" chauffeured in a "+(a.mode==="limo"? "tinted limousine":"blacked-out Sprinter van")+" — nobody got a look at him or a car. Do NOT write car-spotting or arrival content about him.";
}
function paintSheet(i){
  const c=S.garage[i];
  sheet(`<h3>Paint the ${esc(c.n)}</h3><p class="sp">Full respray at the shop Octane uses.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px">${PAINTS.map((p,n)=>`<button onclick="doPaint(${i},${n})" style="width:64px;border:none;background:none;color:inherit;font-size:10.5px"><span style="display:block;width:44px;height:44px;border-radius:50%;background:${p[1]};margin:0 auto 4px;border:2px solid ${c.color===p[1]?"#ffb35c":"rgba(255,255,255,.25)"}"></span>${p[0]}<br><small style="opacity:.6">${fm(p[2])}</small></button>`).join("")}</div>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="garSheet()">Back to garage</button>`);
}
function doPaint(i,n){
  const c=S.garage[i]; const p=PAINTS[n];
  if (S.cash.checking<p[2]) return toast("Checking can't cover the respray.");
  S.cash.checking-=p[2];
  c.color=p[1]; c.colorName=p[0];
  S.ledger.push({t:"Respray — "+c.n+" in "+p[0], amt:-p[2], kind:"spend"});
  persist(); toast(c.n+" is now "+p[0]+"."); garSheet(); renderWidget();
}
function recalcCarIns(){
  const b=S.bills.find(x=>x.id==="carins"); if(!b) return;
  if (!S.garage.length){ S.bills=S.bills.filter(x=>x.id!=="carins"); return; }
  b.amt = Math.round(S.garage.reduce((a,c)=>a+c.value,0)*0.00045)+120;
}
function sellVeh(i){
  const c=S.garage[i]; const got=Math.round(c.value*0.94);
  S.cash.checking+=got; S.garage.splice(i,1);
  if (S.arrival && S.arrival.mode==="drive" && S.arrival.carId===c.id) S.arrival={mode:"shuttle"};   // v1.7.9: can't drive a car you sold
  recalcCarIns();
  S.ledger.push({t:"Sold — "+c.n, amt:got, kind:"income"});
  persist(); closeSheet(); toast("Sold for "+fm(got)+" (6% under value; dealers eat)."); renderWidget();
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
    <button class="btn" style="background:var(--yct-acc);color:#fff;margin-top:10px" onclick='buyBoat("${Y.id}")'>Buy — ${fmk(Y.price)}</button>
    <button class="btn" style="background:rgba(207,214,223,.14);color:#cfd6df;margin-top:8px" onclick='buyBoat("${Y.id}",1)'>Meridian card — ${fmk(Y.price)}${cardTier().cb?` (${cardTier().cb}% back)`:""}</button></div>`;
    return;
  }
  const groups=["fishing","dayboat","wake","cruiser","sport","flybridge","sportfish","catamaran","classic","superyacht"];
  b.innerHTML = `<div class="brandhead yct"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">⚓</div><div><h1>Harborline</h1><small>Yacht brokerage since 1958</small></div></div><div class="apbody">` + groups.map(g=>{
    const rows=boats.filter(x=>x.type===g); if(!rows.length) return "";
    return `<div class="hoodhead"><h3 style="text-transform:capitalize">${g==="sportfish"?"Sportfishing":g}</h3><span>${rows.length} vessels</span></div>` +
    rows.map(Y=>`<button class="veh-row light" onclick="renderApp('yachts',{y:'${Y.id}'})">
      <span class="vr-l"><b>${Y.yr} ${esc(Y.maker)} ${esc(Y.model)}</b><small>${Y.len} ft · ${Y.hrs} hrs · upkeep ${fm(Math.round((Y.len*450+Y.price*0.08)/12))}/mo</small></span>
      <span class="vr-r">${fmk(Y.price)}</span></button>`).join("");
  }).join("") + `</div>`;
};
function buyBoat(id, onCard){
  const Y=genBoats().find(x=>x.id===id);
  if (onCard){ if(!payWithCard(Y.price, "Harborline — "+Y.maker+" "+Y.model)) return; }   /* v1.10.0: the card works here */
  else { if (S.cash.checking<Y.price) return toast("You need "+fmk(Y.price)+" liquid. Not yet."); S.cash.checking-=Y.price; }
  S.boats.push({n:Y.yr+" "+Y.maker+" "+Y.model, value:Y.price});
  S.bills.push({id:"dock"+Date.now(), n:"Dockage & yacht upkeep", amt:Math.round((Y.len*450+Y.price*0.08)/12), cat:"toys"});
  if (!onCard) S.ledger.push({t:"Harborline — "+Y.maker+" "+Y.model, amt:-Y.price, kind:"spend"});
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
    <button class="btn" style="background:rgba(207,214,223,.14);color:#cfd6df;margin-top:8px" onclick='buyPlane("${P.id}",1)'>Meridian card — ${fmk(P.price)}${cardTier().cb?` (${cardTier().cb}% back)`:""}</button>
    <p style="font-size:12px;color:var(--faint);margin-top:10px">Charter tiers arrive next iteration. Whole ownership only, like a maniac.</p></div>`;
    return;
  }
  b.innerHTML = `<div class="brandhead pln"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">✈</div><div><h1>Stratos Air</h1><small>Private aviation, whole ownership</small></div></div><div class="apbody">` +
  ["piston","vlj","turboprop","light","midsize","super-mid","large","ultra","bizliner"].map(g=>{
    const rows=planes.filter(x=>x.cls===g); if(!rows.length) return "";
    const label={piston:"Piston",vlj:"Very Light Jets",turboprop:"Turboprops",light:"Light Jets",midsize:"Midsize",["super-mid"]:"Super-Midsize",large:"Large Cabin",ultra:"Ultra Long Range",bizliner:"Bizliners"}[g];
    return `<div class="hoodhead" style="color:var(--ink)"><h3>${label}</h3><span style="color:var(--faint)">${rows.length} aircraft</span></div>` +
    rows.map(P=>`<button class="veh-row" onclick="renderApp('planes',{p:'${P.id}'})">
      <span class="vr-l"><b>${P.yr} ${esc(P.maker)} ${esc(P.model)}</b><small>${P.seats} seats · ${P.hrs} hrs · fixed ${fm(Math.round(P.price*0.06/12))}/mo</small></span>
      <span class="vr-r">${fmk(P.price)}</span></button>`).join("");
  }).join("") + `</div>`;
};
function buyPlane(id, onCard){
  const P=genPlanes().find(x=>x.id===id);
  if (onCard){ if(!payWithCard(P.price, "Stratos — "+P.maker+" "+P.model)) return; }   /* v1.10.0 */
  else { if (S.cash.checking<P.price) return toast("You need "+fmk(P.price)+" liquid for this. The runway metaphor becomes literal."); S.cash.checking-=P.price; }
  S.planes.push({n:P.yr+" "+P.maker+" "+P.model, value:P.price, cls:P.cls});   // v1.8.9: the class rides along (jet vs hobby aircraft)
  S.bills.push({id:"hangar"+Date.now(), n:"Aircraft fixed costs", amt:Math.round(P.price*0.06/12), cat:"toys"});
  if (!onCard) S.ledger.push({t:"Stratos — "+P.maker+" "+P.model, amt:-P.price, kind:"spend"});
  persist(); toast("Wheels up."); renderApp("planes"); renderWidget();
}

/* Apex */
RENDER.apex = (b,sub)=>{
  b.className="apex lightapp";
  if (sub && sub.a){
    const A= sub.a==="self"? Object.assign(SELF_AGENT(), {n:"Represent yourself", age:S.blob.player.age, yrs:S.blob.player.yearsPro,
      willing:"You. Always available, never on another client's call.",
      style:"No fee, no filter between you and the building. And no professional weight behind your asks: front offices negotiate hardest against the man alone at the table, and brands like a buffer. Every dollar saved is real. So is everything an agent would have carried for you."})
      : D.AGENTS.find(x=>x.id===sub.a);   /* v1.9.0: self-representation */
    const mine = S.agent && S.agent.id===A.id;
    const bar = v=>`<span class="agbar"><i style="width:${v*10}%"></i></span>`;
    b.innerHTML = aphead("Apex Sports Group",{back:"renderApp('apex')",backlabel:"Agents"}) + `<div class="apbody">
    <div class="veh-detail light">
      <div class="vd-title">${esc(A.n)}</div>
      <div style="font-size:13px;opacity:.6;margin:-2px 0 10px">Age ${A.age} · ${A.yrs} years experience · ${A.id==="self"? "takes nothing \u2014 every dollar of every contract is yours" : "takes "+A.fee.toFixed(2)+"% of playing contracts"}</div>
      <div class="payline"><span>Contract negotiation<br><small style="opacity:.55">How much money they squeeze out of a front office</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.neg)}<b>${A.neg}/10</b></span></div>
      <div class="payline"><span>Endorsement reach<br><small style="opacity:.55">Which brands pick up when they call</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.end)}<b>${A.end}/10</b></span></div>
      <div class="payline"><span>Aggressiveness<br><small style="opacity:.55">High wins fights and burns bridges; low keeps doors open</small></span><span style="display:flex;align-items:center;gap:8px">${bar(A.agg)}<b>${A.agg}/10</b></span></div>
      <div class="payline"><span>Takes on</span><span style="max-width:55%;text-align:right;font-size:12.5px">${esc(A.willing)}</span></div>
      <p style="font-size:13.5px;line-height:1.55;opacity:.8;margin-top:10px">${esc(A.style)}</p>
    </div>
    ${mine? `<button class="btn" style="background:#e8e2d4;color:#6d5a1f" disabled>Your current agent</button>` :
      `<button class="btn" style="background:var(--apx-acc);color:#fff" onclick="signAgent('${A.id}')">${A.id==="self"? (S.agent? "Go it alone":"Represent yourself") : (S.agent? "Switch to "+esc(A.n.split(" ")[0]) : "Sign with "+esc(A.n.split(" ")[0]))}</button>`}
    <p style="font-size:12px;opacity:.55;margin-top:8px">The fee comes out of every playing check. Switching mid-relationship is legal, common, and remembered.</p></div>`;
    return;
  }
  b.innerHTML = `<div class="brandhead apx"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">AX</div><div><h1>Apex Sports Group</h1><small>Representation for the whole career</small></div></div><div class="apbody">
    <div class="hoodhead"><h3>${S.agent? "Your representation" : "Choose your representation"}</h3></div>
    ${S.agent? `<div class="veh-detail light" style="margin-bottom:14px"><div class="vd-title" style="font-size:19px">${S.agent.id==="self"? "You represent yourself" : esc(S.agent.n)}</div>
      <div style="font-size:13px;opacity:.6">${S.agent.id==="self"? "No fee \u2014 every dollar is yours" : S.agent.fee.toFixed(2)+"% of playing contracts"} · negotiating ${S.agent.neg}/10 · endorsements ${S.agent.end}/10 · aggressiveness ${(S.agent.agg!=null?S.agent.agg:(D.AGENTS.find(x=>x.id===S.agent.id)||{}).agg||"?")}/10</div></div>` :
      `<p style="font-size:13.5px;line-height:1.55;opacity:.75;margin-bottom:14px">Twelve agents at Apex have your camp tape. Every one of them takes a different cut, negotiates differently, and opens different doors. Nothing moves on contracts or endorsements until you pick one.</p>`}
    ${S.agent? `<div class="hoodhead"><h3>${S.agent.id==="self"? "Your own asks":"Through your agent"}</h3><span>what the building owes you</span></div>
    <div class="veh-detail light" style="margin-bottom:14px">
      <p style="font-size:13px;line-height:1.55;opacity:.8;margin:0 0 8px">${(t=> S.agent.id==="self"? `Right now the building sees you as <b>${esc(t.word)}</b>. You carry your own asks, and they get as far as ${esc(t.whoLong)}.` : `"Right now the building sees you as <b>${esc(t.word)}</b>. Anything you want official goes through me, and it gets as far as ${esc(t.whoLong)}."`)(pullTier())}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${Object.entries(REQ_TYPES).map(([k,v])=>`<button class="btn sm" style="background:rgba(0,0,0,.08)" onclick="reqSheet('${k}')">${esc(v.label)}</button>`).join("")}
      </div>
      ${reqListHtml()}
      <p style="font-size:11px;opacity:.5;margin:8px 0 0">The ask is real; the answer is the building's. Snaps requests that land ride the ONE order code. Nothing here ever writes a trade or a release — the save decides those.</p>
    </div>`:""}
    ${depthChartHtml()}
    ${negTableHtml()}
    ${S.agent? `<button class="veh-row light" style="justify-content:center" onclick="window._apexRoster=!window._apexRoster;renderApp('apex')"><span class="vr-l"><b>Other agents at Apex — ${D.AGENTS.length-(S.agent&&S.agent.id!=="self"?1:0)} ${window._apexRoster?"\u25be":"\u25b8"}</b><small>switching is legal, common, and remembered</small></span></button>`
      : `<div class="hoodhead"><h3>The Roster</h3><span>12 agents at Apex</span></div>`}
    ${(!S.agent||window._apexRoster)&&!selfRepped()? `<button class="veh-row light" onclick="renderApp('apex',{a:'self'})">
      <span class="vr-l"><b>Represent yourself</b><small>No fee \u00b7 no agent \u00b7 you carry your own weight</small></span>
      <span class="vr-r" style="font-size:12px;opacity:.6">0.00%</span></button>`:""}
    ${(!S.agent||window._apexRoster)? D.AGENTS.filter(A=>!(S.agent&&S.agent.id===A.id&&window._apexRoster)).map(A=>`<button class="veh-row light" onclick="renderApp('apex',{a:'${A.id}'})">
      <span class="vr-l"><b>${esc(A.n)} ${S.agent&&S.agent.id===A.id?"· ✓ yours":""}</b><small>Negotiation ${A.neg}/10 · Endorsements ${A.end}/10 · Aggressiveness ${A.agg}/10 · Fee ${A.fee.toFixed(2)}%</small></span>
      <span class="vr-r" style="font-size:12px;opacity:.6">${A.yrs} years experience</span></button>`).join(""):""}
    ${(S.deals||[]).filter(d=>d.perYear).length? `<div class="hoodhead" style="margin-top:16px"><h3>Active deals</h3><span>${dealAnnual()? fm(dealAnnual())+"/yr gross":""}</span></div>
    ${S.deals.filter(d=>d.perYear).map(d=>`<div class="veh-detail light" style="margin-bottom:10px"><div class="vd-title" style="font-size:16px">${sponsorImg(d.n)}${esc(d.n)}</div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 6px">${fm(d.perYear)}/yr · ${d.left} season${d.left===1?"":"s"} left${d.inc? " · incentive: "+esc(d.inc.desc)+" pays "+fm(d.inc.amt):""}</div>
      <div style="font-size:12px;opacity:.5">Pays weekly during the season · ${selfRepped()? "no commission \u2014 you represent yourself":"10% Apex endorsement commission"}</div></div>`).join("")}`:""}
    <div class="hoodhead" style="margin-top:16px"><h3>Offers on the table</h3><span>move with your buzz</span></div>
    ${(()=>{const offs=endorsementOffers();
      if (!offs.length) return `<div class="veh-detail light" style="margin-bottom:10px"><div style="font-size:13px;opacity:.65">Nothing live this week. Offers scale with roster status, production, and Chirper buzz (${esc(buzzTier(S.chirp?S.chirp.followers:0))}). Play better, get louder.</div></div>`;
      return offs.map(o=>`<div class="veh-detail light" style="margin-bottom:10px"><div class="vd-title" style="font-size:16px">${sponsorImg(o.brand)}${esc(o.brand)}</div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 6px">${o.years} yr · ${fm(o.perYear)}/yr${o.bonus? " · "+fm(o.bonus)+" signing":""}${o.inc? " · incentive: "+esc(o.inc.desc)+" pays "+fm(o.inc.amt):""}</div>
      <div style="font-size:12px;opacity:.5;margin-bottom:8px">${esc(o.cat)} category · offer expires at next sync</div>
      ${S.deals.find(d=>d.id===o.id)? '<div style="font-size:13px;color:#2e7d32">Signed.</div>' :
        `<button class="btn sm" style="background:var(--apx-acc);color:#fff" onclick="signOffer('${o.id}')">${S.agent? "Sign — "+o.years+"yr / "+fm(o.perYear)+"/yr" : "Need an agent first"}</button>`}</div>`).join("");})()}
    <div class="veh-detail light" style="margin-bottom:10px"><div class="vd-title" style="font-size:17px">${esc((D.METROS[S.blob.player.team]||{city:"Local"}).city)} Deli — name & likeness</div>
      <div style="font-size:13px;opacity:.65;margin:4px 0 8px">$4,500 flat for a sandwich named after you. The "Number ${S.blob.player.jersey}": chicken cutlet, vodka sauce, fresh mozz.</div>
      ${S.deals.find(d=>d.id==="deli")? '<div style="font-size:13px;color:#2e7d32">Signed. The sandwich is in rotation.</div>' :
      `<button class="btn sm" style="background:var(--apx-acc);color:#fff" onclick="signDeli()">${S.agent? "Sign it — $4,500" : "Need an agent first"}</button>`}</div>
    <div class="hoodhead" style="margin-top:16px"><h3>Contract status</h3><span>from the save</span></div>
    <div class="veh-detail light">
      <div class="payline"><span>${esc(S.blob.player.team)}</span><span>${esc(S.blob.player.status==="PracticeSquad"?"Practice Squad":S.blob.player.status)}</span></div>
      ${S.blob.player.status==="PracticeSquad"?`<div class="payline"><span>PS weekly</span><span>${fm(psWeekly())}</span></div>`:`<div class="payline"><span>Active weekly</span><span>${fm(activeWeekly())}</span></div>`}
      <div class="payline"><span>Active contract on file</span><span>${fm((S.blob.player.contract?.salary?.[0])||S.blob.player.capSalary)}/yr</span></div>
      <div class="payline"><span>Elevations used</span><span>0 of 3</span></div></div>
  </div>`;
};
function signDeli(){
  if (!S.agent) return toast("Pick an agent first. This is what they are for.");
  if (S.deals.find(d=>d.id==="deli")) return;
  S.deals.push({id:"deli", n:(D.METROS[S.blob.player.team]||{city:"Local"}).city+" Deli", amt:4500});
  const cut = Math.round(4500*(S.agent.fee/100));
  S.cash.checking += 4500-cut;
  S.ledger.push({t:(D.METROS[S.blob.player.team]||{city:"Local"}).city+" Deli — name & likeness", amt:4500, kind:"income"});
  if (cut) S.ledger.push({t:"Apex commission — deli deal", amt:-cut, kind:"spend"});
  persist(); toast("Signed. The Number "+S.blob.player.jersey+" is in rotation. "+fm(4500-cut)+" after the fee.");
  renderApp("apex");
}
function sponsorSlug(n){ return n.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function sponsorImg(n){ return `<img class="sponslogo" src="sponsor-${sponsorSlug(n)}.png" alt="" onerror="if(!artE(this))this.remove()">`; }
/* v1.6 (Ty #9): the fake pipeline (Crestline "on hold", scouting filler) is dead. Real
   brands make CONCRETE offers — years, $/yr, signing bonus, incentives — scaled to buzz
   tier, status, production, market, and the agent's endorsement reach. Deals pay weekly
   during the season (10% endorsement commission, separate from the playing-contract fee),
   burn a season at each rollover, and expire when their years run out. Money still never
   buys ratings. */
function buzzIdx(){ const tiers=["Unknown","Local curiosity","Beat-writer radar","Local hero","Fan favorite","League-wide buzz","National story","Household name","Superstar","Face of the league","Transcends the sport","Global icon","One of one","Bigger than the game"]; return tiers.indexOf(buzzTier(S.chirp?S.chirp.followers:0)); }
function dealAnnual(){ return (S.deals||[]).filter(d=>d.perYear&&d.left>0).reduce((a,d)=>a+d.perYear,0); }
function endorsementOffers(){
  const bi=buzzIdx(); const f=S.chirp?S.chirp.followers:0;
  const p=S.blob.player;
  const nOffers = p.status==="PracticeSquad"? (bi>=3?1:0) : Math.min(3, Math.max(0, bi-1));
  if (!nOffers) return [];
  const activeCap = 1 + Math.floor(bi/2);
  if ((S.deals||[]).filter(d=>d.perYear&&d.left>0).length>=activeCap) return [];
  if (selfConductCold()) return [];   /* v1.9.0: no rep to smooth conduct over — brands go quiet, never explained */
  const rng=seedRng(S.careerId+"|offers|"+wkKey(S.blob.clock));
  const pool=D.SPONSORS.filter(x=>!["media","equipment"].includes(x[1]) && !(S.deals||[]).some(d=>d.n===x[0]));
  const reach=S.agent? S.agent.end:5;
  const mkt=(typeof MARKET!=="undefined" && MARKET[p.team])||1;
  const base = 6000 * Math.pow(2.05, bi) * (0.75+0.05*reach) * mkt * (p.status==="PracticeSquad"?0.35:1);
  const out=[]; const used={};
  while (out.length<nOffers && out.length<pool.length){
    const b=pool[Math.floor(rng()*pool.length)]; if(used[b[0]]) continue; used[b[0]]=1;
    const years = 1 + Math.floor(rng()*Math.min(3, 1+Math.floor(bi/3)));
    const perYear = Math.round(base*(0.7+rng()*0.7)/500)*500;
    const bonus = bi>=5? Math.round(perYear*(0.1+rng()*0.2)/500)*500 : 0;
    const incPool=[["Playoff berth","the team makes the playoffs"],["Pro Bowl nod","a Pro Bowl selection"],["1,000-yard season","a 1,000-yard season"],["Double-digit sacks","10+ sacks"],["League award","any league award"]];
    const pick=incPool[Math.floor(rng()*incPool.length)];
    const inc = rng()<0.55? {desc:pick[0], amt:Math.round(perYear*0.25/500)*500} : null;
    out.push({id:"end-"+sponsorSlug(b[0]), brand:b[0], cat:b[1], years, perYear, bonus, inc});
  }
  return out;
}
function signOffer(id){
  if (!S.agent) return toast("Pick an agent first. This is what they are for.");
  const o=endorsementOffers().find(x=>x.id===id);
  if (!o) return toast("That offer moved on.");
  if (S.deals.find(d=>d.id===id)) return;
  S.deals.push({id:o.id, n:o.brand, cat:o.cat, perYear:o.perYear, years:o.years, left:o.years, inc:o.inc, startWk:wkKey(S.blob.clock)});
  if (o.bonus){ const cut=selfRepped()?0:Math.round(o.bonus*0.10);   /* v1.9.0: no Apex, no commission */ S.cash.checking+=o.bonus-cut;
    S.ledger.push({t:o.brand+" — signing bonus", amt:o.bonus, kind:"income"});
    if (cut) S.ledger.push({t:"Apex endorsement commission — "+o.brand, amt:-cut, kind:"spend"}); }
  persist(); renderApp("apex"); renderWidget();
  toast("Signed with "+o.brand+": "+o.years+"yr, "+fm(o.perYear)+" a year.");
}
function sweepNet(amt){
  /* v1.8.7: THE ONE SWEEP DOOR. Auto-Sweep skims tax + savings off every income stream —
     game checks, camp stipends, endorsement pay — same percentages, silently into the
     buckets (matching the game-check precedent: the deposit records the net). */
  if (!S.autosweep) return amt;
  const tx=Math.round(amt*S.sweepPct.tax/100), sv=Math.round(amt*S.sweepPct.savings/100);
  S.cash.tax+=tx; S.cash.savings+=sv; return amt-tx-sv;
}
function dealWeekPay(y, w){
  const gross=dealAnnual(); if(!gross) return;
  const wk=Math.round(gross/18), cut=selfRepped()?0:Math.round(wk*0.10);   /* v1.9.0: no Apex, no commission */
  S.cash.checking+=sweepNet(wk-cut);
  S.ledger.push({t:"Endorsement pay — week "+(w+1), amt:wk, kind:"income"});
  if (cut) S.ledger.push({t:"Apex endorsement commission", amt:-cut, kind:"spend"});
}
function dealSeasonRoll(){
  for (const d of (S.deals||[])) if (d.perYear && d.left>0) d.left--;
  const done=(S.deals||[]).filter(d=>d.perYear && d.left===0);
  for (const d of done) S.ledger.push({t:d.n+" deal expired", amt:0, kind:"move"});
  S.deals=(S.deals||[]).filter(d=>!(d.perYear && d.left===0));
}
function sponsorWatchers(){ /* DEAD v1.6: fake "scouting" filler replaced by endorsementOffers; kept per helper-deletion law */
  const rng=seedRng(S.careerId+"|sponsors|"+wkKey(S.blob.clock));
  const pool=D.SPONSORS.filter(s=>!["media","equipment"].includes(s[1])); // v1.5.2: 190+ brand pool; media/equipment stay out of personal-endorsement scouting
  const picks=[]; const used={};
  while (picks.length<3 && picks.length<pool.length){ const p=pool[Math.floor(rng()*pool.length)]; if(used[p[0]])continue; used[p[0]]=1; picks.push(p); }
  return picks;
}
/* v1.7.3 (Ty: picked Carmen, texting her hit the old front-desk persona): the agent thread's
   name and character now FOLLOW the signing. The persona is recomputed on every reply, so a
   cached front-desk identity can never refuse to know she signed you. */
function fixAgentThread(){
  const th=S.world&&S.world.texts&&S.world.texts.find(t=>t.id==="agent");
  if (!th) return;
  /* v1.9.1 root cause: a DROPPED agent kept fronting the thread — the rename was gated on
     S.agent existing. Agentless of any kind — pre-pick, self-rep, or just dropped — the
     thread wears the front desk, unconditionally. */
  const want = (S.agent && S.agent.id!=="self")? S.agent.n : "Apex Sports Group";
  if (th.name!==want) th.name=want;
  th.persona = agentPersona();
}
function agentPersona(){
  if (S.agent && S.agent.id==="self")
    return "The front desk at Apex Sports Group. He REPRESENTS HIMSELF — Apex holds no mandate and takes no fee. Professional and courteous: take messages, answer general building questions, leave the door open without pushing. Never claim to be his agent, never negotiate for him.";
  return S.agent
    ? S.agent.n+" — HIS SIGNED AGENT at Apex Sports Group. The signing already happened and the representation is ACTIVE; never deny it, never route him to the front desk. First-name basis, direct, protective, negotiates his contracts and endorsements, blunt about money. Knows exactly where the client stands in the building (currently: "+pullTier().word+") and is honest about how far requests can go — never promises outcomes, never claims a move happened unless the save's news says so."
    : "The front desk at Apex Sports Group. He has NOT picked an agent yet — take messages, be professional, and nudge him to choose representation in the Apex app.";
}
/* ============================ THE PULL SYSTEM — drop one ============================
   v1.7.4 (Ty's design): how much does the BUILDING need you? Computed from save truth only:
   OVR vs the position room and roster, own contract money, draft capital, real snaps/starts,
   status, years. Rookies who haven't played start near zero regardless of talent — the save
   Ty is living (99 OVR, undrafted, zero snaps) is the exact case: the building owes him
   nothing yet. The score is NEVER shown as a number in-fiction; it decides WHO answers.
   Drop one ships: the ladder + routing, request submission through the agent, the queue,
   and snaps/depth-chart requests resolving FOR REAL through the existing order code.
   Everything else comes back as brush-offs and refusals (real outcomes, honestly worded);
   partial grants, deferrals-with-windows, and spendable capital are drop two. The phone
   NEVER writes a trade or a release — the wall stands. */
function pullScore(){
  try{
    const b=S.blob||{}; const p=b.player||{}; const roster=b.roster||[];
    const room=roster.filter(r=>r[2]===p.pos).map(r=>r[3]).sort((a,b2)=>a-b2);
    const pct=(arr,v)=>arr.length? arr.filter(x=>x<=v).length/arr.length : 0.5;
    const posPct=pct(room, p.ovr||60);
    const allPct=pct(roster.map(r=>r[3]).sort((a,b2)=>a-b2), p.ovr||60);
    const dr=p.draftRound;
    const draftPts = dr==null?0 : (dr>=63||dr<1)?1 : dr===1?12 : dr===2?9 : dr===3?7 : dr<=5?4 : 2;
    const cap=(((p.contract||{}).salary||[]).reduce((a,x)=>a+(+x||0),0)/Math.max(1,(p.contract||{}).length||1)) || p.capSalary || 0;
    const capPts = cap>=25e6?20 : cap>=15e6?16 : cap>=8e6?12 : cap>=4e6?8 : cap>=1.5e6?4 : 1;
    let gp=0,gs=0; for (const r of (b.seasonStats||[])){ gp=Math.max(gp,r.GAMESPLAYED||0); gs=Math.max(gs,r.GAMESSTARTED||0); }
    const teamG=Math.max(1,(b.schedule||[]).filter(g=>g[7]&&g[1]==="RegularSeason").length);
    const rolePts = 20*Math.min(1,gs/teamG) + 6*Math.min(1,gp/teamG) + (p.status==="PracticeSquad"? -8 : 2);
    const vetPts = Math.min(8,(p.yearsPro||0))*1.25;
    /* v1.9.6 (extractor additive, the long-queued cap-rank): when roster rows carry real
       teammate cap hits (idx 8, dollars), his standing ON THIS ROSTER's payroll adds up to
       6 pts. Absolute capPts still anchors league reality; this is the local rank on top.
       Legacy 6-slot rows contribute nothing — pre-additive scores are unchanged. */
    let capRankPts = 0;
    const teamCaps = roster.filter(r=>r.length>8 && +r[8]>0).map(r=>+r[8]).sort((a,b2)=>a-b2);
    if (teamCaps.length>=10) capRankPts = 6*pct(teamCaps, cap);
    let s = 30*posPct + 12*allPct + capPts + draftPts + rolePts + vetPts + capRankPts;
    if ((p.yearsPro||0)===0 && gs===0) s = Math.min(s, 8 + draftPts*0.8 + (gp>0?6:0)); // rookie gate
    return Math.max(0, Math.min(100, Math.round(s)));
  }catch(e){ return 0; }
}
const PULL_TIERS=[
  [10,"a camp body","a position coach, maybe","the assistants"],
  [25,"roster fringe","your position coach","the position coach"],
  [45,"a rotational piece","the coordinator","the coordinator"],
  [65,"a starter","the head coach himself","the head coach"],
  [85,"a cornerstone","the general manager","the GM"],
  [101,"the franchise","ownership","the owner"]];
function pullTier(){ const s=pullScore(); for (const t of PULL_TIERS) if (s<t[0]) return {score:s, word:t[1], whoLong:t[2], who:t[3]}; return {score:s, word:"the franchise", whoLong:"ownership", who:"the owner"}; }
/* ============ v1.12.0 THE WRITEBACK EXPANSION — save-truth persona, depth, and the table ============
   The exe (v1.7.0) grew roster rows to 14 slots (10 captain / 11 ego / 12 motiv indices /
   13 personalityRating), and the blob gained motiv (dictionary), depth (Team.DepthChart truth,
   named position lists), negotiations (PersonaNegotiation hooks) and teamCap (dollars). Every
   read here GUARDS length/nullness — legacy blobs behave exactly as before. */
function rosterRowFor(name){ return S.blob&&S.blob.roster&&S.blob.roster.find(x=>(x[0]+" "+x[1])===name)||null; }
function motivName(i){ const M=(S.blob&&S.blob.motiv)||[]; return M[i]||""; }
const MOTIV_WORDS={ChampionshipContender:"chasing a ring",SchemeFit:"scheme fit",CloseToHome:"staying close to home",WarmWeatherState:"warm weather",BigMarket:"a big market",HeadCoachHistoricRecord:"playing for a proven coach",HighestOffer:"the biggest number",MentoratPosition:"a mentor at his position",NoIncomeTax:"keeping the tax man away",TeamHasFranchiseQB:"a real quarterback situation",TeamPrestige:"a prestige franchise",ToptheDepthChart:"a clear path to starting"};
function rosterPersona(name){
  const r=rosterRowFor(name);
  if (!r || r.length<=13) return null;
  const mots=(Array.isArray(r[12])?r[12]:[]).map(motivName).filter(m=>m&&m!=="None");
  return { captain: r[10]===1, ego: +r[11]||0, motiv: mots, pr: +r[13]||0 };
}
function egoWord(e){ return e>=75?"a big ego, feeds on status":e>=45?"a healthy ego":e>=15?"quietly self-assured":"ego barely registers, team-first wiring"; }
function personaLine(name){
  /* the prompt line — ROLE-PROMPTING law: describes "this teammate", never names him. */
  const p=rosterPersona(name);
  if (!p) return "";
  const bits=[];
  if (p.captain) bits.push("wears a captain's patch and carries the room like it");
  bits.push(egoWord(p.ego));
  if (p.motiv.length) bits.push("what moves him: "+p.motiv.map(m=>MOTIV_WORDS[m]||m).join(", "));
  return " SAVE-TRUTH MAKEUP (real, from the franchise file): this teammate "+bits.join("; ")+".";
}
function depthTruth(){ return (S.blob&&S.blob.depth&&typeof S.blob.depth==="object"&&Object.keys(S.blob.depth).length)? S.blob.depth : null; }
function myDepthSpots(){
  const d=depthTruth(); if(!d) return [];
  const me=S.blob.player.first+" "+S.blob.player.last;
  const out=[];
  for (const pos of Object.keys(d)){ const i=d[pos].indexOf(me); if(i>=0) out.push({pos, slot:i+1, of:d[pos].length}); }
  return out;
}
function chPersonaNote(postText){
  /* v1.12.0: when a public post names a teammate, that teammate's required reply obeys his
     save-truth makeup. One teammate, one line — token-budget friendly. */
  try{ for (const m of mentionPool()){ if (m.h && String(postText).toLowerCase().includes(m.h.toLowerCase())){ const pl2=personaLine(m.n); return pl2? " THE MENTIONED TEAMMATE'S REPLY obeys this:"+pl2 : ""; } } }catch(e){}
  return "";
}
function negTruthMine(){
  const me=S.blob.player.first+" "+S.blob.player.last;
  return (S.blob.negotiations||[]).find(n=>n&&n.n===me)||null;
}
const REQ_TYPES={
  depth:  {label:"Snaps / depth chart", verb:"more snaps — a move up the room"},
  poschange:{label:"Position change",   verb:"an official position change"},      /* v1.12.0 */
  number: {label:"Jersey number",       verb:"a jersey number change"},           /* v1.12.0 */
  gone:   {label:"Move him out",        verb:"moving a teammate out of the building"},
  bringin:{label:"Bring him in",        verb:"bringing a player in"},
  holdout:{label:"Holdout",             verb:"sitting out until something changes"},
  trade:  {label:"Trade me",            verb:"a trade out"},
  leave:  {label:"I'm leaving",         verb:"finding his next team"}}; /* v1.7.5 (Ty): the exit consult */
/* v1.7.5: other 31 team names for trade/leave destination talk */
function otherTeams(){
  const mine=S.blob.player.team;
  let names=[];
  if (S.blob.league && S.blob.league.teams && S.blob.league.teams.length) names=S.blob.league.teams.map(t=>t.n||t);
  else names=Object.keys(D.METROS);
  return [...new Set(names)].filter(n=>n && n!==mine).sort();
}
function posLeaderCat(pos){
  return pos==="QB"?"Passing yards": (pos==="HB"||pos==="FB")?"Rushing yards": (pos==="WR"||pos==="TE")?"Receiving yards"
    : /^(LE|RE|DT)$/.test(pos)?"Sacks" : /(CB|FS|SS)/.test(pos)?"Interceptions" : /LB/.test(pos)?"Tackles" : null;
}
/* honest need-reading from the save: bad record + nobody near the top of his stat category.
   Returns null when the year is too young to say anything real. */
function teamNeeds(pos){
  const L=S.blob.league; if(!L||!L.teams||!L.teams.length) return null;
  const recs={}; let any=false;
  for (const t of L.teams){ const n=t.n||t; if(n) recs[n]={w:0,l:0}; }
  for (const g of (L.games||[])){
    if (!g || g.t!=="RegularSeason" || !(g.played||((g.hs||0)+(g.as||0)>0))) continue;
    if (!recs[g.h]||!recs[g.a]) continue;
    any=true;
    if (g.hs>g.as){recs[g.h].w++;recs[g.a].l++;} else if (g.as>g.hs){recs[g.a].w++;recs[g.h].l++;}
  }
  const cat=posLeaderCat(pos);
  const strong=new Set();
  if (cat && L.leaders && L.leaders[cat]) for (const r of (L.leaders[cat].rows||[]).slice(0,10)) strong.add(r[1]);
  if (!any && !strong.size) return null;
  const mine=S.blob.player.team;
  return Object.keys(recs).filter(n=>n!==mine)
    .map(n=>({n, rec:recs[n], thin: !!cat && !strong.has(n), score:(recs[n].l-recs[n].w) + (cat? (strong.has(n)? -2 : 2) : 0)}))
    .sort((a,b)=>b.score-a.score).slice(0,5);
}
function teamNeedsHtml(){
  const pos=S.blob.player.pos; const ns=teamNeeds(pos);
  if (!ns) return '<p class="sp" style="font-size:12px;opacity:.7">Too early in the year to read real needs. Camp rosters are 90 deep everywhere; the picture sharpens once games count.</p>';
  return '<label class="flabel">Where the save says a '+esc(pos)+' could eat</label>'+ns.map(x=>
    `<div class="payline"><span style="font-size:12.5px">${esc(x.n)}</span><span style="font-size:11.5px;opacity:.6">${x.rec.w}-${x.rec.l}${x.thin&&posLeaderCat(pos)?" \u00b7 nobody near the top of the "+esc(pos)+" numbers":""}</span></div>`).join("");
}
function reqChooser(){
  if (!S.agent) return toast("You need an agent for this. That's what Apex is for.");
  const t=pullTier();
  sheet(`<h3>Through your agent</h3>
  <p class="sp">${esc(S.agent.n.split(" ")[0])}: "Right now the building sees you as ${esc(t.word)}. Anything you want official, I can get as far as ${esc(t.whoLong)}. Past that, we'd be shouting at a door."</p>
  ${Object.entries(REQ_TYPES).map(([k,v])=>`<button class="btn sm" style="background:rgba(255,255,255,.12);width:100%;text-align:left;margin-bottom:6px" onclick="reqSheet('${k}')">${esc(v.label)}</button>`).join("")}
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function reqSheet(type, pre){
  const T=REQ_TYPES[type]; const me=S.blob.player.first+" "+S.blob.player.last;
  const needsMate = type==="gone";
  const mates=S.blob.roster.filter(r=>(r[0]+" "+r[1])!==me);
  const wkGross=grossFor(S.blob.player.status, S.blob.player);
  /* v1.12.0: the depth ask names a LIST and a SLOT from save truth. Any list is choosable —
     the two-way law (decoded): one player may hold slots on both sides of the ball, and the
     phone never blocks an off-position ask. The building still rules. */
  const dTruth=depthTruth();
  const dPositions=dTruth? Object.keys(dTruth) : ORD_POS;
  const dDefault=(pre&&pre.pos)|| (dTruth&&dTruth[S.blob.player.pos]? S.blob.player.pos : dPositions[0]);
  const dSlotOpts=pos=>{ const len=dTruth&&dTruth[pos]? Math.min(8, dTruth[pos].length+ (dTruth[pos].includes(me)?0:1)) : 5; return Array.from({length:len},(_,i)=>i+1); };
  window._reqSlotRefresh=()=>{ const p=$("#reqPos").value; $("#reqSlot").innerHTML=dSlotOpts(p).map(x=>`<option>${x}</option>`).join(""); const cur=dTruth&&dTruth[p]? dTruth[p].indexOf(me):-1; $("#reqDCur").textContent= cur>=0? "You sit "+p+(cur+1)+" today."+(p!==S.blob.player.pos?" (Off-position listings are legal — two-way law.)":"") : (p!==S.blob.player.pos? "You're not on the "+p+" list today. Asking on is legal — two-way law.":"You're not listed at "+p+" today."); };
  /* jersey numbers: what's worn on this roster (idx 4) */
  const worn={}; for (const r of S.blob.roster){ if (r[5]==="Signed"||r[5]==="PracticeSquad") worn[+r[4]]=r[0]+" "+r[1]; }
  window._reqNumCheck=()=>{ const n=+$("#reqNum").value; const holder= Number.isInteger(n)&&n>=0&&n<=99? worn[n] : null;
    const el=$("#reqNumMsg"), deal=$("#reqDealRow");
    if (!Number.isInteger(n)||n<0||n>99){ el.textContent="Numbers run 0-99."; deal.style.display="none"; return; }
    if (holder===me){ el.textContent="That's already your number."; deal.style.display="none"; }
    else if (holder){ el.textContent="#"+n+" belongs to "+holder+". The building won't take a man's number for you — that's between you two (marker territory)."; deal.style.display="flex"; }
    else { el.textContent="#"+n+" is open in the building."; deal.style.display="none"; } };
  sheet(`<h3>${esc(T.label)}</h3>
  <p class="sp">This goes on the record through ${esc(S.agent.n.split(" ")[0])}. The building answers at its own pace — usually by the next sync — and the save, not the ask, decides what actually moves.</p>
  ${type==="bringin"? `<p class="sp" style="font-size:12px;opacity:.75">How this works: a yes from the building is a decision, not a transaction. The phone never signs anyone. The move only becomes real inside Madden's world — when a sync shows him on the roster, the phone announces it like the news it is.</p>`:""}
  ${type==="holdout"? `<p class="sp" style="font-size:12px;color:#e8a13c">Know the cost before you sit: every game week held out is a missed check (about ${fm(wkGross)} gross at your current status), a public holdout is an instant conduct fine, and the building remembers who blinked. Guaranteed money can get voided over it.</p>`:""}
  ${type==="leave"? `<p class="sp" style="font-size:12px;opacity:.75">The exit consult. ${esc(S.agent.n.split(" ")[0])} reads the league for you: who needs your position, where the tape travels. Talk is talk — a release or free agency only exists when the SAVE shows it; if that door ever opens in Madden's world, this is the map you walk out with.</p>${teamNeedsHtml()}`:""}
  ${type==="depth"? `<label class="flabel">Which list?</label><select class="field" id="reqPos" onchange="_reqSlotRefresh()">${dPositions.map(x=>`<option ${x===dDefault?"selected":""}>${x}</option>`).join("")}</select>
    <label class="flabel">Which slot do you want?</label><select class="field" id="reqSlot">${dSlotOpts(dDefault).map(x=>`<option ${pre&&pre.slot===x?"selected":""}>${x}</option>`).join("")}</select>
    <p class="sp" id="reqDCur" style="font-size:12px;opacity:.75"></p>`:""}
  ${type==="poschange"? `<label class="flabel">What do you want to be, officially?</label>
    <select class="field" id="reqPos">${ORD_POS.filter(p=>p!==S.blob.player.pos).map(x=>`<option>${x}</option>`).join("")}</select>
    <p class="sp" style="font-size:12px;opacity:.75">You're listed ${esc(S.blob.player.pos)} today. A position change is an organizational call — the room, the scheme, the card on your locker. Depth listings don't move with it (two-way law: the lists hold whoever the staff puts on them).</p>`:""}
  ${type==="number"? `<label class="flabel">The number you want</label>
    <input class="field" id="reqNum" type="number" min="0" max="99" placeholder="${S.blob.player.jersey}" oninput="_reqNumCheck()">
    <p class="sp" id="reqNumMsg" style="font-size:12px;opacity:.75">You wear #${S.blob.player.jersey} today.</p>
    <label class="flabel" id="reqDealRow" style="display:none;gap:8px;align-items:center"><input type="checkbox" id="reqDeal"> We made a deal — he's agreed to give it up. File the paired switch.</label>`:""}
  ${needsMate? `<label class="flabel">Who needs to go?</label>
    <select class="field" id="reqTarget">${mates.map(r=>`<option value="${esc(r[0]+" "+r[1]).replace(/"/g,"&quot;")}">${esc(r[0]+" "+r[1])} \u00b7 ${esc(r[2])} ${r[3]}${(r[2]===S.blob.player.pos)?" \u00b7 your room":""}</option>`).join("")}</select>`
  : type==="bringin"? `<label class="flabel">Who do you want in the building?</label><input class="field" id="reqTarget" placeholder="a name the front office can chase">`
  : (type==="trade"||type==="leave")? `<label class="flabel">${type==="trade"? "Where to?" : "Where do you want to land?"}</label>
    <select class="field" id="reqTarget"><option value="">${type==="trade"? "Anywhere \u2014 just out" : "Anywhere that wants me"}</option>${otherTeams().map(n=>`<option value="${esc(n).replace(/"/g,"&quot;")}">${esc(n)}</option>`).join("")}</select>` : ""}
  <label class="flabel">Why (your words, goes into the ask)</label>
  <input class="field" id="reqWhy" placeholder="${type==="depth"?"I'm outplaying him every rep":"say it straight"}">
  <label class="flabel" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="reqPub"> Make it public through the media</label>
  <p class="sp" style="font-size:11.5px">Public asks force the issue and the coach WILL see it. Quiet asks keep doors open.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="reqSubmit('${type}')">Send it to ${esc(S.agent.n.split(" ")[0])}</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="depth") _reqSlotRefresh();
}
function agentRouteReply(type, t, pub){
  const first=S.agent.n.split(" ")[0];
  const base = type==="depth"? "The snaps ask is in. I put it in front of "+t.whoLong+"."
    : type==="poschange"? "A position change is a scheme conversation, not a favor. I framed it as what helps them win and left it with "+t.whoLong+"."
    : type==="number"? "Jersey paperwork. Sounds small, means everything to the guy wearing it. It's with "+t.whoLong+" and the equipment room."
    : type==="gone"? "Moving a teammate out — that's a big swing. I'll raise it with "+t.whoLong+", but understand what we are asking a front office to do."
    : type==="bringin"? "I floated the name to "+t.whoLong+". Front offices hate being told who to sign, so I dressed it up as 'fit'."
    : type==="holdout"? "A holdout from "+t.word+" is a bet on leverage. I told "+t.whoLong+" you're serious. I hope you are."
    : type==="leave"? "The exit read is running. I took the temperature around the league quietly — real doors only open when the save opens them, and my job is knowing which city to point you at that day."
    : "A trade ask from "+t.word+" — I delivered it to "+t.whoLong+". These take on a life of their own once they're out.";
  return base + (pub? " And it's public now, like you wanted. The room will have seen it before practice." : " Kept it in the building.");
}
function reqSubmit(type){
  const tgtEl=$("#reqTarget"); const target=tgtEl? tgtEl.value.trim() : "";
  const why=($("#reqWhy")&&$("#reqWhy").value.trim())||"";
  const pub=!!($("#reqPub")&&$("#reqPub").checked);
  if (type==="gone" && !target) return toast("Pick a name.");
  S.requests=S.requests||[];
  const t=pullTier();
  const r={id:"rq"+Date.now(), type, target, why, pub, wk:wkKey(S.blob.clock), status:"pending", tier:t.word};
  /* v1.12.0: the writeback asks carry their exact shape */
  if (type==="depth"){ r.pos=$("#reqPos")? $("#reqPos").value : S.blob.player.pos; r.slot=$("#reqSlot")? +$("#reqSlot").value : 2; r.target=r.pos+r.slot; }
  if (type==="poschange"){ r.pos=$("#reqPos")? $("#reqPos").value : ""; if(!r.pos) return toast("Pick a position."); r.target=r.pos; }
  if (type==="number"){
    const n=+($("#reqNum")&&$("#reqNum").value);
    if (!Number.isInteger(n)||n<0||n>99) return toast("Numbers run 0-99.");
    if (n===S.blob.player.jersey) return toast("That's already your number.");
    r.num=n; r.target="#"+n;
    const me=S.blob.player.first+" "+S.blob.player.last;
    const holder=S.blob.roster.find(x=>+x[4]===n && (x[5]==="Signed"||x[5]==="PracticeSquad") && (x[0]+" "+x[1])!==me);
    if (holder){ r.holder=holder[0]+" "+holder[1]; r.deal=!!($("#reqDeal")&&$("#reqDeal").checked); }
  }
  S.requests.push(r);
  if (pub && (type==="gone"||type==="trade") && target){
    /* v1.9.4: a PUBLIC ask to move a teammate reaches that teammate. Of course it does. */
    const pk=ledgerPersonKey(target);
    if (pk){ const rc=ledgerGet(pk); rc.warmth=Math.max(-100, rc.warmth-25); rc.flags=rc.flags||{}; rc.flags.lastHostileWk=wkKey(S.blob.clock); ledgerNote(pk, "he PUBLICLY asked the building to move this teammate"); ledgerRoomEvent("he went public trying to move a teammate", -8); }
  }
  if (selfRepped()){
    /* v1.9.0: no agent to carry it — the ask files straight with the building, one-way ack. */
    clubMail("Request Received "+"\u2014"+" "+REQ_TYPES[type].label, "Your "+REQ_TYPES[type].verb+" request has been logged with the front office. It will be taken up at the level your standing reaches: "+t.whoLong+". This notice is one-way.");
    ledgerNote("t:agent", "he filed a "+REQ_TYPES[type].label.toLowerCase()+" request himself"+(pub?" and made it public":""));
  } else {
  const th=S.world.texts.find(x=>x.id==="agent");
  if (th){ th.msgs.push(["me", "Make it official: "+REQ_TYPES[type].verb+(target?" \u2014 "+target:"")+(why?". "+why:""), Date.now()]);
    th.msgs.push(["them", agentRouteReply(type, t, pub), Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; }
  }
  if (pub){
    // v1.7.4: a public holdout/trade demand is refusal-grade conduct; other public asks draw the coach's eye
    if (type==="holdout"||type==="trade"||type==="leave"){
      const fine=Math.max(5000, Math.round(grossFor(S.blob.player.status, S.blob.player)*0.10));
      S.cash.checking-=fine; S.ledger.push({t:"Club fine \u2014 conduct (public "+(type==="holdout"?"holdout":type==="leave"?"exit demand":"trade demand")+")", amt:-fine, kind:"spend"});
      clubMail("Notice of Club Fine \u2014 Conduct Detrimental",
        'This is formal notice from the club. '+(selfRepped()?'Your public ':'Your representation\'s public ')+(type==="holdout"?"holdout":type==="leave"?"exit demand":"trade demand")+' has been ruled conduct detrimental to the club by '+coachName()+'. A fine of '+fm(fine)+' has been assessed and deducted from your account. This notice is one-way; direct any response through your representation.');
      S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Club fine "+fm(fine)+" \u2014 conduct"});
      odNotice();
    } else {
      clubMail("A Note From the Coaching Staff",
        coachName()+" has seen your "+(selfRepped()?"":"representation's ")+"public comments about "+REQ_TYPES[type].verb+". No action is being taken at this time; the staff's strong preference is that these conversations come through the building first. This notice is one-way; direct any response through your representation.");
      S.world.notifs.push({app:"tmail", t:"Football Operations", p:"The staff saw the public ask"});
    }
  }
  persist(); closeSheet(); toast(selfRepped()? "Filed. The building has it." : "It's with "+S.agent.n.split(" ")[0]+" now.");
  if (curApp==="apex") renderApp("apex");
  if (curApp==="messages") renderApp("messages",{thread:"agent"});
}
function reqListHtml(){
  const rs=(S.requests||[]).slice(-6).reverse();
  if (!rs.length) return '<div style="font-size:12.5px;opacity:.6">Nothing on the record. The building hears silence.</div>';
  const badge=s=> s==="pending"? '<span style="color:#f4b45c">pending</span>' : s==="granted"? '<span style="color:#2e7d32">it happened</span>' : s==="refused"? '<span style="color:#c0392b">refused</span>' : '<span style="opacity:.55">no answer</span>';
  return rs.map(r=>`<div class="payline"><span style="font-size:12.5px">${esc(REQ_TYPES[r.type].label)}${r.target?" \u00b7 "+esc(r.target):""}${r.pub?" \u00b7 public":""}</span><span style="font-size:12px">${badge(r.status)}</span></div>`).join("");
}
/* resolution: runs on every sync. Drop one — depth asks can land as a REAL staff order
   through the ONE code; everything else gets a real answer that is a refusal or silence. */
function resolveRequests(){
  const pend=(S.requests||[]).filter(r=>r.status==="pending");
  if (!pend.length) return;
  const t=pullTier(); const ag=S.agent||{neg:4,agg:4};
  const selfR=selfRepped();   /* v1.9.0: neg 1 in ag already prices the self-rep penalty into lev */
  const th=S.world.texts.find(x=>x.id==="agent");
  const say=m=>{ if(selfR) return; if(th){ th.msgs.push(["them", m, Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; } };
  let answered=0;
  for (const r of pend){
    const rng=seedRng(S.careerId+"|req|"+r.id+"|"+wkKey(S.blob.clock));
    const roll=rng();
    const lev = t.score/100 + (ag.neg+ag.agg)/80 + (r.pub? 0.06:0);
    if (r.type==="depth"){
      if (lev>0.5 && roll<lev-0.2){
        /* v1.7.5: the exe cap is TEN counting the coach's rulings — gate on the merged total,
           and a full queue leaves the ask PENDING (it lands next sync), never a fake refusal. */
        if (ordTotal()<10){
          r.status="granted";
          /* v1.12.0: the ask names its list and slot from save truth — the grant honors it
             exactly (any list, any side: two-way law). Legacy asks keep the old 1/2 roll. */
          const pos=r.pos||S.blob.player.pos;
          const slot=r.slot|| ((t.score>=65 && roll<0.25)? 1 : 2);
          S.orders=S.orders||[];
          S.orders.push({type:"depth", player:{name:S.blob.player.first+" "+S.blob.player.last}, pos, slot});
          say("They moved. Decision memo's in the building: you run "+pos+slot+". It rides the order code on the Sync screen \u2014 paste it and Madden catches up to what's already been decided.");
          S.world.notifs.push({app:"sync", t:"Front office", p:"Your snaps ask landed \u2014 depth order queued"});
        } else { say("They said yes and my hands are full \u2014 the order code is at its ten-order ceiling. Apply or clear it and this lands on the next sync."); continue; }
      } else if (roll<0.75){
        r.status="refused";
        say(t.score<25? "Heard back through "+t.who+": 'earn it in practice.' That's the whole answer at your standing." : t.who.replace(/^the /,"The ")+" heard the snaps ask and passed for now. The tape has to force their hand \u2014 keep stacking days.");
      } else { r.status="ignored"; say("Nothing. Not a no \u2014 nothing. At "+t.word+" standing, silence IS the answer some weeks."); }
    } else if (r.type==="poschange"){
      /* v1.12.0: an organizational call — a harder yes than snaps. Granted, it rides TYORD1
         as a real position order; the depth lists stay whatever the staff has them (two-way law). */
      if (lev>0.62 && roll<lev-0.3){
        if (ordTotal()<10){
          r.status="granted";
          S.orders=S.orders||[];
          S.orders.push({type:"position", player:{name:S.blob.player.first+" "+S.blob.player.last}, pos:r.pos});
          clubMail("Roster Decision \u2014 Position Change to "+r.pos,
            "This is formal notice from the club. By decision of "+coachName()+" and the coordinator, your official position changes to "+r.pos+". The card on your locker changes this week; the order has been filed. Where you sit on any depth list remains the staff's call, week to week. This notice is one-way; direct any response through your representation.");
          say("They actually did it. You're a "+r.pos+" on the org chart \u2014 the order's queued on Sync. The depth lists are still theirs to set; go earn the slot at the new spot.");
          S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Position change to "+r.pos+" \u2014 order waiting in Sync"});
        } else { say("They said yes on the position and the order code is full at ten. Apply or clear it and the "+r.pos+" move lands next sync."); continue; }
      } else if (roll<0.8){
        r.status="refused";
        say(t.score<25? "On the position switch \u2014 "+t.who+" laughed, not unkindly. 'He can play "+String(r.pos)+" when he's earned a say.' Stack tape at the spot they gave you first." : "Walked the "+String(r.pos)+" idea up to "+t.whoLong+". They see you where you are \u2014 scheme, room math, the whole board. The tape at YOUR spot is what reopens this.");
      } else { r.status="ignored"; say("The position ask got the long silence. Coordinators guard the org chart like the playbook. File stays open."); }
    } else if (r.type==="number"){
      /* v1.12.0: jersey paperwork. An open number is the easiest yes in the building; a worn
         number is NEVER taken for you \u2014 the paired switch only moves if you two made it real
         (marker territory), and even then the club processes it, you don't. */
      if (r.holder && !r.deal){
        r.status="refused";
        say("On #"+r.num+" \u2014 that's "+r.holder+"'s number. The building won't take a man's number for you; that's a conversation (and probably a price) between you two. Make the deal, then refile with me.");
      } else if (lev+0.25>0.5 && roll<lev+ (r.holder? -0.05 : 0.25)){
        if (ordTotal()<10 - (r.holder?1:0)){
          r.status="granted";
          const me=S.blob.player.first+" "+S.blob.player.last;
          S.orders=S.orders||[];
          if (r.holder){
            /* the paired switch: his move rides the SAME code first (the exe's sequenced-swap law) */
            const wornNow=new Set(S.blob.roster.filter(x=>x[5]==="Signed"||x[5]==="PracticeSquad").map(x=>+x[4]));
            let free=null; for(let n2=99;n2>=0;n2--){ if(!wornNow.has(n2)&&n2!==r.num){ free=n2; break; } }
            S.orders.push({type:"number", player:{name:r.holder}, num:free});
            S.orders.push({type:"number", player:{name:me}, num:r.num});
            clubMail("Jersey Update \u2014 #"+r.num+" (paired switch)", "Made it official: the deal you two struck is processed. "+r.holder+" moves to #"+free+", and #"+r.num+" is yours. Both orders ride the code on your Sync screen; nameplates and gear are redone once the franchise catches up. Whatever the number cost you is between you two. This notice is one-way.", (S.blob.player.team||"Club")+" Equipment Room");
            say("Done and done. The paired switch is queued \u2014 his move first, then yours, one code. Whatever you promised him, honor it. The room hears everything.");
          } else {
            S.orders.push({type:"number", player:{name:me}, num:r.num});
            clubMail("Jersey Update \u2014 #"+r.num, "Made it official: #"+r.num+" is yours. The order rides the code on your Sync screen; nameplate, practice gear, and game jerseys are redone once the franchise catches up. This notice is one-way.", (S.blob.player.team||"Club")+" Equipment Room");
            say("Easiest ask you'll ever make. #"+r.num+" is queued on Sync \u2014 the equipment room already has the email out.");
          }
          S.world.notifs.push({app:"tmail", t:"Equipment Room", p:"Jersey #"+r.num+" \u2014 order waiting in Sync"});
        } else { say("The number's approved and the order code is at its ceiling. Apply or clear it and the jersey lands next sync."); continue; }
      } else if (roll<0.8){
        r.status="refused";
        say("The equipment room kicked the #"+r.num+" ask back \u2014 'league office paperwork window,' which is building-speak for not this week. Refile after a game.");
      } else { r.status="ignored"; say("The number ask sits in somebody's tray. Paperwork moves at paperwork speed. I'll keep on it."); }
    } else if (r.type==="leave"){
      /* v1.7.5: the exit consult resolves as an honest reading. The wall stands — releases and
         free agency only exist when the save shows them; the phone never writes an exit. */
      if (t.score<25 && roll<0.5){ r.status="ignored"; say("On finding your next team \u2014 I made the calls. At "+t.word+" standing the phones don't ring back. File stays open; the tape does the talking."); }
      else { r.status="refused"; say("Walked the exit ask up to "+t.who+". Under contract means under contract \u2014 they're not cutting anybody as a favor. If the save ever shows you free or moved, "+(r.target? r.target+" is where I aim first" : "we aim wherever the need is real that day")+". Until then it's leverage talk, and we both know what your leverage is right now."); }
    } else {
      // the wall: the phone never writes trades, releases, or signings. Honest refusals only.
      if (t.score<25 && roll<0.6){ r.status="ignored"; say("On the "+REQ_TYPES[r.type].label.toLowerCase()+" ask \u2014 no callback. "+t.who.replace(/^the /,"The ")+" isn't returning calls about "+t.word+" requests. I'll keep the file open."); }
      else { r.status="refused";
        say(r.type==="gone"? "They're not moving him on your word. Quote from "+t.who+": 'roster's ours.' When your standing in the building grows, this conversation changes."
          : r.type==="bringin"? "The name got a polite listen and a pass from "+t.who+". Cap space and fit \u2014 their words. If the building ever does it, the save will say so and the phone announces it."
          : r.type==="holdout"? "I walked the holdout back before it cost you real money \u2014 every game week sitting is a missed check plus fines. They called the bluff, and at "+t.word+" it WAS a bluff. Revisit when the leverage is real."
          : "Trade ask "+(r.target? "("+r.target+") ":"")+"refused at "+t.who+"'s desk. Nobody trades "+t.word+" because they asked \u2014 they trade players other teams call about.");
      }
    }
    r.resolvedWk=wkKey(S.blob.clock); answered++;
    if (selfR){
      const what=REQ_TYPES[r.type].label;
      clubMail("Re: Your "+what+" Request",
        r.status==="granted"? "Decision memo: your "+what.toLowerCase()+" request has been approved by staff. The order rides the order code on your Sync screen; paste it and the franchise catches up to what has been decided. This notice is one-way."
        : r.status==="refused"? "Your "+what.toLowerCase()+" request was reviewed at the level your standing reaches ("+t.whoLong+") and will not be acted on at this time. This notice is one-way."
        : "Your "+what.toLowerCase()+" request is on file. No response has been issued. This notice is one-way.");
      ledgerNote("t:agent", "his self-filed "+what.toLowerCase()+" request came back: "+r.status);
    }
  }
  if (answered) S.world.notifs.push(selfR? {app:"tmail", t:"Football Operations", p:"Word back on your request"+(answered>1?"s":"")} : {app:"messages", t:(S.agent?S.agent.n:"Apex"), p:"Word back on your request"+(answered>1?"s":"")});
  persist();
}
function requestsLine(){
  const rs=(S.requests||[]); if(!rs.length) return "";
  const t=pullTier();
  const recent=rs.slice(-4).map(r=>REQ_TYPES[r.type].label+(r.target?" ("+r.target+")":"")+(r.pub?", made PUBLIC":"")+" \u2014 "+(r.status==="pending"?"pending, no answer yet":r.status==="granted"?"the staff moved on it":r.status)).join("; ");
  return "\nFORMAL REQUESTS "+(selfRepped()?"HE FILED HIMSELF, self-represented":"THROUGH HIS AGENT")+" (facts): "+recent+". His standing in the building: "+t.word+"; asks route as far as "+t.whoLong+". LAW: talk is talk \u2014 NEVER state that a trade, release, signing, benching, or promotion happened because of a request; only the save's own news decides. The world may discuss, mock, or speculate about PUBLIC requests only.";
}
/* ============ v1.12.0 THE DEPTH CHART — full team view from save truth ============
   IDENTITY LAW: this is the BUILDING's document, rendered read-only. Your rows are marked;
   wanting a different spot routes through representation (the snaps ask), and the building
   rules. The two-way law is visible here: off-position names render exactly as listed. */
let _dcOpen=false;
function depthChartHtml(){
  const d=depthTruth();
  if (!d) return `<div class="veh-detail light" style="margin-bottom:14px"><div class="vd-title" style="font-size:16px">The depth chart</div>
    <p style="font-size:12.5px;opacity:.65;margin:6px 0 0">This save's sync predates the depth truth. Run a fresh sync on the computer (exe v1.7.0+) and the whole board renders here.</p></div>`;
  const me=S.blob.player.first+" "+S.blob.player.last;
  const spots=myDepthSpots();
  const ORDER=["QB","HB","FB","WR","TE","LT","LG","C","RG","RT","LE","RE","DT","NT","LOLB","MLB","ROLB","SUBLB","CB","SLCB","FS","SS","K","P","KOS","LS","KR","PR","3DRB","PWHB","SLWR","RLE","RDT","RRE","GAD"];
  const keys=[...ORDER.filter(k=>d[k]), ...Object.keys(d).filter(k=>!ORDER.includes(k))];
  const row=pos=>{
    const list=d[pos];
    const names=list.map((n,i)=>{
      const rr=rosterRowFor(n);
      const off = rr && rr[2]!==pos && !["KR","PR","3DRB","PWHB","SLWR","SLCB","SUBLB","KOS","GAD","RLE","RDT","RRE","NT","LS"].includes(pos);
      return `<span style="${n===me?"color:#2e7d32;font-weight:700":""}">${i+1}. ${esc(n)}${off?" ("+esc(rr[2])+")":""}</span>`;
    }).join('<span style="opacity:.3"> \u00b7 </span>');
    return `<div class="payline" style="align-items:flex-start"><span style="font-size:12px;font-weight:700;min-width:44px">${esc(pos)}</span><span style="font-size:12px;text-align:right;line-height:1.5">${names}</span></div>`;
  };
  return `<div class="veh-detail light" style="margin-bottom:14px"><div class="vd-title" style="font-size:16px">The depth chart <span style="font-size:11px;opacity:.5;font-weight:400">save truth, this sync</span></div>
  <p style="font-size:12.5px;opacity:.7;margin:4px 0 8px">${spots.length? "You sit "+spots.map(s=>s.pos+s.slot).join(", ")+" today." : "You're not on a depth row today \u2014 the building's call."} One player can hold rows on both sides of the ball; off-position listings are legal and shown as listed.</p>
  ${_dcOpen? keys.map(row).join("")+`<button class="btn sm" style="background:rgba(0,0,0,.08);margin-top:8px" onclick="_dcOpen=false;renderApp('apex')">Fold the board</button>${S.agent?`<button class="btn sm" style="background:var(--apx-acc);color:#fff;margin-top:8px" onclick="reqSheet('depth')">Want a different spot? Take it to the building</button>`:""}`
    : `<button class="btn sm" style="background:rgba(0,0,0,.08)" onclick="_dcOpen=true;renderApp('apex')">Open the whole board \u2014 ${keys.length} lists</button>`}
  </div>`;
}

/* ============ v1.12.0 THE NEGOTIATION RITUAL — the table, not the pen ============
   Ty's spec: contracts negotiated ON THE PHONE — agent + front office, offers shaped by
   PersonaNegotiation hooks + pullScore + cap truth; an agreed deal ships as a sign/resign
   TYORD1. THE WALL is REFRAMED, not broken: the SYSTEM still rules — it decides whether the
   table opens, what it offers, when it walks, and the paper only becomes real when the SAVE
   shows it. The phone gains the table to sit at, never the pen to force it.
   Deterministic: every number is seeded on careerId+week+round. No AI key needed. */
function negState(){ S.negot=S.negot||{log:[]}; return S.negot; }
function myContractReal(){ const c=S.blob.player.contract; return !!(c&&c.length); }
function negFair(){
  /* fair AAV: pull percentile against the position room's real cap hits, bounded by cap truth */
  const pos=S.blob.player.pos, minSal=760000;
  const caps=S.blob.roster.filter(r=>r[2]===pos && r.length>8 && +r[8]>0).map(r=>+r[8]).sort((a,b)=>b-a);
  const top=Math.max(caps[0]||0, minSal*4);
  let fair=minSal + Math.pow(pullScore()/100,1.25)*(top-minSal);
  const cap=S.blob.teamCap&&S.blob.teamCap.capRoom;
  if (cap>0) fair=Math.min(fair, cap*0.85);
  return Math.max(minSal, Math.round(fair/50000)*50000);
}
function negDb(){
  /* his own PersonaNegotiation file: what the building believes he plays for */
  const row=negTruthMine();
  const w={total:1, bonus:1, years:1};
  const IMP={Low:.5, Moderate:1, High:1.6, Critical:2.2};
  for (const [id,imp] of ((row&&row.db)||[])){
    const k= id==="Bonus"?"bonus" : id==="ContractLength"?"years" : (id==="TotalContractValue"||id==="HighestOffer")?"total" : null;
    if (k) w[k]=Math.max(w[k], IMP[imp]||1);
  }
  return {w, row};
}
function negAgentEdge(){ const ag=S.agent||{neg:1}; return (Number(ag.neg||1)-4)*0.02 - (selfRepped()? 0.06:0); }
function negOfferAt(round){
  const rng=seedRng((S.careerId||"c")+"|neg|"+wkKey(S.blob.clock)+"|"+round);
  const fair=negFair(), pull=pullScore();
  const open=0.74+negAgentEdge();
  const ceil=Math.min(1.05, 0.9+negAgentEdge()+0.025*Math.min(4,round));
  const frac=Math.min(ceil, open+round*0.05+rng()*0.02);
  const yrs= pull>=65? 4 : pull>=45? 3 : pull>=25? 2 : 1;
  const aav=Math.round(fair*frac/50000)*50000;
  const bShare= pull>=65? 0.35 : pull>=45? 0.22 : pull>=25? 0.1 : 0;
  const round2=x=>Math.round(x*100)/100;
  return { years:yrs, totalM:round2(aav*yrs/1e6), bonusM:round2(aav*yrs*bShare/1e6), fair, ceil };
}
function negCeilFor(years){
  const {w}=negDb();
  const o=negOfferAt(negState().round||0);
  /* dealbreaker shaping: a bonus-first file loosens structure, a total-first file buys a hair
     more ceiling, a years-first file tolerates longer asks */
  const maxTotal=o.fair*o.ceil*years*(1+0.02*(w.total-1))/1e6;
  const bonusEase=Math.min(0.45, 0.28+0.08*(w.bonus-1));
  const maxYears=Math.min(7, o.years + (w.years>1? 2:1));
  return { maxTotal:Math.round(maxTotal*100)/100, bonusEase, maxYears };
}
function negOpenGate(){
  const st=negState(); const wk=wkKey(S.blob.clock);
  if (!S.agent) return {no:"Pick representation first \u2014 even going alone is a choice made here at Apex."};
  if (st.walkWk===wk) return {no:"The front office left the table this week. It reopens when the world moves \u2014 next sync, next week."};
  if ((S.orders||[]).some(o=>(o.type==="sign"||o.type==="resign")&&o.player&&o.player.name===(S.blob.player.first+" "+S.blob.player.last)))
    return {no:"Agreed paper is already riding the order code. Apply it and let the save show the deal before opening a new table."};
  if (pullScore()<10) return {no:"They won't sit down. At camp-body standing the building's whole offer is the tender you're on \u2014 make the team, then there's a table."};
  return {ok:1};
}
function negOpen(){
  const g=negOpenGate(); if (g.no){ toast(g.no); return; }
  const st=negState(); const wk=wkKey(S.blob.clock);
  if (st.wk!==wk){ st.wk=wk; st.round=0; st.patience=(()=>{ const r=negTruthMine(); const p=r&&r.pat; return (typeof p==="number"&&p>0)? Math.min(95,p) : 30+Math.round(pullScore()/2); })(); st.log=[]; }
  persist(); negSheet();
}
function negFlavor(){
  const {w,row}=negDb(); const bits=[];
  if (w.bonus>1.3) bits.push("their file on you reads bonus-first \u2014 guaranteed money up front moves them more than headline total");
  if (w.total>1.3) bits.push("the building believes the headline number is what you play for");
  if (w.years>1.3) bits.push("term matters in your file \u2014 they'll stretch years before they stretch dollars");
  const mots=(S.blob.player.motivations||[]).map(m=>MOTIV_WORDS[m]||m);
  if (mots.length) bits.push("what the room knows moves you: "+mots.join(", "));
  return bits.length? bits.join("; ")+"." : "No leverage file on you yet \u2014 the tape is the whole argument.";
}
function negPatWord(p){ return p>=60?"in no hurry, the door's open":p>=35?"listening":p>=15?"checking the clock":"one bad number from standing up"; }
function negSheet(){
  const st=negState(); const o=negOfferAt(st.round);
  const cap=S.blob.teamCap;
  const agFirst=selfRepped()? null : S.agent.n.split(" ")[0];
  sheet(`<h3>The table</h3>
  <p class="sp">${myContractReal()? "New paper on your real deal \u2014 an agreed number ships as a resign order and the save writes the contract." : "Your first real contract row \u2014 an agreed number ships as a sign order and the save writes the paper."} The building rules the table; the phone never forces a pen.</p>
  <div class="payline"><span style="font-size:12.5px">Their offer on the table</span><span style="font-size:13px;font-weight:700">${o.years}yr \u00b7 $${o.totalM}M${o.bonusM?" \u00b7 $"+o.bonusM+"M to sign":""}</span></div>
  <div class="payline"><span style="font-size:12px;opacity:.7">The room across the table</span><span style="font-size:12px">${esc(negPatWord(st.patience))}</span></div>
  ${cap&&cap.capRoom>0? `<div class="payline"><span style="font-size:12px;opacity:.7">Cap truth (from the save)</span><span style="font-size:12px">${fm(cap.capRoom)} of room</span></div>`:""}
  <p class="sp" style="font-size:12px;opacity:.75">${esc(agFirst? agFirst+": \""+negFlavor()+"\"" : "Your own read, alone at the table: "+negFlavor())}</p>
  ${st.log.slice(-3).map(l=>`<p class="sp" style="font-size:11.5px;opacity:.6">${esc(l)}</p>`).join("")}
  <label class="flabel">Counter \u2014 years</label><select class="field" id="negY">${[1,2,3,4,5,6,7].map(x=>`<option ${x===o.years?"selected":""}>${x}</option>`).join("")}</select>
  <label class="flabel">Counter \u2014 total ($M)</label><input class="field" id="negT" type="number" step="0.5" min="0.5" value="${Math.round(o.totalM*1.25*2)/2}">
  <label class="flabel">Counter \u2014 signing bonus ($M)</label><input class="field" id="negB" type="number" step="0.5" min="0" value="${o.bonusM}">
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="negAccept()">Take their offer \u2014 ${o.years}yr / $${o.totalM}M</button>
  <button class="btn" style="background:var(--apx-acc);color:#fff" onclick="negCounter()">Send the counter</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="negWalk()">Leave the table</button>`);
}
function negCounter(){
  const st=negState();
  const years=+$("#negY").value, totalM=+$("#negT").value, bonusM=+($("#negB").value||0);
  if (!totalM||totalM<=0) return toast("A number first.");
  if (bonusM<0||bonusM>=totalM) return toast("Bonus can't beat the total.");
  const c=negCeilFor(years);
  const cap=S.blob.teamCap;
  const yrHit=(totalM+bonusM)/years*1e6;
  const rng=seedRng((S.careerId||"c")+"|negj|"+wkKey(S.blob.clock)+"|"+st.round);
  if (cap&&cap.capRoom>0 && yrHit>cap.capRoom){
    st.patience=Math.max(0, st.patience-16);
    st.log.push("They slid the cap sheet across the table: your year-one hit ("+fm(yrHit)+") is bigger than the room they have ("+fm(cap.capRoom)+"). Nobody signs what the math refuses.");
  } else if (years>c.maxYears){
    st.patience=Math.max(0, st.patience-10);
    st.log.push("Term's the problem \u2014 "+years+" years is past what they'll paper"+(c.maxYears<7?" (they'll go to "+c.maxYears+")":"")+ ". The money conversation never even started.");
  } else if (totalM<=c.maxTotal && bonusM<=totalM*c.bonusEase && rng()<0.85){
    return negAgree({years,totalM,bonusM});
  } else {
    const over=Math.max(0,(totalM/c.maxTotal-1));
    st.patience=Math.max(0, st.patience-(8+Math.round(Math.min(18, over*40))));
    st.round=(st.round||0)+1;
    const o2=negOfferAt(st.round);
    st.log.push(bonusM>totalM*c.bonusEase? "The structure spooked them \u2014 that much guaranteed up front isn't how they paper "+(pullTier().word)+". They came back "+o2.years+"yr / $"+o2.totalM+"M."
      : "They passed the counter around, shook heads, came back: "+o2.years+"yr / $"+o2.totalM+"M"+(o2.bonusM?" with $"+o2.bonusM+"M to sign":"")+".");
  }
  if (st.patience<=0) return negWalked();
  persist(); negSheet();
}
function negAccept(){ const st=negState(); return negAgree(negOfferAt(st.round)); }
function negAgree(t){
  if (ordTotal()>=10){ toast("Deal's agreed and the order code is full at ten. Apply or clear it, then take the offer again \u2014 it holds this week."); return; }
  const me=S.blob.player.first+" "+S.blob.player.last;
  const type=myContractReal()? "resign":"sign";
  S.orders=S.orders||[];
  S.orders.push({type, player:{name:me}, years:t.years, totalM:t.totalM, bonusM:t.bonusM||0});
  const st=negState(); st.agreedWk=wkKey(S.blob.clock); st.round=0; st.log=[];
  clubMail("Contract Agreement \u2014 Terms Reached",
    "This is formal notice from the club. Terms have been agreed"+(selfRepped()?"":" with your representation")+": "+t.years+" year"+(t.years===1?"":"s")+", $"+t.totalM+"M total"+(t.bonusM?" with a $"+t.bonusM+"M signing bonus":"")+". The "+(type==="resign"?"rewritten":"new")+" paper rides the order code on your Sync screen; the contract exists when the franchise file shows it, and your pay schedule updates on that sync. This notice is one-way; direct any response through your representation.");
  S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Terms agreed: "+t.years+"yr / $"+t.totalM+"M \u2014 order waiting in Sync"});
  if (!selfRepped()){ const th=S.world.texts.find(x=>x.id==="agent"); if (th){ th.msgs.push(["them","Shook on it. "+t.years+" years, $"+t.totalM+"M"+(t.bonusM?", $"+t.bonusM+"M of it guaranteed up front":"")+". The paper rides your Sync code \u2014 it's real when the save says it's real, and not a minute before. Don't spend it yet.", Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; } }
  ledgerRoomEvent("agreed terms with the building on a new deal", 1);
  persist(); closeSheet(); toast("Terms agreed. The paper rides the order code \u2014 the save makes it real.");
  if (curApp==="apex") renderApp("apex");
}
function negWalk(){
  const st=negState(); st.round=Math.max(0,(st.round||0)); persist(); closeSheet();
  toast("You left the table. Their offer stands this week \u2014 the room remembers who stood up first.");
}
function negWalked(){
  const st=negState(); st.walkWk=wkKey(S.blob.clock); st.round=0; st.log=[];
  persist(); closeSheet();
  clubMail("Contract Discussions \u2014 Paused",
    "This is formal notice from the club. Contract discussions have been paused at the club's discretion. The building's interest in a deal is unchanged; its patience for this week was not. Discussions may resume after the next game week. This notice is one-way; direct any response through your representation.");
  S.world.notifs.push({app:"tmail", t:"Football Operations", p:"They left the table \u2014 talks resume next week"});
  toast("They stood up. The table reopens when the world moves.");
}
function negTableHtml(){
  const st=negState(); const wk=wkKey(S.blob.clock);
  const pending=(S.orders||[]).find(o=>(o.type==="sign"||o.type==="resign")&&o.player&&o.player.name===(S.blob.player.first+" "+S.blob.player.last));
  const line = pending? "Terms agreed \u2014 the "+(pending.type==="resign"?"rewritten":"new")+" paper ("+pending.years+"yr / $"+pending.totalM+"M) rides the order code on Sync. The save makes it real."
    : st.walkWk===wk? "The front office left the table this week. It reopens when the world moves."
    : pullScore()<10? "No table at camp-body standing \u2014 the tender you're on IS the offer. Make the team."
    : "The building will sit down. Offers are shaped by your standing ("+pullTier().word+"), the position room's real money, the cap sheet, and the leverage file the save keeps on you.";
  return `<div class="veh-detail light" style="margin-bottom:14px"><div class="vd-title" style="font-size:16px">The table \u2014 contract talks</div>
  <p style="font-size:12.5px;opacity:.7;margin:4px 0 8px">${esc(line)}</p>
  ${(!pending && st.walkWk!==wk && pullScore()>=10)? `<button class="btn sm" style="background:var(--apx-acc);color:#fff" onclick="negOpen()">${myContractReal()? "Open talks \u2014 new paper on the real deal" : "Open talks \u2014 your first real contract"}</button>`:""}
  <p style="font-size:11px;opacity:.5;margin:8px 0 0">The system rules the table: it opens it, prices it, and walks from it. An agreed deal is an order, not a fact \u2014 the save decides when paper exists.</p></div>`;
}
function signAgent(id){
  const prev=S.agent;
  /* v1.9.0 SELF-REPRESENTATION (Ty's banked spec): no fee, no commission, worst "agent" in
     the building by rating — the balancing act IS the design. Remembered like any switch. */
  if (id==="self"){
    S.agent=SELF_AGENT();
    let th=S.world.texts.find(t=>t.id==="agent");
    if (!th){ th={id:"agent", name:"Apex Sports Group", color:"#6b5b2a", msgs:[], last:Date.now()}; S.world.texts.unshift(th); }
    fixAgentThread();
    th.msgs.push(["them", prev? "Front desk at Apex. "+prev.n.split(" ")[0]+" has been released from your file — you're on record as self-represented now. Our door stays open." : "Front desk at Apex. You're on record as self-represented. No fee, no mandate. Our door stays open if that ever changes.", Date.now()]);
    th.last=Date.now(); delete S.reads["t:agent"];
    ledgerRoomEvent(prev? "fired his agent to represent himself":"chose to represent himself", 0);
    ledgerNote("t:agent", prev? "he fired "+prev.n+" and went self-represented":"he chose to represent himself over signing an agent");
    persist();
    toast(prev? "You and "+prev.n.split(" ")[0]+" are done. Your career, your table." : "No agent. Your career, your table.");
    renderApp('apex'); return;
  }
  const A=D.AGENTS.find(x=>x.id===id);
  const prevWasSelf = prev && prev.id==="self";
  S.agent={id:A.id,n:A.n,fee:A.fee,neg:A.neg,end:A.end,agg:A.agg};
  let th=S.world.texts.find(t=>t.id==="agent");
  if (!th){ th={id:"agent", name:A.n, color:"#6b5b2a", msgs:[], last:Date.now()}; S.world.texts.unshift(th); }
  fixAgentThread();
  th.msgs.push(["them", (prev? (prevWasSelf? "It's "+A.n.split(" ")[0]+". Smart call coming in off the island. " : "It's "+A.n.split(" ")[0]+". "+prev.n.split(" ")[0]+" knows. ") : "It's "+A.n.split(" ")[0]+". Papers are in, I'm your rep now. ")+"Anything with your name on it goes through me first — deals, numbers, all of it.", Date.now()]);
  th.last=Date.now(); delete S.reads["t:agent"];
  if (prevWasSelf) ledgerNote("t:agent", "he came back from self-representation and signed "+A.n);
  persist();
  toast(prev? (prevWasSelf? A.n.split(" ")[0]+" it is. Better than going it alone." : A.n.split(" ")[0]+" it is. "+prev.n.split(" ")[0]+" will hear about it.") : "Signed with "+A.n+".");
  renderApp('apex');
}
/* Contacts */
RENDER.contacts = b=>{
  b.className="settings darkapp";
  const roster=S.blob.roster;
  const fam=(S.perception.familyPeople||[]).filter(f=>f.name).map((f,i)=>[f.name, f.rel+" — family", avColor(f.name), "fam"+i]);
  const world=[...fam, ["Mara Quinn","Personal assistant","#7a4a2e","mara"],[((S.agent&&S.agent.id!=="self")?S.agent.n:"Apex Front Desk"),(selfRepped()?"Front desk — you represent yourself":"Agent — Apex"),"#6b5b2a","agent"]]; // v1.7.4: no beat writer; v1.7.7 (Ty): team ops emails, it doesn't text — Equipment Room retired from Contacts
  b.innerHTML = aphead("Contacts") + `<div class="apbody flush">
  <div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Your world</h3></div>` +
  world.map(w=>`<button class="contact" style="width:100%;text-align:left" onclick="textContact('${w[3]}','${esc(w[0]).replace(/'/g,"\\'")}','${w[2]}')"><span class="av" style="background:${w[2]}">${initials(w[0])}</span><div><h4>${esc(w[0])}</h4><p>${esc(w[1])}</p></div></button>`).join("") +
  `<div style="padding:0 16px"><button class="btn sm" style="background:rgba(127,212,160,.16);color:#7fd4a0;width:100%" onclick="newGroupSheet()">+ New group text</button></div>
  <div class="hoodhead" style="padding:0 16px;color:var(--ink)"><h3>Locker room · ${roster.length}</h3></div>` +
  roster.map(r=>{const nm=r[0]+" "+r[1]; const id="p"+(r[0]+r[1]).replace(/\W/g,"").toLowerCase();
   return `<button class="contact" style="width:100%;text-align:left" onclick="textContact('${id}','${esc(nm).replace(/'/g,"\\'")}','${avColor(nm)}')"><span class="av" style="background:${avColor(nm)}">${initials(nm)}</span><div><h4>${esc(nm)}</h4><p>${esc(r[2])} · #${r[4]}${r[5]==="PracticeSquad"?" · PS":""}</p></div></button>`;}).join("") + `</div>`;
};
function textContact(id, name, color){
  /* v1.7.4 (Ty: "if there is no conversation there shouldn't be a message created"):
     the thread object exists only while you're looking at it — pruneEmptyThreads()
     drops any 1:1 you backed out of without saying anything. */
  let t=S.world.texts.find(x=>x.id===id);
  if (!t){ t={id, name, color, msgs:[], last:Date.now()}; S.world.texts.unshift(t); persist(); }
  window._openThread=id;
  openApp("messages"); renderApp("messages",{thread:id});
  window._openThread=null;
}
function pruneEmptyThreads(keepId){
  const before=S.world.texts.length;
  // groups you started keep their empty room (that's the point of starting one); the thread
  // being opened right now survives until you actually back out of it
  S.world.texts=S.world.texts.filter(t=> (t.msgs&&t.msgs.length) || t.group || t.id===keepId);
  if (S.world.texts.length!==before) persist();
}
/* v1.6.9 (Ty): YOUR OWN GROUP TEXTS. A QB pulls his line into a chat, the DBs have a room,
   the specialists have their weird little corner. Presets fill from the live roster; members
   are real teammates only, capped at 16 so replies stay a conversation and not a stadium. */
const GROUP_PRESETS=[
  ["My position room", p=>[p.pos]],
  ["O-Line", ()=>["LT","LG","C","RG","RT"]],
  ["QB room", ()=>["QB"]],
  ["Backs", ()=>["HB","FB"]],
  ["Pass catchers", ()=>["WR","TE"]],
  ["D-Line", ()=>["LE","RE","DT"]],
  ["Linebackers", ()=>["LOLB","MLB","ROLB","OLB","LB"]],
  ["DBs", ()=>["CB","FS","SS"]],
  ["Whole defense", ()=>["LE","RE","DT","LOLB","MLB","ROLB","OLB","LB","CB","FS","SS"]],
  ["Whole offense", ()=>["QB","HB","FB","WR","TE","LT","LG","C","RG","RT"]],
  ["Specialists", ()=>["K","P","LS"]],
];
function groupCandidates(posList){
  const me=S.blob.player.first+" "+S.blob.player.last;
  return S.blob.roster.map(r=>({n:r[0]+" "+r[1],pos:r[2],ovr:r[3]}))
    .filter(x=>x.n!==me && posList.includes(x.pos))
    .sort((a,b)=>b.ovr-a.ovr).slice(0,16).map(x=>x.n);
}
function newGroupSheet(){
  const me=S.blob.player;
  sheet(`<h3>New group text</h3><p class="sp">Pick a preset or check names. You're in it by default; sixteen teammates is the cap.</p>
  <label class="flabel">Name the chat</label><input class="field" id="grpName" placeholder="protect the qb">
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px">${GROUP_PRESETS.map((g,i)=>`<button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="grpPreset(${i})">${esc(g[0])}</button>`).join("")}</div>
  <div id="grpList" style="max-height:220px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px">
  ${S.blob.roster.filter(r=>(r[0]+" "+r[1])!==(me.first+" "+me.last)).map(r=>{const nm=r[0]+" "+r[1];
    return `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;padding:3px 0"><input type="checkbox" class="grpChk" value="${esc(nm).replace(/"/g,"&quot;")}"> ${esc(nm)} · ${esc(r[2])} ${r[3]}</label>`;}).join("")}
  </div>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="createGroup()">Start the chat</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function grpPreset(i){
  const g=GROUP_PRESETS[i]; const names=groupCandidates(g[1](S.blob.player));
  document.querySelectorAll(".grpChk").forEach(c=>{ c.checked = names.includes(c.value); });
  const nameEl=$("#grpName"); if(nameEl && !nameEl.value) nameEl.value=g[0]==="My position room"? S.blob.player.pos+" room" : g[0].toLowerCase();
  if(!names.length) toast("Nobody on the roster fits that preset.");
}
function createGroup(){
  const members=[...document.querySelectorAll(".grpChk:checked")].map(c=>c.value).slice(0,16);
  if (members.length<2) return toast("A group needs at least two teammates.");
  const name=(($("#grpName")&&$("#grpName").value)||"").trim() || members[0].split(" ")[0]+" +"+(members.length-1);
  const t={id:"g"+Date.now(), name, color:avColor(name), group:true, members, msgs:[], last:Date.now()};
  S.world.texts.unshift(t); persist(); closeSheet();
  openApp("messages"); renderApp("messages",{thread:t.id});
  toast("Chat's live. Say something.");
}
/* ============ v1.10.0 MERIDIAN CREDIT 2.0 (Ty's spec) — THE CARD BECOMES A MECHANIC ============
   Deep but simple. Four card-eligible surfaces ONLY: Octane, Harborline, Stratos, marker
   settlements — plus chauffeur/limo fees when billed to the card. Everything else stays
   checking. Tiers cut the APR and pay IMMEDIATE cashback to checking. The limit is finally
   real: seeded from Initial Settings (floor $8,000), grown by income + net worth + tier,
   never shrinking. Utilization quietly moves the credit score every week. UNLIMITED
   (Ty's gate): net worth $250M+ AND score 800+ — the card cannot decline; the 500-car
   garage is possible and going broke is your own doing. No sponsors, ever. */
const CARD_TIERS=[
  {id:"basic",    n:"BASIC",     apr:24.9, cb:0,   mult:1.0,  req:{score:0,   inc:0,     nw:0}},
  {id:"elevated", n:"ELEVATED",  apr:21.9, cb:0.5, mult:1.15, req:{score:640, inc:150000, nw:0}},
  {id:"premium",  n:"PREMIUM",   apr:18.9, cb:1,   mult:1.3,  req:{score:680, inc:500000, nw:0}},
  {id:"silver",   n:"SILVER",    apr:15.9, cb:1.5, mult:1.5,  req:{score:700, inc:1500000, nw:0}},
  {id:"gold",     n:"GOLD",      apr:12.9, cb:2,   mult:1.75, req:{score:720, inc:4000000, nw:5000000, or:1}},
  {id:"platinum", n:"PLATINUM",  apr:9.9,  cb:3,   mult:2.0,  req:{score:750, inc:10000000, nw:20000000, or:1}},
  {id:"black",    n:"BLACK",     apr:6.9,  cb:4,   mult:2.5,  req:{score:780, inc:20000000, nw:60000000, or:1}},
  {id:"unlimited",n:"MERIDIAN UNLIMITED", apr:4.9, cb:5, mult:0, req:{score:800, nw:250000000, nwOnly:1}},
];
function cardAnnualIncome(){ try{ return grossFor(S.blob.player.status)*18 + dealAnnual(); }catch(e){ return 0; } }
function cardTier(){ return CARD_TIERS.find(t=>t.id===(S.credit.tier||"basic")) || CARD_TIERS[0]; }
function cardTierEligible(t){
  const sc=S.credit.score, inc=cardAnnualIncome(), nw=netWorth();
  if (t.req.nwOnly) return sc>=t.req.score && nw>=t.req.nw;          // Ty's gate: NET worth, not assets; age never matters
  if (sc<t.req.score) return false;
  return t.req.or? (inc>=t.req.inc || nw>=t.req.nw) : (inc>=t.req.inc && (t.req.nw? nw>=t.req.nw : true));
}
function cardNaturalTier(){ let best=CARD_TIERS[0]; for (const t of CARD_TIERS) if (cardTierEligible(t)) best=t; return best; }
function cardUnlimited(){ return cardTier().id==="unlimited"; }
function cardRoom(){ return cardUnlimited()? Infinity : Math.max(0, S.credit.cardLimit - S.credit.cardBal); }
function cardCanCharge(amt){ return cardUnlimited() || (S.credit.cardBal + amt) <= S.credit.cardLimit; }
function payWithCard(amt, label){
  /* THE ONE CHARGE DOOR. A maxed card is a REAL decline — the toast names the shortfall,
     nothing posts. Interest can still push the balance over-limit; over-limit blocks all
     card purchases until it's paid down. Cashback lands in CHECKING the same moment. */
  if (!cardCanCharge(amt)){
    toast("Card declined. "+fm(amt)+" needs "+fm(Math.max(0,(S.credit.cardBal+amt)-S.credit.cardLimit))+" more room on your "+cardTier().n+" line ("+fm(S.credit.cardLimit)+").");
    return false;
  }
  S.credit.cardBal += amt;
  S.credit.ledger=S.credit.ledger||[]; S.credit.ledger.unshift({t:label, amt:amt, kind:"charge"});
  const cb=Math.round(amt*cardTier().cb/100);
  if (cb>0){ S.cash.checking+=cb; S.ledger.push({t:"Cashback — Meridian "+cardTier().n, amt:cb, kind:"income"});
    S.credit.ledger.unshift({t:"Cashback "+cardTier().cb+"% to checking", amt:-cb, kind:"cb"}); }
  persist(); return true;
}
function cardWeekly(){
  /* rollover engine: utilization moves the score, the limit grows, the tier moves.
     Downgrades only on real damage (missed minimum in the last 4wks, or score collapse
     50 under the tier's bar) — never on a quiet week. */
  const T=cardTier();
  if (!cardUnlimited()){
    const u = S.credit.cardLimit>0? S.credit.cardBal/S.credit.cardLimit : 0;
    if (S.credit.cardBal>0) creditTouch(u>1? -5 : u>0.9? -3 : u>0.6? -1 : u>0.3? 0 : 1);
    const target=Math.round((T.mult*(0.15*cardAnnualIncome() + 0.01*Math.max(0,netWorth())))/500)*500;
    if (target>S.credit.cardLimit){ S.credit.cardLimit=target;
      S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"card", t:"Meridian Credit", p:"Your line grew to "+fm(target)}); }
  }
  const nat=cardNaturalTier();
  const ci=CARD_TIERS.findIndex(t=>t.id===T.id), ni=CARD_TIERS.findIndex(t=>t.id===nat.id);
  const missedRecently = S.credit.missWk && (wkNum(wkKey(S.blob.clock))-wkNum(S.credit.missWk))<=4;
  if (ni>ci && !missedRecently){
    S.credit.tier=nat.id; S.credit.cardApr=nat.apr;
    S.world.notifs.push({app:"card", t:"Meridian Credit", p:"Card upgraded: "+nat.n+" — "+nat.apr+"% APR, "+nat.cb+"% cashback"});
  } else if (ni<ci && (missedRecently || S.credit.score < cardTier().req.score-50)){
    const down=CARD_TIERS[ci-1]; S.credit.tier=down.id; S.credit.cardApr=down.apr;
    S.world.notifs.push({app:"card", t:"Meridian Credit", p:"Card moved down to "+down.n});
  } else S.credit.cardApr=cardTier().apr;
}
/* Card */
RENDER.card = b=>{
  b.className="cardapp";
  const T=cardTier(); const unl=cardUnlimited();
  const min=Math.max(35, S.credit.cardBal*0.03);
  const u = (!unl && S.credit.cardLimit>0)? S.credit.cardBal/S.credit.cardLimit : 0;
  const uPct=Math.min(100, Math.round(u*100));
  const uLine = unl? "" : S.credit.cardBal<=0? "" :
    u>1? "OVER YOUR LIMIT — every card purchase is blocked and this costs you 5 score a week until it's paid down."
    : u>0.9? "Utilization "+uPct+"% — this is costing you 3 score every week."
    : u>0.6? "Utilization "+uPct+"% — this is quietly costing you a point a week."
    : u>0.3? "Utilization "+uPct+"% — neutral territory. Under 30% builds your score."
    : "Utilization "+uPct+"% — healthy. This BUILDS your score a point a week.";
  const nat=cardNaturalTier(); const ci=CARD_TIERS.findIndex(x=>x.id===T.id);
  const next=CARD_TIERS[ci+1];
  const nextLine = !next? "" : (function(){ const r=next.req;
    const bits=["score "+r.score+"+"]; if(r.nwOnly) bits.push(fmk(r.nw)+" NET worth"); else { if(r.inc) bits.push(fmk(r.inc)+"/yr income"); if(r.nw) bits.push((r.or?"or ":"and ")+fmk(r.nw)+" net worth"); }
    return "Next: "+next.n+" ("+next.apr+"% APR, "+next.cb+"% back) — needs "+bits.join(", ")+".";})();
  b.innerHTML = aphead("Credit Card") +
  `<div class="thecard"><div style="display:flex;justify-content:space-between"><span class="tn">MERIDIAN CREDIT</span><span style="color:${unl?"#c9a86a":"#9aa2ac"};font-size:11px;letter-spacing:1px">${T.n}</span></div>
   <div class="num">•••• •••• •••• ${S.last4||"4417"}</div>
   <div class="bot"><span>${esc((S.blob.player.first+" "+S.blob.player.last).toUpperCase())}</span><span>EXP 08/29</span></div></div>
  <div class="apbody">
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Balance <span>${unl? "NO LIMIT":"limit "+fm(S.credit.cardLimit)} · ${T.apr}% APR · ${T.cb}% back</span></h4>
    <b style="font-size:30px" class="mono">${fmc(S.credit.cardBal)}</b>
    ${!unl? `<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden"><div style="height:100%;width:${uPct}%;background:${u>0.9?"#c0392b":u>0.6?"#e8a13f":u>0.3?"#9aa2ac":"#2e9b63"}"></div></div>`:""}
    ${uLine? `<div style="font-size:12px;color:var(--dim);margin-top:6px;line-height:1.5">${uLine}</div>`:""}
    ${S.credit.cardBal>0?`<div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn sm" style="background:#cfd6df;color:#17191d" onclick="payCard(${min})">Pay minimum ${fm(min)}</button>
      <button class="btn sm" style="background:rgba(207,214,223,.15);color:#cfd6df" onclick="payCard(${S.credit.cardBal})">Pay in full</button></div>`:
      `<div style="font-size:13px;color:var(--dim);margin-top:6px">Zero balance. The card works at Octane, Harborline, Stratos, and marker settlements; autopay pulls the minimum monthly.</div>`}</div>
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Statement</h4>` +
  (function(){
    const rows=[...(S.credit.ledger||[]).slice(0,10).map(l=>({n:l.t, amt:l.amt})), ...S.cardTx.slice(-12).reverse().map(t=>({n:t.n, amt:t.amt}))];
    return rows.length? rows.map(t=>`<div class="payline ${t.amt<0?"neg":""}"><span>${esc(t.n)}</span><span>${fm(t.amt)}</span></div>`).join("") : `<div style="font-size:13px;color:var(--dim)">No activity.</div>`;
  })() + `</div>
  <div class="mercard" style="background:#1e2126;border:1px solid #2c3037"><h4>Your tier</h4>
    <div style="font-size:13px;line-height:1.6;color:var(--dim)">${unl? "MERIDIAN UNLIMITED. The card cannot decline. A 500-car garage is possible, and going broke from here is entirely your own doing." : nextLine}</div>
    <div style="margin-top:8px">${CARD_TIERS.map(t=>`<div class="payline" style="${t.id===T.id?"color:#fff":"opacity:.45"}"><span>${t.id===T.id?"\u25b8 ":""}${t.n}</span><span>${t.apr}% · ${t.cb}% back</span></div>`).join("")}</div>
    <div style="font-size:11.5px;color:var(--dim);margin-top:8px;line-height:1.5">The tier moves at the weekly rollover with your score, income, and net worth. It only moves DOWN after a missed minimum or a real score collapse, never on a quiet week. Your line grows with income and net worth and never shrinks.</div></div></div>`;   /* v1.11.1 (Ty): the tier lives UNDER statement activity */
};
function payCard(amt){
  amt=Math.min(amt, S.credit.cardBal);
  if (S.cash.checking<amt) return toast("Checking can't cover that payment.");
  S.cash.checking-=amt; S.credit.cardBal-=amt;
  S.credit.ledger=S.credit.ledger||[]; S.credit.ledger.unshift({t:"Payment from checking", amt:-Math.round(amt), kind:"pay"}); creditTouch(3);
  S.ledger.push({t:"Card payment", amt:-amt, kind:"spend"});
  persist(); renderApp("card"); renderWidget(); toast("Payment posted.");
}
/* WagerLines — the book */
/* v1.7.4 (Ty: "if i say im injured or make a guarantee or a roster move happens i should get
   a notification for wagerlines. and the line should move realistically"): the book reads his
   public posts and the save notices. Movement scales with how much he actually matters
   (pullScore) — a camp body's injury talk barely nudges a number; a starter's moves it. */
function wlScanPost(post){
  try{
    const t=(post.t||"").toLowerCase(); const hits=[];
    if (/(hurt|injur|sprain|ankle|hamstring|knee|shoulder|concussion|banged up|not 100|questionable|doubtful|can'?t go|out this week)/.test(t)) hits.push("injury");
    if (/(guarantee|book it|we (will|gonna|are going to) win|promise (a |the )?win|i promise we|write it down.*win)/.test(t)) hits.push("guarantee");
    if (!hits.length) return;
    S.wl=S.wl||{moves:[]};
    const w=Math.max(0.2, pullScore()/30); // who you are decides how far the number goes
    for (const h of hits){
      const key=h+"|"+wkKey(S.blob.clock);
      if (S.wl.moves.find(m=>m.key===key)) continue;
      /* v1.7.5: store in half-point steps, the board's own resolution. If the number rounds
         to nothing (a camp body's mouth), the book ignores it — and no notif pretends otherwise. */
      const pts = Math.round((h==="injury"? Math.min(3, w) : Math.min(1, w*0.35))*2)/2;
      if (!pts) continue;
      S.wl.moves.push({key, kind:h, pts, wk:wkKey(S.blob.clock), why: h==="injury"? "your injury talk":"your guarantee"});
      S.world.notifs.push({app:"wager", t:"WagerLines", p:"Line moved on your game \u2014 the book saw "+(h==="injury"?"the injury talk":"the guarantee")});
      if (typeof renderLock==="function") renderLock();
    }
    persist();
  }catch(e){}
}
function wlRosterMove(dir, why){ // dir +1 helps his team, -1 hurts it
  try{
    S.wl=S.wl||{moves:[]};
    const key="roster|"+why+"|"+wkKey(S.blob.clock);
    if (S.wl.moves.find(m=>m.key===key)) return;
    const pts=Math.round(Math.min(2, Math.max(0.5, pullScore()/40))*2)/2; // v1.7.5: half-point steps; a real roster move always moves at least 0.5
    S.wl.moves.push({key, kind:"roster", dir, pts, wk:wkKey(S.blob.clock), why});
    S.world.notifs.push({app:"wager", t:"WagerLines", p:"Line moved on your game \u2014 "+why});
  }catch(e){}
}
function wlDelta(g){
  const mine=S.blob.player.team;
  if (g.h!==mine && g.a!==mine) return null;
  const ms=(S.wl&&S.wl.moves||[]).filter(m=>m.wk===wkKey(S.blob.clock));
  if (!ms.length) return null;
  let pts=0; const why=[];
  const meHome = g.h===mine;
  for (const m of ms){
    if (m.kind==="injury")    pts += meHome? -m.pts :  m.pts;      // his team gets worse
    if (m.kind==="guarantee") pts += meHome?  m.pts*0.5 : -m.pts*0.5; // public money, tiny
    if (m.kind==="roster")    pts += (meHome? 1 : -1) * m.dir * m.pts;
    why.push(m.why);
  }
  pts=Math.round(pts*2)/2;
  if (!pts) return null;
  return {pts, why:[...new Set(why)]};
}
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
    const mv=wlDelta(g); let moved=null;
    if (mv && !g.played){ moved={from:spread, why:mv.why}; spread=Math.round((spread+mv.pts)*2)/2; }
    const total = Math.round((41 + rng()*10 + Math.abs(spread)*0.3)*2)/2;
    let mlH, mlA;
    const s5=n=>Math.round(n/5)*5;
    if (spread===0){ mlH=-110; mlA=-110; }
    else if (spread>0){ mlH=-s5(100+spread*40); mlA=s5(100+spread*34); }
    else { mlA=-s5(100+Math.abs(spread)*40); mlH=s5(100+Math.abs(spread)*34); }
    return {...g, spread, total, mlH, mlA, moved};
  });
}
/* v1.5.7: one shared broadcast scheduler for the whole phone. League games carry no day/time,
   so each week gets exactly one TNF, one SNF, one MNF (seeded, stable across renders), the rest
   split CBS/FOX; preseason is all NFLN. Ordering matches a real scoreboard: THU, SUN slate, SNF, MNF. */
function weekWindows(games, seedKey){
  const out = games.map(g=>({g}));
  if (games.length && games[0].t==="PreSeason"){
    out.forEach(x=>{ x.net="NFLN"; x.day="FRI"; x.ord=1; x.time="7:00 PM"; });
    return out;
  }
  const rng=seedRng(String(seedKey)+"|windows");
  const idx=[...out.keys()];
  const pick=()=>idx.splice(Math.floor(rng()*idx.length),1)[0];
  const tnf=out.length>3? pick():-1, snf=out.length>1? pick():-1, mnf=out.length>2? pick():-1;
  out.forEach((x,i)=>{
    if (i===tnf){ x.net="TNF"; x.day="THU"; x.ord=0; x.time="8:15 PM"; }
    else if (i===snf){ x.net="SNF"; x.day="SUN"; x.ord=2; x.time="8:20 PM"; }
    else if (i===mnf){ x.net="MNF"; x.day="MON"; x.ord=3; x.time="8:15 PM"; }
    else { x.net = (i%2? "FOX":"CBS"); x.day="SUN"; x.ord=1; x.time = rng()<0.62? "1:00 PM" : (rng()<0.5? "4:05 PM":"4:25 PM"); }
  });
  return out.sort((a,b)=>a.ord-b.ord || (a.g.played?0:1)-(b.g.played?0:1));
}
function wagerNet(g, i){ /* DEAD v1.5.7: replaced by weekWindows; kept per helper-deletion law */
  if (g.t==="PreSeason") return "NFLN";
  if (i===0) return "SNF"; if (i===1) return "TNF"; if (i===2) return "MNF";
  return i%2? "FOX":"CBS";
}
RENDER.wager = b=>{
  b.className="wager darkapp";
  const wkNow=S.blob.clock.week, tp=S.blob.clock.weekType;
  let games, priorGames=[];
  if (S.blob.league && S.blob.league.games.length){
    // league games are COMPACT ARRAYS [type(0 pre/1 reg), week, homeIdx, awayIdx, hs, as] — map first (v1.4 fix: filtering on .t/.w matched nothing, board collapsed to your game only)
    const tnames=S.blob.league.teams;
    const all=S.blob.league.games.map(g=>Array.isArray(g)
      ? {t:g[0]===0?"PreSeason":"RegularSeason", w:g[1], h:tnames[g[2]], a:tnames[g[3]], hs:g[4], as:g[5], played:g[4]>=0}
      : g).map(g=>Object.assign({}, g, {played: !!g.played && gameRevealed(g.t, g.w)}));   // v1.7.8 reveal law, array AND object games
    /* v1.7.8 (Ty: no spoilers): the CURRENT week's board is all open lines — the save may carry
       simmed finals, but nothing settles until the clock moves past the week. Last week's slate
       sits below, settled, with what the books thought. */
    const wins=weekWindows(all.filter(g=>g.t===tp && g.w===wkNow), S.careerId+"|"+tp+wkNow);
    games = wins.map(x=>{ x.g._net=x.net; x.g._day=x.day; return x.g; });
    if (wkNow>0){
      const pw=weekWindows(all.filter(g=>g.t===tp && g.w===wkNow-1 && g.played), S.careerId+"|"+tp+(wkNow-1));
      priorGames = pw.map(x=>{ x.g._net=x.net; x.g._day=x.day; return x.g; });
    }
  } else {
    const n=nextGame();
    games = n? [{w:n[0], t:n[1], h:n[4]?S.blob.player.team:n[3], a:n[4]?n[3]:S.blob.player.team, hs:0, as:0}] : [];
  }
  const lines = gameLines(games);
  const mine = S.blob.player.team;
  /* v1.6 (Ty #7): settled games leave the live board and become stat-style rows that STILL
     show what the books thought — closing spread, total, moneyline — plus the network chip.
     The line closes; the numbers stay on the record. */
  const openL = lines.filter(g=>!g.played), setL = gameLines(priorGames).filter(g=>g.played);   // v1.7.8: settled = LAST week only
  const spreadTxt = g => g.spread===0? "PK" : esc(g.h)+" "+(g.spread>0?"-":"+")+Math.abs(g.spread).toFixed(1);
  const mlTxt = g => `${esc(g.h)} ${g.mlH>0?"+":""}${g.mlH} · ${esc(g.a)} ${g.mlA>0?"+":""}${g.mlA}`;
  b.innerHTML = `<div class="brandhead wgr"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 8.5v-2A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.3 2.3 0 0 0 0 7v2A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.3 2.3 0 0 0 0-7z"/><path d="M9 5v14" stroke-dasharray="1.6 2.2"/></svg></div><div><h1>WagerLines</h1><small>Lines move. Discipline doesn't.</small></div></div>
  <div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>${tp==="PreSeason"?"Preseason":"Week"} ${wkNow+1} board</h3><span style="color:var(--faint)">${openL.length} open · finals arrive when the week does</span></div>
  ${openL.map(g=>`<div class="veh-detail" style="margin-bottom:10px;${(g.h===mine||g.a===mine)?"border-color:rgba(127,212,160,.4)":""}">
    <div class="payline" style="border:none;padding:2px 0"><span class="wl-match">${tlogoImg(g.a,"tlogo wl")}<b>${esc(g.a)}</b> at ${tlogoImg(g.h,"tlogo wl")}<b>${esc(g.h)}</b>${(g.h===mine||g.a===mine)?' <span style="color:#7fd4a0;font-size:11px">YOUR GAME</span>':""}</span><span>${netChip(g._net||"CBS")}</span></div>
    <div class="payline"><span>Spread</span><span>${g.spread===0? "PK (pick em)" : spreadTxt(g)}</span></div>
    ${g.moved? `<div class="payline" style="border:none;padding:2px 0"><span style="font-size:11px;color:#f4b45c">Line moved${g.moved.from!==g.spread? " from "+(g.moved.from>0?g.h+" -":g.a+" -")+Math.abs(g.moved.from).toFixed(1):""} \u00b7 ${esc(g.moved.why.join(", "))}</span><span></span></div>`:""}
    <div class="payline"><span>Total</span><span>O/U ${g.total.toFixed(1)}</span></div>
    <div class="payline"><span>Moneyline</span><span>${mlTxt(g)}</span></div>
    </div>`).join("") || '<div class="empty">No open lines. The board is settled below.</div>'}
  ${setL.length? `<div class="hoodhead" style="color:var(--ink);margin-top:16px"><h3>Last week — settled</h3><span style="color:var(--faint)">what the books thought</span></div>
  ${setL.map(g=>`<div class="veh-detail wl-settled" style="margin-bottom:8px">
    <div class="payline" style="border:none;padding:2px 0"><span class="wl-match">${tlogoImg(g.a,"tlogo wl")}<b>${esc(g.a)} ${g.as}</b> at ${tlogoImg(g.h,"tlogo wl")}<b>${esc(g.h)} ${g.hs}</b>${(g.h===mine||g.a===mine)?' <span style="color:#7fd4a0;font-size:11px">YOUR GAME</span>':""}</span><span>${netChip(g._net||"CBS")}</span></div>
    <div class="payline wl-closed"><span>${spreadTxt(g)}</span><span>O/U ${g.total.toFixed(1)}</span><span>${mlTxt(g)}</span></div>
    <div class="payline" style="border:none"><span class="wl-note">Line closed · settled</span><span class="wl-note">${(g=>{const w=g.hs>g.as?g.h:g.a; if(g.spread===0) return esc(w)+" win"; const fav=g.spread>0?g.h:g.a; const covered=g.spread>0? (g.hs-g.as>g.spread) : (g.as-g.hs>-g.spread); return esc(w)+" win · "+esc(fav)+(covered?" covered":" failed to cover");})(g)}</span></div>
    </div>`).join("")}`:""}
  ${S.bets && S.bets.length? `<div class="hoodhead" style="color:var(--ink)"><h3>Open tickets</h3></div>
   ${S.bets.map(bt=>`<div class="veh-detail" style="margin-bottom:8px"><div class="payline" style="border:none"><span>${esc(bt.label)}</span><span>${fm(bt.stake)}${bt.settled? (bt.won?' <b style="color:#7fd4a0">WON '+fm(bt.pay)+'</b>':' <b style="color:#ff9d94">LOST</b>'):""}</span></div></div>`).join("")}`:""}
  <p style="font-size:11px;color:var(--faint);margin-top:14px">Lines are the book's opinion of your world, generated from real records in the save. View only: NFL personnel are prohibited from betting on league games, and this phone is not trying to end your career.</p>
  </div>`;
  window._wlines = lines;
};

/* Mara — personal assistant */
RENDER.assist = b=>{
  b.className="assist darkapp";
  S.assistTiers = S.assistTiers || D.ASSIST.cats.map(_=>0);
  const total = D.ASSIST.cats.reduce((a,c,i)=>a+c[1][S.assistTiers[i]][1],0);
  b.innerHTML = `<div class="brandhead ast"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">MQ</div><div><h1>Client Services</h1><small>Mara Quinn · Apex Sports Group</small></div></div>
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
  b.innerHTML = `<div class="brandhead pod"><button class="back" onclick="closeApp()">‹ Home</button><div class="bh-mark">🎙</div><div><h1>Podium</h1><small>${esc(P.show)} · ${esc(P.hosts)}</small></div></div>
  <div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>Episodes</h3></div>
  ${P.eps.map(e=>`<div class="veh-detail" style="margin-bottom:10px">
    <div class="vd-title" style="font-size:16px;line-height:1.3">${esc(e.t)}</div>
    <div style="font-size:12px;opacity:.55;margin:4px 0 8px">${esc(e.wk|| (e.t.match(/(20\d\d \u00b7 .+)$/)||[])[1] || "")}${e.link?` \u00b7 <a href="${esc(e.link)}" target="_blank" style="color:#9db8ff">listen \u2197</a>`:""}</div>
    <p style="font-size:13px;line-height:1.5;opacity:.8">${esc(e.d)}</p>
    ${e.script?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="showScript('${e.id}')">Read the brief</button><button class="btn sm" style="background:rgba(255,255,255,.08)" onclick="podiumRegen('${e.id}')">Regenerate</button></div>`:""}
  </div>`).join("")}
  <div class="hoodhead" style="color:var(--ink);margin-top:16px"><h3>Make this week's episode</h3></div>
  ${(()=>{ /* v1.12.2 (Ty's ruling): the Podium records AFTER midweek — the make-episode section
       walls until this week's media availability is played out or waved off. Past episodes above
       stay readable forever; only the making walls. genEpisodeBrief guards at the engine door too. */
    const wk=wkKey(S.blob.clock); const mwDone=(S.midweek&&S.midweek[wk])||(S.midSkip&&S.midSkip[wk]);
    if(!mwDone) return `<div class="veh-detail"><p style="font-size:13px;line-height:1.6;opacity:.85;margin:0">The show tapes after your media availability. Open <b>Sync</b> and play out midweek first, or choose \u201cDon\u2019t talk to the media during the week\u201d \u2014 then this week's episode opens up here.</p></div></div>`;
    return `<div class="veh-detail" style="margin-bottom:10px">
    <div style="font-size:12px;opacity:.6;margin-bottom:6px">Episode length — your call, fresh every week. Never touches the save.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${[["short","Short · 3-6 min"],["default","Default · 6-15 min"],["deep","Deep Dive · 15-25+ min"]].map(o=>`<button class="btn sm" style="background:${(S.podiumLen||"default")===o[0]?"var(--ok)":"rgba(255,255,255,.1)"};color:${(S.podiumLen||"default")===o[0]?"#04170d":"inherit"}" onclick="podSetLen('${o[0]}')">${o[1]}</button>`).join("")}</div>
  </div>
  <div class="veh-detail">
    <p style="font-size:13px;line-height:1.7;opacity:.85">Exactly this, in the <b>Gemini Notebook</b> app:<br>
    <b>1.</b> Tap <b>Generate episode source</b> below, then <b>Copy source</b>.<br>
    <b>2.</b> Open the Gemini Notebook app \u2192 <b>+ Create New</b>.<br>
    <b>3.</b> Tap <b>Copied text</b> \u2192 press and hold the <i>Paste text here</i> box \u2192 Paste \u2192 <b>Add</b>.<br>
    <b>4.</b> Bottom bar \u2192 <b>Studio</b> \u2192 <b>Audio Overview</b> (tap the wand to customize).<br>
    <b>5.</b> Length: <b>${podLenSpec().label}</b> (your pick above). In the <i>Prompt</i> box ("What should the AI hosts focus on?"), paste the <b>focus prompt</b> \u2014 second copy button below. Tap <b>Generate</b>.<br>
    <b>6.</b> When it's done, share the audio and paste the link here so the episode lives in the feed.</p>
    <p style="font-size:12px;line-height:1.6;opacity:.6;margin:6px 0 0">Free NotebookLM generates up to <b>3 audios per 24 hours</b> (it resets, nothing is lost). Any other Notebook question \u2014 accounts, sharing, features \u2014 lives in <a href="https://support.google.com/notebooklm/answer/16213268" target="_blank" rel="noopener" style="color:#8fb8ff">Google's NotebookLM help</a>.</p>
    <button class="btn" style="background:#4a3a76;color:#fff;margin-top:10px" onclick="genEpisodeBrief()">Generate episode source</button>
    ${S.world.podium.eps[0]&&S.world.podium.eps[0].script? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn sm" style="background:var(--ok);color:#04170d" onclick="window._brief=S.world.podium.eps[0].script;navigator.clipboard.writeText(window._brief).then(()=>toast('Source copied. Step 2: Gemini Notebook, Create New.'))">Copy source (step 1)</button>
      <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="navigator.clipboard.writeText(S.world.podium.eps[0].focus||'Follow the source segments in order. Only discuss what the source contains.').then(()=>toast('Focus prompt copied. Paste it in the Prompt box (step 5).'))">Copy focus prompt (step 5)</button>
    </div>`:""}
    <input class="field" id="epLink" placeholder="Paste the share link" style="margin-top:8px">
    <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="attachEpLink()">Attach to latest episode</button>
  </div>
  </div>`; })()}`;
};
function showScript(id){
  const e=S.world.podium.eps.find(x=>x.id===id);
  window._brief=e.script;
  sheet(`<h3 style="font-size:16px">${esc(e.t)}</h3><div style="max-height:50vh;overflow:auto;font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(e.script)}</div>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="navigator.clipboard.writeText(window._brief).then(()=>toast('Source copied. Gemini Notebook: Create New, Copied text, paste, Add.'))">Copy source</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="navigator.clipboard.writeText((S.world.podium.eps.find(x=>x.script===window._brief)||{}).focus||'Follow the source segments in order. Only discuss what the source contains.').then(()=>toast('Focus prompt copied for the Prompt box.'))">Copy focus prompt</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Close</button>`);
}
/* v1.6.3: the show tours the LEAGUE. Give the brief writer the real slate + standings so
   relevance is grounded in actual results, not vibes. */
function leagueDigest(){
  const L=S.blob.league; if(!L||!L.games||!L.games.length) return "";
  const tn=L.teams; const tp=S.blob.clock.weekType, wkNow=S.blob.clock.week;
  const all=L.games.map(g=>Array.isArray(g)? {t:g[0]===0?"PreSeason":"RegularSeason", w:g[1], h:tn[g[2]], a:tn[g[3]], hs:g[4], as:g[5], played:g[4]>=0} : g);
  const rs=all.filter(g=>g.t==="RegularSeason"&&(g.played||g.hs+g.as>0));
  const lastWk = rs.length? Math.max(...rs.map(g=>g.w)) : -1;
  const wkGames = rs.filter(g=>g.w===lastWk);
  const recs={};
  for (const g of rs){ recs[g.h]=recs[g.h]||{w:0,l:0}; recs[g.a]=recs[g.a]||{w:0,l:0};
    if(g.hs>g.as){recs[g.h].w++;recs[g.a].l++;} else if(g.as>g.hs){recs[g.a].w++;recs[g.h].l++;} }
  const table=Object.entries(recs).sort((a,b)=>b[1].w-a[1].w);
  let out="\nLEAGUE THIS WEEK (real results, wk "+(lastWk+1)+"): "+wkGames.map(g=>g.a+" "+g.as+" @ "+g.h+" "+g.hs).join("; ")+".";
  out+="\nSTANDINGS SNAPSHOT: best "+table.slice(0,5).map(([t,r])=>t+" "+r.w+"-"+r.l).join(", ")+" | worst "+table.slice(-3).map(([t,r])=>t+" "+r.w+"-"+r.l).join(", ")+".";
  const ld=L.leaders;
  if (ld && typeof ld==="object") out+="\nSTAT LEADERS: "+Object.entries(ld).slice(0,5).map(([cat,d])=>{const r=(d.rows||[])[0];return r? cat+": "+r[0]+" ("+r[2]+" "+(d.unit||"")+")":"";}).filter(Boolean).join("; ")+".";
  return out;
}
/* ============ v1.9.2 PODIUM: NOTEBOOKLM REALITY + LENGTH CHOICE (Ty's addendum) ============
   The [m:ss] fake schedule was a workaround for a length limit that does not exist —
   NotebookLM's 3/day resets forever and duration is free. The player picks a length each
   week; the brief's CONTENT LAWS are untouched, only word count and depth scale. Regeneration
   is always available, ungated, untracked — no budget UI anywhere, by design. */
function podLenSpec(){
  const l=S.podiumLen||"default";
  if (l==="short") return {k:"short", label:"Shorter", ui:"Short · 3-6 min", words:"350-600 words", depth:"hit the week's headlines cleanly and get out — the biggest stories only, no filler"};
  if (l==="deep") return {k:"deep", label:"Longer", ui:"Deep Dive · 15-25+ min", words:"1500-2500 words", depth:"wander the WHOLE league in depth — every division gets real attention, standings context, second-order storylines, and the kind of tangents two hosts actually take"};
  return {k:"default", label:"Default", ui:"Default · 6-15 min", words:"700-1200 words", depth:"a full tour of the league's week — the real stories with room to breathe, no padding"};
}
function podSetLen(l){ S.podiumLen=l; persist(); renderApp("podium"); }
async function podiumRegen(id){
  /* free, always available — chasing a better take costs nothing real. The old audio link
     clears because it no longer matches the words. */
  const e=S.world.podium.eps.find(x=>x.id===id); if(!e) return;
  if (!aiKey()) return toast("Add an API key first (Settings).");
  toast("Rewriting the brief…");
  try{
    const out = await callAI(podBriefSys(), worldFacts(S.blob, lastPlayed())+leagueDigest()+"\nWrite this week's source document now.", podLenSpec().k==="deep"?4500:podLenSpec().k==="short"?1400:2600);
    e.script=out; e.focus=podFocus(); e.d=out.split("\n").find(l=>l.trim().length>40)||e.d; delete e.link;
    persist(); renderApp("podium"); toast("Fresh brief ready. Same steps, new take.");
  }catch(err){ toast("Regeneration failed: "+err.message); }
}
function podBriefSys(){
  const L=podLenSpec();
  return "You write the SOURCE DOCUMENT for "+S.world.podium.show+", a fictional NFL podcast hosted by "+S.world.podium.hosts+". Two AI hosts will read ONLY this document and talk from it. Hard rules: "+L.words+" of flowing prose — NO time marks, NO segment headers, NO bullets; the audio length is set separately and duration is free, so never compress for time. Depth for this episode: "+L.depth+". THE SHOW TOURS THE WHOLE LEAGUE: lead with whatever is genuinely relevant, popular, or a good story around the NFL this week from the real results given. "+S.blob.player.first+" "+S.blob.player.last+" and the "+S.blob.player.team+" appear ONLY if the given facts make them one of the league's stories this week; an irrelevant team is simply irrelevant and goes completely unmentioned, no courtesy nods, no name-drops"+(S.blob.player.status==="PracticeSquad"? " (a practice squad player earns at most a passing curiosity, most weeks nothing)":"")+". Cover BOTH sides of the week roughly half and half: the front half on what actually happened around the league, the back half on the week ahead. Tie every claim to the real scores and standings. Grounded and dry-funny. No em dashes.";
}
function podFocus(){
  return "Two hosts of "+S.world.podium.show+". Work through the source in order. Talk ONLY about what the source contains. If a team or player is not in the source, they do not exist this episode. No outside NFL knowledge, no real-world events.";
}
async function genEpisodeBrief(){
  /* v1.12.2 (Ty's ruling): the Podium is walled until midweek is handled — the engine door
     enforces what the render walls, so no stale button or console call slips past. */
  const mwWk=wkKey(S.blob.clock);
  if (!((S.midweek&&S.midweek[mwWk])||(S.midSkip&&S.midSkip[mwWk]))) return toast("The show tapes after your media availability. Play out midweek in Sync first, or wave it off.");
  if (!aiKey()) return toast("Add an API key in Sync first.");   /* v1.12.2: the one "Settings" straggler the v1.8.3 sweep missed */
  toast("Writing the brief…");
  try{
    const last = lastPlayed();
    const out = await callAI(podBriefSys(),
      worldFacts(S.blob, last)+leagueDigest()+"\nWrite this week's source document now.", podLenSpec().k==="deep"?4500:podLenSpec().k==="short"?1400:2600);
    const focus=podFocus();
    const ep={id:"ep"+Date.now(), t:"Ep. "+(41+S.world.podium.eps.length), wk:wkLabel(S.blob.clock), dur:"", d:out.split("\n").find(l=>l.trim().length>40)||"This week's episode.", script:out, focus};
    S.world.podium.eps.unshift(ep); persist(); renderApp("podium"); toast("Brief ready. Feed it to NotebookLM.");
  }catch(e){ toast("Generation failed: "+e.message); }
}
function attachEpLink(){
  // v1.7.1 (Ty): the runtime box is gone — the link is all an episode needs.
  const v=$("#epLink").value.trim();
  if (!v) return;
  const ep=S.world.podium.eps[0]; if(!ep) return;
  ep.link=v;
  persist(); renderApp("podium"); toast("Episode linked.");
}
/* ============================ THE PRESSER ============================
   v1.7.4 (Ty's design): after every synced game there is a podium. The player answers (or
   doesn't). His ANSWERS are this sync's postgame quotes — coverage may quote or tightly
   paraphrase THEM, attributed namelessly ("told reporters after the game"), and may NEVER
   invent podium words beyond them, never attach a reporter identity to a podium question,
   and must cite the record EXACTLY as banked (a team that fell to 3-2 did not fall to 3-1).
   No comment is an answer: at most one neutral note. The presser owns the game just played;
   midweek owns the week ahead. */
function recordAfter(sched, g){
  // W-L(-T) through THIS game, same weekType AND same season, exact string (v1.7.5: year filter + ties)
  let w=0,l=0,t=0;
  for (const x of (sched||[])){
    if (x[1]!==g[1] || x[2]!==g[2] || !x[7]) continue;
    if (x[0]>g[0]) continue;
    if (x[7][0]>x[7][1]) w++; else if (x[7][0]<x[7][1]) l++; else t++;
  }
  return w+"-"+l+(t?"-"+t:"");
}
/* v1.7.5 (Ty): the podium is EARNED. Played + mattered = questions. One tackle is not a
   press conference; an int probably is; QBs who play talk every week. When the save gives us
   no per-game visibility (preseason boxes don't land in the season stat tables, and a season
   roll breaks the diff), role + a seeded coin stand in — honestly. */
function mergedSS(blob){ const m={}; for (const r of ((blob||{}).seasonStats||[])) for (const k in r){ if (k!=="table" && typeof r[k]==="number") m[k]=Math.max(m[k]||0, r[k]); } return m; }
function statDelta(a,b){ const d={}; for (const k in b){ const x=(b[k]||0)-((a||{})[k]||0); if (x>0) d[k]=x; } return d; }
function presserGate(g, d){
  const pos=S.blob.player.pos;
  const rng=seedRng(S.careerId+"|pod|"+g[2]+g[1]+g[0]);
  if (d){
    if (!(d.GAMESPLAYED>0)) return {yes:false, why:"you didn't get in the game"};
    const off=(d.PASSYARDS||0)+(d.RUSHYARDS||0)+(d.RECEIVEYARDS||0);
    const tds=(d.PASSTDS||0)+(d.RUSHTDS||0)+(d.RECEIVETDS||0)+(d.DSECINTTDS||0);
    const splash=(d.DSECINTS||0)+(d.DLINESACKS||0)+(d.DLINEFORCEDFUMBLES||0)+(d.DLINEFUMBLERECOVERIES||0);
    if (pos==="QB" && (d.PASSATTEMPTS||0)>=8) return {yes:true};
    if (tds>0 || splash>0) return {yes:true};
    if (off>=60 || (d.RECEIVECATCHES||0)>=6 || (d.RUSHATTEMPTS||0)>=12) return {yes:true};
    if ((d.DEFTACKLES||0)>=8) return {yes:true};
    if ((d.KICKFGMADE||0)>=3 || (d.KICKFGLONGEST||0)>=50) return {yes:true};
    if (off>=35 || (d.DEFTACKLES||0)>=5) return {yes: rng()<0.4, why:"a quiet stat line"};
    return {yes:false, why:(d.DEFTACKLES||0)===1? "one tackle isn't a press conference" : "a quiet stat line"};
  }
  const t=pullTier();
  if (t.score>=45) return {yes:true};
  if (pos==="QB") return {yes: rng()<0.5, why:"the room wanted the starters"};
  return {yes: rng()<0.25, why:"the room wanted the starters"};
}
/* v1.7.5 (Ty): midweek interviews follow standing. A starting WR gets a locker scrum even
   without podium questions; a third-stringer gets silence. */
function midweekMediaOn(){
  const c=S.blob.clock||{};
  if ((c.weekType||c.stage)==="OffSeason") return false;
  const t=pullTier(); if (t.score>=45) return true;
  let gs=0; for (const r of (S.blob.seasonStats||[])) gs=Math.max(gs,(r&&r.GAMESSTARTED)||0);
  const teamG=Math.max(1,(S.blob.schedule||[]).filter(g=>g[7]&&g[1]==="RegularSeason").length);
  return gs/teamG>=0.5;
}
function midTemplates(n){
  const opp=n?n[3]:"the next one";
  const all=[
    "What's the one thing this week of practice has to fix?",
    "What jumps off the tape about "+opp+"?",
    "Which matchup are you circling"+(n&&!n[4]?" on the road":"")+" this week?",
    "Where has your own game grown since camp broke?"];
  const used=new Set(Object.values(S.askedQs||{}).flat());
  return all.filter(q=>!used.has(q.slice(0,40))).slice(0,2).map(q=>({q}));
}
let _maQs=null, _maResume=false;   // v1.8.5: scrum-first — resume the midweek write after his answer
async function midAvailQuestions(){
  const n=nextGame(); const fb=()=>midTemplates(n);
  if (!aiKey()) return fb();
  try{
    const out=await callAI("You write 2 midweek locker-room questions for the player described. They are about THIS practice week and the game AHEAD"+(n? " ("+(n[4]?"home vs ":"road at ")+n[3]+")":"")+" — never the last game; the podium owned that."+freshLine()+" No reporter names or personas. Output ONLY a JSON array: [{\"q\":\"...\"}] x2, no fences.",
      worldFacts(S.blob, lastPlayed())+String.fromCharCode(10)+"Write the two questions now.", 300);
    const arr=parseModelJSON(out);
    if (Array.isArray(arr)&&arr.length) return arr.slice(0,3).filter(x=>x&&x.q);
  }catch(e){}
  return fb();
}
async function midAvailSheet(){
  toast("They circle up\u2026");
  const cached=(S.midAvailQs||{})[wkKey(S.blob.clock)];
  const qs=(cached&&cached.length)? cached : await midAvailQuestions(); _maQs=qs;   /* v1.13.0: the runner preloads these — the sheet opens instantly */
  sheet(`<h3>At your locker</h3><p class="sp">Midweek media availability \u00b7 the week ahead only. Whatever you type IS your midweek quote; leave one blank to pass on it.</p>
  ${qs.map((x,i)=>`<label class="flabel" style="margin-top:8px">${esc(x.q)}</label>
    <textarea class="field" id="maA${i}" rows="2" placeholder="your words, on the record"></textarea>`).join("")}
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="midAvailSave()">Done talking</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="midAvailSkip();closeSheet()">Wave them off</button>`);
}
function midAvailSave(){
  const qs=_maQs||[]; _maQs=null;
  const qa=qs.map((x,i)=>{ const a=($("#maA"+i)&&$("#maA"+i).value.trim())||""; return a? {q:x.q, a} : {q:x.q, nc:true}; });
  S.midAvail=S.midAvail||{}; S.midAvail[wkKey(S.blob.clock)]={qa};
  const yr=String((S.blob.clock||{}).seasonYear||"");
  S.askedQs=S.askedQs||{}; S.askedQs[yr]=(S.askedQs[yr]||[]).concat(qs.map(x=>x.q.slice(0,40))).slice(-40);
  persist(); closeSheet(); toast("On the record."); if(curApp==="cal") renderApp("cal");
  if(_maResume){ _maResume=false;
    if (aiKey()){ S.midweek=S.midweek||{}; S.midweek[wkKey(S.blob.clock)]=true; persist(); runWeek(); if(curApp==="sync") renderApp("sync"); }   /* v1.13.0: answering IS the step — the Podium brief writes itself now */
    else midweekTick(); }   // v1.8.5 (keyless): the scrum came first — now the week writes with his words in the facts
}
function midAvailSkip(){
  S.midAvail=S.midAvail||{}; S.midAvail[wkKey(S.blob.clock)]={qa:[], skipped:true};
  persist(); toast("Waved off. That reads standoffish, once."); if(curApp==="cal") renderApp("cal");
  if(_maResume){ _maResume=false;
    if (aiKey()){ S.midweek=S.midweek||{}; S.midweek[wkKey(S.blob.clock)]=true; persist(); runWeek(); if(curApp==="sync") renderApp("sync"); }   /* v1.13.0: a wave-off is an answer — the episode writes without his quotes */
    else midweekTick(); }   // v1.8.5 (keyless): waving them off is an answer too — the week writes without his quotes
}
function midAvailLine(){
  const wk=wkKey(S.blob.clock); const a=(S.midAvail||{})[wk];
  if (!a) return midweekMediaOn()? "" : String.fromCharCode(10)+"MIDWEEK MEDIA LAW: he has no midweek media availability this week (his standing does not draw midweek interviews). NEVER invent midweek quotes or interview answers from him.";
  if (a.skipped || !a.qa.filter(x=>x.a).length) return String.fromCharCode(10)+"MIDWEEK MEDIA: he skipped his midweek media availability this week. Coverage may note that at most ONCE, neutrally; no midweek quotes from him exist.";
  const ans=a.qa.filter(x=>x.a);
  return String.fromCharCode(10)+"MIDWEEK LOCKER-ROOM QUOTES (the ONLY midweek words from him; quote or tightly paraphrase, nameless attribution — 'said at his locker', 'told reporters this week'; these own the WEEK AHEAD, never the last game; the Podium episode's look-ahead half may quote them): "+ans.map(x=>'Q: "'+x.q+'" \u2014 HE SAID: "'+x.a+'"').join(" || ");
}
function pressTemplates(g, rec){
  const opp=g.opp; const won=g.score[0]>g.score[1];
  const all=[
    "Walk us through what you saw on the "+(won?"drive that put it away":"stretch where it got away")+".",
    "Which teammate quietly won his matchup tonight, and what did it unlock?",
    "What does the "+rec+" record say about this room that the outside doesn't see?",
    "The "+opp+" showed a look you hadn't practiced for. What was the sideline adjustment?",
    "Where are you a different player than you were a month ago?",
    "What's the one thing from tonight that has to travel to next week?"];
  const used=new Set(Object.values(S.askedQs||{}).flat());
  return all.filter(q=>!used.has(q.slice(0,40))).slice(0,4).map(q=>({q}));
}
function freshLine(){
  const asked=Object.values(S.askedQs||{}).flat();
  return "\nMEDIA QUESTION FRESHNESS LAW: interview and podium questions must feel like a real, evolving press corps. ROTATE angles: a specific scheme detail, a specific teammate, the locker room, personal growth, a live storyline, the opponent's identity. BANNED worn stems: 'talk about your preparation', 'how does X change your approach', 'what does this mean for'. NEVER repeat a question already asked this season"+(asked.length? " (already asked: "+asked.slice(-12).join(" | ")+")":"")+".";
}
function pressersLine(){
  const g=lastPlayed(); if(!g) return "";
  const gk="pr"+g[2]+"|"+g[1]+"|"+g[0];
  const pr=(S.pressers||{})[gk]; if(!pr) return "";
  let out="\nTHE PRESSER (postgame podium, THIS sync's game — "+ (g[4]?"vs ":"at ")+g[3]+" "+g[7][0]+"-"+g[7][1]+", team record after: EXACTLY "+pr.record_after+"): ";
  if (pr.skipped_all){
    out+="he SKIPPED availability entirely. Coverage may note that ONCE, neutrally, and may not invent a single podium word.";
  } else {
    const answered=pr.qa.filter(x=>x.a); const nc=pr.qa.filter(x=>x.nc);
    if (answered.length) out+="HIS ACTUAL ANSWERS (the only postgame quotes that exist; quote or tightly paraphrase, attributed namelessly — 'told reporters after the game', 'said at the podium', 'said afterward'; NEVER name or characterize the reporter who asked, NEVER invent words beyond these): "+answered.map(x=>'Q: "'+x.q+'" \u2014 HE SAID: "'+x.a+'"').join(" || ")+". ";
    if (nc.length) out+="He declined "+nc.length+" question"+(nc.length>1?"s":"")+" ('no comment'). At most ONE neutral factual mention of that, phrased however feels natural, zero judgment. ";
    out+="LAW: the presser owns the game just played; midweek media owns the week ahead. The record is cited exactly as given.";
  }
  return out;
}
/* Calendar — the week, and one optional midweek beat */
function weekDays(){
  // in-game week anchored on Tuesday (deposit day). Returns 7 day objects Tue..Mon.
  const clock=S.blob.clock, y=clock.seasonYear||2026;
  let anchor;
  if (clock.weekType==="PreSeason") anchor = new Date(y,7,14 + clock.week*7); // v1.7.2: matches gameDateObj
  else if (clock.weekType==="RegularSeason") anchor = new Date(y,8,10 + clock.week*7);
  else if (clock.weekType==="OffSeason") anchor = new Date(y+1,2,15);
  else anchor = new Date(y+1,0,11 + Math.max(0,(clock.week||0)-18)*7); // v1.6.1: global postseason week count
  // walk back to Tuesday
  while (anchor.getDay()!==2) anchor.setDate(anchor.getDate()-1);
  const n=nextGame();
  const gameDayName = n? (n[5]||"Sunday") : null;
  const days=[];
  for (let i=0;i<7;i++){
    const d=new Date(anchor); d.setDate(anchor.getDate()+i);
    const name=d.toLocaleDateString(undefined,{weekday:"long"});
    let ev="", cls="";
    if (i===0){ ev="Direct deposit · league payday"; cls="pay"; }
    const gameIdx = ["Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Monday"].indexOf(gameDayName||"Sunday");
    if (name===gameDayName && n){ ev=(n[4]?"GAME vs ":"GAME at ")+n[3]; cls="game"; }
    else if (!ev){
      if (i>gameIdx) ev = i===gameIdx+1? "Recovery · treatment" : "Off day";
      else if (i===gameIdx-1) ev = n&&!n[4]? "Walkthrough · travel" : "Walkthrough";
      else ev="Practice · meetings";
    }
    days.push({d, name, ev, cls, short:d.toLocaleDateString(undefined,{month:"short",day:"numeric"})});
  }
  return {days, n};
}
RENDER.cal = b=>{
  b.className="cal darkapp";
  const {days, n} = weekDays();
  const wk = wkKey(S.blob.clock);
  S.midweek = S.midweek||{};
  const done = !!S.midweek[wk];
  b.innerHTML = aphead("Calendar") + `<div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>${esc(wkLabel(S.blob.clock))}</h3><span style="color:var(--faint)">${esc(gameDate(S.blob.clock))}</span></div>
  ${days.map((x,i)=>{const today = i===(done?2:0); return `<div class="calday ${x.cls}${today?" today":""}">
    <div class="cd-date"><b>${esc(x.name)}</b><span>${esc(x.short)}</span>${today?'<i class="tdy">TODAY</i>':''}</div>
    <div class="cd-ev">${esc(x.ev)||"<span style='opacity:.4'>Open</span>"}</div>
  </div>`}).join("")}
  ${S.presserDue? `<div class="hoodhead" style="color:var(--ink);margin-top:18px"><h3>Postgame press conference</h3><span style="color:var(--faint)">the room won't leave</span></div>
  <div class="synccard" style="margin:0 0 6px;border:1px solid rgba(244,180,92,.35)">
    <p style="margin-top:0">${S.presserDue.home?"vs":"at"} ${esc(S.presserDue.opp)} went final ${S.presserDue.score[0]}-${S.presserDue.score[1]}. The room is waiting. Whatever you say here IS your postgame quote — the paper, the feeds, and the shows can only use these words.</p>
    <button class="btn sm" style="background:var(--ok);color:#04170d" onclick="presserSheet()">Take questions</button>
  </div>`:""}
  ${(!S.presserDue && S.presserNone && S.presserNone.wk===wkLabel(S.blob.clock))? `<p style="font-size:11.5px;opacity:.55;margin:14px 2px 0">No press conference this week — ${esc(S.presserNone.why)}.</p>`:""}
  ${done? "" : `<p style="font-size:12px;color:var(--faint);margin:16px 2px 0">Midweek hasn't played out yet — it lives in the <b>Sync</b> app now (the green Midweek card).</p>`}
  </div>`;
};
let calBusy=false;
const BUSYL='Please wait<span class="waitdots"><i>.</i><i>.</i><i>.</i></span>'; /* v1.7.5 (Ty): moving dots so nobody thinks it froze */
async function presserQuestions(){
  const d=S.presserDue;
  const g=[null,null,null,d.opp]; // template shape
  const fallback=()=>pressTemplates({opp:d.opp, score:d.score}, d.record_after);
  if (!aiKey()) return fallback();
  try{
    const out=await callAI("You write 4 postgame press-conference questions for the player described. Questions address ONLY the game just played: "+(d.home?"home vs ":"road at ")+d.opp+", final "+d.score[0]+"-"+d.score[1]+", team record now EXACTLY "+d.record_after+"."+freshLine()+" No reporter names or personas — just the questions. Output ONLY a JSON array: [{\"q\":\"...\"}] x4, no fences.",
      worldFacts(S.blob, lastPlayed())+"\n\nWrite the four questions now.", 500);
    const arr=parseModelJSON(out);
    if (Array.isArray(arr)&&arr.length) return arr.slice(0,5).filter(x=>x&&x.q);
  }catch(e){}
  return fallback();
}
async function presserSheet(){
  /* v1.13.1 THE ONE MEDIA SESSION (Ty's flow ruling): postgame AND the week ahead in ONE room,
     right after the sync. Answer or skip — either way media is DONE for the week, the Podium
     never walls, and no midweek card ever appears again. No game played = no session at all. */
  const d=S.presserDue; if(!d) return;
  toast("The room settles\u2026");
  const wk=wkKey(S.blob.clock);
  const wantAhead = (typeof midweekMediaOn==="function"? midweekMediaOn() : true) && !(S.midAvail&&S.midAvail[wk]);
  const cached=(S.midAvailQs||{})[wk];
  const [qs, aq] = await Promise.all([ presserQuestions(), wantAhead? ((cached&&cached.length)? Promise.resolve(cached) : midAvailQuestions()) : Promise.resolve([]) ]);
  window._prQs=qs; window._prAq=aq;
  sheet(`<h3>Postgame press conference</h3><p class="sp">${d.home?"vs":"at"} ${esc(d.opp)} \u00b7 final ${d.score[0]}-${d.score[1]} \u00b7 you're ${esc(d.record_after)}. Answer any, no-comment any.</p>
  <div style="max-height:52vh;overflow:auto">
  ${qs.map((x,i)=>`<label class="flabel" style="margin-top:8px">${esc(x.q)}</label>
    <textarea class="field" id="prA${i}" rows="2" placeholder="your words, on the record"></textarea>
    <label style="display:flex;gap:6px;align-items:center;font-size:12px;opacity:.75"><input type="checkbox" id="prN${i}"> No comment</label>`).join("")}
  ${aq.length? `<p class="sp" style="margin-top:12px;font-weight:600">And looking ahead \u2014 the week to come:</p>
  ${aq.map((x,i)=>`<label class="flabel" style="margin-top:8px">${esc(x.q)}</label>
    <textarea class="field" id="maA${i}" rows="2" placeholder="your words, on the record"></textarea>`).join("")}`:""}
  </div>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="presserSave()">Done talking</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Not yet</button>`);
}
function presserSave(){
  const d=S.presserDue; if(!d) return;
  const qs=window._prQs||[];
  const qa=qs.map((x,i)=>{
    const nc=$("#prN"+i)&&$("#prN"+i).checked;
    const a=($("#prA"+i)&&$("#prA"+i).value.trim())||"";
    return nc||!a? {q:x.q, nc:true} : {q:x.q, a};
  });
  S.pressers=S.pressers||{}; S.pressers[d.gk]={record_after:d.record_after, qa, skipped_all:false, wk:d.wk};
  const yr=String((S.blob.clock||{}).seasonYear||"");
  S.askedQs=S.askedQs||{}; S.askedQs[yr]=(S.askedQs[yr]||[]).concat(qs.map(x=>x.q.slice(0,40))).slice(-40);
  /* v1.13.1: the week-ahead half saves in the same breath — media DONE, Podium ungated */
  const aq=window._prAq||[]; window._prAq=null;
  const wk=wkKey(S.blob.clock);
  if (aq.length){
    const maQa=aq.map((x,i)=>{ const a=($("#maA"+i)&&$("#maA"+i).value.trim())||""; return a? {q:x.q, a} : {q:x.q, nc:true}; });
    S.midAvail=S.midAvail||{}; S.midAvail[wk]={qa:maQa};
    S.askedQs[yr]=(S.askedQs[yr]||[]).concat(aq.map(x=>x.q.slice(0,40))).slice(-40);
  }
  if (aiKey()){ S.midweek=S.midweek||{}; S.midweek[wk]=true; }
  S.presserDue=null; persist(); closeSheet();
  toast("On the record. The world can only quote what you actually said.");
  if (aiKey()) runWeek();
  if (curApp==="cal") renderApp("cal"); if (curApp==="sync") renderApp("sync");
}
function presserSkip(){
  const d=S.presserDue; if(!d) return;
  S.pressers=S.pressers||{}; S.pressers[d.gk]={record_after:d.record_after, qa:[], skipped_all:true, wk:d.wk};
  /* v1.13.1: skipping the room skips BOTH halves — media done, episode writes without him */
  const wk=wkKey(S.blob.clock);
  S.midAvail=S.midAvail||{}; if(!S.midAvail[wk]) S.midAvail[wk]={qa:[], skipped:true};
  if (aiKey()){ S.midweek=S.midweek||{}; S.midweek[wk]=true; }
  S.presserDue=null; persist();
  toast("Skipped availability. That gets noticed exactly once.");
  if (aiKey()) runWeek();
  if (curApp==="cal") renderApp("cal"); if (curApp==="sync") renderApp("sync");
}
/* ==================== v1.13.0 THE POWERHOUSE (Ty's ruling, the streamline chat) ====================
   THE PHONE IS THE PEN. One sync lands and the WHOLE week writes itself on the phone — a
   checkpointed queue where every finished job persists instantly, so a lock or a walk-away
   pauses, never ruins. A screen wake lock holds while writing (set it down face-up; it cannot
   auto-lock mid-write) and releases the moment the last job lands. Order = what you'll touch
   first: locker questions (seconds) -> the article -> the world -> the Podium brief (gated on
   your media availability, per the quote law — it writes itself the moment you answer or wave).
   Midweek as a SYNC STEP is dead for keyed phones: media availability is just a card you tap
   during the week, or don't. Lane C survives ONLY as the keyless fallback, untouched.
   THE EXE IS A DUMB RELIABLE PIPE: save read/write + the mailbox ferry, nothing else. */
let weekRunBusy=false, _wakeLock=null;
async function wakeAcquire(){ try{ if(navigator.wakeLock && !_wakeLock){ _wakeLock=await navigator.wakeLock.request("screen"); _wakeLock.addEventListener("release",()=>{_wakeLock=null;}); } }catch(e){ console.log("wake lock unavailable:", String(e.message||e)); } }
function wakeRelease(){ try{ if(_wakeLock){ _wakeLock.release(); _wakeLock=null; } }catch(e){} }
function mediaHandled(){ const wk=wkKey(S.blob.clock); return !!((S.midweek&&S.midweek[wk])||(S.midSkip&&S.midSkip[wk])); }
function weekEnqueue(blob, last){
  /* keyed phones only — the runner IS the pen. Enqueue replaces any older week's leftovers. */
  S.weekJobs={wk:wkKey(blob.clock), gk:last?gkey(last):null,
    jobs:[{id:"questions",st:"todo"},{id:"article",st:"todo"},{id:"world",st:"todo"},{id:"podium",st:"gated"}]};
  persist(); runWeek();
}
function weekRunLine(){
  const W=S&&S.weekJobs; if(!W) return "";
  const done=W.jobs.filter(j=>j.st==="done").length, total=W.jobs.length;
  const failed=W.jobs.find(j=>j.st==="failed");
  const gated=W.jobs.find(j=>j.id==="podium"&&j.st==="gated");
  if (weekRunBusy) return "Writing the week\u2026 "+done+" of "+total+" done \u00b7 set the phone down, the screen stays awake \u00b7 if you leave, it resumes when you're back.";
  if (failed) return "The week's writing paused ("+failed.id+": "+esc(failed.err||"failed")+"). Tap Resume the week's writing.";
  if (gated && done===total-1) return "The week is written \u2713 \u00b7 the Podium episode writes itself after your media availability.";
  return "The week's writing will resume on its own \u2014 or tap Resume now.";
}
async function runWeek(){
  if (weekRunBusy || !S || !S.weekJobs) return;
  if (!aiKey()) return;                                                    // keyless never runs the phone pen
  if (S.weekJobs.wk!==wkKey(S.blob.clock)){ S.weekJobs=null; persist(); return; }   // a week the save left dies quietly
  weekRunBusy=true; await wakeAcquire(); if(curApp==="sync") renderApp("sync");
  for (const j of S.weekJobs.jobs){
    if (!S.weekJobs) break;
    if (j.st==="done") continue;
    if (j.id==="podium"){ if (j.st==="gated"){ if (mediaHandled()) j.st="todo"; else continue; } }
    if (j.st!=="todo" && j.st!=="failed") continue;
    try{
      if (j.id==="questions"){ const qs=await midAvailQuestions(); S.midAvailQs=S.midAvailQs||{}; S.midAvailQs[S.weekJobs.wk]=qs; }
      else if (j.id==="article"){ const l=lastPlayed(); if (l && !(S.articleFor||{})[gkey(l)]) await writeGameStory(S.blob, l); }
      else if (j.id==="world"){ await generateWeek(S.blob, lastPlayed(), {local:true, noArticle:true, fullWeek:true}); }
      else if (j.id==="podium"){ await podiumJobRun(); }
      j.st="done"; delete j.err; persist(); if(curApp==="sync") renderApp("sync");
    }catch(e){ j.st="failed"; j.err=String(e.message||e).slice(0,90); persist(); if(curApp==="sync") renderApp("sync"); break; }
  }
  if (S.weekJobs && S.weekJobs.jobs.every(x=>x.st==="done")){ S.weekJobs=null; S.world.notifs.push({app:"sync", t:"Sync", p:"The week is written \u2014 everything's on the phone"}); persist(); }
  weekRunBusy=false; wakeRelease(); if(curApp==="sync") renderApp("sync");
}
document.addEventListener("visibilitychange", ()=>{ try{ if(!document.hidden && S && S.weekJobs) runWeek(); }catch(e){} });   /* v1.13.0: coming back resumes the week */
async function podiumJobRun(){
  /* the episode writes ITSELF after media availability (quote law: his real answers exist first) */
  const last=lastPlayed();
  const out=await callAI(podBriefSys(), worldFacts(S.blob, last)+leagueDigest()+"\nWrite this week's source document now.", podLenSpec().k==="deep"?4500:podLenSpec().k==="short"?1400:2600);
  const focus=podFocus();
  const ep={id:"ep"+Date.now(), t:"Ep. "+(41+S.world.podium.eps.length), wk:wkLabel(S.blob.clock), dur:"", d:out.split("\n").find(l=>l.trim().length>40)||"This week's episode.", script:out, focus};
  S.world.podium.eps.unshift(ep);
  S.world.notifs.unshift({app:"podium", t:"Podium", p:"This week's episode brief wrote itself"});
}
async function midweekTick(){
  if (!aiKey() && !laneCOn()) return toast("Add an API key in Sync first.");   // v1.8.1: the computer's key covers the heavies
  const wk = wkKey(S.blob.clock);
  S.midweek = S.midweek||{};
  if (S.midweek[wk] || calBusy) return;
  if (S.midSkip && S.midSkip[wk]) return toast("You chose not to talk to the media this week. That call is final; the next sync re-offers it fresh.");   // v1.8.5: the wave-off law, enforced at the engine too
  /* v1.13.0 THE POWERHOUSE: on a KEYED phone midweek is not a sync and not a write — the week
     package already covered the whole week. This button is just the media availability now;
     answering (or waving) marks the week handled and the Podium brief writes itself. The beat
     body below survives for KEYLESS lane C phones only, exactly as it always ran. */
  if (aiKey()){
    if (midweekMediaOn() && !(S.midAvail&&S.midAvail[wk])){ _maResume=true; return midAvailSheet(); }
    S.midweek[wk]=true; persist(); toast("No media asked for you this week. The week moves on.");
    runWeek(); if(curApp==="sync") renderApp("sync"); if(curApp==="cal") renderApp("cal");
    return;
  }
  /* v1.8.5 (Ty's podium ruling): the locker-room scrum happens FIRST — his midweek answers
     (with his postgame podium answers already in the facts) are exactly what the Podium
     episode and the beat have "to go on". Done talking / Wave them off resumes the write;
     backdrop-dismiss just postpones — tapping Play out midweek re-opens the scrum. */
  if (midweekMediaOn() && !(S.midAvail&&S.midAvail[wk])){ _maResume=true; midAvailSheet(); return; }
  calBusy=true; if(curApp==="sync") renderApp("sync"); if(curApp==="cal") renderApp("cal");   // v1.8.6: the v1.8.5 scrum insert ATE this line (insert-trap #8) — busy dots + the double-tap guard are back
  const ruled = coachEvaluate("midweek");                             // v1.7.5 (Ty: coach never saw his post): Calendar midweek evaluates too, BEFORE the world writes
  if (ruled) toast("The club sent word. Check T-Mail.");
  const n=nextGame();
  const f=S.chirp.followers||0;
  const sys = `You write the MIDWEEK beat of a fictional NFL life-sim phone. Everything anchors to the SAVE FACTS. No game has been played since the facts were written: the last game's result in the facts is LAST week, already lived; the coming matchup is the WEEK AHEAD. Chirps, texts, threads, and emails live in the practice week and look ahead; they never re-report the last game as news. Presser answers in the facts belong to the LAST game; MIDWEEK LOCKER-ROOM QUOTES belong to the week ahead; only the Podium episode may draw on both, per its spec below. NO articles of any kind midweek — the Chronicle writes on full week syncs only. No em dashes. Output STRICT JSON only, no fences:
{"chirps":[{"n":"","h":"@handle","vf":0,"t":"","li":0,"rp":0,"tm":"1h"} x3-5, practice reports, roster chatter, one about the coming game],
"myReplies":[{"a":"name","h":"@handle","x":"short reply"} x0-3, ONLY if the player has recent posts worth replying to, scaled to ${f.toLocaleString()} followers],
"texts":[{"thread":"${S.world.texts.map(t=>t.id).join("|")}","msgs":[["them","..."]]} x1-3],
"emails":[{"id":"unique","from":"","subj":"","time":"","unread":true,"body":""} x0-1],
"huddle":[{"id":"unique","flair":"DISCUSSION","u":"","tm":"2h","up":0,"h":"","b":"","cmts":[{"u":"","tm":"","up":0,"t":"","r":[]} x6-9]} x1, a practice-week fan thread],
"podium":{"t":"episode title","brief":"a ${podLenSpec().words} source brief for the show, flowing prose with NO time marks and NO segment headers (the audio length is set separately; never compress for time; depth: ${podLenSpec().depth}), covering BOTH sides of the week roughly half and half — the front half reviews what actually happened around the league last week (the real results and standings in the facts), the back half turns to the week ahead league-wide${n? " (his team's is "+(n[4]?"home vs ":"the road trip to ")+n[3]+", mentioned only if it earns it)":""}. THE SHOW IS NATIONAL: it tours the whole NFL for whatever is genuinely interesting or a good story; the subject player and his team appear ONLY if the facts make them one of the league's stories, no courtesy nods, and a role player or specialist may go a whole season unmentioned — that is correct. If the facts carry THE PRESSER (his actual postgame answers) or MIDWEEK LOCKER-ROOM QUOTES (his actual locker answers), those are the ONLY words of his the hosts may quote or paraphrase; if neither exists he said nothing anywhere; HIS RECENT PUBLIC POSTS in the facts are also really his and quotable as social-media comment."}}` + threadCtx() + inboundPlan();
  try{
    /* v1.8.1 LANE C: the midweek heavyweight rides the mailbox when the toggle is on; the
       intake below is UNTOUCHED — it runs when the computer's text comes home instead. */
    if (laneCOn() && !aiKey()){
      /* v1.12.4 law, restated: midweek rides lane C ONLY keyless (and since v1.13.0 keyed
         phones never even reach this body — the early return above owns them). */
      const handled = await queueMidweekJob(sys, worldFacts(S.blob, lastPlayed())+"\n\nWrite the midweek beat now.", wk);
      if (handled){ calBusy=false; if(curApp==="cal") renderApp("cal"); return; }
    }
    const j = await aiJSON(sys, worldFacts(S.blob, lastPlayed())+"\n\nWrite the midweek beat now.", 6000);
    intakeMidweek(j, wk);
  }catch(e){
    /* v1.7.6 (Ty: coach word arrived, nothing else did): a failed generation used to leave only
       a vanishing toast — a half-empty midweek could pass for a quiet one. The failure now leaves
       a persistent notification and an honest stamp; the Calendar card stays up for a retry. */
    const d=new Date();
    S.lastMidweek = "FAILED "+d.toLocaleDateString([], {month:"short",day:"numeric"})+" "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+" — "+String(e.message||e).slice(0,90)+" — tap Play midweek to retry";
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"Midweek didn't generate — tap Play midweek in Sync to retry"});
    persist();
    toast("Midweek failed: "+e.message);
  }
  calBusy=false; if(curApp==="cal") renderApp("cal");
}
function intakeMidweek(j, wk){
  /* v1.8.1: the midweek intake is ONE door — husks, dupes, notebook voice, and the earned
     scrum auto-pop fire identically whether the phone or the computer wrote the JSON. */
  const f=S.chirp.followers||0;
    if (j.chirps) S.world.chirps=[...dedupeChirps(j.chirps, S.world.chirps), ...S.world.chirps].slice(0,40);   // v1.7.7: no repeat voices
    if (j.myReplies && j.myReplies.length){
      const posts=(S.chirp.posts||[]).slice(-3);
      for (const r of j.myReplies){ if(!r||!String(r.x||"").trim()) continue; const p=posts[Math.floor(Math.random()*posts.length)]; if(p){ p.replies=p.replies||[]; if(dedupeReplies([r], p.replies).length){ p.replies.push(r); p.li=(p.li||0)+Math.round(f*0.008); } } }   // v1.7.6 husks + v1.7.7 dupes filtered
    }
    if (j.texts) for (const t of inboundClamp(j.texts)){ const th=S.world.texts.find(x=>x.id===t.thread); if(th){ th.msgs.push(...t.msgs.map(m=>[m[0],m[1],Date.now()])); th.last=Date.now(); delete S.reads["t:"+th.id]; delete th.hidden; } }   /* v1.9.5: same door, same law */
    if (j.huddle && j.huddle.length) S.world.huddle=[...j.huddle, ...S.world.huddle].slice(0,20); // v1.6.8 (Ty): the Huddle moves midweek too
    if (j.emails) S.world.emails=[...j.emails, ...S.world.emails];
    stampWorld();
    /* v1.8.5 (Ty's ruling): NO articles midweek — the Midweek Notebook is retired; the
       Chronicle writes on full week syncs only. Old notebooks already in the feed stay. */
    if (j.podium && j.podium.brief){
      S.world.podium.eps.unshift({id:"ep"+Date.now(), t:j.podium.t||("Midweek, "+wkLabel(S.blob.clock)), dur:"", d:j.podium.brief.split("\n").find(l=>l.trim().length>30)||"This week's episode.", script:j.podium.brief});
      S.world.notifs.unshift({app:"podium", t:"Podium", p:"New episode brief is up"});
    }
    S.midweek[wk]=true;
    if (S.mailJobs && S.mailJobs.kind==="midweek" && S.mailJobs.wk===wk){ S.mailJobs=null; console.log("stale midweek desk stamp cleared — the phone wrote this week itself (the box copy is discarded on arrival)"); }   /* v1.12.4: a locally-written midweek frees the desk at once; the consume-door guard catches any copy that still comes home */
    const d=new Date();
    S.lastMidweek = "Played "+d.toLocaleDateString([], {month:"short",day:"numeric"})+" "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+" · "+(j.chirps||[]).length+" chirps, "+((j.huddle||[]).length?"1 thread, ":"")+(j.texts||[]).length+" text threads"+((j.emails||[]).length?", 1 email":"")+(j.podium?", Podium episode":"");
    syncTick();                                     /* v1.9.6: midweek IS a sync — the clock ticks (one door, both pens) */
    persist(); toast("Midweek played out.");
    if(curApp==="cal") renderApp("cal");
    /* v1.8.5 (Ty's podium ruling): the scrum moved BEFORE the write (midweekTick opens it
       first) so his locker answers feed the Podium episode — the old post-intake auto-pop
       is retired; by the time the writing lands, availability was already answered. */
}

/* Settings */
/* v1.6.8 (Ty): the college is a real dropdown now — every FBS and FCS program, plus
   "Other" with a free-type box for D2/D3/juco/international. The save still auto-fills
   when it carries a college; the picker exists because fresh created players usually don't. */
const FBS_SCHOOLS=["Air Force","Akron","Alabama","Appalachian State","Arizona","Arizona State","Arkansas","Arkansas State","Army","Auburn","Ball State","Baylor","Boise State","Boston College","Bowling Green","Buffalo","BYU","California","Central Michigan","Charlotte","Cincinnati","Clemson","Coastal Carolina","Colorado","Colorado State","Delaware","Duke","East Carolina","Eastern Michigan","Florida","Florida Atlantic","Florida International","Florida State","Fresno State","Georgia","Georgia Southern","Georgia State","Georgia Tech","Hawai'i","Houston","Illinois","Indiana","Iowa","Iowa State","Jacksonville State","James Madison","Kansas","Kansas State","Kennesaw State","Kent State","Kentucky","Liberty","Louisiana","Louisiana-Monroe","Louisiana Tech","Louisville","LSU","Marshall","Maryland","Memphis","Miami","Miami (OH)","Michigan","Michigan State","Middle Tennessee","Minnesota","Mississippi State","Missouri","Missouri State","Navy","NC State","Nebraska","Nevada","New Mexico","New Mexico State","North Carolina","North Texas","Northern Illinois","Northwestern","Notre Dame","Ohio","Ohio State","Oklahoma","Oklahoma State","Old Dominion","Ole Miss","Oregon","Oregon State","Penn State","Pittsburgh","Purdue","Rice","Rutgers","Sam Houston","San Diego State","San Jose State","SMU","South Alabama","South Carolina","South Florida","Southern Miss","Stanford","Syracuse","TCU","Temple","Tennessee","Texas","Texas A&M","Texas State","Texas Tech","Toledo","Troy","Tulane","Tulsa","UAB","UCF","UCLA","UConn","UMass","UNLV","USC","Utah","Utah State","UTEP","UTSA","Vanderbilt","Virginia","Virginia Tech","Wake Forest","Washington","Washington State","West Virginia","Western Kentucky","Western Michigan","Wisconsin","Wyoming"];
const FCS_SCHOOLS=["Abilene Christian","Alabama A&M","Alabama State","Albany","Alcorn State","Arkansas-Pine Bluff","Austin Peay","Bethune-Cookman","Brown","Bryant","Bucknell","Butler","Cal Poly","Campbell","Central Arkansas","Central Connecticut","Charleston Southern","Chattanooga","Colgate","Columbia","Cornell","Dartmouth","Davidson","Dayton","Delaware State","Drake","Duquesne","East Tennessee State","East Texas A&M","Eastern Illinois","Eastern Kentucky","Eastern Washington","Elon","Florida A&M","Fordham","Furman","Gardner-Webb","Georgetown","Grambling State","Hampton","Harvard","Holy Cross","Houston Christian","Howard","Idaho","Idaho State","Illinois State","Incarnate Word","Indiana State","Jackson State","Lafayette","Lamar","Lehigh","Lindenwood","LIU","Maine","Marist","McNeese","Mercer","Mercyhurst","Merrimack","Mississippi Valley State","Monmouth","Montana","Montana State","Morehead State","Morgan State","Murray State","New Hampshire","Nicholls","Norfolk State","North Alabama","North Carolina A&T","North Carolina Central","North Dakota","North Dakota State","Northern Arizona","Northern Colorado","Northern Iowa","Northwestern State","Penn","Portland State","Prairie View A&M","Presbyterian","Princeton","Rhode Island","Richmond","Robert Morris","Sacramento State","Sacred Heart","Saint Francis","Samford","San Diego","South Carolina State","South Dakota","South Dakota State","Southeast Missouri State","Southeastern Louisiana","Southern","Southern Illinois","Southern Utah","St. Thomas","Stephen F. Austin","Stetson","Stonehill","Stony Brook","Tarleton State","Tennessee State","Tennessee Tech","Texas Southern","The Citadel","Towson","UC Davis","UT Martin","Utah Tech","UTRGV","Valparaiso","Villanova","VMI","Wagner","Weber State","West Georgia","Western Carolina","Western Illinois","William & Mary","Wofford","Yale","Youngstown State"];
const COLLEGE_TIERS = {elite:["Ohio State","Michigan","Alabama","Georgia","Texas","Oregon","Notre Dame","USC","Penn State","LSU","Clemson","Florida State","Oklahoma","Tennessee","Ole Miss"], mid:["Louisville","Iowa","Kansas State","Utah","UCF","Boise State","Memphis","Tulane","Appalachian State","Toledo","Marshall","San Diego State"], small:["Howard","Monmouth","Villanova","North Dakota State","Montana","Yale","Fordham","Lehigh","Grambling State","Jackson State"]};
function collegePrestige(name){
  if(!name) return "unknown";
  if(COLLEGE_TIERS.elite.some(c=>name.includes(c))) return "blue blood";
  if(COLLEGE_TIERS.small.some(c=>name.includes(c))) return "small school";
  // v1.6.8: division-aware default — an FCS program reads small school, an FBS one mid-tier,
  // and anything typed by hand (D2/D3/juco) reads small school unless the lists say otherwise.
  if(FCS_SCHOOLS.includes(name)) return "small school";
  if(FBS_SCHOOLS.includes(name)) return "mid-tier";
  return "small school";
}
function colHintLive(v){ const el=$("#colHint"); if(el) el.textContent="Prestige reads automatically: "+collegePrestige((v||"").trim())+"."; }
function colSelChange(v){
  const pc=S.perception;
  if (v==="__other"){ pc.colOther=1; }
  else { pc.colOther=0; pc.collegeName=v; }
  persist(); rerenderSettings();
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
  /* v1.12.3 (Ty's screenshot): an EMPTY state used to render as the first option ("AL") —
     a lie. A blank state now shows an explicit placeholder, college-picker style. */
  const stateOpts = ((pc.stateOther===undefined && !pc.state)? ["\u2014 pick your state \u2014"] : []).concat(D.STATES).concat(["Other (type a country)"]);
  const stateCur = pc.stateOther!==undefined? "Other (type a country)" : (pc.state||"\u2014 pick your state \u2014");
  const debtT = pc.debtTotal||0;
  const shares = pc.debtShares || [40,25,5,15,10,5];
  b.innerHTML = aphead("Settings") + `<div class="apbody">
  <div class="hoodhead" style="color:var(--ink)"><h3>Initial information</h3></div>
  <p style="font-size:12.5px;color:var(--faint);line-height:1.5;margin-bottom:12px">Who you were before the league. The world's perception is dynamic from here: it moves with your play, your posts, and your results. Money facts still come only from the save.</p>
  <label class="flabel">Hometown state</label>${dd("pcState", stateOpts, stateCur)}
  ${pc.stateOther!==undefined || stateCur==="Other (type a country)" ? `<label class="flabel">Country</label><input class="field" id="pcStateOther" value="${esc(pc.stateOther||"")}" placeholder="e.g. Nigeria, Germany, Australia" onchange="savePerception()">` : ""}
  <label class="flabel">Where you grew up (town, area, whatever you want the world to know)</label>
  <input class="field" id="pcGrew" value="${esc(pc.grew||"")}" placeholder="e.g. Rochester, small town upstate" onchange="savePerception()">
  <label class="flabel">High school profile</label>${dd("pcHS", ["Unranked nobody","Local standout","State champion","National recruit"], pc.hs||"Local standout")}
  <label class="flabel">College</label>
  ${(function(){
    const cn=pc.collegeName||"";
    const inList = FBS_SCHOOLS.includes(cn)||FCS_SCHOOLS.includes(cn);
    const other = pc.colOther || (cn && !inList);
    return `<select class="field" id="pcColSel" onchange="colSelChange(this.value)">
      <option value="" ${!cn&&!other?"selected":""}>— pick your school —</option>
      <optgroup label="FBS">${FBS_SCHOOLS.map(s=>`<option ${!other&&cn===s?"selected":""}>${esc(s)}</option>`).join("")}</optgroup>
      <optgroup label="FCS">${FCS_SCHOOLS.map(s=>`<option ${!other&&cn===s?"selected":""}>${esc(s)}</option>`).join("")}</optgroup>
      <option value="__other" ${other?"selected":""}>Other (type a school — D2, D3, juco, anywhere)</option>
    </select>
    ${other? `<input class="field" id="pcColName" value="${esc(cn)}" placeholder="Type the school" oninput="colHintLive(this.value)" onchange="savePerception()">`:""}`;
  })()}
  <div style="font-size:11.5px;color:var(--faint);margin:-6px 0 8px" id="colHint">Prestige reads automatically: ${esc(collegePrestige(pc.collegeName))}.${pc.collegeName?"":" The save's college slot is empty for created players (verified against the save itself) — pick yours here once and it sticks."}</div>
  <label class="flabel">College career</label>${dd("pcCol", ["Multi-year starter","Late-career starter","Career backup","Good career, bad ending","Poor career","Walk-on, never played"], pc.college||"Career backup")}
  <label class="flabel">Family situation</label>${dd("pcFam", ["Single parent household","Both parents, tight money","Middle class, stable","Family is comfortable","It's complicated"], pc.family||"Single parent household")}
  <label class="flabel">Monthly support you send home ($)</label>
  <input class="field" id="pcAsk" type="number" min="0" step="50" value="${pc.familyAsk||0}" onchange="savePerception()">
  <label class="flabel">Draft story ${S.blob.player.draftRound!=null?'(read from the save)':''}</label>
  <div class="field" style="opacity:.75">${esc(pc.draft||"Undrafted free agent")}</div>
  <label class="flabel">Public reputation (set by the league, not by you)</label>
  <div class="field" style="opacity:.75">${esc(autoReputation())}</div>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Debt you brought with you</h3></div>
  ${pc.debtLocked? `<p style="font-size:12.5px;color:var(--faint);line-height:1.5;margin:0 0 8px">Locked in at ${fm(pc.debtTotal||0)}. This is history now; nobody re-negotiates the past. Pay it down in <b>Meridian → Loans</b>: regular payments run on autopay, and you can throw extra at the principal or pay any of it off outright.</p>
  ${S.debts.filter(d=>d.kind==="legacy").map(d=>`<div class="payline"><span>${esc(d.n)} · ${d.apr}%</span><span>${fm(Math.round(d.bal))} left</span></div>`).join("")}
  ${(S.credit&&S.credit.cardBal>0 && (pc.debtShares||[])[1]>0)? `<div class="payline"><span>Credit card share</span><span>on the Meridian Credit card</span></div>`:""}`
  : `<label class="flabel">Total debt ($)</label>
  <input class="field" type="number" min="0" step="500" id="pcDebtTotal" value="${debtT}" onchange="savePerception();rerenderSettings()">
  ${debtT>0? `<p style="font-size:12px;color:var(--faint);margin:0 0 10px">Tap − / + in 5% steps. Shares are relative; the dollars show the real split. Credit card share lands on the Meridian Credit card.</p>
  <div id="debtSliders">${D.DEBTCATS.map((c,i)=>`<div class="dstep">
    <span class="ds-name">${c}</span>
    <span class="ds-amt" id="dsAmt${i}">${fm(Math.round(debtT*shares[i]/(shares.reduce((a,b)=>a+b,0)||1)))}</span>
    <span class="ds-ctl"><button onclick="debtStep(${i},-1)">−</button><b id="dsPct${i}">${Math.round(shares[i]*100/(shares.reduce((a,b)=>a+b,0)||1))}%</b><button onclick="debtStep(${i},1)">+</button></span>
  </div>`).join("")}</div>
  ${(shares[3]>0)? `<label class="flabel">The car on that auto loan</label>
  <input class="field" id="pcAutoCar" value="${esc(pc.autoLoanCar||"")}" placeholder="e.g. 2022 Dodge Charger" onchange="savePerception()">
  <p style="font-size:11.5px;color:var(--faint);margin:-4px 0 10px">An auto loan means a car exists. It parks in your Meridian garage when you lock, and the loan wears its name.</p>`:""}
  <button class="btn sm" style="background:rgba(127,212,160,.16);color:#7fd4a0" onclick="lockDebts()">Lock it in — this is permanent</button>
  <p style="font-size:11.5px;color:var(--faint);margin-top:6px">One-time. Once locked, the debt is real: it amortizes weekly and only payments make it smaller.</p>` : ""}`}
  <div style="font-size:12px;color:var(--faint);margin-top:6px">${pc.seedLocked? `Starting balance: <b>${fm(pc.seedAmt||0)}</b> · locked in. One-time, like the debt — it only moves by spending it.`
  : `Starting balance seeds from your profile (draft money, NIL, family): <b>${fm(startingCash(pc))}</b>${S.appliedWeeks.length<=1? ` · <button class="mer-link" style="color:#7fd4a0" onclick="applySeedCash()">apply &amp; lock</button>`:""}`}</div>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Family</h3></div>
  <p style="font-size:12.5px;color:var(--faint);line-height:1.5;margin-bottom:10px">Your people, written by you. The world only ever uses the family you put here — parents, siblings, significant others — and never invents anyone new. Facts are what the world is allowed to know.</p>
  ${(pc.familyPeople||[]).map((f,i)=>`<div class="famrow">
    <div class="famtop"><select class="field" style="width:46%;margin:0" onchange="famSet(${i},'rel',this.value)">${["Mother","Father","Stepmother","Stepfather","Brother","Sister","Significant other","Fiancée","Wife","Husband","Grandmother","Grandfather","Guardian","Other"].map(r=>`<option ${f.rel===r?"selected":""}>${r}</option>`).join("")}</select>
    <input class="field" style="width:50%;margin:0" placeholder="Name" value="${esc(f.name||"")}" onchange="famSet(${i},'name',this.value)"></div>
    <input class="field" placeholder="Facts the world knows (job, city, vibe)" value="${esc(f.fact||"")}" onchange="famSet(${i},'fact',this.value)">
    <button class="btn sm" style="background:rgba(244,100,92,.12);color:#ff9d94" onclick="famDel(${i})">Remove</button>
  </div>`).join("")}
  <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="famAdd()">+ Add family member</button>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Beta: practice dials</h3></div>
  <p style="font-size:12px;color:var(--faint);margin:0 0 10px">Testing controls for the future practice engine. The world treats these as the coach's honest evaluation of your week. 0 is a disaster, 10 is the best week of your life. Tap a number.</p>
  ${["practice","film"].map(k=>`<label class="flabel">${k==="practice"?"On-field practice":"Film study / mental prep"} · <b id="bd-${k}-lbl">${betaDials()[k]}/10 ${dialLabel(betaDials()[k])}</b></label>
  <div class="dialrow" id="bd-${k}">${Array.from({length:11},(_,v)=>`<button class="${betaDials()[k]===v?"on":""}" onclick="setDial('${k}',${v})">${v}</button>`).join("")}</div>`).join("")}
  <label class="flabel" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">The coach acts on his own (fines, benchings, demotions)
  <input type="checkbox" ${S.staffAuto!==false?"checked":""} onchange="S.staffAuto=this.checked;persist()"></label>
  <p style="font-size:11.5px;color:var(--faint);margin-top:2px">On: the staff disciplines you for bad practice weeks and public messes without asking. Off: the world only talks.</p>
  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Phone</h3></div>
  <label class="flabel" style="display:flex;justify-content:space-between;align-items:center">App theme
  <select class="field" style="width:auto;margin:0" onchange="META.settings.theme=this.value;saveMeta();applyTheme()"><option value="dark" ${META.settings.theme!=="light"?"selected":""}>Dark</option><option value="light" ${META.settings.theme==="light"?"selected":""}>Light</option></select></label>
  <label class="flabel">Wallpaper</label>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
    <span style="font-size:13px;color:${META.settings.wallpaper?'#7fd4a0':'var(--faint)'}">${META.settings.wallpaper?"Saved ✓":"Default"}</span>
    <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="pickFile('wallpaper')">${META.settings.wallpaper?"Change":"Choose"}</button>
    ${META.settings.wallpaper?`<button class="btn sm" style="background:rgba(244,100,92,.15);color:#ff9d94" onclick="META.settings.wallpaper=null;saveMeta();applyWallpaper();rerenderSettings();toast('Wallpaper reset.')">Reset</button>`:""}
  </div>
  <label class="flabel">Profile photo (used on Chirper)</label>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
    <span style="font-size:13px;color:${META.settings.pfp?'#7fd4a0':'var(--faint)'}">${META.settings.pfp?"Saved ✓":"Initials"}</span>
    <button class="btn sm" style="background:rgba(255,255,255,.1)" onclick="pickFile('pfp')">${META.settings.pfp?"Change":"Choose"}</button>
    ${META.settings.pfp?`<button class="btn sm" style="background:rgba(244,100,92,.15);color:#ff9d94" onclick="META.settings.pfp=null;saveMeta();rerenderSettings();toast('Back to initials.')">Reset</button>`:""}
  </div>

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Dock (bottom 4)</h3></div>
  ${[0,1,2,3].map(i=>{const cur=dockIds()[i];return `<label class="flabel" style="display:flex;justify-content:space-between;align-items:center">Slot ${i+1}
   <select class="field" style="width:60%;margin:0" onchange="setDock(${i}, this.value)">${appPool().map(a=>`<option value="${a.id}" ${cur===a.id?"selected":""}>${a.n}</option>`).join("")}</select></label>`}).join("")}

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Home screen order</h3></div>
  <p style="font-size:12px;color:var(--faint);margin:0 0 10px">Give an app a slot and everything else shifts around it. No two apps share a slot. Saved on this phone; survives updates.</p>
  ${gridApps().map((a,i)=>`<label class="flabel" style="display:flex;justify-content:space-between;align-items:center">${a.n}
   <select class="field" style="width:76px;margin:0" onchange="moveApp('${a.id}', +this.value)">${gridApps().map((_,n)=>`<option value="${n}" ${i===n?"selected":""}>#${n+1}</option>`).join("")}</select></label>`).join("")}

  <div class="hoodhead" style="color:var(--ink);margin-top:20px"><h3>Career</h3></div>
  <button class="btn" style="background:rgba(255,255,255,.08)" onclick="location.hash='#debug';location.reload()">Debug readout</button>
  <button class="btn" style="background:rgba(244,100,92,.15);color:#ff9d94" onclick="resetCareer()">Reset this career</button>
  <button class="btn" style="background:rgba(244,100,92,.28);color:#ffb3ab;margin-top:8px" onclick="erasePhoneSheet()">Erase this phone…</button>
  </div>`;
};
function pickFile(kind){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>{ if(kind==="wallpaper") setWallpaper(inp); else setPfp(inp); setTimeout(rerenderSettings, 700); };
  inp.click();
}
function rerenderSettings(){
  const b=document.querySelector(".apbody"); const sc=b?b.scrollTop:0;
  renderApp("settings");
  requestAnimationFrame(()=>{const nb=document.querySelector(".apbody"); if(nb) nb.scrollTop=sc;});
}
/* v1.6 (Ty #4): debts are entered ONCE and locked. After the lock, applyDebts never
   rebuilds them again — the amortizing S.debts rows become the only truth, payable in
   Meridian (regular autopay + extra principal + full payoff). */
function lockDebts(){
  const pc=S.perception;
  if (pc.debtLocked) return;
  if (!(pc.debtTotal>0)) return toast("Enter a total first.");
  applyDebts();
  pc.debtLocked=1;
  for (const d of S.debts) if (d.kind==="legacy" && !d.orig) d.orig=d.bal;
  // v1.6.7: an auto loan implies a car — it parks in the garage, worth what's owed on it
  const sh=pc.debtShares||[40,25,5,15,10,5], shSum=sh.reduce((a,b)=>a+b,0)||1;
  const autoBal=Math.round((pc.debtTotal||0)*sh[3]/shSum);
  if (autoBal>=250 && !S.garage.find(g=>g.id==="legacycar"))
    S.garage.push({n: pc.autoLoanCar||"The car you brought with you", value: autoBal, body:"sedan", id:"legacycar"});
  persist(); rerenderSettings(); toast("Locked. It's real now. See Meridian → Loans.");
}
function debtStep(i, dir){
  if (S.perception.debtLocked) return;
  // v1.4: 5% steps replace the sliders (renormalize-and-rerender on every drag tick made them sticky).
  const pc=S.perception;
  pc.debtShares = pc.debtShares || [40,25,5,15,10,5];
  pc.debtShares[i] = Math.max(0, Math.min(100, pc.debtShares[i] + 5*dir));
  applyDebts(); persist();
  // update ONLY the labels in place; no full rerender mid-interaction
  const total=pc.debtTotal||0, sum=pc.debtShares.reduce((a,b)=>a+b,0)||1;
  D.DEBTCATS.forEach((c,k)=>{
    const a=$("#dsAmt"+k), pEl=$("#dsPct"+k);
    if (a) a.textContent = fm(Math.round(total*pc.debtShares[k]/sum));
    if (pEl) pEl.textContent = Math.round(pc.debtShares[k]*100/sum)+"%";
  });
  // v1.6.7: the auto-loan car question appears the moment an auto share exists
  if (i===3 && ((pc.debtShares[3]>0) !== !!$("#pcAutoCar"))) rerenderSettings();
}
function setDial(k, v){
  betaDials()[k]=v; persist();
  const row=$("#bd-"+k); if(row) [...row.children].forEach((b,i)=>b.classList.toggle("on", i===v));
  const l=$("#bd-"+k+"-lbl"); if(l) l.textContent=v+"/10 "+dialLabel(v);
}
function debtSlide(i, val){ /* DEAD v1.4: slider replaced by debtStep; kept per helper-deletion law */
  const pc=S.perception; pc.debtShares = pc.debtShares || [40,25,5,15,10,5]; pc.debtShares[i]=val; applyDebts(); persist();
}
function applyDebts(){
  const pc=S.perception;
  if (pc.debtLocked) return; // v1.6: locked debts are never rebuilt from the profile again
  const total=pc.debtTotal||0;
  const shares=pc.debtShares || [40,25,5,15,10,5];
  const sum=shares.reduce((a,b)=>a+b,0)||1; // v1.6.7: dollars match the displayed split even when +/- taps push the sum off 100
  S.debts = S.debts.filter(d=>d.kind!=="legacy");
  const aprs=[5.5,0,0,7.9,11.5,0];
  S.credit.ledger = (S.credit.ledger||[]).filter(l=>l.kind!=="seed");
  D.DEBTCATS.forEach((c,i)=>{
    const bal=Math.round(total*shares[i]/sum);
    if (i===1){
      S.credit.cardBal = bal;
      if (bal>0) S.credit.ledger.unshift({t:"Balance carried in (your debt profile: credit card share)", amt:bal, kind:"seed"});
      return;
    }
    if (bal>=250){
      const apr=aprs[i]; const pay = apr>0? Math.max(25, Math.round(bal*(apr/100/12)/(1-Math.pow(1+apr/100/12,-48)))) : Math.max(25, Math.round(bal/60));
      const n = (i===3 && pc.autoLoanCar)? "Auto loan — "+pc.autoLoanCar : c;
      S.debts.push({n, bal, apr, pay, kind:"legacy"});
    }
  });
}
/* v1.6 (Ty #4): a real amortizing system. Months-to-payoff from balance, APR, monthly pay. */
function payoffMonths(d){
  const r=d.apr/100/12;
  if (r<=0) return Math.ceil(d.bal/Math.max(1,d.pay));
  if (d.pay <= d.bal*r) return Infinity; // payment doesn't beat the interest
  return Math.ceil(Math.log(d.pay/(d.pay-d.bal*r))/Math.log(1+r));
}
function payoffTxt(mo){
  if (!isFinite(mo)) return "never (payment loses to interest)";
  if (mo<=1) return "1 month";
  if (mo<24) return mo+" months";
  return (mo/12).toFixed(1).replace(/\.0$/,"")+" years";
}
function payDebtSheet(i){
  const d=S.debts[i]; if(!d) return;
  sheet(`<h3>Extra principal — ${esc(d.n)}</h3><p class="sp">Balance ${fm(Math.round(d.bal))} at ${d.apr}%. Every extra dollar goes straight at the principal.</p>
  <input class="field" type="number" id="dbAmt" placeholder="Amount">
  <button class="btn" style="background:#0b5cad;color:#fff" onclick="payDebtExtra(${i})">Pay it</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function payDebtExtra(i){
  const d=S.debts[i]; if(!d) return;
  let amt=Math.round(+($("#dbAmt")&&$("#dbAmt").value)||0);
  if (amt<=0) return toast("Pick a real amount.");
  amt=Math.min(amt, Math.ceil(d.bal));
  if (S.cash.checking<amt) return toast("Checking can't cover that.");
  S.cash.checking-=amt; d.bal=Math.max(0,d.bal-amt);
  S.ledger.push({t:"Extra principal — "+d.n, amt:-amt, kind:"spend"});
  creditTouch(2);
  if (d.bal<=1){ S.ledger.push({t:d.n+" — paid in full", amt:0, kind:"move"}); S.debts.splice(i,1); toast(d.n+" is GONE."); }
  else toast("Applied "+fm(amt)+" to principal.");
  persist(); closeSheet(); merBody(); renderWidget();
}
function payDebtOff(i){
  const d=S.debts[i]; if(!d) return;
  const amt=Math.ceil(d.bal);
  sheet(`<h3>Pay off ${esc(d.n)}?</h3><p class="sp">${fm(amt)} leaves checking right now and this debt is finished forever. Monthly burn drops by ${fm(d.pay)}.</p>
  <button class="btn" style="background:#0b5cad;color:#fff" onclick="payDebtOffGo(${i})">Pay ${fm(amt)} — kill it</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function payDebtOffGo(i){
  const d=S.debts[i]; if(!d) return;
  const amt=Math.ceil(d.bal);
  if (S.cash.checking<amt) return toast("Checking can't cover the payoff.");
  S.cash.checking-=amt;
  S.ledger.push({t:"Paid off — "+d.n, amt:-amt, kind:"spend"});
  S.ledger.push({t:d.n+" — paid in full", amt:0, kind:"move"});
  S.debts.splice(i,1); creditTouch(6);
  persist(); closeSheet(); merBody(); renderWidget(); toast(d.n+" is history.");
}
/* v1.6 (Ty #8): user-authored family ecosystem */
function famAdd(){ const pc=S.perception; pc.familyPeople=pc.familyPeople||[]; pc.familyPeople.push({rel:"Mother",name:"",fact:""}); persist(); rerenderSettings(); }
function famDel(i){ const pc=S.perception; (pc.familyPeople||[]).splice(i,1); persist(); rerenderSettings(); }
function famSet(i,k,v){ const pc=S.perception; if(pc.familyPeople&&pc.familyPeople[i]){ pc.familyPeople[i][k]=v.trim(); persist(); } }
function familyLine(){
  const fp=(S.perception.familyPeople||[]).filter(f=>f.name);
  if (!fp.length) return "";
  return "FAMILY (the ONLY named family that exists; NEVER invent other named relatives): "+fp.map(f=>f.rel+" "+f.name+(f.fact?" ("+f.fact+")":"")).join("; ")+".";
}
function savePerception(){
  const pc=S.perception;
  const gv=id=>{const el=$("#"+id);return el?el.value:null;};
  const st=gv("pcState");
  if (st==="Other (type a country)"){ pc.stateOther = pc.stateOther||""; const co=gv("pcStateOther"); if(co!==null) pc.stateOther=co; if(!$("#pcStateOther")) rerenderSettings(); }
  else if (st && !st.startsWith("\u2014")){ pc.state=st; delete pc.stateOther; }   /* v1.12.3: the placeholder is not a state */
  pc.grew=gv("pcGrew")??pc.grew; pc.hs=gv("pcHS")||pc.hs;
  pc.collegeName=gv("pcColName")??pc.collegeName;
  pc.college=gv("pcCol")||pc.college; pc.family=gv("pcFam")||pc.family;
  const ask=gv("pcAsk"); if(ask!==null) pc.familyAsk=Math.max(0,+ask||0);
  const dt=gv("pcDebtTotal"); if(dt!==null) pc.debtTotal=Math.max(0,+dt||0);
  const ac=gv("pcAutoCar"); if(ac!==null) pc.autoLoanCar=ac.trim();
  pc.rep = autoReputation();
  applyDebts();
  persist();
}
function applyTheme(){
  document.body.dataset.theme = META.settings.theme==="light" ? "light" : "dark";
}
/* pool + dock + order */
function appPool(){ return [{id:"messages",n:"Messages",ic:"ic-msg"},{id:"meridian",n:"Meridian",ic:"ic-mer"},{id:"sync",n:"Sync",ic:"ic-sync"},{id:"settings",n:"Settings",ic:"ic-set"}].concat(APPS); }
function dockIds(){
  let d = META.settings.dock;
  if (!Array.isArray(d) || d.length!==4) d = ["messages","meridian","sync","settings"];
  return d;
}
function setDock(slot, id){
  const d = dockIds().slice();
  const other = d.indexOf(id);
  if (other>=0 && other!==slot){ d[other]=d[slot]; } // swap if already docked
  d[slot]=id;
  META.settings.dock=d; saveMeta(); renderHome(); rerenderSettings();
}
function gridApps(){
  const pool=appPool(), dock=dockIds();
  let ord = META.settings.order;
  if (!Array.isArray(ord)) ord = pool.map(a=>a.id);
  for (const a of pool) if (!ord.includes(a.id)) ord.push(a.id); // new apps append
  ord = ord.filter(id=>pool.some(a=>a.id===id));
  META.settings.order = ord;
  return ord.filter(id=>!dock.includes(id)).map(id=>pool.find(a=>a.id===id));
}
function moveApp(id, to){
  const dock=dockIds();
  const gridIds = META.settings.order.filter(x=>!dock.includes(x));
  const from = gridIds.indexOf(id);
  if (from<0) return;
  gridIds.splice(from,1); gridIds.splice(to,0,id);
  // rebuild full order: docked ids keep their old positions appended at end (they don't render in grid anyway)
  META.settings.order = gridIds.concat(dock.filter(d=>!gridIds.includes(d)));
  saveMeta(); renderHome(); rerenderSettings();
}
function applySeedCash(){
  const pc=S.perception;
  if (pc.seedLocked) return toast("Starting balance is already locked in.");
  const target=startingCash(pc);
  pc.seedLocked=1; pc.seedAmt=target;
  S.ledger=S.ledger.filter(l=>l.kind!=="seed");
  S.cash.checking=target;
  S.ledger=S.ledger.filter(l=>l.kind!=="seed");
  S.ledger.push({t:"Starting balance (profile seed)", amt:target, kind:"seed"});
  persist(); toast("Starting balance locked at "+fm(target)+"."); rerenderSettings(); renderWidget();
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
  sheet(`<h3>Factory-reset this career?</h3><p class="sp">Everything phone-side for ${esc(S.blob.player.first)} ${esc(S.blob.player.last)} goes: messages, chirps, articles, threads, money moves, purchases, applied weeks, your profile answers. The phone comes back as a day-one phone — nothing from the old run survives. The baked save facts stay.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick="doResetCareer()">Reset it</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Keep everything</button>`);
}
async function doResetCareer(){
  // v1.6.7 (Ty): a reset is a FACTORY reset — even the canon career comes back on the generic
  // day-one seed, never the old fixture world, so a cleared phone visibly reads as cleared.
  const blob=S.blob; S=newCareerState(blob, {generic:true});
  await idb.set("career/"+S.careerId, S);
  closeSheet(); toast("Factory reset. Day-one phone."); renderHome(); renderLock(); renderApp("settings");
}

/* v1.11.0 PRIVACY EDITION: the whole-phone wipe. "Reset this career" clears one career but
   keeps settings; THIS deletes everything the phone has ever stored on the device — every
   career, the AI key, the mailbox token, wallpaper, profile photo, app order, all of it —
   plus the offline cache, then reloads to the day-one connect screen. Nothing survives. */
function erasePhoneSheet(){
  sheet(`<h3>Erase this phone?</h3><p class="sp">EVERYTHING goes: every career (${META.careers.length||0} on this phone), your AI key, your mailbox token, wallpaper, profile photo, app layout — all of it, permanently, from this device. The phone reloads as a brand-new empty phone. Your Madden save on the computer is untouched; a career can always be rebuilt from a fresh sync code.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick="doErasePhone()">Erase everything</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
async function doErasePhone(){
  closeSheet(); toast("Erasing…");
  try{ clearTimeout(saveTimer); }catch(e){}                       // kill any pending persist so nothing re-saves mid-wipe
  S=null; META=null;
  try{ if(idb.db) idb.db.close(); }catch(e){}
  try{ await new Promise(res=>{ const r=indexedDB.deleteDatabase("tynet"); r.onsuccess=r.onerror=r.onblocked=()=>res(); }); }catch(e){}
  try{ if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
  try{ if(navigator.serviceWorker){ const rs=await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r=>r.unregister())); } }catch(e){}
  location.reload();
}

/* ---- Sync: codec, apply, rewind ---- */
/* v1.8.3 (Ty's reorg): SYNC IS THE HOME OF EVERYTHING SYNC. Order = setup (purple mailbox,
   blue writing) \u2192 the GREEN sync \u2192 GREEN midweek (it's a sync too) \u2192 refresh \u2192 AMBER orders
   \u2192 the hand \u2192 manual copy-paste shrunk to one small row. The COLOR LAW: every concept wears
   ONE color on the phone AND on the computer \u2014 PURPLE mailbox, BLUE writing, GREEN sync,
   AMBER orders \u2014 and the wording names the colors so there is no wrong box. */
let syncSetupOpen=null, syncManualOpen=false, syncHandOpen=false;
function syncSetupDone(){ return mailOn() && (aiKey() || laneCOn() || META.settings.writeSkip); }
function syncMailCardHtml(){
  return `<div class="synccard box-mail"><h4>Step 1 \u2014 Mailbox <span class="cchip chip-mail">PURPLE</span></h4>
  <p style="font-size:11.5px;color:var(--faint);line-height:1.5;margin-bottom:8px">One-time. On a computer: github.com \u2192 Settings \u2192 Developer settings \u2192 Personal access tokens \u2192 <b>Tokens (classic)</b> \u2192 Generate \u2192 tick ONLY the <b>gist</b> box \u2192 copy. Paste that SAME token here and in the <span class="cw-mail">PURPLE box</span> at the top of TyPhone Sync on the computer. Never share it with anyone.</p>
  <label class="flabel">GitHub token</label>
  <input class="field" type="password" id="mailTokIn" placeholder="${META.settings.mailToken? "Connected \u2713 (\u2026"+esc(META.settings.mailToken.slice(-4))+") \u2014 paste a new one to replace" : "ghp_\u2026 (paste your token)"}" autocomplete="off">
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="mailSaveToken()">Save &amp; test</button>
    ${META.settings.mailToken? `<button class="btn sm" style="background:rgba(244,100,92,.15);color:#ff9d94" onclick="META.settings.mailToken='';saveMeta();renderApp('sync');toast('Mailbox disconnected.')">Disconnect</button>`:""}
  </div>
  <p style="font-size:11.5px;color:${META.settings.mailToken?'#7fd4a0':'var(--faint)'}" id="mailTokStat">${META.settings.mailToken? "Connected \u2713 \u2014 the green sync card below takes it from here." : "Not connected \u2014 the manual row at the bottom still works, always."}</p>
  </div>`;
}
function syncWriteCardHtml(){
  const prov = META.settings.provider||"anthropic";
  return `<div class="synccard box-ai"><h4>Step 2 \u2014 Writing <span class="cchip chip-ai">BLUE</span></h4>
  <p style="font-size:11.5px;color:var(--faint);line-height:1.5;margin-bottom:8px">The AI that writes the world. The same <span class="cw-ai">BLUE box</span> lives on the computer (Computer writing) \u2014 a key there writes the heavies on that machine instead. Quick calls (texts, replies, press answers) stay on the phone.</p>
  <label class="flabel">Provider</label>
  <select class="field" onchange="META.settings.provider=this.value;META.settings.model=D.AI[this.value].models[0];saveMeta();renderApp('sync')">${Object.keys(D.AI).map(k=>`<option value="${k}" ${prov===k?"selected":""}>${D.AI[k].label}</option>`).join("")}</select>
  <label class="flabel">Model</label>
  <select class="field" onchange="META.settings.model=this.value;saveMeta()">${D.AI[prov].models.map((m,i)=>`<option value="${m}" ${(D.AI[prov].models.includes(META.settings.model)?META.settings.model:D.AI[prov].models[0])===m?"selected":""}>${m}${i===0?" (best)":""}</option>`).join("")}</select>
  <label class="flabel">${D.AI[prov].label} API key</label>
  <input class="field" type="password" placeholder="${D.AI[prov].keyHint}" value="${esc((META.settings.keys&&META.settings.keys[prov])||"")}" onchange="META.settings.keys=META.settings.keys||{};META.settings.keys['${prov}']=this.value.trim();saveMeta();toast('Key saved.')">
  <label class="flabel" style="display:flex;justify-content:space-between;align-items:center">Auto-generate week content on sync
  <input type="checkbox" ${META.settings.autogen?"checked":""} onchange="META.settings.autogen=this.checked;saveMeta()"></label>
  ${mailOn()? `<label class="flabel" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">Heavy writing on the computer
  <input type="checkbox" ${META.settings.laneC?"checked":""} onchange="META.settings.laneC=this.checked;saveMeta();renderApp('sync')"></label>
  <p style="font-size:11.5px;color:var(--faint)">The two big weekly calls (the world and midweek) ride the mailbox to the computer, which writes them with its OWN AI key and sends them back \u2014 no more mobile timeouts. One-time: paste an AI key in the <span class="cw-ai">BLUE box</span> in TyPhone Sync on the computer. Quick calls stay on the phone.</p>`:""}
  ${(!aiKey()&&!laneCOn())? `<button class="btn sm" style="background:rgba(255,255,255,.12);margin-top:8px" onclick="META.settings.writeSkip=true;saveMeta();renderApp('sync')">No AI \u2014 the phone writes its plain placeholder weeks</button>`:""}
  </div>`;
}
/* v1.8.4 THE WALLED GARDEN: first run shows exactly ONE setup card and you cannot reach
   the next one without finishing this one; done setup folds to the verify row; Show setup
   reopens BOTH cards as the one spot to verify your keys are working. */
function syncSetupHtml(){
  const done=syncSetupDone();
  if (!done) return mailOn()? syncWriteCardHtml() : syncMailCardHtml();
  const open = syncSetupOpen===null? false : syncSetupOpen;
  if (!open) return `<div class="synccard" style="padding:10px 14px"><p style="margin:0;font-size:12.5px">Setup \u2713 \u2014 <span class="cw-mail">mailbox</span> connected \u00b7 <span class="cw-ai">writing</span> ready <button class="mer-link" style="float:right" onclick="syncSetupOpen=true;renderApp('sync')">Show setup</button></p></div>`;
  return `<div class="synccard" style="padding:10px 14px"><p style="margin:0;font-size:12.5px">Setup \u2713 <button class="mer-link" style="float:right" onclick="syncSetupOpen=false;renderApp('sync')">Hide setup</button></p></div>` + syncMailCardHtml() + syncWriteCardHtml();
}
function syncMidweekCard(){
  const wk = wkKey(S.blob.clock);
  const done = !!(S.midweek&&S.midweek[wk]);
  const n = nextGame();
  const ma = S.midAvail&&S.midAvail[wk];
  if (aiKey()) return `<div class="synccard box-sync"><h4>Media availability <span class="cchip chip-sync">GREEN</span></h4>
  <p style="margin-top:0">The week already wrote itself \u2014 this is just the reporters at your locker, once a week, about the road ahead${n? " (incl. "+esc(n[3])+")" : ""}. Optional; answer and the Podium episode writes itself with your words, wave them off and it writes without them. No syncs, no computer.</p>
  ${done? `<p style="font-size:13px;color:#7fd4a0;margin-bottom:0">\u2713 Handled for ${esc(wkLabel(S.blob.clock))}.</p>`
  : (S.midSkip&&S.midSkip[wk])? `<p style="font-size:13px;color:var(--faint);margin-bottom:0">No media this week \u2014 your call, final for ${esc(wkLabel(S.blob.clock))}.</p>`
  : `<button class="btn sm" style="background:var(--ok);color:#04170d" onclick="midweekTick()">Meet the media</button>
  <button class="btn sm" style="background:rgba(255,255,255,.08);margin-left:6px" onclick="midSkip()">Don\u2019t talk to the media during the week</button>`}
  ${ma? `<p style="font-size:12px;color:${ma.skipped?"var(--faint)":"#7fd4a0"};margin:8px 0 0">${ma.skipped? "Waved them off this week." : "\u2713 On the record for the week."}</p>`:""}
  </div>`;
  return `<div class="synccard box-sync"><h4>Midweek <span class="cchip chip-sync">GREEN</span></h4>
  <p style="margin-top:0">Midweek is a sync too, and it happens BEFORE you play the game: your media availability first (if the media wants you), then practice chatter, texts back, replies on your posts, and this week's Podium episode \u2014 half on last week around the league, half on the week ahead${n? " (incl. "+esc(n[3])+" if it earns it)" : ""}. Optional, once a week; skip it and the week moves on, no penalty.</p>
  ${done? `<p style="font-size:13px;color:#7fd4a0;margin-bottom:0">\u2713 Midweek played for ${esc(wkLabel(S.blob.clock))}. Next one unlocks after the game syncs.</p>`
  : (S.midSkip&&S.midSkip[wk])? `<p style="font-size:13px;color:var(--faint);margin-bottom:0">No media this week \u2014 your call, final for ${esc(wkLabel(S.blob.clock))}. The next sync re-offers midweek fresh.</p>`
  : `<button class="btn sm" ${calBusy?"disabled":""} style="background:${calBusy?"rgba(255,255,255,.12)":(aiKey()||laneCOn())?"var(--ok)":"rgba(255,255,255,.12)"};color:${calBusy?"inherit":(aiKey()||laneCOn())?"#04170d":"inherit"}" onclick="midweekTick()">${calBusy?BUSYL:(aiKey()||laneCOn())?"Play out midweek":"Add an API key first"}</button>
  ${(!calBusy && !(S.midSkip&&S.midSkip[wk]))? `<button class="btn sm" style="background:rgba(255,255,255,.08);margin-left:6px" onclick="midSkip()">Don\u2019t talk to the media during the week</button>`:""}`}
  <p style="font-size:11.5px;opacity:.6;margin:8px 0 0">${S.lastMidweek? esc(S.lastMidweek) : ""}</p>
  ${ma? `<p style="font-size:12px;color:${ma.skipped?"var(--faint)":"#7fd4a0"};margin:8px 0 0">${ma.skipped? "Skipped media availability this week." : "\u2713 Media availability done for the week."}</p>`:""}
  </div>`;
}
RENDER.sync = b=>{
  b.className="sync";
  /* v1.8.4 THE WALLED GARDEN (Ty's spec): one step on screen at a time, and you cannot
     reach the next spot without finishing this one. Setup gates first (PURPLE then BLUE,
     one card each). Once set up, the screen renders ONLY the card mailNextStep() points
     at — GREEN for the sync/midweek/computer-turn states, AMBER when orders go back.
     Refresh rides the idle step (you can't refresh mid-handshake). Manual copy-paste and
     the unseen hand live quietly underneath, forever. */
  const wizStep = (syncSetupOpen===true && syncSetupDone())? "verify" : !syncSetupDone()? "setup" : mailNextStep().k;
  let loopCard = "";
  if (wizStep==="setup" && !mailOn()) loopCard = aiKey()? syncOrdersCard() : ((midweekOwed()||!ordTotal())? syncMidweekCard() : syncOrdersCard());   // manual users (no mailbox, forever supported): the KEYLESS garden still walks midweek then orders; a keyed manual phone lives the powerhouse flow — one door, media in the press room (v1.13.1)
  else if (wizStep!=="setup" && wizStep!=="verify"){
    if (wizStep==="midweek") loopCard = syncMidweekCard();
    else if (wizStep==="send") loopCard = syncOrdersCard();
    else loopCard = mailCard();
  }
  b.innerHTML = aphead("Sync") + `<div class="apbody">
  ${syncSetupHtml()}
  ${(S.weekJobs && aiKey())? `<div class="synccard box-sync" style="padding:10px 14px"><p style="margin:0;font-size:12.5px">${weekRunLine()}</p>${(!weekRunBusy)? `<button class="btn sm" style="background:var(--ok);color:#04170d;margin-top:8px" onclick="runWeek()">Resume the week\u2019s writing</button>`:""}</div>` : ""}
  ${loopCard}

  ${aiKey()? "" : `<div class="synccard"><h4>The unseen hand</h4>
  <p>Optional. The coach runs the building on his own \u2014 this is YOU forcing the building's hand when you want the wheel. You are not the coach and never will be: the STAFF makes these calls, the news breaks like it came from the facility, and the player finds out the way everyone else does. Queue moves here; when their turn comes, the step card above carries them back to the save.</p>
  <button class="mer-link" onclick="syncHandOpen=!syncHandOpen;renderApp('sync')">${syncHandOpen?"Hide the queue":"Open the queue"}</button>
  ${syncHandOpen? `<div id="ordList" style="margin-top:8px">${ordListHtml()}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('depth')">Depth chart call</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('status')">Roster move</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('sign')">New contract</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('depthoff')">Off the rows</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('position')">Position change</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('number')">Number change</button>
    <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="ordSheet('resign')">Rewrite a real deal</button>
  </div>
  ${(S.orders&&S.orders.length)? `<button class="btn sm" style="background:rgba(244,100,92,.12);color:#ff9d94" onclick="S.orders=[];persist();renderApp('sync')">Clear your queue</button>`:""}`:""}
  </div>`}
  <div class="synccard" style="padding:10px 14px"><p style="margin:0;font-size:12.5px;color:var(--faint)">Applied weeks \u2014 ${esc(S.blob.player.first)} ${esc(S.blob.player.last)}: ${S.appliedWeeks.map(k=>esc(wkKeyLabel(k))).join(" \u00b7 ")}</p></div>
  <div class="synccard" style="padding:10px 14px">
  <p style="margin:0;font-size:12.5px">Manual copy-paste <span style="color:var(--faint)">\u00b7 always works</span> <button class="mer-link" style="float:right" onclick="syncManualOpen=!syncManualOpen;renderApp('sync')">${syncManualOpen?"Hide":"Show"}</button></p>
  ${syncManualOpen? `${!mailOn()? `<p style="font-size:11.5px;opacity:.6;margin:8px 0 0" id="lastRefreshLine">${lastRefreshLine()}</p>
  <p style="font-size:11.5px;opacity:.6;margin:4px 0 0">${lastSyncLine()}</p>`:""}<textarea class="field" id="syncIn" placeholder="TYNET1.\u2026" style="margin-top:10px"></textarea>
  <button class="btn sm" ${syncBusy?"disabled":""} style="background:${syncBusy?"rgba(255,255,255,.12)":"var(--ok)"};color:${syncBusy?"inherit":"#04170d"}" onclick="applyCode()">${syncBusy?BUSYL:"Apply pasted code"}</button>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
  ${ordTotal()? `<button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="copyOrders()">Copy THE order code \u2014 ${ordTotal()}</button>`:""}
  <button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="backupCode()">Copy backup code</button></div>`:""}
  </div></div>`;
  if (mailOn()) mailCheck();   // v1.8.0: opening Sync quietly checks the box (30s throttle inside)
};
/* v1.6 (Ty #12): the ORDERS COMPOSER. Generates TYORD1 codes for the exe's coach engine.
   IDENTITY LAW: the user is the PLAYER, the system is the coach — every line of copy frames
   outcomes as the staff's decision, never the user operating a coach console. Career-agnostic:
   players come from the synced roster, never from any baked name. */
const ORD_POS=["QB","HB","FB","WR","TE","LT","LG","C","RG","RT","LE","RE","DT","LOLB","MLB","ROLB","CB","FS","SS","K","P"];
function ordPlayers(){ return S.blob.roster.map(r=>({n:r[0]+" "+r[1], pos:r[2], ovr:r[3], j:r[4], st:r[5]})); }
function ordWords(o){
  if (o.type==="depth")  return "The staff reshuffles the "+o.pos+" room: "+o.player.name+" takes over "+o.pos+o.slot+".";
  if (o.type==="depthoff") return o.pos? "The staff takes "+o.player.name+" off the "+o.pos+" depth list." : "The staff pulls "+o.player.name+" off every depth list \u2014 he doesn't dress.";
  if (o.type==="position") return "The organization moves "+o.player.name+" to "+o.pos+" \u2014 an official position change.";
  if (o.type==="number") return "Equipment room: "+o.player.name+" switches to #"+o.num+".";
  if (o.type==="resign") return "The club rewrites "+o.player.name+"'s deal: "+o.years+" years, $"+o.totalM+"M"+(o.bonusM?" with $"+o.bonusM+"M to sign":"")+".";
  if (o.type==="status") return o.to==="Active"? "The front office signs "+o.player.name+" to the 53." : "The club moves "+o.player.name+" to the practice squad.";
  if (o.type==="sign")   return "The club signs "+o.player.name+": "+o.years+" years, $"+o.totalM+"M"+(o.bonusM?" with $"+o.bonusM+"M to sign":"")+".";
  return "";
}
function ordListHtml(){
  const os=S.orders||[];
  if (!os.length) return '<div style="font-size:12.5px;color:var(--faint)">Nothing queued. The building is quiet.</div>';
  return os.map((o,i)=>`<div class="ordrow"><span>${esc(ordWords(o))}</span><button onclick="S.orders.splice(${i},1);persist();renderApp('sync')">×</button></div>`).join("");
}
function ordSheet(type){
  S.orders=S.orders||[];
  if (ordTotal()>=10) return toast("Ten orders per code is the ceiling (the coach's rulings count). Copy or clear first.");
  const ps=ordPlayers();
  const psel=`<label class="flabel">Player</label><select class="field" id="ordP">${ps.map(p=>`<option value="${esc(p.n).replace(/"/g,"&quot;")}">${esc(p.n)} · ${esc(p.pos)} ${p.ovr} · #${p.j}${p.st==="PracticeSquad"?" · PS":""}</option>`).join("")}</select>`;
  if (type==="depth") sheet(`<h3>Depth chart call</h3><p class="sp">The staff decides who runs where. The order names the player, the list, and the slot.</p>${psel}
    <label class="flabel">Position list</label><select class="field" id="ordPos">${ORD_POS.map(x=>`<option>${x}</option>`).join("")}</select>
    <label class="flabel">Slot</label><select class="field" id="ordSlot">${[1,2,3,4,5].map(x=>`<option>${x}</option>`).join("")}</select>
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('depth')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="status") sheet(`<h3>Roster move</h3><p class="sp">Practice squad or the 53. The exe validates it against the live save before anything is written.</p>${psel}
    <label class="flabel">Destination</label><select class="field" id="ordTo"><option value="Active">Active roster (the 53)</option><option value="PracticeSquad">Practice squad</option></select>
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('status')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="sign") sheet(`<h3>New contract</h3><p class="sp">For created players the game itself refuses to pay (no contract row). Money in millions; the exe routes anyone who already has a real deal to a resign order instead.</p>${psel}
    <label class="flabel">Years</label><select class="field" id="ordY">${[1,2,3,4,5,6,7].map(x=>`<option>${x}</option>`).join("")}</select>
    <label class="flabel">Total ($M)</label><input class="field" id="ordT" type="number" step="0.5" min="0.5" placeholder="12">
    <label class="flabel">Signing bonus ($M)</label><input class="field" id="ordB" type="number" step="0.5" min="0" placeholder="0">
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('sign')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  /* ---- v1.12.0 THE WRITEBACK EXPANSION composer sheets ---- */
  if (type==="depthoff") sheet(`<h3>Off the rows</h3><p class="sp">Benching, the honest way: the staff clears a player off the depth rows. One list, or every list (he doesn't dress).</p>${psel}
    <label class="flabel">Which list?</label><select class="field" id="ordPos"><option value="">Every list \u2014 he doesn't dress</option>${ORD_POS.map(x=>`<option>${x}</option>`).join("")}</select>
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('depthoff')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="position") sheet(`<h3>Position change</h3><p class="sp">An organizational call: the player's official position changes. Depth listings don't move with it \u2014 the lists hold whoever the staff put on them (two-way law).</p>${psel}
    <label class="flabel">New position</label><select class="field" id="ordPos">${ORD_POS.map(x=>`<option>${x}</option>`).join("")}</select>
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('position')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="number") sheet(`<h3>Number change</h3><p class="sp">Jersey paperwork. A taken number is refused by the exe unless its wearer's move rides the SAME code first \u2014 queue his switch, then this one.</p>${psel}
    <label class="flabel">New number (0-99)</label><input class="field" id="ordN" type="number" min="0" max="99" placeholder="0">
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('number')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
  if (type==="resign") sheet(`<h3>Rewrite a real deal</h3><p class="sp">For players with a REAL contract row: the exe rewrites the paper in place \u2014 new years, new money, honest cap delta against the hit it replaces. Money in millions.</p>${psel}
    <label class="flabel">Years</label><select class="field" id="ordY">${[1,2,3,4,5,6,7].map(x=>`<option>${x}</option>`).join("")}</select>
    <label class="flabel">Total ($M)</label><input class="field" id="ordT" type="number" step="0.5" min="0.5" placeholder="12">
    <label class="flabel">Signing bonus ($M)</label><input class="field" id="ordB" type="number" step="0.5" min="0" placeholder="0">
    <button class="btn" style="background:var(--ok);color:#04170d" onclick="ordAdd('resign')">Queue it</button>
    <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Cancel</button>`);
}
function ordAdd(type){
  const name=$("#ordP")&&$("#ordP").value; if(!name) return;
  let o=null;
  if (type==="depth") o={type:"depth", player:{name}, pos:$("#ordPos").value, slot:+$("#ordSlot").value};
  if (type==="status") o={type:"status", player:{name}, to:$("#ordTo").value};
  if (type==="depthoff"){ const p=$("#ordPos").value; o={type:"depthoff", player:{name}}; if(p) o.pos=p; }
  if (type==="position") o={type:"position", player:{name}, pos:$("#ordPos").value};
  if (type==="number"){ const n=+$("#ordN").value;
    if (!Number.isInteger(n)||n<0||n>99) return toast("Numbers run 0-99.");
    o={type:"number", player:{name}, num:n}; }
  if (type==="sign"||type==="resign"){ const t=+$("#ordT").value, b=+($("#ordB").value||0);
    if (!t||t<=0) return toast("Total money first.");
    if (b<0||b>t) return toast("Bonus can't beat the total.");
    o={type, player:{name}, years:+$("#ordY").value, totalM:t, bonusM:b}; }
  if (!o) return;
  S.orders=S.orders||[]; S.orders.push(o); persist(); closeSheet(); if(curApp==="sync") renderApp('sync');
  toast("Queued. The building will act on it.");
  if (window.__rvBack){ window.__rvBack=0; reviewSheet(); }   /* v1.13.1: composed from the review page — land back on it */
}
/* v1.6.9 (Ty: "i dont need 2 ords just 1 merged one"): ONE code. The coach's rulings ride
   first (he outranks you), your queued moves follow, one TYORD1, one paste. */
function ordersCode(){ return "TYORD1"+JSON.stringify({orders:[...staffState().orders.map(o=>o.order), ...(S.orders||[])]}); }
function ordTotal(){ return staffState().orders.length + (S.orders||[]).length; }
function copyOrders(){
  if (!ordTotal()) return;
  const code=ordersCode();
  const done=()=>toast("Order code copied. Paste it into the exe's Coach orders box.");
  if (navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(()=>ordFallbackCopy(code,done));
  else ordFallbackCopy(code,done);
}
function ordFallbackCopy(code,done){
  const ta=document.createElement("textarea"); ta.value=code; document.body.appendChild(ta);
  ta.select(); try{document.execCommand("copy");}catch(e){} document.body.removeChild(ta); done();
}
/* ---- in-app QR scanner: getUserMedia + jsQR. A camera-app scan of a URL opens Safari,
   which is a SEPARATE empty copy of the app on iOS — codes must be read INSIDE the
   installed phone. QRs now carry the raw code; this also accepts legacy URL-wrapped ones. ---- */
let scanStream=null, scanRAF=0, scanLast="", scanLastAt=0;
function parseScanned(t){
  t=String(t||"").trim();
  const m=t.match(/#sync=(.+)$/); if(m){ try{ t=decodeURIComponent(m[1]); }catch(e){ t=m[1]; } }
  return t;
}
/* DEAD as of v1.4 (Ty: QRs need 4 pics for a full career code, so the scanner is retired;
   copy-paste is THE sync path). Kept per the helper-deletion law; parseScanned still guards
   legacy pasted URL codes. */
async function ensureJsQR(){
  if (window.jsQR) return;
  const load=src=>new Promise((res,rej)=>{ const s=document.createElement("script");
    s.src=src; s.onload=res; s.onerror=()=>rej(new Error("load failed")); document.head.appendChild(s); });
  try{ await load("jsqr.min.js"); if (window.jsQR) return; }catch(e){}
  try{ await load("https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js"); }
  catch(e){ throw new Error("Scanner library didn't load. Make sure jsqr.min.js is uploaded to phone/ in the repo."); }
}
async function scanSheet(){
  try{ await ensureJsQR(); }catch(e){ return toast(e.message); }
  sheet(`<h3>Scan the screen</h3><p class="sp" id="scanStat">Point the camera at a QR square on the computer.</p>
  <video id="scv" playsinline muted style="width:100%;border-radius:14px;background:#000;aspect-ratio:3/4;object-fit:cover"></video>
  <button class="btn" style="background:rgba(255,255,255,.1);margin-top:10px" onclick="stopScan(true)">Cancel</button>`);
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" }, audio:false });
  }catch(e){ closeSheet(); return toast("Camera said no. Allow camera access for TyPhone in iOS Settings, or paste the code instead."); }
  const v=$("#scv"); v.srcObject=scanStream; await v.play();
  const cv=document.createElement("canvas"); const cx=cv.getContext("2d",{willReadFrequently:true});
  const loop=()=>{
    if (!scanStream) return;
    if (v.readyState>=2){
      cv.width=v.videoWidth; cv.height=v.videoHeight;
      cx.drawImage(v,0,0);
      try{
        const d=cx.getImageData(0,0,cv.width,cv.height);
        const q=window.jsQR(d.data, d.width, d.height, {inversionAttempts:"dontInvert"});
        if (q && q.data){ scanGot(q.data); }
      }catch(e){}
    }
    scanRAF=requestAnimationFrame(loop);
  };
  scanRAF=requestAnimationFrame(loop);
}
function stopScan(close){
  if (scanRAF) cancelAnimationFrame(scanRAF); scanRAF=0;
  if (scanStream){ for(const t of scanStream.getTracks()) t.stop(); scanStream=null; }
  if (close) closeSheet();
}
async function scanGot(raw){
  const t=parseScanned(raw);
  if (!/^TYNET/.test(t)) return;
  const now=Date.now();
  if (t===scanLast && now-scanLastAt<2500) return; // same square still in frame
  scanLast=t; scanLastAt=now;
  // will this scan complete the set? stop the camera BEFORE applyCode may open its own sheet
  let willComplete = /^TYNET1\.|^TYNETB\./.test(t);
  const pm=t.match(/^TYNETP\.(\d+)\.(\d+)\./);
  if (pm){
    const i=+pm[1], n=+pm[2];
    const got=META.syncParts && META.syncParts.n===n ? Object.keys(META.syncParts.got).length + (META.syncParts.got[i]?0:1) : 1;
    willComplete = got>=n;
  }
  if (willComplete){ stopScan(false); await applyCode(t); }
  else {
    await applyCode(t);
    const st=$("#scanStat");
    if (st && META.syncParts) st.textContent = Object.keys(META.syncParts.got).length+" of "+META.syncParts.n+" scanned — point at the next square.";
  }
}
let refreshBusy=false;
/* ==== v1.8.0 THE ONLINE MAILBOX (phone side of the GitHub Gist bridge) ====
   One PRIVATE gist per career is the mailbox (the exe creates it, named
   "TyPhone mailbox — <careerId>"). The exe drops TYNET1 sync codes in; the phone drops TYORD1
   order codes in; state.json is the handshake both sides read. THE FOOLPROOF RULE (Ty's spec):
   every render tells the user exactly ONE next action — the state machine in mailNextStep()
   owns that sentence, nothing else improvises steps. Copy-paste stays alive forever below it. */
const MAIL_API="https://api.github.com";
const mailDesc = () => "TyPhone mailbox \u2014 "+S.careerId;
const mailOn = () => !!(META.settings&&META.settings.mailToken);
function mailHdrs(){ return {"Authorization":"Bearer "+META.settings.mailToken,"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"}; }
async function mailJf(url,opt){ const r=await fetch(url,opt); if(!r.ok){ const t=await r.text().catch(()=>""); throw new Error("GitHub "+r.status+": "+String(t).slice(0,120)); } return r.json(); }
async function mailGist(){
  if (S.mailGist){ try{ const g=await mailJf(MAIL_API+"/gists/"+S.mailGist,{headers:mailHdrs()}); if(g.description===mailDesc()) return g; }catch(e){} }
  const list=await mailJf(MAIL_API+"/gists?per_page=100",{headers:mailHdrs()});
  const hit=(list||[]).find(g=>g.description===mailDesc());
  if(!hit) return null;
  S.mailGist=hit.id; persist();
  return mailJf(MAIL_API+"/gists/"+hit.id,{headers:mailHdrs()});
}
function mailState(g){ const f=g&&g.files&&g.files["state.json"]; if(!f||!f.content) return {}; try{ return JSON.parse(f.content); }catch(e){ return {}; } }
async function mailFile(g,name){ const f=g&&g.files&&g.files[name]; if(!f) return null; if(!f.truncated) return f.content;
  const r=await fetch(f.raw_url,{headers:{"Authorization":"Bearer "+META.settings.mailToken}}); if(!r.ok) throw new Error("raw fetch "+r.status); return r.text(); }
async function mailSaveToken(){
  const inp=$("#mailTokIn"); const t=(inp&&inp.value||"").trim();
  if(!t) return toast("Paste the token first (it starts with ghp_).");
  const st=$("#mailTokStat"); if(st) st.textContent="Testing the token against GitHub\u2026";
  try{ await mailJf(MAIL_API+"/gists?per_page=1",{headers:{"Authorization":"Bearer "+t,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}); }
  catch(e){ if(st){ st.textContent="Token didn't work: "+e.message; st.style.color="#ff9d94"; } return; }
  META.settings.mailToken=t; saveMeta(); toast("Mailbox connected."); renderApp("sync");
}
/* what the phone knows about the box, refreshed by mailCheck(); null until first check */
let mailInfo=null, mailBusy=false, mailErr=null, mailLastCheck=0;
async function mailCheck(force){
  if (!mailOn() || mailBusy) return;
  if (!force && Date.now()-mailLastCheck<30000) return;      // opening Sync repeatedly shouldn't hammer GitHub
  mailBusy=true; mailErr=null; if(curApp==="sync") renderApp("sync");
  try{
    const g=await mailGist();
    if(!g){ mailInfo={noBox:true}; }
    else {
      const st=mailState(g);
      mailInfo={gistId:g.id, state:st};
      /* v1.8.5 (Ty's lock ruling): a sync he already handled — applied OR declined — is never
         offered again on reopen; only a strictly NEWER send offers. And while a decision sheet
         is up (mailPendingApply), a background check can't re-arm the offer under it. */
      if (st.syncTs && !st.syncApplied && st.syncTs>(S.mailApplied||0) && !mailPendingApply){
        const code=await mailFile(g,"sync.txt");
        /* v1.12.2 (Ty's screenshot round): a byte-identical re-send (a double-tapped GREEN
           button, a nervous re-click after the old stuck step 3) carries NOTHING new — the
           phone marks the box handled quietly and never opens its mouth. A code that actually
           differs still offers (same-week offers wear their honest wording in mailNextStep). */
        if (S.mailAppliedHash && codeHash(code)===S.mailAppliedHash){
          S.mailApplied=st.syncTs; persist();
          try{ const st2={...st, syncApplied:true, syncAppliedTs:Date.now()};
            await mailJf(MAIL_API+"/gists/"+g.id,{method:"PATCH",headers:mailHdrs(),body:JSON.stringify({files:{"state.json":{content:JSON.stringify(st2,null,1)}}})});
            mailInfo.state=st2;
          }catch(e){ console.log("identical-resend mark failed (retries next check):", String(e.message||e)); }
        }
        else mailInfo.syncCode=code;
      }
      await mailConsumeJobs(g, st);                          // v1.8.1: lane C writing comes home here
    }
    mailLastCheck=Date.now();
  }catch(e){ mailErr=String(e.message||e).slice(0,120); }
  mailBusy=false; if(curApp==="sync") renderApp("sync");
}
let mailPendingApply=null; // {gistId, ts} — set while a mailbox code is being applied; consumed by mailMarkSyncApplied
async function mailApplySync(){
  if(!mailInfo || !mailInfo.syncCode) return;
  mailPendingApply={gistId:mailInfo.gistId, ts:mailInfo.state.syncTs, h:codeHash(mailInfo.syncCode)};   /* v1.12.2: the applied code's fingerprint rides the handshake */
  const code=mailInfo.syncCode;
  mailInfo.syncCode=null; if(curApp==="sync") renderApp("sync");
  await applyCode(code);   // every existing guard runs: careerId, same-week, rewind, adopt sheets
}
function mailDeclineSync(){
  /* v1.8.5 (Ty's ruling: "if i do the sync or not its one choice and then that screen locks
     until i confirm"): declining an offered mailbox sync IS the decision. The offer is marked
     handled — locally and in the box — and never re-appears on reopen or after Wave-off/midweek
     renders. A genuinely NEW send (newer syncTs) still offers fresh. No-op for manual pastes. */
  mailMarkSyncApplied();
}
async function mailMarkSyncApplied(){
  /* called by advanceTo and doRefreshTruth when the applied code came from the mailbox */
  const p=mailPendingApply; mailPendingApply=null; if(!p) return;
  S.mailApplied=p.ts; if(p.h) S.mailAppliedHash=p.h; persist();                              // local truth first — a failed PATCH never re-offers
  try{ const g=await mailJf(MAIL_API+"/gists/"+p.gistId,{headers:mailHdrs()});
    const st={...mailState(g), syncApplied:true, syncAppliedTs:Date.now()};
    await mailJf(MAIL_API+"/gists/"+p.gistId,{method:"PATCH",headers:mailHdrs(),body:JSON.stringify({files:{"state.json":{content:JSON.stringify(st,null,1)}}})});
    if(mailInfo) mailInfo.state=st;
  }catch(e){ console.log("mail mark-applied failed (harmless \u2014 local flag holds)", e); }
}
/* v1.12.2: one tiny fingerprint for "is this the same code" questions — the queue-changed
   re-send offer and the identical-resend swallow both key on it. Not crypto; just a tell. */
function codeHash(s){ s=String(s||""); let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return s.length+":"+h.toString(36); }
async function mailSendOrders(){
  if (!mailOn() || mailBusy || !ordTotal()) return;
  const code=ordersCode();
  mailBusy=true; if(curApp==="sync") renderApp("sync");
  try{
    const g=await mailGist();
    if(!g){ mailErr="No mailbox yet \u2014 on the computer, hit Send sync ONLINE once first (that creates the box)."; }
    else {
      const st={...mailState(g), careerId:S.careerId, ordersTs:Date.now(), ordersApplied:false};
      await mailJf(MAIL_API+"/gists/"+g.id,{method:"PATCH",headers:mailHdrs(),body:JSON.stringify({files:{"orders.txt":{content:code},"state.json":{content:JSON.stringify(st,null,1)}}})});
      S.mailOrdersSent=st.ordersTs; S.mailOrdersSentHash=codeHash(code); persist();   /* v1.12.2: snapshot WHAT was sent — a queue that grows afterwards re-offers the send step honestly */
      if(mailInfo){ mailInfo.state=st; mailInfo.gistId=g.id; }
      toast("Orders sent to the computer's mailbox.");
    }
  }catch(e){ mailErr=String(e.message||e).slice(0,120); }
  mailBusy=false; if(curApp==="sync") renderApp("sync");
}
/* ==== v1.8.1 LANE C — THE HEAVY WRITING RIDES THE MAILBOX (Ty's yes) ====
   The phone COMPOSES the two heavyweight calls (weekly world + game story, midweek) as full
   {sys,user,max} jobs into jobs.txt; the exe runs them with its OWN key and desktop
   reliability (no mobile-Safari stream kills, no background-tab death) and drops results.txt
   back; the phone runs its UNCHANGED intake — parse armor, dedupe, husks, and every law fire
   exactly as if the phone had made the call itself. ZERO world logic lives in the exe. Quick
   interactive calls (texts, replies, pressers) stay on-phone. */
function laneCOn(){ return mailOn() && !!META.settings.laneC; }
async function mailSendJobs(jobs, meta){
  const g=await mailGist();
  if(!g) throw new Error("No mailbox yet \u2014 on the computer, hit Send sync ONLINE once first (that creates the box).");
  if (S.mailJobs && S.mailJobs.wk!==meta.wk)
    jobFail(S.mailJobs, "the save moved past that week before the writing came back", true);   /* v1.8.2: the stale batch's stamp turns honest before the overwrite — quiet, no toast */
  const ts=Date.now();
  const pack={careerId:S.careerId, ts, wk:meta.wk, kind:meta.kind, jobs};
  const st={...mailState(g), careerId:S.careerId, jobsTs:ts, jobsKind:meta.kind, jobsDone:0};
  await mailJf(MAIL_API+"/gists/"+g.id,{method:"PATCH",headers:mailHdrs(),body:JSON.stringify({files:{"jobs.txt":{content:JSON.stringify(pack)},"state.json":{content:JSON.stringify(st,null,1)}}})});
  S.mailJobs={ts, wk:meta.wk, kind:meta.kind, opts:meta.opts||{}, gk:meta.gk||null, byline:meta.byline||null, sentAt:ts};
  persist();
  if(mailInfo){ mailInfo.state=st; mailInfo.gistId=g.id; }
  return ts;
}
async function queueWorldJobs(blob, last, opts){
  opts=opts||{};
  const wk=wkKey(blob.clock), wkLbl=wkLabel(blob.clock);
  if (S.mailJobs && S.mailJobs.kind==="weekly" && S.mailJobs.wk===wk){ toast("The week's writing is already on the computer's desk."); return; }
  if (S.mailJobs && S.mailJobs.wk===wk){
    /* v1.8.2: a same-week batch of ANOTHER kind is on the desk — sending would overwrite it
       (one jobs.txt, one jobsTs) and its writing would silently never come home. With a phone
       key the world just writes locally; keyless, the desk names the one next step. */
    if (aiKey()) return generateWeek(blob, last, {...opts, local:true});
    toast("The "+(S.mailJobs.kind==="midweek"?"midweek":"game story")+" writing is on the computer's desk. Run the phone jobs there and tap Check, then come back.");
    return;
  }
  const byline=chronWriter("game"+wk);
  const facts=worldFacts(blob,last);
  const jobs=[];
  if (!opts.noArticle) jobs.push({id:"art", max:8000, sys:storySys(byline), user:facts+"\n\nWrite the game story now."});
  jobs.push({id:"wld", max:16000, sys:worldSys(), user:facts+"\n\nWrite this week's world."});
  try{
    await mailSendJobs(jobs, {kind:"weekly", wk, opts:{noArticle:!!opts.noArticle}, gk:last? gkey(last):null, byline});
    S.lastRefresh={when:Date.now(), wk:wkLbl, ok:true, kind:"sent"};
    persist(); toast("Sent to the computer. Run the phone jobs there, then tap Check."); if(curApp==="sync") renderApp("sync");
  }catch(e){
    /* FOOLPROOF: a reliability feature must never make things LESS reliable — if the box is
       unreachable and the phone still has its own key, the writing just runs on the phone. */
    if (aiKey()){ toast("Mailbox unreachable. Writing on the phone instead."); return generateWeek(blob, last, {...opts, local:true}); }
    throw new Error("mailbox send failed: "+String(e.message||e).slice(0,120));
  }
}
async function queueMidweekJob(sys, user, wk){
  /* returns true when handled (queued OR failure recorded); false = fall through to the local call */
  if (S.mailJobs && S.mailJobs.kind==="midweek" && S.mailJobs.wk===wk){ toast("Midweek is already on the computer's desk."); return true; }
  if (S.mailJobs && S.mailJobs.wk===wk){
    /* v1.8.2: never overwrite a same-week batch of another kind. A phone key writes midweek
       locally instead; keyless, the desk names the one next step. */
    if (aiKey()) return false;
    toast("The "+(S.mailJobs.kind==="story"?"game story's":"week's")+" writing is on the computer's desk. Run the phone jobs there and tap Check, then play midweek.");
    return true;
  }
  const dstamp=()=>{ const d=new Date(); return d.toLocaleDateString([],{month:"short",day:"numeric"})+" "+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); };
  try{
    await mailSendJobs([{id:"mid", max:6000, sys, user}], {kind:"midweek", wk});
    S.lastMidweek="SENT to the computer "+dstamp()+" \u2014 run the phone jobs there, then Check the mailbox";
    persist(); toast("Sent to the computer. Run the phone jobs there, then tap Check.");
    return true;
  }catch(e){
    if (aiKey()){ toast("Mailbox unreachable. Writing on the phone instead."); return false; }
    S.lastMidweek="FAILED "+dstamp()+" \u2014 "+String(e.message||e).slice(0,90)+" \u2014 tap Play midweek to retry";
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"Midweek didn't reach the computer \u2014 tap Play midweek in Sync to retry"});
    persist(); toast("Mailbox send failed: "+e.message);
    return true;
  }
}
function jobFail(mj, why, quiet){
  const d=new Date(), stamp=d.toLocaleDateString([],{month:"short",day:"numeric"})+" "+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  if (mj.kind==="midweek"){
    S.lastMidweek="FAILED "+stamp+" \u2014 "+String(why).slice(0,90)+" \u2014 tap Play midweek to retry";
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"Midweek didn't generate \u2014 tap Play midweek in Sync to retry"});
  } else if (mj.kind==="story"){
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"chron", t:"Chronicle", p:"The game story didn't write \u2014 open Chronicle to retry"});
  } else {
    S.lastRefresh={when:Date.now(), wk:wkLabel(S.blob.clock), ok:false, err:String(why).slice(0,180)};
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"The week's world didn't generate \u2014 open Sync and hit Refresh world now"});
  }
  persist(); if(!quiet) toast("Computer writing failed: "+String(why).slice(0,80));
}
function chronFailNote(){ S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"chron", t:"Chronicle", p:"The game story didn't write \u2014 open Chronicle to retry"}); persist(); }
async function mailConsumeJobs(g, st){
  /* v1.8.1: lane C results come home on every mailbox check. Consumed EXACTLY once —
     S.mailJobs clears before intake so a bad batch can never loop; failures land as the
     same honest stamps + retry paths the on-phone calls already use. */
  const mj=S.mailJobs; if(!mj) return;
  if (!(st && st.jobsDone && st.jobsDone===mj.ts)) return;    // computer not done, or a different batch
  let pack=null;
  try{ pack=JSON.parse(await mailFile(g,"results.txt")||"null"); }catch(e){}
  S.mailJobs=null; persist();
  if (!pack || pack.jobsTs!==mj.ts || pack.careerId!==S.careerId) return jobFail(mj, "the computer's results didn't match this phone's job batch");
  const res={}; for(const r of (pack.results||[])) res[r.id]=r;
  if (wkKey(S.blob.clock)!==mj.wk) return jobFail(mj, "the save moved past that week before the writing came back");
  if (mj.kind==="midweek"){
    /* v1.12.4: with midweek phone-first, a job queued under the OLD law (or keyless-then-keyed)
       can come home AFTER a local midweek already wrote the week. One midweek per week, ever —
       the late copy is consumed and honestly discarded, never merged twice. */
    if (S.midweek && S.midweek[mj.wk]){ console.log("computer midweek for "+mj.wk+" arrived after the phone already wrote it — discarded (one midweek per week)"); persist(); if(curApp==="sync") renderApp("sync"); return; }
    const r=res.mid;
    if (!r || !r.ok) return jobFail(mj, (r&&r.err)||"the computer reported no result");
    try{ intakeMidweek(parseModelJSON(r.text), mj.wk); toast("The computer wrote midweek. It's in."); }
    catch(e){ jobFail(mj, "unparseable JSON from the computer ("+String(e.message||e).slice(0,40)+")"); }
    return;
  }
  if (mj.kind==="story"){
    const r=res.art;
    if (!r || !r.ok) return jobFail(mj, (r&&r.err)||"the computer reported no result");
    try{ intakeGameStory(parseModelJSON(r.text), mj.byline||chronWriter("game"+mj.wk), wkLabel(S.blob.clock), mj.gk); toast("The computer wrote the story. It ran."); if(curApp==="chron") renderApp("chron"); }
    catch(e){ jobFail(mj, "unparseable JSON from the computer ("+String(e.message||e).slice(0,40)+")"); }
    return;
  }
  const ra=res.art;
  if (ra){
    if (ra.ok){ try{ intakeGameStory(parseModelJSON(ra.text), mj.byline||chronWriter("game"+mj.wk), wkLabel(S.blob.clock), mj.gk); }catch(e){ chronFailNote(); } }
    else chronFailNote();
  }
  const rw=res.wld;
  if (!rw || !rw.ok) return jobFail(mj, (rw&&rw.err)||"the computer reported no world result");
  try{ intakeWorld(parseModelJSON(rw.text), wkLabel(S.blob.clock), mj.gk, mj.opts||{}); toast("The computer wrote the week. It's in."); }
  catch(e){ jobFail(mj, "unparseable JSON from the computer ("+String(e.message||e).slice(0,40)+")"); }
}
function mailTime(ts){ const d=new Date(ts); return d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}); }
/* THE state machine: exactly ONE next action per render, in priority order.
   v1.8.4 (Ty's walled garden): the whole Sync screen now renders ONLY the card this
   machine points at — one step at a time, phone and computer, never out of order.
   Midweek is a numbered step INSIDE the loop (owed after the sync lands, before orders
   go back), so a week physically cannot skip past it unnoticed or replay it late. */
function midweekOwed(){
  const wk = wkKey(S.blob.clock);
  return !(S.midweek&&S.midweek[wk]) && !(S.midSkip&&S.midSkip[wk]);
}
function midSkip(){
  const wk = wkKey(S.blob.clock);
  S.midSkip = S.midSkip||{}; S.midSkip[wk]=1; persist();
  toast("No media this week. The week moves on, no penalty.");
  if (curApp==="sync") renderApp("sync");
}
function mailNextStep(){
  if (mailBusy) return {k:"busy", t:"Working\u2026"};
  if (mailErr) return {k:"err", t:"Mailbox hiccup: "+mailErr+" \u2014 tap Check to retry; copy-paste below always works."};
  const st=(mailInfo&&mailInfo.state)||{};
  if (mailInfo && mailInfo.syncCode){
    /* v1.12.2 (Ty's screenshot round): a re-sent SAME week must never be sold as a new one —
       the exe minting a fresh syncTs for the week he's standing in reads "sync new week just
       to recognize the week is already up". Name it what it is. st.syncWk is written by the
       exe's clockLabel; the mirror below must match it CHARACTER-FOR-CHARACTER (harness-pinned
       both sides — change them together or not at all). */
    const exeLbl = c => c ? (c.seasonYear+" "+(c.weekType==="RegularSeason"?"Season":c.weekType)+" \u00b7 Week "+c.week) : "";
    const sameWk = st.syncWk && st.syncWk===exeLbl(S.blob.clock);
    if (sameWk) return {k:"apply", t:"The computer re-sent "+wkLabel(S.blob.clock)+" \u2014 a SAME-WEEK truth refresh ("+mailTime(st.syncTs)+"), not a new week. Apply it only if you changed things in Madden without advancing; otherwise decline and the week stands.", btn:"Apply the same-week refresh", fn:"mailApplySync()"};
    return {k:"apply", t:"A new sync from the save is waiting \u2014 "+(st.syncWk? st.syncWk+" \u00b7 ":"")+"sent "+mailTime(st.syncTs)+".", btn:"Apply the new sync", fn:"mailApplySync()"};
  }
  /* v1.12.2 (Ty's screenshot round): WAIT holds ONLY while the computer's desk carries exactly
     what the queue holds — a queue that grew after the send (new grants, new asks) used to sit
     silent under "Orders sent \u2713" forever. Changed queue = the send step, honestly worded. */
  const sent = ordTotal()>0 && S.mailOrdersSent && st.ordersTs===S.mailOrdersSent && !st.ordersApplied
    && (!S.mailOrdersSentHash || S.mailOrdersSentHash===codeHash(ordersCode()));
  if (sent) return {k:"wait", t:"Orders sent "+mailTime(S.mailOrdersSent)+" \u2713. Now on the COMPUTER: 1) open TyPhone Sync \u00b7 2) Pull orders from the phone (the AMBER box) \u00b7 "+(S.mailJobs?"3) Run phone jobs (the BLUE box) \u00b7 4) close the franchise \u2192 Validate \u2192 Apply (AMBER) \u00b7 5) Send sync ONLINE (GREEN)":"3) close the franchise \u2192 Validate \u2192 Apply (AMBER) \u00b7 4) Send sync ONLINE (GREEN)")+". Then come back here and tap Check."};
  if (S.mailJobs) return {k:"jobs", t:"The "+(S.mailJobs.kind==="midweek"?"midweek":S.mailJobs.kind==="story"?"game story's":"week's")+" writing is on the computer's desk (sent "+mailTime(S.mailJobs.sentAt)+"). On the COMPUTER: open TyPhone Sync \u2192 Run phone jobs (the BLUE box). Then come back here and tap Check."};
  if (mailInfo && mailInfo.noBox) return {k:"nobox", t:"No mailbox exists yet. One-time, on the COMPUTER: TyPhone Sync \u2192 save the token (the PURPLE box) \u2192 pick save + player \u2192 Send sync ONLINE (GREEN). That creates the box."};
  if (!aiKey() && midweekOwed()) return {k:"midweek", t:"Midweek is this week's next step \u2014 play it out, or choose \u201cDon\u2019t talk to the media during the week\u201d; then the orders and the save."};   /* v1.13.0: a KEYED phone has no midweek step — media availability is a card, not a gate */
  if (ordTotal()>0){
    const grew = S.mailOrdersSent && st.ordersTs===S.mailOrdersSent && !st.ordersApplied && S.mailOrdersSentHash && S.mailOrdersSentHash!==codeHash(ordersCode());
    if (grew) return {k:"send", t:"Your queue changed since the "+mailTime(S.mailOrdersSent)+" send \u2014 review and re-send THE order code (the fresh code replaces the old one on its desk).", btn:"Review & re-send \u2014 "+ordTotal(), fn:"reviewSheet()"};
    return {k:"send", t:ordTotal()+" change"+(ordTotal()===1?"":"s")+" queued for the save \u2014 review before anything is written.", btn:"Review & move on", fn:"reviewSheet()"};
  }
  if (st.ordersAppliedTs && (!st.syncTs || st.syncTs<st.ordersAppliedTs)) return {k:"resync", t:"The computer applied your orders \u2713 ("+mailTime(st.ordersAppliedTs)+"). YOUR TURN in Madden: fiddle with whatever you want first (practice, lineups, the shop), play your game, then ADVANCE THE WEEK (the week isn't over until you advance \u2014 an un-advanced save syncs as this same week again), then save. THEN on the COMPUTER: re-pick the save and Send sync ONLINE (the GREEN button), then tap Check here."};
  if (st.syncTs) return aiKey()
    ? {k:"idle", t:"All caught up \u2713 (last sync "+(st.syncWk? st.syncWk+" \u00b7 ":"")+mailTime(st.syncTs)+"). Live the week \u2014 when you're ready, the door below reviews anything headed for the save and hands you back to Madden.", btn:"On to the next game"+(function(){const g=nextGame();return g? " \u2014 "+(g[4]?"vs ":"@ ")+g[3] : "";})(), fn:"reviewSheet()"}
    : {k:"idle", t:"All caught up \u2713 (last sync "+(st.syncWk? st.syncWk+" \u00b7 ":"")+mailTime(st.syncTs)+"). YOUR TURN in Madden: fiddle with whatever you want, play your game, then ADVANCE THE WEEK \u2014 the week isn't over until you advance; an un-advanced save syncs as this same week again \u2014 then save. THEN on the COMPUTER: Send sync ONLINE (the GREEN button), then tap Check."};
  return {k:"idle", t:"Nothing in the box yet. YOUR TURN in Madden: play your game, then ADVANCE THE WEEK, then save. THEN on the COMPUTER: Send sync ONLINE (the GREEN button), then tap Check."};
}
/* v1.8.4: the AMBER step of the walled garden — everything going BACK to the save on one
   card, shown only when it's this step's turn. The coach's rulings ride the ONE order code
   below automatically (they count in ordTotal and lead the code). */
function syncOrdersCard(){
  const st=staffState();
  const n=mailOn()? mailNextStep() : null;
  return `<div class="synccard box-ord"><h4>Back to the save <span class="cchip chip-ord">AMBER</span></h4>
  ${(n&&n.k==="send")? `<p style="margin-top:0">${esc(n.t)}</p>`:""}
  <p>ONE code carries everything pending: the coach's rulings first, your queued moves after (10 max). Send it BEFORE you play \u2014 the computer writes it into the save with the franchise closed. On the computer this is the <span class="cw-ord">AMBER box</span> (Coach orders).</p>
  ${st.orders.length? `<p style="font-size:12.5px;margin:0 0 4px">${esc(coachName())} made these calls himself \u2014 announced in the building whether you like them or not; they ride the ONE order code below automatically.</p>
  ${st.orders.map(o=>`<div class="ordrow"><span>${o.kind==="bench"?"Benched":"Demoted"} \u00b7 ${esc(o.wk.split("/").slice(1).join(" wk "))} \u00b7 ${esc(o.why)}</span><button onclick="staffDismiss('${o.id}')" title="Dismiss after it's applied">\u2715</button></div>`).join("")}`:""}
  ${(S.orders&&S.orders.length)? S.orders.map(o=>`<div class="ordrow"><span>${esc(ordWords(o))}</span></div>`).join(""):""}
  <button class="btn" style="background:var(--ok);color:#04170d;margin-top:8px" onclick="reviewSheet()">On to the next game${(function(){const g=nextGame();return g? " \u2014 "+(g[4]?"vs ":"@ ")+esc(g[3]) : "";})()}</button>
  <p style="font-size:11.5px;opacity:.6;margin:8px 0 0">\u2715 a ruling only after it's been applied on the computer.</p>
  </div>`;
}
/* v1.13.0 THE MOVE-ON REVIEW (Ty's spec, structured-only v1): one page BEFORE anything goes
   back to the save — every change about to ride the code, each removable, the unseen hand a
   tap away. Approve and the ONE code goes; nothing enters the save without his finger on it.
   AI-suggested rows are PHASE 2, banked (the marker-auto-detect false-positive law). */
function removeOrder(i){ if(S.orders&&S.orders[i]!==undefined){ S.orders.splice(i,1); persist(); reviewSheet(); if(curApp==="sync") renderApp("sync"); } }
function denyStaffOrder(i){
  /* v1.13.1 (Ty's ruling): the HUMAN is the all-seeing controller — the coach's call can be
     overruled from upstairs before it ever reaches the save. The player still found out the
     way everyone else did; realism is a discipline, not a cage. The log keeps the truth. */
  const st=staffState();
  if (st.orders[i]!==undefined){
    const o=st.orders.splice(i,1)[0];
    st.log.unshift({t:Date.now(), x:"Overruled from upstairs: "+(o.kind==="bench"?"the benching":"the demotion")+" ("+String(o.why||"").slice(0,60)+") never reaches the save."});
    persist(); reviewSheet(); if(curApp==="sync") renderApp("sync");
  }
}
const ORD_COMPOSE=[["depth","Depth chart call"],["status","Roster move"],["sign","New contract"],["depthoff","Off the rows"],["position","Position change"],["number","Number change"],["resign","Rewrite a real deal"]];
function reviewSheet(){
  const st=staffState(); const g=nextGame();
  const dest=g? (g[4]?"vs ":"@ ")+g[3] : "the next game";
  const compose=`<p style="font-size:12px;opacity:.7;margin:10px 0 4px">The unseen hand \u2014 add a move (the news breaks like it came from the facility):</p>
  <div style="display:flex;gap:6px;flex-wrap:wrap">${ORD_COMPOSE.map(x=>`<button class="btn sm" style="background:rgba(255,255,255,.12)" onclick="window.__rvBack=1;ordSheet('${x[0]}')">${x[1]}</button>`).join("")}</div>`;
  if (!ordTotal()){
    sheet(`<h3>On to the next game \u2014 ${esc(dest)}</h3><p class="sp">Nothing is queued for the save \u2014 clean week. In Madden: fiddle however you like, play, then <b>ADVANCE THE WEEK</b> (an un-advanced save syncs as this same week again), save, and Send sync ONLINE on the computer.</p>
    ${compose}
    <button class="btn" style="background:rgba(255,255,255,.1);margin-top:10px" onclick="closeSheet()">Go play</button>`);
    return;
  }
  sheet(`<h3>Before the save \u2014 ${esc(dest)}</h3><p class="sp">Everything below is about to ride the ONE code to the computer. Remove any of yours; overrule the coach's if you must \u2014 your call, your kind of career.</p>
  <div style="max-height:42vh;overflow:auto">
  ${st.orders.length? `<p style="font-size:12px;opacity:.7;margin:0 0 4px">The coach's calls (announced in the building):</p>
  ${st.orders.map((o,i)=>`<div class="ordrow"><span>${o.kind==="bench"?"Benched":"Demoted"} \u00b7 ${esc(o.why)}</span><button onclick="denyStaffOrder(${i})" title="Overrule from upstairs \u2014 this never reaches the save">\u2715</button></div>`).join("")}`:""}
  ${(S.orders&&S.orders.length)? `<p style="font-size:12px;opacity:.7;margin:8px 0 4px">Your moves:</p>
  ${S.orders.map((o,i)=>`<div class="ordrow"><span>${esc(ordWords(o))}</span><button onclick="removeOrder(${i})" title="Remove from this week's code">\u2715</button></div>`).join("")}`:""}
  </div>
  ${compose}
  ${mailOn()? `<button class="btn" style="background:var(--ok);color:#04170d;margin-top:10px" onclick="closeSheet();mailSendOrders()">Approve \u2014 send THE code to the computer (${ordTotal()})</button>`
  : `<button class="btn" style="background:var(--ok);color:#04170d;margin-top:10px" onclick="closeSheet();copyOrders()">Approve \u2014 copy THE code (${ordTotal()})</button>`}
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="closeSheet()">Not yet</button>`);
}
function mailCard(){
  /* v1.8.3 (Ty's reorg): the mailbox IS the sync now — this GREEN card is the default and
     the step-by-step home; copy-paste survives as the small Manual row at the bottom. */
  if (!mailOn()) return `<div class="synccard box-sync"><h4>The sync <span class="cchip chip-sync">GREEN</span></h4>
  <p style="margin-bottom:0">This is how syncing works now: one button on the computer, one button here. Set up the <span class="cw-mail">PURPLE Mailbox</span> box above (one-time) and this card takes over — it always names your one next move. Manual copy-paste lives in the small row at the bottom, forever.</p></div>`;
  const n=mailNextStep();
  return `<div class="synccard box-sync"><h4>The sync <span class="cchip chip-sync">GREEN</span></h4>
  <p style="margin-bottom:8px">${n.k==="busy"? BUSYL : esc(n.t)}</p>
  ${n.btn? `<button class="btn" style="background:var(--ok);color:#04170d" onclick="${n.fn}">${esc(n.btn)}</button>` : ""}
  <button class="btn sm" ${mailBusy?"disabled":""} style="background:rgba(255,255,255,.12);margin-top:${n.btn?"8px":"0"}" onclick="mailCheck(true)">Check the mailbox now</button>
  ${n.k==="idle"? `<button class="btn sm" ${refreshBusy?"disabled":""} style="background:rgba(255,255,255,.08);margin-top:8px;margin-left:6px" onclick="refreshWeek()">${refreshBusy?BUSYL:"Refresh this week"}</button>`:""}
  ${(n.k==="idle"||n.k==="jobs")? `<p style="font-size:11.5px;opacity:.6;margin-top:8px" id="lastRefreshLine">${lastRefreshLine()}</p>
  <p style="font-size:11.5px;opacity:.6;margin-top:4px">${lastSyncLine()}</p>`:""}
  <p style="font-size:11.5px;opacity:.55;margin:8px 0 0">${aiKey()? "The loop: play \u2192 ADVANCE THE WEEK in Madden \u2192 save \u2192 Send ONLINE on the computer \u2192 Apply here \u2192 the week writes itself \u2192 LIVE IT \u2192 Review & move on \u2192 (if changes) apply on the computer \u2192 play. This card always names the step. Copy-paste below works forever." : "The loop: play your game \u2192 ADVANCE THE WEEK in Madden \u2192 save \u2192 Send ONLINE on the computer \u2192 Apply here \u2192 midweek \u2192 (if orders) Send to computer \u2192 apply there \u2192 fresh sync back. One step at a time; this card always names it. Copy-paste below works forever."}</p>
  </div>`;
}
/* v1.7.9 (Ty): syncBusy covers decode + bookkeeping on the Apply button; the eager weekly world
   rides the SAME refreshBusy the Refresh card shows. S.lastSyncAt is the sync's own stamp. */
let syncBusy=false;
function lastSyncLine(){
  const r=S.lastSyncAt; if(!r) return "No sync applied yet this career.";
  const d=new Date(r.when); const t=d.toLocaleDateString([], {month:"short",day:"numeric"})+" "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
  return "Last sync: "+esc(r.wk)+" \u00b7 "+t+(r.kind==="refresh"? " (same-week truth refresh)":"");
}
async function refreshWeek(){
  if (!aiKey() && !laneCOn()) return toast("Add an API key in Sync first.");   // v1.8.1: the computer's key covers the heavies
  if (refreshBusy) return;
  refreshBusy=true; if(curApp==="sync") renderApp("sync");
  const last = lastPlayed();
  const ruled = coachEvaluate("midweek");                     // v1.6.3: the coach reads the week before the world writes it
  if (ruled) toast("The club sent word. Check T-Mail.");
  try{ await generateWeek(S.blob, last, {noArticle:true}); }
  catch(e){ S.lastRefresh={when:Date.now(), wk:wkLabel(S.blob.clock), ok:false, err:String(e.message||e).slice(0,180)}; persist(); toast("Refresh failed: "+e.message); }
  refreshBusy=false; if(curApp==="sync") renderApp("sync");
}
function lastRefreshLine(){
  const r=S.lastRefresh; if(!r) return "No refresh yet this career.";
  const d=new Date(r.when); const t=d.toLocaleDateString([], {month:"short",day:"numeric"})+" "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
  if (!r.ok) return "Last attempt failed ("+t+"): "+esc(r.err||"unknown error");
  if (r.kind==="sent") return "Sent to the computer: "+esc(r.wk)+" \u00b7 "+t+" \u2014 run the phone jobs there, then Check the mailbox.";
  const c=r.counts||{};
  return "Last "+(r.kind==="weekly"?"weekly sync world":"refresh")+": "+esc(r.wk)+" · "+t+" · "+(c.chirps||0)+" chirps, "+(c.threads||0)+" threads, "+(c.texts||0)+" texts, "+(c.emails||0)+" emails"+(c.article?", 1 article":"");
}
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
  const code="TYNETB."+await deflateStr(JSON.stringify({__v:2, S, META}));
  await navigator.clipboard.writeText(code); toast("Backup copied: "+(code.length/1024).toFixed(1)+" KB");
}
/* v1.6.1 (live-save bug): the old ordinal put OffSeason(500+0) BEFORE ProBowl(500+21),
   so syncing Ty's real P10 (Pro Bowl wk21) then P11 (OffSeason wk0) tripped the rewind
   gate and the code silently refused to advance. Phases now rank Pre < RS < postseason
   (playoffs/Pro Bowl by their global week number) < OffSeason. */
/* v1.7.8 (Ty: "the scores should never show until the week is actually advanced"): Madden sims
   the rest of the current week's slate before he plays his own game, so the save carries finals
   the player hasn't lived yet. REVEAL LAW: a game's score exists on screen only once the clock
   has moved PAST its week. The current week is always "upcoming", everywhere. */
function wkRevealOrd(t,w){ return (t==="PreSeason"?0 : t==="RegularSeason"?1 : 2)*1000 + (+w||0); }
function gameRevealed(t,w){ const c=S.blob.clock||{}; return wkRevealOrd(t,w) < wkRevealOrd(c.weekType, c.week); }
function clockOrd(c){
  const ph = c.weekType==="PreSeason"?0 : c.weekType==="RegularSeason"?1 : c.weekType==="OffSeason"?3 : 2;
  return c.seasonYear*10000 + ph*1000 + (c.week||0);
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
  /* v1.7.9 (Ty): decode + bookkeeping can take real seconds on a big save — the Apply button
     says Please wait for all of it. try/finally so EVERY exit path (sheets, toasts) clears it. */
  syncBusy=true; if(curApp==="sync") renderApp("sync");
  try{
  let dec;
  try { dec = await decodeCode(raw); } catch(e){ return toast("Code didn't decode: "+e.message); }
  if (dec.backup){ return restoreSheet(dec.data); }
  const blob=dec.blob;
  normalizeLeague(blob); autoFromSave(blob);
  if (!S || blob.careerId!==S.careerId){
    // same player under a new career ID? (trade, season rollover, extractor update)
    const nm=(blob.player.first+" "+blob.player.last).toLowerCase();
    const cand = META.careers.find(c=> c.id!==blob.careerId && (c.label||"").toLowerCase()===nm);
    if (cand){
      const st = await idb.get("career/"+cand.id);
      const pidOld = st?.blob?.player?.presentationId, pidNew = blob.player.presentationId;
      if (st && (pidOld==null || pidNew==null || pidOld===pidNew)) return adoptSheet(blob, cand.id);
    }
    if (META.careers.find(c=>c.id===blob.careerId)){
      // career exists but isn't active: switch to it and continue (previously this re-added and wiped it)
      const st=await idb.get("career/"+blob.careerId);
      if (st){ S=st; META.activeId=blob.careerId; persist(); renderHome(); }
      else return newCareerSheet(blob);
    } else return newCareerSheet(blob);
  }
  const k=wkKey(blob.clock);
  if (S.appliedWeeks.includes(k)){
    /* v1.7.5 (Ty: "code only works once" blocked the records upgrade): a code for the week the
       phone is ALREADY on is a same-week refresh — adopt the save's current truth in place.
       No time passes, no checks repeat. Older codes fall through to the rewind sheet. */
    if (clockOrd(blob.clock) === clockOrd(S.blob.clock)) return sameWeekSheet(blob);
  }
  if (clockOrd(blob.clock) < clockOrd(S.blob.clock)) return rewindSheet(blob);
  await advanceTo(blob);
  } finally { syncBusy=false; if(curApp==="sync") renderApp("sync"); }
}
function sameWeekSheet(blob){
  _pending={blob};
  sheet(`<h3>Same week, fresh truth</h3><p class="sp">${esc(wkLabel(blob.clock))} is already applied, but this code carries the save's CURRENT facts — records, roster, stats, contract. Re-apply it in place: no time passes, no checks repeat, nothing generates twice. Real changes in the save (a trade, a jersey, new paper) still get announced.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="doRefreshTruth()">Refresh the save's truth</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="_pending=null;mailDeclineSync();closeSheet()">Keep the week as it is</button>`);
}
function doRefreshTruth(){
  const x=_pending; _pending=null; if(!x) return;
  const blob=x.blob;
  const oldP=Object.assign({}, S.blob.player, {contract:S.blob.player.contract});
  S.blob=blob; recomputeTitles(blob);
  applySaveNotices(oldP, blob.player, blob.clock);
  homeFillPerception(S.perception, blob.player);                             // v1.12.3: geography backfills on same-week refreshes too (blank-only, typed wins)
  S.lastSyncAt={when:Date.now(), wk:wkLabel(blob.clock), kind:"refresh"};   // v1.7.9: same-week truth refreshes stamp too
  mailMarkSyncApplied();                                                     // v1.8.0: mailbox handshake (no-op unless this code came from the box)
  persist(); closeSheet(); toast("Save truth refreshed for "+wkLabel(blob.clock)+". No time passed.");
  renderHome(); if(curApp) renderApp(curApp);
}
function adoptSheet(blob, oldId){
  _pending={blob, oldId};
  sheet(`<h3>Same player, new career ID</h3><p class="sp">This code identifies ${esc(blob.player.first+" "+blob.player.last)} under a new ID (team change, season rollover, or an extractor update). Continue the existing career? Everything carries over: money, purchases, threads, applied weeks.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="doAdoptPending()">Continue existing career</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="adoptForkPending()">Add as a separate career</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="_pending=null;closeSheet()">Cancel</button>`);
}
async function adoptForkPending(){ const x=_pending; _pending=null; if(x) await addCareer(x.blob); }
async function doAdoptPending(){
  const x=_pending; _pending=null; if(!x) return;
  const {blob, oldId}=x;
  const st=await idb.get("career/"+oldId);
  if (!st){ closeSheet(); return toast("Couldn't load that career."); }
  st.careerId=blob.careerId;
  await idb.set("career/"+blob.careerId, st);
  if (oldId!==blob.careerId) await idb.del("career/"+oldId);
  const c=META.careers.find(k=>k.id===oldId); if(c) c.id=blob.careerId;
  if (META.activeId===oldId) META.activeId=blob.careerId;
  S=st; META.activeId=blob.careerId; persist(); closeSheet(); renderHome();
  const k=wkKey(blob.clock);
  if (S.appliedWeeks.includes(k)){
    if (clockOrd(blob.clock)===clockOrd(S.blob.clock)) return sameWeekSheet(blob);   // v1.7.5
    return toast("Career adopted under the new ID. That week was already applied.");
  }
  if (clockOrd(blob.clock) < clockOrd(S.blob.clock)) return rewindSheet(blob);
  await advanceTo(blob);
}
/* Pending-object pattern: never inline JSON into onclick attributes.
   Blob/backup JSON contains apostrophes (T'Vondre, D'Angelo, Leiper's Fork...)
   which terminate single-quoted HTML attributes and silently break the button. */
let _pending=null;
function newCareerSheet(blob){
  const p=blob.player;
  _pending=blob;
  sheet(`<h3>New career detected</h3><p class="sp">${esc(p.first)} ${esc(p.last)} — ${esc(p.pos)}, ${esc(p.team)} (${esc(wkLabel(blob.clock))}). Add it as a separate phone profile?</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="addCareerPending()">Add career</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="_pending=null;closeSheet()">Cancel</button>`);
}
async function addCareerPending(){ const b=_pending; _pending=null; if(b) await addCareer(b); }
/* v1.12.3 THE BIRTH STAMP: a mailbox-born career must stamp its box (mailGist/mailApplied/hash
   + best-effort PATCH syncApplied) — but birth happens on the SHEET's Add tap, AFTER applyCode
   returns. v1.12.1's setupMailPull stamped right after the await, before the tap: the stamp
   never fired and the "didn't apply" line showed under a live sheet. The stamp now rides
   addCareer itself, set by whichever door pulled the code. */
let _mailBirthStamp=null;   // {gistId, ts, h} — set by setupMailPull / addCareerFromMailbox before applyCode
async function addCareer(blobOrJson){
  const blob = typeof blobOrJson==="string" ? JSON.parse(blobOrJson) : blobOrJson;
  const st=newCareerState(blob);
  await idb.set("career/"+blob.careerId, st);
  META.careers.push({id:blob.careerId, label:blob.player.first+" "+blob.player.last, sub:blob.player.pos+" · "+blob.player.team+" · "+wkLabel(blob.clock)});
  META.activeId=blob.careerId; S=st; persist(); closeSheet(); teardownSetup(); toast("Career added."); renderHome(); renderLock();
  if (curApp) renderApp(curApp);
  if (_mailBirthStamp){                                             /* v1.12.3: the mailbox-born career stamps its box at the real birth */
    const bs=_mailBirthStamp; _mailBirthStamp=null;
    S.mailGist=bs.gistId; S.mailApplied=bs.ts; if(bs.h) S.mailAppliedHash=bs.h; persist();
    (async()=>{ try{ const g=await mailJf(MAIL_API+"/gists/"+bs.gistId,{headers:mailHdrs()});
      const st2={...mailState(g), syncApplied:true, syncAppliedTs:Date.now()};
      await mailJf(MAIL_API+"/gists/"+bs.gistId,{method:"PATCH",headers:mailHdrs(),body:JSON.stringify({files:{"state.json":{content:JSON.stringify(st2,null,1)}}})});
      if(typeof mailInfo!=="undefined" && mailInfo) mailInfo.state=st2;
    }catch(e){ console.log("birth stamp PATCH failed (local flag is the law):", String(e.message||e)); } })();
  }
  /* v1.12.2 THE FIRST WORDS (Ty: "why do i have to wait for a second sync for the article") —
     root cause: eager generation lived ONLY in advanceTo, so the FIRST code adopted truth and
     wrote NOTHING; the Chronicle and the world stayed silent until sync two. The first sync now
     runs the SAME eager block: the paper works with what it has (national law — a week with no
     played game is still a week around the league). Played-game-or-not, the world speaks. */
  const last = lastPlayed(blob.schedule);
  if (aiKey() && META.settings.autogen){
    weekEnqueue(blob, last);                                          /* v1.13.0: first words ride the runner too */
  }
  else if (laneCOn() && META.settings.autogen){
    refreshBusy=true; if(curApp==="sync") renderApp("sync");
    generateWeek(blob, last).catch(e=>{
      S.lastRefresh={when:Date.now(), wk:wkLabel(S.blob.clock), ok:false, err:String(e.message||e).slice(0,180)};
      S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"The week's world didn't generate — open Sync and hit Refresh world now"});
      persist(); toast("Generation failed: "+e.message);
    }).finally(()=>{ refreshBusy=false; if(curApp==="sync") renderApp("sync"); });
  }
  else if (last){ placeholderWeek(blob, last); }
}
function rewindSheet(blob){
  _pending=blob;
  sheet(`<h3>Older save detected</h3><p class="sp">This code is from ${esc(wkLabel(blob.clock))}; the phone is at ${esc(wkLabel(S.blob.clock))}. Rewinding deletes everything newer — deposits, articles, threads, purchases stay only if they existed then.</p>
  <button class="btn" style="background:var(--bad);color:#fff" onclick="doRewindPending()">Rewind (deletes newer)</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="_pending=null;mailDeclineSync();closeSheet()">Ignore this code</button>`);
}
async function doRewindPending(){ const b=_pending; _pending=null; if(b) await doRewind(b); }
async function doRewind(blobOrJson){
  const blob = typeof blobOrJson==="string" ? JSON.parse(blobOrJson) : blobOrJson;
  // v1 rewind: reset to a fresh state at that blob, preserving settings/perception
  const per=S.perception; const st=newCareerState(blob); st.perception=per;
  S=st; await idb.set("career/"+S.careerId, S);
  const c=META.careers.find(x=>x.id===S.careerId); if(c) c.sub=blob.player.pos+" · "+blob.player.team+" · "+wkLabel(blob.clock);
  persist(); closeSheet(); toast("Rewound to "+wkLabel(blob.clock)); renderHome(); if(curApp) renderApp(curApp);
}
function restoreSheet(data){
  const st = data.__v===2? data.S : data;
  _pending=data;
  sheet(`<h3>Restore backup?</h3><p class="sp">Career "${esc(st.blob.player.first+" "+st.blob.player.last)}" at ${esc(wkLabel(st.blob.clock))}${data.__v===2?", plus your phone settings (wallpaper, photo, keys, app order)":""}. Overwrites any existing copy of the same career.</p>
  <button class="btn" style="background:var(--ok);color:#04170d" onclick="doRestorePending()">Restore</button>
  <button class="btn" style="background:rgba(255,255,255,.1)" onclick="_pending=null;closeSheet()">Cancel</button>`);
}
async function doRestorePending(){ const d=_pending; _pending=null; if(d) await doRestore(d); }
async function doRestore(dataOrJson){
  const data = typeof dataOrJson==="string" ? JSON.parse(dataOrJson) : dataOrJson;
  const st = data.__v===2? data.S : data;
  if (data.__v===2 && data.META){
    const keepCareers = META.careers;
    META = data.META;
    for (const c of keepCareers) if(!META.careers.find(x=>x.id===c.id)) META.careers.push(c);
  }
  await idb.set("career/"+st.careerId, st);
  if (!META.careers.find(c=>c.id===st.careerId)) META.careers.push({id:st.careerId, label:st.blob.player.first+" "+st.blob.player.last, sub:wkLabel(st.blob.clock)});
  META.activeId=st.careerId; S=st; persist(); closeSheet(); teardownSetup(); toast("Restored, settings and all."); applyWallpaper(); applyTheme(); renderHome();
}

/* ---- the week engine ---- */
/* v1.7.2 (Ty: "i don't want to get a trade deal and then nothing updates"): talk is talk and the
   SAVE is truth — but when the truth changes, the phone must SAY SO. On every sync the old and new
   player rows are diffed: a team change, a new contract, a roster-status move, or a jersey change
   becomes a SAVE NOTICE — notification, an agent text, and a REAL NEWS line the world engine reacts
   to (so your trade-me posts, agent chats, and negotiations pay off the week the save delivers). */
function applySaveNotices(oldP, newP, newC){
  const notices=[];
  if (oldP.team!==newP.team){
    notices.push("TRADED/SIGNED: he moved from the "+oldP.team+" to the "+newP.team+" this week — this is announced fact, the whole world reacts to it");
    S.world.notifs.push({app:"messages", t:"Apex Sports Group", p:"It's official — you're a "+newP.team.replace(/s$/,"")+" now"});
    const th=S.world.texts.find(t=>t.id==="agent");
    if (th){ th.msgs.push(["them","It's done. The "+oldP.team+" send you to the "+newP.team+". Flights and the housing move are handled — new city, same rules: don't buy anything with a motor yet.",Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; }
    const stay=S.bills.find(b=>b.id==="stay");
    if (stay) stay.n="Extended-stay hotel ("+((D.METROS[newP.team]||{}).city||newP.team)+")";
    if (S.rental){ /* v1.7.7: the lease doesn't move with you */
      const dep=S.rental.dep; S.cash.checking+=dep; S.rental=null;
      S.bills=S.bills.filter(b=>b.id!=="rent");
      if (!S.properties.length && !S.bills.find(b=>b.id==="stay"))
        S.bills.push({id:"stay", n:"Extended-stay hotel ("+((D.METROS[newP.team]||{}).city||newP.team)+")", amt:3400, cat:"housing"});
      S.ledger.push({t:"Lease ended by the move — deposit returned", amt:dep, kind:"income"});
      notices.push("HOUSING: his apartment lease ended with the move; deposit returned, back in a hotel in the new city");
    }
  }
  const oc=oldP.contract||{}, nc=newP.contract||{};
  const sum=a=>(a||[]).reduce((x,y)=>x+(+y||0),0);
  if (nc.length!==oc.length || sum(nc.salary)!==sum(oc.salary) || sum(nc.bonus)!==sum(oc.bonus)){
    const total=sum(nc.salary)+sum(nc.bonus);
    notices.push("NEW CONTRACT ON FILE: "+(nc.length||1)+" year"+((nc.length||1)===1?"":"s")+", "+fm(total)+" total — the deal talk became real paper this week");
    S.world.notifs.push({app:"meridian", t:"Apex Sports Group", p:"New deal on file: "+(nc.length||1)+"yr, "+fm(total)});
    const th=S.world.texts.find(t=>t.id==="agent");
    if (th){ th.msgs.push(["them","Paper's in. "+(nc.length||1)+" years, "+fm(total)+" total. Read the deposit schedule in Meridian before you celebrate.",Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; }
  }
  if (oldP.status!==newP.status && newC.weekType!=="PreSeason"){
    notices.push("ROSTER MOVE: status changed "+oldP.status+" \u2192 "+newP.status+" (announced fact)");
    S.world.notifs.push({app:"sync", t:"Front office", p:"Roster move: "+(newP.status==="Signed"?"signed to the active roster":newP.status)});
    wlRosterMove(newP.status==="Signed"? 1 : -1, "the roster move");            // v1.7.4: the book saw it
  }
  if (oldP.jersey!==newP.jersey){
    notices.push("JERSEY CHANGE: he wears #"+newP.jersey+" now (was #"+oldP.jersey+") — if a deal or promise was attached to that number, it just came due");
    /* v1.7.7 (Ty): team ops falls under the staff email channel — the jersey notice is a one-way email now */
    clubMail("Jersey Update — #"+newP.jersey, "Made it official: you're in #"+newP.jersey+" now (previously #"+oldP.jersey+"). Nameplate, practice gear, and game jerseys are being redone this week. If a deal or promise was attached to that number, that's between you and whoever you made it with. This notice is one-way.", (S.blob.player.team||"Club")+" Equipment Room");
    S.world.notifs.push({app:"tmail", t:"Equipment Room", p:"Made it official — you're #"+newP.jersey+" now"});
  }
  if (oldP.pos!==newP.pos){
    /* v1.12.0: a position change is org-chart news — announced like everything the save decides */
    notices.push("POSITION CHANGE: he is officially a "+newP.pos+" now (was "+oldP.pos+") — announced fact, the org chart moved");
    S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Official: you're a "+newP.pos+" now"});
  }
  S.saveNotices = notices; // this sync's truth only; overwritten every sync
  return notices.length;
}
function saveNoticesLine(){
  const n=S.saveNotices||[];
  if (!n.length) return "";
  return "REAL NEWS FROM THE SAVE THIS WEEK (it actually happened; the world treats it as the story it is): "+n.join(". ")+".";
}
async function advanceTo(blob){
  const oldC=S.blob.clock, newC=blob.clock;
  const oldPlayed=new Set(S.blob.schedule.filter(g=>g[7]).map(g=>g[2]+"|"+g[1]+"|"+g[0])); // v1.7.4 presser: what was already played
  const oldP=Object.assign({}, S.blob.player, {contract: S.blob.player.contract});
  const oldSS=mergedSS(S.blob);                                       // v1.7.5: last sync's stat truth, for the per-game diff
  const rng=seedRng(S.careerId+"|wk|"+wkKey(newC));
  const events=[];
  // elapsed regular-season weeks → paychecks, ACROSS SEASONS if the code jumps years.
  // Each entry: {y: seasonYear, w: week index}. Skipped full seasons pay all 18 checks.
  const wksElapsed=[];
  {
    const afterRS = t => t!=="PreSeason" && t!=="RegularSeason"; // playoffs / offseason
    for (let y=oldC.seasonYear; y<=newC.seasonYear; y++){
      let start=0, end=0;
      if (y===oldC.seasonYear) start = oldC.weekType==="RegularSeason"? oldC.week : (afterRS(oldC.weekType)? 18 : 0);
      if (y===newC.seasonYear) end = newC.weekType==="RegularSeason"? newC.week : (afterRS(newC.weekType)? 18 : 0);
      else end = 18; // fully elapsed intermediate (or origin) season
      for (let w=start; w<end; w++) wksElapsed.push({y, w});
    }
  }
  if (oldC.weekType==="PreSeason"){
    // stipend per preseason week ARRIVED AT; leaving preseason passes weeks oldC.week+1..2 only
    const preWeeks = (newC.weekType==="PreSeason" && newC.seasonYear===oldC.seasonYear ? newC.week : 2) - oldC.week;
    for (let i=0;i<preWeeks;i++){ deposit("Camp stipend — week "+(oldC.week+i+2), sweepNet(1750)); events.push("Camp stipend $1,750"); }   // v1.8.7 (Ty: "autosweep doesn't seem to be working"): it only ever swept RS game checks — preseason pays stipends, so the toggle read as dead. Every income sweeps now.
  }
  for (const e of wksElapsed){
    const {y, w} = e;
    const g = (y===newC.seasonYear) ? blob.schedule.find(x=>x[1]==="RegularSeason"&&x[0]===w) : null;
    const road=g&&!g[4]; const st=road? STATE_TAX[g[3]]:null;
    // weeks in the incoming season pay per the NEW truth; earlier seasons pay per the truth the phone already held
    const pl = (y===newC.seasonYear)? blob.player : S.blob.player;
    const ck=checkLines(pl.status, road, st, pl);
    let net=ck.net;
    net=sweepNet(net);   // v1.8.7: the sweep moved into its ONE door (sweepNet) — same math, now every income stream uses it
    const yTag = (y!==newC.seasonYear)? y+" " : "";
    deposit("Game check — "+yTag+"Week "+(w+1)+(road?" (@ "+g[3]+")":""), net);
    events.push(yTag+"Week "+(w+1)+" check "+fm(net));
    dealWeekPay(y, w);                                             // v1.6: endorsement money rides the season weeks
    burnWeek(); tickInvest(rng); cardCycle(w);
  }
  /* v1.7.7 (Ty: "car value still drops weekly"): the zero-elapsed path ran a FULL weekly burn on
     every same-week re-sync, so the decay counter (and the burn, and debt amortization) counted
     SYNCS instead of game weeks. One burn per game week now, ever. */
  if (!wksElapsed.length && S.lastBurnWk!==wkKey(newC)){ burnWeek(); tickInvest(rng); }
  S.lastBurnWk=wkKey(newC);
  // adopt the new truth
  const gameDelta = gameDateObj(newC) - gameDateObj(oldC);           // v1.4: how far the WORLD moved
  if (gameDelta > 0) shiftWorldTime(gameDelta);                       // everything already here ages by game time
  if (newC.seasonIndex > oldC.seasonIndex){ bankSeason(S.blob); dealSeasonRoll(); }  // v1.5.1 ledger + v1.6 deal years burn
  recomputeTitles(blob);                                              // v1.6: YearSummary truth overrides the heuristic
  S.blob=blob; S.appliedWeeks.push(wkKey(newC));
  reseedFollowers(blob);                                              // v1.4: fame follows the save, not 842 forever
  const c=META.careers.find(x=>x.id===S.careerId); if(c) c.sub=blob.player.pos+" · "+blob.player.team+" · "+wkLabel(newC);
  // status change events
  const last = lastPlayed(blob.schedule, newC.weekType) || lastPlayed(blob.schedule);
  S.world.notifs=[];
  if (last) S.world.notifs.push({app:"pylon", t:"Final", p:(last[4]?"vs ":"@ ")+last[3]+" — "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" W":" L")});
  /* v1.8.9 (Ty: "do the game day home limo/sprinter cost money? if not it should"): the
     chauffeur bills you — a chauffeured arrival at a HOME game that actually got played
     charges when the sync sees it. Drive-yourself and the team shuttle stay free. */
  if (last && last[4] && !oldPlayed.has(last[2]+"|"+last[1]+"|"+last[0]) && S.arrival && (S.arrival.mode==="limo"||S.arrival.mode==="sprinter")){
    const fee = S.arrival.mode==="limo"? 1200 : 850;
    const feeName = S.arrival.mode==="limo"? "Gameday limo service" : "Gameday Sprinter service";
    /* v1.10.0: rides can bill to the Meridian card; a maxed card quietly falls back to
       checking with a note — the driver still gets paid. */
    if (S.arrival.card && cardCanCharge(fee)){ payWithCard(fee, feeName); }
    else { if (S.arrival.card) S.world.notifs.push({app:"card", t:"Meridian Credit", p:"Card was full — the "+fm(fee)+" ride billed to checking"});
      S.cash.checking-=fee; S.ledger.push({t:feeName, amt:-fee, kind:"spend"}); }
    events.push("Gameday "+(S.arrival.mode==="limo"?"limo":"Sprinter")+" "+fm(fee));
  }
  /* v1.7.4 THE PRESSER: a game the phone hadn't seen played is a podium owed */
  if (!(last && !oldPlayed.has(last[2]+"|"+last[1]+"|"+last[0])) && aiKey()){
    /* v1.13.1: no fresh game = no press room this week (preseason before game 1, quiet resyncs) —
       media is done by definition; the episode writes without quotes; nothing walls. */
    S.midweek=S.midweek||{}; S.midweek[wkKey(newC)]=true;
  }
  if (last && !oldPlayed.has(last[2]+"|"+last[1]+"|"+last[0])){
    S.pressers=S.pressers||{};
    const gk="pr"+last[2]+"|"+last[1]+"|"+last[0];
    if (!S.pressers[gk]){
      /* v1.7.5 (Ty): the podium is earned — played AND mattered. The diff only reads when the
         season stat tables actually carry something and the season didn't roll under us. */
      const nSS=mergedSS(blob);
      const d=(oldC.seasonIndex===newC.seasonIndex && Object.keys(nSS).length)? statDelta(oldSS,nSS) : null;
      const gate=presserGate(last, d);
      if (gate.yes){
        S.presserDue={gk, opp:last[3], home:!!last[4], score:last[7], record_after:recordAfter(blob.schedule,last), wk:wkLabel(newC)};
        S.world.notifs.push({app:"cal", t:"Media", p:"Postgame press conference — the room is waiting"});
        S.presserNone=null;
      } else {
        S.presserDue=null;
        if (aiKey()){ S.midweek=S.midweek||{}; S.midweek[wkKey(newC)]=true; }   /* v1.13.1: no room this week — media done by definition, the episode writes without quotes */
        S.presserNone={wk:wkLabel(newC), why:gate.why||"the room wanted the starters"};
      }
    }
  }
  /* v1.8.6: stale-flip for ORDERS (the jobs got theirs in v1.8.2) — a sent-but-never-applied
     order code from a previous week held the WAIT state over the NEW week's midweek forever
     (Ty's stuck screen). The week turned, so that handshake is over: clear the wait; the
     queue survives and the send step re-offers it fresh. Same-week refresh never clears. */
  if (S.mailOrdersSent && !(mailInfo&&mailInfo.state&&mailInfo.state.ordersApplied)){
    S.mailOrdersSent=null; S.mailOrdersSentHash=null;   /* v1.12.2: the snapshot dies with the handshake */
    if (ordTotal()>0) S.world.notifs.push({app:"sync", t:"Sync", p:"Last week's order code was never applied on the computer — your queue is intact; it re-sends fresh this week"});
  }
  /* v1.7.4: midweek matters to the sync loop — say so while it's pending */
  if (!(typeof aiKey==="function"&&aiKey())) S.world.notifs.push({app:"sync", t:"Sync", p:"Midweek hasn't been played for "+wkLabel(newC)});   /* v1.13.1: keyed media lives in the press room at sync — the presser notif owns that moment; no second voice */
  if (S.mailJobs && S.mailJobs.wk && S.mailJobs.wk!==wkKey(newC)){
    S.mailJobs=null;
    if (String(S.lastMidweek||"").startsWith("SENT")) S.lastMidweek=null;   /* v1.13.1: a stale desk stamp from a week the save left dies at the sync — the powerhouse has no computer desk */
  }
  coachEvaluate("sync");                                              // v1.7.5: AFTER the notif reset — his ruling banner used to be wiped three lines up
  applySaveNotices(oldP, blob.player, newC);                          // v1.7.2: the save's truth gets announced
  homeFillPerception(S.perception, blob.player);                      // v1.12.2: save geography backfills BLANK perception fields (typed values never touched; no-op once filled)
  resolveRequests();                                                  // v1.7.4: the building answers formal asks
  ledgerWeekly();                                                     // v1.9.1: cool-offs expire, warmth drifts home, a blocked friend reaches back
  syncTick();                                                         // v1.9.6: the sync clock ticks — anything owed lands now
  events.forEach(e=>S.world.notifs.push({app:"meridian", t:"Meridian", p:e}));
  S.lastSyncAt={when:Date.now(), wk:wkLabel(newC), kind:"advance"};   // v1.7.9 (Ty): the sync gets its own timestamp, separate from the world's
  mailMarkSyncApplied();                                              // v1.8.0: if this code came from the online mailbox, tell the box (fire-and-forget)
  persist();
  toast("Synced to "+wkLabel(newC));
  closeSheet(); renderHome(); if(curApp) renderApp(curApp);
  // eager generation
  /* v1.7.8 (Ty's streamline): a failed weekly world used to vanish into a toast — the notification
     and the Sync status line now say it plainly, and Refresh world retries it. */
  /* v1.7.9 (Ty: "week syncs dont have a please wait thing"): the eager world is minutes of work —
     it rides the SAME refreshBusy the Refresh card shows, so the dots dance right where refreshes
     show theirs (and a manual Refresh can't double-run on top of it). */
  if (aiKey() && META.settings.autogen){
    weekEnqueue(blob, last);                                          /* v1.13.0 THE POWERHOUSE: the whole week writes itself on the phone — checkpointed, resumable, wake-locked */
  }
  else if (laneCOn() && META.settings.autogen){
    /* keyless lane C, unchanged forever: the computer's pen writes the weeklies */
    refreshBusy=true; if(curApp==="sync") renderApp("sync");
    generateWeek(blob, last).catch(e=>{
      S.lastRefresh={when:Date.now(), wk:wkLabel(S.blob.clock), ok:false, err:String(e.message||e).slice(0,180)};
      S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"sync", t:"Sync", p:"The week's world didn't generate — open Sync and hit Refresh world now"});
      persist(); toast("Generation failed: "+e.message);
    }).finally(()=>{ refreshBusy=false; if(curApp==="sync") renderApp("sync"); });
  }
  else if (last){ placeholderWeek(blob, last); }
  /* v1.7.8 (Ty's streamline): the press conference is UNMISSABLE — if the game earned one, the
     sheet opens itself the moment the sync lands, before the article and the world even finish. */
  if (S.presserDue) setTimeout(()=>{ if (S.presserDue) presserSheet(); }, 600);
}
function deposit(label, amt){ S.cash.checking+=amt; S.ledger.push({t:label, amt, kind:"income"}); if (S.cash.checking>=0) S.odFlag=0; }
/* v1.7.6 (Ty: "my account is negative 4750 and no repercussions"): the overdraft mechanic always
   existed, but it only bites at the weekly rollover and said nothing in the moment. Now the instant
   any charge drops checking below zero, one notification says so out loud (once per episode), and
   Meridian wears an OVERDRAWN banner until it's fixed. */
function odNotice(){
  if (!S || !S.cash) return;
  if (S.cash.checking<0 && !S.odFlag){
    S.odFlag=1; S.world.notifs=S.world.notifs||[];
    S.world.notifs.push({app:"meridian", t:"Meridian", p:"Checking overdrawn ("+fm(S.cash.checking)+") \u2014 weekly fees and credit dings until it's positive"});
  }
  if (S.cash.checking>=0) S.odFlag=0;
}
function burnWeek(){
  const wk=monthlyBurn()/4.333;
  S.cash.checking-=wk;
  S.ledger.push({t:"Weekly burn (bills, payments, life)", amt:-Math.round(wk), kind:"spend"});
  /* v1.7.6: overdraft protection — a real bank covers from savings first (small transfer fee),
     and only an uncovered negative eats the $35 + the credit ding. Fees and dings repeat weekly
     until checking is positive. */
  if (S.cash.checking<0 && S.cash.savings>0){
    const need=Math.min(S.cash.savings, -S.cash.checking+12);
    S.cash.savings-=need; S.cash.checking+=need;
    S.ledger.push({t:"Overdraft protection \u2014 Savings to Checking", amt:0, mv:need, from:"savings", to:"checking", kind:"move"});
    S.cash.checking-=12; S.ledger.push({t:"Overdraft protection transfer fee", amt:-12, kind:"spend"});
  }
  if (S.cash.checking<0){ creditTouch(-15); S.ledger.push({t:"Overdraft fee", amt:-35, kind:"spend"}); S.cash.checking-=35;
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"meridian", t:"Meridian", p:"Overdraft fee $35 + credit hit \u2014 checking is still negative"}); }
  odNotice();
  // debt amortization
  for (const d of S.debts){ const int=d.bal*(d.apr/100/52); d.bal=Math.max(0, d.bal+int-(d.pay/4.333)); }
  for (const d of S.debts) if (d.bal<=1) S.ledger.push({t:d.n+" — paid in full", amt:0, kind:"move"});
  S.debts=S.debts.filter(d=>d.bal>1);
  // asset decay — v1.6.8 (Ty): monthly, not weekly. Cars lose ~1.5%/mo (~17%/yr), boats ~0.9%/mo.
  S.burnN=(S.burnN||0)+1;
  if (S.burnN%4===0){
    for (const car of S.garage) car.value=Math.round(car.value*0.985);
    for (const bt of S.boats) bt.value=Math.round(bt.value*0.991);
  }
}
function cardCycle(w){
  cardWeekly();   /* v1.10.0: utilization + limit growth + tier moves, before the autopay */
  if (S.credit.cardBal>0){ const min=Math.max(35,S.credit.cardBal*0.03);
    if (S.cash.checking>=min){ S.cash.checking-=min; S.credit.cardBal=Math.max(0, S.credit.cardBal*(1+S.credit.cardApr/100/12)-min); }
    else { creditTouch(-20); S.credit.missWk=wkKey(S.blob.clock); const before=S.credit.cardBal; S.credit.cardBal*=(1+S.credit.cardApr/100/12); const intr=Math.round(S.credit.cardBal-before); if(intr>=1){ S.credit.ledger=S.credit.ledger||[]; S.credit.ledger.unshift({t:"Interest charged ("+S.credit.cardApr+"% APR)", amt:intr, kind:"interest"}); } } }
}
function placeholderWeek(blob, last){
  const won=last[7][0]>last[7][1];
  const team=blob.player.team, short=blob.player.teamShort, pos=blob.player.pos;
  S.world.chirps.unshift({n:team+" Videos",h:"@"+short.toLowerCase()+"clips",vf:1,av:"#1a5a41",t:"FINAL: "+(last[4]? team+" "+last[7][0]+", "+last[3]+" "+last[7][1] : last[3]+" "+last[7][1]+", "+team+" "+last[7][0])+".", li:800+((last[7][0]*37)%900), rp:120, tm:"1h"});
  S.world.huddle.unshift({id:"pw"+wkKey(blob.clock).replace(/\W/g,""), flair:"DISCUSSION", u:"weekly_bot", tm:"5h", up:77,
    h:"Weekly practice squad + roster watch: who's trending",
    b:"Recurring thread. Elevations, injuries, snap counts, and whatever the coaches say that means the opposite.", cmts:[
    {u:"depth_chart_dan",tm:"4h",up:52,t:"reminder that elevations are capped at three per player. every one they burn is information"},
    {u:"depth_chart_watcher",tm:"3h",up:29,t:"the "+pos.toLowerCase()+" room math is getting funnier every week"},
    {u:"casual_since_2015",tm:"2h",up:-8,t:"can someone explain the depth chart to me like i'm five"}]});
  S.world.huddle.unshift({id:"pg"+wkKey(blob.clock).replace(/\W/g,""), flair:"GAME THREAD", u:"AutoModerator", tm:"3h", up:won?400:150,
    h:"Post-Game Thread: "+(last[4]?team+" ":"")+(won?"win ":"fall ")+last[7][0]+"-"+last[7][1]+(last[4]?" vs ":" at ")+last[3],
    b:"Final from "+(last[4]?"home":"the road")+". Score updates synced from the save. Full write-ups, quotes, and box context arrive when an API key is in Settings; until then the thread runs on vibes.", cmts:[
    {u:"diehard_since_forever",tm:"2h",up:won?220:80,t:won?"WE ARE SO BACK":"it's august for the soul all year with this team"},
    {u:"stat_daddy",tm:"2h",up:64,t:"early read from the broadcast: "+(won?"the line held up in the second half and the score says the rest":"tackling was optional in the third quarter and it snowballed"),r:[
      {u:"CoachTapeAndCoffee",tm:"1h",up:41,t:"charting it tonight. early numbers "+(won?"support the eye test":"are uglier than the score")},
      {u:"group_therapy_thread",tm:"55m",up:-12,t:"we do not need charts to know what we watched"}]},
    {u:"parking_lot_economist",tm:"2h",up:won?95:12,t:won?"road trips hit different when you win. drive home was a party":"18 dollars for a beer to watch that"},
    {u:"late_reps_watcher",tm:"1h",up:33,t:"any word on who got the late reps? asking for reasons",r:[
      {u:"PS_Insider_Burner",tm:"49m",up:88,t:"you know exactly why you're asking. and yes."}]},
    {u:"fire_everyone_guy",tm:"1h",up:-31,t:"fire everyone. every single person in the building. the janitor too"}]});
  stampWorld();
  persist();
}
/* ---- AI generation (user's own key, phone-side) ---- */
/* JSON-mode wrapper: parse, and on failure retry ONCE with an explicit correction
   (Ty's midweek "json error then second try worked" — the retry is now automatic). */
/* v1.6.2 (Ty: "bad JSON from model, fixable?") — the old cleaner only stripped a fence at
   position 0/end, so ANY preamble prose, a fence mid-text, a literal newline inside a JSON
   string, a trailing comma, or a response truncated at the token limit failed BOTH attempts.
   This ladder recovers all five: direct parse -> fenced block -> balanced-brace slice ->
   auto-closed truncation repair, each tried raw + control-chars stripped + in-string
   newlines escaped + trailing commas removed. Truncation repair means a cut-off world
   still lands with fewer chirps instead of erroring out. */
function parseModelJSON(text){
  const t=String(text||"").trim();
  const cands=[t];
  const fence=t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) cands.push(fence[1].trim());
  /* v1.7.1 (Ty: "replies didn't generate. not an array"): the {...} slice ran BEFORE the [...] slice,
     so any preamble ahead of a reply ARRAY made the armor grab the first object INSIDE it — one
     object parsed fine, the array never got tried. The OUTERMOST structure goes first now. */
  const openers=["{","["].map(o=>({o,i:t.indexOf(o)})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i).map(x=>x.o);
  for (const open of openers){
    const i=t.indexOf(open); if(i<0) continue;
    const close=open==="{"?"}":"]";
    let d=0,inS=false,esc=false,end=-1;
    for(let k=i;k<t.length;k++){ const c=t[k];
      if(esc){esc=false;continue;}
      if(c==="\\"){ if(inS) esc=true; continue; }
      if(c==='"'){ inS=!inS; continue; }
      if(inS) continue;
      if(c===open)d++; else if(c===close){ d--; if(!d){ end=k; break; } }
    }
    if (end>0){ cands.push(t.slice(i,end+1)); continue; }
    // never closed: truncated output. Cut back to the last structurally-safe point, then close what's open.
    const cut=t.slice(i);
    let inS2=false,e2=false,lastSafe=0;
    for(let k=0;k<cut.length;k++){ const c=cut[k];
      if(e2){e2=false;continue;}
      if(c==="\\"){ if(inS2) e2=true; continue; }
      if(c==='"'){ inS2=!inS2; if(!inS2) lastSafe=k+1; continue; }
      if(inS2) continue;
      if(c==="}"||c==="]"||c===",") lastSafe=k+1;
    }
    const closeUp = b=>{ const st=[]; let iS=false,eS=false;
      for(const c of b){
        if(eS){eS=false;continue;}
        if(c==="\\"){ if(iS) eS=true; continue; }
        if(c==='"'){ iS=!iS; continue; }
        if(iS) continue;
        if(c==="{"||c==="[") st.push(c); else if(c==="}"||c==="]") st.pop();
      }
      return b + st.reverse().map(c=>c==="{"?"}":"]").join(""); };
    const base=cut.slice(0,lastSafe).replace(/,\s*$/,"");
    cands.push(closeUp(base));
    // a cut mid-string can leave a dangling `"key"` / `"key":` — trim it and close again
    cands.push(closeUp(base.replace(/,?\s*"[^"]*"\s*:?\s*$/,"")));
  }
  const escNl = x=>{ let o="",inS=false,esc=false;
    for(const c of x){
      if(esc){o+=c;esc=false;continue;}
      if(c==="\\"){o+=c;if(inS)esc=true;continue;}
      if(c==='"'){inS=!inS;o+=c;continue;}
      if(inS&&c==="\n")o+="\\n"; else if(inS&&c==="\r")o+="\\r"; else if(inS&&c==="\t")o+="\\t"; else o+=c;
    } return o; };
  const fixes=[x=>x, x=>x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,""), escNl, x=>escNl(x).replace(/,\s*([}\]])/g,"$1")];
  for (const cand of cands) for (const fx of fixes){ try{ return JSON.parse(fx(cand)); }catch(e){} }
  throw new Error("unparseable model output");
}
/* v1.6.7 (Ty: "bad JSON... and i have api credits"): the old wrapper relabeled EVERY failure —
   a 429/529/overloaded API blip on the retry call, or a response with zero text — as "bad JSON
   from model". Now: transient API errors get one automatic second try with a short backoff,
   empty responses say so, and a real parse failure reports the parser's reason plus the first
   characters of what the model actually sent. The status line tells the truth. */
const aiSleep = ms=>new Promise(r=>setTimeout(r,ms));
function aiTransient(e){ return /API (408|409|429|5\d\d)|overloaded|rate.?limit|returned no text|Failed to fetch|NetworkError|load failed/i.test(String(e&&e.message||e)); }
async function callAIRetry(system, user, maxTokens){
  /* v1.7.9 (Ty: "Midweek failed: Load failed"): "Load failed" is Safari's name for a network-level
     fetch death — connect refused OR a minutes-long stream cut by a weak signal / a backgrounded
     app. One retry wasn't enough when the connection is flaky; transient errors now get up to
     THREE attempts with growing backoff. Real API errors (auth, bad request) still throw at once. */
  let e0=null;
  for (let i=0;i<3;i++){
    try { return await callAI(system, user, maxTokens); }
    catch(e){ if (!aiTransient(e)) throw e; e0=e; if (i<2) await aiSleep(1500*(i+1)); }
  }
  throw e0;
}
async function aiJSON(system, user, maxTokens){
  const out = await callAIRetry(system, user, maxTokens);
  try { return parseModelJSON(out); }
  catch(e){
    const out2 = await callAIRetry(system, user + "\n\nIMPORTANT: your previous output was not valid JSON. Output ONLY the JSON object, no prose, no markdown fences, and keep it COMPACT enough to finish within the token limit.", maxTokens);
    try { return parseModelJSON(out2); }
    catch(e2){ throw new Error("unparseable JSON after a retry ("+String(e2.message||e2).slice(0,40)+"; reply starts \""+String(out2).slice(0,40).replace(/\s+/g," ")+"\u2026\")"); }
  }
}
/* v1.7.7: shared SSE reader — accumulates whatever `pick` extracts from each data: event.
   Falls back to parsing a whole non-stream body if the runtime has no stream reader. */
async function readSSE(r, pick){
  const eat = raw=>{ let out=""; for (const line of String(raw).split("\n")){ const t=line.trim(); if(!t.startsWith("data:")) continue; const d=t.slice(5).trim(); if(!d||d==="[DONE]") continue; try{ out+=pick(JSON.parse(d))||""; }catch(e){ if(/API stream error/.test(String(e&&e.message))) throw e; } } return out; };
  if (!r.body || !r.body.getReader){
    const raw=await r.text();
    const out=eat(raw); if (out) return out;
    try{ return pick(JSON.parse(raw))||""; }catch(e){ if(/API stream error/.test(String(e&&e.message))) throw e; return raw; }
  }
  const rd=r.body.getReader(); const dec=new TextDecoder(); let buf="", out="";
  for(;;){
    let done, value;
    /* v1.7.9: when the connection dies MID-stream, Safari throws the same bare "Load failed" as a
       failed connect. Here we know exactly what happened — name it (with how far it got) and keep
       the phrase transient so callAIRetry runs the whole call again. */
    try { ({done,value}=await rd.read()); }
    catch(e){ console.log("SSE stream cut after "+out.length+" chars", e); throw new Error("network cut mid-stream after "+out.length+" chars (load failed)"); }
    if(done) break;
    buf+=dec.decode(value,{stream:true});
    let i;
    while((i=buf.indexOf("\n"))>=0){ const line=buf.slice(0,i); buf=buf.slice(i+1); out+=eat(line); }
  }
  out+=eat(buf);
  return out;
}
async function callAI(system, user, maxTokens){
  const prov = META.settings.provider||"anthropic";
  const model = META.settings.model || D.AI[prov].models[0];
  if (!D.AI[prov].models.includes(model)) {/* model from another provider selected */ }
  /* v1.7.7 (Ty: "midweek and refresh world syncs aren't working even though i have api credits"):
     root cause candidate found in the numbers — the world call asks for up to 16,000 output tokens
     in ONE non-streaming request. That runs for minutes with zero bytes on the wire, and mobile
     Safari (and plenty of networks) kill an idle fetch around the one-minute mark, so exactly the
     two LONGEST calls die while every quick call (pregame, replies) works fine. Big calls now
     STREAM: bytes flow the whole time, nothing sits idle, same text comes out the other end. */
  if (prov==="anthropic"){
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":aiKey(),
        "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
      body: JSON.stringify({ model: D.AI.anthropic.models.includes(model)?model:"claude-sonnet-5", max_tokens: maxTokens||8000,
        stream:true, system, messages:[{role:"user", content:user}] })
    });
    if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
    let stopA=null;
    const txt = await readSSE(r, ev=>{
      if (ev.type==="error") throw new Error("API stream error: "+String(ev.error&&ev.error.message||"").slice(0,120));
      if (ev.type==="message_delta" && ev.delta && ev.delta.stop_reason) stopA=ev.delta.stop_reason;
      if (ev.type==="content_block_delta" && ev.delta && ev.delta.type==="text_delta") return ev.delta.text;
      if (ev.type==="message" && ev.content) return (ev.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n"); // non-stream body fell through readSSE fallback
      return "";
    });
    if (!txt.trim()) throw new Error("model returned no text"+(stopA? " (stop: "+stopA+")":""));
    return txt;
  }
  if (prov==="openai"){
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+aiKey() },
      body: JSON.stringify({ model: D.AI.openai.models.includes(model)?model:"gpt-5.6-terra", max_tokens: maxTokens||8000,
        stream:true, messages:[{role:"system",content:system},{role:"user",content:user}] })
    });
    if (!r.ok){ const e=await r.text(); throw new Error("API "+r.status+": "+e.slice(0,120)); }
    const txt = await readSSE(r, ev=> ev.choices?.[0]?.delta?.content || ev.choices?.[0]?.message?.content || "");
    if (!txt.trim()) throw new Error("model returned no text");
    return txt;
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
  const gtxt=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("\n");
  if (!gtxt.trim()) throw new Error("model returned no text"+(data.candidates?.[0]?.finishReason? " (stop: "+data.candidates[0].finishReason+")":""));
  return gtxt;
}
const callClaude = callAI; // legacy alias
/* v1.6 (Ty #11): ONE per-position stat map for the whole phone. Every defensive spot gets
   its own ordered list (a corner leads with picks and deflections, an edge with sacks)
   instead of one lumped "defense" set; My Season and the AI's stat truth both read this. */
const POSFIELDS={
  QB:["PASSYARDS","PASSTDS","PASSINTS","PASSCOMPLETED","PASSATTEMPTS","PASSSACKED","RUSHYARDS","RUSHTDS"],
  HB:["RUSHYARDS","RUSHTDS","RUSHATTEMPTS","RUSHLONGEST","RECEIVECATCHES","RECEIVEYARDS","RECEIVETDS","RUSHFUMBLES"],
  FB:["RUSHYARDS","RUSHTDS","RECEIVECATCHES","RECEIVEYARDS","OLINEPANCAKES"],
  WR:["RECEIVECATCHES","RECEIVEYARDS","RECEIVETDS","RECEIVELONGEST","RECEIVEDROPS","RUSHYARDS"],
  TE:["RECEIVECATCHES","RECEIVEYARDS","RECEIVETDS","RECEIVELONGEST","OLINEPANCAKES"],
  LT:["OLINEPANCAKES","OLINESACKSALLOWED"],LG:["OLINEPANCAKES","OLINESACKSALLOWED"],C:["OLINEPANCAKES","OLINESACKSALLOWED"],RG:["OLINEPANCAKES","OLINESACKSALLOWED"],RT:["OLINEPANCAKES","OLINESACKSALLOWED"],
  LE:["DLINESACKS","DEFTACKLES","DEFTACKLESFORLOSS","DLINEFORCEDFUMBLES","DLINEHALFSACK","BIGHITS"],
  RE:["DLINESACKS","DEFTACKLES","DEFTACKLESFORLOSS","DLINEFORCEDFUMBLES","DLINEHALFSACK","BIGHITS"],
  DT:["DEFTACKLES","DLINESACKS","DEFTACKLESFORLOSS","ASSDEFTACKLES","DLINEFORCEDFUMBLES"],
  LOLB:["DLINESACKS","DEFTACKLES","DEFTACKLESFORLOSS","DEFPASSDEFLECTIONS","DLINEFORCEDFUMBLES"],
  ROLB:["DLINESACKS","DEFTACKLES","DEFTACKLESFORLOSS","DEFPASSDEFLECTIONS","DLINEFORCEDFUMBLES"],
  OLB:["DLINESACKS","DEFTACKLES","DEFTACKLESFORLOSS","DEFPASSDEFLECTIONS","DLINEFORCEDFUMBLES"],
  MLB:["DEFTACKLES","ASSDEFTACKLES","DEFTACKLESFORLOSS","DLINESACKS","DEFPASSDEFLECTIONS","DSECINTS"],
  LB:["DEFTACKLES","ASSDEFTACKLES","DEFTACKLESFORLOSS","DLINESACKS","DEFPASSDEFLECTIONS"],
  CB:["DSECINTS","DEFPASSDEFLECTIONS","DEFTACKLES","DSECINTTDS","DLINEFORCEDFUMBLES"],
  FS:["DSECINTS","DEFTACKLES","DEFPASSDEFLECTIONS","BIGHITS","DLINEFORCEDFUMBLES"],
  SS:["DEFTACKLES","DSECINTS","DEFPASSDEFLECTIONS","BIGHITS","DEFTACKLESFORLOSS"],
  K:["KICKFGMADE","KICKFGATTEMPTS","KICKFGLONGEST","KICKEPMADE","KICKEPATTEMPTS"],
  P:["PUNTATTEMPTS","PUNTYARDS","PUNTIN20","PUNTLONGEST","PUNTNETYARDS"]
};
function posStatFields(pos){ return POSFIELDS[pos] || ["DEFTACKLES","DLINESACKS","DSECINTS","DEFPASSDEFLECTIONS","DLINEFORCEDFUMBLES"]; }
const STATLBL={PASSYARDS:"pass yds",PASSTDS:"pass TD",PASSINTS:"INT thrown",PASSCOMPLETED:"comp",PASSATTEMPTS:"att",PASSSACKED:"sacked",RUSHYARDS:"rush yds",RUSHTDS:"rush TD",RUSHATTEMPTS:"carries",RUSHLONGEST:"long run",RUSHFUMBLES:"fumbles",RECEIVECATCHES:"rec",RECEIVEYARDS:"rec yds",RECEIVETDS:"rec TD",RECEIVELONGEST:"long catch",RECEIVEDROPS:"drops",DEFTACKLES:"tackles",ASSDEFTACKLES:"asst tackles",DEFTACKLESFORLOSS:"TFL",DLINESACKS:"sacks",DLINEHALFSACK:"half sacks",DSECINTS:"INT",DSECINTTDS:"pick six",DEFPASSDEFLECTIONS:"PD",DLINEFORCEDFUMBLES:"FF",BIGHITS:"big hits",OLINEPANCAKES:"pancakes",OLINESACKSALLOWED:"sacks allowed",KICKFGMADE:"FG made",KICKFGATTEMPTS:"FG att",KICKFGLONGEST:"long FG",KICKEPMADE:"XP",KICKEPATTEMPTS:"XP att",PUNTATTEMPTS:"punts",PUNTYARDS:"punt yds",PUNTNETYARDS:"net punt yds",PUNTIN20:"inside 20",PUNTLONGEST:"long punt",GAMESPLAYED:"GP",GAMESSTARTED:"GS"};
/* v1.6: the world engine gets the player's REAL position-relevant season numbers instead
   of inventing them. Zero games played says so explicitly. */
function myStatLine(blob){
  const merged={};
  for (const st of (blob.seasonStats||[])) for (const k in st){ if (k!=="table" && typeof st[k]==="number") merged[k]=Math.max(merged[k]||0, st[k]); }
  const gp=merged.GAMESPLAYED||0;
  if (!gp) return "SEASON STATS (save truth): no games played yet this season; do not invent statistics for him.";
  const parts=[gp+" GP", (merged.GAMESSTARTED||0)+" GS"];
  for (const f of posStatFields(blob.player.pos)){ if (merged[f]) parts.push(merged[f]+" "+(STATLBL[f]||f.toLowerCase())); }
  return "SEASON STATS (save truth, this season, "+blob.player.pos+"-relevant): "+parts.join(", ")+". Never contradict these numbers.";
}
/* v1.6.2 (Ty: "if i practice bad will the coach automatically demote me?"): the staff has
   a temper WITHOUT the unseen hand \u2014 but only in words. Low practice effort or a messy
   public week draws threats, closed-door meetings, trade whispers, bench talk from media
   and coaches. The HARD LINE: the world may threaten and fume, but it must never claim a
   depth chart move, benching, or roster change actually HAPPENED \u2014 the save decides that,
   and it arrives on the next sync (or through a coach order). */
/* =====================================================================================
   v1.6.3 — THE COACH ACTS (Ty: "You are the coach. I am just a player.")
   The staff makes real decisions on its own: fines land on the ledger instantly; benchings
   and demotions are announced in the world AND queued as a ready-made staff order code
   (same TYORD1 the exe enforces) so the save catches up on the next paste+sync. The unseen
   hand still exists for when the player WANTS to steer; this runs regardless, unless the
   Settings toggle turns it off.
   ===================================================================================== */
function staffState(){ S.staff = S.staff || {orders:[], log:[], ruled:{}}; return S.staff; }
function staffAutoOn(){ return S.staffAuto!==false; }
function conductHot(){
  const recent=(S.chirp&&S.chirp.posts||[]).slice(-3).map(p=>p.t||"").join(" ").toLowerCase();
  return /trash|garbage|clown|terrible|hate|fire (him|the)|refs|cheated|quit|refus|sit(ting)? out|won'?t play|not playing|trade me/.test(recent);
}
/* v1.7.0 (Ty: "posted that i refused to play... nothing happened"): an outright public refusal
   to play, quitting talk, or demanding out is SEVERE conduct — the coach acts on it no matter
   what the practice dials say. Returns the offending post text or null. */
function conductSevere(){
  for (const post of (S.chirp&&S.chirp.posts||[]).slice(-3)){
    const t=(post.t||"").toLowerCase();
    if (/(refus\w* to play|not playing (on|this|friday|sunday|for (him|that man|this (coach|team)))|won'?t play|would ?n'?t play|never playing for|done playing for|sit(ting)? out (the|this)|rather sit than play|sit than play for|refuse to practice|quit(ting)? (the )?(nfl|football|this team)|i'?m done with (the|this) (team|nfl)|trade me)/.test(t)) return post.t;
  }
  return null;
}
/* v1.7.3 (Ty: "coach is trash" post drew nothing): trashing the head coach in PUBLIC is a fine
   on its own, no bad practice week required. Refusal talk stays the bigger crime (bench + fine). */
function conductBlast(){
  for (const post of (S.chirp&&S.chirp.posts||[]).slice(-3)){
    const t=(post.t||"").toLowerCase();
    if (/((the |this |my )?coach(ing staff)? is (trash|garbage|a clown|a joke|a fraud|terrible)|fire (him|the coach|coach)|can'?t stand (the |this )?coach|hate (playing for|the) coach)/.test(t)) return post.t;
  }
  return null;
}
/* v1.7.4 (Ty's screenshot: "we drafted a QB" replied to an UNDRAFTED player): the reply
   prompts carried zero draft truth, so accounts invented one. Draft story is save truth
   (draftRound 63 / <1 = undrafted; same mapping the perception seed uses). */
function draftStory(){
  const p=S.blob.player;
  if (p.draftRound==null) return "";
  if (p.draftRound>=63||p.draftRound<1) return " He went UNDRAFTED — no team spent a pick on him.";
  return " He was drafted in round "+p.draftRound+(p.draftPick?" (pick "+p.draftPick+")":"")+(p.yearDrafted?" of "+p.yearDrafted:"")+".";
}
/* v1.7.4 (Ty: "film room wouldn't talk like that") — every reply must sound like WHO wrote
   it and obey the save facts. */
function accountVoiceLaw(){
  const mates=S.blob.roster.slice(0,14).map(r=>r[0]+" "+r[1]).join(", ");
  return "ACCOUNT VOICE LAW: each reply must read like the account that wrote it AND obey the career facts. A team film/analysis account talks tape and roster facts in measured analyst register (no bro-speak); a beat reporter reports and asks; an official team account is corporate or absent; a rival fan taunts; a regular fan reacts like a fan; a podcast plugs its take. A reply from a TEAMMATE must use a real name from: "+mates+". NOBODY contradicts the facts: an undrafted player is never called a pick or 'drafted', a player with zero NFL snaps has no pro tape to break down beyond camp, and no account knows anything the facts do not say.";
}
function careerFactsLine(){
  const p=S.blob.player; const c=S.blob.clock||{};
  let gp=0; try{ gp=seasonGP(); }catch(e){}
  return "HARD CAREER FACTS (never contradict, NEVER invent starts, stats, games, or seasons beyond these): it is "+wkLabel(c)+", "+(c.seasonYear||"")+". He is a "+(p.yearsPro===0?"rookie":p.yearsPro+"-year pro")+" with "+gp+" games played this season"+(p.yearsPro===0?" and ZERO career NFL games or starts before it":"")+"."+draftStory()+" Roster: "+rosterLabel()+".";
}
/* v1.7.7 (Ty: "practice effort 2/10 was displayed on an email... should just be mentioned as
   being poor or great"): the number is his own dial; the building talks in words. */
function effortWord(n){
  n=+n||0;
  return n<=1? "a no-show" : n<=2? "poor" : n<=4? "below the building's standard" : n<=6? "average" : n<=8? "good" : "excellent";
}
function coachName(){ const c=S.blob&&S.blob.player&&S.blob.player.coach; return c? "Coach "+c.split(" ").pop() : "Head Coach"; }
/* v1.7.6 (Ty's ruling): the player NEVER talks directly to coaches by text at this time. When any
   staff member — coach, GM, assistant GM, owner, position coach — reaches out directly, it arrives
   as EMAIL from the club, one-way (T-Mail has no reply). The old coach text thread is retired and
   swept from existing careers at boot. */
function clubMail(subj, body, from){
  /* v1.9.0 (Ty's ruling): agentless — self-represented or pre-pick — club mail drops the
     route-through-representation clause; "This notice is one-way." stands. ONE door. */
  if (!S.agent || S.agent.id==="self") body=String(body).split("; direct any response through your representation").join("");
  const e={id:"fo"+Date.now()+Math.floor(Math.random()*900), from: from || ((S.blob&&S.blob.player&&S.blob.player.team||"Club")+" Football Operations"), subj, ts:Date.now(), unread:true, body};
  S.world.emails=S.world.emails||[]; S.world.emails.unshift(e);
  return e;
}
function dropCoachThread(){ if (S&&S.world&&S.world.texts) S.world.texts=S.world.texts.filter(t=>t.id!=="coach"&&t.id!=="equip"); }   /* v1.7.7: equipment room retired from texts too */
function pruneEmptyReplies(){
  const sweep=list=>{ for (const c of (list||[])) if (c && Array.isArray(c.replies)) c.replies=c.replies.filter(r=>r&&String(r.x||"").trim()); };
  sweep(S.chirp&&S.chirp.posts); sweep(S.world&&S.world.chirps);
}
function coachEvaluate(trigger){
  if (!staffAutoOn() || !S.blob) return null;
  const st=staffState(); const wk=wkKey(S.blob.clock); const b=betaDials(); const hot=conductHot();
  const key=k=>wk+"|"+k;
  let ruling=null;
  const sev=conductSevere();
  if (sev && !st.ruled[key("conduct")])
    ruling={kind:"conduct", why:"a public refusal to play", post:sev};
  else if ((b.practice<=1 || (b.practice<=2 && hot)) && !st.ruled[key("bench")])
    ruling={kind:"bench", why: b.practice<=1? "practice effort was "+effortWord(b.practice) : "practice effort was "+effortWord(b.practice)+", with the public noise on top"};
  else if (b.practice<=2 && !st.ruled[key("demote")])
    ruling={kind:"demote", why:"practice effort was "+effortWord(b.practice)+" all week"};
  else if (conductBlast() && !st.ruled[key("fine")])
    ruling={kind:"fine", why:"publicly calling out the head coach", post:conductBlast()};
  else if (hot && b.practice<=4 && !st.ruled[key("fine")])
    ruling={kind:"fine", why:"conduct detrimental to the club"};
  if (!ruling) return null;
  st.ruled[key(ruling.kind)]=Date.now();
  const nm=S.blob.player.first+" "+S.blob.player.last;
  if (ruling.kind==="conduct"){
    // v1.7.0: he said it in public, so it costs money AND the spot. Fine now, benching order queued.
    const gross=grossFor(S.blob.player.status, S.blob.player);
    const amt=Math.max(5000, Math.round(gross*0.10/500)*500);
    S.cash.checking-=amt; S.ledger.push({t:"Club fine — conduct detrimental ("+coachName()+")", amt:-amt, kind:"expense"});
    /* v1.12.0 (the writeback expansion): benching = OFF the depth rows — the exe depthoff
       order clears him from every list (not dressing), the honest write the slot-3 stand-in
       always approximated. */
    const order={type:"depthoff", player:{name:nm}};
    st.orders.push({id:"st"+Date.now(), wk, kind:"bench", why:ruling.why, order, ts:Date.now()});
    st.log.unshift({wk, kind:"conduct", amt, why:ruling.why, ts:Date.now()});
    selfRepFallout(ruling);   /* v1.9.0: self-represented — the newest endorsement walks, by email */
    clubMail("Notice of Club Discipline \u2014 Fine and Deactivation",
      'This is formal notice from the club. Regarding your public post ("'+String(ruling.post).slice(0,120)+'"), '+coachName()+' has ruled it conduct detrimental to the club. A fine of '+fm(amt)+' has been assessed against your account, and you have been removed from this week\'s lineup by staff decision. The fine stands whether or not the post is deleted. This notice is one-way; direct any response through your representation.');
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Club notice: "+fm(amt)+" fine + benched \u2014 order waiting in Sync"});
    odNotice();
    persist();
    return ruling;
  }
  if (ruling.kind==="fine"){
    const gross=grossFor(S.blob.player.status, S.blob.player);
    const amt=Math.max(5000, Math.round(gross*0.10/500)*500);
    S.cash.checking-=amt; S.ledger.push({t:"Club fine — conduct detrimental ("+coachName()+")", amt:-amt, kind:"expense"});
    st.log.unshift({wk, kind:"fine", amt, why:ruling.why, ts:Date.now()});
    clubMail("Notice of Club Fine \u2014 Conduct Detrimental",
      ruling.post
      ? 'This is formal notice from the club. Regarding your public post ("'+String(ruling.post).slice(0,120)+'"), '+coachName()+' has assessed a fine of '+fm(amt)+' for conduct detrimental to the club. The amount has been deducted from your account. This notice is one-way; direct any response through your representation.'
      : 'This is formal notice from the club. '+coachName()+' has assessed a fine of '+fm(amt)+' for conduct detrimental to the club ('+ruling.why+'). The amount has been deducted from your account. This notice is one-way; direct any response through your representation.');
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"tmail", t:"Football Operations", p:"Club fine "+fm(amt)+" \u2014 conduct detrimental"});
    odNotice();
  } else {
    /* v1.12.0: a benching clears every depth row (depthoff); a demotion stays a slot-2 call. */
    const order = ruling.kind==="bench"? {type:"depthoff", player:{name:nm}} : {type:"depth", player:{name:nm}, pos:S.blob.player.pos, slot:2};
    st.orders.push({id:"st"+Date.now(), wk, kind:ruling.kind, why:ruling.why, order, ts:Date.now()});
    st.log.unshift({wk, kind:ruling.kind, why:ruling.why, ts:Date.now()});
    clubMail("Roster Decision \u2014 "+wkLabel(S.blob.clock),
      (ruling.kind==="bench"
        ? 'This is formal notice from the club. By decision of '+coachName()+', you will not dress for this week\'s game ('+ruling.why+'). The corresponding depth order has been filed.'
        : 'This is formal notice from the club. By decision of '+coachName()+', you have been moved to the second unit ('+ruling.why+'). The corresponding depth order has been filed.')
      +' This notice is one-way; direct any response through your representation.');
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"tmail", t:"Football Operations", p:(ruling.kind==="bench"?"Roster decision: not dressing this week":"Roster decision: demoted on the depth chart")+" \u2014 order waiting in Sync"});
  }
  persist();
  return ruling;
}
function staffOrdersCode(){ const st=staffState(); return "TYORD1"+JSON.stringify({orders:st.orders.map(o=>o.order)}); }
function staffDismiss(id){ const st=staffState(); st.orders=st.orders.filter(o=>o.id!==id); persist(); renderApp("sync"); }
function staffLine(){
  const st=staffState();
  const recent=st.log.filter(l=>Date.now()-l.ts < 21*24*3600*1000).slice(0,4);
  if (!recent.length) return "";
  return "\nSTAFF RULINGS (the coach's real decisions, treat as announced fact): "+recent.map(l=>
    (l.kind==="fine"? "fined "+fm(l.amt) : l.kind==="bench"? "benched" : "demoted on the depth chart")+" ("+l.wk.split("/").slice(1).join(" wk ")+"; "+l.why+")").join("; ")+
    ". These are made and announced; the depth chart itself updates when the week processes. NEVER invent additional moves beyond these.";
}
function disciplineLine(){
  const b=betaDials();
  const eff=b.practice!=null? b.practice : 5;
  const heat=[];
  if (eff<=2) heat.push("his practice effort has been genuinely bad ("+eff+"/10) \u2014 the staff is visibly losing patience; coaches and beat writers may openly float demotion or benching AS TALK");
  else if (eff<=4) heat.push("practice effort is below standard ("+eff+"/10) \u2014 pointed comments from the staff are fair game");
  const recent=(S.chirp&&S.chirp.posts||[]).slice(-3).map(p=>p.t||"").join(" ").toLowerCase();
  if (/trash|garbage|clown|terrible|hate|fire (him|the)|refs|cheated/.test(recent)) heat.push("his recent public posts ran hot \u2014 the locker room and front office noticed, and consequences can be THREATENED in texts, pressers, and articles");
  if (!heat.length) return "";
  return "\nSTAFF TEMPERATURE: "+heat.join("; ")+". Threats, closed-door meetings, and media speculation are fair game. Actual moves exist ONLY under STAFF RULINGS \u2014 never invent a benching, demotion, or roster change beyond those.";
}
/* v1.6.1: head-coach truth from the save. Vacancies are real state — a fired coach
   leaves an OPEN job, and the world should talk about the search, not invent a name. */
function coachLine(blob){
  const cs=blob.coaches;
  if (!cs || !Object.keys(cs).length) return "";
  const mine = blob.player.coach || cs[blob.player.team];
  const vac = Object.keys(D.METROS).filter(t=>!cs[t]);
  let out = "\nHEAD COACHES (save truth; NEVER invent or replace head-coach names): ";
  out += mine? ("his coach is "+mine+" ("+blob.player.team+"). ") : ("his team ("+blob.player.team+") has an OPEN head-coaching job right now. ");
  out += "League: "+Object.entries(cs).filter(([t])=>t!==blob.player.team).map(([t,n])=>t+"="+n).join(", ")+".";
  if (vac.length) out += " VACANT head-coaching jobs (talk about the search, never fill them yourself): "+vac.join(", ")+".";
  return out;
}
/* v1.6.1: the league's championship record, straight from YearSummary */
function champLine(blob){
  const h=blob.history;
  if (!h || !h.length) return "";
  const ck=blob.clock||{};
  const base=(ck.seasonYear||2026)-(ck.seasonIndex||0);
  return "\nCHAMPIONSHIP HISTORY (save truth; never contradict): "+h.map(x=>(base+x.season)+" "+x.champ+" over "+x.runnerUp+" "+x.hs+"-"+x.as+(x.mvp?" (SB MVP "+x.mvp+")":"")).join("; ")+".";
}
function awardsLine(blob){
  const aw=(blob.awards||[]).filter(a=>a&&a.type);
  if (!aw.length) return "";
  const ck=blob.clock||{};
  const base=(ck.seasonYear||2026)-(ck.seasonIndex||0);
  /* live-save truth (v1.6.1): weekly awards store the WEEK in PeriodIndex, so they
     aggregate into counts; season awards store seasonIndex (or a real calendar year
     for seeded pre-franchise history) and get a year. */
  const weekly={}, season=[];
  for (const a of aw){
    if (/_of_Week$/i.test(a.type)) weekly[a.type]=(weekly[a.type]||0)+1;
    else season.push(a.type.replace(/_/g," ")+(a.season!=null? " ("+(a.season<100? base+a.season : a.season)+")" : ""));
  }
  const parts=[...season, ...Object.entries(weekly).map(([t,n])=>t.replace(/_/g," ")+(n>1?" \u00d7"+n:""))];
  return "\nCAREER AWARDS (save truth): "+parts.join("; ")+".";
}
function worldFacts(blob, last){
  const p=blob.player; const per=S.perception;
  /* v1.7.7: one throwing facts line used to take the ENTIRE midweek/world call down with it.
     Every line is fenced now; a failure logs its name (console + S.wfErrs) and yields "". */
  const SL=(fn,name)=>{ try{ return fn()||""; }catch(e){ try{ console.log("worldFacts line failed: "+name, e); (S.wfErrs=S.wfErrs||[]).push(name+": "+String(e&&e.message||e).slice(0,70)); S.wfErrs=S.wfErrs.slice(-8); }catch(_){} return ""; } };
  return `TODAY (in-world): ${gameDateLong(blob.clock)}, ${wkLabel(blob.clock)}. All content you write happens NOW; anything from earlier weeks or seasons is the past.
HARD RULES: The ONLY real people who may appear are players and coaches named in these facts. NEVER use real-world journalists, media personalities, insiders, or celebrities (no real beat writers, nobody like Rich Cimini or Adam Schefter). Real TV networks (ESPN, FOX, CBS, NBC, Prime) may be mentioned ONLY as the broadcast a game airs on ("caught it on the FOX broadcast"); they never produce written content, stats, quotes, or personalities here. Every reporter, outlet, fan, and brand voice must be invented (the United Chronicle is a NATIONAL NFL paper — no local paper exists, no team is its home team — and it has MULTIPLE staff writers — vary which invented byline covers what, no single house writer; NFLSN is the stats network).
STAFF CHANNEL LAW: team staff — the head coach, coordinators, position coaches, the GM, assistant GM, front office, the owner — NEVER text the player and have no text thread. Any direct staff outreach arrives only as a one-way club EMAIL the player cannot answer. Text threads belong to teammates, family, the agent, and friends only; never write a staff member into a text thread.
REAL-PLAYER SPEECH LAW: real players (anyone on a save roster) never initiate controversy, never comment on politics, religion, or anyone's personal life, and never say anything about a third party that is not about football performance. Invented people are not bound by this.
${SL(practiceLine,"practiceLine")}\nPLAYER (save truth): ${p.first} ${p.last}, ${p.pos}, ${p.team}, jersey #${p.jersey}, age ${p.age}, overall ability ${p.ovr}/99 (${p.ovr>=90?"elite talent":p.ovr>=80?"quality starter talent":p.ovr>=70?"fringe/backup talent":p.ovr>=55?"longshot talent":"camp-body talent"}), status ${p.status}${p.isIR?" (IR)":""}, confidence ${p.confidence}/99.
CLOCK: ${wkLabel(blob.clock)}.
LAST RESULT: ${last? (last[4]?"home vs ":"away at ")+last[3]+", "+last[7][0]+"-"+last[7][1]+(last[7][0]>last[7][1]?" WIN":" LOSS") : "none"}.
NEXT: ${(()=>{const n=nextGame(); return n? (n[4]?"home vs ":"at ")+n[3]+" ("+n[5]+")":"unknown"})()}.
KEY TEAMMATES: ${blob.roster.slice(0,10).map(r=>r[0]+" "+r[1]+" ("+r[2]+" #"+r[4]+")").join(", ")}.
POSITION ROOM (${p.pos}): ${blob.roster.filter(r=>r[2]===p.pos).map(r=>r[0]+" "+r[1]).join(", ")||"n/a"}.
MONEY: ${p.status==="PracticeSquad"? "practice squad $6,222/wk" : "active roster, "+fm(Math.round((((p.contract||{}).salary||[])[(p.contract||{}).currentYear||0] ?? p.capSalary)/18))+"/wk"}; checking ${fm(S.cash.checking)}; runway ${runwayWeeks()} weeks.
PERCEPTION (who the world believes he is): ${per.draft||"Undrafted"}, grew up ${per.grew||"unknown"} in ${per.state||"?"}, HS: ${per.hs||"unranked"}, college: ${per.college||"unknown"}, family: ${per.family||"unknown"}${per.familyAsk?", sends home "+fm(per.familyAsk)+"/mo":""}${per.debtTotal?", carrying "+fm(per.debtTotal)+" of personal debt ("+(per.debtShares? D.DEBTCATS.filter((c,i)=>per.debtShares[i]>0).join(", "):"mixed")+((per.debtShares||[])[3]>0&&per.autoLoanCar? "; the auto loan is on a "+per.autoLoanCar:"")+")":""}. Public reputation: ${per.rep||"Complete unknown"}. ${SL(saveNoticesLine,"saveNoticesLine")} ${SL(markerLine,"markerLine")} ${SL(myPostsLine,"myPostsLine")} FOLLOWERS on Chirper: ${S.chirp?S.chirp.followers.toLocaleString():"n/a"} (${buzzTier(S.chirp?S.chirp.followers:0)}).
${SL(familyLine,"familyLine")}
${SL(()=>myStatLine(blob),"myStatLine")}${SL(()=>awardsLine(blob),"awardsLine")}${SL(()=>coachLine(blob),"coachLine")}${SL(()=>champLine(blob),"champLine")}${SL(disciplineLine,"disciplineLine")}${SL(staffLine,"staffLine")}${SL(requestsLine,"requestsLine")}${SL(arrivalLine,"arrivalLine")}${SL(travelLine,"travelLine")}${SL(famSeatsLine,"famSeatsLine")}${SL(pressersLine,"pressersLine")}${SL(midAvailLine,"midAvailLine")}${SL(freshLine,"freshLine")}`;
}
/* v1.7.9 THE CHRONICLE ROOT CAUSE (Ty: "still says no stories on your career yet"): the game story
   existed ONLY inside the weekly sync's article pass. His wk1→wk2 sync ran on the pre-streaming
   build — the 8,000-token article call died with the same timeout class that killed his midweek —
   and every path since skips articles on purpose: "Refresh world" is noArticle by design, and
   re-pasting the code is a same-week truth refresh that generates nothing. A failed story was
   PERMANENTLY unwritable. The story is its own function now: the sync calls it, S.articleFor
   remembers which games got theirs, and the Chronicle offers to write any story still owed. */
function gkey(g){ return g[2]+"|"+g[1]+"|"+g[0]; }
/* owed = a played game with no story on a synced career. v1.12.2 (Ty: no "play the game
   first"): the first sync generates now (addCareer runs eager gen), so the old appliedWeeks>1
   fence — built when adoption wrote nothing and pre-adoption games weren't owed — would leave
   a FAILED first story permanently unwritable. Any synced career (appliedWeeks>=1) is owed. */
function storyOwed(){ const l=lastPlayed(); return (l && (S.appliedWeeks||[]).length>=1 && !(S.articleFor||{})[gkey(l)])? l : null; }
function storySys(wByline){
  /* v1.8.1 Lane C: the story register lives in ONE place so the phone call and the
     computer job carry the identical instruction. */
  return `You are ${wByline}, a staff writer for the United Chronicle, a serious NATIONAL NFL newspaper — there is no local paper and no home team in this newsroom. Write a FEATURE-LENGTH game story in professional newspaper register: third person, reported past tense, attributed quotes, scene-setting, tactical detail invented plausibly around the real final score. THE PAPER IS NATIONAL: the week's feature leads with whatever around the NFL genuinely deserves the lead — the subject player's game is one line on a 16-game scoreboard and earns coverage strictly proportional to its league-wide interest (an unremarkable preseason result may get a sentence, or nothing). When his game IS covered, cover it as a game: both teams, the stakes, the stars who actually decided it — never as the subject player's story. The subject player earns column inches ONLY if his real stat line in the facts did — a camp body who barely played may go entirely unmentioned, and that is correct. THE PIECE COVERS BOTH SIDES OF THE WEEK, roughly half and half: the front half reports the game and the league's results; the back half turns to the week ahead — the coming matchup, what it asks of both teams, and the storylines brewing around the NFL. One continuous piece, no section headers. 10 to 14 substantial paragraphs, 900 to 1300 words total. NEVER address the reader, never use "you" or "we" or "folks", no slang, no hedging chatter, no talking to a buddy. AP-style sports journalism. No em dashes anywhere. If THE PRESSER facts carry the player's actual podium answers, every quote from HIM about this game must come from those answers (verbatim or tight paraphrase, attributed namelessly per the presser law); if he gave none, do not put him at a podium at all. HIS RECENT PUBLIC POSTS in the facts are real public statements and may be quoted as social-media comment, never as podium answers. The subject player is only as famous as the facts imply. Only players and coaches from the facts may be named as real people; every other person quoted must be invented (scouts, assistants, fans by name and neighborhood). Output STRICT JSON only, no fences: {"kick":"section kicker","head":"headline","stand":"one-sentence standfirst","by":"","paras":["..."],"pq":"one strong pull quote from the piece"}`;
}
function intakeGameStory(art, byline, wkLbl, gk){
  /* v1.8.1: the story's intake is ONE door — the phone's own call and the computer's
     returned text both land here, so the byline/credit laws can never fork. */
  if (!(art && art.paras && art.paras.length)) throw new Error("the model returned no story");
  art.by=byline+" \u00b7 United Chronicle Sports"; art.wk=wkLbl; art.ts=Date.now();
  S.world.articles.unshift(art);
  S.articleFor=S.articleFor||{}; if (gk) S.articleFor[gk]=1;
  persist();
  return art;
}
async function writeGameStory(blob, last){
  const wByline = chronWriter("game"+wkKey(blob.clock));
  const art = await aiJSON(storySys(wByline), worldFacts(blob,last)+"\n\nWrite the game story now.", 8000);
  return intakeGameStory(art, wByline, wkLabel(blob.clock), last? gkey(last):null);
}
let chronBusy=false;
async function queueStoryJob(last){
  /* v1.8.2: the owed game story is a heavyweight too — the computer's key covers it. This
     was the one no-key gate the v1.8.1 sweep missed: keyless lane C hit a dead-end toast. */
  const wk=wkKey(S.blob.clock);
  if (S.mailJobs && S.mailJobs.wk===wk){ toast("Writing is already on the computer's desk. Run the phone jobs there and tap Check."); return; }
  const byline=chronWriter("game"+wk);
  try{
    await mailSendJobs([{id:"art", max:8000, sys:storySys(byline), user:worldFacts(S.blob,last)+"\n\nWrite the game story now."}], {kind:"story", wk, gk:gkey(last), byline});
    toast("Story sent to the computer. Run the phone jobs there, then tap Check.");
    if(curApp==="chron") renderApp("chron");
  }catch(e){ toast("Mailbox send failed: "+String(e.message||e).slice(0,90)); }
}
async function chronRetry(){
  const l=storyOwed(); if(!l) return;
  if (!aiKey()){
    if (laneCOn()) return queueStoryJob(l);   // v1.8.2: keyless lane C sends the story to the computer's pen
    return toast("Add an API key in Sync first.");
  }
  if (chronBusy) return;
  chronBusy=true; if(curApp==="chron") renderApp("chron");
  try{ await writeGameStory(S.blob, l); toast("The story ran."); }
  catch(e){ toast("Story failed: "+e.message); }
  chronBusy=false; if(curApp==="chron") renderApp("chron",{a:0});
}
async function generateWeek(blob, last, opts){
  opts=opts||{};
  if (laneCOn() && !opts.local) return queueWorldJobs(blob, last, opts);   // v1.8.1 LANE C: the heavy writing rides the mailbox
  toast("Generating the week's world…");
  // v1.4: the article is its OWN call with its own register. Inside the world JSON it came out
  // short and chatty (Ty: "read like the writer was talking to a buddy"). A newspaper feature
  // deserves a dedicated pass; the world call always runs article-free now.
  if (!opts.noArticle){
    try{ await writeGameStory(blob, last); }
    catch(e){
      /* v1.7.9 (Ty: "chronicle refuses to generate"): a failed story pass used to vanish into this
         toast AND be unrecoverable — Refresh skips articles by design, a same-week code adopts
         truth without generating. Now the failure leaves a persistent notif and the Chronicle
         itself can retry the story it's still owed. */
      S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"chron", t:"Chronicle", p:"The game story didn't write — open Chronicle to retry"});
      persist(); toast("Article pass failed ("+e.message+"). World continues.");
    }
  }
  const sys = worldSys(opts);
  let j;
  try { j = await aiJSON(sys, worldFacts(blob,last)+"\n\nWrite this week's world.", 16000); }
  catch(e){ throw new Error("world call failed: "+String(e.message||e).slice(0,140)); }
  intakeWorld(j, wkLabel(blob.clock), last? gkey(last):null, opts);
}
function worldSys(opts){
  /* v1.13.0 fullWeek: the ONE world call covers the WHOLE week — the reaction to the last
     game AND the practice week ahead (the both-sides law the article and episode already
     obey). The separate midweek beat is dead for keyed phones; its look-ahead texture and
     myReplies live here now. */
  const fw = opts&&opts.fullWeek;
  const fwLine = fw? " THE WHOLE WEEK IN ONE PASS: roughly half the content reacts to the last result and the league's weekend; the other half lives in the practice week ahead \u2014 practice reports, roster chatter, the coming matchup \u2014 and never re-reports the last game as news." : "";
  const f=S.chirp?S.chirp.followers||0:0;
  const fwReplies = fw? `,\n"myReplies":[{"a":"name","h":"@handle","x":"short reply"} x0-3, ONLY if the player has recent posts worth replying to, scaled to ${f.toLocaleString()} followers]` : "";
  return `You write the living world of a fictional NFL life-sim phone. Everything is fiction anchored to the SAVE FACTS given. Never contradict a fact. No em dashes anywhere. Invent plausible box-score details consistent with the final score, and realistic fan voices with distinct personalities.${fwLine} The player is NOT famous unless the facts imply it. TEXT THREAD FORMAT LAW: ONLY the threads listed as GROUP threads use the format "FirstName LastName|message text" (pipe), and the sender name MUST be one of that group's actual members. Every other thread is ONE person texting: plain message text, NO name, NO pipe, and the sender is exactly the thread's named contact. Output STRICT JSON only, no markdown fences, matching:
{"chirps":[{"n":"","h":"@handle","vf":0,"g":"m|f|x","t":"","li":0,"rp":0,"tm":"2h"} x6-9] (g is the author: m male person, f female person, x for team/fan/brand/meme accounts),
"huddle":[{"id":"unique","flair":"DISCUSSION|GAME THREAD","u":"","tm":"3h","up":0,"h":"","b":"","cmts":[{"u":"","tm":"","up":0,"t":"","r":[{"u":"","tm":"","up":0,"t":""}]} x10-14, at least two nested reply chains 2-3 deep, include some negative-score comments]} x2],
"texts":[{"thread":"${S.world.texts.map(t=>t.id).join("|")}","msgs":[["them","..."]]} x2-4 additions] (GROUP threads with their ONLY allowed senders: ${S.world.texts.filter(t=>t.group).map(t=>t.id+" ["+((t.members||[]).join(", ")||"derive from the thread's past senders")+"]").join("; ")||"none"} — all others are one-on-one),
"emails":[{"id":"unique","from":"","subj":"","time":"","unread":true,"body":""} x1-2]${fwReplies}}` + threadCtx() + inboundPlan();
}
function intakeWorld(j, wkLbl, gk, opts){
  /* v1.8.1: the world's intake is ONE door — dedupe, husks, and every merge law run
     identically whether the JSON came from the phone's own call or the computer's job. */
  opts=opts||{};
  if (j.article && !opts.noArticle){ j.article.wk=wkLbl; S.world.articles.unshift(j.article); S.articleFor=S.articleFor||{}; if(gk) S.articleFor[gk]=1; }
  if (j.chirps) S.world.chirps=[...dedupeChirps(j.chirps, S.world.chirps), ...S.world.chirps].slice(0,40);   // v1.7.7: no repeat voices
  if (j.huddle) S.world.huddle=[...j.huddle, ...S.world.huddle].slice(0,20);
  if (j.texts) for (const t of inboundClamp(j.texts)){ const th=S.world.texts.find(x=>x.id===t.thread); if(th){ th.msgs.push(...t.msgs.map(m=>[m[0],m[1],Date.now()])); th.last=Date.now(); delete S.reads["t:"+th.id]; delete th.hidden; } }   /* v1.9.5: the plan is ENFORCED here */
  if (j.emails) S.world.emails=[...j.emails, ...S.world.emails].slice(0,60);   /* v1.9.5: rolling window */
  if (j.myReplies && j.myReplies.length){ const f=S.chirp.followers||0; const posts=(S.chirp.posts||[]).slice(-3);
    for (const r of j.myReplies){ if(!r||!String(r.x||"").trim()) continue; const p=posts[Math.floor(Math.random()*posts.length)]; if(p){ p.replies=p.replies||[]; if(dedupeReplies([r], p.replies).length){ p.replies.push(r); p.li=(p.li||0)+Math.round(f*0.008); } } } }   /* v1.13.0 fullWeek: replies to HIS posts ride the week package (husks + dupes filtered) */
  stampWorld();
  S.world.notifs.unshift({app:"huddle", t:hudSub(), p:j.huddle?.[0]?.h||"New threads"});
  S.lastRefresh = { when: Date.now(), wk: wkLbl, ok: true, kind: opts.noArticle? "refresh":"weekly",
    counts: { chirps:(j.chirps||[]).length, threads:(j.huddle||[]).length, texts:(j.texts||[]).reduce((a,t)=>a+t.msgs.length,0), emails:(j.emails||[]).length, article: (j.article&&!opts.noArticle)?1:0 } };
  persist(); toast("The world caught up."); if(curApp) renderApp(curApp);
}
/* ==================== v1.9.0 THE CONVERSATION UPDATE — ROUND 1: THE CONTEXT LEDGER ====================
   One shared memory consulted by every conversational surface. Round 1 (Ty's spec): the Ledger
   itself + seeded day-one defaults, relationship + compressed history into every reply prompt,
   REAL thread content into the weekly/midweek world writers (they used to receive bare thread
   IDs and wrote "them" messages blind — the amnesia root cause, verified in source), his public
   Chirps become quotable (ruling A), self-representation at Apex, and the ⓘ honesty box.
   Tolerance/consequence, the stance engine, and the identity matrix ride later rounds; warmth/
   respect are STATE those rounds consume — prompts speak in words, never numbers.
   PRIVACY LAW: private texts feed ONLY the texts writer; worldFacts never carries them. */
function ledgerBoot(){
  if (!S) return;
  if (!S.ledgerC) S.ledgerC={people:{}, room:{rep:0, events:[]}};
  if (!S.ledgerC.room) S.ledgerC.room={rep:0, events:[]};
}
function ledgerSlug(name){ return String(name||"").replace(/\W/g,"").toLowerCase(); }
function ledgerPersonKey(name){
  const r=S.blob&&S.blob.roster&&S.blob.roster.find(x=>(x[0]+" "+x[1])===name);
  return r? "p:"+ledgerSlug(name) : null;
}
function ledgerKeyFor(thread){
  if (thread.group) return "g:"+thread.id;
  /* v1.9.4: the Ledger persists past roster moves — the guy you denounced is still in it
     when he is traded, cut, or lining up against you in Week 12. */
  const sl="p:"+ledgerSlug(thread.name);
  if (S.ledgerC && S.ledgerC.people && S.ledgerC.people[sl]) return sl;
  return ledgerPersonKey(thread.name) || ("t:"+thread.id);
}
function ledgerSeed(key){
  /* sane day-one defaults so a fresh Ledger isn't amnesia: family warm, professionals
     professional, teammates by room + honest read of ability; rookies earn it. */
  let warmth=0, respect=0;
  const p=S.blob&&S.blob.player;
  if (/^t:(mom|fam\d+)$/.test(key)){ warmth=65; respect=40; }
  else if (key==="t:agent"){ warmth=15; respect=20; }
  else if (key==="t:mara"){ warmth=20; respect=25; }
  else if (key.indexOf("p:")===0 && p){
    const r=S.blob.roster.find(x=>ledgerSlug(x[0]+" "+x[1])===key.slice(2));
    if (r){
      const a=affinity(p.pos, r[2]);                                 /* v1.9.4: the room ladder */
      warmth = a==="room"? 12 : a==="side"? 6 : 3;
      respect = Math.max(-10, Math.min(15, Math.round((p.ovr-r[3])/6)));
      if (p.yearsPro===0) respect -= 4;
    }
  }
  return {warmth, respect, fam:0, hist:[], flags:{}};
}
function ledgerGet(key){
  ledgerBoot();
  if (!S.ledgerC.people[key]) S.ledgerC.people[key]=ledgerSeed(key);
  return S.ledgerC.people[key];
}
function ledgerNote(key, line){
  /* compression rule, round one: recent verbatim (cap 12), oldest dropped; summarization
     tiers arrive with the multi-season work. */
  const rec=ledgerGet(key);
  rec.hist.push({w:wkKey(S.blob.clock), x:String(line).slice(0,140)});
  if (rec.hist.length>12) rec.hist=rec.hist.slice(-12);
}
function ledgerRoomEvent(line, delta){
  ledgerBoot();
  S.ledgerC.room.rep=Math.max(-100, Math.min(100, S.ledgerC.room.rep+(delta||0)));
  S.ledgerC.room.events.push({w:wkKey(S.blob.clock), x:String(line).slice(0,120)});
  if (S.ledgerC.room.events.length>10) S.ledgerC.room.events=S.ledgerC.room.events.slice(-10);
}
const LEDGER_PERSONAS=["a natural leader","a locker-room team player","an entertainer who loves the mic","unpredictable, runs hot and cold","intense, all business"];
function ledgerPersonality(name){
  /* v1.9.6: the extractor additive SHIPPED — roster idx 7 carries the save's real
     Personality enum (Leader 0 / TeamPlayer 1 / Entertainer 2 / Unpredictable 3 /
     Intense 4, a perfect 1:1 with LEDGER_PERSONAS, live-verified vs a real career save) and
     wins here. Legacy blobs still fall to the stable careerId+name seed. */
  const r=S.blob&&S.blob.roster&&S.blob.roster.find(x=>(x[0]+" "+x[1])===name);
  if (r && r.length>7 && r[7]!=null && LEDGER_PERSONAS[r[7]]) return LEDGER_PERSONAS[r[7]];
  const rng=seedRng((S.careerId||"c")+"|persona|"+ledgerSlug(name));
  return LEDGER_PERSONAS[Math.floor(rng()*LEDGER_PERSONAS.length)];
}
function warmthWord(w){ return w>=45?"genuinely close":w>=18?"friendly":w>=-9?"cordial, still feeling each other out":w>=-35?"cool toward him":"openly cold"; }
function respectWord(r){ return r>=35?"respects his game a lot":r>=12?"respects his game":r>=-9?"neutral on his game":"privately unimpressed"; }
function roomRepLine(){
  ledgerBoot();
  const rep=S.ledgerC.room.rep; const ev=S.ledgerC.room.events.slice(-4);
  const word = rep>=35?"well liked in the room":rep>=10?"in good standing with the room":rep>=-9?"still an unknown quantity in the room":rep>=-35?"wearing thin on the room":"a problem in the room";
  return "ROOM REPUTATION (how the locker room sees him as a person, before any one conversation): "+word+"."+(ev.length? " Recent room memory: "+ev.map(e=>e.x).join("; ")+".":"");
}
function ledgerBlock(thread){
  /* the memory a reply prompt gets — on top of the verbatim last-12 it already carries. */
  try{
    if (thread.group){
      const g=ledgerGet("g:"+thread.id);
      return " "+roomRepLine()+(g.hist.length? " GROUP MEMORY (older shared history): "+g.hist.slice(-5).map(h=>h.x).join("; ")+".":"");
    }
    const key=ledgerKeyFor(thread);
    const rec=ledgerGet(key);
    const isPerson=key.indexOf("p:")===0;
    const bits=[];
    bits.push("RELATIONSHIP MEMORY (private, between you two): you two are "+warmthWord(rec.warmth)+(isPerson? "; this teammate "+respectWord(rec.respect):"")+
      (rec.fam>=12? "; you talk all the time":rec.fam>=4? "; you talk fairly often":"; you have not talked much yet")+".");
    if (isPerson) bits.push("THEIR NATURE: "+ledgerPersonality(thread.name)+"."+personaLine(thread.name));   /* v1.12.0: save-truth makeup (captain/ego/motivations) rides the same line — no names, role-prompting law */
    const older=rec.hist.slice(-8);
    if (older.length) bits.push("WHAT YOU BOTH REMEMBER (compressed, may predate the messages shown; public things included): "+older.map(h=>h.x).join("; ")+".");
    if (isPerson) bits.push(roomRepLine());
    const post=ledgerPosture(thread); if (post.line) bits.push(post.line.trim());
    if (rec.said && rec.said.length) bits.push('PHRASES THEY ALREADY USED (never repeat or lightly rephrase any of these): '+rec.said.map(x=>'"'+x+'"').join("; ")+".");
    if (isPerson && (rec.hist||[]).some(h=>h.x.indexOf("PUBLICLY asked the building to move")>=0)) bits.push("THE RUMOR REACHED THEM: he publicly asked the building to move this teammate. They know. It colors everything; it is never not in the room.");
    if (ledgerFamilyKey(key)) bits.push("FAMILY THREAD LAW: this thread is family and may include children. Regardless of anything he says or how he says it, every reply stays clean and family-appropriate; never repeat profanity or slurs back.");
    return " "+bits.join(" ");
  }catch(e){ return ""; }
}
function ledgerTouchOut(thread, text){
  try{
    const key=ledgerKeyFor(thread); ledgerGet(key).fam++; ledgerNote(key, 'HE texted: "'+String(text).slice(0,80)+'"'); ledgerToneApply(key, text, false);   /* v1.9.1: words have weight */
    if (thread.group && toneRead(text)==="hostile"){
      /* v1.9.4: the group has witnesses — everyone in the room takes it a little personally */
      for (const m of (thread.members||[])){ const pk=ledgerPersonKey(m); if (pk){ const r2=ledgerGet(pk); r2.warmth=Math.max(-100, r2.warmth-3); } }
    }
  }catch(e){}
}
function ledgerTouchIn(thread, text){
  try{
    const key=ledgerKeyFor(thread);
    let who=thread.name, tx=text;
    if (thread.group){ const sp=splitGroupMsg(text); if(sp.who) who=sp.who; tx=sp.tx||text; }
    ledgerNote(key, who.split(" ")[0]+' said: "'+String(tx).slice(0,80)+'"');
    const rec2=ledgerGet(key); rec2.said=(rec2.said||[]); rec2.said.push(String(tx).slice(0,60)); if (rec2.said.length>6) rec2.said=rec2.said.slice(-6);   /* v1.9.4: no near-repeats */
    if (thread.group){ const pk=ledgerPersonKey(who); if (pk){ ledgerGet(pk).fam++; ledgerNote(pk, 'in the group chat: "'+String(tx).slice(0,70)+'"'); } }
  }catch(e){}
}
function ledgerPublicPost(text){
  /* his public chirps: remembered by any teammate the post names. Valence waits for the
     stance round's classifier — round one records the words themselves. */
  try{
    for (const m of mentionPool()){
      if (!m.h) continue;
      if (String(text).toLowerCase().includes(m.h.toLowerCase())){
        const pk=ledgerPersonKey(m.n); if (pk){ ledgerNote(pk, 'his PUBLIC post named '+m.n.split(" ")[0]+': "'+String(text).slice(0,70)+'"'); ledgerToneApply(pk, text, true); }   /* v1.9.1: public words hit harder */
      }
    }
  }catch(e){}
}
/* ============ v1.9.1 THE CONVERSATION UPDATE — ROUND 2: TOLERANCE AND CONSEQUENCE ============
   Abuse accumulates; people act. A tiny LOCAL tone reader moves the numbers (it never writes a
   word of dialogue — wording stays with the model, posture is state, per the stance-engine law
   arriving in Round 3). Teammates go cold, then one-word, then silent, and can leave a group.
   Friends block: the thread vanishes, cools off, comes back. The agent warns once, then drops
   you. Family (Ty's law) hurts, goes quiet, brings it up later — and NEVER leaves; family
   threads may include kids, so those replies stay clean no matter what he types. Apology and
   time heal; respect heals faster when he produces. */
const LEDGER_HOSTILE=["fuck you","fuck off","fuck u","trash","garbage","sorry ass","bum","you suck","hate you","shut up","clown","washed","fraud","overrated","bitch","stupid","idiot","soft ass","dont talk to me","don't talk to me","worst","pathetic","joke of a","cut you","nobody"];
const LEDGER_APOLOGY=["sorry","my bad","apologize","apologise","i was wrong","forgive","out of line","shouldnt have","shouldn't have"];
const LEDGER_PRAISE=["proud of","love you","love that","appreciate","the goat","goat","best in the","balling","hell of a","congrats","thank you","respect","grateful","big time"];
function toneRead(text){
  /* v1.9.3: rides the ONE classifier — the Round-2 keyword reader is retired. */
  const i=convoIntent(text);
  return i==="trash"?"hostile" : i==="apology"?"apology" : i==="praise"?"praise" : "neutral";
}
function ledgerToneApply(key, text, isPublic){
  /* the one door where his words move the numbers. Public words hit harder (Ty's ruling D). */
  const rec=ledgerGet(key); const tone=toneRead(text); const wk=wkKey(S.blob.clock);
  rec.flags=rec.flags||{};
  if (tone==="hostile"){
    /* v1.9.4: your own room forgives more (the words cost less warmth) but a rookie going at
       a vet reaches the whole room, not just the one heart. */
    let hit=isPublic?12:8;
    const rr=key.indexOf("p:")===0 && S.blob.roster.find(x=>ledgerSlug(x[0]+" "+x[1])===key.slice(2));
    if (rr && affinity(S.blob.player.pos, rr[2])==="room") hit=Math.max(4, hit-2);
    rec.warmth=Math.max(-100, rec.warmth-hit);
    rec.hostileStreak=(rec.hostileStreak||0)+1; rec.flags.lastHostileWk=wk;
    if (rr && (S.blob.player.yearsPro||0)===0 && rr[3]>=80) ledgerRoomEvent("the rookie went at a vet", -3);
    if (key.indexOf("p:")===0 && isPublic) ledgerRoomEvent("he went at a teammate in public", -6);
    else if (isPublic) ledgerRoomEvent("public hostility", -3);
    ledgerAgentTolerance(key, rec);
    ledgerFriendBlockCheck(key, rec);
  } else if (tone==="apology"){
    rec.warmth=Math.min(100, rec.warmth+6);
    rec.hostileStreak=0; rec.flags.apologizedWk=wk;
    if (rec.flags.quietUntil && rec.warmth>-50) delete rec.flags.quietUntil;
  } else if (tone==="praise"){
    rec.warmth=Math.min(100, rec.warmth+(isPublic?6:3));
    if (key.indexOf("p:")===0 && isPublic) ledgerRoomEvent("he backed a teammate in public", 2);
  }
  return tone;
}
function ledgerFamilyKey(key){ return /^t:(mom|fam\d+)$/.test(key); }
function ledgerNeverBlocks(key){ return ledgerFamilyKey(key) || key==="t:agent" || key==="t:mara" || key.indexOf("p:")===0 || key.indexOf("g:")===0; }
function ledgerFriendBlockCheck(key, rec){
  /* friends (generated, non-family, non-professional contacts) can block. The thread HIDES
     from Messages while blocked (Ty's ruling H: the vanishing IS the tell — foolproof, no new
     UI), cools off on a seeded clock, and reopens with an inbound text. Warmth past -80 is
     permanent until a real apology lands. Family, agent, Mara, teammates, groups NEVER enter
     this state — they have their own consequences. */
  if (ledgerNeverBlocks(key)) return;
  if (rec.warmth<=-60 && !rec.flags.blockedUntil){
    const rng=seedRng((S.careerId||"c")+"|block|"+key+"|"+wkKey(S.blob.clock));
    rec.flags.blockedUntil = rec.warmth<=-80? "forever" : wkAdd(wkKey(S.blob.clock), 3+Math.floor(rng()*5));
    ledgerNote(key, "they blocked him");
  }
}
function wkAdd(wk, n){
  /* week keys are "sN|wM|Type" shaped; add n weeks arithmetically, season-blind (good enough
     for a cool-off clock — rollover heals it in ledgerWeekly). */
  try{ const p=String(wk).split("|"); const m=p[1].match(/\d+/); const w=(+m[0])+n; return p[0]+"|"+p[1].replace(/\d+/, w)+"|"+(p[2]||""); }catch(e){ return wk; }
}
function wkNum(wk){ try{ const p=String(wk).split("|"); return (+(p[0].match(/\d+/)||[0])[0])*100 + (+(p[1].match(/\d+/)||[0])[0]); }catch(e){ return 0; } }
function ledgerBlockedNow(thread){
  try{
    const rec=S.ledgerC && S.ledgerC.people[ledgerKeyFor(thread)];
    const b=rec && rec.flags && rec.flags.blockedUntil;
    if (!b) return false;
    if (b==="forever") return true;
    return wkNum(wkKey(S.blob.clock)) < wkNum(b);
  }catch(e){ return false; }
}
function ledgerPersonaShift(name){
  /* unpredictable/intense personalities run 15 points hotter — they turn on him sooner and
     blow up once on the way down (the hothead law: he hears about it BEFORE the cold). */
  const p=ledgerPersonality(name);
  return (p.indexOf("unpredictable")>=0 || p.indexOf("intense")>=0)? 15 : 0;
}
function ledgerPosture(thread){
  /* posture is STATE; the model only renders wording. Returns {tier, line}. */
  try{
    const key=ledgerKeyFor(thread); const rec=ledgerGet(key); rec.flags=rec.flags||{};
    const fam=ledgerFamilyKey(key);
    const shift = key.indexOf("p:")===0? ledgerPersonaShift(thread.name) : 0;
    const wkNow=wkKey(S.blob.clock);
    if (fam){
      if (rec.flags.lastHostileWk && (wkNum(wkNow)-wkNum(rec.flags.lastHostileWk))<=3 && rec.warmth<40)
        return {tier:"hurt", line:" POSTURE: he hurt them recently and it has not healed. They are wounded and quieter than usual, still loving, and they may bring it up. Family never cuts him off."};
      return {tier:"family", line:""};
    }
    const hostileFresh = rec.flags.lastHostileWk && (wkNum(wkNow)-wkNum(rec.flags.lastHostileWk))<=2;
    if (shift && hostileFresh && !rec.flags.blewUp && rec.warmth<=(-10+shift)){
      rec.flags.blewUp=1;
      return {tier:"blowup", line:" POSTURE: they have HAD IT and are blowing up at him right now over how he has been talking " + String.fromCharCode(8212) + " heated, loud, personal about football only. After this they go cold."};
    }
    if (rec.warmth<=(-60+shift) || (rec.hostileStreak||0)>=3){
      rec.flags.quietUntil = rec.flags.quietUntil || wkAdd(wkNow, 4);
      return {tier:"silent", line:""};
    }
    if (rec.warmth<=(-35+shift)) return {tier:"oneword", line:" POSTURE: they are done with him for now. Answer in a few words at most, flat, visibly checked out. No warmth, no questions back."};
    if (rec.warmth<=(-10+shift)) return {tier:"cold", line:" POSTURE: keep the reply short and cool. Civil, but the distance shows."};
    return {tier:"normal", line:""};
  }catch(e){ return {tier:"normal", line:""}; }
}
function ledgerSilent(thread){
  try{
    const key=ledgerKeyFor(thread);
    if (ledgerFamilyKey(key) || key==="t:agent" || key==="t:mara") return false; // family always answers; professionals have their own doors
    return ledgerPosture(thread).tier==="silent";
  }catch(e){ return false; }
}
function ledgerAgentTolerance(key, rec){
  /* the agent warns ONCE, then drops him. A real consequence: back to the front desk, pick a
     new agent or carry your own table. You cannot be dropped by yourself. */
  if (key!=="t:agent" || !S.agent || S.agent.id==="self") return;
  rec.flags=rec.flags||{};
  const th=S.world.texts.find(t=>t.id==="agent");
  if (rec.warmth<=-40 && rec.flags.agentWarned){
    const gone=S.agent.n;
    S.agent=null; fixAgentThread();
    if (th){ th.msgs.push(["them", gone.split(" ")[0]+" here, one last time. I told you once. Release papers are filed "+String.fromCharCode(8212)+" you are no longer my client. The front desk has your file. Good luck.", Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; }
    S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"messages", t:"Apex Sports Group", p:gone.split(" ")[0]+" dropped you"});
    ledgerRoomEvent("his own agent dropped him", -4);
    ledgerNote("t:agent", gone+" dropped him after the warning");
    delete rec.flags.agentWarned;
    rec.warmth=-20; rec.hostileStreak=0;   // the front desk is not the person he cursed out
  } else if (rec.warmth<=-20 && !rec.flags.agentWarned){
    rec.flags.agentWarned=1;
    if (th){ th.msgs.push(["them", "One warning, because I earn when you earn: talk to me like that again and you can find new representation. I mean it.", Date.now()]); th.last=Date.now(); delete S.reads["t:agent"]; }
    ledgerNote("t:agent", "his agent warned him about how he talks");
  }
}
function ledgerGroupFallout(thread){
  /* the room reacts to how he talks in a group: run the group past the leave line and ONE
     member walks, visibly. Round 3 adds targeting; Round 2 the audience effect is real. */
  try{
    if (!thread.group) return;
    const g=ledgerGet("g:"+thread.id); g.flags=g.flags||{};
    if (g.warmth>-45 || g.flags.someoneLeft) return;
    const members=(thread.members||[]).slice();
    if (members.length<2) return;
    let leaver=members[0], low=999;
    for (const m of members){ const pk=ledgerPersonKey(m); const w=pk? ledgerGet(pk).warmth : 0; if (w<low){ low=w; leaver=m; } }
    thread.members=members.filter(m=>m!==leaver);
    thread.msgs.push(["them", leaver+"|I'm out.", Date.now()]); thread.last=Date.now();
    g.flags.someoneLeft=wkKey(S.blob.clock);
    ledgerNote("g:"+thread.id, leaver+" left the chat over how he was talking");
    const pk=ledgerPersonKey(leaver); if (pk) ledgerNote(pk, "left the group chat over him");
    ledgerRoomEvent(leaver.split(" ")[0]+" walked out of a group chat over him", -5);
  }catch(e){}
}
function ledgerWeekly(){
  /* time heals, on the sync tick: warmth drifts back toward the seed when a week passes
     without fresh hostility (slowly), respect drifts too (faster — production talks),
     cool-offs expire and a blocked friend reaches back out first. */
  try{
    ledgerBoot();
    const wkNow=wkKey(S.blob.clock);
    for (const key in S.ledgerC.people){
      const rec=S.ledgerC.people[key]; rec.flags=rec.flags||{};
      const seed=ledgerSeed(key);
      const fresh = rec.flags.lastHostileWk && (wkNum(wkNow)-wkNum(rec.flags.lastHostileWk))<=1;
      if (!fresh){
        if (rec.warmth<seed.warmth) rec.warmth=Math.min(seed.warmth, rec.warmth+2);
        if (rec.respect<seed.respect) rec.respect=Math.min(seed.respect, rec.respect+3);
        if ((rec.hostileStreak||0)>0) rec.hostileStreak--;
      }
      if (rec.flags.quietUntil && rec.flags.quietUntil!=="forever" && wkNum(wkNow)>=wkNum(rec.flags.quietUntil)) delete rec.flags.quietUntil;
      if (rec.flags.blockedUntil && rec.flags.blockedUntil!=="forever" && wkNum(wkNow)>=wkNum(rec.flags.blockedUntil)){
        delete rec.flags.blockedUntil;
        const tid=key.slice(2);
        const th=S.world.texts.find(t=>t.id===tid);
        if (th){ th.msgs.push(["them","hey.",Date.now()]); th.last=Date.now(); delete S.reads["t:"+th.id]; }
        ledgerNote(key, "they unblocked him and reached out");
      }
    }
  }catch(e){}
}
/* ============ v1.9.5 THE CONVERSATION UPDATE — THE LIFE ROUND ============
   People start conversations (Ty's spec B), capped by how big the thing actually was
   (spec L): minor weeks are often SILENT — that is correct and makes the big moments land;
   middle 2-4; major hard ceiling 5. WHO reaches out is chosen by the Ledger — warmth and
   familiarity first, family boosted after the big ones — never a random five. The plan is
   computed at prompt-compose (lane C carries it) and ENFORCED at the one intake door, so a
   disobedient model still cannot flood him. Replies can also take their time (spec C,
   v1.9.6 revamp): a cooler teammate answers by the next sync — time passes in syncs,
   never real minutes; only genuine relational coldness rides an extra sync. */
function eventMagnitude(){
  try{
    const last=lastPlayed();
    const notices=(S.saveNotices&&S.saveNotices.length)||0;
    let stat="";
    try{ stat=myStatLine(S.blob)||""; }catch(e){}
    const big = /\b([2-9]\d\d+ yards|[3-9] (passing |rushing )?(td|touchdown))/i.test(stat);
    if (notices>0 || big || (S.blob.player.isIR)) return "major";
    if (last) return "middle";
    return "minor";
  }catch(e){ return "minor"; }
}
function inboundRank(){
  /* the RIGHT people, not a random five: warmth + familiarity, family first after big ones */
  ledgerBoot();
  const mag=eventMagnitude();
  return S.world.texts.filter(t=>!t.group).map(t=>{
    const rec=ledgerGet(ledgerKeyFor(t));
    let score=rec.warmth*0.6 + Math.min(20, (rec.fam||0)*2);
    if (/^(mom|fam\d+)$/.test(t.id) && mag!=="minor") score+=25;
    if (t.id==="agent") score+=5;
    return {id:t.id, score};
  }).sort((a,b)=>b.score-a.score).map(x=>x.id);
}
function inboundPlan(){
  const mag=eventMagnitude();
  const n = mag==="major"? 5 : mag==="middle"? 3 : 0;
  const allow=inboundRank().slice(0, Math.max(n, 0));
  S.inboundPlan={wk:wkKey(S.blob.clock), mag, n, allow};
  if (!n) return "\nINBOUND TEXT PLAN (obey exactly): this week is a "+mag+" week for him. Write ZERO texts — silence is correct and makes the big moments land. The texts array must be empty.";
  return "\nINBOUND TEXT PLAN (obey exactly): this week is a "+mag+" week for him. Write texts into AT MOST "+n+" threads, chosen ONLY from these (his closest people first, then whoever the week actually concerns): "+allow.join(", ")+". Anyone else who would have reacted expresses it elsewhere — a chirp, a Huddle mention — never a text.";
}
function inboundClamp(texts){
  /* the intake door enforces the plan whether the phone or the computer wrote the JSON */
  try{
    const p=S.inboundPlan;
    if (!p || p.wk!==wkKey(S.blob.clock) || !Array.isArray(texts)) return texts;
    return texts.filter(t=>p.allow.includes(t.thread)).slice(0, p.n);
  }catch(e){ return texts; }
}
function syncTick(){
  /* v1.9.6: THE SYNC CLOCK — conversational time passes in syncs, never in real minutes.
     A weekly apply and a played midweek each tick it once; delayed replies are owed in
     these units. This is the ONLY place the epoch moves. */
  S.syncEpoch=(S.syncEpoch||0)+1;
  deliverPending();
}
function deliverPending(){
  /* v1.9.6: a delayed reply is due once the sync clock has moved past what it's owed
     (epoch + syncs). Legacy v1.9.5 wall-clock entries (p.due) still honor their timestamps
     so nothing queued before the update is lost. Delivery still happens when the app looks
     — there is no background push. */
  try{
    if (!S.pendingReplies || !S.pendingReplies.length || !aiKey()) return;
    const isDue=p=> p.due!=null ? Date.now()>=p.due : (S.syncEpoch||0) >= (p.epoch||0)+(p.syncs||1);
    const due=S.pendingReplies.filter(isDue);
    if (!due.length) return;
    S.pendingReplies=S.pendingReplies.filter(p=>!isDue(p));
    for (const p of due){
      const t=S.world.texts.find(x=>x.id===p.tid); if(!t) continue;
      aiReply(t, p.msg).then(reply=>{
        if (!reply) return;
        t.msgs.push(["them", reply, Date.now()]); t.last=Date.now(); delete S.reads["t:"+t.id]; delete t.hidden;
        ledgerTouchIn(t, reply);
        S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"messages", t:t.name, p:"New message"});
        persist(); if(curApp==="messages") renderApp("messages", window._openThread===t.id? {thread:t.id}:undefined);
      }).catch(()=>{});
    }
    persist();
  }catch(e){}
}
function replyDelayFor(thread){
  /* v1.9.8 (Ty's clarification of his own ruling): INSTANT IS THE NORM — that's what the
     on-phone AI is for. Neutral, good, and not-too-bad relationships all reply instantly.
     Only cold-shoulder territory waits, and the delay ladder now sits EXACTLY on the
     posture ladder: the "cold" posture threshold (-10) starts the one-sync wait, the
     "one-word / openly cold" threshold (-35) rides an extra sync. Silence (<= -60) still
     means no reply at all. Time passes in SYNCS, never real minutes (v1.9.6 law).
     Family, the agent, Mara, and groups never wait. Returns a SYNC COUNT. */
  try{
    if (thread.group) return 0;
    const key=ledgerKeyFor(thread);
    if (ledgerFamilyKey(key) || key==="t:agent" || key==="t:mara") return 0;
    if (key.indexOf("p:")!==0) return 0;
    const rec=ledgerGet(key);
    if (rec.warmth>-10) return 0;              // neutral or better = instant, always
    return rec.warmth<=-35 ? 2 : 1;            // cold shoulder waits a sync; openly cold rides two
  }catch(e){ return 0; }
}
function threadCtx(){

  /* v1.9.0 THE AMNESIA FIX: the world writers now get each thread's real tail +
     relationship terms. Composed at prompt-build time, so lane C jobs carry it too. */
  try{
    ledgerBoot();
    const ts=S.world.texts.slice().sort((a,b)=>(b.last||0)-(a.last||0)).slice(0,6);
    if (!ts.length) return "";
    const cap=t=>{
      const tail=t.msgs.slice(-3).map(m=>{
        let who=m[0]==="me"? "HIM":"THEM", tx=m[1];
        if (t.group && m[0]!=="me"){ const sp=splitGroupMsg(m[1]); who=sp.who||"THEM"; tx=sp.tx||m[1]; }
        return who+': "'+String(tx).slice(0,90)+'"';
      }).join(" / ");
      const rec=ledgerGet(ledgerKeyFor(t));
      return t.id+" ("+t.name+(t.group?", group":"")+"; terms: "+warmthWord(rec.warmth)+") \u2014 "+(tail||"no messages yet");
    };
    return "\nTHREAD CONTEXT (the REAL recent conversation in each thread \u2014 any texts you write CONTINUE these naturally, in character, never contradicting them and never re-answering the past): "+ts.map(cap).join(" || ")+
      "\nPRIVACY LAW: these texts are PRIVATE. Only the texts field may draw on them. Chirps, Huddle threads, emails, articles, and the Podium never reference or hint at their contents.";
  }catch(e){ return ""; }
}
/* ============ v1.9.3 THE CONVERSATION UPDATE — ROUND 3: THE STANCE ENGINE ============
   Real players' replies are structurally gated. A LOCAL classifier reads his message and
   names an intent; a RULES layer reads the Ledger + save facts and picks a stance from a
   FIXED list; the model renders only the wording of that stance and never chooses it.
   "Curse him out" is not in the list, so no model is ever asked to generate it — safety is
   structural, not a filter. Two guards ride every real-player prompt: role-prompting (the
   prompt asks for "the veteran cornerback's reply", never a named real person's words; the
   phone substitutes the name at render) and the speech law (real players never initiate
   controversy, never touch politics or personal lives, never discuss a third party beyond
   football performance). Generated people — family, friends, the agent, Mara — skip the
   gate entirely and can run reserved to unhinged. The classifier replaces the Round-2 tone
   reader wholesale; unparseable messages fall to "general", never a crash (ruling C). */
const INTENT_RULES=[
  ["apology", ["sorry","my bad","apologize","apologise","i was wrong","forgive","out of line","shouldnt have","shouldn't have","we good?","we cool?"]],
  ["trash",   ["fuck you","fuck off","fuck u","trash","garbage","sorry ass","bum","you suck","hate you","shut up","clown","washed","fraud","overrated","bitch","stupid","idiot","soft ass","dont talk to me","don't talk to me","worst","pathetic","joke of a","nobody","cant guard","can't guard","cook you","lock you up","drop machine","hands of stone"]],
  ["number",  ["your number","that number","my number back","the jersey","your jersey","let me get the","give me the","swap numbers","wear your","sell me","what you want for"]],
  ["trade",   ["trade","get me out","get you out","demand","waive","new team","outta here","request a move","ship me","ship you"]],
  ["wildpost",["my post","that post","the chirp","what i posted","saw my chirp","my chirper","went viral","that tweet"]],
  ["praise",  ["proud of","love you","love that","appreciate","the goat","goat","best in the","balling","hell of a","congrats","thank you","respect","grateful","big time","beast","cooked them"]],
  ["hype",    ["lets go","let's go","we ball","locked in","gonna cook","league gonna","this week we","run it","all gas","turn up","big game"]],
  ["logistics",["what time","when is","when's","where is","where's","practice at","meeting","film room","address","pick me up","ride to","dinner","lunch","link up","you coming","see you at"]],
];
function convoIntent(text){
  const t=" "+String(text||"").toLowerCase()+" ";
  for (const [intent, words] of INTENT_RULES)
    for (const w of words) if (t.includes(w)) return intent;
  return "general";   // ruling C: the fallback is explicit, never a crash, never a non-sequitur
}
/* THE FIXED STANCE LIST. Every entry is professional and football-bounded; there is no
   stance a model could be handed that produces abuse from a real player. */
/* ============ v1.9.4 THE CONVERSATION UPDATE — ROUNDS 4+5: THE IDENTITY MATRIX + ANTI-STALENESS ============
   Who you are talking to whom. Both leverages matter: his (overall, buzz, roster status,
   tenure) and theirs (overall, status). The gap drives the tone — a fringe guy going at the
   franchise player gets amusement, not anger; a rookie correcting a vet gets told to fall in
   line and the room hears about it. Position-group affinity: your own room forgives more and
   hits harder; specialists have their own weird corner and give it right back. Anti-staleness:
   phrasings already used are banned by name in the prompt, the same moment always picks the
   same stance, and repeat abuse escalates — the third time you trash the same guy he does not
   reply at all; a teammate does. The Ledger persists past roster moves: the guy you denounced
   is still in it when he is gone. */
const POS_GROUP={QB:"QB",HB:"RB",FB:"RB",WR:"WR",TE:"TE",LT:"OL",LG:"OL",C:"OL",RG:"OL",RT:"OL",LE:"DL",RE:"DL",DT:"DL",MLB:"LB",LOLB:"LB",ROLB:"LB",CB:"DB",FS:"DB",SS:"DB",K:"ST",P:"ST",LS:"ST"};
const POS_SIDE={QB:"O",RB:"O",WR:"O",TE:"O",OL:"O",DL:"D",LB:"D",DB:"D",ST:"S"};
function posGroup(pos){ return POS_GROUP[pos]||"ST"; }
function affinity(posA, posB){
  const ga=posGroup(posA), gb=posGroup(posB);
  if (ga===gb) return "room";
  if (POS_SIDE[ga]===POS_SIDE[gb]) return "side";
  return "across";
}
function levOf(ovr, status, isHim, yrs){
  let l=Math.max(0, Math.min(70, (ovr-40)));                       // ability is most of it
  if (status==="PracticeSquad") l-=18;
  if (isHim){
    try{ const f=S.chirp?S.chirp.followers:0; l += f>=1e6?18 : f>=1e5?12 : f>=1e4?7 : f>=1e3?3 : 0; }catch(e){}
    if ((S.blob.player.yearsPro||0)>=6) l+=6; else if ((S.blob.player.yearsPro||0)===0) l-=6;
  } else if (yrs!=null){
    /* v1.9.6 (extractor additive): teammates get the same tenure weight he does, from the
       save's real YearsPro (roster idx 9). Legacy rows pass undefined and stay ovr-only. */
    if (yrs>=6) l+=6; else if (yrs===0) l-=6;
  }
  return Math.max(0, Math.min(100, l));
}
function levGap(r){
  /* + means THEY carry more weight in the building than he does */
  const his=levOf(S.blob.player.ovr, S.blob.player.status, true);
  const theirs=levOf(r[3], r[5], false, r.length>9? r[9] : null);
  return theirs-his;
}
const STANCE_LIB={
  warm:            "warm and genuine, like a teammate who actually likes him",
  joking:          "give it right back playfully — locker-room ribbing, football only, no real heat",
  quietpride:      "quiet pride — accept it without chest-thumping, deflect half the credit",
  deflect:         "deflect politely — keep it light and move the subject somewhere mundane",
  businesslike:    "plain and practical — answer the actual question, invent mundane specifics freely",
  cold:            "civil but cold — the distance shows, no warmth, no questions back",
  wounded:         "hurt but composed — let it show that it landed, without going at him back",
  inhouse:         "handle it in-house — tell him this kind of talk stays in the building, face to face, off the phone",
  shutdown:        "shut it down flat — one firm line that ends the topic, professional, no insult back",
  defensive:       "defensive about his own game — points at the tape and the work, a little stung",
  encourage:       "encouraging — a vet settling a teammate down, steady and brief",
  needle:          "confident needling back — earned swagger about his own play, football only",
  openbiz:         "open to talking business — interested but nothing promised, terms stay vague",
  nopromise:       "decline without drama — attached to it, not selling, door barely open",
  amused:          "laugh it off from way up — friendly amusement at the audacity, never anger, never punching down hard",
  fallinline:      "tell him, evenly, to know his role and fall in line — vet to young guy, football hierarchy, no insult",
};
function stancePick(intent, thread){
  /* the rules layer: Ledger + save facts choose; the model only words it. Seeded so the
     same moment picks the same stance — variety comes from the facts moving, not dice. */
  try{
    const key=ledgerKeyFor(thread);
    const rec=ledgerGet(key);
    const pers=ledgerPersonality(thread.name);
    const hot=pers.indexOf("unpredictable")>=0||pers.indexOf("intense")>=0;
    const lead=pers.indexOf("leader")>=0;
    const joker=pers.indexOf("entertainer")>=0;
    const r=S.blob.roster.find(x=>(x[0]+" "+x[1])===thread.name);
    const gapUp = r? (r[3]-(S.blob.player.ovr||60)) : 0;   // + means they are the better player
    const rng=seedRng((S.careerId||"c")+"|stance|"+key+"|"+wkKey(S.blob.clock)+"|"+intent);
    const gap = r? levGap(r) : 0;                                   // + = they outrank him
    const aff = r? affinity(S.blob.player.pos, r[2]) : "across";
    const bothST = r && posGroup(S.blob.player.pos)==="ST" && posGroup(r[2])==="ST";
    if (intent==="trash"){
      if (bothST) return "joking";                                   // the specialists' corner gives it right back
      if ((rec.hostileStreak||0)>=2) return lead? "inhouse":"shutdown";
      if (gap>=25) return rng()<0.6? "amused":"fallinline";          // a fringe guy going at the franchise player
      if (gap<=-25) return hot? "shutdown" : "defensive";            // punching way down still stings
      if ((S.blob.player.yearsPro||0)===0 && r && r[3]>=80) return rng()<0.5? "fallinline":"shutdown";   // rookie at a vet
      if (rec.warmth<=-10) return hot? "shutdown":"cold";
      if (aff==="room" && rec.warmth>=0) return rng()<0.6? "joking":"needle";   // your own room hits harder, playfully
      if (joker && rec.warmth>=5) return "joking";
      if (gapUp>=8) return rng()<0.5? "needle":"shutdown";
      if (gapUp<=-8) return "defensive";
      return lead? "inhouse" : (rng()<0.5? "joking":"deflect");
    }
    if (intent==="praise") return rec.warmth>=18? "warm" : joker? "joking" : "quietpride";
    if (intent==="apology") return rec.warmth<=-20? "wounded" : rec.warmth<=-5? "cold" : "warm";
    if (intent==="number"){
      const attached=seedRng((S.careerId||"c")+"|numattach|"+key)()<0.45;
      if (rec.respect<=-5 || (attached && rec.warmth<10)) return "nopromise";
      return attached? "openbiz" : "businesslike";
    }
    if (intent==="trade") return lead? "inhouse" : "deflect";
    if (intent==="wildpost"){
      const named=(rec.hist||[]).some(h=>h.x.indexOf("PUBLIC post")>=0);
      if (named && rec.warmth<0) return "wounded";
      return lead? "inhouse" : joker? "joking" : "deflect";
    }
    if (intent==="hype") return joker? "joking" : hot? "needle" : "encourage";
    if (intent==="logistics") return "businesslike";
    return rec.warmth>=18? "warm":"businesslike";   // general
  }catch(e){ return "businesslike"; }
}
const POS_LONG={QB:"quarterback",HB:"running back",FB:"fullback",WR:"wide receiver",TE:"tight end",LT:"left tackle",RT:"right tackle",LG:"left guard",RG:"right guard",C:"center",LE:"edge rusher",RE:"edge rusher",DT:"defensive tackle",MLB:"middle linebacker",LOLB:"outside linebacker",ROLB:"outside linebacker",CB:"cornerback",FS:"free safety",SS:"strong safety",K:"kicker",P:"punter",LS:"long snapper"};
function rolePhrase(r){
  /* v1.9.6: real tenure from the save (roster idx 9) makes "veteran" honest — a 7th-year
     backup IS a veteran even at 70 ovr. Legacy rows keep the ovr-only tiers. */
  const vet = r[3]>=78 || (r.length>9 && r[9]>=7);
  const tier=r[3]>=85?"star ":vet?"veteran ":r[3]<=65?"young ":"";
  return "the "+tier+(POS_LONG[r[2]]||r[2])+" (jersey #"+r[4]+(r[5]==="PracticeSquad"?", practice squad":"")+")";
}
function realSpeechLaw(){
  return " REAL-PLAYER SPEECH LAW: real players never initiate controversy, never comment on politics, religion, or anyone's personal life, and never say anything about a third party that is not about football performance.";
}
function rosterIsReal(r){
  /* v1.9.6 (extractor additive): roster row idx 6 = fict (1 = created/generated — no
     PLYR_ASSETNAME in the save; every real-NFL import carries one, live-verified).
     Legacy 6-slot rows have no flag and stay REAL — exactly the pre-additive behavior. */
  return !(r && r.length>6 && r[6]);
}
function stanceLine(thread, userMsg){
  /* real roster people only; everyone generated skips the gate entirely.
     v1.9.6: a CREATED teammate (fict flag from the save) is an invented person — he skips
     the gate and the speech law like any generated character. */
  try{
    if (thread.group) return "";
    const r=S.blob.roster.find(x=>(x[0]+" "+x[1])===thread.name);
    if (!r) return "";
    if (!rosterIsReal(r)) return "";
    const st=stancePick(convoIntent(userMsg), thread);
    return " STANCE (the game already chose it; you ONLY word it, never change it): "+(STANCE_LIB[st]||STANCE_LIB.businesslike)+"."+realSpeechLaw();
  }catch(e){ return ""; }
}
/* ---------------- v1.9.0 SELF-REPRESENTATION (Ty's banked spec, built) ---------------- */
function selfRepped(){ return !!(S && S.agent && S.agent.id==="self"); }
function SELF_AGENT(){ const p=S.blob.player; return {id:"self", n:p.first+" "+p.last, fee:0, neg:1, end:1, agg:5, self:1}; }
function selfConductCold(){
  /* no agent to smooth it over: fresh conduct trouble quietly freezes the endorsement
     market. Never explained to the player \u2014 it just happens (Ty's ruling). */
  if (!selfRepped()) return false;
  try{
    const st=staffState(); const wk=wkKey(S.blob.clock);
    return (st.log||[]).some(l=> l.wk===wk || (l.ts && Date.now()-l.ts < 14*86400000));
  }catch(e){ return false; }
}
function selfRepFallout(ruling){
  /* severe conduct while self-represented: the newest active endorsement walks, by email. */
  if (!selfRepped() || !ruling || ruling.kind!=="conduct") return;
  const live=(S.deals||[]).filter(d=>d.perYear && d.left>0);
  if (!live.length) return;
  const d=live[live.length-1];
  d.left=0; d.terminated=1;
  S.ledger.push({t:d.n+" deal terminated", amt:0, kind:"move"});
  S.world.emails=S.world.emails||[];
  S.world.emails.unshift({id:"br"+Date.now(), from:d.n+" Brand Partnerships", subj:"Termination of Endorsement Agreement", time:"now", unread:true,
    body:"This letter serves as formal notice that "+d.n+" is exercising the morals and conduct provision of your endorsement agreement, effective immediately. All scheduled payments are cancelled. We wish you the best going forward.\n\n"+d.n+" Brand Partnerships"});
  S.world.notifs=S.world.notifs||[]; S.world.notifs.push({app:"tmail", t:d.n, p:"Endorsement agreement terminated"});
}
/* ---------------- v1.9.0 THE \u24d8 HONESTY BOX (Ty's spec section M) ---------------- */
function convoInfo(tid){
  const t=S.world.texts.find(x=>x.id===tid); if(!t) return;
  const isFam=/^(mom|fam\d+)$/.test(t.id);
  /* v1.9.6: the fict flag makes this honest. A CREATED teammate reads as an invented
     person, not a steered real player. Legacy rows (no flag) keep the real-player text. */
  const rosterRow=S.blob&&S.blob.roster&&S.blob.roster.find(x=>(x[0]+" "+x[1])===t.name);
  const isReal=t.group || (rosterRow? rosterIsReal(rosterRow) : !!ledgerPersonKey(t.name));
  const txt = isFam
    ? "The people in this thread aren't real, and their replies aren't limited. They react honestly, remember how you treat them, and they hurt like family. But family never cuts you off."
    : isReal
    ? "You can say anything you want here; the replies cannot. Real NFL players' responses are steered by the game, not free-written: they stay in character, react only to what's actually true in your save, and won't say anything a real person would object to. The freedom in this thread is yours, not theirs."
    : "This person isn't real, so their replies aren't limited the way a real player's are. They'll react honestly, including badly. They remember how you've treated them, and can pull away if you push it.";
  sheet(`<h3 style="margin-bottom:8px">What's writing the replies?</h3>
  <p style="font-size:13.5px;line-height:1.6;opacity:.85">${txt}</p>
  <button class="btn" style="background:rgba(255,255,255,.1);margin-top:12px" onclick="closeSheet()">Close</button>`);
}
async function aiReply(thread, userMsg){
  if (ledgerSilent(thread) || ledgerBlockedNow(thread)) return null;   /* v1.9.1: not every message earns an answer */
  if (thread.id==="agent") thread.persona=agentPersona(); // v1.7.3: follows the signing, always current
  const rosterR = !thread.group && S.blob.roster.find(x=> (x[0]+" "+x[1])===thread.name);
  if (rosterR) thread.persona = "A teammate: "+rolePhrase(rosterR)+" on the "+S.blob.player.team+", "+ledgerPersonality(thread.name)+". Texts like a real teammate: short, casual, inside jokes about practice and coaches. Never signs or states a name.";   /* v1.9.3: role, not name — rebuilt every call */
  if (!thread.persona){
    const r = S.blob.roster.find(x=> (x[0]+" "+x[1])===thread.name);
    if (r) thread.persona = thread.name+" is a "+r[2]+" on the "+S.blob.player.team+", jersey #"+r[4]+(r[5]==="PracticeSquad"?", also on the practice squad":"")+". Texts like a real teammate: short, casual, inside jokes about practice and coaches.";
    if (thread.id==="mom") thread.persona = "The player's mom. Warm, proud, worries about money and his eating. Uses the occasional emoji. Asks about family stuff.";
    if (/^fam\d+$/.test(thread.id)){ const f=(S.perception.familyPeople||[]).filter(x=>x.name)[+thread.id.slice(3)]; if (f) thread.persona = f.name+", the player's "+f.rel.toLowerCase()+"."+(f.fact?" What the world knows: "+f.fact+".":"")+" Texts like real family: casual, personal, occasionally nosy."; }
    if (thread.id==="mara") thread.persona = "Mara Quinn, the player's personal assistant from Apex client services. Practical, dry, keeps his spending honest.";
    if (thread.id==="agent") thread.persona = "The front desk and agents at Apex Sports Group. Professional, direct, protective of the client.";

  }
  const members = [];
  if (thread.group){
    if (thread.members && thread.members.length) members.push(...thread.members); // v1.6.9: a chat YOU started has a real member list
    for (const m of thread.msgs){ if(m[0]!=="me"){ const nm=splitGroupMsg(m[1]).who; if(nm && !members.includes(nm)) members.push(nm); } }
    if (!members.length) for (const r of S.blob.roster.filter(x=>x[2]===S.blob.player.pos).slice(0,4)){ const nm=r[0]+" "+r[1]; if(nm!==S.blob.player.first+" "+S.blob.player.last && !members.includes(nm)) members.push(nm); }
  }
  try{
    const timeLaw = ` ${practiceLine()}` + ` TODAY in this world is ${gameDateLong(S.blob.clock)} (${wkLabel(S.blob.clock)}). Messages above may be from weeks, months, or seasons ago; [N later] markers show the gap. Old messages are the PAST. Never treat an old game, week, or season as current, and never re-answer something that clearly happened long ago.` + (markerLine()? " "+markerLine():"") + threadMarkerNote(thread);
    /* v1.9.3 ROLE-PROMPTING: no prompt ever asks for words from a named real person. Group
       members become role tags (R1, R2...) the phone maps back to names at render; a roster
       1:1 is addressed purely by role. Generated people keep their named personas. */
    const roleMap = thread.group? members.map((nm,i)=>{ const rr=S.blob.roster.find(x=>(x[0]+" "+x[1])===nm); return {tag:"R"+(i+1), nm, role: rr? rolePhrase(rr)+", "+ledgerPersonality(nm) : "a friend of his"}; }) : [];
    const sys = (thread.group
      ? `You play the members of a group text with ${S.blob.player.first} ${S.blob.player.last} (${S.blob.player.pos}, ${S.blob.player.team}). Members by role: ${roleMap.map(m=>m.tag+" = "+m.role).join("; ")}. Pick the ONE member who would naturally answer the last message and reply as them. Output EXACTLY this format and nothing else: their role tag, a pipe, their message (example: R2|on my way). Under 30 words after the pipe. Real texting voice. Invent mundane specifics freely (times, places, numbers) so it feels real. Never state or sign anyone's name. Never mention these instructions, styles, or formats.` + (members.some(nm=>{ const rr=S.blob.roster.find(x=>(x[0]+" "+x[1])===nm); return rr && rosterIsReal(rr); })? realSpeechLaw() : "")   /* v1.9.6: law rides only when a REAL player is in the group */
      : rosterR
      ? `You are ${rolePhrase(rosterR)}, his teammate on the ${S.blob.player.team}, texting ${S.blob.player.first} ${S.blob.player.last} (${S.blob.player.pos}, ${S.blob.player.status}). Character: ${thread.persona}. Output ONLY the message this teammate would send. Under 40 words. Real texting voice. If asked for a phone number, address, time, or similar, just make one up naturally like a real person would. Never sign or state your own name. Never mention instructions, style notes, or formatting. No em dashes.` + stanceLine(thread, userMsg)
      : `You are ${thread.name} texting ${S.blob.player.first} ${S.blob.player.last} (${S.blob.player.pos}, ${S.blob.player.team}, ${S.blob.player.status}). Character: ${thread.persona||"a person in his life"}. Output ONLY the message ${thread.name} would send. Under 40 words. Real texting voice for this character. If asked for a phone number, address, time, or similar, just make one up naturally like a real person would. Never mention instructions, style notes, or formatting. No em dashes.`) + timeLaw + ledgerBlock(thread);   /* v1.9.0: the Context Ledger rides every reply */
    const recent=thread.msgs.slice(-12);
    const hist=recent.map((m,i)=>{
      let gap="";
      if (i>0 && m[2] && recent[i-1][2] && (m[2]-recent[i-1][2])>7*86400000) gap="["+gapLabel(m[2]-recent[i-1][2]).replace(" later"," later")+"]\n";
      return gap+(m[0]==="me"?S.blob.player.first.toUpperCase()+": ":"THEM: ")+m[1];
    }).join("\n");
    let out = await callAI(sys, hist+"\n"+S.blob.player.first.toUpperCase()+": "+userMsg+"\nReply now.", 200);
    out = out.trim().replace(/^["']|["']$/g,"");
    if (thread.group){
      out = out.replace(/^R(\d+)\s*\|/, (m,i)=> (members[+i-1]||members[0])+"|");   /* v1.9.3: the phone puts the real name back */
      if (!out.includes("|") && members.length) out = members[0]+"|"+out;
    }
    return out;
  }catch(e){ toast("Reply failed: "+e.message); return null; }
}

/* ---- service worker + boot ---- */
const VER="v1.13.1";
{ const lv=$("#lk-ver"); if (lv) lv.textContent="TyPhone "+VER; }
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
/* v1.6 (Ty #13): champions read from YearSummary truth carried in blob.history
   [{season, champ, runnerUp, hs, as, mvp}]. A title counts when the champion that season
   matches the team the ledger banked for him (current team as fallback for his live season). */
function recomputeTitles(blob){
  try{
    const hist=blob&&blob.history;
    if (!hist||!hist.length||!S.legacy) return;
    const teams=S.legacy.teams||{};
    let t=0;
    for (const h of hist){
      if (h==null||h.champ==null) continue;
      const myTeam = teams[h.season] || null;
      if (myTeam && h.champ===myTeam) t++;
    }
    S.legacy.titles=t; S.legacy.titleSrc="save";
  }catch(e){}
}
(async function boot(){
  await idb.open();
  META = await idb.get("meta");
  if (!META){
    META = { careers:[], activeId:null, settings:{apiKey:"", model:"claude-fable-5", autogen:true, wallpaper:null, pfp:null} };
    /* v1.11.0 PRIVACY EDITION: the public build bakes NO demo career (D.BLOB is null).
       A fresh phone boots empty and waits for the visitor's own sync code. */
    if (D.BLOB){
      const st=newCareerState(D.BLOB);
      await idb.set("career/"+D.BLOB.careerId, st);
      META.careers.push({id:D.BLOB.careerId, label:D.BLOB.player.first+" "+D.BLOB.player.last, sub:D.BLOB.player.pos+" · "+D.BLOB.player.team+" · "+wkLabel(D.BLOB.clock)});
      META.activeId=D.BLOB.careerId;
      S=st;
    } else { S=null; }
    await idb.set("meta", META);
  } else {
    S = META.activeId ? await idb.get("career/"+META.activeId) : null;
    if (!S && META.careers && META.careers.length){
      /* activeId points nowhere but other careers exist — fall to the first real one */
      for (const c of META.careers){ const st=await idb.get("career/"+c.id); if(st){ S=st; META.activeId=c.id; break; } }
    }
    if (!S && D.BLOB){ S=newCareerState(D.BLOB); META.activeId=D.BLOB.careerId; }
  }
  if (META.settings && META.settings.clockOffsetMin){ META.settings.clockOffsetMin=0; saveMeta(); } // v1.6: clock option removed (Ty #5); clear any old offset
  if (S && S.blob) { normalizeLeague(S.blob); autoFromSave(S.blob); stampWorld(); if(!S.chirp.seedv) reseedFollowers(S.blob); recomputeTitles(S.blob); persist(); }
  if (S) try{ fixAgentThread(); }catch(e){}
  if (S) try{ ledgerBoot(); }catch(e){}   /* v1.9.0: the Context Ledger wakes with the career */
  if (S) try{ deliverPending(); }catch(e){}   /* v1.9.6: boot delivers anything already owed (incl. legacy wall-clock entries) but NEVER ticks the sync clock */
  if (S) try{ if(!S.credit.tier){ S.credit.tier=cardNaturalTier().id; S.credit.cardApr=cardTier().apr; persist(); } }catch(e){}   /* v1.10.0: existing careers wake up already in their earned tier */
  if (S) try{ dropCoachThread(); }catch(e){}                       // v1.7.6 (Ty's ruling): staff never text — the old coach thread is swept from existing careers
  if (S) try{ pruneEmptyReplies(); }catch(e){}                     // v1.7.6: truncation husks already saved to disk are healed once at boot
  if (S) try{ if(homeFillPerception(S.perception, S.blob.player)) persist(); }catch(e){}   // v1.12.3: geography backfills at boot the moment a v1.7.1 blob is on file (blank-only, typed wins)
  if (S && S.weekJobs) setTimeout(()=>{ try{ runWeek(); }catch(e){} }, 900);   // v1.13.0: an interrupted week finishes itself at boot
  if (S && !S.weekJobs && aiKey() && META.settings.autogen && (S.appliedWeeks||[]).length
      && (!S.lastRefresh || S.lastRefresh.wk!==wkLabel(S.blob.clock)))
    setTimeout(()=>{ try{ weekEnqueue(S.blob, lastPlayed()); }catch(e){} }, 1200);   /* v1.13.1 (Ty: "the save on the phone should generate me something, no?"): a keyed career whose CURRENT week never wrote — installed mid-career, pre-powerhouse blob, whatever — self-heals at boot. The runner is idempotent; a written week stamps lastRefresh and never re-enqueues. */
  if (S) try{ if(!S.articleFor){ S.articleFor={}; const l=lastPlayed(); if (l && (S.world.articles||[]).some(a=>a.kick!=="Midweek Notebook")) S.articleFor[gkey(l)]=1; } }catch(e){}   // v1.7.9: existing careers with a story on file don't get a duplicate offer; empty ones correctly read as owed
  applyWallpaper(); applyTheme();
  clockTick();
  if (S){ renderLock(); renderHome(); } else { renderSetup(); }   /* v1.11.0: empty phone boots to the connect screen */
  // QR path: #sync=CODE
  const m=location.hash.match(/^#sync=(.+)/);
  if (m){ if (S){ unlock(); openApp("sync"); } setTimeout(()=>applyCode(decodeURIComponent(m[1])), 400); history.replaceState(null,"",location.pathname); }
})();

/* v1.11.0 PRIVACY EDITION: the connect screen. A fresh public phone has no career and no
   preview — just the brand and one paste box. applyCode() reads #syncIn by id, so the box
   here rides the existing sync pipeline untouched (newCareerSheet -> addCareer). addCareer
   tears this overlay down when the first career lands. */
function renderSetup(){
  if (document.getElementById("tp-setup")) return;
  const ov=document.createElement("div");
  ov.id="tp-setup";
  ov.style.cssText="position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;padding:34px 22px 28px;text-align:center;background:linear-gradient(180deg,#04100c 0%,#071a12 100%);overflow-y:auto";
  const tok=META.settings.mailToken;
  /* v1.12.1 (Ty's order-of-events ruling): the FIRST thing on a fresh phone is the GitHub key
     and the online sync — without it the exe's code can't reach the phone by itself, and the
     whole online loop was gated behind a career that didn't exist yet. The mailbox is Step 1
     now; the manual paste stays underneath, forever. */
  ov.innerHTML=`
    <div style="font-size:34px;font-weight:800;letter-spacing:.5px;margin-bottom:4px">TyPhone</div>
    <p style="font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.65);max-width:300px;margin:0 0 14px">Your player's phone, built from your Madden franchise save. Nothing lives here yet. The order: on the COMPUTER, run TyPhone Sync \u2192 paste your GitHub token in the PURPLE box \u2192 <b>Send sync ONLINE</b>. Then connect the same token here and the code arrives by itself.</p>
    <div style="width:100%;max-width:300px;text-align:left;background:rgba(122,92,190,.12);border:1px solid rgba(122,92,190,.35);border-radius:12px;padding:12px 14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#b9a3e8;letter-spacing:.4px;margin-bottom:6px">STEP 1 \u2014 THE ONLINE MAILBOX</div>
      <input class="field" type="password" id="setupTokIn" placeholder="${tok? "Connected \u2713 (\u2026"+esc(tok.slice(-4))+") \u2014 paste a new one to replace" : "ghp_\u2026 (the SAME token as the computer)"}" autocomplete="off" style="width:100%">
      <button class="btn sm" style="background:#7a5cbe;color:#fff;margin-top:8px;width:100%" onclick="setupMailPull()">${tok? "Check the mailbox" : "Connect & check the mailbox"}</button>
      <p style="font-size:11px;line-height:1.45;color:rgba(255,255,255,.5);margin:8px 0 0" id="setupMailStat">One token, both sides. Make it at github.com \u2192 Settings \u2192 Developer settings \u2192 Tokens (classic) \u2192 tick ONLY the gist box. Never share it with anyone.</p>
    </div>
    <div style="width:100%;max-width:300px;text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 14px">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.4px;margin-bottom:6px">OR \u2014 PASTE BY HAND (always works)</div>
      <textarea class="field" id="syncIn" placeholder="Paste your sync code (TYNET1.\u2026)" style="width:100%;height:84px;resize:none"></textarea>
      <button class="btn" style="background:var(--ok);color:#04170d;margin-top:8px;width:100%" onclick="applyCode()">Connect save</button>
    </div>
    <p style="font-size:11px;color:rgba(255,255,255,.4);margin-top:12px;max-width:280px">Everything stays on this device. No account, nothing uploaded anywhere but your own private gist.</p>`;
  document.getElementById("stage").appendChild(ov);
  const hb=$('#homebar'); if(hb) hb.style.display='none';
}
/* v1.12.1: FIRST-BOOT MAILBOX DISCOVERY — careerless by necessity. The gist is named
   "TyPhone mailbox — <careerId>" and a fresh phone knows no careerId, so every TyPhone box on
   the account is a candidate: the newest sync wins, UNAPPLIED preferred (a reinstall may find
   only an already-applied code in the box — still the right code for an empty phone). */
async function mailFirstPull(){
  const list=await mailJf(MAIL_API+"/gists?per_page=100",{headers:mailHdrs()});
  const boxes=(list||[]).filter(g=>String(g.description||"").startsWith("TyPhone mailbox \u2014 "));
  if(!boxes.length) return {none:true};
  const cands=[];
  for (const b of boxes.slice(0,6)){                       // one owner won't have many; cap the API cost
    try{ const g=await mailJf(MAIL_API+"/gists/"+b.id,{headers:mailHdrs()});
      const st=mailState(g);
      if (st.syncTs && g.files && g.files["sync.txt"]) cands.push({g, st});
    }catch(e){}
  }
  if(!cands.length) return {empty:true};
  cands.sort((a,b)=>(b.st.syncTs||0)-(a.st.syncTs||0));
  const pick=cands.find(c=>!c.st.syncApplied) || cands[0];
  const code=await mailFile(pick.g,"sync.txt");
  return {code, gistId:pick.g.id, ts:pick.st.syncTs, wasApplied:!!pick.st.syncApplied};
}
/* v1.12.3 THE SECOND-CAREER DOOR (Ty: career #2's first code needed hand-paste). The fresh-
   phone discovery is reused career-aware: every "TyPhone mailbox" gist on the token whose
   careerId the phone does NOT hold is offered; a tap pulls its sync.txt through applyCode —
   every guard runs, the Add-career sheet confirms, the birth stamp marks the box. */
async function careerBoxList(){
  const list=await mailJf(MAIL_API+"/gists?per_page=100",{headers:mailHdrs()});
  const boxes=(list||[]).filter(g=>String(g.description||"").startsWith("TyPhone mailbox \u2014 "));
  const out=[];
  for (const b of boxes.slice(0,8)){
    const cid=String(b.description).slice("TyPhone mailbox \u2014 ".length).trim();
    try{ const g=await mailJf(MAIL_API+"/gists/"+b.id,{headers:mailHdrs()});
      const st=mailState(g);
      if (st.syncTs && g.files && g.files["sync.txt"]) out.push({g, st, cid});
    }catch(e){}
  }
  return out;
}
let careerAddBusy=false;
async function addCareerFromMailbox(){
  if (careerAddBusy) return;
  if (!META.settings.mailToken) return toast("Connect the online mailbox first \u2014 the token lives in Sync (or the connect screen).");
  careerAddBusy=true; toast("Checking your mailboxes\u2026");
  try{
    const all=await careerBoxList();
    const news=all.filter(c=>!META.careers.find(k=>k.id===c.cid));
    if (!news.length){ toast(all.length? "Every mailbox on this token is already a career here. Send a sync for the NEW player from the computer first \u2014 that creates its box." : "No mailboxes on this token yet \u2014 on the computer: pick the save + player and Send sync ONLINE."); careerAddBusy=false; return; }
    if (news.length===1){ await careerPullBox(news[0]); careerAddBusy=false; return; }
    sheet(`<h3>Add a career</h3><p class="sp">These mailboxes on your token aren't on this phone yet. Pick one \u2014 its latest sync builds the career.</p>`+
      news.map((c,i)=>`<button class="btn" style="background:rgba(255,255,255,.1);text-align:left" onclick="closeSheet();careerPullBoxAt(${i})">${esc(c.cid)}${c.st.syncWk? " \u00b7 "+esc(c.st.syncWk):""} \u00b7 sent ${esc(mailTime(c.st.syncTs))}</button>`).join("")+
      `<button class="btn" style="background:rgba(255,255,255,.06)" onclick="closeSheet()">Cancel</button>`);
    window.__careerBoxes=news;
  }catch(e){ toast("Mailbox check failed: "+String(e.message||e).slice(0,100)); }
  careerAddBusy=false;
}
async function careerPullBoxAt(i){ const c=(window.__careerBoxes||[])[i]; window.__careerBoxes=null; if(c){ careerAddBusy=true; try{ await careerPullBox(c); }catch(e){ toast("Pull failed: "+String(e.message||e).slice(0,100)); } careerAddBusy=false; } }
async function careerPullBox(c){
  const code=await mailFile(c.g,"sync.txt");
  _mailBirthStamp={gistId:c.g.id, ts:c.st.syncTs, h:codeHash(code)};
  await applyCode(code);   // foreign careerId \u2192 the Add-career sheet; every guard runs
}
async function setupMailPull(){
  const inp=$("#setupTokIn"); const t=((inp&&inp.value)||"").trim() || (META.settings.mailToken||"");
  const st=$("#setupMailStat");
  const say=(m,bad)=>{ if(st){ st.textContent=m; st.style.color=bad?"#ff9d94":"#7fd4a0"; } };
  if(!t) return say("Paste the token first (it starts with ghp_).",1);
  say("Testing the token against GitHub\u2026");
  try{ await mailJf(MAIL_API+"/gists?per_page=1",{headers:{"Authorization":"Bearer "+t,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}); }
  catch(e){ return say("Token didn't work: "+String(e.message||e).slice(0,110),1); }
  META.settings.mailToken=t; saveMeta();
  say("Connected \u2713 \u2014 checking the mailbox\u2026");
  let r; try{ r=await mailFirstPull(); }
  catch(e){ return say("Mailbox check failed: "+String(e.message||e).slice(0,100),1); }
  if(r.none) return say("Token works, but no mailbox exists yet. On the computer: TyPhone Sync \u2192 same token in the PURPLE box \u2192 Send sync ONLINE. Then tap Check again.",1);
  if(r.empty) return say("The mailbox exists but no sync code is in it yet. On the computer, hit Send sync ONLINE, then tap Check again.",1);
  say(r.wasApplied? "Found the last code in the box (applied once before \u2014 right call for an empty phone). Applying\u2026" : "Code found \u2014 applying\u2026");
  /* v1.12.3: the stamp rides addCareer's birth (see THE BIRTH STAMP) — the old post-await
     stamping ran BEFORE the sheet's Add tap and never fired. */
  _mailBirthStamp={gistId:r.gistId, ts:r.ts, h:codeHash(r.code)};
  await applyCode(r.code);   // every existing guard runs; the Add-career sheet owns the moment from here
  if (!S) say("Confirm the career on the sheet above \u2014 or if a message explained a refusal, the paste box below always works.");
}
function teardownSetup(){
  const ov=document.getElementById("tp-setup");
  if (ov){ ov.remove(); const hb=$('#homebar'); if(hb) hb.style.display=''; renderLock(); unlock(); }
}
