function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const MAJOR_STEPS = [2,2,1,2,2,2,1];

function rotate(arr, n) { return arr.slice(n).concat(arr.slice(0, n)); }

function majorScale(root) {
  const i = NOTE_ORDER.indexOf(root);
  const chroma = rotate(NOTE_ORDER, i);
  const scale = [chroma[0]];
  let pos = 0;
  for (let s = 0; s < MAJOR_STEPS.length - 1; s++) {
    pos += MAJOR_STEPS[s];
    scale.push(chroma[pos % 12]);
  }
  return scale;
}

function safeNoteCode(n) {
  return "note_" + n.replace("#", "s"); // note_Cs, note_Fs, etc
}

function safeChordCode(n) {
  return "chord_" + n.replace("#", "s"); // chord_Cs etc (files can be mapped later)
}

export class Music {
  constructor({ ui, data, state }) {
    this.ui = ui;
    this.data = data;
    this.state = state;

    this.isPracticing = false;
    this.isRecording = false;
    this.recordTimer = null;
    this.currentStep = 0;
    this.maxSteps = 32;

    this.ROWS = ["E","A","D","G","L1","L2","L3"]; // viz rows only (kept compatible)

    this.currentPattern = this.#blankPattern();

    this.__chords12 = [];
    this.__notes12 = [];
    this.soundToKeyMap = {};

    this.#bindTabs();
    this.#bindPracticeRecordButtons();
    this.#bindKeyboardInput();
    this.initPianoRoll();
  }

  initKeymapUI() {
    this.ui.keySelect?.addEventListener("change", () => {
      this.state.state.music.currentKey = this.ui.keySelect.value;
      this.refreshKeyLabels();
      this.state.save();
    });
  }

  hideKeymap() {
    this.ui.keymapPanel?.classList.add("hidden");
  }

  ensureInstrumentGate() {
    // You can still open TrackLab, but record/practice needs an equipped instrument.
    // We keep this soft to avoid breaking UI flows.
    return true;
  }

