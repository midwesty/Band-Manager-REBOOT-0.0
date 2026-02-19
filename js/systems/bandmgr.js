// js/systems/bandmgr.js
// Band Manager system - DOM-wired (does not rely on external ui mapping)
// Works with the IDs in your current index.html.

export class BandMgr {
  constructor({ state }) {
    this.state = state;

    this.selectedId = null;

    // Cache DOM nodes directly from HTML
    this.el = {
      overlay: document.getElementById("bandmgr"),
      close: document.getElementById("bm-close"),
      add: document.getElementById("bm-add"),
      del: document.getElementById("bm-del"),
      sort: document.getElementById("bm-sort"),

      listPane: document.getElementById("bm-list"),
      list: document.getElementById("bm-bands"),

      detailPane: document.getElementById("bm-detail"),
      back: document.getElementById("bm-back"),
      rename: document.getElementById("bm-rename"),
      name: document.getElementById("bm-name"),
      avatars: document.getElementById("bm-avatars"),

      tabButtons: Array.from(document.querySelectorAll(".bm-tabs button[data-tab]")),
      tabMembers: document.getElementById("bm-tab-members"),
      tabInstruments: document.getElementById("bm-tab-instruments"),
      tabSongs: document.getElementById("bm-tab-songs"),
      tabBookings: document.getElementById("bm-tab-bookings"),

      // Convenience entry point from phone inventory pane
      openFromPhone: document.getElementById("open-bandmgr"),
    };

    // Ensure state containers exist
    const s = (this.state?.state) || this.state || (this.state.state = {});
    s.bands ||= [];
    s.bandMgr ||= { sort: "name" };

    // Bind events (guard for missing DOM)
    this.el.close?.addEventListener("click", () => this.close());
    this.el.add?.addEventListener("click", () => this.addBand());
    this.el.del?.addEventListener("click", () => this.deleteBand());
    this.el.sort?.addEventListener("click", () => this.toggleSort());

    this.el.back?.addEventListener("click", () => this.backToList());
    this.el.rename?.addEventListener("click", () => this.renameSelected());

    this.el.openFromPhone?.addEventListener("click", () => this.open());

    this.el.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
    });

    // ESC closes overlay (nice QoL)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!this.el.overlay || this.el.overlay.classList.contains("hidden")) return;
      this.close();
    });

    // Set initial sort label
    this.syncSortLabel();
  }

  get bands() {
    return this.state.state.bands;
  }

  open() {
    if (!this.el.overlay) return;
    this.el.overlay.classList.remove("hidden");
    this.selectedId = null;
    this.backToList();
    this.renderList();
  }

  close() {
    this.el.overlay?.classList.add("hidden");
  }

  addBand() {
    const name = prompt("New band name:", "New Band");
    if (!name) return;

    this.bands.push({
      id: "band_" + Math.random().toString(36).slice(2),
      name: name.trim(),
      members: [],
      instruments: {},
      songs: [],
      bookings: [],
      createdAt: Date.now(),
    });

    this.state.save?.();
    this.renderList();
  }

  deleteBand() {
    if (!this.selectedId) {
      alert("Select a band first (click it in the list).");
      return;
    }

    const band = this.bands.find((b) => b.id === this.selectedId);
    if (!band) {
      alert("Band not found.");
      return;
    }

    if (!confirm(`Delete "${band.name}"?`)) return;

    const i = this.bands.findIndex((b) => b.id === this.selectedId);
    if (i >= 0) this.bands.splice(i, 1);

    this.selectedId = null;
    this.state.save?.();
    this.renderList();
    this.backToList();
  }

  toggleSort() {
    const bm = this.state.state.bandMgr;
    bm.sort = bm.sort === "name" ? "date" : "name";
    this.syncSortLabel();
    this.state.save?.();
    this.renderList();
  }

  syncSortLabel() {
    const bm = this.state.state.bandMgr;
    if (!this.el.sort) return;
    this.el.sort.textContent = "Sort: " + (bm.sort === "name" ? "Name" : "Created");
  }

  backToList() {
    this.el.detailPane?.classList.add("hidden");
    this.el.listPane?.classList.remove("hidden");
  }

  renameSelected() {
    if (!this.selectedId) return;

    const band = this.bands.find((b) => b.id === this.selectedId);
    if (!band) return;

    const name = prompt("Rename band:", band.name);
    if (!name) return;

    band.name = name.trim();
    this.state.save?.();
    this.renderDetail(band);
    this.renderList();
  }

  switchTab(tab) {
    // Toggle tab button styles
    this.el.tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

    const show = (el, on) => el && el.classList.toggle("hidden", !on);

    show(this.el.tabMembers, tab === "members");
    show(this.el.tabInstruments, tab === "instruments");
    show(this.el.tabSongs, tab === "songs");
    show(this.el.tabBookings, tab === "bookings");
  }

  renderList() {
    if (!this.el.list) return;

    const bm = this.state.state.bandMgr;
    const bands = [...this.bands];

    if (bm.sort === "name") bands.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else bands.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    this.el.list.innerHTML = "";

    bands.forEach((b) => {
      const li = document.createElement("li");

      const left = document.createElement("div");
      left.innerHTML = `<strong>${this.escape(b.name)}</strong><div class="meta">${(b.members || []).length} members</div>`;

      const right = document.createElement("div");
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectedId = b.id;
        this.renderDetail(b);
      });

      right.appendChild(edit);
      li.appendChild(left);
      li.appendChild(right);

      // Clicking the row selects it (helps Delete button)
      li.addEventListener("click", () => {
        this.selectedId = b.id;
        this.el.list.querySelectorAll("li").forEach((x) => x.classList.remove("selected"));
        li.classList.add("selected");
      });

      this.el.list.appendChild(li);
    });
  }

  renderDetail(band) {
    this.el.listPane?.classList.add("hidden");
    this.el.detailPane?.classList.remove("hidden");

    if (this.el.name) this.el.name.textContent = band.name || "Unnamed";
    if (this.el.avatars) {
      this.el.avatars.innerHTML = "";
      const mem = band.members || [];
      if (mem.length === 0) {
        const av = document.createElement("div");
        av.className = "avatar";
        av.textContent = "?";
        this.el.avatars.appendChild(av);
      } else {
        mem.slice(0, 6).forEach((m) => {
          const av = document.createElement("div");
          av.className = "avatar";
          av.textContent = (m.name || "?").slice(0, 2).toUpperCase();
          this.el.avatars.appendChild(av);
        });
      }
    }

    // Default tab
    this.switchTab("members");
  }

  escape(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[c]);
  }
}
