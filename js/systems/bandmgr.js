import { $, $$ } from "../engine/dom.js";
import { getRegistry, getState, isHotspotUsed, markHotspotUsed } from "../engine/state.js";
import { openModal } from "./modal.js";
import { openOverlay } from "./overlays.js";
import { saveGame, loadGame } from "./save.js";

export function initHotspotSystem() {
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

  $$(".hotspot").forEach(h => h.remove());

  const game = $("#game");
  if (!game) return;

  for (const hs of location.hotspots) {
    const div = document.createElement("div");
    div.className = "hotspot";
    div.id = hs.id;
    div.dataset.label = hs.label || hs.id;

    if (hs.firstUsePulse && !isHotspotUsed(hs.id)) div.classList.add("pulse");
    else div.classList.add("used");

    const r = hs.rect || { x: 0, y: 0, w: 60, h: 60 };
    div.style.left = `${r.x}px`;
    div.style.top = `${r.y}px`;
    div.style.width = `${r.w}px`;
    div.style.height = `${r.h}px`;

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
  for (const action of (hs.actions || [])) runAction(action);
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
      openModal({ title: action.title || "", html: action.html || "" });
      break;
    case "guitarContext":
      openGuitarContext(action);
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
  const inv = state.inventories?.[invId];
  if (!inv) return;

  openModal({
    title: action.title || "Storage",
    html: `
      <p style="opacity:.8;margin-top:0">${escapeHTML(action.flavor || "")}</p>
      <div class="inv-grid" id="modal-inv"></div>
      <p class="hint">Click an item for options. Double-click to move to Inventory.</p>
    `,
    actions: [{ label: "Close", onClick: () => {} }]
  });

  const grid = document.getElementById("modal-inv");
  if (!grid) return;

  // Render grid
  grid.innerHTML = inv.map((slot, i) => {
    if (!slot) return `<div class="slot" data-slot="${i}"></div>`;
    const def = reg.items?.[slot.itemId];
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

  // Bind click handlers (THIS WAS MISSING)
  grid.addEventListener("click", (e) => {
    const el = e.target.closest(".slot[data-slot]");
    if (!el) return;
    const idx = parseInt(el.dataset.slot, 10);
    if (!inv[idx]) return;
    openStorageItemMenu(invId, idx, action);
  });

  grid.addEventListener("dblclick", (e) => {
    const el = e.target.closest(".slot[data-slot]");
    if (!el) return;
    const idx = parseInt(el.dataset.slot, 10);
    if (!inv[idx]) return;
    moveStorageItemToPlayer(invId, idx);
    openStorageModal(action); // refresh modal
  });
}

function openStorageItemMenu(invId, idx, storageAction) {
  const state = getState();
  const reg = getRegistry();
  const slot = state.inventories[invId][idx];
  if (!slot) return;

  const def = reg.items?.[slot.itemId] || {};
  const name = def.name || slot.itemId;

  const actions = [];

  // Move to inventory
  actions.push({
    label: "Move to Inventory",
    onClick: () => {
      moveStorageItemToPlayer(invId, idx);
      openStorageModal(storageAction);
    },
    keepOpen: true
  });

  // Use (if consumable)
  if (def.type === "consumable" && Array.isArray(def.onUse)) {
    actions.push({
      label: "Use",
      onClick: () => {
        applyItemEffects(def.onUse);
        decrementSlot(state.inventories[invId], idx);
        saveGame();
        document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
        openStorageModal(storageAction);
      },
      keepOpen: true
    });
  }

  // Discard
  actions.push({
    label: "Discard",
    onClick: () => {
      state.inventories[invId][idx] = null;
      saveGame();
      document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
      openStorageModal(storageAction);
    },
    keepOpen: true
  });

  actions.push({
    label: "Back",
    onClick: () => openStorageModal(storageAction),
    keepOpen: true
  });

  openModal({
    title: name,
    html: `<p style="opacity:.85;margin:0">Choose an action:</p>`,
    actions
  });
}

function moveStorageItemToPlayer(fromInvId, fromIdx) {
  const state = getState();
  const reg = getRegistry();
  const from = state.inventories[fromInvId];
  const to = state.inventories.player;

  const slot = from[fromIdx];
  if (!slot) return;

  const itemId = slot.itemId;
  const def = reg.items?.[itemId];
  const cap = def?.stackMax ?? 10;

  // Try stack into existing
  for (let i = 0; i < to.length; i++) {
    const t = to[i];
    if (t && t.itemId === itemId) {
      const tQty = t.qty ?? 1;
      const sQty = slot.qty ?? 1;
      const space = cap - tQty;
      if (space <= 0) continue;

      const moved = Math.min(space, sQty);
      t.qty = tQty + moved;
      slot.qty = sQty - moved;

      if (slot.qty <= 0) from[fromIdx] = null;

      saveGame();
      document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
      return;
    }
  }

  // Otherwise first empty slot
  const empty = to.findIndex(x => !x);
  if (empty === -1) {
    alert("Inventory full.");
    return;
  }

  to[empty] = { itemId: slot.itemId, qty: slot.qty ?? 1 };
  from[fromIdx] = null;

  saveGame();
  document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
}

function decrementSlot(invArr, idx) {
  const s = invArr[idx];
  if (!s) return;
  const q = s.qty ?? 1;
  if (q <= 1) invArr[idx] = null;
  else s.qty = q - 1;
}

function applyItemEffects(effects) {
  const state = getState();

  for (const fx of effects) {
    if (fx.type === "statAdd") {
      const stat = fx.stat;
      const val = Number(fx.value || 0);
      if (stat in state.stats) state.stats[stat] = Math.max(0, state.stats[stat] + val);
    } else if (fx.type === "buffAdd") {
      const nowAbs = (state.time.day - 1) * 24 + state.time.hour;
      const untilAbs = nowAbs + Math.max(1, Number(fx.hours || 1));
      const i = state.buffs.findIndex(b => b.id === fx.buffId);
      if (i >= 0) state.buffs[i].untilHourAbs = untilAbs;
      else state.buffs.push({ id: fx.buffId, untilHourAbs });
    }
  }
}

function openGuitarContext(action = {}) {
  // Your guitar equip works now; keep as-is or customize later.
  openModal({
    title: action.title || "Guitar",
    html: `<p style="opacity:.85;margin-top:0">Use inventory to equip.</p>`,
    actions: [{ label: "Close", onClick: () => {} }]
  });
}

function openBedContext() {
  openModal({
    title: "Bed",
    html: `<p style="opacity:.85;margin-top:0">Save / load here. Sleep later will advance time.</p>`,
    actions: [
      { label: "Save Game", onClick: () => saveGame() },
      { label: "Load Game", onClick: () => loadGame() },
      { label: "Close", onClick: () => {} }
    ]
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}