import { clamp } from "./dom.js";

let STATE = null;
let REGISTRY = {
  items: {},
  buffs: {},
  instruments: {},
  location: null
};

export function setDataRegistry(reg) {
  REGISTRY = reg;
}

export function getRegistry() {
  return REGISTRY;
}

export function createInitialState() {
  STATE = {
    version: 2,

    time: { day: 1, hour: 9, minute: 0 },
    stats: {
      health: 100,
      hunger: 80,
      thirst: 80,
      inebriation: 0,
      fame: 0,
      fans: 0,
      money: 25
    },

    buffs: [], // { id, untilHourAbs }

    equipped: {
      instrumentId: null
    },

    holding: null, // { itemId, qty } optional future

    inventories: {
      player: emptySlots(8),
      fridge: emptySlots(8),
      storage: emptySlots(8)
    },

    hotspotsUsed: {} // id -> true
  };

  // Broadcast render
  document.addEventListener("bandscape:renderAll", () => {});
}

export function getState() {
  return STATE;
}

export function ensureState() {
  if (!STATE) createInitialState();
  return STATE;
}

export function markHotspotUsed(id) {
  ensureState();
  STATE.hotspotsUsed[id] = true;
}

export function isHotspotUsed(id) {
  ensureState();
  return !!STATE.hotspotsUsed[id];
}

export function statAdd(stat, delta) {
  ensureState();
  const s = STATE.stats;
  if (!(stat in s)) return;
  s[stat] = clamp(s[stat] + delta, 0, 999999);
}

export function addBuff(buffId, hours) {
  ensureState();
  const absHour = getAbsoluteHour(STATE.time) + Math.max(1, hours || 1);
  // Replace if exists
  const idx = STATE.buffs.findIndex(b => b.id === buffId);
  if (idx >= 0) STATE.buffs[idx].untilHourAbs = absHour;
  else STATE.buffs.push({ id: buffId, untilHourAbs: absHour });
}

export function pruneBuffs() {
  ensureState();
  const now = getAbsoluteHour(STATE.time);
  STATE.buffs = STATE.buffs.filter(b => b.untilHourAbs > now);
}

export function getAbsoluteHour(time) {
  return (time.day - 1) * 24 + time.hour;
}

function emptySlots(n) {
  return Array.from({ length: n }, () => null);
}
