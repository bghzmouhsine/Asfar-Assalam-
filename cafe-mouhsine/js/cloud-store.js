/* =========================================================
   Café Mouhsine BOUAGHAZ — data storage
   One API for the customer site, the kitchen screen and admin:
     CafeOrders   — orders
     CafeBookings — table & service bookings
     CafeLoyalty  — loyalty points
     CafeReviews  — customer reviews (moderated)
   - "firebase" mode when js/firebase-config.js holds a config:
     data lives in Cloud Firestore, customers sign in anonymously,
     staff sign in with email/password and must have a staff/{uid} doc.
     Loyalty points are only ever written by staff (credited when an
     order is served), never by the customer's browser.
   - "local" mode otherwise: everything lives in this browser's
     localStorage (same-device only).
   ========================================================= */
(() => {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/12.4.0/";
  const CONFIG = window.CAFE_FIREBASE;
  const ONLINE = !!(CONFIG && CONFIG.projectId);
  const SUBMIT_TIMEOUT = 10000;
  const POINT_VALUE = 10;   // 10 DH spent = 1 point

  /* ---------------- shared helpers ---------------- */
  const local = {
    get(k, d) { try { const v = localStorage.getItem("cm_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("cm_" + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };
  const ping = key => dispatchEvent(new StorageEvent("storage", { key: "cm_" + key }));   // same-tab listeners
  function keepLocal(key, idField, item) {
    const list = local.get(key, []);
    if (!list.some(x => x[idField] === item[idField])) list.push(item);
    local.set(key, list.slice(-500));
  }
  function patchLocal(key, idField, id, patch) {
    const list = local.get(key, []); const x = list.find(i => i[idField] === id); if (!x) return;
    Object.assign(x, patch); local.set(key, list); ping(key);
  }
  function watchLocal(key, filter, cb) {
    const emit = () => cb(local.get(key, []).filter(filter));
    const onStorage = e => { if (e.key === "cm_" + key) emit(); };
    addEventListener("storage", onStorage);
    emit();
    return () => removeEventListener("storage", onStorage);
  }
  const newRef = prefix => `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
  const pointsFor = total => Math.floor(total / POINT_VALUE);

  /* ---------------- firebase plumbing ---------------- */
  let fb = null;              // { auth, db, fs, au }
  let initPromise = null;
  function init() {
    if (!ONLINE) return Promise.resolve();
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
  // calls cb(user | null) on every sign-in change, without creating an account
  function onUser(cb) {
    let stop = () => {}, closed = false;
    init().then(() => { if (!closed) stop = fb.au.onAuthStateChanged(fb.auth, cb); });
    return () => { closed = true; stop(); };
  }
  // write with a time limit; on timeout drop the client so the queued write
  // is not replayed later (the caller falls back to WhatsApp)
  async function guardedWrite(fn) {
    try { await withTimeout(fn(), SUBMIT_TIMEOUT); }
    catch (err) {
      if (err.message === "timeout" && fb) { try { await fb.fs.terminate(fb.db); } catch { /* already gone */ } }
      throw err;
    }
  }
  const withAt = d => { const o = d.data(); return { ...o, at: o.createdAt ? o.createdAt.toMillis() : o.at }; };
  // the customer's own documents: local copies merged with live remote state
  function watchMineRemote(coll, key, idField, cb, onError) {
    let inner = () => {};
    const mine = () => local.get(key, []);
    cb(mine());
    const off = onUser(user => {
      inner(); inner = () => {};
      if (!user) { cb(mine()); return; }
      const { fs, db } = fb;
      inner = fs.onSnapshot(fs.query(fs.collection(db, coll), fs.where("uid", "==", user.uid), fs.limit(100)), snap => {
        const remote = Object.fromEntries(snap.docs.map(d => [d.id, withAt(d)]));
        const merged = mine().map(o => remote[o[idField]] ? { ...o, ...remote[o[idField]] } : o);
        const onlyRemote = Object.values(remote).filter(r => !merged.some(o => o[idField] === r[idField]));
        cb([...merged, ...onlyRemote].sort((a, b) => a.at - b.at));
      }, err => onError && onError(err));
    });
    return () => { off(); inner(); };
  }

  /* ================= ORDERS ================= */
  const LocalOrders = {
    mode: "local", newRef, init,
    async submit(order) { keepLocal("orders", "ref", order); return order; },
    watchMine: cb => watchLocal("orders", () => true, cb),
    watchAll: (since, cb) => watchLocal("orders", o => o.at >= since, cb),
    async update(ref, patch) { patchLocal("orders", "ref", ref, patch); },
    // local mode: points were already added at checkout
    async serve(ref, patch) { patchLocal("orders", "ref", ref, patch); },
    async addCounter(order) { keepLocal("orders", "ref", order); ping("orders"); return order; },
    async staffUser() { return null; },
    async signIn() { return { ok: false, error: "local" }; },
    async signOut() {}
  };

  const FirebaseOrders = {
    mode: "firebase", newRef, init,
    async submit(order) {
      await guardedWrite(async () => {
        const user = await ensureUser();
        const { fs, db } = fb;
        await fs.setDoc(fs.doc(db, "orders", order.ref), { ...order, uid: user.uid, createdAt: fs.serverTimestamp() });
      });
      keepLocal("orders", "ref", order);
      return order;
    },
    watchMine: (cb, onError) => watchMineRemote("orders", "orders", "ref", cb, onError),
    // staff: every order since a given time, live
    watchAll(since, cb, onError) {
      const { fs, db } = fb;
      const q = fs.query(fs.collection(db, "orders"), fs.where("createdAt", ">=", fs.Timestamp.fromMillis(since)), fs.orderBy("createdAt"));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(withAt)), err => onError && onError(err));
    },
    async update(ref, patch) {
      const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, "orders", ref), patch);
    },
    // staff marks an order served: in one transaction, credit the customer's
    // loyalty points once (pointsAwarded guards against double credit)
    async serve(ref, patch) {
      const { fs, db } = fb;
      await fs.runTransaction(db, async tx => {
        const oRef = fs.doc(db, "orders", ref);
        const snap = await tx.get(oRef);
        if (!snap.exists()) return;
        const o = snap.data();
        const award = o.source === "web" && o.uid && !o.pointsAwarded && o.status !== "cancelled" ? pointsFor(o.total) : 0;
        let lRef = null, l = null;
        if (award) { lRef = fs.doc(db, "loyalty", o.uid); l = await tx.get(lRef); }
        tx.update(oRef, award ? { ...patch, pointsAwarded: true } : patch);
        if (award) {
          const cur = l.exists() ? l.data() : { points: 0, orders: 0 };
          tx.set(lRef, { points: cur.points + award, orders: (cur.orders || 0) + 1, updatedAt: fs.serverTimestamp() });
        }
      });
    },
    async addCounter(order) {
      const { fs, db } = fb;
      await fs.setDoc(fs.doc(db, "orders", order.ref), { ...order, uid: fb.auth.currentUser.uid, createdAt: fs.serverTimestamp() });
      return order;
    },
    // the signed-in staff user, or null (anonymous / not in the staff collection)
    async staffUser() {
      await init();
      const u = fb.auth.currentUser;
      if (!u || u.isAnonymous) return null;
      try { return (await fb.fs.getDoc(fb.fs.doc(fb.db, "staff", u.uid))).exists() ? u : null; }
      catch { return null; }
    },
    async signIn(email, password) {
      await init();
      try {
        await fb.au.signInWithEmailAndPassword(fb.auth, email, password);
        return await FirebaseOrders.staffUser() ? { ok: true } : { ok: false, error: "not-staff" };
      } catch (e) { return { ok: false, error: e.code || "error" }; }
    },
    async signOut() { await init(); await fb.au.signOut(fb.auth); }
  };

  /* ================= BOOKINGS ================= */
  const LocalBookings = {
    mode: "local",
    async create(b) { keepLocal("bookings", "code", b); ping("bookings"); return b; },
    watchMine: cb => watchLocal("bookings", () => true, cb),
    watchAll: cb => watchLocal("bookings", () => true, cb),
    async cancelMine(code) { patchLocal("bookings", "code", code, { status: "cancelled", statusAt: Date.now() }); },
    async setStatus(code, status) { patchLocal("bookings", "code", code, { status, statusAt: Date.now() }); }
  };

  const FirebaseBookings = {
    mode: "firebase",
    async create(b) {
      await guardedWrite(async () => {
        const user = await ensureUser();
        const { fs, db } = fb;
        await fs.setDoc(fs.doc(db, "bookings", b.code), { ...b, uid: user.uid, createdAt: fs.serverTimestamp() });
      });
      keepLocal("bookings", "code", b);
      return b;
    },
    watchMine: (cb, onError) => watchMineRemote("bookings", "bookings", "code", cb, onError),
    watchAll(cb, onError) {
      const { fs, db } = fb;
      const q = fs.query(fs.collection(db, "bookings"), fs.orderBy("createdAt", "desc"), fs.limit(300));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(withAt)), err => onError && onError(err));
    },
    async cancelMine(code) {
      await init(); const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, "bookings", code), { status: "cancelled", statusAt: Date.now() });
    },
    async setStatus(code, status) {
      const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, "bookings", code), { status, statusAt: Date.now() });
    }
  };

  /* ================= LOYALTY ================= */
  const LocalLoyalty = {
    mode: "local",
    // cb({ points, id })
    watch(cb) {
      let id = local.get("loyaltyId", null);
      if (!id) { id = "CM-" + Math.random().toString(36).slice(2, 8).toUpperCase(); local.set("loyaltyId", id); }
      const emit = () => cb({ points: local.get("points", 0), id });
      const onStorage = e => { if (e.key === "cm_points") emit(); };
      addEventListener("storage", onStorage); emit();
      return () => removeEventListener("storage", onStorage);
    },
    // only local mode credits at checkout; online it happens when the order is served
    creditsAtCheckout: true,
    async add(points) { local.set("points", local.get("points", 0) + points); ping("points"); },
    watchTop: cb => { cb([]); return () => {}; },
    async adjust() {}
  };

  const FirebaseLoyalty = {
    mode: "firebase",
    creditsAtCheckout: false,
    watch(cb, onError) {
      let inner = () => {};
      const off = onUser(user => {
        inner(); inner = () => {};
        if (!user) { cb({ points: 0, id: null }); return; }
        const id = user.uid.slice(0, 8).toUpperCase();
        const { fs, db } = fb;
        inner = fs.onSnapshot(fs.doc(db, "loyalty", user.uid),
          snap => cb({ points: snap.exists() ? snap.data().points : 0, id }),
          err => onError && onError(err));
      });
      return () => { off(); inner(); };
    },
    async add() { /* never from the customer's browser */ },
    // staff: best customers
    watchTop(cb, onError) {
      const { fs, db } = fb;
      const q = fs.query(fs.collection(db, "loyalty"), fs.orderBy("points", "desc"), fs.limit(20));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ uid: d.id, id: d.id.slice(0, 8).toUpperCase(), ...d.data() }))),
        err => onError && onError(err));
    },
    // staff: manual correction (gift, refund…)
    async adjust(uid, delta) {
      const { fs, db } = fb;
      await fs.runTransaction(db, async tx => {
        const ref = fs.doc(db, "loyalty", uid);
        const snap = await tx.get(ref);
        const cur = snap.exists() ? snap.data() : { points: 0, orders: 0 };
        tx.set(ref, { points: Math.max(0, cur.points + delta), orders: cur.orders || 0, updatedAt: fs.serverTimestamp() });
      });
    }
  };

  /* ================= REVIEWS ================= */
  // One review per customer, hidden until staff approve it. Staff can reply.
  const LocalReviews = {
    mode: "local",
    watchPublic: cb => watchLocal("reviews", r => r.status === "approved", list => cb([...list].sort((a, b) => b.at - a.at))),
    async mine() { return local.get("myReview", null) && local.get("reviews", []).find(r => r.id === local.get("myReview", null)) || null; },
    async submit(review) {
      if (await LocalReviews.mine()) return { ok: false, error: "exists" };
      const r = { ...review, id: newRef("REV"), status: "pending" };
      keepLocal("reviews", "id", r); local.set("myReview", r.id); ping("reviews");
      return { ok: true };
    },
    watchAll: cb => watchLocal("reviews", () => true, list => cb([...list].sort((a, b) => b.at - a.at))),
    async moderate(id, patch) { patchLocal("reviews", "id", id, { ...patch, moderatedAt: Date.now() }); },
    async remove(id) { local.set("reviews", local.get("reviews", []).filter(r => r.id !== id)); ping("reviews"); }
  };

  const FirebaseReviews = {
    mode: "firebase",
    // approved reviews are public: no sign-in needed to read them
    watchPublic(cb, onError) {
      let stop = () => {}, closed = false;
      init().then(() => {
        if (closed) return;
        const { fs, db } = fb;
        const q = fs.query(fs.collection(db, "reviews"), fs.where("status", "==", "approved"), fs.orderBy("createdAt", "desc"), fs.limit(60));
        stop = fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...withAt(d) }))), err => onError && onError(err));
      }).catch(err => onError && onError(err));
      return () => { closed = true; stop(); };
    },
    // my own review (any status), without creating an account
    async mine() {
      await init();
      const u = fb.auth.currentUser; if (!u) return null;
      try { const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, "reviews", u.uid)); return snap.exists() ? { id: snap.id, ...withAt(snap) } : null; }
      catch { return null; }
    },
    async submit(review) {
      try {
        await withTimeout((async () => {
          const user = await ensureUser();
          const { fs, db } = fb;
          if ((await fs.getDoc(fs.doc(db, "reviews", user.uid))).exists()) throw new Error("exists");
          await fs.setDoc(fs.doc(db, "reviews", user.uid), { ...review, uid: user.uid, status: "pending", createdAt: fs.serverTimestamp() });
        })(), SUBMIT_TIMEOUT);
        return { ok: true };
      } catch (err) {
        if (err.message === "timeout" && fb) { try { await fb.fs.terminate(fb.db); } catch { /* gone */ } }
        return { ok: false, error: err.message === "exists" ? "exists" : err.message === "timeout" ? "network" : "error" };
      }
    },
    watchAll(cb, onError) {
      const { fs, db } = fb;
      const q = fs.query(fs.collection(db, "reviews"), fs.orderBy("createdAt", "desc"), fs.limit(200));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...withAt(d) }))), err => onError && onError(err));
    },
    async moderate(id, patch) {
      const { fs, db } = fb;
      await fs.updateDoc(fs.doc(db, "reviews", id), { ...patch, moderatedAt: Date.now() });
    },
    async remove(id) {
      const { fs, db } = fb;
      await fs.deleteDoc(fs.doc(db, "reviews", id));
    }
  };

  window.CafeReviews = ONLINE ? FirebaseReviews : LocalReviews;
  window.CafeOrders = ONLINE ? FirebaseOrders : LocalOrders;
  window.CafeBookings = ONLINE ? FirebaseBookings : LocalBookings;
  window.CafeLoyalty = ONLINE ? FirebaseLoyalty : LocalLoyalty;
  window.CafeLoyalty.pointsFor = pointsFor;
})();
