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
    const s = this.state.state; // stateWrap.state (getter)
    s.patterns ||= [];
    s.music ||= { currentKey: "C" };
    s.equipped ||= { instrumentId: null };

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
    const s = this.state?.state || this.state;
    return s?.equipped?.instrumentId === "guitar";
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
    this.currentPattern = this.blankPattern();
    this.currentPattern.bpm = bpm;

    this.currentStep = 0;

    if (this.recordTimer) clearInterval(this.recordTimer);
    const msPerStep = Math.max(30, Math.floor((60_000 / bpm) / 4)); // 16th notes

    this.recordTimer = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.maxSteps;
      this.drawPlayhead();
    }, msPerStep);

    this.drawNotes();
    this.drawPlayhead();
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.recordTimer) clearInterval(this.recordTimer);
    this.recordTimer = null;

    // Name + save
    const name = prompt("Name this pattern:", this.currentPattern.name || "Untitled");
    if (name) this.currentPattern.name = name.trim();

    this.state.state.patterns.push(this.currentPattern);
    this.state.save?.();

    this.renderLibrary();
    this.setActiveTab("library");
  }

  // ---------- Key label generation ----------
  refreshKeyLabels() {
    const key = this.state.state.music.currentKey || "C";
    const scale = majorScale(key); // 7 notes

    // Build chord labels (I, IV, V, vi etc… simplified)
    // We’ll just map chords to scale degrees in a friendly way.
    const chordRoots = [scale[0], scale[3], scale[4], scale[5], scale[1], scale[2], scale[6]];
    const noteRoots = scale.concat(scale.map(n => n)); // enough to fill keys

    this.__chords = chordRoots.map((n) => ({ label: n, code: safeChordCode(n) }));
    this.__notes = noteRoots.map((n) => ({ label: n, code: safeNoteCode(n) }));

    // Update UI labels
    const leftHand = ["q","w","e","r","a","s","d","f","z","x","c","v"];
    const rightHand = ["u","i","o","p","j","k","l",";","m",",",".","/"];

    leftHand.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__chords[i % this.__chords.length]?.label || "";
    });

    rightHand.forEach((k, i) => {
      const el = document.querySelector(`#keymap [data-key="${CSS.escape(k)}"] .lbl`);
      if (el) el.textContent = this.__notes[i % this.__notes.length]?.label || "";
    });
  }

  // ---------- Audio ----------
  playCode(instrumentId, code) {
    // MVP hardcode (later: instrument json)
    const base = "audio/shittyguitar/";
    const src = base + code + ".mp3";

    try {
      const a = new Audio(src);
      a.volume = 0.9;
      a.play().catch(() => {});
    } catch (e) {
      // no crash if missing file
    }
  }

  // ---------- Piano roll ----------
  initPianoRoll() {
    const root = this.dom.pianoRoll;
    if (!root) return;

    // Grid
    root.innerHTML = `
      <div class="pr-grid">
        ${Array.from({ length: this.maxSteps * this.ROWS.length }).map(() => `<div class="pr-cell"></div>`).join("")}
      </div>
      <div class="pr-notes" style="position:absolute;inset:0;pointer-events:none"></div>
      <div class="pr-playhead" style="position:absolute;top:0;bottom:0;width:2px;background:rgba(127,209,255,.8);left:0"></div>
    `;

    this.drawNotes();
    this.drawPlayhead();
  }

  drawNotes() {
    const root = this.dom.pianoRoll;
    if (!root) return;
    const notesLayer = root.querySelector(".pr-notes");
    if (!notesLayer) return;

    notesLayer.innerHTML = "";

    const cellW = root.clientWidth / this.maxSteps;
    const cellH = root.clientHeight / this.ROWS.length;

    for (const ev of this.currentPattern.events) {
      const x = Math.floor(ev.step) * cellW;
      const y = Math.max(0, this.ROWS.indexOf(ev.row)) * cellH;

      const d = document.createElement("div");
      d.className = "pr-note";
      d.style.position = "absolute";
      d.style.left = `${x + 2}px`;
      d.style.top = `${y + 2}px`;
      d.style.width = `${Math.max(8, cellW - 4)}px`;
      d.style.height = `${Math.max(8, cellH - 4)}px`;

      notesLayer.appendChild(d);
    }
  }

  drawPlayhead() {
    const root = this.dom.pianoRoll;
    if (!root) return;
    const ph = root.querySelector(".pr-playhead");
    if (!ph) return;

    const x = (root.clientWidth / this.maxSteps) * this.currentStep;
    ph.style.left = `${x}px`;
  }

  // ---------- Library ----------
  renderLibrary() {
    const list = this.dom.patternList;
    if (!list) return;

    const patterns = this.state.state.patterns || [];
    list.innerHTML = "";

    patterns.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "pattern";

      const left = document.createElement("div");
      left.innerHTML = `<strong>${escapeHTML(p.name || "Untitled")}</strong><div style="opacity:.8;font-size:12px">${p.instrument || "guitar"} • ${p.bpm || 120} bpm</div>`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";

      const play = document.createElement("button");
      play.textContent = "Play";
      play.addEventListener("click", () => this.previewPattern(p));

      const imp = document.createElement("button");
      imp.textContent = "Import to DAW";
      imp.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("bandscape:importPattern", { detail: { index: i } }));
      });

      const del = document.createElement("button");
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        if (!confirm(`Delete pattern "${p.name}"?`)) return;
        patterns.splice(i, 1);
        this.state.save?.();
        this.renderLibrary();
      });

      right.appendChild(play);
      right.appendChild(imp);
      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
  }

  previewPattern(p) {
    if (!p?.events?.length) return;

    // crude preview: step through events in time order
    const bpm = p.bpm || 120;
    const msPerStep = Math.max(30, Math.floor((60_000 / bpm) / 4));
    const events = [...p.events].sort((a, b) => (a.step - b.step));

    let step = 0;
    const t = setInterval(() => {
      events.filter(ev => ev.step === step).forEach(ev => {
        if (ev.code) this.playCode(p.instrument || "guitar", ev.code);
      });
      step++;
      if (step >= (p.length || 32)) clearInterval(t);
    }, msPerStep);
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);
}
