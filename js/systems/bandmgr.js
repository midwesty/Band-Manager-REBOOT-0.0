// js/systems/bandmgr.js
// Band Manager overlay: create/edit bands; tie in NPCs and TrackLab patterns.

import { $ } from "../engine/dom.js";

const DEFAULT_NPCS = [
  { id: "npc_you", name: "You", archetype: "Player", reliability: 0.9, skill: 0.4 },
  { id: "npc_brian", name: "Brian", archetype: "Drummer", reliability: 0.8, skill: 0.6 },
  { id: "npc_lex", name: "Lex", archetype: "Bassist", reliability: 0.7, skill: 0.55 },
  { id: "npc_ruby", name: "Ruby", archetype: "Singer", reliability: 0.65, skill: 0.5 },
];

const DEFAULT_INSTRUMENTS = [
  { id: "guitar", label: "Guitar" },
  { id: "bass", label: "Bass" },
  { id: "drums", label: "Drums" },
  { id: "vox", label: "Vocals" },
  { id: "keys", label: "Keys" },
];

export class BandMgr {
  constructor({ state, data }) {
    this.state = state;
    this.data = data || {};

    this.el = {
      overlay: document.getElementById("bandmgr"),
      close: document.getElementById("bandmgr-close"),
      openFromPhone: document.getElementById("open-bandmgr"),

      listWrap: document.getElementById("bm-list"),
      search: document.getElementById("bm-search"),
      sort: document.getElementById("bm-sort"),
      add: document.getElementById("bm-add"),

      detailWrap: document.getElementById("bm-detail"),
      back: document.getElementById("bm-back"),
      title: document.getElementById("bm-title"),
      rename: document.getElementById("bm-rename"),
      del: document.getElementById("bm-delete"),

      tabs: Array.from(document.querySelectorAll(".bm-tab")),
      tabMembers: document.getElementById("bm-tab-members"),
      tabInstruments: document.getElementById("bm-tab-instruments"),
      tabSongs: document.getElementById("bm-tab-songs"),
      tabBookings: document.getElementById("bm-tab-bookings"),

      membersWrap: document.getElementById("bm-members"),
      instrumentsWrap: document.getElementById("bm-instruments"),
      songsWrap: document.getElementById("bm-songs"),
      bookingsWrap: document.getElementById("bm-bookings"),
    };

    const s = this.state.state;
    s.bands ||= [];
    s.bandMgr ||= { sort: "name" };

    this.selectedId = null;
    this.activeTab = "members";

    this.bind();

    // Overlay lifecycle: if something opens the overlay directly (hotspot/phone), ensure it renders.
    window.addEventListener("bandscape:overlayOpened", (e) => {
      if (e?.detail?.id === "bandmgr") this.open();
    });

    window.addEventListener("bandscape:overlayClosed", (e) => {
      if (e?.detail?.id === "bandmgr") this.selectedId = null;
    });
  }

  // ---------- Data helpers ----------
  getNpcs() {
    const npcs = Array.isArray(this.data?.npcs) ? this.data.npcs : [];
    return npcs.length ? npcs : DEFAULT_NPCS;
  }

  getInstruments() {
    // If you later move instruments to JSON, plug it in here.
    return DEFAULT_INSTRUMENTS;
  }

  getBand() {
    const s = this.state.state;
    return s.bands.find((b) => b.id === this.selectedId) || null;
  }

  // ---------- Binding ----------
  bind() {
    this.el.close?.addEventListener("click", () => this.close());
    this.el.openFromPhone?.addEventListener("click", () => this.open());

    this.el.add?.addEventListener("click", () => this.addBand());
    this.el.search?.addEventListener("input", () => this.renderList());
    this.el.sort?.addEventListener("change", () => {
      this.state.state.bandMgr.sort = this.el.sort.value;
      this.state.save?.();
      this.renderList();
    });

    this.el.back?.addEventListener("click", () => this.backToList());
    this.el.rename?.addEventListener("click", () => this.renameSelected());
    this.el.del?.addEventListener("click", () => this.deleteSelected());

    this.el.tabs.forEach((btn) => {
      btn.addEventListener("click", () => this.setTab(btn.dataset.tab));
    });
  }

