export class DAW {
  constructor({ ui, data, state, music }) {
    this.ui = ui;
    this.data = data;
    this.state = state;
    this.music = music;

    // Allow DAW to run without the UI helper class (DOM-wired fallback)
    if (!this.ui || !this.ui.daw) {
      this.ui = this.ui || {};
      const byId = (id) => document.getElementById(id);
      Object.assign(this.ui, {
        daw: byId("daw"),
        dawTimeline: byId("daw-timeline"),
        dawImport: byId("daw-import"),
        dawDup: byId("daw-dup"),
        dawDel: byId("daw-del"),
        dawPlay: byId("daw-play"),
        dawStop: byId("daw-stop"),
        dawSave: byId("daw-save"),
        dawLoad: byId("daw-load"),
        dawClose: byId("daw-close"),
        playhead: byId("playhead"),
      });
    }

    // Support passing the state wrapper { get state(){...}, save(){} }
    this._getState = () => (this.state?.state || this.state);

    this.DAW_LANES = 5;
    this.pxPerStep = 4;
    this.blockWidth = 128;

    this.timer = null;
    this.playStep = 0;

    this.#bindDAWButtons();
    this.#bindTimelineDnD();
    this.#bindImportBridge();
  }

  #bindDAWButtons() {
    this.ui.dawClose?.addEventListener("click", () => this.close());
    this.ui.dawImport?.addEventListener("click", () => this.promptImport());
    this.ui.dawDup?.addEventListener("click", () => this.duplicateSelected());
    this.ui.dawDel?.addEventListener("click", () => this.deleteSelected());
    this.ui.dawPlay?.addEventListener("click", () => this.play());
    this.ui.dawStop?.addEventListener("click", () => this.stop());
    this.ui.dawSave?.addEventListener("click", () => this.saveProjectPrompt());
    this.ui.dawLoad?.addEventListener("click", () => this.loadProjectPrompt());

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Delete") return;
      if (this.ui.daw?.classList.contains("hidden")) return;
      this.deleteSelected();
    });
  }

  #bindImportBridge() {
    window.addEventListener("bandscape:importPattern", (e) => {
      const idx = e.detail?.index;
      if (Number.isInteger(idx)) {
        this.importPattern(idx);
        this.open();
      }
    });
  }

  open() {
    this.ui.daw?.classList.remove("hidden");
    this.rebuild();
  }

  close() {
    this.ui.daw?.classList.add("hidden");
    this.stop();
  }

  promptImport() {
    const state = this._getState();
    const patterns = state.patterns || [];
    if (patterns.length === 0) { alert("No patterns saved yet. Record one first."); return; }
    const names = patterns.map((p, i) => `${i}: ${p.name}`).join("\n");
    const pick = prompt("Import which pattern?\n" + names, "0");
    const idx = parseInt(pick || "0", 10);
    if (!Number.isNaN(idx) && patterns[idx]) this.importPattern(idx);
  }

  importPattern(idx) {
    const state = this._getState();
    state.daw ||= { bpm: 120, blocks: [], selectedId: null };
    const p = state.patterns[idx];
    if (!p) return;
    const id = Math.random().toString(36).slice(2);
    state.daw.blocks.push({ id, name: p.name, patternIndex: idx, startStep: 0, length: p.length, lane: 0 });
    this.rebuild();
    this.state.save?.();
  }

  duplicateSelected() {
    const state = this._getState();
    const id = state.daw?.selectedId;
    if (!id) return;
    const b = state.daw.blocks.find(x => x.id === id);
    if (!b) return;
    const nb = { ...b, id: Math.random().toString(36).slice(2), startStep: b.startStep + 16 };
    state.daw.blocks.push(nb);
    this.rebuild();
    this.state.save?.();
  }

  deleteSelected() {
    const state = this._getState();
    const id = state.daw?.selectedId;
    if (!id) return;
    state.daw.blocks = state.daw.blocks.filter(b => b.id !== id);
    state.daw.selectedId = null;
    this.rebuild();
    this.state.save?.();
  }

  saveProjectPrompt() {
    const state = this._getState();
    state.projects ||= [];
    state.daw ||= { bpm: 120, blocks: [], selectedId: null };

    const name = prompt("Save project as:", "Project_" + Math.floor(Math.random() * 1000));
    if (!name) return;

    const snapshot = { name, bpm: state.daw.bpm, blocks: state.daw.blocks };
    const projects = state.projects;
    const idx = projects.findIndex(p => p.name === name);
    if (idx >= 0) projects[idx] = snapshot; else projects.push(snapshot);

    this.state.save?.();
    alert("Project saved.");
  }

  loadProjectPrompt() {
    const state = this._getState();
    const projects = state.projects || [];
    if (projects.length === 0) { alert("No projects saved."); return; }
    const names = projects.map((p, i) => `${i}: ${p.name}`).join("\n");
    const pick = prompt("Load which project?\n" + names, "0");
    const idx = parseInt(pick || "0", 10);
    if (!Number.isNaN(idx) && projects[idx]) {
      const proj = projects[idx];
      state.daw ||= { bpm: 120, blocks: [], selectedId: null };
      state.daw.blocks = JSON.parse(JSON.stringify(proj.blocks || []));
      state.daw.bpm = proj.bpm || 120;
      this.rebuild();
      this.state.save?.();
      alert("Project loaded.");
    }
  }

  rebuild() {
    if (!this.ui.dawTimeline) return;

    const state = this._getState();
    state.daw ||= { bpm: 120, blocks: [], selectedId: null };

    this.ui.dawTimeline.querySelectorAll(".block, .lane-guide").forEach(b => b.remove());

    for (let i = 0; i < this.DAW_LANES; i++) {
      const g = document.createElement("div");
      g.className = "lane-guide";
      g.style.position = "absolute";
      g.style.left = "0";
      g.style.right = "0";
      g.style.top = (i * 60) + "px";
      g.style.height = "60px";
      g.style.borderTop = "1px solid rgba(255,255,255,.06)";
      this.ui.dawTimeline.appendChild(g);
    }

    state.daw.blocks.forEach(b => {
      const el = document.createElement("div");
      el.className = "block";
      el.dataset.id = b.id;
      el.textContent = b.name || "Pattern";
      el.style.position = "absolute";
      el.style.left = (b.startStep * this.pxPerStep) + "px";
      el.style.top = (b.lane * 60 + 6) + "px";
      el.style.width = Math.max(40, (b.length * this.pxPerStep)) + "px";
      el.style.height = "48px";
      el.style.borderRadius = "10px";
      el.style.padding = "8px";
      el.style.background = "rgba(255,212,0,.15)";
      el.style.border = "1px solid rgba(255,212,0,.35)";
      el.style.cursor = "grab";
      el.style.userSelect = "none";

      if (state.daw.selectedId === b.id) {
        el.style.outline = "2px solid rgba(127,209,255,.9)";
      }

      el.addEventListener("mousedown", (e) => {
        state.daw.selectedId = b.id;
        this.rebuild();
        e.stopPropagation();
      });

      el.draggable = true;
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", b.id);
      });

      this.ui.dawTimeline.appendChild(el);
    });

    this.ui.dawTimeline.addEventListener("mousedown", () => {
      state.daw.selectedId = null;
      this.rebuild();
    }, { once: true });
  }

  #bindTimelineDnD() {
    const tl = this.ui.dawTimeline;
    if (!tl) return;

    tl.addEventListener("dragover", (e) => e.preventDefault());
    tl.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;

      const state = this._getState();
      const b = state.daw?.blocks?.find(x => x.id === id);
      if (!b) return;

      const rect = tl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      b.startStep = Math.max(0, Math.round(x / this.pxPerStep));
      b.lane = Math.max(0, Math.min(this.DAW_LANES - 1, Math.floor(y / 60)));

      this.rebuild();
      this.state.save?.();
    });
  }

  play() {
    const state = this._getState();
    state.daw ||= { bpm: 120, blocks: [], selectedId: null };

    if (this.timer) return;
    const bpm = state.daw.bpm || 120;
    const msPerStep = Math.max(30, Math.floor((60_000 / bpm) / 4));

    this.playStep = 0;
    this.timer = setInterval(() => {
      this.tickPlayhead();
      this.playStep++;
      if (this.playStep >= 256) this.playStep = 0;
    }, msPerStep);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.setPlayhead(0);
  }

  tickPlayhead() {
    const state = this._getState();
    const blocks = state.daw?.blocks || [];

    blocks.forEach((b) => {
      if (b.startStep === this.playStep) {
        const p = state.patterns?.[b.patternIndex];
        if (p && this.music?.previewPattern) this.music.previewPattern(p);
      }
    });

    this.setPlayhead(this.playStep);
  }

  setPlayhead(step) {
    const ph = this.ui.playhead;
    const tl = this.ui.dawTimeline;
    if (!ph || !tl) return;
    ph.style.left = (step * this.pxPerStep) + "px";
  }
}
