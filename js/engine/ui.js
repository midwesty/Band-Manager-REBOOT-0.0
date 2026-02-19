export class UI {
  constructor() {
    // Core UI elements (match your current HTML ids)
    this.hoverLabel = document.getElementById("hover-label");
    this.phoneBtn = document.getElementById("phone-btn");
    this.phone = document.getElementById("phone");
    this.phoneClose = document.getElementById("phone-close");

    this.appButtons = [...document.querySelectorAll(".app")];
    this.appPanes = {
      stats: document.getElementById("app-stats"),
      inventory: document.getElementById("app-inventory"),
      music: document.getElementById("app-music"),
      calendar: document.getElementById("app-calendar"),
      fileshare: document.getElementById("app-fileshare"),
      bands: document.getElementById("app-bands"),
      contacts: document.getElementById("app-contacts")
    };

    this.statEls = {
      time: document.getElementById("stat-time"),
      health: document.getElementById("stat-health"),
      money: document.getElementById("stat-money"),
      hunger: document.getElementById("stat-hunger"),
      thirst: document.getElementById("stat-thirst"),
      fame: document.getElementById("stat-fame"),
      fans: document.getElementById("stat-fans"),
      ineb: document.getElementById("stat-ineb"),
      buffs: document.getElementById("buff-list")
    };
    this.equippedSlot = document.getElementById("equipped-slot");

    this.invGrid = document.getElementById("player-inv");

    this.contextMenu = document.getElementById("context-menu");

    this.modal = document.getElementById("modal");
    this.modalBody = document.getElementById("modal-body");
    this.modalClose = document.getElementById("modal-close");

    this.death = document.getElementById("death");
    this.deathMsg = document.getElementById("death-msg");
    this.respawn = document.getElementById("respawn");

    this.cheat = document.getElementById("cheat");
    this.cheatInput = document.getElementById("cheat-input");
    this.cheatClose = document.getElementById("cheat-close");
    this.cheatLog = document.getElementById("cheat-log");

    this.keymapPanel = document.getElementById("keymap");
    this.keySelect = document.getElementById("key-select");

    this.tabs = [...document.querySelectorAll("#app-music .tab")];
    this.tabPractice = document.getElementById("tab-practice");
    this.tabRecord = document.getElementById("tab-record");
    this.tabLibrary = document.getElementById("tab-library");

    this.practicePlay = document.getElementById("practice-play");
    this.practiceStop = document.getElementById("practice-stop");
    this.recBpm = document.getElementById("rec-bpm");
    this.recStart = document.getElementById("rec-start");
    this.recStop = document.getElementById("rec-stop");
    this.recClear = document.getElementById("rec-clear");
    this.pianoRoll = document.getElementById("piano-roll");
    this.patternList = document.getElementById("pattern-list");

    this.daw = document.getElementById("daw");
    this.dawTimeline = document.getElementById("daw-timeline");
    this.dawImport = document.getElementById("daw-import");
    this.dawDup = document.getElementById("daw-dup");
    this.dawDel = document.getElementById("daw-del");
    this.dawPlay = document.getElementById("daw-play");
    this.dawStop = document.getElementById("daw-stop");
    this.dawSave = document.getElementById("daw-save");
    this.dawLoad = document.getElementById("daw-load");
    this.dawClose = document.getElementById("daw-close");
    this.playhead = document.getElementById("playhead");

    this.bandmgr = document.getElementById("bandmgr");
    this.bmClose = document.getElementById("bm-close");
    this.bmAdd = document.getElementById("bm-add");
    this.bmDel = document.getElementById("bm-del");
    this.bmSort = document.getElementById("bm-sort");
    this.bmList = document.getElementById("bm-bands");
    this.bmDetail = document.getElementById("bm-detail");
    this.bmListPane = document.getElementById("bm-list");
    this.bmName = document.getElementById("bm-name");
    this.bmAvatars = document.getElementById("bm-avatars");
    this.bmTabs = [...document.querySelectorAll(".bm-tabs button")];
    this.bmTabMembers = document.getElementById("bm-tab-members");
    this.bmTabInstruments = document.getElementById("bm-tab-instruments");
    this.bmTabSongs = document.getElementById("bm-tab-songs");
    this.bmTabBookings = document.getElementById("bm-tab-bookings");
    this.bmBack = document.getElementById("bm-back");
    this.bmRename = document.getElementById("bm-rename");

    this.travel = document.getElementById("travel");
    this.travelClose = document.getElementById("travel-close");
  }

  // --------------------------
  // Phone
  // --------------------------
  bindPhone({ onOpen, onClose }) {
    if (this.phoneBtn) {
      this.phoneBtn.addEventListener("click", () => {
        this.phone?.classList.toggle("hidden");
        if (!this.phone?.classList.contains("hidden")) onOpen?.();
      });
    }
    this.phoneClose?.addEventListener("click", () => {
      this.phone?.classList.add("hidden");
      onClose?.();
    });
  }

  bindPhoneApps(handlers) {
    this.appButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const app = btn.dataset.app;
        handlers[app]?.();
      });
    });
  }

  bindMiscButtons({ openBandMgr }) {
    document.getElementById("open-bandmgr")?.addEventListener("click", openBandMgr);
  }

  openPhoneApp(name) {
    Object.values(this.appPanes).forEach(p => p?.classList.add("hidden"));
    this.appPanes[name]?.classList.remove("hidden");
    if (name !== "music") this.keymapPanel?.classList.add("hidden");
  }

  // --------------------------
  // Modal
  // --------------------------
  bindModalClose() {
    this.modalClose?.addEventListener("click", () => this.hideModal());
  }

  showModal(html) {
    if (!this.modal || !this.modalBody) return;
    this.modalBody.innerHTML = html;
    this.modal.classList.remove("hidden");
  }

  hideModal() {
    this.modal?.classList.add("hidden");
  }

  // --------------------------
  // Context menu
  // --------------------------
  showContext(x, y, items) {
    if (!this.contextMenu) return;
    this.contextMenu.innerHTML = "";
    items.forEach(it => {
      const b = document.createElement("button");
      b.textContent = it.label;
      b.addEventListener("click", () => {
        this.hideContext();
        it.fn?.();
      });
      this.contextMenu.appendChild(b);
    });
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.remove("hidden");

    const hideFn = (ev) => {
      if (!this.contextMenu.contains(ev.target)) {
        this.hideContext();
        document.removeEventListener("mousemove", hideFn);
        document.removeEventListener("click", hideFn);
        document.removeEventListener("contextmenu", hideFn);
      }
    };
    document.addEventListener("mousemove", hideFn);
    document.addEventListener("click", hideFn);
    document.addEventListener("contextmenu", hideFn);
  }

  hideContext() {
    this.contextMenu?.classList.add("hidden");
  }

  // --------------------------
  // Stats render
  // --------------------------
  renderStats(gameState) {
    const s = gameState.state;
    const t = s.time;
    const hh = String(t.hour).padStart(2, "0");
    const mm = String(t.minute).padStart(2, "0");

    this.statEls.time && (this.statEls.time.textContent = `Day ${t.day}, ${hh}:${mm}`);
    this.statEls.health && (this.statEls.health.textContent = s.stats.health);
    this.statEls.money && (this.statEls.money.textContent = `$${Number(s.money).toFixed(2)}`);
    this.statEls.hunger && (this.statEls.hunger.textContent = s.stats.hunger);
    this.statEls.thirst && (this.statEls.thirst.textContent = s.stats.thirst);
    this.statEls.fame && (this.statEls.fame.textContent = s.stats.fame);
    this.statEls.fans && (this.statEls.fans.textContent = s.stats.fans);
    this.statEls.ineb && (this.statEls.ineb.textContent = s.stats.inebriation);

    if (this.equippedSlot) {
      this.equippedSlot.textContent = s.equipped.instrument ? s.equipped.instrument : "None";
    }

    this.renderBuffs(gameState);
  }

  renderBuffs(gameState) {
    if (!this.statEls.buffs) return;
    const s = gameState.state;
    this.statEls.buffs.innerHTML = "";
    for (const b of s.buffs || []) {
      const li = document.createElement("li");
      li.textContent = `${b.name} (ends hr ${b.untilHour})`;
      this.statEls.buffs.appendChild(li);
    }
  }

  // --------------------------
  // Overlay open/close helpers
  // --------------------------
  showOverlay(el) { el?.classList.remove("hidden"); }
  hideOverlay(el) { el?.classList.add("hidden"); }

  bindGlobalEscClose() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      [this.modal, this.daw, this.death, this.cheat, this.bandmgr, this.travel].forEach(el => el?.classList.add("hidden"));
      this.hideContext();
    });
  }

  // --------------------------
  // Death
  // --------------------------
  showDeath(line) {
    this.deathMsg && (this.deathMsg.textContent = line);
    this.death?.classList.remove("hidden");
  }
}
