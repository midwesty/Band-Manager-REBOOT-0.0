export class DAW {
  constructor({ ui, data, state, music }) {
    this.ui = ui;
    this.data = data;
    this.state = state;
    this.music = music;

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
    const patterns = this.state.state.patterns || [];
    if (patterns.length === 0) { alert("No patterns saved yet. Record one first."); return; }
    const names = patterns.map((p, i) => `${i}: ${p.name}`).join("\n");
    const pick = prompt("Import which pattern?\n" + names, "0");
    const idx = parseInt(pick || "0", 10);
    if (!Number.isNaN(idx) && patterns[idx]) this.importPattern(idx);
  }

  importPattern(idx) {
    const p = this.state.state.patterns[idx];
    if (!p) return;
    const id = Math.random().toString(36).slice(2);
    this.state.state.daw.blocks.push({ id, name: p.name, patternIndex: idx, startStep: 0, length: p.length, lane: 0 });
    this.rebuild();
    this.state.save();
  }

  duplicateSelected() {
    const id = this.state.state.daw.selectedId;
    if (!id) return;
    const b = this.state.state.daw.blocks.find(x => x.id === id);
    if (!b) return;
    const nb = { ...b, id: Math.random().toString(36).slice(2), startStep: b.startStep + 16 };
    this.state.state.daw.blocks.push(nb);
    this.rebuild();
    this.state.save();
  }

  deleteSelected() {
    const id = this.state.state.daw.selectedId;
    if (!id) return;
    this.state.state.daw.blocks = this.state.state.daw.blocks.filter(b => b.id !== id);
    this.state.state.daw.selectedId = null;
    this.rebuild();
    this.state.save();
  }

  saveProjectPrompt() {
    const name = prompt("Save project as:", "Project_" + Math.floor(Math.random() * 1000));
    if (!name) return;
    const snapshot = { name, bpm: this.state.state.daw.bpm, blocks: this.state.state.daw.blocks };
    const projects = this.state.state.projects || (this.state.state.projects = []);
    const idx = projects.findIndex(p => p.name === name);
    if (idx >= 0) projects[idx] = snapshot; else projects.push(snapshot);
    this.state.save();
    alert("Project saved.");
  }

  loadProjectPrompt() {
    const projects = this.state.state.projects || [];
    if (projects.length === 0) { alert("No projects saved."); return; }
    const names = projects.map((p, i) => `${i}: ${p.name}`).join("\n");
    const pick = prompt("Load which project?\n" + names, "0");
    const idx = parseInt(pick || "0", 10);
    if (!Number.isNaN(idx) && projects[idx]) {
      const proj = projects[idx];
      this.state.state.daw.blocks = JSON.parse(JSON.stringify(proj.blocks || []));
      this.state.state.daw.bpm = proj.bpm || 120;
      this.rebuild();
      this.state.save();
      alert("Project loaded.");
    }
  }

  rebuild() {
    if (!this.ui.dawTimeline) return;

    this.ui.dawTimeline.querySelectorAll(".block, .lane-guide").forEach(b => b.remove());

    for (let i = 0; i < this.DAW_LANES; i++) {
      const g = document.createElement("div");
      g.className = "lane-guide";
      Object.assign(g.style, {
        position: "absolute", left: "0", right: "0",
        top: (10 + i * 44) + "px", height: "44px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      });
      this.ui.dawTimeline.appendChild(g);
    }

    for (const b of this.state.state.daw.blocks) {
      if (typeof b.lane !== "number") b.lane = 0;
      const el = document.createElement("div");
      el.className = "block";
      el.textContent = b.name;
      el.dataset.id = b.id;
      el.style.left = (b.startStep * this.pxPerStep) + "px";
      el.style.top = (10 + b.lane * 44 + 4) + "px";

      el.addEventListener("click", () => {
        this.state.state.daw.selectedId = b.id;
        this.refreshSelection();
      });

      el.draggable = true;
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", b.id);
      });

      this.ui.dawTimeline.appendChild(el);
    }

    this.refreshSelection();
    if (this.ui.playhead) this.ui.playhead.style.left = "0px";
  }

  refreshSelection() {
    this.ui.dawTimeline?.querySelectorAll(".block").forEach(el => {
      el.classList.toggle("selected", el.dataset.id === this.state.state.daw.selectedId);
    });
  }

  #bindTimelineDnD() {
    this.ui.dawTimeline?.addEventListener("dragover", (e) => e.preventDefault());
    this.ui.dawTimeline?.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const block = this.state.state.daw.blocks.find(x => x.id === id);
      if (!block) return;

      const rect = this.ui.dawTimeline.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const step = Math.max(
        0,
        Math.min(this.state.state.daw.durationSteps - 1, Math.round((x - (this.blockWidth / 2)) / this.pxPerStep))
      );
      const lane = Math.max(0, Math.min(this.DAW_LANES - 1, Math.floor((y - 10) / 44)));

      block.startStep = step;
      block.lane = lane;

      this.rebuild();
      this.state.save();
    });
  }

  play() {
    if (this.state.state.daw.playing) return;
    this.state.state.daw.playing = true;
    this.playStep = 0;
    if (this.ui.playhead) this.ui.playhead.style.left = "0px";

    const bpm = this.state.state.daw.bpm || 120;
    const msPerStep = (60000 / bpm) / 4;

    this.timer = setInterval(() => {
      for (const b of this.state.state.daw.blocks) {
        if (b.startStep === this.playStep) {
          const p = this.state.state.patterns[b.patternIndex];
          if (p) this.music.playPattern(p);
        }
      }
      this.playStep = (this.playStep + 1) % (this.state.state.daw.durationSteps || 128);
      if (this.ui.playhead) this.ui.playhead.style.left = (this.playStep * this.pxPerStep) + "px";
    }, msPerStep);
  }

  stop() {
    this.state.state.daw.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.ui.playhead) this.ui.playhead.style.left = "0px";
  }
}
