// js/systems/music.js
// TrackLab / Music system - DOM-wired (does not rely on external ui mapping)
// Designed to be data-driven later (JSON instruments), but works now with your current folder:
// audio/shittyguitar/chord_A.mp3 chord_D.mp3 chord_E.mp3 chord_G.mp3 note_1.mp3 note_2.mp3 note_3.mp3

const NOTE_ORDER = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const MAJOR_STEPS = [2,2,1,2,2,2,1];

function rotate(arr, n) { return arr.slice(n).concat(arr.slice(0, n)); }

function majorScale(root) {
  const i = NOTE_ORDER.indexOf(root);
  const chroma = rotate(NOTE_ORDER, Math.max(0, i));
  const scale = [chroma[0]];
  let pos = 0;
  for (let s = 0; s < MAJOR_STEPS.length - 1; s++) {
    pos += MAJOR_STEPS[s];
    scale.push(chroma[pos % 12]);
  }
  return scale;
}

function safeNoteCode(n) { return "note_" + n.replace("#", "s"); }   // note_Cs
function safeChordCode(n) { return "chord_" + n.replace("#", "s"); } // chord_Cs

export class Music {
  constructor({ state, data }) {
    this.state = state;
    this.data = data || null;

    // --- DOM (from your current index.html) ---
    this.dom = {
      phone: document.getElementById("phone"),
      keymap: document.getElementById("keymap"),
      keySelect: document.getElementById("key-select"),

      appMusic: document.getElementById("app-music"),

      tabs: Array.from(document.querySelectorAll("#app-music .tab[data-tab]")),
      tabPractice: document.getElementById("tab-practice"),
      tabRecord: document.getElementById("tab-record"),
      tabLibrary: document.getElementById("tab-library"),

      practicePlay: document.getElementById("practice-play"),
      practiceStop: document.getElementById("practice-stop"),

      recBpm: document.getElementById("rec-bpm"),
      recStart: document.getElementById("rec-start"),
      recStop: document.getElementById("rec-stop"),
      recClear: document.getElementById("rec-clear"),
      pianoRoll: document.getElementById("piano-roll"),

      patternList: document.getElementById("pattern-list"),

      cheat: document.getElementById("cheat"),
      cheatInput: document.getElementById("cheat-input"),
    };

    // --- State defaults ---
    const s = this.state.state;
    s.patterns ||= [];
    s.music ||= { currentKey: "C" };
    s.equipped ||= { instrument: null };

    // --- Recording / pattern state ---
    this.isPracticing = false;
    this.isRecording = false;
    this.recordTimer = null;
    this.currentStep = 0;
    this.maxSteps = 32;

    // Piano roll visual rows (compatible with your old layout)
    this.ROWS = ["E","A","D","G","L1","L2","L3"];

    // Generated labels + mapping
    this.__chords = [];
    this.__notes = [];

    // Current pattern being recorded/edited
    this.currentPattern = this.blankPattern();

    // --- Bind UI ---
    this.bindTabs();
    this.bindButtons();
    this.bindKeyboard();
    this.initPianoRoll();
    this.bindKeySelect();

    // Initial display
    this.setActiveTab("practice");
    this.refreshKeyLabels();
    this.renderLibrary();
  }

  // ---------- UI binding ----------
  bindTabs() {
    this.dom.tabs.forEach((btn) => {
      btn.addEventListener("click", () => this.setActiveTab(btn.dataset.tab));
    });
  }

  setActiveTab(tab) {
    this.dom.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    this.dom.tabPractice?.classList.toggle("hidden", tab !== "practice");
    this.dom.tabRecord?.classList.toggle("hidden", tab !== "record");
    this.dom.tabLibrary?.classList.toggle("hidden", tab !== "library");

    // Show keymap when music tabs are practice/record
    if (tab === "practice" || tab === "record") {
      this.dom.keymap?.classList.remove("hidden");
      this.refreshKeyLabels();
    } else {
      this.dom.keymap?.classList.add("hidden");
    }
  }

