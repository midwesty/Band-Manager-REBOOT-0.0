import { loadJSON, saveJSON } from "../engine/storage.js";
import { getState, createInitialState } from "../engine/state.js";

const SAVE_KEY = "save";

export function saveGame() {
  const state = getState();
  saveJSON(SAVE_KEY, state);
  console.log("Saved.");
}

export function loadSaveIfAny() {
  const saved = loadJSON(SAVE_KEY, null);
  if (!saved) return;

  // Replace current state safely by reconstructing, then assigning fields
  createInitialState();
  const state = getState();
  Object.assign(state, saved);

  console.log("Loaded save.");
  document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
}

export function loadGame() {
  loadSaveIfAny();
}
