export class DAW {
  constructor({ state, data, music }) {
    this.stateWrap = state;
    this.data = data;
    this.music = music;

    this.el = {
      overlay: document.getElementById("daw"),
      close: document.getElementById("daw-close"),
      timeline: document.getElementById("daw-timeline"),
      playhead: document.getElementById("playhead"),

      importBtn: document.getElementById("daw-import"),
      dupBtn: document.getElementById("daw-dup"),
      delBtn: document.getElementById("daw-del"),
      playBtn: document.getElementById("daw-play"),
      stopBtn: document.getElementById("daw-stop"),
      saveBtn: document.getElementById("daw-save"),
      loadBtn: document.getElementById("daw-load")
    };

    this.pxPerStep = 12;         // bigger = more visible grid
    this.laneHeight = 72;
    this.timer = null;
    this.playStep = 0;

    this.bindUI();
    this.bindImportEvent();
  }

  get state() { return this.stateWrap.state; }

  ensureTracks() {
    this.state.daw ||= { bpm: 120, durationSteps: 128, tracks: [], blocks: [], selectedId: null };

    const tracks = this.state.daw.tracks || (this.state.daw.tracks = []);
    while (tracks.length < 4) {
      tracks.push({ id: "trk_" + (tracks.length + 1), name: `Track ${tracks.length + 1}` });
    }
  }

  bindUI() {
    this.el.close?.addEventListener("click", () => this.close());

    // If your laptop hotspot opens the overlay, we still want the DAW to render when opened:
    // We rebuild whenever overlay is made visible (cheap)
    const obs = new MutationObserver(() => {
      if (this.el.overlay && !this.el.overlay.classList.contains("hidden")) {
        this.open();
      }
    });
    if (this.el.overlay) obs.observe(this.el.overlay, { attributes: true, attributeFilter: ["class"] });

    this.el.importBtn?.addEventListener("click", () => this.promptImport());
    this.el.dupBtn?.addEventListener("click", () => this.duplicateSelected());
    this.el.delBtn?.addEventListener("click", () => this.deleteSelected());
    this.el.playBtn?.addEventListener("click", () => this.play());
    this.el.stopBtn?.addEventListener("click", () => this.stop());

    this.el.timeline?.addEventListener("dragover", (e) => e.preventDefault());
    this.el.timeline?.addEventListener("drop", (e) => this.onDrop(e));
  }

  bindImportEvent() {
    window.addEventListener("bandscape:importPattern", (e) => {
      const idx = e.detail?.index;
      if (!Number.isInteger(idx)) return;
      this.importPattern(idx, 0);
      this.open();
    });
  }

  open() {
    if (!this.el.timeline) return;

    this.ensureTracks();

    // CRITICAL: ensure timeline has visible height
    const laneCount = this.state.daw.tracks.length;
    this.el.timeline.style.minHeight = `${this.laneHeight * laneCount}px`;

    this.rebuild();
  }

  close() {
    this.stop();
    this.el.overlay?.classList.add("hidden");
  }

