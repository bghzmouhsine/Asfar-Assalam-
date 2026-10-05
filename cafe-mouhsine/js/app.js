/* =========================================================
   Café Mouhsine BOUAGHAZ — front-end application
   No build step, no backend: orders & bookings go out via WhatsApp,
   local state (cart, points, language, theme) lives in localStorage.
   ========================================================= */
(() => {
  "use strict";

  const CFG = window.CAFE_CONFIG;
  const CATS = window.CAFE_CATEGORIES;
  const EXTRAS = window.CAFE_EXTRAS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- safe storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("cm_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("cm_" + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  /* ---------- admin overrides (prices / availability) ---------- */
  const overrides = store.get("overrides", {});
  const PRODUCTS = window.CAFE_PRODUCTS.map(p => ({ ...p, available: true, ...(overrides[p.id] || {}) }));
  const SERVICES = window.CAFE_SERVICES.map(s => ({ ...s, ...(overrides["srv:" + s.id] || {}) }));
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

  /* ---------- state ---------- */
  const state = {
    lang: store.get("lang", (navigator.language || "ar").slice(0, 2)),
    cat: "all", q: "", sort: "default", view: store.get("view", "grid"), diet: "",
    cart: store.get("cart", []).filter(i => byId[i.id]),
    drawerTab: "cart",
    promo: null,
    points: 0,
    loyaltyId: null,          // both filled by CafeLoyalty.watch()
    myBookings: []
  };
  if (!I18N[state.lang]) state.lang = "ar";
  // customer reviews: published list, my own review, order linked from history
  const rv = { list: [], shown: 6, mine: null, linkedOrder: null, startedAt: 0 };

  const t = (k, vars) => {
    let s = (I18N[state.lang] && I18N[state.lang][k]) ?? I18N.ar[k] ?? k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
    return s;
  };
  const L = obj => obj[state.lang] || obj.ar;              // [name, desc] tuple or string
  const cur = () => state.lang === "ar" ? "درهم" : CFG.currency;
  const money = n => `${Number(n).toLocaleString(state.lang === "en" ? "en-US" : "fr-MA", { maximumFractionDigits: 2 })} ${cur()}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hm = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

  /* ---------- pricing: size + extras, minus happy-hour discount ---------- */
  function happyHour(now = new Date()) {
    const h = CFG.happyHour; if (!h) return null;
    const m = now.getHours() * 60 + now.getMinutes();
    return h.days.includes(now.getDay()) && m >= hm(h.from) && m < hm(h.to) ? h : null;
  }
  const hhPct = p => { const h = happyHour(); return h && h.cats.includes(p.cat) ? h.pct : 0; };
  const optionOf = (g, id) => (EXTRAS[g] && EXTRAS[g].options.find(o => o[0] === id)) || null;
  const extrasCost = opts => Object.entries(opts || {}).reduce((sum, [g, v]) =>
    sum + [].concat(v).reduce((a, id) => a + ((optionOf(g, id) || [0, 0])[1]), 0), 0);
  const priceOf = (p, size, opts) => {
    const s = (p.sizes || []).find(x => x[0] === size);
    const base = p.price + (s ? s[1] : 0) + extrasCost(opts);
    const pct = hhPct(p);
    // discounted prices are rounded to the nearest half dirham
    return pct ? Math.round(base * (100 - pct) / 50) / 2 : base;
  };
  // human label for chosen options, skipping defaults
  const optsLabel = opts => Object.entries(opts || {}).flatMap(([g, v]) =>
    [].concat(v).map(id => optionOf(g, id)).filter(Boolean).map(o => L(o[2]))).join(", ");
  // drop default choices so identical drinks share one cart line
  function cleanOpts(p, opts) {
    const out = {};
    (p.extras || []).forEach(g => {
      const v = opts && opts[g]; if (v == null) return;
      if (EXTRAS[g].multi) { if (v.length) out[g] = [...v].sort(); }
      else if (v !== EXTRAS[g].options[0][0]) out[g] = v;
    });
    return out;
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ================= LANGUAGE ================= */
  function applyLang() {
    const rtl = state.lang === "ar";
    document.documentElement.lang = state.lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });   // trusted strings from i18n.js
    $$(".lang button").forEach(b => b.classList.toggle("active", b.dataset.lang === state.lang));
    store.set("lang", state.lang);
    renderAll();
  }

  /* ================= THEME ================= */
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }
  applyTheme(store.get("theme", null));
  $$("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next); store.set("theme", next);
  }));

  /* ================= MENU ================= */
  function renderTabs() {
    $("#tabs").innerHTML = CATS.map(c => {
      const n = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === c.id).length;
      return `<button role="tab" class="tab ${state.cat === c.id ? "active" : ""}" data-cat="${c.id}" aria-selected="${state.cat === c.id}">
        <span>${c.icon}</span>${esc(L(c))}<small>${n}</small></button>`;
    }).join("");
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const dietOk = p => !state.diet || p.diet.includes(state.diet) || (state.diet === "veg" && p.diet.includes("vegan"));
    let list = PRODUCTS.filter(p => (state.cat === "all" || p.cat === state.cat) && dietOk(p) &&
      (!q || [p.ar, p.fr, p.en].flat().join(" ").toLowerCase().includes(q)));
    if (state.sort === "asc") list.sort((a, b) => a.price - b.price);
    if (state.sort === "desc") list.sort((a, b) => b.price - a.price);
    if (state.sort === "name") list.sort((a, b) => L(a)[0].localeCompare(L(b)[0], state.lang));
    return list;
  }

  const tagHtml = p => {
    const pct = hhPct(p);
    return (pct ? `<span class="tag tag-hh">−${pct}%</span>` : "") +
      (p.was ? `<span class="tag tag-save">${esc(t("offer.save", { n: money(p.was - p.price) }))}</span>` : "") +
      p.tags.map(tg => `<span class="tag tag-${tg}">${t("tag." + tg)}</span>`).join("");
  };
  const priceHtml = p => {
    const was = hhPct(p) ? p.price : p.was;
    return `<span class="price-wrap">${was ? `<s class="was">${money(was)}</s>` : ""}<span class="price">${money(priceOf(p, p.sizes ? p.sizes[0][0] : null))}</span></span>`;
  };
  const dietHtml = p => p.diet.map(d => `<span class="diet-ico" title="${esc(t("diet." + d))}">${{ veg: "🌿", vegan: "🌱", gf: "🌾" }[d]}</span>`).join("");

  function renderGrid() {
    const list = filtered();
    const grid = $("#grid");
    grid.className = "grid " + (state.view === "list" ? "is-list" : "");
    $("#empty").hidden = list.length > 0;

    if (state.view === "list") {
      // compact printable price list, grouped by category
      const groups = CATS.filter(c => c.id !== "all").map(c => [c, list.filter(p => p.cat === c.id)]).filter(g => g[1].length);
      grid.innerHTML = groups.map(([c, items]) => `
        <div class="price-group">
          <h3>${c.icon} ${esc(L(c))}</h3>
          ${items.map(p => `
            <div class="price-row ${p.available ? "" : "off"}" data-open="${p.id}" tabindex="0">
              <span class="pr-name">${esc(L(p)[0])}${p.sizes ? `<small>${p.sizes.map(s => esc(s[0])).join(" / ")}</small>` : ""}</span>
              <span class="pr-dots"></span>
              <span class="pr-price">${p.sizes ? p.sizes.map(s => priceOf(p, s[0])).join(" / ") + " " + cur() : money(priceOf(p))}</span>
              <button class="add-mini" data-add="${p.id}" aria-label="${esc(t("p.add"))}" ${p.available ? "" : "disabled"}>+</button>
            </div>`).join("")}
        </div>`).join("");
      return;
    }

    grid.innerHTML = list.map(p => `
      <article class="product ${p.available ? "" : "off"}" data-open="${p.id}" tabindex="0">
        <div class="p-img">
          <img src="${p.img}" alt="${esc(L(p)[0])}" loading="lazy" width="640" height="480">
          <div class="p-tags">${tagHtml(p)}</div>
        </div>
        <div class="p-body">
          <div class="p-head">
            <h3>${esc(L(p)[0])}</h3>
            ${priceHtml(p)}
          </div>
          <p>${esc(L(p)[1])}</p>
          <div class="p-foot">
            <small>${dietHtml(p)}${p.kcal ? " " + p.kcal + " " + t("p.kcal") : ""}${p.sizes ? ` · ${p.sizes.map(s => esc(s[0])).join(" / ")}` : ""}</small>
            <button class="add" data-add="${p.id}" ${p.available ? "" : "disabled"}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              <span>${t("p.add")}</span>
            </button>
          </div>
        </div>
      </article>`).join("");
  }

  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    state.cat = b.dataset.cat; renderTabs(); renderGrid();
  });
  $("#search").addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
  function renderDiet() {
    $("#dietFilter").innerHTML = `<span>${t("diet.label")}</span>` + ["veg", "vegan", "gf"].map(d =>
      `<button class="diet-chip ${state.diet === d ? "active" : ""}" data-diet="${d}" aria-pressed="${state.diet === d}">${{ veg: "🌿", vegan: "🌱", gf: "🌾" }[d]} ${t("diet." + d)}</button>`).join("");
  }
  $("#dietFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-diet]"); if (!b) return;
    state.diet = state.diet === b.dataset.diet ? "" : b.dataset.diet; renderDiet(); renderGrid();
  });
  function renderHappyHour() {
    const h = CFG.happyHour, el = $("#hhBanner"); if (!h) { el.hidden = true; return; }
    const cats = h.cats.map(c => L(CATS.find(x => x.id === c))).join(" · ");
    const days = h.days.map(d => I18N[state.lang].days[d].slice(0, state.lang === "ar" ? 10 : 3)).join(", ");
    const on = !!happyHour();
    el.classList.toggle("on", on);
    el.innerHTML = on
      ? `<b>🍹 ${t("hh.now", { pct: h.pct, t: h.to })}</b><span>${esc(cats)}</span>`
      : `<b>🍹 ${t("hh.title")}</b><span>${t("hh.info", { pct: h.pct, from: h.from, to: h.to })} — ${esc(cats)} · ${esc(days)}</span>`;
  }
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });
  $$(".view-toggle button").forEach(b => b.addEventListener("click", () => {
    state.view = b.dataset.view; store.set("view", state.view);
    $$(".view-toggle button").forEach(x => x.classList.toggle("active", x === b));
    renderGrid();
  }));

  $("#grid").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) {
      e.stopPropagation(); const p = byId[add.dataset.add];
      // drinks with options open the customiser; everything else goes straight in
      if (p.extras.length) openProduct(p.id); else addToCart(p.id, p.sizes ? p.sizes[0][0] : null, 1);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) openProduct(open.dataset.open);
  });
  $("#grid").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.dataset.open) openProduct(e.target.dataset.open);
  });

  /* ---------- product modal ---------- */
  function openProduct(id) {
    const p = byId[id]; if (!p) return;
    let size = p.sizes ? p.sizes[0][0] : null, qty = 1;
    const opts = {};
    p.extras.forEach(g => { opts[g] = EXTRAS[g].multi ? [] : EXTRAS[g].options[0][0]; });
    const body = $("#productBody");
    // the photo is rendered once; option clicks only redraw the info panel
    body.innerHTML = `<div class="pm"><img src="${p.img.replace("w=640", "w=900")}" alt="${esc(L(p)[0])}"><div class="pm-info"></div></div>`;
    const info = $(".pm-info", body);
    const draw = () => {
      const scroll = info.scrollTop;
      info.innerHTML = `
            <div class="p-tags static">${tagHtml(p)}</div>
            <h3>${esc(L(p)[0])}</h3>
            <p>${esc(L(p)[1])}</p>
            ${p.was ? `<p class="pm-was">${t("offer.instead")} <s>${money(p.was)}</s></p>` : ""}
            <div class="pm-meta">
              ${p.kcal ? `<span>${p.kcal} ${t("p.kcal")}</span>` : ""}
              ${p.diet.map(d => `<span class="pill">${dietHtml({ diet: [d] })} ${t("diet." + d)}</span>`).join("")}
            </div>
            ${p.allergens.length ? `<p class="allergens"><b>${t("p.allergens")}:</b> ${p.allergens.map(a => t("al." + a)).join(" · ")}</p>` : ""}
            ${p.sizes ? `<div class="opt"><b>${t("p.size")}</b><div class="chips">${p.sizes.map(s =>
              `<button type="button" class="chip ${s[0] === size ? "active" : ""}" data-size="${esc(s[0])}">${esc(s[0])}<small>${money(p.price + s[1])}</small></button>`).join("")}</div></div>` : ""}
            ${p.extras.map(g => { const G = EXTRAS[g]; return `<div class="opt"><b>${esc(L(G))}</b><div class="chips">${G.options.map(o => {
              const on = G.multi ? opts[g].includes(o[0]) : opts[g] === o[0];
              return `<button type="button" class="chip ${on ? "active" : ""}" data-g="${g}" data-o="${o[0]}" aria-pressed="${on}">${esc(L(o[2]))}${o[1] ? `<small>+${money(o[1])}</small>` : ""}</button>`;
            }).join("")}</div></div>`; }).join("")}
            <div class="opt"><b>${t("p.qty")}</b>
              <div class="qty"><button type="button" data-q="-1">−</button><span>${qty}</span><button type="button" data-q="1">+</button></div>
            </div>
            <button type="button" class="btn btn-primary btn-block" id="pmAdd" ${p.available ? "" : "disabled"}>${t("p.add")} · ${money(priceOf(p, size, opts) * qty)}</button>`;
      info.scrollTop = scroll;
    };
    draw();
    body.onclick = e => {
      const s = e.target.closest("[data-size]"); if (s) { size = s.dataset.size; draw(); }
      const o = e.target.closest("[data-g]");
      if (o) {
        const g = o.dataset.g, id = o.dataset.o;
        if (EXTRAS[g].multi) opts[g] = opts[g].includes(id) ? opts[g].filter(x => x !== id) : [...opts[g], id];
        else opts[g] = id;
        draw();
      }
      const q = e.target.closest("[data-q]"); if (q) { qty = Math.max(1, qty + +q.dataset.q); draw(); }
      if (e.target.closest("#pmAdd")) { addToCart(p.id, size, qty, opts); $("#productModal").close(); }
    };
    $("#productModal").showModal();
  }
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  /* ================= CART ================= */
  const PROMOS = { MOUHSINE10: { pct: 10 }, BIENVENUE: { amt: 15 }, COFFEE20: { pct: 20, min: 200 } };
  const tierOf = pts => pts >= 300 ? { name: "Gold", pct: 15 } : pts >= 100 ? { name: "Silver", pct: 10 } : { name: "Bronze", pct: 0 };

  function addToCart(id, size, qty, opts, silent) {
    const p = byId[id]; if (!p || !p.available) return false;
    const o = cleanOpts(p, opts);
    const key = id + "|" + (size || "") + "|" + JSON.stringify(o);
    const line = state.cart.find(i => i.key === key);
    if (line) line.qty += qty; else state.cart.push({ key, id, size, qty, opts: o });
    saveCart();
    if (silent) return true;
    toast(`${t("cart.added")} · ${L(p)[0]}`);
    const btn = $("#cartBtn"); btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
    return true;
  }
  function saveCart() { store.set("cart", state.cart); renderCart(); }

  function totals() {
    const mode = $("input[name=mode]:checked").value;
    const sub = state.cart.reduce((s, i) => s + priceOf(byId[i.id], i.size, i.opts) * i.qty, 0);
    let disc = 0;
    if (state.promo) {
      const pr = PROMOS[state.promo];
      if (!pr.min || sub >= pr.min) disc = pr.pct ? sub * pr.pct / 100 : Math.min(pr.amt, sub);
    }
    disc = Math.max(disc, sub * tierOf(state.points).pct / 100);
    const del = mode === "delivery" && sub > 0 && sub - disc < CFG.freeDeliveryFrom ? CFG.deliveryFee : 0;
    const total = Math.round((sub - disc + del) * 100) / 100;
    return { mode, sub, disc, del, total, pts: Math.floor(total / 10) };
  }

  function renderCart() {
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartCount").hidden = count === 0;
    const box = $("#cartItems");
    $$(".drawer-tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === state.drawerTab));
    if (state.drawerTab === "history") { $("#cartFoot").hidden = true; renderHistory(); return; }
    $("#cartFoot").hidden = count === 0;
    if (!count) { box.innerHTML = `<p class="cart-empty">${t("cart.empty")}</p>`; return; }
    box.innerHTML = state.cart.map(i => {
      const p = byId[i.id];
      return `<div class="line">
        <img src="${p.img.replace("w=640", "w=160")}" alt="">
        <div class="line-info"><b>${esc(L(p)[0])}</b>${i.size || optsLabel(i.opts) ? `<small>${esc([i.size, optsLabel(i.opts)].filter(Boolean).join(" · "))}</small>` : ""}<span>${money(priceOf(p, i.size, i.opts) * i.qty)}</span></div>
        <div class="qty sm"><button data-k="${esc(i.key)}" data-d="-1">−</button><span>${i.qty}</span><button data-k="${esc(i.key)}" data-d="1">+</button></div>
      </div>`;
    }).join("");
    const tt = totals();
    $("#tSub").textContent = money(tt.sub);
    $("#rowDisc").hidden = !tt.disc; $("#tDisc").textContent = "− " + money(tt.disc);
    $("#rowDel").hidden = tt.mode !== "delivery"; $("#tDel").textContent = money(tt.del);
    $("#tTotal").textContent = money(tt.total);
    $("#tPts").textContent = "+" + tt.pts;
    const ph = { table: "cart.tableNo", takeaway: "cart.pickup", delivery: "cart.address" }[tt.mode];
    $("#modeDetail").placeholder = t(ph); $("#modeDetail").dataset.i18nPh = ph;
  }

  $("#cartItems").addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const line = state.cart.find(i => i.key === b.dataset.k);
    line.qty += +b.dataset.d;
    if (line.qty <= 0) state.cart = state.cart.filter(i => i !== line);
    saveCart();
  });
  $$("input[name=mode]").forEach(r => r.addEventListener("change", renderCart));

  /* ---------- order history & reorder ---------- */
  function renderHistory() {
    const orders = (state.myOrders || store.get("orders", [])).slice(-15).reverse();
    const dateFmt = new Intl.DateTimeFormat(state.lang === "ar" ? "ar-MA" : state.lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
    $("#cartItems").innerHTML = orders.length ? orders.map(o => `
      <div class="hist">
        <div class="hist-top"><b>${esc(o.ref)} ${o.status ? `<span class="st st-${o.status}">${t("st." + o.status)}</span>` : ""}</b><span>${money(o.total)}</span></div>
        <small>${dateFmt.format(o.at)} · ${t("cart." + o.mode)}</small>
        <p>${o.items.map(i => {
          if (!byId[i.id]) return "";
          const extra = [i.size, optsLabel(i.opts)].filter(Boolean).join(", ");
          return `${i.qty}× ${esc(L(byId[i.id])[0])}${extra ? ` <small>(${esc(extra)})</small>` : ""}`;
        }).filter(Boolean).join(" · ")}</p>
        <div class="hist-actions">
          <button class="btn btn-ghost btn-sm" data-reorder="${esc(o.ref)}">↻ ${t("hist.reorder")}</button>
          ${!rv.mine && o.source !== "counter" && (o.status === "served" || CafeOrders.mode === "local") ? `<button class="btn btn-ghost btn-sm" data-review-order="${esc(o.ref)}">★ ${t("hist.review")}</button>` : ""}
        </div>
      </div>`).join("") : `<p class="cart-empty">${t("hist.empty")}</p>`;
  }
  addEventListener("storage", e => { if (e.key === "cm_orders" && state.drawerTab === "history") renderCart(); });

  // Firebase mode: follow the status of my orders live and say when one is ready
  let mineStop = null;
  const lastStatus = {};
  function watchMyOrders() {
    if (mineStop || CafeOrders.mode !== "firebase") return;
    mineStop = CafeOrders.watchMine(list => {
      list.forEach(o => {
        if (lastStatus[o.ref] && lastStatus[o.ref] !== o.status && o.status === "ready") toast(t("st.readyToast", { r: o.ref }));
        lastStatus[o.ref] = o.status;
      });
      state.myOrders = list;
      if (state.drawerTab === "history") renderCart();
    }, err => console.warn("Order status unavailable", err));
  }
  $(".drawer-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    state.drawerTab = b.dataset.tab; renderCart();
    if (state.drawerTab === "history") watchMyOrders();
  });
  $("#cartItems").addEventListener("click", e => {
    const rb = e.target.closest("[data-review-order]");
    if (rb) {
      rv.linkedOrder = rb.dataset.reviewOrder; openDrawer(false); renderMyReview();
      $("#reviewForm").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const b = e.target.closest("[data-reorder]"); if (!b) return;
    const o = store.get("orders", []).find(x => x.ref === b.dataset.reorder); if (!o) return;
    const added = o.items.filter(i => addToCart(i.id, i.size, i.qty, i.opts, true)).length;
    state.drawerTab = "cart"; renderCart();
    toast(t("hist.done", { n: added, m: o.items.length }));
  });
  $("#promoBtn").addEventListener("click", () => {
    const code = $("#promoInput").value.trim().toUpperCase();
    if (PROMOS[code]) { state.promo = code; toast(t("cart.promoOk")); } else { state.promo = null; toast(t("cart.promoBad")); }
    renderCart();
  });
  $("#clearCart").addEventListener("click", () => { state.cart = []; state.promo = null; saveCart(); });

  function openDrawer(open) {
    $("#drawer").classList.toggle("open", open);
    $("#drawer").setAttribute("aria-hidden", !open);
    $("#overlay").hidden = !open;
    document.body.classList.toggle("lock", open);
  }
  $("#cartBtn").addEventListener("click", () => { state.drawerTab = "cart"; renderCart(); openDrawer(true); });
  $("#overlay").addEventListener("click", () => openDrawer(false));
  $("[data-close]").addEventListener("click", () => openDrawer(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") openDrawer(false); });

  const waLink = text => `https://wa.me/${CFG.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  // open WhatsApp in a new tab; if the browser blocks it (common after an await),
  // show a real link the customer can tap. ("noopener" would make window.open
  // always return null, so the opener is cut by hand instead.)
  function openWhatsApp(url) {
    let w = null;
    try { w = window.open(url, "_blank"); } catch { /* blocked */ }
    if (w) { try { w.opener = null; } catch { /* cross-origin */ } return; }
    uiLinkNotice(t("wa.blocked"), url, t("wa.open"));
  }

  $("#checkoutBtn").addEventListener("click", async () => {
    const tt = totals();
    const detail = $("#modeDetail").value.trim();
    if (tt.mode !== "takeaway" && !detail) { toast(t("cart.needDetail")); $("#modeDetail").focus(); return; }
    const W = I18N[state.lang].wa;
    const ref = CafeOrders.newRef("CMD");
    const lines = state.cart.map(i => {
      const extra = [i.size, optsLabel(i.opts)].filter(Boolean).join(", ");
      return `• ${i.qty} × ${L(byId[i.id])[0]}${extra ? ` (${extra})` : ""} — ${money(priceOf(byId[i.id], i.size, i.opts) * i.qty)}`;
    });
    const msg = [
      `☕ *${CFG.name}* — ${W.order}`, `${W.code}: ${ref}`, "",
      ...lines, "",
      `${t("cart.subtotal")}: ${money(tt.sub)}`,
      tt.disc ? `${t("cart.discount")}: −${money(tt.disc)}${state.promo ? ` (${state.promo})` : ""}` : "",
      tt.mode === "delivery" ? `${t("cart.fee")}: ${money(tt.del)}` : "",
      `*${W.total}: ${money(tt.total)}*`, "",
      `${W.mode}: ${t("cart." + tt.mode)}${detail ? " — " + detail : ""}`,
      $("#orderName").value.trim() ? `${W.name}: ${$("#orderName").value.trim()}` : "",
      $("#orderNote").value.trim() ? `📝 ${$("#orderNote").value.trim()}` : "",
      state.loyaltyId ? `Loyalty: ${state.loyaltyId}` : ""
    ].filter((l, idx, a) => l !== "" || a[idx - 1] !== "").join("\n");

    const order = {
      ref, at: Date.now(), mode: tt.mode, total: tt.total, detail, status: "new", times: {}, done: [],
      name: $("#orderName").value.trim(), note: $("#orderNote").value.trim(), source: "web", lang: state.lang,
      // unit price as charged (size, options, happy hour) for the sales dashboard
      items: state.cart.map(i => ({ id: i.id, size: i.size, qty: i.qty, opts: i.opts || {}, price: priceOf(byId[i.id], i.size, i.opts) }))
    };
    const btn = $("#checkoutBtn");
    let online = false;
    if (CafeOrders.mode === "firebase") {
      // straight to the kitchen screen; WhatsApp only if the network fails
      btn.disabled = true; btn.textContent = t("cart.sending");
      try { await CafeOrders.submit(order); online = true; }
      catch (err) { console.warn("Order not saved online, falling back to WhatsApp", err); }
      btn.disabled = false; btn.textContent = t("cart.checkoutOnline");
    }
    if (!online) {
      await CafeOrders.submit(order).catch(() => {});   // local copy (and local kitchen screen)
      openWhatsApp(waLink(msg));
    }

    // local mode credits now; online, staff credit the points when the order is served
    if (CafeLoyalty.creditsAtCheckout) CafeLoyalty.add(tt.pts);
    toast(online ? t("cart.sentKitchen", { n: tt.pts }) : CafeLoyalty.creditsAtCheckout ? t("cart.sent", { n: tt.pts }) : t("cart.sentNoPts"));
    state.cart = []; state.promo = null; $("#promoInput").value = ""; $("#modeDetail").value = ""; $("#orderNote").value = "";
    renderLoyalty();
    if (online) { watchMyOrders(); state.drawerTab = "history"; saveCart(); }
    else { saveCart(); openDrawer(false); }
  });

  /* ================= SERVICES ================= */
  const BOOKABLE = ["events", "catering", "workshop", "cowork"];
  function renderServices() {
    $("#servicesGrid").innerHTML = SERVICES.map(s => `
      <article class="service">
        <div class="s-img"><img src="${s.img}" alt="" loading="lazy"><span class="s-ico">${s.icon}</span></div>
        <div class="s-body">
          <h3>${esc(L(s)[0])}</h3>
          <p>${esc(L(s)[1])}</p>
          <div class="s-price"><small>${t("srv.from")}</small><b>${money(s.price)}</b><span>${esc(L(s.unit))}</span></div>
          <div class="s-actions">
            ${s.id === "delivery" ? `<a href="#menu" class="btn btn-primary btn-sm">${t("hero.cta1")}</a>`
              : BOOKABLE.includes(s.id) ? `<a href="#booking" class="btn btn-primary btn-sm" data-book="${s.id}">${t("srv.book")}</a>` : ""}
            <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(`${I18N[state.lang].wa.quote}: ${L(s)[0]} — ${CFG.name}`)}">${t("srv.quote")}</a>
          </div>
        </div>
      </article>`).join("");
  }
  $("#servicesGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-book]"); if (b) $("#bookingType").value = b.dataset.book;
  });

  /* ================= LOYALTY ================= */
  function renderLoyalty() {
    const pts = state.points, tier = tierOf(pts);
    $("#lcPoints").textContent = pts;
    $("#lcTier").textContent = tier.name;
    $("#loyaltyCard").dataset.tier = tier.name.toLowerCase();
    $("#lcId").textContent = state.loyaltyId || "—";
    $("#lcInactive").hidden = !!state.loyaltyId;
    const next = pts < 100 ? [100, "Silver"] : pts < 300 ? [300, "Gold"] : null;
    const floor = pts < 100 ? 0 : pts < 300 ? 100 : 300;
    $("#lcBar").style.width = next ? ((pts - floor) / (next[0] - floor) * 100) + "%" : "100%";
    $("#lcNext").textContent = next ? t("loy.next", { n: next[0] - pts, t: next[1] }) : t("loy.max");
    const stamps = Math.min(10, Math.floor((pts % 50) / 5));
    $("#lcStamps").innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < stamps ? "on" : ""}">☕</i>`).join("");
  }

  /* ================= HOURS ================= */
  const toMin = hm;
  function openStatus(now = new Date()) {
    const d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    const win = day => { const [o, c] = CFG.hours[day]; let oc = toMin(c); const oo = toMin(o); if (oc <= oo) oc += 1440; return [oo, oc, c]; };
    const [o, c, cs] = win(d);
    const [, py, pys] = win((d + 6) % 7);
    if (m >= o && m < c) return { open: true, at: cs };
    if (py > 1440 && m < py - 1440) return { open: true, at: pys };
    const nextOpen = m < o ? CFG.hours[d][0] : CFG.hours[(d + 1) % 7][0];
    return { open: false, at: nextOpen };
  }
  function isOpenAt(dateStr, timeStr) {
    if (!dateStr || !timeStr) return true;
    return openStatus(new Date(`${dateStr}T${timeStr}`)).open;
  }
  function renderHours() {
    const st = openStatus();
    const pill = $("#openStatus");
    pill.classList.toggle("closed", !st.open);
    $("b", pill).textContent = t(st.open ? "open.now" : "open.closed", { t: st.at });
    const days = I18N[state.lang].days, today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    $("#hoursList").innerHTML = order.map(d => `<li class="${d === today ? "today" : ""}"><span>${days[d]}</span><b>${CFG.hours[d][0]} – ${CFG.hours[d][1]}</b></li>`).join("");
    $("#ctAddress").textContent = L(CFG.address);
    $("#ctPhone").textContent = CFG.phoneDisplay; $("#ctPhone").href = "tel:" + CFG.phone; $("#ctPhone").dir = "ltr";
    $("#ctEmail").textContent = CFG.email; $("#ctEmail").href = "mailto:" + CFG.email;
  }

  /* ================= BOOKING ================= */
  function renderBookingTypes() {
    const sel = $("#bookingType"), cur = sel.value;
    sel.innerHTML = `<option value="table">${t("bk.table")}</option>` +
      SERVICES.filter(s => BOOKABLE.includes(s.id))
        .map(s => `<option value="${s.id}">${esc(L(s)[0])} — ${money(s.price)} ${esc(L(s.unit))}</option>`).join("");
    if (cur) sel.value = cur;
  }
  const dateInput = $("#bookingForm [name=date]");
  dateInput.min = new Date().toISOString().slice(0, 10);

  $("#bookingForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, msgEl = $("#bookingMsg");
    msgEl.className = "form-msg";
    if (!f.checkValidity()) { msgEl.textContent = t("bk.err"); msgEl.classList.add("err"); f.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    if (!isOpenAt(d.date, d.time)) { msgEl.textContent = t("bk.closed"); msgEl.classList.add("err"); return; }
    const code = CafeOrders.newRef("RSV");
    const typeLabel = f.type.options[f.type.selectedIndex].text;
    const W = I18N[state.lang].wa;
    const text = [`📅 *${CFG.name}* — ${W.booking}`, `${W.code}: ${code}`, "",
      `${t("bk.name")}: ${d.name}`, `${t("bk.phone")}: ${d.phone}`, `${t("bk.date")}: ${d.date} · ${d.time}`,
      `${t("bk.guests")}: ${d.guests}`, `${t("bk.type")}: ${typeLabel}`, d.notes ? `${t("bk.notes")}: ${d.notes}` : ""].filter(Boolean).join("\n");
    const booking = { code, at: Date.now(), name: d.name.trim(), phone: d.phone.trim(), date: d.date, time: d.time,
      guests: parseInt(d.guests, 10), type: d.type, notes: (d.notes || "").trim(), status: "pending", lang: state.lang };
    const btn = $("[type=submit]", f);
    let online = false;
    if (CafeBookings.mode === "firebase") {
      btn.disabled = true;
      try { await CafeBookings.create(booking); online = true; }
      catch (err) { console.warn("Booking not saved online, falling back to WhatsApp", err); }
      btn.disabled = false;
    }
    if (!online) {
      await LocalOnly.saveBooking(booking);
      openWhatsApp(waLink(text));
    }
    msgEl.textContent = t(online ? "bk.okOnline" : "bk.ok", { code }); msgEl.classList.add("ok");
    f.reset(); f.guests.value = 2;
  });

  // a local copy keeps WhatsApp-only bookings visible in "My bookings"
  const LocalOnly = {
    async saveBooking(b) {
      const list = store.get("bookings", []);
      if (!list.some(x => x.code === b.code)) list.push(b);
      store.set("bookings", list.slice(-500));
      dispatchEvent(new StorageEvent("storage", { key: "cm_bookings" }));
    }
  };

  /* ---------- my bookings (live status, cancel) ---------- */
  function renderMyBookings() {
    const today = new Date().toISOString().slice(0, 10);
    const list = state.myBookings.filter(b => b.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const box = $("#myBookings");
    box.hidden = !list.length;
    if (!list.length) return;
    const typeName = id => id === "table" ? t("bk.table") : (SERVICES.find(s => s.id === id) ? L(SERVICES.find(s => s.id === id))[0] : id);
    const dateFmt = new Intl.DateTimeFormat(state.lang === "ar" ? "ar-MA" : state.lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
    box.innerHTML = `<h3>${t("bk.mine")}</h3>` + list.map(b => {
      const st = b.status || "pending";
      return `<div class="my-bk">
        <div><b>${dateFmt.format(new Date(b.date + "T12:00"))} · ${esc(b.time)}</b>
          <small>${esc(typeName(b.type))} · ${esc(b.guests)} ${t("bk.people")} · #${esc(b.code)}</small></div>
        <span class="st st-${st === "pending" ? "new" : st === "confirmed" ? "ready" : st}">${t("bk.st." + st)}</span>
        ${["pending", "confirmed"].includes(st) && CafeBookings.mode === "firebase" ? `<button type="button" class="btn btn-link btn-sm" data-cancel-bk="${esc(b.code)}">${t("bk.cancel")}</button>` : ""}
      </div>`;
    }).join("");
  }
  $("#myBookings").addEventListener("click", async e => {
    const b = e.target.closest("[data-cancel-bk]"); if (!b) return;
    if (!await uiConfirm(t("bk.cancelQ"), { ok: t("bk.cancel"), cancel: t("ui.keep"), danger: true })) return;
    try { await CafeBookings.cancelMine(b.dataset.cancelBk); toast(t("bk.cancelled")); }
    catch { toast(t("bk.cancelErr")); }
  });
  CafeBookings.watchMine(list => { state.myBookings = list; renderMyBookings(); }, err => console.warn(err));

  /* ================= REVIEWS ================= */
  const numFmt = (n, d = 1) => new Intl.NumberFormat(state.lang === "ar" ? "ar-MA" : state.lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const starsHtml = n => `<span class="stars" aria-label="${n}/5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;

  function renderReviews() {
    const list = rv.list, n = list.length;
    const avg = n ? list.reduce((s, r) => s + r.rating, 0) / n : 0;
    $("#ratingStat").hidden = !n;
    $("#ratingStatVal").textContent = n ? numFmt(avg) + "★" : "—";
    if (!n) {
      $("#rvSummary").innerHTML = `<p class="rv-none">${t("rev.none")}</p>`;
      $("#rvList").innerHTML = ""; $("#rvMore").hidden = true;
    } else {
      const dist = [5, 4, 3, 2, 1].map(s => [s, list.filter(r => r.rating === s).length]);
      $("#rvSummary").innerHTML = `
        <div class="rv-avg"><b>${numFmt(avg)}</b><span>/5</span></div>
        <div class="rv-avg-stars" style="--pct:${avg / 5 * 100}%"><span>★★★★★</span></div>
        <small>${t("rev.count", { n })}</small>
        <ul class="rv-dist">${dist.map(([s, c]) => `<li><span>${s}★</span><i><em style="width:${c / n * 100}%"></em></i><span>${c}</span></li>`).join("")}</ul>`;
      const dateFmt = new Intl.DateTimeFormat(state.lang === "ar" ? "ar-MA" : state.lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" });
      $("#rvList").innerHTML = list.slice(0, rv.shown).map(r => `
        <figure class="review">
          ${starsHtml(r.rating)}
          <blockquote dir="auto">${esc(r.text)}</blockquote>
          <figcaption><bdi>${esc(r.name)}</bdi> · ${dateFmt.format(r.at)}${r.orderRef ? ` · <span class="verified">✓ ${t("rev.verified")}</span>` : ""}</figcaption>
          ${r.reply ? `<div class="rv-reply"><b>${t("rev.reply")}</b><p dir="auto">${esc(r.reply)}</p></div>` : ""}
        </figure>`).join("");
      $("#rvMore").hidden = n <= rv.shown;
    }
    renderMyReview();
  }
  function renderMyReview() {
    const m = rv.mine, box = $("#rvMine");
    box.hidden = !m; $("#rvFields").hidden = !!m;
    if (m) box.textContent = t("rev.mine." + (m.status || "pending"), { r: m.rating });
    $("#rvLinked").hidden = !rv.linkedOrder;
    if (rv.linkedOrder) $("#rvLinked").textContent = t("rev.linked", { r: rv.linkedOrder });
    const v = +($("#reviewForm input[name=rating]:checked") || {}).value || 0;
    $("#starsLabel").textContent = v ? I18N[state.lang]["rev.stars"][v] : "";
  }
  const refreshMine = async () => { rv.mine = await CafeReviews.mine(); renderMyReview(); };
  CafeReviews.watchPublic(list => { rv.list = list; renderReviews(); refreshMine(); }, err => console.warn("Reviews unavailable", err));
  $("#rvMore").addEventListener("click", () => { rv.shown += 6; renderReviews(); });

  // star picker: highlight up to the hovered / chosen star
  const paintStars = upTo => $$("#starsInput label").forEach((l, i) => l.classList.toggle("on", i < upTo));
  $("#starsInput").addEventListener("change", () => { paintStars(+$("#reviewForm input[name=rating]:checked").value); renderMyReview(); });
  $("#starsInput").addEventListener("mouseover", e => { const l = e.target.closest("label"); if (l) paintStars($$("#starsInput label").indexOf(l) + 1); });
  $("#starsInput").addEventListener("mouseleave", () => paintStars(+($("#reviewForm input[name=rating]:checked") || {}).value || 0));
  $("#reviewForm textarea").addEventListener("input", e => { $("#rvCount").textContent = e.target.value.length; });
  $("#reviewForm").addEventListener("focusin", () => { rv.startedAt = rv.startedAt || Date.now(); });

  $("#reviewForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, msg = $("#reviewMsg"), d = Object.fromEntries(new FormData(f));
    msg.className = "form-msg";
    const fail = k => { msg.textContent = t(k); msg.classList.add("err"); };
    if (d.website) { msg.textContent = t("rev.ok"); msg.classList.add("ok"); return; }   // bot filled the hidden field
    const rating = parseInt(d.rating, 10), text = (d.text || "").trim(), name = (d.name || "").trim();
    if (!(rating >= 1 && rating <= 5) || text.length < 10 || !name) return fail("rev.invalid");
    if (!rv.startedAt || Date.now() - rv.startedAt < 3000) return fail("rev.tooFast");
    const btn = $("[type=submit]", f); btn.disabled = true;
    const review = { at: Date.now(), rating, name: name.slice(0, 40), text: text.slice(0, 600), lang: state.lang };
    if (rv.linkedOrder) review.orderRef = rv.linkedOrder;
    const res = await CafeReviews.submit(review);
    btn.disabled = false;
    if (!res.ok) return fail(res.error === "exists" ? "rev.exists" : "rev.err");
    msg.textContent = t("rev.ok"); msg.classList.add("ok");
    f.reset(); paintStars(0); $("#rvCount").textContent = 0; rv.linkedOrder = null;
    await refreshMine();
  });

  /* ================= GALLERY ================= */
  function renderGallery() {
    $("#galleryGrid").innerHTML = window.CAFE_GALLERY.map((src, i) =>
      `<figure class="g-item g-${i}"><img src="${src}" alt="" loading="lazy"></figure>`).join("");
  }

  /* ================= QR ================= */
  const menuUrl = () => location.href.split("#")[0] + "#menu";
  let qrMade = false;
  function openQR() {
    $("#qrModal").showModal();
    if (qrMade || !window.QRCode) return;
    new QRCode($("#qrBox"), { text: menuUrl(), width: 220, height: 220, colorDark: "#2B1A12", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    qrMade = true;
  }
  $$("[data-action=qr]").forEach(b => b.addEventListener("click", openQR));
  $("#qrDownload").addEventListener("click", () => {
    const c = $("#qrBox canvas"); if (!c) return;
    const a = document.createElement("a"); a.download = "cafe-mouhsine-menu-qr.png"; a.href = c.toDataURL("image/png"); a.click();
  });
  $("#qrShare").addEventListener("click", async () => {
    const url = menuUrl();
    try {
      if (navigator.share) await navigator.share({ title: CFG.name, url });
      else { await navigator.clipboard.writeText(url); toast(t("qr.copied")); }
    } catch { /* cancelled */ }
  });

  /* ================= NAV / MISC ================= */
  $$(".lang button").forEach(b => b.addEventListener("click", () => { state.lang = b.dataset.lang; applyLang(); }));
  const burger = $("#burger");
  burger.addEventListener("click", () => {
    const open = $("#navLinks").classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
  });
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => { $("#navLinks").classList.remove("open"); burger.setAttribute("aria-expanded", false); }));

  $("#waFloat").href = waLink(CFG.name);
  $("#year").textContent = new Date().getFullYear();
  // Google Maps sets its own cookies: load the embed only when the visitor asks
  $("#mapLink").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CFG.mapQuery)}`;
  $("#mapLoad").addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.title = "Map"; f.referrerPolicy = "no-referrer-when-downgrade";
    f.src = `https://maps.google.com/maps?q=${encodeURIComponent(CFG.mapQuery)}&z=14&output=embed`;
    $("#mapConsent").replaceWith(f);
  });

  const toTop = $("#toTop");
  addEventListener("scroll", () => {
    toTop.classList.toggle("show", scrollY > 700);
    $(".header").classList.toggle("scrolled", scrollY > 10);
  }, { passive: true });
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  // counters + reveal
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target; io.unobserve(el);
    if (el.dataset.count) {
      const end = +el.dataset.count, t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(end * k) + "+"; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    } else el.classList.add("in");
  }), { threshold: .15 });
  $("[data-count='35']").dataset.count = PRODUCTS.length;
  $("[data-count='6']").dataset.count = SERVICES.length;
  $$("[data-count], .section-head, .feature, .review, .loyalty-card").forEach(el => { if (!el.dataset.count) el.classList.add("reveal"); io.observe(el); });

  function renderAll() {
    renderTabs(); renderDiet(); renderHappyHour(); renderGrid(); renderServices(); renderLoyalty(); renderHours(); renderBookingTypes(); renderCart(); renderMyBookings(); renderReviews();
  }

  /* ---------- search engines: structured data + canonical URL from CAFE_CONFIG ---------- */
  // Built at runtime (Google renders JavaScript) so editing data.js is enough.
  // Placeholder contact details are left out rather than published to Google.
  (function seo() {
    if (!/^https?:$/.test(location.protocol)) return;
    const site = location.origin + location.pathname.replace(/index\.html$/, "");
    const isPlaceholder = v => !v || /600000000|00 00 00 00/.test(v);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const data = {
      "@context": "https://schema.org", "@type": "CafeOrCoffeeShop",
      name: CFG.name, url: site, image: new URL("assets/icon.svg", site).href,
      servesCuisine: ["Coffee", "Moroccan", "Pastry", "Breakfast"],
      priceRange: `${Math.min(...PRODUCTS.map(p => p.price))}–${Math.max(...SERVICES.map(s => s.price))} MAD`,
      currenciesAccepted: "MAD", paymentAccepted: "Cash, Credit Card",
      acceptsReservations: true, hasMenu: new URL("menu-print.html", site).href,
      address: { "@type": "PostalAddress", streetAddress: CFG.address.fr.split(",")[0], addressLocality: (CFG.legal && CFG.legal.city && CFG.legal.city.fr) || "Meknès", addressCountry: "MA" },
      openingHoursSpecification: Object.entries(CFG.hours).map(([d, [opens, closes]]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dayNames[d], opens, closes }))
    };
    if (!isPlaceholder(CFG.phone)) data.telephone = CFG.phone;
    if (CFG.email && CFG.email !== "contact@cafe-mouhsine.ma") data.email = CFG.email;   // skip the template address
    const s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(data);
    document.head.append(s);
    if (!document.querySelector('link[rel="canonical"]')) {
      const l = document.createElement("link"); l.rel = "canonical"; l.href = site; document.head.append(l);
    }
  })();

  // QR table cards link to ?table=N — preselect dine-in with that table
  const tableNo = new URLSearchParams(location.search).get("table");
  if (tableNo && /^\d{1,3}$/.test(tableNo)) {
    $("input[name=mode][value=table]").checked = true;
    $("#modeDetail").value = tableNo;
  }

  CafeLoyalty.watch(({ points, id }) => {
    state.points = points; state.loyaltyId = id;
    renderLoyalty(); renderCart();   // tier discount depends on points
  }, err => console.warn("Loyalty unavailable", err));

  applyLang();
  renderGallery();
  if (CafeOrders.mode === "firebase") {
    $("#checkoutBtn").dataset.i18n = "cart.checkoutOnline"; $("#checkoutBtn").textContent = t("cart.checkoutOnline");
    const open = store.get("orders", []).some(o => Date.now() - o.at < 18 * 3600e3 && !["served", "cancelled"].includes(o.status));
    if (open) watchMyOrders();
  }
  let hhWas = !!happyHour();
  setInterval(() => {
    renderHours();
    const hhNow = !!happyHour();
    if (hhNow !== hhWas) { hhWas = hhNow; renderHappyHour(); renderGrid(); renderCart(); }
  }, 60000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
