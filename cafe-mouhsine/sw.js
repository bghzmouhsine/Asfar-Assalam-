/* Café Mouhsine BOUAGHAZ — offline support (app shell + cached images) */
const CACHE = "cafe-mouhsine-v6";
const SHELL = ["./", "./index.html", "./menu-print.html", "./kitchen.html", "./legal.html", "./js/legal-texts.js", "./css/styles.css", "./js/data.js", "./js/i18n.js", "./js/app.js", "./js/firebase-config.js", "./js/cloud-store.js", "./assets/icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // same-origin: network first so price edits show up, fall back to cache offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  // product photos & fonts: cache first
  if (/images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|www\.gstatic\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
});
