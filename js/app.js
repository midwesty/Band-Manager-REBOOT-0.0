import { loadAllData } from "./engine/data.js";
import { $ } from "./engine/dom.js";
import { createInitialState, setDataRegistry, getState } from "./engine/state.js";
import { loadSaveIfAny, saveGame } from "./systems/save.js";
import { startTimeLoop } from "./systems/time.js";
import { initModalSystem } from "./systems/modal.js";
import { initOverlaySystem } from "./systems/overlays.js";
import { initInventorySystem } from "./systems/inventory.js";
import { initHotspotSystem, buildHotspotsFromLocation } from "./systems/hotspots.js";

import { Music } from "./systems/music.js";
import { BandMgr } from "./systems/bandmgr.js";
import { DAW } from "./systems/daw.js";

export async function boot() {
  // Load JSON registries
  const data = await loadAllData();
  setDataRegistry(data);

  // Base state
  createInitialState();

  // Core systems
  initModalSystem();
  initOverlaySystem();
  initInventorySystem();
  initHotspotSystem();

  // Feature systems (DOM-wired)
  // Wrap state so systems can call stateWrap.state + stateWrap.save()
  const stateWrap = { 
    get state() { return getState(); }, 
    save: saveGame 
  };

  const music = new Music({ state: stateWrap, data });
  const bandMgr = new BandMgr({ state: stateWrap });
  const daw = new DAW({ state: stateWrap, data, music });

  // Expose for debugging in console
  window.BANDSCAPE = { state: stateWrap, music, bandMgr, daw, data };

  // Apply location background and generate hotspots from JSON
  const roomBg = $("#room-bg");
  if (roomBg && data.location?.background) {
    roomBg.src = data.location.background;
  }

  // Replace any old hardcoded hotspots in HTML
  buildHotspotsFromLocation(data.location);

  // Load save (optional)
  loadSaveIfAny();

  // Start time loop / stats UI update
  startTimeLoop();

  // Quick default inventory seed if empty (safe)
  seedStarterItemsIfNeeded();

  // Render initial inventory + stats
  document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
}

function seedStarterItemsIfNeeded() {
  const state = getState();
  const inv = state.inventories.player;
  const any = inv.some(s => s && s.itemId);
  if (any) return;

  // Give player some basics
  inv[0] = { itemId: "water", qty: 2 };
  inv[1] = { itemId: "pizza_slice", qty: 2 };
  inv[2] = { itemId: "beer", qty: 1 };
  inv[3] = { itemId: "guitar_basic", qty: 1 };

  // Seed fridge/storage a bit
  state.inventories.fridge[0] = { itemId: "water", qty: 2 };
  state.inventories.fridge[1] = { itemId: "juice", qty: 1 };
  state.inventories.storage[0] = { itemId: "lyrics_notebook", qty: 1 };
}
