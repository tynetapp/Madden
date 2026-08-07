/* TyNet service worker — polite auto-updates */
const VER = "typhone-v1.2.2";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./data.js","./manifest.webmanifest","./icon-180.png","./icon-512.png"];
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VER).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const url=new URL(e.request.url);
  if (url.origin!==location.origin) return; // API calls etc. go straight out
  e.respondWith(
    caches.match(e.request).then(hit=>{
      const net=fetch(e.request).then(res=>{ if(res.ok) caches.open(VER).then(c=>c.put(e.request,res.clone())); return res; }).catch(()=>hit);
      return hit || net;
    })
  );
});
