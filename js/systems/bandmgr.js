export class BandMgr {
  constructor({ ui, data, state }) {
    this.ui = ui;
    this.data = data;
    this.state = state;

    this.selectedId = null;

    this.ui.bmClose?.addEventListener("click", () => this.close());
    this.ui.bmAdd?.addEventListener("click", () => this.addBand());
    this.ui.bmDel?.addEventListener("click", () => this.deleteBand());
    this.ui.bmSort?.addEventListener("click", () => this.toggleSort());
    this.ui.bmBack?.addEventListener("click", () => this.backToList());
    this.ui.bmRename?.addEventListener("click", () => this.renameSelected());

    this.ui.bmTabs?.forEach(btn => btn.addEventListener("click", () => this.switchTab(btn.dataset.tab)));
  }

  open() {
    this.ui.bandmgr?.classList.remove("hidden");
    this.renderList();
  }

  close() {
    this.ui.bandmgr?.classList.add("hidden");
  }

  get bands() { return this.state.state.bands || (this.state.state.bands = []); }

  addBand() {
    const name = prompt("New band name:", "New Band");
    if (!name) return;
    this.bands.push({
      id: "band_" + Math.random().toString(36).slice(2),
      name,
      members: [],
      songs: [],
      bookings: [],
      createdAt: Date.now()
    });
    this.state.save();
    this.renderList();
  }

  deleteBand() {
    if (!this.selectedId) { alert("Select a band first."); return; }
    const i = this.bands.findIndex(b => b.id === this.selectedId);
    if (i >= 0) this.bands.splice(i, 1);
    this.selectedId = null;
    this.state.save();
    this.renderList();
  }

  toggleSort() {
    const s = this.state.state.bandMgr;
    s.sort = (s.sort === "name") ? "date" : "name";
    if (this.ui.bmSort) this.ui.bmSort.textContent = "Sort: " + (s.sort === "name" ? "Name" : "Created");
    this.renderList();
    this.state.save();
  }

  backToList() {
    this.ui.bmDetail?.classList.add("hidden");
    this.ui.bmListPane?.classList.remove("hidden");
  }

  renameSelected() {
    if (!this.selectedId) return;
    const band = this.bands.find(b => b.id === this.selectedId);
    if (!band) return;
    const name = prompt("Rename band:", band.name);
    if (!name) return;
    band.name = name;
    this.state.save();
    this.renderDetail(band);
    this.renderList();
  }

  switchTab(tab) {
    this.ui.bmTabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    ["members", "instruments", "songs", "bookings"].forEach(id => {
      const el = document.getElementById(`bm-tab-${id}`);
      if (!el) return;
      el.classList.toggle("hidden", id !== tab);
    });
  }

  renderList() {
    const s = this.state.state.bandMgr;
    const bands = [...this.bands];
    if (s.sort === "name") bands.sort((a, b) => a.name.localeCompare(b.name));
    else bands.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    this.ui.bmListPane?.classList.remove("hidden");
    this.ui.bmDetail?.classList.add("hidden");
    if (!this.ui.bmList) return;

    this.ui.bmList.innerHTML = "";
    bands.forEach(b => {
      const li = document.createElement("li");

      const left = document.createElement("div");
      left.innerHTML = `<strong>${this.#escape(b.name)}</strong><div class="meta">${(b.members || []).length} members</div>`;

      const right = document.createElement("div");
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        this.selectedId = b.id;
        this.renderDetail(b);
      });

      right.appendChild(edit);
      li.appendChild(left);
      li.appendChild(right);
      this.ui.bmList.appendChild(li);
    });
  }

  renderDetail(band) {
    this.ui.bmListPane?.classList.add("hidden");
    this.ui.bmDetail?.classList.remove("hidden");
    if (this.ui.bmName) this.ui.bmName.textContent = band.name;

    // Avatars placeholder
    if (this.ui.bmAvatars) {
      this.ui.bmAvatars.innerHTML = "";
      const max = Math.max(3, (band.members || []).length);
      for (let i = 0; i < max; i++) {
        const av = document.createElement("div");
        av.className = "avatar";
        const m = band.members?.[i];
        av.textContent = m ? (m.name?.[0] || "?") : "+";
        this.ui.bmAvatars.appendChild(av);
      }
    }

    // Members tab (editable)
    if (this.ui.bmTabMembers) {
      this.ui.bmTabMembers.innerHTML = `
        <div class="bm-toolbar"><button id="bm-add-mem">+ Add Member</button></div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left">Name</th><th style="text-align:left">Role</th><th style="text-align:left">Instrument</th><th></th></tr></thead>
          <tbody id="bm-mem-body"></tbody>
        </table>
      `;

      const body = this.ui.bmTabMembers.querySelector("#bm-mem-body");
      (band.members || []).forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input data-idx="${idx}" data-k="name" value="${this.#escape(m.name || "")}"/></td>
          <td><input data-idx="${idx}" data-k="role" value="${this.#escape(m.role || "")}"/></td>
          <td><input data-idx="${idx}" data-k="instrument" value="${this.#escape(m.instrument || "")}"/></td>
          <td><button data-del="${idx}">🗑</button></td>
        `;
        body.appendChild(tr);
      });

      this.ui.bmTabMembers.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("change", () => {
          const i = parseInt(inp.dataset.idx, 10);
          const k = inp.dataset.k;
          band.members[i][k] = inp.value;
          this.state.save();
        });
      });

      this.ui.bmTabMembers.querySelectorAll("button[data-del]").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.dataset.del, 10);
          band.members.splice(i, 1);
          this.state.save();
          this.renderDetail(band);
        });
      });

      this.ui.bmTabMembers.querySelector("#bm-add-mem")?.addEventListener("click", () => {
        (band.members ||= []).push({ name: "New Member", role: "", instrument: "" });
        this.state.save();
        this.renderDetail(band);
      });
    }

    // Instruments placeholder
    this.ui.bmTabInstruments && (this.ui.bmTabInstruments.innerHTML = `<p>Assign instruments to members (coming soon). For now, edit in Members tab.</p>`);

    // Songs tab
    if (this.ui.bmTabSongs) {
      this.ui.bmTabSongs.innerHTML = `
        <div class="bm-toolbar"><button id="bm-add-song">+ Add Song</button></div>
        <ul id="bm-song-list"></ul>
      `;

      const list = this.ui.bmTabSongs.querySelector("#bm-song-list");
      (band.songs || []).forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.title || "Untitled"} — ${s.bpm || 120} BPM • ${s.genre || "Unknown"}`;
        list.appendChild(li);
      });

      this.ui.bmTabSongs.querySelector("#bm-add-song")?.addEventListener("click", () => {
        const title = prompt("Song title:", "New Song");
        const bpm = parseInt(prompt("BPM:", "120") || "120", 10);
        const genre = prompt("Genre:", "Alt Rock") || "Alt Rock";
        (band.songs ||= []).push({ title, bpm, genre });
        this.state.save();
        this.renderDetail(band);
      });
    }

    // Bookings placeholder
    this.ui.bmTabBookings && (this.ui.bmTabBookings.innerHTML = `<p>Venue bookings & calendar integration (coming soon).</p>`);

    // Default tab
    this.switchTab("members");
  }

  #escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
}
