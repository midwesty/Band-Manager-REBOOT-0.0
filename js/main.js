// js/main.js — robust module entrypoint with on-screen error overlay.
// This prevents the “nothing is clickable” mystery by showing the real error
// even when module imports fail.

function showBootOverlay(message, details = "") {
  const wrap = document.createElement("div");
  wrap.id = "boot-overlay";
  wrap.style.position = "fixed";
  wrap.style.inset = "0";
  wrap.style.background = "rgba(0,0,0,.85)";
  wrap.style.color = "#fff";
  wrap.style.zIndex = "99999";
  wrap.style.display = "grid";
  wrap.style.placeItems = "center";
  wrap.style.padding = "20px";
  wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  const card = document.createElement("div");
  card.style.maxWidth = "900px";
  card.style.width = "100%";
  card.style.background = "#14141a";
  card.style.border = "1px solid rgba(255,255,255,.15)";
  card.style.borderRadius = "14px";
  card.style.padding = "16px";
  card.style.boxShadow = "0 20px 40px rgba(0,0,0,.6)";

  const h = document.createElement("h2");
  h.textContent = message;
  h.style.margin = "0 0 10px";

  const p = document.createElement("p");
  p.textContent =
    "Open DevTools → Console for more detail. Copy the error below and paste it to me if you want a one-step fix.";
  p.style.opacity = "0.9";
  p.style.margin = "0 0 12px";

  const pre = document.createElement("pre");
  pre.textContent = details || "(no details)";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.wordBreak = "break-word";
  pre.style.background = "#0b0b10";
  pre.style.border = "1px solid rgba(255,255,255,.12)";
  pre.style.borderRadius = "12px";
  pre.style.padding = "12px";
  pre.style.maxHeight = "50vh";
  pre.style.overflow = "auto";
  pre.style.fontSize = "12px";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "10px";
  row.style.marginTop = "12px";
  row.style.flexWrap = "wrap";

  const reloadBtn = document.createElement("button");
  reloadBtn.textContent = "Reload";
  reloadBtn.style.padding = "10px 12px";
  reloadBtn.style.borderRadius = "10px";
  reloadBtn.style.border = "1px solid rgba(255,255,255,.2)";
  reloadBtn.style.background = "#1d1d26";
  reloadBtn.style.color = "#fff";
  reloadBtn.style.cursor = "pointer";
  reloadBtn.onclick = () => location.reload(true);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close overlay";
  closeBtn.style.padding = "10px 12px";
  closeBtn.style.borderRadius = "10px";
  closeBtn.style.border = "1px solid rgba(255,255,255,.2)";
  closeBtn.style.background = "#1d1d26";
  closeBtn.style.color = "#fff";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => wrap.remove();

  row.appendChild(reloadBtn);
  row.appendChild(closeBtn);

  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(pre);
  card.appendChild(row);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

function showBootBadge(text) {
  const badge = document.createElement("div");
  badge.id = "boot-badge";
  badge.textContent = text;
  badge.style.position = "fixed";
  badge.style.left = "12px";
  badge.style.bottom = "12px";
  badge.style.zIndex = "99998";
  badge.style.padding = "6px 10px";
  badge.style.borderRadius = "10px";
  badge.style.background = "rgba(0,0,0,.6)";
  badge.style.border = "1px solid rgba(255,255,255,.18)";
  badge.style.color = "#fff";
  badge.style.fontSize = "12px";
  badge.style.pointerEvents = "none";
  document.body.appendChild(badge);
  return badge;
}

window.addEventListener("DOMContentLoaded", async () => {
  const badge = showBootBadge("Booting…");

  try {
    // Dynamic import so we can catch module resolution errors (missing/404)
    const mod = await import("./app.js");
    if (!mod || typeof mod.boot !== "function") {
      throw new Error("app.js loaded, but it did not export a boot() function.");
    }

    await mod.boot();

    badge.textContent = "Boot OK";
    setTimeout(() => badge.remove(), 1200);
  } catch (err) {
    console.error("Boot failed:", err);
    badge.textContent = "Boot FAILED";
    const details =
      (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    showBootOverlay("Bandscape failed to start", details);
  }
});