  bindButtons() {
    this.dom.practicePlay?.addEventListener("click", () => {
      if (!this.hasGuitarEquipped()) {
        alert("Equip the guitar first (get it from the Guitar hotspot, then equip from inventory).");
        return;
      }
      this.isPracticing = true;
    });

    this.dom.practiceStop?.addEventListener("click", () => {
      this.isPracticing = false;
    });

    this.dom.recStart?.addEventListener("click", () => this.startRecording());
    this.dom.recStop?.addEventListener("click", () => this.stopRecording());
    this.dom.recClear?.addEventListener("click", () => {
      this.currentPattern.events = [];
      this.drawNotes();
    });
  }

  bindKeySelect() {
    this.dom.keySelect?.addEventListener("change", () => {
      this.state.state.music.currentKey = this.dom.keySelect.value;
      this.refreshKeyLabels();
      this.state.save?.();
    });
  }

  // Only accept keys when phone is open + music app pane visible
  isMusicActive() {
    const phoneOpen = this.dom.phone && !this.dom.phone.classList.contains("hidden");
    const musicPaneOpen = this.dom.appMusic && !this.dom.appMusic.classList.contains("hidden");
    return phoneOpen && musicPaneOpen;
  }

  bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      // Ignore if cheat console focused
      if (this.dom.cheat && !this.dom.cheat.classList.contains("hidden") && document.activeElement === this.dom.cheatInput) {
        return;
      }

      if (!this.isMusicActive()) return;

      // Space toggles practice/record
      if (e.code === "Space") {
        e.preventDefault();
        const onRecordTab = this.dom.tabRecord && !this.dom.tabRecord.classList.contains("hidden");
        const onPracticeTab = this.dom.tabPractice && !this.dom.tabPractice.classList.contains("hidden");

        if (onRecordTab) {
          this.isRecording ? this.stopRecording() : this.startRecording();
        } else if (onPracticeTab) {
          if (!this.hasGuitarEquipped()) return;
          this.isPracticing = !this.isPracticing;
        }
        return;
      }

      // Gate: must be equipped for practice/record
      if (!this.hasGuitarEquipped()) return;

      // Ignore typing in inputs
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

      const key = e.key.toLowerCase();

      // Determine whether this key is left-hand chord or right-hand note
      // Based on your keyboard map UI shape:
      const leftHand = ["q","w","e","r","a","s","d","f","z","x","c","v"];
      const rightHand = ["u","i","o","p","j","k","l",";","m",",",".","/"];

      if (leftHand.includes(key)) {
        const i = leftHand.indexOf(key);
        const chord = this.__chords[i % this.__chords.length];
        if (!chord) return;

        this.playCode("guitar", chord.code);

        if (this.isRecording) {
          this.currentPattern.events.push({ step: this.currentStep, row: "E", t: Date.now(), code: chord.code });
          this.drawNotes();
        }
      } else if (rightHand.includes(key)) {
        const i = rightHand.indexOf(key);
        const note = this.__notes[i % this.__notes.length];
        if (!note) return;

        this.playCode("guitar", note.code);

        if (this.isRecording) {
          this.currentPattern.events.push({ step: this.currentStep, row: "L1", t: Date.now(), code: note.code });
          this.drawNotes();
        }
      }

