const CACHE = "tempo-pointage-v1-1";
const FILES = ["./", "./index.html", "./style.css", "./app.js", "./xlsx-lite.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install",event=>{ event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",event=>{ event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])); });
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET" || new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
