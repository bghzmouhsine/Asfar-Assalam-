/* =========================================================
   Café Mouhsine BOUAGHAZ — order storage
   One API for the customer site, the kitchen screen and admin:
   - "firebase" mode when js/firebase-config.js holds a config:
     orders live in Cloud Firestore, customers sign in anonymously,
     staff sign in with email/password and must have a staff/{uid} doc.
   - "local" mode otherwise: orders live in this browser's
     localStorage (same-device only), as before.
   ========================================================= */
(() => {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/12.4.0/";
  const CONFIG = window.CAFE_FIREBASE;

  const local = {
    get(k, d) { try { const v = localStorage.getItem("cm_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("cm_" + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };
  // keeps a copy on this device for "My orders" and reorder
  function keepLocal(order) {
    const orders = local.get("orders", []);
    if (!orders.some(o => o.ref === order.ref)) orders.push(order);
    local.set("orders", orders.slice(-500));
  }
  function watchLocal(filter, cb) {
    const emit = () => cb(local.get("orders", []).filter(filter));
    const onStorage = e => { if (e.key === "cm_orders") emit(); };
    addEventListener("storage", onStorage);
    emit();
    return () => removeEventListener("storage", onStorage);
  }
  const newRef = prefix => `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  /* ---------------- local mode ---------------- */
  const LocalStore = {
    mode: "local",
    newRef,
    init: () => Promise.resolve(),
    async submit(order) { keepLocal(order); return order; },
    watchMine: cb => watchLocal(() => true, cb),
    watchAll: (since, cb) => watchLocal(o => o.at >= since, cb),
    async update(ref, patch) {
      const orders = local.get("orders", []); const o = orders.find(x => x.ref === ref); if (!o) return;
      Object.assign(o, patch); local.set("orders", orders);
      dispatchEvent(new StorageEvent("storage", { key: "cm_orders" }));   // same-tab listeners
    },
    async addCounter(order) { keepLocal(order); dispatchEvent(new StorageEvent("storage", { key: "cm_orders" })); return order; },
    async staffUser() { return null; },
    async signIn() { return { ok: false, error: "local" }; },
    async signOut() {}
  };

  /* ---------------- firebase mode ---------------- */
  const SUBMIT_TIMEOUT = 10000;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
  let fb = null;              // { auth, db, fs, au }
  let initPromise = null;
  function init() {
    if (!initPromise) initPromise = (async () => {
      const [app, au, fs] = await Promise.all([
        import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
      ]);
      const { emulator, ...options } = CONFIG;
      const fapp = app.initializeApp(options);
      const auth = au.getAuth(fapp), db = fs.getFirestore(fapp);
      if (emulator) {   // local testing with `firebase emulators:start`
        au.connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
        fs.connectFirestoreEmulator(db, emulator.host, emulator.firestorePort);
      }
      await auth.authStateReady();
      fb = { auth, db, fs, au };
    })();
    return initPromise;
  }
  async function ensureUser() {
    await init();
    if (!fb.auth.currentUser) await fb.au.signInAnonymously(fb.auth);
    return fb.auth.currentUser;
  }
  // Firestore document → plain order (createdAt may be pending right after a write)
  const fromDoc = d => {
    const o = d.data();
    return { ...o, at: o.createdAt ? o.createdAt.toMillis() : o.at };
  };

  const FirebaseStore = {
    mode: "firebase",
    newRef,
    init,
    async submit(order) {
      try {
        await withTimeout((async () => {
          const user = await ensureUser();
          const { fs, db } = fb;
          await fs.setDoc(fs.doc(db, "orders", order.ref), { ...order, uid: user.uid, createdAt: fs.serverTimestamp() });
        })(), SUBMIT_TIMEOUT);
      } catch (err) {
        // Firestore would keep the write queued and send it once back online, duplicating
        // the WhatsApp fallback order: drop the client (and its queue) instead.
        if (err.message === "timeout" && fb) { try { await fb.fs.terminate(fb.db); } catch { /* already gone */ } }
        throw err;
      }
      keepLocal(order);
      return order;
    },
    // customer: live status of my own orders (merged with the local copies)
    watchMine(cb, onError) {
      let stop = () => {}, closed = false;
      const mine = () => local.get("orders", []);
      cb(mine());
      ensureUser().then(user => {
        if (closed) return;
        const { fs, db } = fb;
        stop = fs.onSnapshot(fs.query(fs.collection(db, "orders"), fs.where("uid", "==", user.uid), fs.limit(50)), snap => {
          const remote = Object.fromEntries(snap.docs.map(d => [d.id, fromDoc(d)]));
          cb(mine().map(o => remote[o.ref] ? { ...o, status: remote[o.ref].status, times: remote[o.ref].times } : o));
        }, err => onError && onError(err));
      }).catch(err => onError && onError(err));
      return () => { closed = true; stop(); };
    },
    // staff: every order since a given time, live
    watchAll(since, cb, onError) {
      const { fs, db } = fb;
      const q = fs.query(fs.collection(db, "orders"), fs.where("createdAt", ">=", fs.Timestamp.fromMillis(since)), fs.orderBy("createdAt"));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(fromDoc)), err => onError && onError(err));
    },
    async update(ref, patch) {
      const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, "orders", ref), patch);
    },
    async addCounter(order) {
      const { fs, db } = fb;
      await fs.setDoc(fs.doc(db, "orders", order.ref), { ...order, uid: fb.auth.currentUser.uid, createdAt: fs.serverTimestamp() });
      return order;
    },
    // returns the signed-in staff user, or null (anonymous / not in staff collection)
    async staffUser() {
      await init();
      const u = fb.auth.currentUser;
      if (!u || u.isAnonymous) return null;
      try {
        const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, "staff", u.uid));
        return snap.exists() ? u : null;
      } catch { return null; }
    },
    async signIn(email, password) {
      await init();
      try {
        await fb.au.signInWithEmailAndPassword(fb.auth, email, password);
        return await this.staffUser() ? { ok: true } : { ok: false, error: "not-staff" };
      } catch (e) { return { ok: false, error: e.code || "error" }; }
    },
    async signOut() { await init(); await fb.au.signOut(fb.auth); }
  };

  window.CafeOrders = CONFIG && CONFIG.projectId ? FirebaseStore : LocalStore;
})();
