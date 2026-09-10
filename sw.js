const C='akk-v9';
const SHELL=['./','./index.html','./styles.css','./data.js','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('push',e=>{e.waitUntil((async()=>{
  let d=null;try{const r=await fetch('https://divine-guide.ankitsamriwal.workers.dev/push-data',{headers:{'x-push-key':'1OI7dIZ5gi9od8fMsp6xBeMo16iYSfS2'}});d=await r.json()}catch(_){}
  const meals=d&&d.meals&&d.meals.length?d.meals.join(', '):"Your plan for tomorrow is ready";
  const n=d&&d.items?d.items.length:0;
  await self.registration.showNotification("Tomorrow's meals",{body:meals+(n?' - '+n+' item'+(n===1?'':'s')+' to order.':''),icon:'./icons/icon-192.png',badge:'./icons/icon-192.png'});
})())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('./#week'))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin){e.respondWith(fetch(e.request).catch(()=>new Response('offline',{status:503})));return}
  // network-first: fresh deploys win immediately, cache is the offline fallback
  e.respondWith(fetch(e.request).then(n=>{const cl=n.clone();caches.open(C).then(c=>c.put(e.request,cl));return n}).catch(()=>caches.match(e.request)));
});
