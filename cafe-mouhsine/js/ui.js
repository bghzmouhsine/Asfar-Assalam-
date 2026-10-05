/* =========================================================
   Café Mouhsine BOUAGHAZ — shared UI helpers
   uiConfirm(): an in-page confirmation dialog (native confirm() is
   blocked in embedded viewers and inconsistent across browsers).
   uiLinkNotice(): a banner with a real link, for when a browser
   blocks the WhatsApp window we tried to open.
   ========================================================= */
(() => {
  "use strict";
  const css = `
  .ui-confirm { border: 1px solid var(--line, #ddd); border-radius: 16px; padding: 22px; width: min(380px, calc(100% - 32px));
    background: var(--surface, var(--panel, #fff)); color: var(--text, #222); box-shadow: 0 24px 60px -20px rgba(0,0,0,.45); }
  .ui-confirm::backdrop { background: rgba(20,12,8,.55); }
  .ui-confirm p { margin: 0 0 18px; font-size: 1rem; line-height: 1.5; }
  .ui-confirm .ui-row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
  .ui-confirm button { padding: 10px 18px; border-radius: 999px; font: inherit; font-weight: 700; cursor: pointer;
    border: 1px solid var(--line, #ccc); background: transparent; color: inherit; }
  .ui-confirm button.ui-ok { background: var(--accent, var(--caramel, #C8894B)); border-color: transparent; color: var(--on-accent, #1A110C); }
  .ui-confirm button.ui-ok.danger { background: #B3402A; color: #fff; }
  .ui-notice { position: fixed; z-index: 95; inset-inline: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); margin-inline: auto; max-width: 460px;
    display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px;
    background: var(--surface, var(--panel, #fff)); color: var(--text, #222); border: 1px solid var(--line, #ddd); box-shadow: 0 16px 40px -14px rgba(0,0,0,.45); }
  .ui-notice span { flex: 1; font-size: .9rem; }
  .ui-notice a { padding: 9px 14px; border-radius: 999px; background: #25D366; color: #fff; font-weight: 700; text-decoration: none; white-space: nowrap; }
  .ui-notice button { background: none; border: 0; font-size: 1.1rem; cursor: pointer; color: inherit; padding: 4px 6px; }`;
  const style = document.createElement("style"); style.textContent = css; document.head.append(style);

  window.uiConfirm = (message, { ok = "OK", cancel = "Cancel", danger = false } = {}) => new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "ui-confirm";
    const p = document.createElement("p"); p.textContent = message;
    const row = document.createElement("div"); row.className = "ui-row";
    const no = document.createElement("button"); no.type = "button"; no.textContent = cancel;
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "ui-ok" + (danger ? " danger" : ""); yes.textContent = ok;
    no.addEventListener("click", () => d.close("cancel"));
    yes.addEventListener("click", () => d.close("ok"));
    d.addEventListener("close", () => { resolve(d.returnValue === "ok"); d.remove(); });
    row.append(no, yes); d.append(p, row); document.body.append(d);
    d.showModal(); yes.focus();
  });

  let current = null;
  window.uiLinkNotice = (text, href, label, closeLabel = "×") => {
    if (current) current.remove();
    const n = document.createElement("div"); n.className = "ui-notice"; n.setAttribute("role", "status");
    const s = document.createElement("span"); s.textContent = text;
    const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = label;
    const x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", closeLabel); x.textContent = "×";
    a.addEventListener("click", () => setTimeout(() => n.remove(), 300));
    x.addEventListener("click", () => n.remove());
    n.append(s, a, x); document.body.append(n); current = n;
  };
})();
