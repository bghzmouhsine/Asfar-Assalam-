/* =========================================================
   Café Mouhsine BOUAGHAZ — front-end application
   No build step, no backend: orders & bookings go out via WhatsApp,
   local state (cart, points, language, theme) lives in localStorage.
   ========================================================= */
(() => {
  "use strict";

  const CFG = window.CAFE_CONFIG;
  const CATS = window.CAFE_CATEGORIES;
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
    cat: "all", q: "", sort: "default", view: store.get("view", "grid"),
    cart: store.get("cart", []).filter(i => byId[i.id]),
    promo: null,
    points: store.get("points", 0),
    loyaltyId: store.get("loyaltyId", null)
  };
  if (!I18N[state.lang]) state.lang = "ar";
  if (!state.loyaltyId) { state.loyaltyId = "CM-" + Math.random().toString(36).slice(2, 8).toUpperCase(); store.set("loyaltyId", state.loyaltyId); }

  const t = (k, vars) => {
    let s = (I18N[state.lang] && I18N[state.lang][k]) ?? I18N.ar[k] ?? k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
    return s;
  };
  const L = obj => obj[state.lang] || obj.ar;              // [name, desc] tuple or string
  const cur = () => state.lang === "ar" ? "درهم" : CFG.currency;
  const money = n => `${Number(n).toLocaleString(state.lang === "en" ? "en-US" : "fr-MA", { maximumFractionDigits: 2 })} ${cur()}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const priceOf = (p, size) => {
    const s = (p.sizes || []).find(x => x[0] === size);
    return p.price + (s ? s[1] : 0);
  };

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
    let list = PRODUCTS.filter(p => (state.cat === "all" || p.cat === state.cat) &&
      (!q || [p.ar, p.fr, p.en].flat().join(" ").toLowerCase().includes(q)));
    if (state.sort === "asc") list.sort((a, b) => a.price - b.price);
    if (state.sort === "desc") list.sort((a, b) => b.price - a.price);
    if (state.sort === "name") list.sort((a, b) => L(a)[0].localeCompare(L(b)[0], state.lang));
    return list;
  }

  const tagHtml = p => p.tags.map(tg => `<span class="tag tag-${tg}">${t("tag." + tg)}</span>`).join("");

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
              <span class="pr-price">${p.sizes ? p.sizes.map(s => p.price + s[1]).join(" / ") + " " + cur() : money(p.price)}</span>
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
            <span class="price">${money(p.price)}</span>
          </div>
          <p>${esc(L(p)[1])}</p>
          <div class="p-foot">
            <small>${p.kcal ? p.kcal + " " + t("p.kcal") : ""}${p.sizes ? ` · ${p.sizes.map(s => esc(s[0])).join(" / ")}` : ""}</small>
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
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderGrid(); });
  $$(".view-toggle button").forEach(b => b.addEventListener("click", () => {
    state.view = b.dataset.view; store.set("view", state.view);
    $$(".view-toggle button").forEach(x => x.classList.toggle("active", x === b));
    renderGrid();
  }));

  $("#grid").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); const p = byId[add.dataset.add]; addToCart(p.id, p.sizes ? p.sizes[0][0] : null, 1); return; }
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
    const body = $("#productBody");
    const draw = () => {
      body.innerHTML = `
        <div class="pm">
          <img src="${p.img.replace("w=640", "w=900")}" alt="${esc(L(p)[0])}">
          <div class="pm-info">
            <div class="p-tags static">${tagHtml(p)}</div>
            <h3>${esc(L(p)[0])}</h3>
            <p>${esc(L(p)[1])}</p>
            ${p.kcal ? `<small class="muted">${p.kcal} ${t("p.kcal")}</small>` : ""}
            ${p.sizes ? `<div class="opt"><b>${t("p.size")}</b><div class="chips">${p.sizes.map(s =>
              `<button type="button" class="chip ${s[0] === size ? "active" : ""}" data-size="${esc(s[0])}">${esc(s[0])}<small>${money(p.price + s[1])}</small></button>`).join("")}</div></div>` : ""}
            <div class="opt"><b>${t("p.qty")}</b>
              <div class="qty"><button type="button" data-q="-1">−</button><span>${qty}</span><button type="button" data-q="1">+</button></div>
            </div>
            <button type="button" class="btn btn-primary btn-block" id="pmAdd" ${p.available ? "" : "disabled"}>${t("p.add")} · ${money(priceOf(p, size) * qty)}</button>
          </div>
        </div>`;
    };
    draw();
    body.onclick = e => {
      const s = e.target.closest("[data-size]"); if (s) { size = s.dataset.size; draw(); }
      const q = e.target.closest("[data-q]"); if (q) { qty = Math.max(1, qty + +q.dataset.q); draw(); }
      if (e.target.closest("#pmAdd")) { addToCart(p.id, size, qty); $("#productModal").close(); }
    };
    $("#productModal").showModal();
  }
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  /* ================= CART ================= */
  const PROMOS = { MOUHSINE10: { pct: 10 }, BIENVENUE: { amt: 15 }, COFFEE20: { pct: 20, min: 200 } };
  const tierOf = pts => pts >= 300 ? { name: "Gold", pct: 15 } : pts >= 100 ? { name: "Silver", pct: 10 } : { name: "Bronze", pct: 0 };

  function addToCart(id, size, qty) {
    const p = byId[id]; if (!p || !p.available) return;
    const key = id + "|" + (size || "");
    const line = state.cart.find(i => i.key === key);
    if (line) line.qty += qty; else state.cart.push({ key, id, size, qty });
    saveCart(); toast(`${t("cart.added")} · ${L(p)[0]}`);
    const btn = $("#cartBtn"); btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
  }
  function saveCart() { store.set("cart", state.cart); renderCart(); }

  function totals() {
    const mode = $("input[name=mode]:checked").value;
    const sub = state.cart.reduce((s, i) => s + priceOf(byId[i.id], i.size) * i.qty, 0);
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
    $("#cartFoot").hidden = count === 0;
    if (!count) { box.innerHTML = `<p class="cart-empty">${t("cart.empty")}</p>`; return; }
    box.innerHTML = state.cart.map(i => {
      const p = byId[i.id];
      return `<div class="line">
        <img src="${p.img.replace("w=640", "w=160")}" alt="">
        <div class="line-info"><b>${esc(L(p)[0])}</b>${i.size ? `<small>${esc(i.size)}</small>` : ""}<span>${money(priceOf(p, i.size) * i.qty)}</span></div>
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
  $("#cartBtn").addEventListener("click", () => openDrawer(true));
  $("#overlay").addEventListener("click", () => openDrawer(false));
  $("[data-close]").addEventListener("click", () => openDrawer(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") openDrawer(false); });

  const waLink = text => `https://wa.me/${CFG.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

  $("#checkoutBtn").addEventListener("click", () => {
    const tt = totals();
    const detail = $("#modeDetail").value.trim();
    if (tt.mode !== "takeaway" && !detail) { toast(t("cart.needDetail")); $("#modeDetail").focus(); return; }
    const W = I18N[state.lang].wa;
    const ref = "CMD-" + Date.now().toString(36).toUpperCase().slice(-6);
    const lines = state.cart.map(i => `• ${i.qty} × ${L(byId[i.id])[0]}${i.size ? ` (${i.size})` : ""} — ${money(priceOf(byId[i.id], i.size) * i.qty)}`);
    const msg = [
      `☕ *${CFG.name}* — ${W.order}`, `${W.code}: ${ref}`, "",
      ...lines, "",
      `${t("cart.subtotal")}: ${money(tt.sub)}`,
      tt.disc ? `${t("cart.discount")}: −${money(tt.disc)}${state.promo ? ` (${state.promo})` : ""}` : "",
      tt.mode === "delivery" ? `${t("cart.fee")}: ${money(tt.del)}` : "",
      `*${W.total}: ${money(tt.total)}*`, "",
      `${W.mode}: ${t("cart." + tt.mode)}${detail ? " — " + detail : ""}`,
      $("#orderName").value.trim() ? `${W.name}: ${$("#orderName").value.trim()}` : "",
      `Loyalty: ${state.loyaltyId}`
    ].filter((l, idx, a) => l !== "" || a[idx - 1] !== "").join("\n");

    // record locally for the admin dashboard
    const orders = store.get("orders", []);
    orders.push({ ref, at: Date.now(), mode: tt.mode, total: tt.total, items: state.cart.map(i => ({ id: i.id, size: i.size, qty: i.qty })) });
    store.set("orders", orders.slice(-500));

    state.points += tt.pts; store.set("points", state.points);
    window.open(waLink(msg), "_blank", "noopener");
    toast(t("cart.sent", { n: tt.pts }));
    state.cart = []; state.promo = null; $("#promoInput").value = ""; $("#modeDetail").value = "";
    saveCart(); renderLoyalty(); openDrawer(false);
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
    $("#lcId").textContent = state.loyaltyId;
    const next = pts < 100 ? [100, "Silver"] : pts < 300 ? [300, "Gold"] : null;
    const floor = pts < 100 ? 0 : pts < 300 ? 100 : 300;
    $("#lcBar").style.width = next ? ((pts - floor) / (next[0] - floor) * 100) + "%" : "100%";
    $("#lcNext").textContent = next ? t("loy.next", { n: next[0] - pts, t: next[1] }) : t("loy.max");
    const stamps = Math.min(10, Math.floor((pts % 50) / 5));
    $("#lcStamps").innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < stamps ? "on" : ""}">☕</i>`).join("");
  }

  /* ================= HOURS ================= */
  const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
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

  $("#bookingForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, msgEl = $("#bookingMsg");
    msgEl.className = "form-msg";
    if (!f.checkValidity()) { msgEl.textContent = t("bk.err"); msgEl.classList.add("err"); f.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    if (!isOpenAt(d.date, d.time)) { msgEl.textContent = t("bk.closed"); msgEl.classList.add("err"); return; }
    const code = "RSV-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const typeLabel = f.type.options[f.type.selectedIndex].text;
    const W = I18N[state.lang].wa;
    const text = [`📅 *${CFG.name}* — ${W.booking}`, `${W.code}: ${code}`, "",
      `${t("bk.name")}: ${d.name}`, `${t("bk.phone")}: ${d.phone}`, `${t("bk.date")}: ${d.date} · ${d.time}`,
      `${t("bk.guests")}: ${d.guests}`, `${t("bk.type")}: ${typeLabel}`, d.notes ? `${t("bk.notes")}: ${d.notes}` : ""].filter(Boolean).join("\n");
    const list = store.get("bookings", []); list.push({ code, at: Date.now(), ...d }); store.set("bookings", list.slice(-500));
    window.open(waLink(text), "_blank", "noopener");
    msgEl.textContent = t("bk.ok", { code }); msgEl.classList.add("ok");
    f.reset(); f.guests.value = 2;
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
  $("#mapFrame").src = `https://maps.google.com/maps?q=${encodeURIComponent(CFG.mapQuery)}&z=14&output=embed`;

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
    renderTabs(); renderGrid(); renderServices(); renderLoyalty(); renderHours(); renderBookingTypes(); renderCart();
  }

  applyLang();
  renderGallery();
  setInterval(renderHours, 60000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
