import { $, $$, on } from "../engine/dom.js";
import { getRegistry, getState } from "../engine/state.js";
import { openModal } from "./modal.js";

export function initInventorySystem() {
  // render events
  document.addEventListener("bandscape:renderAll", () => {
    renderPlayerInventory();
    renderStats();
    renderBuffs();
    renderEquipped();
  });

  // Hook open band manager button
  const openBM = $("#open-bandmgr");
  on(openBM, "click", () => {
    const bm = $("#bandmgr");
    bm?.classList.remove("hidden");
  });

  // Double click use in inventory
  const invRoot = $("#player-inv");
  invRoot?.addEventListener("dblclick", (e) => {
    const slotEl = e.target.closest(".slot[data-slot]");
    if (!slotEl) return;
    const idx = Number(slotEl.dataset.slot);
    useFromInventory("player", idx);
  });

  // Basic click context menu via modal (simple + safe)
  invRoot?.addEventListener("click", (e) => {
    const slotEl = e.target.closest(".slot[data-slot]");
    if (!slotEl) return;
    const idx = Number(slotEl.dataset.slot);
    openSlotActions("player", idx);
  });
}

export function renderPlayerInventory() {
  const root = $("#player-inv");
  if (!root) return;

  const state = getState();
  const reg = getRegistry();
  const inv = state.inventories.player;

  root.innerHTML = inv.map((slot, i) => {
    if (!slot) {
      return `<div class="slot" data-slot="${i}" aria-label="Empty slot"></div>`;
    }
    const def = reg.items[slot.itemId];
    const icon = def?.icon || "";
    const name = def?.name || slot.itemId;
    const qty = slot.qty ?? 1;

    return `
      <div class="slot" data-slot="${i}" aria-label="${escapeHTML(name)}">
        ${icon ? `<img src="${icon}" alt="">` : `<div style="font-size:11px;opacity:.8">${escapeHTML(name)}</div>`}
        ${qty > 1 ? `<div class="qty">${qty}</div>` : ``}
      </div>
    `;
  }).join("");
}

function openSlotActions(invId, idx) {
  const state = getState();
  const reg = getRegistry();
  const inv = state.inventories[invId];
  const slot = inv[idx];
  if (!slot) return;

  const def = reg.items[slot.itemId];
  const name = def?.name || slot.itemId;

  const actions = [];

  if (def?.type === "consumable") {
    actions.push({
      label: `Use ${name}`,
      onClick: () => useFromInventory(invId, idx)
    });
  }

  if (def?.type === "instrument" && def?.equipSlot === "instrument") {
    actions.push({
      label: state.equipped.instrumentId === def.instrumentId ? "Unequip" : `Equip ${name}`,
      onClick: () => {
        state.equipped.instrumentId = (state.equipped.instrumentId === def.instrumentId) ? null : def.instrumentId;
        document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
      }
    });
  }

  actions.push({
    label: "Discard",
    onClick: () => {
      inv[idx] = null;
      document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
    }
  });

  openModal({
    title: name,
    html: `<p style="opacity:.85;margin:0">What do you want to do?</p>`,
    actions
  });
}

function useFromInventory(invId, idx) {
  const state = getState();
  const reg = getRegistry();
  const inv = state.inventories[invId];
  const slot = inv[idx];
  if (!slot) return;

  const def = reg.items[slot.itemId];
  if (!def?.onUse) return;

  // Apply effects
  applyItemEffects(def.onUse);

  // Decrement qty
  const qty = slot.qty ?? 1;
  if (qty <= 1) inv[idx] = null;
  else slot.qty = qty - 1;

  document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
}

function applyItemEffects(effects) {
  const state = getState();
  const reg = getRegistry();

  for (const fx of effects) {
    if (fx.type === "statAdd") {
      const stat = fx.stat;
      const val = Number(fx.value || 0);
      if (stat in state.stats) {
        state.stats[stat] = Math.max(0, state.stats[stat] + val);
      }
      if (fx.toast) toast(fx.toast);
    } else if (fx.type === "buffAdd") {
      const id = fx.buffId;
      const hours = Number(fx.hours || 1);
      addOrExtendBuff(id, hours);
      if (fx.toast) toast(fx.toast);
    }
  }

  function addOrExtendBuff(buffId, hours) {
    const nowAbs = (state.time.day - 1) * 24 + state.time.hour;
    const untilAbs = nowAbs + Math.max(1, hours);

    const idx = state.buffs.findIndex(b => b.id === buffId);
    if (idx >= 0) state.buffs[idx].untilHourAbs = untilAbs;
    else state.buffs.push({ id: buffId, untilHourAbs: untilAbs });
  }

  function toast(msg) {
    // Minimal toast (no extra UI needed yet)
    console.log("[Toast]", msg);
  }
}

function renderStats() {
  const state = getState();
  const t = state.time;
  setText("stat-time", `Day ${t.day} — ${pad2(t.hour)}:${pad2(t.minute)}`);
  setText("stat-health", state.stats.health);
  setText("stat-money", `$${state.stats.money}`);
  setText("stat-hunger", state.stats.hunger);
  setText("stat-thirst", state.stats.thirst);
  setText("stat-fame", state.stats.fame);
  setText("stat-fans", state.stats.fans);
  setText("stat-ineb", state.stats.inebriation);
}

function renderBuffs() {
  const ul = $("#buff-list");
  if (!ul) return;

  const state = getState();
  const reg = getRegistry();
  const nowAbs = (state.time.day - 1) * 24 + state.time.hour;

  ul.innerHTML = state.buffs.map(b => {
    const meta = reg.buffs[b.id];
    const name = meta?.name || b.id;
    const rem = Math.max(0, b.untilHourAbs - nowAbs);
    return `<li><strong>${escapeHTML(name)}</strong> <span style="opacity:.75">(${rem}h)</span></li>`;
  }).join("") || `<li style="opacity:.7">None</li>`;
}

function renderEquipped() {
  const state = getState();
  const el = $("#equipped-slot");
  if (!el) return;
  el.textContent = state.equipped.instrumentId ? state.equipped.instrumentId : "None";
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(val);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}