  rebuild() {
    if (!this.el.timeline) return;

    this.ensureTracks();

    // Clear (but keep playhead)
    this.el.timeline.querySelectorAll(".daw-lane, .daw-block, .daw-lanelabel").forEach(n => n.remove());

    // Force a wide timeline so blocks show
    const minWidth = Math.max(1400, this.state.daw.durationSteps * this.pxPerStep);
    this.el.timeline.style.minWidth = `${minWidth}px`;

    // Render lanes + labels
    this.state.daw.tracks.forEach((t, i) => {
      const lane = document.createElement("div");
      lane.className = "daw-lane";
      lane.style.position = "absolute";
      lane.style.left = "0";
      lane.style.right = "0";
      lane.style.top = `${i * this.laneHeight}px`;
      lane.style.height = `${this.laneHeight}px`;
      lane.style.borderTop = "1px solid rgba(255,255,255,.08)";
      lane.style.borderBottom = "1px solid rgba(255,255,255,.04)";
      lane.style.pointerEvents = "none";
      this.el.timeline.appendChild(lane);

      const label = document.createElement("div");
      label.className = "daw-lanelabel";
      label.textContent = t.name;
      label.style.position = "sticky";
      label.style.left = "0";
      label.style.top = `${i * this.laneHeight}px`;
      label.style.height = `${this.laneHeight}px`;
      label.style.width = "140px";
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.paddingLeft = "10px";
      label.style.background = "rgba(10,10,18,.55)";
      label.style.borderRight = "1px solid rgba(255,255,255,.08)";
      label.style.pointerEvents = "none";
      this.el.timeline.appendChild(label);
    });

    // Render blocks
    this.state.daw.blocks ||= [];
    this.state.daw.blocks.forEach((b) => {
      const block = document.createElement("div");
      block.className = "daw-block";
      block.dataset.id = b.id;

      block.textContent = b.name || "Clip";
      block.style.position = "absolute";
      block.style.left = `${(b.startStep || 0) * this.pxPerStep + 150}px`; // +150 to clear sticky labels
      block.style.top = `${(b.trackIndex || 0) * this.laneHeight + 12}px`;
      block.style.height = `${this.laneHeight - 24}px`;
      block.style.width = `${Math.max(60, (b.length || 16) * this.pxPerStep)}px`;
      block.style.borderRadius = "12px";
      block.style.padding = "10px";
      block.style.background = "rgba(255,212,0,.16)";
      block.style.border = "1px solid rgba(255,212,0,.35)";
      block.style.cursor = "grab";
      block.style.userSelect = "none";
      block.style.overflow = "hidden";
      block.style.whiteSpace = "nowrap";
      block.style.textOverflow = "ellipsis";

      if (this.state.daw.selectedId === b.id) {
        block.style.outline = "2px solid rgba(127,209,255,.9)";
      }

      block.addEventListener("click", (e) => {
        e.stopPropagation();
        this.state.daw.selectedId = b.id;
        this.rebuild();
      });

      block.draggable = true;
      block.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", b.id);
      });

      this.el.timeline.appendChild(block);
    });

    // Click background clears selection
    this.el.timeline.onclick = () => {
      this.state.daw.selectedId = null;
      this.rebuild();
    };

    this.setPlayhead(this.playStep);
    this.stateWrap.save?.();
  }

  onDrop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const b = this.state.daw.blocks.find(x => x.id === id);
    if (!b) return;

    const rect = this.el.timeline.getBoundingClientRect();
    const x = e.clientX - rect.left - 150; // account for sticky labels
    const y = e.clientY - rect.top;

    b.startStep = Math.max(0, Math.round(x / this.pxPerStep));
    b.trackIndex = Math.max(0, Math.min(this.state.daw.tracks.length - 1, Math.floor(y / this.laneHeight)));

    this.rebuild();
  }

  promptImport() {
    const patterns = this.state.patterns || [];
    if (patterns.length === 0) {
      alert("No patterns yet. Record one in TrackLab first.");
      return;
    }
    const choices = patterns.map((p, i) => `${i}: ${p.name}`).join("\n");
    const pick = parseInt(prompt("Import which pattern?\n" + choices, "0") || "0", 10);
    if (Number.isNaN(pick) || !patterns[pick]) return;

    const trackPick = parseInt(prompt("Which track? (1-4)", "1") || "1", 10);
    const trackIndex = Math.max(0, Math.min(this.state.daw.tracks.length - 1, (trackPick - 1)));

    this.importPattern(pick, trackIndex);
  }

  importPattern(patternIndex, trackIndex = 0) {
    const p = this.state.patterns?.[patternIndex];
    if (!p) return;

    const id = "blk_" + Math.random().toString(36).slice(2);
    this.state.daw.blocks.push({
      id,
      name: p.name,
      patternIndex,
      startStep: 0,
      length: p.length || 32,
      trackIndex
    });

    this.rebuild();
  }

  duplicateSelected() {
    const id = this.state.daw.selectedId;
    if (!id) return;
    const b = this.state.daw.blocks.find(x => x.id === id);
    if (!b) return;

    this.state.daw.blocks.push({
      ...b,
      id: "blk_" + Math.random().toString(36).slice(2),
      startStep: (b.startStep || 0) + 8
    });

    this.rebuild();
  }

  deleteSelected() {
    const id = this.state.daw.selectedId;
    if (!id) return;
    this.state.daw.blocks = this.state.daw.blocks.filter(b => b.id !== id);
    this.state.daw.selectedId = null;
    this.rebuild();
  }

  play() {
    if (this.timer) return;
    const bpm = this.state.daw.bpm || 120;
    const msPerStep = Math.max(30, Math.floor((60000 / bpm) / 4));

    this.timer = setInterval(() => {
      // trigger blocks
      for (const b of this.state.daw.blocks) {
        if ((b.startStep || 0) === this.playStep) {
          const p = this.state.patterns?.[b.patternIndex];
          if (p && this.music?.playCode) {
            // quick play: step through events in pattern with music preview function if you have it
            if (this.music.previewPattern) this.music.previewPattern(p);
          }
        }
      }

      this.playStep++;
      if (this.playStep >= (this.state.daw.durationSteps || 128)) this.playStep = 0;
      this.setPlayhead(this.playStep);
    }, msPerStep);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.playStep = 0;
    this.setPlayhead(0);
  }

  setPlayhead(step) {
    if (!this.el.playhead) return;
    this.el.playhead.style.left = `${150 + (step * this.pxPerStep)}px`;
  }
}