import { $, show, hide, on } from "../engine/dom.js";

const overlayIds = ["phone", "daw", "bandmgr", "death", "cheat", "travel"];

export function initOverlaySystem() {
  const phoneBtn = $("#phone-btn");
  const phone = $("#phone");
  const phoneClose = $("#phone-close");

  on(phoneBtn, "click", () => {
    toggleOverlay("phone");
    // when opening phone, default to stats
    if (phone && !phone.classList.contains("hidden")) {
      showPhonePane("stats");
    } else {
      // closing phone: hide keymap
      document.getElementById("keymap")?.classList.add("hidden");
      document.dispatchEvent(new CustomEvent("bandscape:phoneAppChanged", { detail: { appId: null } }));
    }
  });

  on(phoneClose, "click", () => {
    closeOverlay("phone");
    document.getElementById("keymap")?.classList.add("hidden");
    document.dispatchEvent(new CustomEvent("bandscape:phoneAppChanged", { detail: { appId: null } }));
  });

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

  on(document, "keydown", (e) => {
    if (e.key !== "Escape") return;
    for (let i = overlayIds.length - 1; i >= 0; i--) {
      const id = overlayIds[i];
      const el = $(`#${id}`);
      if (el && !el.classList.contains("hidden")) {
        closeOverlay(id);
        if (id === "phone") document.getElementById("keymap")?.classList.add("hidden");
        break;
      }
    }
  });

  // Phone app buttons
  const appButtons = document.querySelectorAll(".app[data-app]");
  appButtons.forEach(btn => {
    btn.addEventListener("click", () => showPhonePane(btn.dataset.app));
  });

  // Default
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

  // Hide keymap unless we're in music app (music.js will show it if practice/record tab)
  if (appId !== "music") document.getElementById("keymap")?.classList.add("hidden");

  document.dispatchEvent(new CustomEvent("bandscape:phoneAppChanged", { detail: { appId } }));
}