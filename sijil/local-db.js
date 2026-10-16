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
  function b64e(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  function validView(v) { return !!(v && v.c && v.c.apiKey && v.c.projectId && v.c.appId && typeof v.o === "string" && v.o && typeof v.e === "string" && v.e && typeof v.p === "string" && v.p); }
  function readOnly() { return Promise.reject(err("invalid_argument", "view-only link: writing is not allowed")); }
  function syncError(e) {
    console.error(e);
    var code = (e && e.code) || "";
    if (VIEW) { if (code.indexOf("permission-denied") >= 0) viewStopped(e); return; }
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
      set: function (d) { if (VIEW) return readOnly(); m.setDoc(ref, clean(d)).catch(syncError); return Promise.resolve(); },
      update: function (d) { if (VIEW) return readOnly(); m.setDoc(ref, clean(d), { merge: true }).catch(syncError); return Promise.resolve(); },
      delete: function () { if (VIEW) return readOnly(); m.deleteDoc(ref).catch(syncError); return Promise.resolve(); },
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
      add: function (d) { if (VIEW) return readOnly(); var ref = m.doc(cref); m.setDoc(ref, clean(d)).catch(syncError); return Promise.resolve({ id: ref.id, path: c + "/" + ref.id }); },
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
    var m = cloud.m, cols = ["workers", "days", "payments", "audit", "safety"];
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
    var vm = /[#&]view=([A-Za-z0-9_\-+/=]+)/.exec(location.hash);
    if (vm) {
      var vv = null;
      try { vv = b64d(vm[1]); } catch (x) { vv = null; }
      if (validView(vv)) { if (!vv.c.authDomain) vv.c.authDomain = vv.c.projectId + ".firebaseapp.com"; setJ(VIEW_KEY, vv); } else badViewLink = true;
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
    try { if (LS) LS.removeItem(VIEW_KEY); } catch (e) { /* ignore */ }
    VIEW = null;
    whenBody(function () {
      banner(T("هذا رابط المشاهدة الخاص بسجلك: على هاتفك يبقى السجل قابلاً للتعديل كما هو، وعند من ترسله إليه يُفتح للاطلاع فقط. لتجربته اضغط «تجربة الرابط» في الإعدادات.",
        "C'est le lien de consultation de votre registre : sur votre téléphone le registre reste modifiable ; chez la personne qui le reçoit, il s'ouvre en lecture seule. Pour le vérifier, appuyez sur « Tester le lien » dans les paramètres."), false);
    });
  }
  var dbReady;
  if (VIEW) {
    /* view-only: sign in with the link's own viewer account and read the owner's register */
    window.SIJIL_CLOUD = true; window.SIJIL_VIEW = true;
    document.documentElement.classList.add("cloud-on", "view-on");
    dbReady = loadFirebase(VIEW.c, "sijilview").then(firstUser).then(function (u) {
      if (u && String(u.email || "").toLowerCase() === VIEW.e.toLowerCase()) return u;
      return cloud.au.signInWithEmailAndPassword(cloud.auth, VIEW.e, VIEW.p).then(function (c) { return c.user; });
    }).then(function (u) {
      cloud.user = u; cloud.base = "sijil/" + VIEW.o + "/";
      return cloud.m.getDoc(cloud.m.doc(cloud.fs, cloud.base + "app/settings")).catch(function (e) {
        if (String((e && e.code) || "").indexOf("permission-denied") >= 0) throw e;
        /* offline: show what this device already has */
      });
    }).then(function () { return cloudDb; }, function (e) { console.error(e); return viewStopped(e); });
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
  function whenBody(fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn); }
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
    '.sjshare{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line,#DBE1EB);padding-top:12px}' +
    '.sjshare .sjh{margin:0;font-size:14px;font-weight:700;color:var(--ink,#131A2B)}.sjsb{display:flex;flex-direction:column;gap:10px}.sjshare a.btn{text-decoration:none}' +
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
    var title = T("رابط المشاهدة غير متاح", "Lien de consultation indisponible"), msg;
    if (c.indexOf("permission-denied") >= 0) msg = T("أوقف صاحب السجل هذا الرابط. اطلب منه رابطاً جديداً.", "Le propriétaire du registre a arrêté ce lien. Demandez-lui un nouveau lien.");
    else if (c === "bad-link") msg = T("الرابط ناقص: افتحه كاملاً كما وصلك، أو اطلب من صاحب السجل رابطاً جديداً.", "Lien incomplet : ouvrez-le en entier tel que reçu, ou demandez un nouveau lien au propriétaire du registre.");
    else if (/invalid-credential|user-not-found|wrong-password|user-disabled|invalid-email/.test(c)) msg = T("هذا الرابط لم يعد صالحاً. اطلب من صاحب السجل رابطاً جديداً.", "Ce lien n'est plus valide. Demandez un nouveau lien au propriétaire du registre.");
    else if (/network|unavailable|offline|deadline/.test(c) || !c) { title = T("لا يوجد اتصال", "Pas de connexion"); msg = T("تعذّر الاتصال بالإنترنت. تحقّق من الاتصال ثم أعد المحاولة.", "Connexion impossible. Vérifiez Internet puis réessayez.") + (c ? " [" + c + "]" : ""); }
    else msg = T("تعذّر فتح السجل: ", "Ouverture du registre impossible : ") + authText(e) + " [" + c + "]";
    return new Promise(function () {
      whenBody(function () {
        if (document.getElementById("sjLogin")) return;
        var box = el('<div id="sjLogin"><div class="bx"><h2></h2><p></p><div class="sjrow">' +
          '<button class="sjb p" type="button" id="sjRetry">' + T("إعادة المحاولة", "Réessayer") + '</button>' +
          '<button class="sjb g" type="button" id="sjExitView">' + T("الخروج من وضع المشاهدة", "Quitter la consultation") + '</button></div></div></div>');
        box.querySelector("h2").textContent = title; box.querySelector("p").textContent = msg;
        document.body.appendChild(box);
        box.querySelector("#sjRetry").addEventListener("click", function () { location.reload(); });
        box.querySelector("#sjExitView").addEventListener("click", exitView);
      });
    });
  }
  function exitView() {
    try { if (LS) LS.removeItem(VIEW_KEY); } catch (x) { /* ignore */ }
    var done = function () { location.reload(); };
    if (VIEW && cloud.au && cloud.auth) cloud.au.signOut(cloud.auth).then(done, done); else done();
  }

  /* =================================================================== settings card "cloud saving" */
  var RULES = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /sijil/{uid}/{document=**} {\n      allow read: if request.auth != null && (request.auth.uid == uid ||\n        exists(/databases/$(database)/documents/sijilViewers/$(uid)/v/$(request.auth.uid)));\n      allow write: if request.auth != null && request.auth.uid == uid;\n    }\n    match /sijilViewers/{uid}/v/{viewer} {\n      allow read, write: if request.auth != null && request.auth.uid == uid;\n    }\n  }\n}";

  /* ---------- view-only links (owner side): each link has its own viewer account; the rules let it read, never write */
  function rnd(n) { var a = "abcdefghijkmnpqrstuvwxyz23456789", b = new Uint8Array(n), s = ""; crypto.getRandomValues(b); for (var i = 0; i < n; i++) s += a[b[i] % 32]; return s; }
  function isDenied(e) { return String((e && e.code) || "").indexOf("permission-denied") >= 0; }
  function errLine(e) { var c = String((e && e.code) || ""); var t = authText(e); return c && t.indexOf(c) < 0 ? t + " [" + c + "]" : t; }
  function within(p, ms) { return Promise.race([p, new Promise(function (res, rej) { setTimeout(function () { rej(err("deadline-exceeded", "timeout")); }, ms); })]); }
  /* opens the link the way the other person's phone will (separate, temporary sign-in): can it read? is writing refused? */
  function testViewer(link) {
    var A = cloud.A, Au = cloud.au, F = cloud.F, v, app3 = null, auth3 = null, fs3 = null;
    function end() { if (!app3) return Promise.resolve(); return Au.signOut(auth3).catch(function () {}).then(function () { return A.deleteApp(app3); }).catch(function () {}); }
    return within(Promise.resolve().then(function () {
      v = b64d(/#view=([A-Za-z0-9_\-+/=]+)/.exec(link)[1]);
      if (!validView(v)) throw err("bad-link");
      app3 = A.initializeApp(v.c, "sijiltest" + Date.now());
      auth3 = Au.initializeAuth(app3, { persistence: Au.inMemoryPersistence });
      return Au.signInWithEmailAndPassword(auth3, v.e, v.p);
    }).then(function () {
      fs3 = F.getFirestore(app3);
      return F.getDoc(F.doc(fs3, "sijil/" + v.o + "/app/settings"));
    }).then(function () {
      return F.setDoc(F.doc(fs3, "sijil/" + v.o + "/app/viewcheck"), { at: new Date().toISOString() }).then(function () { return false; }, function (x) { if (isDenied(x)) return true; throw x; });
    }), 25000).then(function (blocked) {
      if (!blocked) F.deleteDoc(F.doc(cloud.fs, "sijil/" + v.o + "/app/viewcheck")).catch(function () {});
      return end().then(function () { return blocked; });
    }, function (x) { return end().then(function () { throw x; }); });
  }
  function vPath() { return "sijilViewers/" + cloud.user.uid + "/v"; }
  function listViewers() {
    var F = cloud.F;
    return F.getDocs(F.collection(cloud.fs, vPath())).then(function (q) {
      return q.docs.map(function (d) { var v = d.data() || {}; return { id: d.id, link: v.link || "", at: v.createdAt || "" }; })
        .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    });
  }
  function createViewer() {
    var A = cloud.A, Au = cloud.au, F = cloud.F, owner = cloud.user.uid, c = cloud.cfg;
    var cfg = { apiKey: c.apiKey, authDomain: c.authDomain, projectId: c.projectId, appId: c.appId };
    var email = "view." + rnd(12) + "@example.com", pass = rnd(24), link = "", app2 = null, auth2 = null;
    function end() { if (!app2) return Promise.resolve(); return Au.signOut(auth2).catch(function () {}).then(function () { return A.deleteApp(app2); }).catch(function () {}); }
    /* listing first: it is refused at once while the new security rules are not published */
    return listViewers().then(function () {
      app2 = A.initializeApp(c, "sijilmk" + Date.now());
      auth2 = Au.initializeAuth(app2, { persistence: Au.inMemoryPersistence });
      return Au.createUserWithEmailAndPassword(auth2, email, pass);
    }).then(function (cred) {
      link = location.origin + location.pathname + "#view=" + b64e({ c: cfg, o: owner, e: email, p: pass });
      return F.setDoc(F.doc(cloud.fs, vPath() + "/" + cred.user.uid), { link: link, createdAt: new Date().toISOString() });
    }).then(function () { return end().then(function () { return link; }); }, function (x) { return end().then(function () { throw x; }); });
  }
  function stopViewers() {
    var F = cloud.F;
    return listViewers().then(function (l) { return Promise.all(l.map(function (v) { return F.deleteDoc(F.doc(cloud.fs, vPath() + "/" + v.id)); })); });
  }
  function refreshShare(sb) {
    sb.innerHTML = '<p class="hint" style="margin:0">…</p>';
    listViewers().then(function (l) { drawShare(sb, l.length ? "on" : "none", l); }, function (e) { drawShare(sb, isDenied(e) ? "rules" : "error", null, e); });
  }
  function drawShare(sb, mode, list, e, again) {
    if (!sb.isConnected) return;
    if (mode === "on") {
      var link = list[0].link;
      sb.innerHTML = '<p class="notice" style="background:var(--ok-soft);margin:0">' + T("الرابط مفعّل ✓ — من يفتحه يرى السجل فقط ولا يستطيع تعديل أي شيء.", "Lien actif ✓ — la personne qui l'ouvre voit le registre sans pouvoir rien modifier.") +
        (list.length > 1 ? " " + T("عدد الروابط المفعّلة: ", "Liens actifs : ") + list.length : "") + '</p>' +
        '<input class="sjlink" type="text" readonly aria-label="' + T("رابط المشاهدة", "Lien de consultation") + '">' +
        '<div class="row"><button class="btn primary" type="button" data-v="copy">' + T("نسخ الرابط", "Copier le lien") + '</button>' +
        '<a class="btn" data-v="wa" target="_blank" rel="noopener">' + T("إرسال عبر واتساب", "Envoyer par WhatsApp") + '</a></div>' +
        '<div class="row"><button class="btn" type="button" data-v="test">' + T("تجربة الرابط", "Tester le lien") + '</button>' +
        '<button class="btn ghost" type="button" data-v="stop">' + T("إيقاف رابط المشاهدة", "Arrêter le lien de consultation") + '</button></div>' +
        '<div class="sjres" hidden></div>';
      var inp = sb.querySelector(".sjlink");
      inp.value = link;
      inp.addEventListener("focus", function () { inp.select(); });
      sb.querySelector('[data-v="wa"]').href = "https://wa.me/?text=" + encodeURIComponent(T("سجل الحضور والأجور — رابط للاطلاع فقط:", "Registre de présence et de paie — lien en lecture seule :") + "\n" + link);
      sb.querySelector('[data-v="copy"]').addEventListener("click", function (ev) { copy(link, ev.currentTarget); });
      sb.querySelector('[data-v="test"]').addEventListener("click", function (ev) {
        var b = ev.currentTarget, res = sb.querySelector(".sjres"), label = b.textContent;
        function show(ok, text, rules) {
          res.hidden = false;
          res.innerHTML = '<p class="notice' + (ok ? '" style="background:var(--ok-soft);margin:0"' : ' warn" style="margin:0"') + '></p>' +
            (rules ? '<pre class="sjcode"></pre><button class="btn sm" type="button" data-v="rules">' + T("نسخ القواعد", "Copier les règles") + '</button>' : "");
          res.querySelector("p").textContent = text;
          if (rules) { res.querySelector(".sjcode").textContent = RULES; res.querySelector('[data-v="rules"]').addEventListener("click", function (e2) { copy(RULES, e2.currentTarget); }); }
        }
        b.disabled = true; b.textContent = T("جارٍ التجربة…", "Test en cours…"); res.hidden = true;
        testViewer(link).then(function (blocked) {
          if (blocked) show(true, T("تمت التجربة ✓ الرابط يفتح السجل للاطلاع، والتعديل ممنوع.", "Test réussi ✓ le lien ouvre le registre en consultation, toute modification est refusée."));
          else show(false, T("تنبيه: القواعد الحالية تسمح لصاحب الرابط بالتعديل. في Firebase ← Firestore Database ← Rules: امسح ما فيه والصق هذه القواعد ثم Publish.", "Attention : les règles actuelles permettent au destinataire de modifier. Dans Firebase → Firestore Database → Règles : remplacez par ces règles puis Publier."), true);
        }, function (x) {
          console.error(x);
          if (isDenied(x)) show(false, T("الرابط لا يستطيع قراءة السجل بعد: في Firebase ← Firestore Database ← Rules امسح ما فيه والصق هذه القواعد ثم اضغط Publish، وانتظر دقيقة وأعد التجربة.", "Le lien ne peut pas encore lire le registre : dans Firebase → Firestore Database → Règles, remplacez par ces règles, Publier, attendez une minute et refaites le test."), true);
          else show(false, T("فشلت التجربة: ", "Échec du test : ") + errLine(x));
        }).then(function () { b.disabled = false; b.textContent = label; });
      });
      sb.querySelector('[data-v="stop"]').addEventListener("click", function (ev) {
        var b = ev.currentTarget;
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = T("تأكيد: إيقاف الرابط الآن", "Confirmer : arrêter le lien"); return; }
        b.disabled = true;
        stopViewers().then(function () { refreshShare(sb); }, function (x) { b.disabled = false; banner(authText(x), true); });
      });
      return;
    }
    var html = "";
    if (mode === "rules") {
      html = (again ? '<p class="sjerr">' + T("ما زالت القواعد القديمة مفعّلة في Firebase: تأكّد أنك ضغطت Publish، ثم انتظر دقيقة وأعد المحاولة.", "Les anciennes règles sont toujours actives dans Firebase : vérifiez que vous avez cliqué sur Publier, attendez une minute et réessayez.") + '</p>' : "") +
        '<p class="notice warn" style="margin:0">' + T("قبل أول رابط (مرة واحدة فقط): حدّث قواعد الأمان في Firebase.", "Avant le premier lien (une seule fois) : mettez à jour les règles de sécurité Firebase.") + '</p>' +
        '<ol class="sjsteps">' +
        '<li>' + T("افتح <b dir=\"ltr\">console.firebase.google.com</b> ← مشروعك ← <b dir=\"ltr\">Firestore Database</b> ← تبويب <b dir=\"ltr\">Rules</b>.", "Ouvrez <b>console.firebase.google.com</b> → votre projet → <b>Firestore Database</b> → onglet <b>Règles</b>.") + '</li>' +
        '<li>' + T("امسح ما فيه والصق هذه القواعد، ثم اضغط <b dir=\"ltr\">Publish</b>:", "Remplacez le contenu par ces règles, puis cliquez sur <b>Publier</b> :") +
        '<pre class="sjcode"></pre><button class="btn sm" type="button" data-v="rules">' + T("نسخ القواعد", "Copier les règles") + '</button></li>' +
        '<li>' + T("انتظر دقيقة، ثم ارجع هنا واضغط «إنشاء رابط المشاهدة».", "Attendez une minute, puis revenez ici et appuyez sur « Créer le lien de consultation ».") + '</li></ol>';
    } else if (mode === "error") {
      html = '<p class="sjerr"></p>';
    }
    html += '<div class="row"><button class="btn primary" type="button" data-v="create">' + T("إنشاء رابط المشاهدة", "Créer le lien de consultation") + '</button></div>';
    sb.innerHTML = html;
    var pre = sb.querySelector(".sjcode");
    if (pre) { pre.textContent = RULES; sb.querySelector('[data-v="rules"]').addEventListener("click", function (ev) { copy(RULES, ev.currentTarget); }); }
    var er = sb.querySelector(".sjerr");
    if (er && mode === "error") er.textContent = errLine(e);
    var cb = sb.querySelector('[data-v="create"]');
    cb.addEventListener("click", function () {
      cb.disabled = true; cb.textContent = T("جارٍ إنشاء الرابط…", "Création du lien…");
      createViewer().then(function () { refreshShare(sb); }, function (x) { console.error(x); drawShare(sb, isDenied(x) ? "rules" : "error", null, x, mode === "rules"); });
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
        '<div class="sjshare" id="sjShare"><p class="sjh">' + T("رابط المشاهدة فقط", "Lien en lecture seule") + '</p>' +
        '<p class="hint" style="margin:0">' + T("أرسله لمن تريد أن يطّلع على السجل (العمال، الحضور، الأجور) دون أن يستطيع تعديل أي شيء. يمكنك إيقافه متى شئت.", "Envoyez-le à qui doit consulter le registre (ouvriers, présences, salaires) sans pouvoir rien modifier. Vous pouvez l'arrêter à tout moment.") + '</p>' +
        '<div class="sjsb"></div></div>' +
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
      refreshShare(body.querySelector("#sjShare .sjsb"));
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
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-lang], #langBtn")) setTimeout(renderCloudCard, 50); });
  });
  dbReady.then(function () { whenBody(renderCloudCard); });

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
