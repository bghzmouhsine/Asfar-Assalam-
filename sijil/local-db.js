/* Sijil — stockage local (sur ce téléphone) + installation de l'application. */
(function () {
  "use strict";
  window.SIJIL_LOCAL = true;
  var PFX = "sijil:doc:";
  var LS = null;
  try { LS = window.localStorage; LS.setItem("sijil:probe", "1"); LS.removeItem("sijil:probe"); } catch (e) { LS = null; }
  var MEM = {};
  function read(p) { try { var v = LS ? LS.getItem(PFX + p) : MEM[p]; return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
  function write(p, v) { var s = JSON.stringify(v); if (LS) LS.setItem(PFX + p, s); else MEM[p] = s; }
  function del(p) { if (LS) LS.removeItem(PFX + p); else delete MEM[p]; }
  function keys() {
    if (!LS) return Object.keys(MEM);
    var out = [];
    for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k && k.indexOf(PFX) === 0) out.push(k.slice(PFX.length)); }
    return out;
  }
  function segs(p) { return p.split("/").length; }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function guard(fn) {
    try { return fn(); } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) throw err("quota_exceeded", "storage full");
      throw err("unavailable", String((e && e.message) || e));
    }
  }
  var listeners = [];
  var queued = false;
  function notify() {
    if (queued) return; queued = true;
    Promise.resolve().then(function () { queued = false; listeners.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); });
  }
  function on(f) { listeners.push(f); setTimeout(f, 0); return function () { var i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }
  function docSnap(p) { var v = read(p); return { id: p.split("/").pop(), ref: { path: p }, exists: v !== undefined, data: function () { return clone(v); }, metadata: { hasPendingWrites: false, fromCache: true } }; }
  function qSnap(c) {
    var n = segs(c) + 1;
    var docs = keys().filter(function (k) { return k.indexOf(c + "/") === 0 && segs(k) === n; }).sort().map(docSnap);
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: true } };
  }
  function merge(a, b) {
    Object.keys(b).forEach(function (k) {
      var v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && v.__delete__ === true) { delete a[k]; return; }
      if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) a[k] = merge(a[k], v); else a[k] = v;
    });
    return a;
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function doc(p) {
    return {
      id: p.split("/").pop(), path: p,
      get: function () { return Promise.resolve(docSnap(p)); },
      set: function (d) { return new Promise(function (res) { guard(function () { write(p, clone(d)); }); notify(); res(); }); },
      update: function (d) {
        return new Promise(function (res) {
          var cur = read(p);
          if (cur === undefined) throw err("not_found", "document does not exist");
          guard(function () { write(p, merge(cur, clone(d))); }); notify(); res();
        });
      },
      delete: function () { del(p); notify(); return Promise.resolve(); },
      onSnapshot: function (next) { var last = null; return on(function () { var s = JSON.stringify(read(p)) || ""; if (s === last) return; last = s; next(docSnap(p)); }); },
    };
  }
  function collection(c) {
    var api = {
      path: c,
      doc: function (id) { return doc(c + "/" + (id || newId())); },
      get: function () { return Promise.resolve(qSnap(c)); },
      add: function (d) { return new Promise(function (res) { var id = newId(); guard(function () { write(c + "/" + id, clone(d)); }); notify(); res({ id: id, path: c + "/" + id }); }); },
      onSnapshot: function (next) {
        var last = null;
        return on(function () {
          var s = qSnap(c);
          var sig = s.docs.map(function (x) { return x.id + "=" + (JSON.stringify(read(c + "/" + x.id)) || ""); }).join("|");
          if (sig === last) return; last = sig; next(s);
        });
      },
      where: function () { return api; }, orderBy: function () { return api; }, limit: function () { return api; },
    };
    return api;
  }
  window.addEventListener("storage", function (e) { if (!e.key || e.key.indexOf(PFX) === 0) notify(); });
  var MIME = { pdf: "application/pdf", json: "application/json", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv" };
  var downloads = {
    save: function (r) {
      return new Promise(function (res, rej) {
        try {
          var ext = String(r.filename || "").split(".").pop().toLowerCase();
          var blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: MIME[ext] || "application/octet-stream" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = r.filename || "sijil"; a.rel = "noopener"; a.style.display = "none";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
          res({ status: "saved" });
        } catch (e) { rej(err("unavailable", String(e))); }
      });
    },
  };
  var user = { can: function () { return Promise.resolve(true); }, isOwner: function () { return true; }, canEdit: function () { return true; }, id: function () { return Promise.resolve("local"); } };
  var db = { doc: doc, collection: collection };
  window.claude = { use: function (name) { return Promise.resolve(name === "db" ? db : name === "user" ? user : name === "downloads" ? downloads : null); } };

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* optional */ }
  if ("serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      /* a new version was just installed: reload once, but only right after opening so nothing typed is lost */
      if (hadController && !window.__sijilReloaded && performance.now() < 20000) { window.__sijilReloaded = true; location.reload(); }
    });
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  /* ---------- "install the app" banner (Android Chrome) */
  var deferred = null;
  function isStandalone() { try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; } }
  function T(ar, fr) { return (document.documentElement.getAttribute("lang") === "fr") ? fr : ar; }
  function showInstall() {
    if (isStandalone() || document.getElementById("pwaInstall")) return;
    var b = document.createElement("div");
    b.id = "pwaInstall";
    b.setAttribute("role", "dialog");
    b.style.cssText = "position:fixed;left:12px;right:12px;z-index:70;bottom:calc(var(--nav-h,62px) + 14px + env(safe-area-inset-bottom,0px));" +
      "background:var(--hero,#172E6E);color:#fff;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:560px;margin:0 auto";
    b.innerHTML = '<img src="icons/icon-192.png" alt="" width="44" height="44" style="border-radius:11px;flex:none">' +
      '<div style="flex:1;min-width:0;font-size:13px;line-height:1.5"><b style="display:block;font-size:14px">' + T("ثبّت التطبيق على هاتفك", "Installer l'application") + '</b>' +
      T("أيقونة في قائمة التطبيقات، يفتح بضغطة ويعمل بدون إنترنت.", "Une icône sur votre téléphone, ouverture immédiate, sans Internet.") + '</div>' +
      '<button type="button" id="pwaGo" style="flex:none;border:0;border-radius:11px;background:var(--gold,#D69A1F);color:#1B1405;font-weight:700;font-size:14px;padding:10px 16px;font-family:inherit">' + T("تثبيت", "Installer") + '</button>' +
      '<button type="button" id="pwaX" aria-label="' + T("إغلاق", "Fermer") + '" style="flex:none;border:0;background:transparent;color:#fff;font-size:20px;line-height:1;padding:4px 6px">×</button>';
    document.body.appendChild(b);
    document.getElementById("pwaGo").addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; hideInstall(); }).catch(function () {});
    });
    document.getElementById("pwaX").addEventListener("click", hideInstall);
  }
  function hideInstall() { var b = document.getElementById("pwaInstall"); if (b) b.remove(); }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; if (document.body) showInstall(); else window.addEventListener("DOMContentLoaded", showInstall); });
  window.addEventListener("appinstalled", hideInstall);
})();
