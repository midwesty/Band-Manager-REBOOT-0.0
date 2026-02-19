// js/systems/daw.js
// DAW (arrangement) system. DOM-wired (no external UI map required).

import { $ } from "../engine/dom.js";

export class DAW {
  constructor({ state, data, music }) {
    this.state = state;
    this.data = data;
    this.music = music;

    // DOM
    this.dom = {
      overlay: $("#daw"),
      timeline: $("#daw-timeline"),
      playhead: $("#playhead"),

      btnImport: $("#daw-import"),
      btnDuplicate: $("#daw-dup"),
      btnDelete: $("#daw-del"),
      btnPlay: $("#daw-play"),
      btnStop: $("#daw-stop"),
      btnSave: $("#daw-save"),
      btnLoad: $("#daw-load"),
      btnClose: $("#daw-close"),

      patternsList: $("#daw-patterns"),
      importedList: $("#daw-imported"),
    };

    // Layout
    this.PX_PER_STEP = 16;
    this.LANE_H = 72;
    this.LANE_PAD = 8;

    this.playTimer = null;
    this.playStep = 0;

    this.ensureDAWState();
    this.bind();

    // Import bridge (from TrackLab library)
    window.addEventListener("bandscape:importPattern", (e) => {
      const idx = e?.detail?.patternIndex;
      if (typeof idx === "number") {
        this.importPattern(idx);
        this.open();
      }
    });

    // Overlay lifecycle
    window.addEventListener("bandscape:overlayOpened", (e) => {
      if (e?.detail?.id === "daw") this.open();
    });

    window.addEventListener("bandscape:overlayClosed", (e) => {
      if (e?.detail?.id === "daw") this.stop();
    });

    // Initial render (in case DAW is open by default in dev)
    if (this.dom.overlay && !this.dom.overlay.classList.contains("hidden")) {
      this.open();
    }
  }

  ensureDAWState() {
    const s = this.state.state;
    s.daw ||= {};
    s.daw.bpm = Number(s.daw.bpm ?? 120) || 120;
    s.daw.durationSteps = Number(s.daw.durationSteps ?? 128) || 128;
    s.daw.blocks ||= [];
    s.daw.selectedId ||= null;
    s.daw.playing ||= false;

    // At least 4 tracks
    if (!Array.isArray(s.daw.tracks) || s.daw.tracks.length < 4) {
      s.daw.tracks = Array.from({ length: 4 }, (_, i) => ({
        id: `trk_${i + 1}`,
        name: `Track ${i + 1}`,
        instrumentId: null,
      }));
    }

    s.projects ||= [];
  }

  bind() {
    this.dom.btnImport?.addEventListener("click", () => this.promptImport());
    this.dom.btnDuplicate?.addEventListener("click", () => this.duplicateSelected());
    this.dom.btnDelete?.addEventListener("click", () => this.deleteSelected());
    this.dom.btnPlay?.addEventListener("click", () => this.play());
    this.dom.btnStop?.addEventListener("click", () => this.stop());
    this.dom.btnSave?.addEventListener("click", () => this.saveProjectPrompt());
    this.dom.btnLoad?.addEventListener("click", () => this.loadProjectPrompt());

    // Even if overlays.js also closes, this ensures we stop playback.
    this.dom.btnClose?.addEventListener("click", () => this.stop());

    this.bindTimelineDnD();
  }