      // Visual highlight on keymap
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(key)}"]`);
      if (el) {
        el.classList.add("hit");
        setTimeout(() => el.classList.remove("hit"), 120);
      }
    });
  }

  // ---------- Core ----------
  hasGuitarEquipped() {
    return this.state.state.equipped?.instrument === "guitar";
  }

  blankPattern() {
    return {
      name: "Untitled",
      instrument: "guitar",
      bpm: 120,
      length: this.maxSteps,
      events: [],
      createdAt: Date.now(),
    };
  }

  startRecording() {
    if (!this.hasGuitarEquipped()) {
      alert("Equip the guitar first (get it from the Guitar hotspot, then equip from inventory).");
      return;
    }
    if (this.isRecording) return;

    this.isRecording = true;

    const bpm = parseInt(this.dom.recBpm?.value || "120", 10) || 120;
    this.currentPattern = {
      name: "Untitled",
      instrument: "guitar",
      bpm,
      length: this.maxSteps,
      events: [],
      createdAt: Date.now(),
    };

    this.currentStep = 0;
    const msPerStep = (60000 / bpm) / 4; // 16th notes

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

    this.currentPattern.name = name.trim();
    this.state.state.patterns.push(this.currentPattern);
    this.state.save?.();

    this.renderLibrary();
    this.setActiveTab("library");
  }

  // ---------- Piano Roll ----------
  initPianoRoll() {
    if (!this.dom.pianoRoll) return;

    this.dom.pianoRoll.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "pr-grid";
    this.dom.pianoRoll.appendChild(grid);

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
    if (!this.dom.pianoRoll) return;

    this.dom.pianoRoll.querySelectorAll(".pr-note").forEach((n) => n.remove());
    const grid = this.dom.pianoRoll.querySelector(".pr-grid");
    if (!grid) return;

    for (const ev of this.currentPattern.events) {
      const rowIndex = Math.max(0, this.ROWS.indexOf(ev.row));
      const note = document.createElement("div");
      note.className = "pr-note";
      note.style.gridRowStart = String(rowIndex + 1);
      note.style.gridColumnStart = String(ev.step + 1);
      grid.appendChild(note);
    }
  }

  // ---------- Key labels + mapping ----------
  refreshKeyLabels() {
    const root = this.state.state.music.currentKey || "C";
    if (this.dom.keySelect) this.dom.keySelect.value = root;

    // Make a major scale, then:
    // Left-hand shows triads (7 repeating)
    // Right-hand shows notes (7 repeating)
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

    const notes = scale.map((n) => ({ name: n, code: safeNoteCode(n) }));

    // 12 keys on each side
    this.__chords = Array.from({ length: 12 }, (_, i) => triads[i % triads.length]);
    this.__notes = Array.from({ length: 12 }, (_, i) => notes[i % notes.length]);

    // Write labels into the visual keymap
    const leftHand = ["q","w","e","r","a","s","d","f","z","x","c","v"];
    const rightHand = ["u","i","o","p","j","k","l",";","m",",",".","/"];

    leftHand.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__chords[i].name;
    });

    rightHand.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__notes[i].name;
    });
  }

  // ---------- Library ----------
  renderLibrary() {
    if (!this.dom.patternList) return;

    const patterns = this.state.state.patterns || [];
    this.dom.patternList.innerHTML = "";

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
        this.state.save?.();
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

      this.dom.patternList.appendChild(div);
    });
  }

  // ---------- Playback ----------
  playPattern(p) {
    const eventsByStep = {};
    for (const ev of p.events) (eventsByStep[ev.step] ||= []).push(ev);

    let step = 0;
    const msPerStep = (60000 / (p.bpm || 120)) / 4;
    const timer = setInterval(() => {
      for (const ev of (eventsByStep[step] || [])) {
        this.playCode("guitar", ev.code || "note_C");
      }
      step = (step + 1) % (p.length || 32);
    }, msPerStep);

    setTimeout(() => clearInterval(timer), msPerStep * (p.length || 32));
  }

  // ---------- Audio resolution ----------
  // This is intentionally robust NOW and becomes data-driven later.
  playCode(instrumentId, code) {
    // 1) If you have data.getInstrument(keymap) later, use it.
    const inst = this.data?.getInstrument?.(instrumentId) || null;

    // Preferred: inst.keymap[code] -> filename
    let file = inst?.keymap?.[code] || inst?.keymap?.[String(code)] || null;
    let folder = inst?.audioFolder || "audio/shittyguitar/";

    // 2) Fallback mapping to your REAL files:
    // chords: we only have A/D/E/G → approximate based on chord letter
    if (!file && String(code).startsWith("chord_")) {
      const letter = String(code).replace("chord_", "").toUpperCase();
      if (letter.startsWith("A")) file = "chord_A.mp3";
      else if (letter.startsWith("D")) file = "chord_D.mp3";
      else if (letter.startsWith("E")) file = "chord_E.mp3";
      else if (letter.startsWith("G")) file = "chord_G.mp3";
      else file = "chord_G.mp3"; // safe default
    }

    // notes: we only have note_1/2/3 → cycle them
    if (!file && String(code).startsWith("note_")) {
      // deterministic-ish mapping using char codes
      const n = String(code);
      const sum = n.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
      const pick = (sum % 3) + 1;
      file = `note_${pick}.mp3`;
    }

    if (!file) return;

    const src = folder + file;

    try {
      const a = new Audio(src);
      a.volume = 0.95;
      a.play().catch(() => {});
    } catch {
      // no crash if audio fails
    }
  }
}