  // ---------- Overlay ----------
  open() {
    this.el.overlay?.classList.remove("hidden");
    this.renderList();

    // If we were already in detail view, re-render it.
    if (this.selectedId) this.renderDetail();
  }

  close() {
    this.el.overlay?.classList.add("hidden");
  }

  backToList() {
    this.selectedId = null;
    this.el.detailWrap?.classList.add("hidden");
    this.el.listWrap?.classList.remove("hidden");
  }

  // ---------- Bands CRUD ----------
  addBand() {
    const s = this.state.state;
    const name = prompt("Band name?", `New Band ${s.bands.length + 1}`);
    if (!name) return;

    s.bands.push({
      id: `band_${Date.now()}`,
      name,
      members: [],
      instruments: {}, // memberId -> instrumentId
      songs: [], // { patternIndex, name }
      bookings: [],
    });

    this.state.save?.();
    this.renderList();
  }

  renameSelected() {
    const band = this.getBand();
    if (!band) return;

    const name = prompt("Rename band:", band.name);
    if (!name) return;

    band.name = name;
    this.state.save?.();
    this.renderDetail();
    this.renderList();
  }

  deleteSelected() {
    const s = this.state.state;
    const band = this.getBand();
    if (!band) return;

    if (!confirm(`Delete "${band.name}"?`)) return;

    s.bands = s.bands.filter((b) => b.id !== band.id);
    this.selectedId = null;
    this.state.save?.();
    this.backToList();
    this.renderList();
  }

  // ---------- List ----------
  renderList() {
    const s = this.state.state;
    const q = (this.el.search?.value || "").trim().toLowerCase();

    const sort = this.el.sort?.value || s.bandMgr?.sort || "name";

    let list = [...(s.bands || [])];
    if (q) list = list.filter((b) => (b.name || "").toLowerCase().includes(q));

    if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sort === "recent") list.sort((a, b) => (b.id || "").localeCompare(a.id || ""));

    if (!this.el.listWrap) return;

    const rows = list
      .map((b) => {
        const safe = escapeHtml(b.name || "(unnamed)");
        const members = Array.isArray(b.members) ? b.members.length : 0;
        const songs = Array.isArray(b.songs) ? b.songs.length : 0;
        return `
          <div class="bm-row" data-id="${b.id}">
            <div class="bm-row-title">${safe}</div>
            <div class="bm-row-meta">${members} members • ${songs} songs</div>
            <button class="btn">Edit</button>
          </div>
        `;
      })
      .join("");

    this.el.listWrap.innerHTML = rows || `<div class="muted">No bands yet. Click “+ Add Band”.</div>`;

