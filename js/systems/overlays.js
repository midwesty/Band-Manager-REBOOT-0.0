import { $, show, hide, on } from "../engine/dom.js";

const overlayIds = ["phone", "daw", "bandmgr", "death", "cheat", "travel"];

export function initOverlaySystem() {
  // Phone toggle
  const phoneBtn = $("#phone-btn");
  const phone = $("#phone");
  const phoneClose = $("#phone-close");

  on(phoneBtn, "click", () => toggleOverlay("phone"));
  on(phoneClose, "click", () => closeOverlay("phone"));

  // Close buttons for other overlays already in HTML
  const map = {
    daw: "#daw-close",
    bandmgr: "#bm-close",
    cheat: "#cheat-close",
    travel: "#travel-close"
  };

  for (const [id, sel] of Object.entries(map)) {
    const btn = $(sel);
    on(btn, "click", () => closeOverlay(id));
  }

  // Esc closes topmost open overlay (simple priority order)
  on(document, "keydown", (e) => {
    if (e.key !== "Escape") return;
    for (let i = overlayIds.length - 1; i >= 0; i--) {
      const id = overlayIds[i];
      const el = $(`#${id}`);
      if (el && !el.classList.contains("hidden")) {
        closeOverlay(id);
        break;
      }
    }
  });

  // App buttons (in phone)
  const appButtons = document.querySelectorAll(".app[data-app]");
  appButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      showPhonePane(btn.dataset.app);
    });
  });

  // Default stats pane
  showPhonePane("stats");
}

export function openOverlay(id) {
  const el = $(`#${id}`);
  if (!el) return;
  show(el);
}

export function closeOverlay(id) {
  const el = $(`#${id}`);
  if (!el) return;
  hide(el);
}

export function toggleOverlay(id) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList.contains("hidden") ? show(el) : hide(el);
}

function showPhonePane(appId) {
  const panes = document.querySelectorAll(".app-pane");
  panes.forEach(p => p.classList.add("hidden"));
  const target = document.querySelector(`#app-${appId}`);
  target?.classList.remove("hidden");

  // tabs not needed here; phone uses app panes
}
