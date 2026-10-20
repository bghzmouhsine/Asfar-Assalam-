/* Sijil — stockage (téléphone, ou nuage Firebase si activé) + installation de l'application. */
(function () {
  "use strict";
  window.SIJIL_LOCAL = true;
  var PFX = "sijil:doc:";
  var CLOUD_KEY = "sijil.cloud";
  var FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  var LS = null;
  try { LS = window.localStorage; LS.setItem("sijil:probe", "1"); LS.removeItem("sijil:probe"); } catch (e) { LS = null; }
  var MEM = {};
  function T(ar, fr) { return document.documentElement.getAttribute("lang") === "fr" ? fr : ar; }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function getJ(k) { try { return JSON.parse(LS ? LS.getItem(k) : "null"); } catch (e) { return null; } }
  function setJ(k, v) { try { if (LS) LS.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  /* =================================================================== local store (this phone) */
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
  function localDoc(p) {
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
  function localCollection(c) {
    var api = {
      path: c,
      doc: function (id) { return localDoc(c + "/" + (id || newId())); },
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
  var localDb = { doc: localDoc, collection: localCollection };

  /* =================================================================== cloud store (Firebase) */
  var cloud = { cfg: null, app: null, auth: null, fs: null, m: null, user: null, base: "" };
  /* view-only link: this device only looks at someone else's register and never writes */
  var VIEW_KEY = "sijil.view", VIEW = null, badViewLink = false;
  /* the Firebase project of this site (public identifiers, not secrets): lets a view link be a short code (#v=…) */
  var HOME_CFG = /*HOME_CFG*/null;
  /* short public address of this app: a redirect that keeps the #… part of the link */
  var SHORT_BASE = /*SHORT_BASE*/"";
  var CODE_RE = /^[a-km-z2-9]{12}$/;
  function codeView(code, role) {
    var f = role === "f", v = { c: HOME_CFG, o: "", e: (f ? "fore." : "view.") + code + "@example.com", p: code + (f ? "-f" : "-v"), k: code };
    if (f) v.r = "f";
    return v;
  }
  function b64e(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  function validView(v) { return !!(v && v.c && v.c.apiKey && v.c.projectId && v.c.appId && typeof v.o === "string" && typeof v.e === "string" && v.e && typeof v.p === "string" && v.p); }
  function readOnly() { return Promise.reject(err("invalid_argument", "view-only link: writing is not allowed")); }
  function fmWritable(p) { return FMODE && /^subs\/\d{4}-\d{2}-\d{2}$/.test(p); }
  function syncError(e) {
    console.error(e);
    var code = (e && e.code) || "";
    if (VIEW) { if (/permission-denied|unauthenticated/.test(code)) viewStopped(e); return; }
    var msg = code.indexOf("permission-denied") >= 0 ? T("السحابة ترفض الحفظ: انشر قواعد الأمان (الخطوة 4 في الإعدادات).", "Le nuage refuse l'enregistrement : publiez les règles de sécurité (étape 4).")
      : T("تعذّرت المزامنة مع السحابة: ", "Synchronisation impossible : ") + (e && e.message ? e.message : code);
    banner(msg, true);
  }
  function snapOf(s) { return { id: s.id, ref: { path: s.ref.path }, exists: s.exists(), data: function () { return s.data(); }, metadata: { hasPendingWrites: s.metadata.hasPendingWrites, fromCache: s.metadata.fromCache } }; }
  function clean(d) { return JSON.parse(JSON.stringify(d)); }
  function cloudDoc(p) {
    var m = cloud.m, ref = m.doc(cloud.fs, cloud.base + p);
    return {
      id: ref.id, path: p,
      get: function () { return m.getDoc(ref).then(snapOf); },
      /* writes are applied to the phone's copy at once and sent when there is a connection */
      set: function (d) { if (VIEW && !fmWritable(p)) return readOnly(); var x = clean(d); m.setDoc(ref, x).catch(syncError); mirrorOp("set", p, x); return Promise.resolve(); },
      update: function (d) { if (VIEW && !fmWritable(p)) return readOnly(); var x = clean(d); m.setDoc(ref, x, { merge: true }).catch(syncError); mirrorOp("merge", p, x); return Promise.resolve(); },
      delete: function () { if (VIEW && !fmWritable(p)) return readOnly(); m.deleteDoc(ref).catch(syncError); mirrorOp("del", p); return Promise.resolve(); },
      onSnapshot: function (next, error) { return m.onSnapshot(ref, function (s) { next(snapOf(s)); }, function (e) { syncError(e); if (error) error(e); }); },
    };
  }
  function cloudCollection(c) {
    var m = cloud.m, cref = m.collection(cloud.fs, cloud.base + c);
    function qs(q) { var docs = q.docs.map(snapOf); return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: q.metadata.fromCache } }; }
    var api = {
      path: c,
      doc: function (id) { return cloudDoc(c + "/" + (id || m.doc(cref).id)); },
      get: function () { return m.getDocs(cref).then(qs); },
      add: function (d) { if (VIEW) return readOnly(); var ref = m.doc(cref), x = clean(d); m.setDoc(ref, x).catch(syncError); mirrorOp("set", c + "/" + ref.id, x); return Promise.resolve({ id: ref.id, path: c + "/" + ref.id }); },
      onSnapshot: function (next, error) { return m.onSnapshot(cref, function (q) { next(qs(q)); }, function (e) { syncError(e); if (error) error(e); }); },
      where: function () { return api; }, orderBy: function () { return api; }, limit: function () { return api; },
    };
    return api;
  }
  var cloudDb = { doc: cloudDoc, collection: cloudCollection };

  function parseConfig(text) {
    var out = {}, re = /(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)\s*["']?\s*:\s*["']([^"']+)["']/g, x;
    while ((x = re.exec(String(text || "")))) out[x[1]] = x[2];
    if (!out.apiKey || !out.projectId || !out.appId) return null;
    if (!out.authDomain) out.authDomain = out.projectId + ".firebaseapp.com";
    return out;
  }
  function loadFirebase(cfg, name) {
    name = name || "sijil";
    if (cloud.m && cloud.cfg && cloud.cfg.projectId === cfg.projectId && cloud.app && cloud.app.name === name) return Promise.resolve(cloud);
    return Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]).then(function (mods) {
      var A = mods[0], Au = mods[1], F = mods[2];
      var app = A.initializeApp(cfg, name);
      var fs;
      try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
      catch (e) { fs = F.getFirestore(app); }
      cloud.cfg = cfg; cloud.app = app; cloud.auth = Au.getAuth(app); cloud.fs = fs;
      cloud.m = { doc: F.doc, collection: F.collection, getDoc: F.getDoc, getDocs: F.getDocs, setDoc: F.setDoc, deleteDoc: F.deleteDoc, onSnapshot: F.onSnapshot, writeBatch: F.writeBatch };
      cloud.au = Au; cloud.A = A; cloud.F = F;
      return cloud;
    });
  }
  function firstUser() {
    return new Promise(function (res) { var off = cloud.au.onAuthStateChanged(cloud.auth, function (u) { off(); res(u); }); });
  }
  function authText(e) {
    var c = (e && e.code) || "";
    if (c.indexOf("email-already-in-use") >= 0) return T("هذا البريد له حساب من قبل: استعمل «دخول».", "Cette adresse a déjà un compte : utilisez « Connexion ».");
    if (c.indexOf("invalid-credential") >= 0 || c.indexOf("wrong-password") >= 0 || c.indexOf("user-not-found") >= 0) return T("البريد أو كلمة المرور غير صحيحة.", "E-mail ou mot de passe incorrect.");
    if (c.indexOf("weak-password") >= 0) return T("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "Le mot de passe doit contenir au moins 6 caractères.");
    if (c.indexOf("invalid-email") >= 0) return T("البريد الإلكتروني غير صحيح.", "Adresse e-mail invalide.");
    if (c.indexOf("operation-not-allowed") >= 0 || c.indexOf("configuration-not-found") >= 0) return T("فعّل «Email/Password» في Authentication (الخطوة 3).", "Activez « E-mail/Mot de passe » dans Authentication (étape 3).");
    if (c.indexOf("api-key") >= 0) return T("إعدادات Firebase غير صحيحة: انسخها من جديد (الخطوة 5).", "Configuration Firebase invalide : recopiez-la (étape 5).");
    if (c.indexOf("network") >= 0) return T("لا يوجد اتصال بالإنترنت.", "Pas de connexion Internet.");
    if (c.indexOf("too-many-requests") >= 0) return T("محاولات كثيرة، انتظر قليلاً.", "Trop de tentatives, patientez un peu.");
    if (/does not exist|not-found|NOT_FOUND/.test((e && e.message) || "") || c.indexOf("not-found") >= 0) return T("أنشئ قاعدة Firestore Database (الخطوة 2).", "Créez la base Firestore Database (étape 2).");
    if (c.indexOf("permission-denied") >= 0) return T("السحابة ترفض الوصول: انشر قواعد الأمان (الخطوة 4).", "Accès refusé : publiez les règles de sécurité (étape 4).");
    return (e && e.message) || String(e);
  }
  /* copies everything on this phone to the cloud (first activation) */
  function uploadLocal() {
    var m = cloud.m, all = keys().filter(function (k) { return segs(k) % 2 === 0; }), chunks = [];
    for (var i = 0; i < all.length; i += 400) chunks.push(all.slice(i, i + 400));
    return chunks.reduce(function (pr, part) {
      return pr.then(function () {
        var b = m.writeBatch(cloud.fs);
        part.forEach(function (k) { var v = read(k); if (v !== undefined) b.set(m.doc(cloud.fs, cloud.base + k), clean(v)); });
        return b.commit();
      });
    }, Promise.resolve()).then(function () { return all.length; });
  }
  /* copies the cloud data back to the phone (when cloud saving is turned off) */
  function downloadCloud() {
    var m = cloud.m, cols = ["workers", "days", "payments", "audit", "safety", "photos", "gallery"];
    return Promise.all([m.getDoc(m.doc(cloud.fs, cloud.base + "app/settings"))].concat(cols.map(function (c) { return m.getDocs(m.collection(cloud.fs, cloud.base + c)); }))).then(function (res) {
      if (res[0].exists()) write("app/settings", res[0].data());
      cols.forEach(function (c, i) {
        keys().filter(function (k) { return k.indexOf(c + "/") === 0 && segs(k) === 2; }).forEach(del);
        res[i + 1].docs.forEach(function (d) { write(c + "/" + d.id, d.data()); });
      });
    });
  }
  function cloudHasData() {
    return cloud.m.getDocs(cloud.m.collection(cloud.fs, cloud.base + "workers")).then(function (q) { return !q.empty; });
  }

  /* =================================================================== mode at startup */
  var hashCfg = null;
  try {
    var hm = /[#&]cloud=([A-Za-z0-9_\-+/=]+)/.exec(location.hash);
    if (hm) {
      hashCfg = parseConfig(decodeURIComponent(escape(atob(hm[1].replace(/-/g, "+").replace(/_/g, "/")))));
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (e) { hashCfg = null; }
  try {
    var vc = /[#&]v=([a-z0-9]+)/.exec(location.hash);
    if (vc) {
      if (HOME_CFG && CODE_RE.test(vc[1])) setJ(VIEW_KEY, codeView(vc[1])); else { badViewLink = true; try { if (LS) LS.removeItem(VIEW_KEY); } catch (x) { /* ignore */ } }
      history.replaceState(null, "", location.pathname + location.search);
    }
    var fc = /[#&]f=([a-z0-9]+)/.exec(location.hash);
    if (fc) {
      if (HOME_CFG && CODE_RE.test(fc[1])) setJ(VIEW_KEY, codeView(fc[1], "f")); else { badViewLink = true; try { if (LS) LS.removeItem(VIEW_KEY); } catch (x) { /* ignore */ } }
      history.replaceState(null, "", location.pathname + location.search);
    }
    var vm = /[#&]view=([A-Za-z0-9_\-+/=]+)/.exec(location.hash);
    if (vm) {
      var vv = null;
      try { vv = b64d(vm[1]); } catch (x) { vv = null; }
      if (validView(vv)) { if (!vv.c.authDomain) vv.c.authDomain = vv.c.projectId + ".firebaseapp.com"; setJ(VIEW_KEY, vv); } else { badViewLink = true; try { if (LS) LS.removeItem(VIEW_KEY); } catch (x) { /* ignore */ } }
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (e) { badViewLink = true; }
  VIEW = getJ(VIEW_KEY);
  if (!validView(VIEW)) VIEW = null;
  var saved = getJ(CLOUD_KEY), skip = false;
  try { skip = sessionStorage.getItem("sijil.cloud.skip") === "1"; } catch (e) { skip = false; }
  if (hashCfg) { saved = { cfg: hashCfg, pending: true }; setJ(CLOUD_KEY, saved); }
  /* the owner's own device (cloud saving set up for the same project) never turns into a view-only copy */
  if (VIEW && saved && saved.cfg && saved.cfg.projectId === VIEW.c.projectId) {
    var wasFm = VIEW.r === "f";
    try { if (LS) LS.removeItem(VIEW_KEY); } catch (e) { /* ignore */ }
    VIEW = null;
    whenBody(function () {
      if (wasFm) { banner(T("هذا رابط رئيس الورش الخاص بسجلك: على هاتفك يبقى السجل كما هو، وعند رئيس الورش يُفتح لتسجيل الحضور فقط وإرساله إليك للاعتماد.", "C'est le lien chef de chantier de votre registre : sur votre téléphone le registre reste inchangé ; chez le chef de chantier, il sert uniquement à saisir les présences et à vous les envoyer pour validation."), false); return; }
      banner(T("هذا رابط المشاهدة الخاص بسجلك: على هاتفك يبقى السجل قابلاً للتعديل كما هو، وعند من ترسله إليه يُفتح للاطلاع فقط. لتجربته اضغط «تجربة الرابط» في الإعدادات.",
        "C'est le lien de consultation de votre registre : sur votre téléphone le registre reste modifiable ; chez la personne qui le reçoit, il s'ouvre en lecture seule. Pour le vérifier, appuyez sur « Tester le lien » dans les paramètres."), false);
    });
  }
  /* the site foreman's link: like a view-only link, but it can send the day's attendance (subs/…) for the owner to approve */
  var FMODE = !!(VIEW && VIEW.r === "f");
  var dbReady;
  if (VIEW) {
    /* view-only: sign in with the link's own viewer account and read the owner's register */
    window.SIJIL_CLOUD = true;
    if (FMODE) { window.SIJIL_FOREMAN = true; document.documentElement.classList.add("cloud-on", "fm-on"); }
    else { window.SIJIL_VIEW = true; document.documentElement.classList.add("cloud-on", "view-on"); }
    dbReady = loadFirebase(VIEW.c, "sijilview").then(firstUser).then(function (u) {
      if (u && String(u.email || "").toLowerCase() === VIEW.e.toLowerCase()) return u;
      return cloud.au.signInWithEmailAndPassword(cloud.auth, VIEW.e, VIEW.p).then(function (c) { return c.user; });
    }).then(function (u) {
      cloud.user = u; cloud.base = "sijil/" + (VIEW.o || u.uid) + "/";
      /* a link reads its own copy (sijil/<link uid>); the copy carries app/viewer while the link is active */
      var own = !VIEW.o || VIEW.o === u.uid;
      return cloud.m.getDoc(cloud.m.doc(cloud.fs, cloud.base + (own ? "app/viewer" : "app/settings"))).then(function (sn) {
        if (own && !sn.exists() && !(sn.metadata && sn.metadata.fromCache)) throw err("stopped", "link stopped");
      }, function (e) {
        if (/permission-denied|unauthenticated/.test(String((e && e.code) || ""))) throw e;
        /* offline: show what this device already has */
      });
    }).then(function () {
      /* the owner stopping the link removes app/viewer from the copy: show it at once */
      var seen = false;
      cloud.m.onSnapshot(cloud.m.doc(cloud.fs, cloud.base + "app/viewer"), function (sn) { if (sn.exists()) seen = true; else if (seen) viewStopped({ code: "stopped" }); }, function () { /* the data listeners report it */ });
      return cloudDb;
    }, function (e) { console.error(e); return viewStopped(e); });
  } else if (badViewLink && !(saved && saved.cfg)) {
    dbReady = viewStopped({ code: "bad-link" });
  } else if (saved && saved.cfg && !skip) {
    window.SIJIL_CLOUD = true;
    document.documentElement.classList.add("cloud-on");
    dbReady = loadFirebase(saved.cfg).then(firstUser).then(function (u) {
      if (u) return u;
      return loginScreen();
    }).then(function (u) {
      cloud.user = u; cloud.base = "sijil/" + u.uid + "/";
      setJ(CLOUD_KEY, { cfg: saved.cfg, email: u.email || saved.email || "", since: saved.since || new Date().toISOString() });
      return cloudDb;
    }).catch(function (e) {
      console.error(e);
      window.SIJIL_CLOUD = false;
      document.documentElement.classList.remove("cloud-on");
      banner(T("تعذّر الاتصال بالسحابة، يعمل التطبيق الآن بنسخة الهاتف. ", "Nuage injoignable : l'application utilise la copie du téléphone. ") + authText(e), true);
      return localDb;
    });
  } else {
    dbReady = Promise.resolve(localDb);
  }

  /* =================================================================== small UI helpers */
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  /* runs once the whole page is parsed (the Firebase answer can arrive before the settings and top bar exist) */
  function whenBody(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function banner(msg, bad) {
    whenBody(function () {
      var b = document.getElementById("sjBanner");
      if (!b) {
        b = el('<div id="sjBanner" role="status" style="position:fixed;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:90;max-width:560px;margin:0 auto;border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.2);display:flex;gap:10px;align-items:flex-start"><span style="flex:1"></span><button type="button" style="border:0;background:transparent;font-size:18px;line-height:1;color:inherit;padding:0 4px">×</button></div>');
        document.body.appendChild(b);
        b.querySelector("button").addEventListener("click", function () { b.remove(); });
      }
      b.style.background = bad ? "#FBE2DF" : "#DBF1E5"; b.style.color = bad ? "#8A1F17" : "#0F5536";
      b.querySelector("span").textContent = msg;
      clearTimeout(banner.t); banner.t = setTimeout(function () { if (b.parentNode) b.remove(); }, 9000);
    });
  }
  var CSS = '#sjLogin{position:fixed;inset:0;z-index:95;background:var(--bg,#F2F4F8);display:flex;align-items:center;justify-content:center;padding:24px max(16px,env(safe-area-inset-left,0px)) 24px max(16px,env(safe-area-inset-right,0px));overflow:auto}' +
    '#sjLogin .bx{width:100%;max-width:420px;background:var(--surface,#fff);border:1px solid var(--line,#DBE1EB);border-radius:18px;padding:22px 18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 10px 30px rgba(19,26,43,.08)}' +
    '#sjLogin h2{margin:0;font-size:18px;color:var(--ink,#131A2B)}#sjLogin p{margin:0;color:var(--muted,#5B6578);font-size:12.5px}' +
    '.sjf{display:flex;flex-direction:column;gap:6px}.sjf label{font-size:12px;font-weight:600;color:var(--muted,#5B6578)}' +
    '.sjf input,.sjf textarea{height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--line,#DBE1EB);background:var(--surface-2,#EDF0F6);color:var(--ink,#131A2B);font:inherit;font-size:16px;width:100%;box-sizing:border-box}' +
    '.sjf textarea{height:auto;min-height:110px;padding:10px 12px;font-size:13px;direction:ltr;text-align:left}' +
    '.sjb{min-height:46px;border-radius:12px;border:1px solid var(--line,#DBE1EB);background:var(--surface,#fff);color:var(--ink,#131A2B);font:inherit;font-weight:700;font-size:14px;padding:0 16px;cursor:pointer}' +
    '.sjb.p{background:var(--brand,#1E3A8A);border-color:var(--brand,#1E3A8A);color:var(--brand-ink,#fff)}.sjb.g{background:transparent;border-color:transparent;color:var(--link,#2448A8)}' +
    '.sjrow{display:flex;gap:8px;flex-wrap:wrap}.sjerr{color:var(--bad,#C0362C);font-weight:700;font-size:12.5px;min-height:1.2em;margin:0}' +
    '.sjsteps{margin:0;padding-inline-start:20px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.7;color:var(--ink,#131A2B)}.sjsteps b{font-weight:700}' +
    '.sjcode{direction:ltr;text-align:left;white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--surface-2,#EDF0F6);border-radius:10px;padding:10px;margin:0;overflow-x:auto}' +
    'html.cloud-on #protCard{display:none}html.view-on #bkCard{display:none}' +
    '#shareCard,#fmCard{display:flex;flex-direction:column;gap:10px;scroll-margin-top:calc(84px + env(safe-area-inset-top,0px))}#shareCard[hidden],#fmCard[hidden]{display:none}.sjsb{display:flex;flex-direction:column;gap:10px}#shareCard a.btn{text-decoration:none}' +
    '.sjres{display:flex;flex-direction:column;gap:8px}.sjlink{height:38px;padding:0 10px;border-radius:10px;border:1px solid var(--line,#DBE1EB);background:var(--surface-2,#EDF0F6);color:var(--ink,#131A2B);font:12px/1 ui-monospace,Menlo,Consolas,monospace;width:100%;box-sizing:border-box;direction:ltr;text-align:left}';
  whenBody(function () { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); });

  /* login screen shown when cloud saving is on but nobody is signed in on this device */
  function loginScreen() {
    return new Promise(function (resolve) {
      whenBody(function () {
        var box = el('<div id="sjLogin"><div class="bx">' +
          '<h2>' + T("الدخول إلى السجل", "Connexion au registre") + '</h2>' +
          '<p>' + T("السجل محفوظ في السحابة. ادخل بالبريد وكلمة المرور اللذين اخترتهما عند التفعيل.", "Le registre est enregistré dans le nuage. Connectez-vous avec l'e-mail et le mot de passe choisis à l'activation.") + '</p>' +
          '<div class="sjf"><label for="sjE">' + T("البريد الإلكتروني", "E-mail") + '</label><input id="sjE" type="email" autocomplete="username" dir="ltr"></div>' +
          '<div class="sjf"><label for="sjP">' + T("كلمة المرور", "Mot de passe") + '</label><input id="sjP" type="password" autocomplete="current-password" dir="ltr"></div>' +
          '<p class="sjerr" id="sjErr"></p>' +
          '<div class="sjrow"><button class="sjb p" id="sjGo" type="button">' + T("دخول", "Connexion") + '</button><button class="sjb" id="sjNew" type="button">' + T("إنشاء حساب", "Créer un compte") + '</button></div>' +
          '<div class="sjrow"><button class="sjb g" id="sjForgot" type="button">' + T("نسيت كلمة المرور", "Mot de passe oublié") + '</button><button class="sjb g" id="sjLocal" type="button">' + T("العمل بنسخة الهاتف بدون سحابة", "Utiliser la copie du téléphone, sans nuage") + '</button></div>' +
          '</div></div>');
        document.body.appendChild(box);
        var E = box.querySelector("#sjE"), P = box.querySelector("#sjP"), ER = box.querySelector("#sjErr");
        var st = getJ(CLOUD_KEY) || {}; if (st.email) E.value = st.email;
        function go(create) {
          ER.textContent = "";
          var fn = create ? cloud.au.createUserWithEmailAndPassword : cloud.au.signInWithEmailAndPassword;
          fn(cloud.auth, E.value.trim(), P.value).then(function (cred) { box.remove(); resolve(cred.user); }).catch(function (e) { ER.textContent = authText(e); });
        }
        box.querySelector("#sjGo").addEventListener("click", function () { go(false); });
        box.querySelector("#sjNew").addEventListener("click", function () { go(true); });
        P.addEventListener("keydown", function (e) { if (e.key === "Enter") go(false); });
        box.querySelector("#sjForgot").addEventListener("click", function () {
          if (!E.value.trim()) { ER.textContent = T("اكتب بريدك أولاً.", "Saisissez d'abord votre e-mail."); return; }
          cloud.au.sendPasswordResetEmail(cloud.auth, E.value.trim()).then(function () { ER.textContent = T("أرسلنا رابط تغيير كلمة المرور إلى بريدك.", "Un lien de réinitialisation a été envoyé."); }).catch(function (e) { ER.textContent = authText(e); });
        });
        box.querySelector("#sjLocal").addEventListener("click", function () { try { sessionStorage.setItem("sijil.cloud.skip", "1"); } catch (e) { /* ignore */ } location.reload(); });
      });
    });
  }

  /* full-screen message when a view-only link cannot be used (stopped by the owner, invalid, offline) */
  function viewStopped(e) {
    var c = String((e && e.code) || "");
    var title = FMODE ? T("رابط رئيس الورش غير متاح", "Lien du chef de chantier indisponible") : T("رابط المشاهدة غير متاح", "Lien de consultation indisponible"), msg;
    if (/permission-denied|unauthenticated|stopped|invalid-credential|user-not-found|wrong-password|user-disabled|user-token-expired/.test(c)) msg = T("أوقف صاحب السجل هذا الرابط. اطلب منه رابطاً جديداً.", "Le propriétaire du registre a arrêté ce lien. Demandez-lui un nouveau lien.");
    else if (c === "bad-link") msg = T("الرابط ناقص: افتحه كاملاً كما وصلك، أو اطلب من صاحب السجل رابطاً جديداً.", "Lien incomplet : ouvrez-le en entier tel que reçu, ou demandez un nouveau lien au propriétaire du registre.");
    else if (/invalid-email/.test(c)) msg = T("هذا الرابط لم يعد صالحاً. اطلب من صاحب السجل رابطاً جديداً.", "Ce lien n'est plus valide. Demandez un nouveau lien au propriétaire du registre.");
    else if (/network|unavailable|offline|deadline/.test(c) || !c) { title = T("لا يوجد اتصال", "Pas de connexion"); msg = T("تعذّر الاتصال بالإنترنت. تحقّق من الاتصال ثم أعد المحاولة.", "Connexion impossible. Vérifiez Internet puis réessayez.") + (c ? " [" + c + "]" : ""); }
    else msg = T("تعذّر فتح السجل: ", "Ouverture du registre impossible : ") + authText(e) + " [" + c + "]";
    return new Promise(function () {
      whenBody(function () {
        if (document.getElementById("sjLogin")) return;
        var box = el('<div id="sjLogin"><div class="bx"><h2></h2><p></p><div class="sjrow">' +
          '<button class="sjb p" type="button" id="sjRetry">' + T("إعادة المحاولة", "Réessayer") + '</button>' +
          '<button class="sjb g" type="button" id="sjExitView">' + (FMODE ? T("الخروج من وضع رئيس الورش", "Quitter le mode chef de chantier") : T("الخروج من وضع المشاهدة", "Quitter la consultation")) + '</button></div></div></div>');
        box.querySelector("h2").textContent = title; box.querySelector("p").textContent = msg;
        document.body.appendChild(box);
        box.querySelector("#sjRetry").addEventListener("click", function () { location.reload(); });
        box.querySelector("#sjExitView").addEventListener("click", exitView);
      });
    });
  }
  window.SIJIL_EXIT_VIEW = function () { exitView(); };
  function exitView() {
    try { if (LS) LS.removeItem(VIEW_KEY); } catch (x) { /* ignore */ }
    var done = function () { location.reload(); };
    if (VIEW && cloud.au && cloud.auth) cloud.au.signOut(cloud.auth).then(done, done); else done();
  }

  /* =================================================================== settings card "cloud saving" */
  var RULES = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /sijil/{uid}/{document=**} {\n      allow read, write: if request.auth != null && request.auth.uid == uid;\n    }\n  }\n}";

  /* ---------- view-only links (owner side)
     Each link gets its own small Firebase account. The owner's app keeps a copy of the register in that account
     (sijil/<link uid>/…) up to date; the person with the link reads only that copy, so the owner's register can
     never be touched from the link, and nothing has to be changed in Firebase. */
  var MIR = { ready: false, list: [], pre: [], overflow: false, waiters: [] };
  var MIR_COLS = ["workers", "days", "payments", "audit", "photos", "gallery"];
  /* the foreman's copy: names and attendance only */
  var FM_COLS = ["workers", "days"];
  var FM_KEEP = { "app/settings": ["siteName", "startDate", "hourFrom", "hourTo"], workers: ["name", "joinDate", "exitDate"], days: ["date", "statuses", "times", "savedAt"] };
  function fmKeys(p) { return FM_KEEP[p === "app/settings" ? p : p.split("/")[0]] || null; }
  function fmPick(p, d) { var ks = fmKeys(p), o = {}; if (!ks || !d) return o; ks.forEach(function (k) { if (d[k] !== undefined) o[k] = d[k]; }); return o; }
  function fmOp(op) {
    if (!fmKeys(op[1])) return null;
    if (op[0] === "del") return op;
    var o = fmPick(op[1], op[2]);
    if (op[0] === "merge" && !Object.keys(o).length) return null;
    return [op[0], op[1], o];
  }
  function forLink(v, op) { return v.r === "f" ? fmOp(op) : op; }
  /* what the foreman sends (sijil/<foreman link>/subs/<date>), read by the owner's app with the link's account */
  var FMW = { subs: {}, cbs: [] };
  function fmNotify() {
    var all = [];
    MIR.list.forEach(function (v) { if (v.r === "f" && !v.gone && FMW.subs[v.uid]) all = all.concat(FMW.subs[v.uid]); });
    FMW.cbs.forEach(function (f) { try { f(all); } catch (e) { console.error(e); } });
  }
  function watchSubs(v) {
    if (v.r !== "f" || v.unsub || v.gone) return;
    run(v, function () {
      return vApp(v).then(function () {
        if (v.unsub || v.gone) return;
        var F = cloud.F;
        v.unsub = F.onSnapshot(F.collection(v.fs, "sijil/" + v.uid + "/subs"), function (q) {
          FMW.subs[v.uid] = q.docs.map(function (d) { var x = d.data() || {}; x.id = d.id; x.fid = v.uid; return x; });
          fmNotify();
        }, function (e) { console.error(e); v.unsub = null; setTimeout(function () { watchSubs(v); }, 60000); });
      });
    }).catch(function (e) { console.error(e); setTimeout(function () { watchSubs(v); }, 60000); });
  }
  function fmApi() {
    window.SIJIL_FM = {
      on: function (cb) { FMW.cbs.push(cb); setTimeout(fmNotify, 0); },
      /* the owner's decision goes back to the foreman's phone */
      mark: function (fid, date, patch) {
        var v = MIR.list.filter(function (x) { return x.uid === fid && x.r === "f" && !x.gone; })[0];
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return Promise.reject(err("not_found", "link"));
        var x = clean(patch);
        function attempt(n) {
          return run(v, function () { return vApp(v).then(function () { var F = cloud.F; return F.setDoc(F.doc(v.fs, "sijil/" + v.uid + "/subs/" + date), x, { merge: true }); }); })
            .catch(function (e) { if (n >= 4) throw e; return new Promise(function (res) { setTimeout(res, 20000); }).then(function () { return attempt(n + 1); }); });
        }
        return attempt(0);
      },
    };
  }
  function noop() {}
  function rnd(n) { var a = "abcdefghijkmnpqrstuvwxyz23456789", b = new Uint8Array(n), s = ""; crypto.getRandomValues(b); for (var i = 0; i < n; i++) s += a[b[i] % 32]; return s; }
  function isDenied(e) { return String((e && e.code) || "").indexOf("permission-denied") >= 0; }
  function errLine(e) { var c = String((e && e.code) || ""); var t = authText(e); return c && t.indexOf(c) < 0 ? t + " [" + c + "]" : t; }
  function within(p, ms) { return Promise.race([p, new Promise(function (res, rej) { setTimeout(function () { rej(err("deadline-exceeded", "timeout")); }, ms); })]); }
  function mirrorable(p) { if (p === "app/settings") return true; return p.indexOf("safety/") !== 0 && p.indexOf("app/") !== 0; }
  function mirrorOp(kind, p, d) {
    if (VIEW || !mirrorable(p)) return;
    var op = [kind, p, d];
    if (!MIR.ready) { if (MIR.pre.length < 3000) MIR.pre.push(op); else MIR.overflow = true; return; }
    MIR.list.forEach(function (v) { var o = forLink(v, op); if (o) { v.q.push(o); flushMirror(v); } });
  }
  /* one queue per link: copies and changes are applied in order */
  function run(v, fn) { var p = (v.chain || Promise.resolve()).then(fn); v.chain = p.catch(noop); return p; }
  function vApp(v) {
    if (v.fs) return Promise.resolve(v);
    var A = cloud.A, Au = cloud.au;
    var app = A.initializeApp(cloud.cfg, "sijilmir" + Date.now() + rnd(4));
    var auth = Au.initializeAuth(app, { persistence: Au.inMemoryPersistence });
    return Au.signInWithEmailAndPassword(auth, v.e, v.p).then(function () {
      v.app = app; v.auth = auth; v.fs = cloud.F.getFirestore(app); return v;
    }, function (e) { A.deleteApp(app).catch(noop); throw e; });
  }
  function closeV(v) { var a = v.app; v.app = v.auth = v.fs = null; if (a) cloud.A.deleteApp(a).catch(noop); }
  function commitOps(v, ops) {
    var F = cloud.F, mb = "sijil/" + v.uid + "/", chunks = [];
    for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
    return chunks.reduce(function (pr, part) {
      return pr.then(function () {
        var b = F.writeBatch(v.fs);
        part.forEach(function (o) {
          var ref = F.doc(v.fs, mb + o[1]);
          if (o[0] === "del") b.delete(ref); else if (o[0] === "merge") b.set(ref, o[2], { merge: true }); else b.set(ref, o[2]);
        });
        return b.commit();
      });
    }, Promise.resolve());
  }
  function flushMirror(v) {
    return run(v, function () {
      if (v.gone || !v.q.length) return;
      var ops = v.q.splice(0, v.q.length);
      return Promise.resolve().then(function () { return vApp(v); }).then(function () { return commitOps(v, ops); })
        .catch(function (e) { console.error(e); try { if (LS) LS.removeItem("sijil.mirsync." + v.uid); } catch (x) { /* ignore */ } });
    });
  }
  /* full copy of the register into the link's account (on creation, on test, and twice a day) */
  function fullSync(v) {
    return run(v, function () {
      if (v.gone) return;
      v.q = []; /* every change made so far is part of the copy below */
      var F = cloud.F, base = cloud.base, mb = "sijil/" + v.uid + "/", fm = v.r === "f", cols = fm ? FM_COLS : MIR_COLS, n = cols.length;
      var data = function (p, d) { return fm ? fmPick(p, d) : d; };
      return Promise.resolve().then(function () { return vApp(v); }).then(function () {
        return Promise.all([F.getDoc(F.doc(cloud.fs, base + "app/settings"))]
          .concat(cols.map(function (c) { return F.getDocs(F.collection(cloud.fs, base + c)); }))
          .concat(cols.map(function (c) { return F.getDocs(F.collection(v.fs, mb + c)); })));
      }).then(function (r) {
        var ops = [["set", "app/viewer", { active: true, at: new Date().toISOString(), r: fm ? "f" : "v" }]];
        if (r[0].exists()) ops.push(["set", "app/settings", data("app/settings", r[0].data())]);
        cols.forEach(function (c, i) {
          var keep = {};
          r[1 + i].docs.forEach(function (d) { keep[d.id] = 1; ops.push(["set", c + "/" + d.id, data(c + "/" + d.id, d.data())]); });
          r[1 + n + i].docs.forEach(function (d) { if (!keep[d.id]) ops.push(["del", c + "/" + d.id]); });
        });
        return commitOps(v, ops);
      }).then(function () { try { if (LS) LS.setItem("sijil.mirsync." + v.uid, String(Date.now())); } catch (x) { /* ignore */ } });
    });
  }
  function saveViewers() {
    var F = cloud.F;
    return F.setDoc(F.doc(cloud.fs, cloud.base + "app/viewers"), { list: MIR.list.map(function (v) { var o = { uid: v.uid, e: v.e, p: v.p, link: v.link, at: v.at }; if (v.r === "f") o.r = "f"; return o; }) });
  }
  function startMirrors() {
    var F = cloud.F;
    F.getDoc(F.doc(cloud.fs, cloud.base + "app/viewers")).then(function (sn) {
      var d = sn.exists() ? sn.data() : null;
      MIR.list = ((d && d.list) || []).filter(function (x) { return x && x.uid && x.e && x.p; }).map(function (x) { var v = { uid: x.uid, e: x.e, p: x.p, link: x.link, at: x.at, q: [] }; if (x.r === "f") v.r = "f"; return v; });
      var pre = MIR.pre; MIR.pre = []; MIR.ready = true;
      MIR.list.forEach(function (v) {
        v.q = pre.map(function (op) { return forLink(v, op); }).filter(Boolean);
        watchSubs(v);
        var last = 0;
        try { last = Number(LS && LS.getItem("sijil.mirsync." + v.uid)) || 0; } catch (x) { last = 0; }
        if (MIR.overflow || Date.now() - last > 12 * 3600000) fullSync(v).catch(function (e) { console.error(e); });
        flushMirror(v);
      });
      MIR.overflow = false;
      MIR.waiters.splice(0).forEach(function (f) { f(); });
    }).catch(function (e) { console.error(e); setTimeout(startMirrors, 60000); });
  }
  function createViewer(role) {
    var A = cloud.A, Au = cloud.au, F = cloud.F, c = cloud.cfg, app = null, fm = role === "f";
    var code = rnd(12);
    var short = !!(HOME_CFG && HOME_CFG.projectId === c.projectId && CODE_RE.test(code));
    var v = short ? { e: codeView(code, role).e, p: codeView(code, role).p, at: new Date().toISOString(), q: [] } : { e: (fm ? "fore." : "view.") + rnd(12) + "@example.com", p: rnd(24), at: new Date().toISOString(), q: [] };
    if (fm) v.r = "f";
    return Promise.resolve().then(function () {
      app = A.initializeApp(c, "sijilmk" + Date.now());
      var auth = Au.initializeAuth(app, { persistence: Au.inMemoryPersistence });
      return Au.createUserWithEmailAndPassword(auth, v.e, v.p).then(function (cred) { v.auth = auth; return cred; });
    }).then(function (cred) {
      v.uid = cred.user.uid; v.app = app; v.fs = F.getFirestore(app);
      var payload = { c: { apiKey: c.apiKey, authDomain: c.authDomain, projectId: c.projectId, appId: c.appId }, o: v.uid, e: v.e, p: v.p };
      if (fm) payload.r = "f";
      v.link = short ? (SHORT_BASE || location.origin + location.pathname) + (fm ? "#f=" : "#v=") + code
        : location.origin + location.pathname + "#view=" + b64e(payload);
      MIR.list.push(v);
      return fullSync(v).then(saveViewers);
    }).then(function () { watchSubs(v); return v; }, function (e) {
      var i = MIR.list.indexOf(v); if (i >= 0) MIR.list.splice(i, 1);
      if (v.app) closeV(v); else if (app) A.deleteApp(app).catch(noop);
      throw e;
    });
  }
  /* stopping: empty the copy, then delete the link's account, so the link can never open again */
  function stopViewers(role) {
    var Au = cloud.au, F = cloud.F, all = MIR.list.filter(function (v) { return (v.r || "v") === (role || "v"); });
    return Promise.all(all.map(function (v) {
      v.q = [];
      if (v.unsub) { try { v.unsub(); } catch (x) { /* ignore */ } v.unsub = null; }
      delete FMW.subs[v.uid];
      var cols = v.r === "f" ? FM_COLS.concat(["subs"]) : MIR_COLS;
      return run(v, function () {
        var mb = "sijil/" + v.uid + "/";
        return Promise.resolve().then(function () { return vApp(v); }).then(function () {
          return Promise.all(cols.map(function (c) { return F.getDocs(F.collection(v.fs, mb + c)); }));
        }).then(function (r) {
          var ops = [["del", "app/viewer"], ["del", "app/settings"]];
          r.forEach(function (q, i) { q.docs.forEach(function (d) { ops.push(["del", cols[i] + "/" + d.id]); }); });
          return commitOps(v, ops);
        }).then(function () { return Au.signInWithEmailAndPassword(v.auth, v.e, v.p); })
          .then(function () { return Au.deleteUser(v.auth.currentUser); })
          .catch(function (e) { console.error(e); });
      }).then(function () { v.gone = true; closeV(v); try { if (LS) LS.removeItem("sijil.mirsync." + v.uid); } catch (x) { /* ignore */ } });
    })).then(function () {
      MIR.list = MIR.list.filter(function (v) { return all.indexOf(v) < 0; });
      fmNotify();
      return saveViewers();
    }).then(function () { if ((role || "v") === "v") return stopLegacy(); });
  }
  /* links made with the previous version (they read the register directly) */
  function legacyPath() { return "sijilViewers/" + cloud.user.uid + "/v"; }
  function legacyLinks() { var F = cloud.F; return F.getDocs(F.collection(cloud.fs, legacyPath())).then(function (q) { return q.docs.map(function (d) { return d.id; }); }, function () { return []; }); }
  function stopLegacy() {
    var F = cloud.F;
    return legacyLinks().then(function (ids) { return Promise.all(ids.map(function (id) { return F.deleteDoc(F.doc(cloud.fs, legacyPath() + "/" + id)); })); }).catch(noop);
  }
  /* opens the link the way the other phone does: can it read the copy? is writing to the register refused? */
  function testViewer(v) {
    var A = cloud.A, Au = cloud.au, F = cloud.F, owner = cloud.user.uid, app3 = null, auth3 = null, fs3 = null, n = 0;
    function end() { if (!app3) return Promise.resolve(); return Au.signOut(auth3).catch(noop).then(function () { return A.deleteApp(app3); }).catch(noop); }
    return within(fullSync(v).then(function () {
      app3 = A.initializeApp(cloud.cfg, "sijiltest" + Date.now());
      auth3 = Au.initializeAuth(app3, { persistence: Au.inMemoryPersistence });
      return Au.signInWithEmailAndPassword(auth3, v.e, v.p);
    }).then(function () {
      fs3 = F.getFirestore(app3);
      return F.getDocs(F.collection(fs3, "sijil/" + v.uid + "/workers"));
    }).then(function (q) {
      n = q.size;
      return F.setDoc(F.doc(fs3, "sijil/" + owner + "/app/viewcheck"), { at: new Date().toISOString() }).then(function () { return false; }, function (x) { if (isDenied(x)) return true; throw x; });
    }), 30000).then(function (blocked) {
      if (!blocked) F.deleteDoc(F.doc(cloud.fs, cloud.base + "app/viewcheck")).catch(noop);
      return end().then(function () { return { blocked: blocked, n: n }; });
    }, function (x) { return end().then(function () { throw x; }); });
  }

  /* ---------- the "view-only link" card (top of Settings) and its button in the top bar */
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  var LINKS = {
    v: {
      title: function () { return T("رابط المشاهدة فقط", "Lien en lecture seule"); },
      hint: function () { return T("أرسله لمن تريد أن يطّلع على السجل (العمال، الحضور، الأجور، التقارير) دون أن يستطيع تعديل أي شيء. يتحدّث عنده تلقائياً كلما سجّلت، ويمكنك إيقافه متى شئت.", "Envoyez-le à qui doit consulter le registre (ouvriers, présences, salaires, rapports) sans pouvoir rien modifier. Il se met à jour à chaque enregistrement, et vous pouvez l'arrêter à tout moment."); },
      create: function () { return T("إنشاء رابط المشاهدة", "Créer le lien de consultation"); },
      active: function () { return T("الرابط مفعّل ✓ — من يفتحه يرى السجل فقط ولا يستطيع تعديل أي شيء.", "Lien actif ✓ — la personne qui l'ouvre voit le registre sans pouvoir rien modifier."); },
      aria: function () { return T("رابط المشاهدة", "Lien de consultation"); },
      wa: function () { return T("سجل الحضور والأجور — رابط للاطلاع فقط:", "Registre de présence et de paie — lien en lecture seule :"); },
      stop: function () { return T("إيقاف رابط المشاهدة", "Arrêter le lien de consultation"); },
      ok: function (n) { return T("تمت التجربة ✓ الرابط يفتح السجل للاطلاع (عدد العمال: ", "Test réussi ✓ le lien ouvre le registre en consultation (ouvriers : ") + n + T(")، ولا يستطيع تعديل أي شيء.", "), sans aucune modification possible."); },
    },
    f: {
      title: function () { return T("رابط رئيس الورش", "Lien du chef de chantier"); },
      hint: function () { return T("أرسله لرئيس الورش ليسجّل حضور العمال من هاتفه في الورش. لا يرى الأجور ولا الأداءات، ولا يدخل تسجيله السجل إلا بعد أن تعتمده أنت (يظهر لك تنبيه في الرئيسية).", "Envoyez-le au chef de chantier pour qu'il saisisse la présence des ouvriers depuis son téléphone. Il ne voit ni salaires ni paiements, et sa saisie n'entre au registre qu'après votre validation (une alerte apparaît à l'accueil)."); },
      create: function () { return T("إنشاء رابط رئيس الورش", "Créer le lien du chef de chantier"); },
      active: function () { return T("الرابط مفعّل ✓ — رئيس الورش يسجّل الحضور ويرسله إليك للاعتماد، ولا يرى الأجور.", "Lien actif ✓ — le chef de chantier saisit les présences et vous les envoie pour validation, sans voir les salaires."); },
      aria: function () { return T("رابط رئيس الورش", "Lien du chef de chantier"); },
      wa: function () { return T("سجل الحضور — رابط رئيس الورش لتسجيل حضور العمال:", "Registre de présence — lien du chef de chantier pour le pointage :"); },
      stop: function () { return T("إيقاف رابط رئيس الورش", "Arrêter le lien du chef de chantier"); },
      ok: function (n) { return T("تمت التجربة ✓ الرابط يفتح قائمة العمال (العدد: ", "Test réussi ✓ le lien ouvre la liste des ouvriers (") + n + T(") لتسجيل الحضور، ولا يستطيع تعديل سجلك ولا رؤية الأجور.", ") pour le pointage, sans pouvoir modifier votre registre ni voir les salaires."); },
    },
  };
  function shareUI() {
    var on = !!(window.SIJIL_CLOUD && cloud.user && !VIEW);
    var gear = document.getElementById("gearBtn"), btn = document.getElementById("shareBtn");
    if (!btn && gear) {
      btn = el('<button class="iconbtn" id="shareBtn" type="button" hidden>' + EYE + '</button>');
      gear.parentNode.insertBefore(btn, gear);
      btn.addEventListener("click", function () {
        gear.click();
        setTimeout(function () { var c = document.getElementById("shareCard"); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 120);
      });
    }
    if (btn) { var lb = T("رابط المشاهدة فقط", "Lien en lecture seule"); btn.hidden = !on; btn.setAttribute("aria-label", lb); btn.title = lb; }
    var view = document.getElementById("v-settings");
    [["v", "shareCard"], ["f", "fmCard"]].forEach(function (x) {
      var role = x[0], card = document.getElementById(x[1]);
      if (!card && view) {
        card = el('<div class="card pad16 sjcard" id="' + x[1] + '" hidden></div>');
        var after = role === "f" ? document.getElementById("shareCard") : null, head = view.querySelector(".sec-h");
        if (after) view.insertBefore(card, after.nextSibling); else view.insertBefore(card, head ? head.nextSibling : view.firstChild);
      }
      if (!card) return;
      card.hidden = !on;
      if (!on) return;
      card.innerHTML = '<h2>' + LINKS[role].title() + '</h2><p class="hint" style="margin:0">' + LINKS[role].hint() + '</p><div class="sjsb"></div>';
      drawShare(card.querySelector(".sjsb"), role);
    });
  }
  function drawShare(sb, role) {
    if (!sb.isConnected) return;
    var L = LINKS[role];
    if (!MIR.ready) { sb.innerHTML = '<p class="hint" style="margin:0">…</p>'; MIR.waiters.push(function () { drawShare(sb, role); }); return; }
    var mine = MIR.list.filter(function (x) { return (x.r || "v") === role && !x.gone; }), v = mine[mine.length - 1];
    if (!v) {
      sb.innerHTML = '<p class="sjerr" hidden></p><div class="row"><button class="btn primary" type="button" data-v="create">' + L.create() + '</button></div><div class="sjold"></div>';
      var cb = sb.querySelector('[data-v="create"]'), er = sb.querySelector(".sjerr");
      cb.addEventListener("click", function () {
        cb.disabled = true; cb.textContent = T("جارٍ إنشاء الرابط…", "Création du lien…"); er.hidden = true;
        createViewer(role).then(function () { drawShare(sb, role); }, function (x) {
          console.error(x);
          cb.disabled = false; cb.textContent = L.create();
          er.hidden = false; er.textContent = T("تعذّر إنشاء الرابط: ", "Création impossible : ") + errLine(x);
        });
      });
      if (role === "v") drawLegacy(sb.querySelector(".sjold"));
      return;
    }
    var link = v.link;
    var pend = role === "f" ? (FMW.subs[v.uid] || []).filter(function (x) { return x && x.status === "pending"; }).length : 0;
    sb.innerHTML = '<p class="notice" style="background:var(--ok-soft);margin:0">' + L.active() + '</p>' +
      (pend ? '<p class="notice warn" style="margin:0">' + T("تسجيلات تنتظر اعتمادك: ", "Pointages à valider : ") + pend + T(" — راجعها من تنبيهات الرئيسية.", " — voir les alertes de l'accueil.") + '</p>' : '') +
      '<input class="sjlink" type="text" readonly aria-label="' + L.aria() + '">' +
      '<div class="row"><button class="btn primary" type="button" data-v="copy">' + T("نسخ الرابط", "Copier le lien") + '</button>' +
      '<a class="btn" data-v="wa" target="_blank" rel="noopener">' + T("إرسال عبر واتساب", "Envoyer par WhatsApp") + '</a></div>' +
      '<div class="row"><button class="btn" type="button" data-v="test">' + T("تجربة الرابط", "Tester le lien") + '</button>' +
      '<button class="btn ghost" type="button" data-v="stop">' + L.stop() + '</button></div>' +
      '<div class="sjres" hidden></div><div class="sjold"></div>';
    var inp = sb.querySelector(".sjlink");
    inp.value = link;
    inp.addEventListener("focus", function () { inp.select(); });
    sb.querySelector('[data-v="wa"]').href = "https://wa.me/?text=" + encodeURIComponent(L.wa() + "\n" + link);
    sb.querySelector('[data-v="copy"]').addEventListener("click", function (ev) { copy(link, ev.currentTarget); });
    sb.querySelector('[data-v="test"]').addEventListener("click", function (ev) {
      var b = ev.currentTarget, res = sb.querySelector(".sjres"), label = b.textContent;
      function show(ok, text) {
        res.hidden = false;
        res.innerHTML = '<p class="notice' + (ok ? '" style="background:var(--ok-soft);margin:0"' : ' warn" style="margin:0"') + '></p>';
        res.querySelector("p").textContent = text;
      }
      b.disabled = true; b.textContent = T("جارٍ التجربة…", "Test en cours…"); res.hidden = true;
      testViewer(v).then(function (r) {
        if (r.blocked) show(true, L.ok(r.n));
        else show(false, T("تنبيه: قواعد الأمان في Firebase تسمح بالتعديل. أرسل لي صورة من هذه الرسالة.", "Attention : les règles Firebase permettent la modification. Envoyez une capture de ce message."));
      }, function (x) { console.error(x); show(false, T("فشلت التجربة: ", "Échec du test : ") + errLine(x)); })
        .then(function () { b.disabled = false; b.textContent = label; });
    });
    sb.querySelector('[data-v="stop"]').addEventListener("click", function (ev) {
      var b = ev.currentTarget;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = T("تأكيد: إيقاف الرابط الآن", "Confirmer : arrêter le lien"); return; }
      b.disabled = true; b.textContent = T("جارٍ الإيقاف…", "Arrêt…");
      stopViewers(role).then(function () { drawShare(sb, role); }, function (x) { console.error(x); b.disabled = false; banner(errLine(x), true); drawShare(sb, role); });
    });
    if (role === "v") drawLegacy(sb.querySelector(".sjold"));
  }
  function drawLegacy(box) {
    legacyLinks().then(function (ids) {
      if (!ids.length || !box.isConnected) return;
      box.innerHTML = '<div class="row" style="align-items:center"><span class="hint" style="flex:1;min-width:0">' + T("يوجد رابط مشاهدة من النسخة السابقة ما زال مفعّلاً.", "Un lien de consultation de la version précédente est encore actif.") + '</span>' +
        '<button class="btn sm ghost" type="button">' + T("إيقافه", "L'arrêter") + '</button></div>';
      box.querySelector("button").addEventListener("click", function (ev) { ev.currentTarget.disabled = true; stopLegacy().then(function () { box.innerHTML = ""; }); });
    });
  }
  function linkFor(cfg) {
    var s = btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.origin + location.pathname + "#cloud=" + s;
  }
  function copy(text, btn) {
    function done() { var o = btn.textContent; btn.textContent = T("تم النسخ ✓", "Copié ✓"); setTimeout(function () { btn.textContent = o; }, 1800); }
    try { navigator.clipboard.writeText(text).then(done, function () { window.prompt("", text); }); } catch (e) { window.prompt("", text); }
  }
  function renderCloudCard() {
    var card = document.getElementById("cloudCard");
    if (!card) return;
    var st = getJ(CLOUD_KEY);
    var body = card.querySelector(".cbody");
    if (VIEW) {
      var h = card.querySelector("h2");
      if (h) { h.removeAttribute("data-t"); h.textContent = T("وضع المشاهدة فقط", "Consultation seule"); }
      body.innerHTML = '<p class="notice" style="margin:0">' + T("تطّلع على السجل كما يحفظه صاحبه، ويتحدّث تلقائياً. لا يمكنك تعديل أي شيء.", "Vous consultez le registre tel que son propriétaire l'enregistre, avec mise à jour automatique. Aucune modification n'est possible.") + '</p>' +
        '<div class="row"><button class="btn ghost" type="button" id="sjExit">' + T("الخروج من وضع المشاهدة", "Quitter la consultation") + '</button></div>';
      body.querySelector("#sjExit").addEventListener("click", function (e) {
        var b = e.currentTarget;
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = T("تأكيد الخروج", "Confirmer"); return; }
        b.disabled = true; exitView();
      });
      return;
    }
    if (window.SIJIL_CLOUD && cloud.user) {
      body.innerHTML = '<p class="notice" style="background:var(--ok-soft);margin:0">' + T("مفعّل ✓ — بياناتك تُحفظ في السحابة وتظهر في كل أجهزتك. الحساب: ", "Activé ✓ — vos données sont enregistrées dans le nuage et visibles sur tous vos appareils. Compte : ") + '<b dir="ltr">' + (cloud.user.email || "") + '</b></p>' +
        '<p class="hint" style="margin:0">' + T("لفتح السجل في جهاز آخر لك (الحاسوب مثلاً): افتح فيه هذا الرابط، ثم ادخل بنفس البريد وكلمة المرور.", "Pour ouvrir le registre sur un autre de vos appareils (l'ordinateur par exemple) : ouvrez-y ce lien, puis connectez-vous avec le même e-mail et mot de passe.") + '</p>' +
        '<div class="row"><button class="btn" type="button" id="sjLink">' + T("نسخ رابط جهاز آخر لك", "Copier le lien pour un autre de vos appareils") + '</button>' +
        (navigator.share ? '<button class="btn" type="button" id="sjLinkShare">' + T("إرسال الرابط", "Envoyer le lien") + '</button>' : "") + '</div>' +
        '<div class="row"><button class="btn ghost" type="button" id="sjOut">' + T("تسجيل الخروج", "Se déconnecter") + '</button><button class="btn ghost" type="button" id="sjOff">' + T("إيقاف الحفظ السحابي", "Désactiver le nuage") + '</button></div>';
      var lk = linkFor(cloud.cfg);
      body.querySelector("#sjLink").addEventListener("click", function (e) { copy(lk, e.currentTarget); });
      var sh = body.querySelector("#sjLinkShare");
      if (sh) sh.addEventListener("click", function () { navigator.share({ text: lk }).catch(function () { /* cancelled */ }); });
      body.querySelector("#sjOut").addEventListener("click", function () { cloud.au.signOut(cloud.auth).then(function () { location.reload(); }); });
      body.querySelector("#sjOff").addEventListener("click", function (e) {
        var b = e.currentTarget;
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = T("تأكيد: نسخ البيانات إلى الهاتف وإيقاف السحابة", "Confirmer : copier les données sur le téléphone et désactiver"); return; }
        b.disabled = true;
        downloadCloud().then(function () { try { LS.removeItem(CLOUD_KEY); } catch (x) { /* ignore */ } location.reload(); }).catch(function (x) { b.disabled = false; banner(authText(x), true); });
      });
      return;
    }
    body.innerHTML = '<p class="hint" style="margin:0">' + T("الآن بياناتك على هذا الهاتف فقط. فعّل الحفظ السحابي المجاني (Google Firebase) لتُحفظ تلقائياً وتفتحها من الهاتف والحاسوب معاً. تحتاج حساب Google، ومرة واحدة فقط، والأسهل من الحاسوب:", "Vos données sont uniquement sur ce téléphone. Activez l'enregistrement gratuit dans le nuage (Google Firebase) pour les sauvegarder automatiquement et les ouvrir sur téléphone et ordinateur. Il faut un compte Google ; une seule fois, plus simple depuis un ordinateur :") + '</p>' +
      '<ol class="sjsteps">' +
      '<li>' + T("افتح <b dir=\"ltr\">console.firebase.google.com</b> ← «إنشاء مشروع» (Create a project)، سمّه <b dir=\"ltr\">sijil</b>، ولا حاجة لـ Google Analytics.", "Ouvrez <b>console.firebase.google.com</b> → « Créer un projet », nommez-le <b>sijil</b> (Google Analytics inutile).") + '</li>' +
      '<li>' + T("القائمة: Build ← <b>Firestore Database</b> ← Create database ← المنطقة <b dir=\"ltr\">europe-west1</b> ← production mode.", "Menu Build → <b>Firestore Database</b> → Créer → région <b>europe-west1</b> → mode production.") + '</li>' +
      '<li>' + T("القائمة: Build ← <b>Authentication</b> ← Get started ← <b>Email/Password</b> ← Enable ← Save.", "Menu Build → <b>Authentication</b> → Commencer → <b>E-mail/Mot de passe</b> → Activer → Enregistrer.") + '</li>' +
      '<li>' + T("Firestore ← تبويب <b>Rules</b> ← امسح ما فيه والصق هذه القواعد ← <b>Publish</b>:", "Firestore → onglet <b>Règles</b> → remplacez le contenu par ces règles → <b>Publier</b> :") +
      '<pre class="sjcode" id="sjRules"></pre><button class="btn sm" type="button" id="sjCopyRules">' + T("نسخ القواعد", "Copier les règles") + '</button></li>' +
      '<li>' + T("الترس ⚙ ← Project settings ← في الأسفل أيقونة الويب <b dir=\"ltr\">&lt;/&gt;</b> ← اكتب sijil ← Register app ← انسخ كل ما يظهر في <b dir=\"ltr\">firebaseConfig</b> والصقه هنا:", "⚙ → Paramètres du projet → en bas, icône Web <b>&lt;/&gt;</b> → nommez sijil → Enregistrer → copiez tout l'objet <b>firebaseConfig</b> et collez-le ici :") + '</li>' +
      '</ol>' +
      '<div class="sjf"><label for="sjCfg">firebaseConfig</label><textarea id="sjCfg" spellcheck="false" placeholder="apiKey: &quot;AIza…&quot;, authDomain: …, projectId: …, appId: …"></textarea></div>' +
      '<div class="grid2"><div class="sjf"><label for="sjMail">' + T("بريدك الإلكتروني", "Votre e-mail") + '</label><input id="sjMail" type="email" dir="ltr" autocomplete="username"></div>' +
      '<div class="sjf"><label for="sjPass">' + T("كلمة مرور للسجل (6 أحرف على الأقل)", "Mot de passe du registre (6 caractères min.)") + '</label><input id="sjPass" type="password" dir="ltr" autocomplete="new-password"></div></div>' +
      '<p class="sjerr" id="sjCErr"></p>' +
      '<div class="row"><button class="btn primary" type="button" id="sjOn">' + T("تفعيل الحفظ السحابي", "Activer le nuage") + '</button></div>';
    body.querySelector("#sjRules").textContent = RULES;
    body.querySelector("#sjCopyRules").addEventListener("click", function (e) { copy(RULES, e.currentTarget); });
    if (st && st.cfg) body.querySelector("#sjCfg").value = JSON.stringify(st.cfg, null, 1);
    body.querySelector("#sjOn").addEventListener("click", function (e) {
      var btn = e.currentTarget, ER = body.querySelector("#sjCErr");
      var cfg = parseConfig(body.querySelector("#sjCfg").value);
      var mail = body.querySelector("#sjMail").value.trim(), pass = body.querySelector("#sjPass").value;
      ER.textContent = "";
      if (!cfg) { ER.textContent = T("الصق firebaseConfig كاملاً (فيه apiKey وprojectId وappId).", "Collez l'objet firebaseConfig complet (apiKey, projectId, appId)."); return; }
      if (!mail || pass.length < 6) { ER.textContent = T("أدخل بريدك وكلمة مرور من 6 أحرف على الأقل.", "Saisissez votre e-mail et un mot de passe de 6 caractères minimum."); return; }
      btn.disabled = true; btn.textContent = T("جارٍ التفعيل…", "Activation…");
      loadFirebase(cfg).then(function () {
        return cloud.au.createUserWithEmailAndPassword(cloud.auth, mail, pass).catch(function (x) {
          if (String(x && x.code).indexOf("email-already-in-use") >= 0) return cloud.au.signInWithEmailAndPassword(cloud.auth, mail, pass);
          throw x;
        });
      }).then(function (cred) {
        cloud.user = cred.user; cloud.base = "sijil/" + cred.user.uid + "/";
        return cloudHasData().then(function (has) { return has ? 0 : uploadLocal(); });
      }).then(function () {
        setJ(CLOUD_KEY, { cfg: cfg, email: mail, since: new Date().toISOString() });
        location.reload();
      }).catch(function (x) {
        btn.disabled = false; btn.textContent = T("تفعيل الحفظ السحابي", "Activer le nuage");
        ER.textContent = authText(x);
      });
    });
  }
  whenBody(function () {
    renderCloudCard();
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-lang], #langBtn")) setTimeout(function () { renderCloudCard(); shareUI(); }, 50); });
  });
  dbReady.then(function (db) {
    if (db === cloudDb && !VIEW && cloud.user) { fmApi(); startMirrors(); }
    whenBody(function () { renderCloudCard(); shareUI(); });
  });

  /* =================================================================== API used by the page */
  var MIME = { pdf: "application/pdf", json: "application/json", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain" };
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
  var user = { can: function () { return Promise.resolve(!VIEW); }, isOwner: function () { return !VIEW; }, canEdit: function () { return !VIEW; }, id: function () { return Promise.resolve(cloud.user ? cloud.user.uid : "local"); } };
  window.claude = { use: function (name) { return name === "db" ? dbReady : Promise.resolve(name === "user" ? user : name === "downloads" ? downloads : null); } };

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* optional */ }
  if ("serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      /* a new version was just installed: reload once, but only right after opening so nothing typed is lost */
      if (hadController && !window.__sijilReloaded && performance.now() < 20000 && !document.getElementById("sjLogin")) { window.__sijilReloaded = true; location.reload(); }
    });
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  /* =================================================================== "install the app" banner (Android Chrome) */
  var deferred = null;
  function isStandalone() { try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; } }
  function showInstall() {
    if (isStandalone() || document.getElementById("pwaInstall")) return;
    var b = document.createElement("div");
    b.id = "pwaInstall";
    b.setAttribute("role", "dialog");
    b.style.cssText = "position:fixed;left:12px;right:12px;z-index:70;bottom:calc(var(--nav-h,62px) + 14px + env(safe-area-inset-bottom,0px));" +
      "background:var(--hero,#172E6E);color:#fff;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:560px;margin:0 auto";
    b.innerHTML = '<img src="icons/emb-192.png" alt="" width="44" height="44" style="border-radius:11px;flex:none">' +
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
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; whenBody(showInstall); });
  window.addEventListener("appinstalled", hideInstall);
})();