  #bindTabs() {
    this.ui.tabs.forEach(t => t.addEventListener("click", () => this.setActiveTab(t.dataset.tab)));
  }

  setActiveTab(tab) {
    this.ui.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    this.ui.tabPractice?.classList.toggle("hidden", tab !== "practice");
    this.ui.tabRecord?.classList.toggle("hidden", tab !== "record");
    this.ui.tabLibrary?.classList.toggle("hidden", tab !== "library");

    if (tab === "practice" || tab === "record") {
      this.ui.keymapPanel?.classList.remove("hidden");
      this.refreshKeyLabels();
    } else {
      this.ui.keymapPanel?.classList.add("hidden");
    }
  }

  #bindPracticeRecordButtons() {
    this.ui.practicePlay?.addEventListener("click", () => { this.isPracticing = true; });
    this.ui.practiceStop?.addEventListener("click", () => { this.isPracticing = false; });

    this.ui.recStart?.addEventListener("click", () => this.startRecording());
    this.ui.recStop?.addEventListener("click", () => this.stopRecording());
    this.ui.recClear?.addEventListener("click", () => { this.currentPattern.events = []; this.drawNotes(); });
  }

  #bindKeyboardInput() {
    document.addEventListener("keydown", (e) => {
      // ignore when cheat console focused
      if (!this.ui.cheat?.classList.contains("hidden") && document.activeElement === this.ui.cheatInput) return;

      const phoneOpen = this.ui.phone && !this.ui.phone.classList.contains("hidden");
      const musicPaneOpen = this.ui.appPanes.music && !this.ui.appPanes.music.classList.contains("hidden");
      const onRecordTab = this.ui.tabRecord && !this.ui.tabRecord.classList.contains("hidden");
      const onPracticeTab = this.ui.tabPractice && !this.ui.tabPractice.classList.contains("hidden");

      if (!(phoneOpen && musicPaneOpen && (onRecordTab || onPracticeTab))) return;

      // Gate: must have equipped instrument
      if (this.state.state.equipped.instrument !== "guitar") {
        // allow Space to stop recording if somehow running
        if (e.code === "Space" && this.isRecording) {
          e.preventDefault();
          this.stopRecording();
        }
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (onRecordTab) this.isRecording ? this.stopRecording() : this.startRecording();
        if (onPracticeTab) this.isPracticing = !this.isPracticing;
        return;
      }

      const key = e.key.toLowerCase();
      const inst = this.data.getInstrument("guitar");
      if (!inst) return;

      const lh = inst.ui?.leftKeys || [];
      const rh = inst.ui?.rightKeys || [];

      if (lh.includes(key)) {
        const i = lh.indexOf(key);
        const chord = this.__chords12[i];
        if (chord) {
          this.playCode("guitar", chord.code);
          if (this.isRecording) {
            this.currentPattern.events.push({ step: this.currentStep, row: "E", t: Date.now(), code: chord.code });
            this.drawNotes();
          }
        }
      } else if (rh.includes(key)) {
        const i = rh.indexOf(key);
        const note = this.__notes12[i];
        if (note) {
          this.playCode("guitar", note.code);
          if (this.isRecording) {
            this.currentPattern.events.push({ step: this.currentStep, row: "L1", t: Date.now(), code: note.code });
            this.drawNotes();
          }
        }
      }
    });

    // Key highlight (visual)
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"]`);
      if (!el) return;
      el.classList.add("hit");
      setTimeout(() => el.classList.remove("hit"), 120);
    });
  }

  initPianoRoll() {
    if (!this.ui.pianoRoll) return;
    this.ui.pianoRoll.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "pr-grid";
    this.ui.pianoRoll.appendChild(grid);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < this.maxSteps; c++) {
        const cell = document.createElement("div");
        cell.className = "pr-cell";
        cell.style.gridRowStart = String(r + 1);
        cell.style.gridColumnStart = String(c + 1);
        grid.appendChild(cell);
      }
    }
  }

  drawNotes() {
    if (!this.ui.pianoRoll) return;
    this.ui.pianoRoll.querySelectorAll(".pr-note").forEach(n => n.remove());
    const grid = this.ui.pianoRoll.querySelector(".pr-grid");
    if (!grid) return;

    for (const ev of this.currentPattern.events) {
      const note = document.createElement("div");
      note.className = "pr-note";
      note.style.gridRowStart = String(this.ROWS.indexOf(ev.row) + 1);
      note.style.gridColumnStart = String(ev.step + 1);
      grid.appendChild(note);
    }
  }

  #blankPattern() {
    return {
      name: "Untitled",
      instrument: "guitar",
      bpm: 120,
      length: this.maxSteps,
      events: [],
      createdAt: Date.now()
    };
  }

  startRecording() {
    if (this.isRecording) return;
    this.isRecording = true;

    const bpm = parseInt(this.ui.recBpm?.value || "120", 10) || 120;
    this.currentPattern = {
      name: "Untitled",
      instrument: "guitar",
      bpm,
      length: this.maxSteps,
      events: [],
      createdAt: Date.now()
    };

    this.currentStep = 0;
    const msPerStep = (60000 / bpm) / 4;

    this.recordTimer = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.maxSteps;
    }, msPerStep);
  }

  stopRecording() {
    if (!this.isRecording) return;
    clearInterval(this.recordTimer);
    this.recordTimer = null;
    this.isRecording = false;

    const name = prompt("Save pattern as:", "Riff_" + Math.floor(Math.random() * 1000));
    if (!name) return;

    this.currentPattern.name = name;
    this.state.state.patterns.push(this.currentPattern);
    this.state.save();
    this.renderLibrary();
  }

  refreshKeyLabels() {
    const root = this.state.state.music.currentKey || "C";
    if (this.ui.keySelect) this.ui.keySelect.value = root;

    const inst = this.data.getInstrument("guitar");
    if (!inst) return;

    const lhKeys = inst.ui?.leftKeys || [];
    const rhKeys = inst.ui?.rightKeys || [];

    const scale = majorScale(root);
    const triads = [
      { name: `${scale[0]}maj`, code: safeChordCode(scale[0]) },
      { name: `${scale[1]}min`, code: safeChordCode(scale[1]) },
      { name: `${scale[2]}min`, code: safeChordCode(scale[2]) },
      { name: `${scale[3]}maj`, code: safeChordCode(scale[3]) },
      { name: `${scale[4]}maj`, code: safeChordCode(scale[4]) },
      { name: `${scale[5]}min`, code: safeChordCode(scale[5]) },
      { name: `${scale[6]}dim`, code: safeChordCode(scale[6]) },
    ];
    const notes = scale.map(n => ({ name: n, code: safeNoteCode(n) }));

    this.__chords12 = Array.from({ length: lhKeys.length }, (_, i) => triads[i % triads.length]);
    this.__notes12 = Array.from({ length: rhKeys.length }, (_, i) => notes[i % notes.length]);

    // labels + soundToKeyMap for highlighting
    this.soundToKeyMap = {};

    lhKeys.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__chords12[i].name;
      this.soundToKeyMap[this.__chords12[i].code] = k;
    });

    rhKeys.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__notes12[i].name;
      this.soundToKeyMap[this.__notes12[i].code] = k;
    });
  }

  // Library UI
  renderLibrary() {
    if (!this.ui.patternList) return;
    const patterns = this.state.state.patterns || [];
    this.ui.patternList.innerHTML = "";

    patterns.forEach((p, idx) => {
      const div = document.createElement("div");
      div.className = "pattern";

      const left = document.createElement("div");
      left.textContent = `${p.name} • ${p.instrument} • ${p.bpm} BPM • ${new Date(p.createdAt).toLocaleString()}`;

      const right = document.createElement("div");
      const bPlay = document.createElement("button");
      bPlay.textContent = "Play";
      bPlay.addEventListener("click", () => this.playPattern(p));

      const bImport = document.createElement("button");
      bImport.textContent = "Import to DAW";
      bImport.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("bandscape:importPattern", { detail: { index: idx } }));
      });

      const bDel = document.createElement("button");
      bDel.textContent = "Delete";
      bDel.addEventListener("click", () => {
        patterns.splice(idx, 1);
        this.state.save();
        this.renderLibrary();
      });

      right.appendChild(bPlay);
      right.appendChild(bImport);
      right.appendChild(bDel);

      div.appendChild(left);
      div.appendChild(right);

      div.addEventListener("dblclick", () => {
        window.dispatchEvent(new CustomEvent("bandscape:importPattern", { detail: { index: idx } }));
      });

      this.ui.patternList.appendChild(div);
    });
  }

  // Playback (safe even if audio missing)
  playPattern(p) {
    const eventsByStep = {};
    for (const ev of p.events) {
      (eventsByStep[ev.step] ||= []).push(ev);
    }

    let step = 0;
    const msPerStep = (60000 / (p.bpm || 120)) / 4;
    const timer = setInterval(() => {
      for (const ev of (eventsByStep[step] || [])) {
        // if event has code, use it; else fallback
        this.playCode("guitar", ev.code || "note_C");
      }
      step = (step + 1) % (p.length || 32);
    }, msPerStep);

    setTimeout(() => clearInterval(timer), msPerStep * (p.length || 32));
  }

  playCode(instrumentId, code) {
    const inst = this.data.getInstrument(instrumentId);
    if (!inst) return;

    // Resolve code -> filename:
    // 1) inst.keymap[code] directly
    // 2) allow "note_C" etc to map to a known file if present
    const file = inst.keymap?.[code] || inst.keymap?.[String(code)] || null;
    if (!file) return;

    const src = (inst.audioFolder || "") + file;

    try { new Audio(src).play(); } catch {}
  }
}
