/* Sijil service worker: the app opens instantly and works without Internet. */
var V = "sijil-v24";
var RT = "sijil-rt-v1";
var SHELL = ["./", "index.html", "local-db.js", "manifest.webmanifest", "icons/emb-192.png", "icons/emb-512.png", "icons/emb-mask-512.png", "icons/emb-180.png", "icons/emb-32.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== RT; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function swr(cacheName, req, key) {
  return caches.open(cacheName).then(function (c) {
    return c.match(key || req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) c.put(key || req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  if (u.origin === self.location.origin) {
    if (r.mode === "navigate") { e.respondWith(swr(V, r, "index.html")); return; }
    e.respondWith(swr(V, r));
    return;
  }
  if (/(^|\.)fonts\.googleapis\.com$|(^|\.)gstatic\.com$|(^|\.)cdnjs\.cloudflare\.com$/.test(u.hostname)) e.respondWith(swr(RT, r));
});
