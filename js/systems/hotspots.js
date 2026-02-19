import { $, $$, on } from "../engine/dom.js";
import { getRegistry, getState, isHotspotUsed, markHotspotUsed } from "../engine/state.js";
import { openModal } from "./modal.js";
import { openOverlay } from "./overlays.js";
import { saveGame, loadGame } from "./save.js";

export function initHotspotSystem() {
  // Hover label
  const hover = $("#hover-label");
  const game = $("#game");
  if (!hover || !game) return;

  game.addEventListener("mousemove", (e) => {
    const hs = e.target.closest(".hotspot");
    if (!hs) {
      hover.style.display = "none";
      return;
    }
    hover.style.display = "block";
    hover.textContent = hs.dataset.label || "Interact";
    hover.style.left = `${e.offsetX + 12}px`;
    hover.style.top = `${e.offsetY - 10}px`;
  });

  game.addEventListener("mouseleave", () => {
    hover.style.display = "none";
  });
}

export function buildHotspotsFromLocation(location) {
  if (!location?.hotspots) return;

  // Remove existing hotspots (lets you keep HTML clean)
  $$(".hotspot").forEach(h => h.remove());

  const game = $("#game");
  if (!game) return;

  for (const hs of location.hotspots) {
    const div = document.createElement("div");
    div.className = "hotspot";
    div.id = hs.id;
    div.dataset.label = hs.label || hs.id;

    // First-use pulse
    if (hs.firstUsePulse && !isHotspotUsed(hs.id)) {
      div.classList.add("pulse");
    } else {
      div.classList.add("used");
    }

    // Position from rect
    const r = hs.rect || { x: 0, y: 0, w: 60, h: 60 };
    div.style.left = `${r.x}px`;
    div.style.top = `${r.y}px`;
    div.style.width = `${r.w}px`;
    div.style.height = `${r.h}px`;

    // Click
    div.addEventListener("click", () => {
      handleHotspot(hs);
      markHotspotUsed(hs.id);
      div.classList.remove("pulse");
      div.classList.add("used");
    });

    game.appendChild(div);
  }
}

function handleHotspot(hs) {
  const actions = hs.actions || [];
  for (const a of actions) {
    runAction(a);
  }
}

function runAction(action) {
  if (!action?.type) return;

  switch (action.type) {
    case "openStorage":
      openStorageModal(action);
      break;

    case "openOverlay":
      openOverlay(action.overlay);
      break;

    case "modal":
      openModal({
        title: action.title || "",
        html: action.html || ""
      });
      break;

    case "guitarContext":
      openGuitarContext();
      break;

    case "bedContext":
      openBedContext();
      break;

    default:
      console.warn("Unknown hotspot action:", action);
  }
}

function openStorageModal(action) {
  const state = getState();
  const reg = getRegistry();
  const invId = action.inventoryId;
  const inv = state.inventories[invId];
  if (!inv) return;

  openModal({
    title: action.title || "Storage",
    html: `
      <p style="opacity:.8;margin-top:0">${action.flavor || ""}</p>
      <div class="inv-grid" id="modal-inv"></div>
      <p class="hint">Double-click consumables in your phone inventory to use them.</p>
    `,
    actions: [
      { label: "Close", onClick: () => {} }
    ]
  });

  // render inside modal
  const grid = document.getElementById("modal-inv");
  if (!grid) return;

  grid.innerHTML = inv.map((slot, i) => {
    if (!slot) return `<div class="slot" data-slot="${i}"></div>`;
    const def = reg.items[slot.itemId];
    const icon = def?.icon || "";
    const name = def?.name || slot.itemId;
    const qty = slot.qty ?? 1;

    return `
      <div class="slot" data-slot="${i}" title="${escapeHTML(name)}">
        ${icon ? `<img src="${icon}" alt="">` : `<div style="font-size:11px;opacity:.8">${escapeHTML(name)}</div>`}
        ${qty > 1 ? `<div class="qty">${qty}</div>` : ``}
      </div>
    `;
  }).join("");
}

function openGuitarContext() {
  const state = getState();
  const reg = getRegistry();

  // If player already has guitar in inventory, offer equip
  const hasGuitar = state.inventories.player.some(s => s?.itemId === "guitar_basic");
  const guitarDef = reg.items["guitar_basic"];

  openModal({
    title: "Guitar",
    html: `<p style="opacity:.85;margin-top:0">A scratched-up guitar that still has a few good riffs left.</p>`,
    actions: [
      {
        label: hasGuitar ? "Equip Guitar" : "Take Guitar",
        onClick: () => {
          if (!hasGuitar) {
            const slot = firstEmpty(state.inventories.player);
            if (slot === -1) return alert("Inventory is full.");
            state.inventories.player[slot] = { itemId: "guitar_basic", qty: 1 };
          }
          // Equip
          state.equipped.instrumentId = guitarDef?.instrumentId || "guitar";
          document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
        }
      },
      {
        label: "Close",
        onClick: () => {}
      }
    ]
  });
}

function openBedContext() {
  openModal({
    title: "Bed",
    html: `<p style="opacity:.85;margin-top:0">It’s not comfortable, but it’s yours.</p>`,
    actions: [
      {
        label: "Sleep (+8 hours)",
        onClick: () => {
          const state = getState();
          state.time.hour += 8;
          while (state.time.hour >= 24) {
            state.time.hour -= 24;
            state.time.day += 1;
          }
          state.stats.health = Math.min(100, state.stats.health + 15);
          document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
        }
      },
      { label: "Save Game", onClick: () => saveGame() },
      { label: "Load Game", onClick: () => loadGame() },
      { label: "Close", onClick: () => {} }
    ]
  });
}

function firstEmpty(inv) {
  return inv.findIndex(s => !s);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}
