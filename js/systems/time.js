import { getState } from "../engine/state.js";

let timer = null;

export function startTimeLoop() {
  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    tickMinute();
    document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
  }, 1000);
}

function tickMinute() {
  const state = getState();

  state.time.minute += 1;
  if (state.time.minute < 60) return;

  state.time.minute = 0;
  state.time.hour += 1;

  if (state.time.hour >= 24) {
    state.time.hour = 0;
    state.time.day += 1;
  }

  hourlyDecay();
  pruneBuffs();
  checkDeath();
}

function hourlyDecay() {
  const s = getState().stats;

  s.hunger = Math.max(0, s.hunger - 6);
  s.thirst = Math.max(0, s.thirst - 8);
  s.inebriation = Math.max(0, s.inebriation - 8);

  // Health impact
  if (s.hunger <= 0 || s.thirst <= 0) {
    s.health = Math.max(0, s.health - 6);
  } else {
    s.health = Math.min(100, s.health + 1);
  }
}

function pruneBuffs() {
  const state = getState();
  const nowAbs = (state.time.day - 1) * 24 + state.time.hour;
  state.buffs = state.buffs.filter(b => b.untilHourAbs > nowAbs);
}

function checkDeath() {
  const state = getState();
  if (state.stats.health > 0) return;

  const death = document.getElementById("death");
  if (death) death.classList.remove("hidden");

  const msg = document.getElementById("death-msg");
  if (msg) msg.textContent = "You passed out from poor life choices.";

  const respawn = document.getElementById("respawn");
  respawn?.addEventListener("click", () => {
    // Respawn defaults
    state.stats.health = 60;
    state.stats.hunger = 40;
    state.stats.thirst = 40;
    state.stats.inebriation = 0;

    death.classList.add("hidden");
    document.dispatchEvent(new CustomEvent("bandscape:renderAll"));
  }, { once: true });
}