  bindTimelineDnD() {
    const tl = this.dom.timeline;
    if (!tl) return;

    // Allow dropping blocks
    tl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    tl.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;

      const s = this.state.state;
      this.ensureDAWState();

      const rect = tl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const lane = Math.max(0, Math.min(s.daw.tracks.length - 1, Math.floor(y / this.LANE_H)));
      const startStep = Math.max(0, Math.min(s.daw.durationSteps - 1, Math.floor(x / this.PX_PER_STEP)));

      const b = s.daw.blocks.find((bb) => bb.id === id);
      if (!b) return;
      b.lane = lane;
      b.startStep = startStep;
      this.setSelected(id);
      this.state.save?.();
      this.rebuild();
    });
  }

  // ---------- Open/Close ----------
  open() {
    this.ensureDAWState();
    this.dom.overlay?.classList.remove("hidden");
    this.rebuild();
  }

  // (Close is handled by overlays.js; this is here for completeness.)
  close() {
    this.stop();
    this.dom.overlay?.classList.add("hidden");
  }

  // ---------- Rendering ----------
  rebuild() {
    const tl = this.dom.timeline;
    if (!tl) return;

    this.ensureDAWState();
    const s = this.state.state;

    // Clear existing lane backgrounds + blocks (keep playhead)
    [...tl.querySelectorAll(".daw-lane, .daw-block")].forEach((n) => n.remove());

    // Size timeline
    const lanes = s.daw.tracks.length;
    tl.style.position = "relative";
    tl.style.height = `${lanes * this.LANE_H}px`;
    tl.style.minWidth = `${s.daw.durationSteps * this.PX_PER_STEP + 8}px`;

    // Lane backgrounds + labels
    for (let i = 0; i < lanes; i++) {
      const laneEl = document.createElement("div");
      laneEl.className = "daw-lane";
      laneEl.style.position = "absolute";
      laneEl.style.left = "0";
      laneEl.style.right = "0";
      laneEl.style.top = `${i * this.LANE_H}px`;
      laneEl.style.height = `${this.LANE_H}px`;
      laneEl.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
      laneEl.style.background = i % 2 === 0 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.03)";

      const label = document.createElement("div");
      label.textContent = s.daw.tracks[i]?.name || `Track ${i + 1}`;
      label.style.position = "absolute";
      label.style.left = "8px";
      label.style.top = "8px";
      label.style.fontSize = "12px";
      label.style.opacity = "0.8";
      label.style.pointerEvents = "none";

      laneEl.appendChild(label);
      tl.appendChild(laneEl);
    }

    // Ensure playhead exists and is above lanes
    if (this.dom.playhead) {
      this.dom.playhead.style.pointerEvents = "none";
      this.dom.playhead.style.zIndex = "50";
    }

    // Blocks
    for (const b of s.daw.blocks) {
      const el = document.createElement("div");
      el.className = "daw-block";
      el.dataset.id = b.id;
      el.draggable = true;

      const top = b.lane * this.LANE_H + this.LANE_PAD;
      const height = this.LANE_H - this.LANE_PAD * 2;
      const left = b.startStep * this.PX_PER_STEP;
      const width = Math.max(60, b.length * this.PX_PER_STEP);

      el.style.position = "absolute";
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.borderRadius = "10px";
      el.style.padding = "8px";
      el.style.boxSizing = "border-box";
      el.style.cursor = "grab";
      el.style.userSelect = "none";
      el.style.background = "rgba(50, 130, 255, 0.20)";
      el.style.border = b.id === s.daw.selectedId ? "2px solid rgba(255, 212, 0, 0.85)" : "1px solid rgba(255,255,255,0.15)";
      el.style.color = "#fff";

      const title = document.createElement("div");
      title.textContent = b.name || "Clip";
      title.style.fontWeight = "700";
      title.style.fontSize = "12px";

      const meta = document.createElement("div");
      meta.textContent = `lane ${b.lane + 1} • step ${b.startStep}`;
      meta.style.fontSize = "11px";
      meta.style.opacity = "0.8";
      meta.style.marginTop = "4px";

      el.appendChild(title);
      el.appendChild(meta);

      el.addEventListener("click", () => {
        this.setSelected(b.id);
        this.rebuild();
      });

      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", b.id);
        e.dataTransfer.effectAllowed = "move";
        this.setSelected(b.id);
        // Some browsers want a drag image; we keep default.
      });

      tl.appendChild(el);
    }

    this.renderSidebar();
  }

  renderSidebar() {
    const s = this.state.state;

    // Patterns list (available)
    if (this.dom.patternsList) {
      const patterns = s.patterns || [];
      if (!patterns.length) {
        this.dom.patternsList.innerHTML = `<div class="muted">No patterns yet. Open TrackLab → Record something.</div>`;
      } else {
        this.dom.patternsList.innerHTML = patterns
          .map((p, i) => {
            const name = escapeHtml(p.name || `Pattern ${i + 1}`);
            return `<div class="row"><button class="btn" data-import="${i}">Import</button><span>${name}</span><span class="muted">${p.instrument || "guitar"} • ${p.bpm || 120} bpm</span></div>`;
          })
          .join("");

        this.dom.patternsList.querySelectorAll("[data-import]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.getAttribute("data-import"));
            this.importPattern(idx);
          });
        });
      }
    }

    // Imported blocks list
    if (this.dom.importedList) {
      const blocks = s.daw?.blocks || [];
      if (!blocks.length) {
        this.dom.importedList.innerHTML = `<div class="muted">No clips in the DAW timeline yet.</div>`;
      } else {
        this.dom.importedList.innerHTML = blocks
          .map((b) => {
            const name = escapeHtml(b.name || "Clip");
            const sel = b.id === s.daw.selectedId ? "style=\"outline:2px solid rgba(255,212,0,.85);border-radius:10px;padding:6px\"" : "style=\"padding:6px\"";
            return `<div class="row" ${sel}><button class="btn" data-sel="${b.id}">Select</button><span>${name}</span><span class="muted">lane ${b.lane + 1} • step ${b.startStep}</span></div>`;
          })
          .join("");

        this.dom.importedList.querySelectorAll("[data-sel]").forEach((btn) => {
          btn.addEventListener("click", () => {
            this.setSelected(btn.getAttribute("data-sel"));
            this.rebuild();
          });
        });
      }
    }
  }

  setSelected(id) {
    this.ensureDAWState();
    this.state.state.daw.selectedId = id;
    this.state.save?.();
  }

  // ---------- Import ----------
  importPattern(patternIndex) {
    this.ensureDAWState();
    const s = this.state.state;
    const p = s.patterns?.[patternIndex];
    if (!p) {
      alert("That pattern no longer exists.");
      return;
    }

    // Default to lane 0 at the end of timeline or first free spot
    const lane = 0;
    const nextStart = this.findNextStart(lane);

    s.daw.blocks.push({
      id: `blk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: p.name || "Pattern",
      patternIndex,
      startStep: nextStart,
      length: Number(p.length || 32) || 32,
      lane,
    });

    this.setSelected(s.daw.blocks[s.daw.blocks.length - 1].id);
    this.state.save?.();
    this.rebuild();
  }

  findNextStart(lane) {
    const s = this.state.state;
    const blocks = (s.daw?.blocks || []).filter((b) => b.lane === lane).sort((a, b) => a.startStep - b.startStep);
    let cur = 0;
    for (const b of blocks) {
      if (cur + b.length + 2 <= b.startStep) return cur;
      cur = Math.max(cur, b.startStep + b.length + 2);
    }
    return Math.min(cur, (s.daw?.durationSteps || 128) - 1);
  }

  promptImport() {
    const s = this.state.state;
    const patterns = s.patterns || [];
    if (!patterns.length) {
      alert("No patterns yet. Open TrackLab → Record something first.");
      return;
    }

    const list = patterns.map((p, i) => `${i}: ${p.name || "Untitled"}`).join("\n");
    const raw = prompt(`Import which pattern?\n\n${list}`);
    if (raw == null) return;
    const idx = Number(raw);
    if (!Number.isFinite(idx) || idx < 0 || idx >= patterns.length) {
      alert("Invalid pattern number.");
      return;
    }
    this.importPattern(idx);
  }

  // ---------- Edit actions ----------
  getSelectedBlock() {
    const s = this.state.state;
    const id = s.daw?.selectedId;
    if (!id) return null;
    return s.daw.blocks.find((b) => b.id === id) || null;
  }

  duplicateSelected() {
    this.ensureDAWState();
    const s = this.state.state;
    const b = this.getSelectedBlock();
    if (!b) return;

    const copy = {
      ...b,
      id: `blk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      startStep: Math.min((s.daw.durationSteps || 128) - 1, b.startStep + Math.max(2, Math.floor(b.length / 2))),
    };

    s.daw.blocks.push(copy);
    this.setSelected(copy.id);
    this.state.save?.();
    this.rebuild();
  }

  deleteSelected() {
    this.ensureDAWState();
    const s = this.state.state;
    const id = s.daw.selectedId;
    if (!id) return;
    s.daw.blocks = s.daw.blocks.filter((b) => b.id !== id);
    s.daw.selectedId = null;
    this.state.save?.();
    this.rebuild();
  }

  // ---------- Playback ----------
  play() {
    this.ensureDAWState();
    const s = this.state.state;
    if (s.daw.playing) return;

    const bpm = Number(s.daw.bpm || 120) || 120;
    const msPerStep = (60_000 / bpm) / 4; // 16th notes

    s.daw.playing = true;
    this.playStep = 0;

    this.updatePlayhead();

    this.playTimer = setInterval(() => {
      this.tickPlayback();
      this.playStep++;
      if (this.playStep >= (s.daw.durationSteps || 128)) {
        this.stop();
      }
    }, msPerStep);
  }

  stop() {
    const s = this.state.state;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
    if (s?.daw) s.daw.playing = false;
    this.playStep = 0;
    this.updatePlayhead();
  }

  tickPlayback() {
    const s = this.state.state;
    const blocks = s.daw.blocks || [];

    // When a clip starts at this step, play its pattern
    for (const b of blocks) {
      if (b.startStep === this.playStep) {
        const p = s.patterns?.[b.patternIndex];
        if (p) this.music?.playPattern?.(p);
      }
    }

    this.updatePlayhead();
  }

  updatePlayhead() {
    if (!this.dom.playhead) return;
    this.dom.playhead.style.left = `${this.playStep * this.PX_PER_STEP}px`;
  }

  // ---------- Save/Load ----------
  saveProjectPrompt() {
    this.ensureDAWState();
    const s = this.state.state;
    const name = prompt("Project name:", "Untitled Project");
    if (!name) return;

    const snapshot = {
      bpm: s.daw.bpm,
      durationSteps: s.daw.durationSteps,
      tracks: s.daw.tracks,
      blocks: s.daw.blocks,
    };

    const project = {
      id: `proj_${Date.now()}`,
      name,
      savedAt: Date.now(),
      snapshot,
    };

    s.projects.push(project);
    this.state.save?.();
    alert("Project saved.");
  }

  loadProjectPrompt() {
    this.ensureDAWState();
    const s = this.state.state;
    const projs = s.projects || [];
    if (!projs.length) {
      alert("No saved projects yet.");
      return;
    }

    const list = projs
      .map((p, i) => `${i}: ${p.name}`)
      .join("\n");

    const raw = prompt(`Load which project?\n\n${list}`);
    if (raw == null) return;
    const idx = Number(raw);
    if (!Number.isFinite(idx) || idx < 0 || idx >= projs.length) {
      alert("Invalid project number.");
      return;
    }

    const snap = projs[idx].snapshot;
    s.daw.bpm = Number(snap?.bpm || 120) || 120;
    s.daw.durationSteps = Number(snap?.durationSteps || 128) || 128;
    s.daw.tracks = Array.isArray(snap?.tracks) && snap.tracks.length ? snap.tracks : s.daw.tracks;
    s.daw.blocks = Array.isArray(snap?.blocks) ? snap.blocks : [];
    s.daw.selectedId = null;

    this.state.save?.();
    this.rebuild();
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
