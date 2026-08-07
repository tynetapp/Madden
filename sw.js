/* TyNet service worker — polite auto-updates */
const VER = "typhone-v1.3.5";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./data.js","./manifest.webmanifest","./icon-180.png","./icon-512.png"];
const EXTRAS = ["./jsqr.min.js"]; // best-effort: never allowed to block install if missing
const RUNTIME_OK = u => u.includes("cdnjs.cloudflare.com/ajax/libs/jsQR"); // legacy fallback: cached on first use
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VER).then(c=>
    c.addAll(ASSETS).then(()=>Promise.allSettled(EXTRAS.map(u=>c.add(u))))
  ).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const url=new URL(e.request.url);
  if (url.origin!==location.origin && !RUNTIME_OK(url.href)) return; // API calls etc. go straight out
  e.respondWith(
    caches.match(e.request).then(hit=>{
      const net=fetch(e.request).then(res=>{ if(res.ok) caches.open(VER).then(c=>c.put(e.request,res.clone())); return res; }).catch(()=>hit);
      return hit || net;
    })
  );
});
