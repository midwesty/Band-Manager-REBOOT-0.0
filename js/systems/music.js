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

function safeNoteCode(n) { return "note_" + n.replace("#", "s"); }
function safeChordCode(n) { return "chord_" + n.replace("#", "s"); }

export class Music {
  constructor({ state, data }) {
    this.state = state;
    this.data = data || null;

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
    };

    const s = this.state.state;
    s.patterns ||= [];
    s.music ||= { currentKey: "C" };
    s.equipped ||= { instrumentId: null };

    this.isPracticing = false;
    this.isRecording = false;
    this.recordTimer = null;
    this.currentStep = 0;
    this.maxSteps = 32;

    this.ROWS = ["E","A","D","G","L1","L2","L3"];
    this.__chords = [];
    this.__notes = [];
    this.currentPattern = this.blankPattern();
    this.lastTab = "practice";

    this.bindTabs();
    this.bindButtons();
    this.bindKeyboard();
    this.initPianoRoll();
    this.bindKeySelect();

    // IMPORTANT: do NOT open keymap on boot
    this.dom.keymap?.classList.add("hidden");
    this.setActiveTab("library");
    this.refreshKeyLabels();
    this.renderLibrary();

    // Listen for phone app changes
    document.addEventListener("bandscape:phoneAppChanged", (e) => {
      const appId = e.detail?.appId;
      if (appId === "music") {
        // show last tab when user enters music app
        this.setActiveTab(this.lastTab || "practice");
      } else {
        this.dom.keymap?.classList.add("hidden");
      }
    });
  }

  bindTabs() {
    this.dom.tabs.forEach(btn => {
      btn.addEventListener("click", () => this.setActiveTab(btn.dataset.tab));
    });
  }

  setActiveTab(tab) {
    this.lastTab = tab;

    this.dom.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    this.dom.tabPractice?.classList.toggle("hidden", tab !== "practice");
    this.dom.tabRecord?.classList.toggle("hidden", tab !== "record");
    this.dom.tabLibrary?.classList.toggle("hidden", tab !== "library");

    // Only show keymap if phone is open + music app open + tab is practice/record
    const shouldShowKeymap = this.isMusicActive() && (tab === "practice" || tab === "record");
    if (shouldShowKeymap) {
      this.dom.keymap?.classList.remove("hidden");
      this.refreshKeyLabels();
    } else {
      this.dom.keymap?.classList.add("hidden");
    }
  }

  bindButtons() {
    this.dom.practicePlay?.addEventListener("click", () => {
      if (!this.hasGuitarEquipped()) {
        alert("Equip the guitar first.");
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

  isMusicActive() {
    const phoneOpen = this.dom.phone && !this.dom.phone.classList.contains("hidden");
    const musicPaneOpen = this.dom.appMusic && !this.dom.appMusic.classList.contains("hidden");
    return phoneOpen && musicPaneOpen;
  }

  bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (!this.isMusicActive()) return;

      if (e.code === "Space") {
        e.preventDefault();
        const onRecordTab = this.dom.tabRecord && !this.dom.tabRecord.classList.contains("hidden");
        const onPracticeTab = this.dom.tabPractice && !this.dom.tabPractice.classList.contains("hidden");

        if (onRecordTab) this.isRecording ? this.stopRecording() : this.startRecording();
        if (onPracticeTab) {
          if (!this.hasGuitarEquipped()) return;
          this.isPracticing = !this.isPracticing;
        }
        return;
      }

      if (!this.hasGuitarEquipped()) return;

      const key = e.key.toLowerCase();
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
      }

      if (rightHand.includes(key)) {
        const i = rightHand.indexOf(key);
        const note = this.__notes[i % this.__notes.length];
        if (!note) return;
        this.playCode("guitar", note.code);
        if (this.isRecording) {
          this.currentPattern.events.push({ step: this.currentStep, row: "L1", t: Date.now(), code: note.code });
          this.drawNotes();
        }
      }

      const el = document.querySelector(`#keymap [data-key="${CSS.escape(key)}"]`);
      if (el) {
        el.classList.add("hit");
        setTimeout(() => el.classList.remove("hit"), 120);
      }
    });
  }

  hasGuitarEquipped() {
    const s = this.state.state;
    return s?.equipped?.instrumentId === "guitar";
  }

  blankPattern() {
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
    if (!this.hasGuitarEquipped()) {
      alert("Equip the guitar first.");
      return;
    }
    if (this.isRecording) return;

    this.isRecording = true;

    const bpm = parseInt(this.dom.recBpm?.value || "120", 10) || 120;
    this.currentPattern = this.blankPattern();
    this.currentPattern.bpm = bpm;

    this.currentStep = 0;
    clearInterval(this.recordTimer);

    const msPerStep = Math.max(30, Math.floor((60000 / bpm) / 4));
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

    clearInterval(this.recordTimer);
    this.recordTimer = null;

    const name = prompt("Name this pattern:", this.currentPattern.name || "Untitled");
    if (name) this.currentPattern.name = name.trim();

    this.state.state.patterns.push(this.currentPattern);
    this.state.save?.();

    this.renderLibrary();
    this.setActiveTab("library");
  }

  refreshKeyLabels() {
    const key = this.state.state.music.currentKey || "C";
    const scale = majorScale(key);

    const chordRoots = [scale[0], scale[3], scale[4], scale[5], scale[1], scale[2], scale[6]];
    const noteRoots = scale.concat(scale);

    this.__chords = chordRoots.map(n => ({ label: n, code: safeChordCode(n) }));
    this.__notes = noteRoots.map(n => ({ label: n, code: safeNoteCode(n) }));

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

  playCode(instrumentId, code) {
    // Uses instrument JSON if present, fallback to old folder if not.
    const inst = this.data?.instruments?.[instrumentId];
    if (inst && inst.audioFolder && inst.keymap?.[code]) {
      const src = inst.audioFolder + inst.keymap[code];
      try { new Audio(src).play().catch(() => {}); } catch {}
      return;
    }

    // fallback
    const base = "audio/shittyguitar/";
    const src = base + code + ".mp3";
    try { new Audio(src).play().catch(() => {}); } catch {}
  }

  initPianoRoll() {
    const root = this.dom.pianoRoll;
    if (!root) return;

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

  renderLibrary() {
    const list = this.dom.patternList;
    if (!list) return;

    const patterns = this.state.state.patterns || [];
    list.innerHTML = "";

    patterns.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "pattern";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.alignItems = "center";

      const left = document.createElement("div");
      left.innerHTML = `<strong>${escapeHTML(p.name || "Untitled")}</strong><div style="opacity:.8;font-size:12px">${p.instrument || "guitar"} • ${p.bpm || 120} bpm</div>`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";

      const imp = document.createElement("button");
      imp.textContent = "Import to DAW";
      imp.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("bandscape:importPattern", { detail: { index: i } }));
      });

      right.appendChild(imp);
      row.appendChild(left);
      row.appendChild(right);

      list.appendChild(row);
    });
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);
}