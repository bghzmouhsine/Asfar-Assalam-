/* =========================================================
   Café Mouhsine BOUAGHAZ — sales dashboard (admin)
   SalesDashboard.mount(element) once, then .update(orders) on every
   data change. Charts are plain SVG/HTML: no library.
   Palette validated with the dataviz checks (categorical, 3 slots,
   all-pairs) on the admin surfaces #FFFCF7 (light) / #221812 (dark).
   ========================================================= */
(() => {
  "use strict";
  const CFG = window.CAFE_CONFIG;
  const PRODUCTS = Object.fromEntries(window.CAFE_PRODUCTS.map(p => [p.id, p]));
  const CHANNELS = [["table", "في المقهى"], ["takeaway", "سفري"], ["delivery", "توصيل"]];
  const RANGES = [["today", "اليوم"], ["7", "7 أيام"], ["30", "30 يوماً"], ["90", "90 يوماً"]];
  const DAY = 86400e3;

  const fmt = n => Math.round(n).toLocaleString("fr-MA");
  const money = n => `${Number(n).toLocaleString("fr-MA", { maximumFractionDigits: 1 })} درهم`;
  const el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  const svgEl = (tag, attrs = {}) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  // round an axis maximum up to a clean value (1, 2, 2.5, 5 × 10^n)
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

  let root, state = { range: "7", channel: "all", tables: {} }, ORDERS = [];
  const tip = el("div", { class: "viz-tip", role: "tooltip", hidden: "" });

  /* ---------- tooltip: shared, follows pointer or keyboard focus ---------- */
  function showTip(target, lines, evt) {
    tip.replaceChildren(...lines.map(([strong, rest], i) => {
      const row = el("div", { class: i ? "viz-tip-row" : "viz-tip-head" });
      if (strong != null) row.append(el("b", {}, strong));
      if (rest) row.append(document.createTextNode(" " + rest));
      return row;
    }));
    tip.hidden = false;
    const r = target.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = evt && evt.clientX != null ? evt.clientX : r.left + r.width / 2;
    const y = evt && evt.clientY != null ? evt.clientY : r.top;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + "px";
    tip.style.top = Math.max(8, y - h - 12) + "px";
  }
  const hideTip = () => { tip.hidden = true; };
  function bindTip(node, lines) {
    node.setAttribute("tabindex", "0");
    node.addEventListener("pointermove", e => showTip(node, lines, e));
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("focus", () => showTip(node, lines));
    node.addEventListener("blur", hideTip);
  }

  /* ---------- data ---------- */
  function period() {
    const now = Date.now();
    const start = state.range === "today" ? startOfDay(now) : startOfDay(now) - (+state.range - 1) * DAY;
    const len = now - start;
    return { start, end: now, prevStart: start - (state.range === "today" ? DAY : +state.range * DAY), prevEnd: start, len };
  }
  const keep = o => o.status !== "cancelled" && (state.channel === "all" || o.mode === state.channel);
  const inRange = (o, a, b) => o.at >= a && o.at < b;
  // revenue per line: price recorded at checkout, else today's catalogue price (estimate)
  const lineValue = i => (i.price != null ? i.price : (PRODUCTS[i.id] ? PRODUCTS[i.id].price : 0)) * i.qty;

  function stats(list) {
    const revenue = list.reduce((s, o) => s + (o.total || 0), 0);
    const items = list.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    return { revenue, orders: list.length, basket: list.length ? revenue / list.length : 0, items };
  }

  /* ---------- KPI tiles ---------- */
  function tile(label, value, cur, prev, hero) {
    const t = el("div", { class: "viz-tile" + (hero ? " hero" : "") });
    t.append(el("span", { class: "viz-tile-label" }, label), el("b", { class: "viz-tile-value" }, value));
    const d = el("span", { class: "viz-delta" });
    if (prev > 0) {
      const pct = (cur - prev) / prev * 100, up = pct >= 0;
      d.classList.add(Math.abs(pct) < 0.5 ? "flat" : up ? "up" : "down");
      // the signed number sits in its own LTR run so "+5%" doesn't flip inside Arabic text
      d.append(`${Math.abs(pct) < 0.5 ? "■" : up ? "▲" : "▼"} `, el("bdi", { dir: "ltr" }, `${up ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`), " مقارنة بالفترة السابقة");
    } else { d.classList.add("flat"); d.textContent = "لا توجد فترة سابقة للمقارنة"; }
    t.append(d);
    return t;
  }

  /* ---------- column chart (time on x, LTR) ---------- */
  // drawn at the card's real width so 11px text stays 11px on phones
  const chartWidth = () => {
    const w = root ? root.clientWidth : 640;
    return Math.round(Math.max(300, Math.min(760, w < 960 ? w - 34 : w / 2 - 48)));
  };
  function columns(buckets, { valueOf, tipOf, labelEvery }) {
    const W = chartWidth(), H = W < 420 ? 190 : 220, padL = 40, padR = 8, padT = 22, padB = 26;
    const max = niceMax(Math.max(...buckets.map(valueOf), 0));
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "viz-svg", role: "img" });
    const plotW = W - padL - padR, plotH = H - padT - padB, step = plotW / buckets.length;
    const bw = Math.max(2, Math.min(24, step - 2));        // thin bars, 2px surface gap minimum
    for (let k = 0; k <= 4; k++) {                          // hairline grid + clean ticks
      const v = max * k / 4, y = padT + plotH - plotH * k / 4;
      svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, class: k ? "viz-grid" : "viz-axis" }));
      const tx = svgEl("text", { x: padL - 6, y: y + 4, class: "viz-tick", "text-anchor": "end" }); tx.textContent = fmt(v); svg.append(tx);
    }
    let peak = -1, peakV = -1;
    buckets.forEach((b, i) => { const v = valueOf(b); if (v > peakV) { peakV = v; peak = i; } });
    buckets.forEach((b, i) => {
      const v = valueOf(b), x = padL + i * step + (step - bw) / 2;
      const h = v > 0 ? Math.max(2, plotH * v / max) : 0, y = padT + plotH - h;
      const g = svgEl("g", { class: "viz-bar" });
      g.append(svgEl("rect", { x: padL + i * step, y: padT, width: step, height: plotH, class: "viz-hit" }));   // hit area = whole slot
      if (h) {
        const r = Math.min(4, bw / 2, h);                     // 4px rounded data-end, square at the baseline
        g.append(svgEl("path", { class: "viz-fill", d: `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z` }));
      }
      bindTip(g, tipOf(b));
      g.setAttribute("aria-label", tipOf(b).map(l => l.filter(Boolean).join(" ")).join(" — "));
      svg.append(g);
      if (i % labelEvery === 0 || i === buckets.length - 1) {
        const tx = svgEl("text", { x: padL + i * step + step / 2, y: H - 8, class: "viz-tick", "text-anchor": "middle" }); tx.textContent = b.label; svg.append(tx);
      }
      if (i === peak && v > 0) {                               // label only the peak
        const tx = svgEl("text", { x: x + bw / 2, y: Math.max(12, y - 6), class: "viz-peak", "text-anchor": "middle" }); tx.textContent = fmt(v); svg.append(tx);
      }
    });
    return svg;
  }

  /* ---------- card with chart / table toggle ---------- */
  function card(id, title, subtitle, chartNode, table) {
    const c = el("section", { class: "viz-card" });
    const head = el("div", { class: "viz-card-head" });
    const h = el("div"); h.append(el("h3", {}, title)); if (subtitle) h.append(el("small", {}, subtitle));
    const btn = el("button", { class: "viz-toggle", type: "button", "aria-pressed": String(!!state.tables[id]) }, state.tables[id] ? "📊 رسم بياني" : "▦ جدول");
    btn.addEventListener("click", () => { state.tables[id] = !state.tables[id]; render(); });
    head.append(h, btn); c.append(head);
    if (state.tables[id]) {
      const t = el("table", { class: "viz-table" });
      const tr = el("tr"); table.head.forEach(x => tr.append(el("th", {}, x))); t.append(tr);
      table.rows.forEach(r => { const row = el("tr"); r.forEach(x => row.append(el("td", {}, x))); t.append(row); });
      const wrap = el("div", { class: "viz-table-wrap" }); wrap.append(t); c.append(wrap);
    } else c.append(chartNode);
    return c;
  }

  /* ---------- render ---------- */
  function render() {
    if (!root) return;
    hideTip();
    const P = period();
    const cur = ORDERS.filter(o => keep(o) && inRange(o, P.start, P.end));
    const prev = ORDERS.filter(o => keep(o) && inRange(o, P.prevStart, P.prevEnd));
    const S = stats(cur), SP = stats(prev);

    // filters: one row above everything they scope
    const bar = el("div", { class: "viz-filters" });
    const seg = (items, key, label) => {
      const g = el("div", { class: "viz-seg", role: "group", "aria-label": label });
      items.forEach(([v, l]) => {
        const b = el("button", { type: "button", "aria-pressed": String(state[key] === v) }, l);
        b.addEventListener("click", () => { state[key] = v; render(); });
        g.append(b);
      });
      return g;
    };
    bar.append(seg(RANGES, "range", "الفترة"), seg([["all", "كل القنوات"], ...CHANNELS], "channel", "القناة"));
    const exp = el("button", { type: "button", class: "viz-export" }, "⬇ تصدير CSV");
    exp.addEventListener("click", () => exportCsv(cur));
    bar.append(exp);

    const kpis = el("div", { class: "viz-kpis" });
    kpis.append(
      tile("رقم المعاملات", money(S.revenue), S.revenue, SP.revenue, true),
      tile("عدد الطلبات", fmt(S.orders), S.orders, SP.orders),
      tile("متوسط السلة", money(S.basket), S.basket, SP.basket),
      tile("المنتوجات المباعة", fmt(S.items), S.items, SP.items));

    // revenue over time: per hour today, per day otherwise
    let buckets;
    if (state.range === "today") {
      buckets = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), title: `${String(h).padStart(2, "0")}:00`, list: cur.filter(o => new Date(o.at).getHours() === h) }));
      const first = buckets.findIndex(b => b.list.length), last = 23 - [...buckets].reverse().findIndex(b => b.list.length);
      const open = parseInt(((CFG.hours[new Date().getDay()] || ["07:00"])[0]), 10);
      buckets = buckets.slice(Math.min(open, first < 0 ? open : first), Math.max(last + 1, 24));
    } else {
      const n = +state.range;
      buckets = Array.from({ length: n }, (_, k) => {
        const d0 = P.start + k * DAY, d = new Date(d0);
        return { label: `${d.getDate()}/${d.getMonth() + 1}`, title: d.toLocaleDateString("ar-MA", { weekday: "long", day: "numeric", month: "long" }), list: cur.filter(o => inRange(o, d0, d0 + DAY)) };
      });
    }
    buckets.forEach(b => { b.rev = b.list.reduce((s, o) => s + o.total, 0); b.n = b.list.length; });
    const revChart = columns(buckets, {
      valueOf: b => b.rev,
      tipOf: b => [[b.title], [money(b.rev), ""], [String(b.n), "طلبات"]],
      // keep x labels ~44px apart whatever the width
      labelEvery: Math.max(1, Math.ceil(buckets.length * 44 / (chartWidth() - 48)))
    });

    // orders by hour of day (staffing)
    const byHour = Array.from({ length: 24 }, (_, h) => ({ h, n: cur.filter(o => new Date(o.at).getHours() === h).length }));
    const hours = byHour.slice(6);   // 06:00 → 23:00
    const hourChart = columns(hours.map(x => ({ ...x, label: String(x.h).padStart(2, "0") })), {
      valueOf: b => b.n, tipOf: b => [[`${String(b.h).padStart(2, "0")}:00 – ${String(b.h + 1).padStart(2, "0")}:00`], [String(b.n), "طلبات"]],
      labelEvery: Math.max(1, Math.ceil(hours.length * 30 / (chartWidth() - 48)))
    });

    // channel mix: one 100% stacked bar, colour follows the channel
    const mixData = CHANNELS.map(([k, l], i) => { const list = cur.filter(o => o.mode === k); return { k, l, slot: i + 1, n: list.length, rev: list.reduce((s, o) => s + o.total, 0) }; });
    const mixTotal = mixData.reduce((s, x) => s + x.rev, 0);
    const mix = el("div", { class: "viz-mix" });
    const stack = el("div", { class: "viz-stack" });
    mixData.filter(x => x.rev > 0).forEach(x => {
      const pct = x.rev / mixTotal * 100;
      const s = el("div", { class: `viz-seg-fill slot-${x.slot}`, style: `flex-basis:${pct}%` });
      if (pct >= 12) s.append(el("span", { class: "viz-in" }, `${pct.toFixed(0)}٪`));   // inside only when it fits
      bindTip(s, [[x.l], [money(x.rev), ""], [`${x.n}`, `طلبات · ${pct.toFixed(0)}٪`]]);
      stack.append(s);
    });
    if (!mixTotal) stack.append(el("div", { class: "viz-empty" }, "لا توجد مبيعات في هذه الفترة"));
    const legend = el("ul", { class: "viz-legend" });
    mixData.forEach(x => {
      const li = el("li"); li.append(el("i", { class: `viz-key slot-${x.slot}` }), el("span", {}, x.l),
        el("b", {}, mixTotal ? `${(x.rev / mixTotal * 100).toFixed(0)}٪` : "—"), el("small", {}, `${money(x.rev)} · ${x.n} طلبات`));
      legend.append(li);
    });
    mix.append(stack, legend);

    // top products by revenue (single series: one colour, value at the tip)
    const prod = {};
    let estimated = false;
    cur.forEach(o => o.items.forEach(i => {
      if (i.price == null) estimated = true;
      const p = prod[i.id] || (prod[i.id] = { id: i.id, qty: 0, rev: 0 });
      p.qty += i.qty; p.rev += lineValue(i);
    }));
    const top = Object.values(prod).sort((a, b) => b.rev - a.rev).slice(0, 8);
    const topMax = niceMax(top.length ? top[0].rev : 1);
    const name = id => PRODUCTS[id] ? PRODUCTS[id].ar[0] : id;
    const topList = el("ol", { class: "viz-hbars" });
    top.forEach(p => {
      const li = el("li");
      const bar = el("div", { class: "viz-hbar-track" });
      const fill = el("div", { class: "viz-hbar slot-1", style: `width:${Math.max(1, p.rev / topMax * 100)}%` });
      bar.append(fill, el("span", { class: "viz-hval" }, money(p.rev)));
      li.append(el("span", { class: "viz-hname" }, name(p.id)), bar);
      bindTip(li, [[name(p.id)], [money(p.rev), ""], [String(p.qty), "وحدة"]]);
      topList.append(li);
    });
    if (!top.length) topList.append(el("li", { class: "viz-empty" }, "لا توجد مبيعات في هذه الفترة"));

    const grid = el("div", { class: "viz-grid-cards" });
    grid.append(
      card("rev", state.range === "today" ? "المبيعات حسب الساعة" : "المبيعات اليومية", "بالدرهم، بعد الخصومات", revChart,
        { head: [state.range === "today" ? "الساعة" : "اليوم", "المبيعات", "الطلبات"], rows: buckets.map(b => [b.title, money(b.rev), String(b.n)]) }),
      card("hours", "الطلبات حسب ساعة اليوم", "مجموع الفترة — لتنظيم فريق العمل", hourChart,
        { head: ["الساعة", "الطلبات"], rows: hours.map(b => [`${String(b.h).padStart(2, "0")}:00`, String(b.n)]) }),
      card("mix", "توزيع المبيعات حسب القناة", "حصة من رقم المعاملات", mix,
        { head: ["القناة", "المبيعات", "الحصة", "الطلبات"], rows: mixData.map(x => [x.l, money(x.rev), mixTotal ? `${(x.rev / mixTotal * 100).toFixed(1)}٪` : "—", String(x.n)]) }),
      card("top", "المنتوجات الأكثر مبيعاً", estimated ? "حسب رقم المعاملات قبل الخصومات — بعض الطلبات القديمة مقدّرة بالسعر الحالي" : "حسب رقم المعاملات قبل الخصومات", topList,
        { head: ["المنتوج", "الكمية", "المبيعات"], rows: top.map(p => [name(p.id), String(p.qty), money(p.rev)]) })
    );
    root.replaceChildren(bar, kpis, grid);
  }

  /* ---------- CSV export of the current selection ---------- */
  function exportCsv(list) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["ref", "date", "heure", "canal", "articles", "total_DH", "statut", "source"]].concat(
      list.map(o => { const d = new Date(o.at); return [o.ref, d.toLocaleDateString("fr-CA"), d.toTimeString().slice(0, 5), o.mode, o.items.reduce((s, i) => s + i.qty, 0), o.total, o.status || "", o.source || ""]; }));
    const blob = new Blob(["﻿" + rows.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `ventes-cafe-mouhsine-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  let resizeTimer, lastW = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (root && root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } }, 150);
  });

  window.SalesDashboard = {
    mount(node) { root = node; lastW = node.clientWidth; if (!tip.isConnected) document.body.append(tip); render(); },
    update(orders) { ORDERS = orders || []; render(); }
  };
})();
