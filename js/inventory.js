function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export class Inventory {
  constructor({ ui, data, state }) {
    this.ui = ui;
    this.data = data;
    this.state = state;

    // modal close binding
    this.ui.bindModalClose();
  }

  // Inventory slot model (v2):
  // slot = null OR { itemId: string, qty: number }
  get inv() { return this.state.state.inventories; }

  renderPlayer() {
    if (!this.ui.invGrid) return;
    this.#renderGrid(this.ui.invGrid, this.inv.player, "player", false);
  }

  openStorage(invId, title, flavor) {
    this.ui.showModal(`
      <h3>${this.#escape(title)}</h3>
      <p>${this.#escape(flavor)}</p>
      <div class="inv-grid" id="storage-grid"></div>
      <p class="hint">Left-click items for actions • Double-click to quick use • Drag to rearrange.</p>
    `);

    const grid = document.getElementById("storage-grid");
    if (!grid) return;
    this.#renderGrid(grid, this.inv[invId], invId, true);
  }

  #renderGrid(container, arr, ownerKey, isStorage) {
    container.innerHTML = "";

    arr.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "slot";
      slotEl.dataset.index = String(idx);
      slotEl.dataset.owner = ownerKey;

      if (slot) {
        const def = this.data.getItem(slot.itemId);
        if (def) {
          const img = document.createElement("img");
          img.src = def.icon;
          img.alt = def.name;
          slotEl.appendChild(img);

          if ((slot.qty || 1) > 1) {
            const q = document.createElement("div");
            q.className = "qty";
            q.textContent = String(slot.qty);
            slotEl.appendChild(q);
          }

          const nm = document.createElement("div");
          nm.className = "name";
          nm.textContent = def.name;
          slotEl.appendChild(nm);

          slotEl.addEventListener("dblclick", () => this.quickUse(ownerKey, idx));
          slotEl.addEventListener("click", (e) => {
            const menu = this.actionMenuFor(ownerKey, idx, slot, def, isStorage);
            this.ui.showContext(e.pageX, e.pageY, menu);
          });

          slotEl.draggable = true;
          slotEl.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", JSON.stringify({ owner: ownerKey, index: idx }));
            slotEl.classList.add("held");
          });
          slotEl.addEventListener("dragend", () => slotEl.classList.remove("held"));
        }
      }

      slotEl.addEventListener("dragover", (e) => e.preventDefault());
      slotEl.addEventListener("drop", (e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const data = JSON.parse(raw);
        this.moveItem(data.owner, data.index, ownerKey, idx);
        if (isStorage) this.#renderGrid(container, this.inv[ownerKey], ownerKey, true);
        else this.renderPlayer();
        this.ui.renderStats(this.state);
        this.state.save();
      });

      container.appendChild(slotEl);
    });
  }

  actionMenuFor(ownerKey, idx, slot, def, isStorage) {
    const menu = [];

    if (def.type !== "instrument") {
      menu.push({ label: "Use", fn: () => this.useOne(ownerKey, idx) });
    }

    if (def.type === "instrument") {
      menu.push({ label: "Equip", fn: () => this.equipInstrument(def.instrumentId || "guitar") });

      if (def.placeable && def.instrumentId === "guitar") {
        menu.push({
          label: "Put Down Guitar (to room)",
          fn: () => this.putDownGuitarFromInventory(ownerKey, idx)
        });
      }
    }

    if ((slot.qty || 1) > 1) {
      menu.push({ label: "Split Stack", fn: () => this.splitStackPrompt(ownerKey, idx) });
    }

    if (isStorage) {
      menu.push({ label: "Move to Inventory", fn: () => this.moveToPlayer(ownerKey, idx) });
    }

    menu.push({ label: "Discard", fn: () => this.discard(ownerKey, idx) });
    return menu;
  }

  quickUse(ownerKey, idx) {
    const slot = this.inv[ownerKey][idx];
    if (!slot) return;
    const def = this.data.getItem(slot.itemId);
    if (!def) return;
    if (def.type === "instrument") return;
    this.useOne(ownerKey, idx);
  }

  useOne(ownerKey, idx) {
    const slot = this.inv[ownerKey][idx];
    if (!slot) return;
    const def = this.data.getItem(slot.itemId);
    if (!def) return;

    // Apply item actions (data-driven)
    this.applyItem(def);

    slot.qty = (slot.qty || 1) - 1;
    if (slot.qty <= 0) this.inv[ownerKey][idx] = null;

    this.rerender();
    this.state.save();
  }

  applyItem(def) {
    const s = this.state.state;
    const actions = def.onUse || [];
    for (const a of actions) {
      if (a.type === "statAdd") {
        const stat = a.stat;
        s.stats[stat] = clamp((s.stats[stat] || 0) + Number(a.value || 0), 0, 100);
        if (a.toast) console.log("[toast]", a.toast);
      } else if (a.type === "buffAdd") {
        const totalHours = this.nowAsTotalHours();
        const buffDef = this.data.getBuff(a.buffId);
        const name = buffDef?.name || a.buffId;
        s.buffs.push({ name, untilHour: totalHours + Number(a.hours || 1) });
        if (a.toast) console.log("[toast]", a.toast);
      }
    }

    // Clean expired buffs
    s.buffs = (s.buffs || []).filter(b => b.untilHour > this.nowAsTotalHours());
    this.ui.renderStats(this.state);
  }

  equipInstrument(instrumentId) {
    this.state.state.equipped.instrument = instrumentId;
    this.ui.renderStats(this.state);
    this.state.save();
  }

  putDownGuitarFromInventory(ownerKey, idx) {
    // Remove slot
    this.inv[ownerKey][idx] = null;
    // Un-equip if equipped
    if (this.state.state.equipped.instrument === "guitar") this.state.state.equipped.instrument = null;
    // Place back in room
    this.state.state.world.guitarInRoom = true;
    this.rerender();
    this.state.save();
  }

  splitStackPrompt(ownerKey, idx) {
    const slot = this.inv[ownerKey][idx];
    if (!slot || (slot.qty || 1) <= 1) return;
    const amtStr = prompt(`Split how many? (1-${slot.qty - 1})`, "1");
    const amt = parseInt(amtStr || "0", 10);
    if (!Number.isFinite(amt) || amt <= 0 || amt >= slot.qty) return;

    const free = this.firstFreeSlot(this.inv[ownerKey]);
    if (free === -1) return;

    this.inv[ownerKey][free] = { itemId: slot.itemId, qty: amt };
    slot.qty -= amt;

    this.rerender();
    this.state.save();
  }

  moveItem(fromOwner, fromIdx, toOwner, toIdx) {
    const from = this.inv[fromOwner];
    const to = this.inv[toOwner];
    const a = from[fromIdx];
    const b = to[toIdx];

    // stacking if same item
    if (a && b && a.itemId === b.itemId) {
      const def = this.data.getItem(a.itemId);
      const cap = def?.stackMax ?? 10;
      const total = (a.qty || 1) + (b.qty || 1);
      const moved = Math.min(cap, total);
      const leftover = total - moved;
      b.qty = moved;
      if (leftover > 0) a.qty = leftover;
      else from[fromIdx] = null;
      return;
    }

    from[fromIdx] = b || null;
    to[toIdx] = a || null;
  }

  moveToPlayer(ownerKey, idx) {
    if (ownerKey === "player") return;
    const slot = this.inv[ownerKey][idx];
    if (!slot) return;

    // try free slot
    const free = this.firstFreeSlot(this.inv.player);
    if (free !== -1) {
      this.inv.player[free] = slot;
      this.inv[ownerKey][idx] = null;
      this.rerender();
      this.state.save();
      return;
    }

    // try stack
    const stackIdx = this.findStackIndex(this.inv.player, slot.itemId);
    if (stackIdx >= 0) {
      this.moveItem(ownerKey, idx, "player", stackIdx);
      if (this.inv[ownerKey][idx] && this.inv[ownerKey][idx].itemId === slot.itemId) {
        // leftover remains
      } else {
        this.inv[ownerKey][idx] = null;
      }
      this.rerender();
      this.state.save();
      return;
    }
  }

  discard(ownerKey, idx) {
    this.inv[ownerKey][idx] = null;
    this.rerender();
    this.state.save();
  }

  firstFreeSlot(arr) {
    return arr.findIndex(x => !x);
  }

  findStackIndex(arr, itemId) {
    return arr.findIndex(x => x && x.itemId === itemId);
  }

  rerender() {
    this.renderPlayer();
    this.ui.renderStats(this.state);
  }

  nowAsTotalHours() {
    const t = this.state.state.time;
    return t.day * 24 + t.hour;
  }

  #escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
}