    this.el.listWrap.querySelectorAll(".bm-row").forEach((row) => {
      row.addEventListener("click", () => {
        this.selectedId = row.dataset.id;
        this.renderDetail();
      });
    });
  }

  // ---------- Detail ----------
  renderDetail() {
    const band = this.getBand();
    if (!band) return;

    this.el.listWrap?.classList.add("hidden");
    this.el.detailWrap?.classList.remove("hidden");

    this.el.title.textContent = band.name;

    // Default to members tab
    this.setTab(this.activeTab || "members");
  }

  setTab(tab) {
    this.activeTab = tab;
    this.el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));

    const showMembers = tab === "members";
    const showInst = tab === "instruments";
    const showSongs = tab === "songs";
    const showBookings = tab === "bookings";

    this.el.membersWrap?.classList.toggle("hidden", !showMembers);
    this.el.instrumentsWrap?.classList.toggle("hidden", !showInst);
    this.el.songsWrap?.classList.toggle("hidden", !showSongs);
    this.el.bookingsWrap?.classList.toggle("hidden", !showBookings);

    if (showMembers) this.renderMembersTab();
    if (showInst) this.renderInstrumentsTab();
    if (showSongs) this.renderSongsTab();
    if (showBookings) this.renderBookingsTab();
  }

  // ---------- Members ----------
  renderMembersTab() {
    const band = this.getBand();
    if (!band || !this.el.membersWrap) return;

    band.members ||= [];
    band.instruments ||= {};

    const npcs = this.getNpcs();
    const instruments = this.getInstruments();

    const options = npcs
      .map((n) => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.name)}</option>`)
      .join("");

    const memberRows = band.members
      .map((m) => {
        const inst = band.instruments?.[m.id] || m.instrumentId || "";
        const instOpts = instruments
          .map((i) => `<option value="${i.id}" ${i.id === inst ? "selected" : ""}>${escapeHtml(i.label)}</option>`)
          .join("");

        return `
          <div class="bm-member" data-mid="${escapeHtml(m.id)}">
            <div class="bm-member-name">
              <input class="bm-input" data-field="name" value="${escapeHtml(m.name || "")}" />
              <div class="muted">${escapeHtml(m.archetype || "")}</div>
            </div>
            <div class="bm-member-role">
              <input class="bm-input" data-field="role" placeholder="role (optional)" value="${escapeHtml(m.role || "")}" />
            </div>
            <div class="bm-member-inst">
              <select class="bm-select" data-field="instrument">${instOpts}</select>
            </div>
            <button class="btn danger" data-remove="1">Remove</button>
          </div>
        `;
      })
      .join("");

    this.el.membersWrap.innerHTML = `
      <div class="bm-toolbar">
        <select class="bm-select" id="bm-npc-pick">${options}</select>
        <button class="btn" id="bm-add-member">+ Add Member</button>
        <div class="muted">Tip: Add NPCs from <code>data/npcs.json</code> later. For now we ship a few defaults.</div>
      </div>
      <div class="bm-member-list">
        ${memberRows || `<div class="muted">No members yet. Add someone above.</div>`}
      </div>
    `;

    const pick = this.el.membersWrap.querySelector("#bm-npc-pick");
    const addBtn = this.el.membersWrap.querySelector("#bm-add-member");

    addBtn?.addEventListener("click", () => {
      const npcId = pick?.value;
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      // Prevent exact duplicates
      if (band.members.some((m) => m.id === npc.id)) {
        alert("That NPC is already in this band.");
        return;
      }

      band.members.push({
        id: npc.id,
        name: npc.name,
        archetype: npc.archetype || "",
        role: "",
        instrumentId: band.instruments?.[npc.id] || "",
      });

      this.state.save?.();
      this.renderMembersTab();
      this.renderList();
    });

    // Inline edits + remove
    this.el.membersWrap.querySelectorAll(".bm-member").forEach((row) => {
      const mid = row.getAttribute("data-mid");
      const member = band.members.find((m) => m.id === mid);
      if (!member) return;

      row.querySelectorAll("[data-field]").forEach((input) => {
        const field = input.getAttribute("data-field");

        input.addEventListener("change", () => {
          if (field === "name") member.name = input.value;
          if (field === "role") member.role = input.value;
          if (field === "instrument") {
            const val = input.value;
            member.instrumentId = val;
            band.instruments[mid] = val;
          }
          this.state.save?.();
          this.renderList();
        });
      });

      row.querySelector("[data-remove]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        band.members = band.members.filter((m) => m.id !== mid);
        delete band.instruments[mid];
        this.state.save?.();
        this.renderMembersTab();
        this.renderList();
      });
    });
  }

  // ---------- Instruments ----------
  renderInstrumentsTab() {
    const band = this.getBand();
    if (!band || !this.el.instrumentsWrap) return;

    band.members ||= [];
    band.instruments ||= {};

    const instruments = this.getInstruments();

    const rows = band.members
      .map((m) => {
        const current = band.instruments[m.id] || m.instrumentId || "";
        const opts = instruments
          .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(i.label)}</option>`)
          .join("");

        return `
          <div class="bm-inst-row" data-mid="${escapeHtml(m.id)}">
            <div><strong>${escapeHtml(m.name)}</strong></div>
            <select class="bm-select" data-inst>${opts}</select>
          </div>
        `;
      })
      .join("");

    this.el.instrumentsWrap.innerHTML = `
      <div class="bm-toolbar">
        <div class="muted">Assign instruments per member. This will matter for gigs later.</div>
      </div>
      ${rows || `<div class="muted">Add members first.</div>`}
    `;

    this.el.instrumentsWrap.querySelectorAll(".bm-inst-row").forEach((row) => {
      const mid = row.getAttribute("data-mid");
      const sel = row.querySelector("[data-inst]");
      sel?.addEventListener("change", () => {
        band.instruments[mid] = sel.value;
        const member = band.members.find((m) => m.id === mid);
        if (member) member.instrumentId = sel.value;
        this.state.save?.();
        this.renderMembersTab();
      });
    });
  }

  // ---------- Songs ----------
  renderSongsTab() {
    const band = this.getBand();
    if (!band || !this.el.songsWrap) return;

    band.songs ||= [];

    const patterns = this.state.state.patterns || [];

    const available = patterns
      .map((p, idx) => {
        const name = escapeHtml(p.name || `Pattern ${idx + 1}`);
        const already = band.songs.some((s) => s.patternIndex === idx);
        return `
          <div class="bm-song-row">
            <div>
              <strong>${name}</strong>
              <div class="muted">${escapeHtml(p.instrument || "guitar")} • ${escapeHtml(String(p.bpm || 120))} bpm</div>
            </div>
            <button class="btn" data-add-song="${idx}" ${already ? "disabled" : ""}>${already ? "Added" : "Add"}</button>
          </div>
        `;
      })
      .join("");

    const current = band.songs
      .map((s, i) => {
        const p = patterns[s.patternIndex];
        const label = escapeHtml(s.name || p?.name || "Song");
        return `
          <div class="bm-song-row">
            <div><strong>${label}</strong> <span class="muted">(pattern #${s.patternIndex})</span></div>
            <button class="btn danger" data-remove-song="${i}">Remove</button>
          </div>
        `;
      })
      .join("");

    this.el.songsWrap.innerHTML = `
      <div class="bm-toolbar">
        <div class="muted">For MVP, a “song” is just a TrackLab pattern reference. Later you can point songs at DAW projects.</div>
      </div>

      <h4>Available patterns</h4>
      <div class="bm-song-list">${available || `<div class="muted">No patterns yet. Record something in TrackLab.</div>`}</div>

      <h4 style="margin-top:14px">Band songs</h4>
      <div class="bm-song-list">${current || `<div class="muted">No songs added yet.</div>`}</div>
    `;

    this.el.songsWrap.querySelectorAll("[data-add-song]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-add-song"));
        const p = patterns[idx];
        if (!p) return;
        if (band.songs.some((s) => s.patternIndex === idx)) return;

        band.songs.push({
          patternIndex: idx,
          name: p.name || "Untitled",
        });
        this.state.save?.();
        this.renderSongsTab();
        this.renderList();
      });
    });

    this.el.songsWrap.querySelectorAll("[data-remove-song]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-remove-song"));
        if (!Number.isFinite(i)) return;
        band.songs.splice(i, 1);
        this.state.save?.();
        this.renderSongsTab();
        this.renderList();
      });
    });
  }

  // ---------- Bookings ----------
  renderBookingsTab() {
    if (!this.el.bookingsWrap) return;
    this.el.bookingsWrap.innerHTML = `
      <div class="muted">Bookings are coming soon. MVP: stay in the apartment.</div>
    `;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
