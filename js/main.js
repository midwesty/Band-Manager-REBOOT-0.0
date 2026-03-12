<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bandscape — Keys & Rooms</title>
  <link rel="stylesheet" href="css/style.css"/>
</head>
<body>
  <div id="game">
    <!-- Background image (set by HTML and/or location JSON) -->
    <img id="room-bg" src="images/ui/room_bg.png" alt="apartment background"/>

    <!-- Hotspots are generated from JSON (data/locations/apartment.json) -->
    <div id="hover-label" style="display:none;">Interact</div>

    <button id="phone-btn" aria-label="Open phone">📱</button>
    <button id="use-btn" class="hidden">Use</button>

    <!-- Keymap (only shown when Phone → TrackLab → Practice/Record) -->
    <div id="keymap" class="hidden">
      <div class="keymap-header">
        <h4>Guitar Controls</h4>
        <label class="select-key">Key:
          <select id="key-select">
            <option>C</option><option>C#</option><option>D</option><option>D#</option>
            <option>E</option><option>F</option><option>F#</option><option>G</option>
            <option>G#</option><option>A</option><option>A#</option><option>B</option>
          </select>
        </label>
      </div>

      <div class="kb">
        <div class="row row1">
          <div data-key="q"><span class="k">q</span><span class="lbl"></span></div>
          <div data-key="w"><span class="k">w</span><span class="lbl"></span></div>
          <div data-key="e"><span class="k">e</span><span class="lbl"></span></div>
          <div data-key="r"><span class="k">r</span><span class="lbl"></span></div>
          <div data-key="u"><span class="k">u</span><span class="lbl"></span></div>
          <div data-key="i"><span class="k">i</span><span class="lbl"></span></div>
          <div data-key="o"><span class="k">o</span><span class="lbl"></span></div>
          <div data-key="p"><span class="k">p</span><span class="lbl"></span></div>
        </div>

        <div class="row row2">
          <div data-key="a"><span class="k">a</span><span class="lbl"></span></div>
          <div data-key="s"><span class="k">s</span><span class="lbl"></span></div>
          <div data-key="d"><span class="k">d</span><span class="lbl"></span></div>
          <div data-key="f"><span class="k">f</span><span class="lbl"></span></div>
          <div data-key="j"><span class="k">j</span><span class="lbl"></span></div>
          <div data-key="k"><span class="k">k</span><span class="lbl"></span></div>
          <div data-key="l"><span class="k">l</span><span class="lbl"></span></div>
          <div data-key=";"><span class="k">;</span><span class="lbl"></span></div>
        </div>

        <div class="row row3">
          <div data-key="z"><span class="k">z</span><span class="lbl"></span></div>
          <div data-key="x"><span class="k">x</span><span class="lbl"></span></div>
          <div data-key="c"><span class="k">c</span><span class="lbl"></span></div>
          <div data-key="v"><span class="k">v</span><span class="lbl"></span></div>
          <div data-key="m"><span class="k">m</span><span class="lbl"></span></div>
          <div data-key=","><span class="k">,</span><span class="lbl"></span></div>
          <div data-key="."><span class="k">.</span><span class="lbl"></span></div>
          <div data-key="/"><span class="k">/</span><span class="lbl"></span></div>
        </div>
      </div>

      <p class="hint">Left = chords • Right = notes • Space toggles practice/record transport.</p>
    </div>

    <!-- Context menu (optional, safe to keep) -->
    <div id="context-menu" class="hidden"></div>

    <!-- PHONE -->
    <div id="phone" class="hidden" role="dialog" aria-label="phone UI">
      <div class="phone-header">
        <div class="status">NO SIGNAL • 1%</div>
        <button id="phone-close" aria-label="Close phone">✕</button>
      </div>

      <div class="app-grid">
        <button class="app" data-app="stats">📊 Stats</button>
        <button class="app" data-app="inventory">🎒 Inventory</button>
        <button class="app" data-app="music">🎵 TrackLab</button>
        <button class="app" data-app="calendar">📅 Calendar</button>
        <button class="app" data-app="fileshare">🌐 FileShareNet</button>
        <button class="app" data-app="bands">💼 Band Manager</button>
        <button class="app" data-app="contacts">📞 Phone</button>
      </div>

      <div class="app-view scrollable">
        <div id="app-stats" class="app-pane hidden scrollable">
          <h3>Player Stats</h3>
          <div class="stats-grid">
            <div><label>Time</label><span id="stat-time">Day 1 — 09:00</span></div>
            <div><label>Health</label><span id="stat-health">100</span></div>
            <div><label>Money</label><span id="stat-money">$25</span></div>
            <div><label>Hunger</label><span id="stat-hunger">80</span></div>
            <div><label>Thirst</label><span id="stat-thirst">80</span></div>
            <div><label>Fame</label><span id="stat-fame">0</span></div>
            <div><label>Fans</label><span id="stat-fans">0</span></div>
            <div><label>Ineb.</label><span id="stat-ineb">0</span></div>
          </div>

          <h4>Buffs / Debuffs</h4>
          <ul id="buff-list" class="scrollable"></ul>

          <h4>Equipped</h4>
          <div id="equipped-slot">Instrument: (none)</div>
        </div>

        <div id="app-inventory" class="app-pane hidden scrollable">
          <h3>Inventory</h3>
          <div class="inv-grid" id="player-inv"></div>
          <p class="hint">Click an item for options • Double-click consumables to quick use.</p>
          <button id="open-bandmgr">Open Band Manager</button>
        </div>

        <div id="app-music" class="app-pane hidden scrollable">
          <h3>🎵 TrackLab</h3>

          <div class="tabs">
            <button class="tab active" data-tab="practice">Practice</button>
            <button class="tab" data-tab="record">Record</button>
            <button class="tab" data-tab="library">Library</button>
          </div>

          <div id="tab-practice" class="tab-body">
            <p>Press keys to play. Space toggles practice mode.</p>
            <div class="controls">
              <button id="practice-play">Start</button>
              <button id="practice-stop">Stop</button>
            </div>
          </div>

          <div id="tab-record" class="tab-body hidden">
            <p>Space starts/stops recording. Notes recorded to a 32-step grid.</p>
            <div class="controls">
              <label>BPM <input id="rec-bpm" type="number" value="120" min="60" max="200"></label>
              <button id="rec-start">Start Recording</button>
              <button id="rec-stop">Stop</button>
              <button id="rec-clear">Clear</button>
            </div>
            <div id="piano-roll"></div>
          </div>

          <div id="tab-library" class="tab-body hidden">
            <p>Saved patterns:</p>
            <div id="pattern-list" class="scrollable"></div>
          </div>
        </div>

        <div id="app-calendar" class="app-pane hidden scrollable">
          <h3>Calendar</h3>
          <p>(Coming soon)</p>
        </div>

        <div id="app-fileshare" class="app-pane hidden scrollable">
          <h3>FileShareNet</h3>
          <p>(Coming later)</p>
        </div>

        <div id="app-bands" class="app-pane hidden scrollable">
          <h3>Band Manager</h3>
          <p>Use the button below to open the full manager overlay.</p>
          <button id="open-bandmgr">Open Band Manager</button>
        </div>

        <div id="app-contacts" class="app-pane hidden scrollable">
          <h3>Contacts</h3>
          <p>(Coming soon)</p>
        </div>
      </div>
    </div>

    <!-- MODAL -->
    <div id="modal" class="hidden" role="dialog" aria-label="modal">
      <div id="modal-content">
        <button id="modal-close" aria-label="Close">✕</button>
        <div id="modal-body"></div>
      </div>
    </div>

    <!-- DAW -->
    <div id="daw" class="hidden" role="dialog" aria-label="DAW">
      <div class="daw-box">
        <div class="daw-header">
          <h3>🎧 Bandscape Studio Lite (Cracked)</h3>
          <div class="daw-controls">
            <button id="daw-import">Import Pattern</button>
            <button id="daw-dup">Duplicate</button>
            <button id="daw-del">Delete</button>
            <button id="daw-play">Play</button>
            <button id="daw-stop">Stop</button>
            <button id="daw-save">Save Project</button>
            <button id="daw-load">Load Project</button>
            <button id="daw-close">✕</button>
          </div>
        </div>
        <div class="daw-timeline" id="daw-timeline">
          <div id="playhead"></div>
        </div>
      </div>
    </div>

    <!-- BAND MANAGER -->
    <div id="bandmgr" class="hidden" role="dialog" aria-label="Band Manager">
      <div class="bm-wrap">
        <div class="bm-header">
          <h3>Band Manager</h3>
          <button id="bm-close">✕</button>
        </div>

        <div class="bm-body">
          <div id="bm-list" class="bm-pane">
            <div class="bm-toolbar">
              <button id="bm-add">+ Add Band</button>
              <button id="bm-del">Delete Selected</button>
              <button id="bm-sort">Sort: Name</button>
            </div>
            <ul id="bm-bands"></ul>
          </div>

          <div id="bm-detail" class="bm-pane hidden">
            <div class="bm-detail-head">
              <h2 id="bm-name">Band Name</h2>
            </div>

            <div class="bm-tabs">
              <button data-tab="members" class="active">Members</button>
              <button data-tab="instruments">Instruments</button>
              <button data-tab="songs">Songs</button>
              <button data-tab="bookings">Bookings</button>
            </div>

            <div class="bm-tabbody">
              <div id="bm-tab-members" class="bm-tab"></div>
              <div id="bm-tab-instruments" class="bm-tab hidden"></div>
              <div id="bm-tab-songs" class="bm-tab hidden"></div>
              <div id="bm-tab-bookings" class="bm-tab hidden"></div>
            </div>

            <div class="bm-detail-actions">
              <button id="bm-rename">Rename Band</button>
              <button id="bm-back">Back</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TRAVEL -->
    <div id="travel" class="hidden" role="dialog" aria-label="Travel">
      <div class="travel-wrap">
        <div class="travel-head">
          <h3>Where to?</h3>
          <button id="travel-close">✕</button>
        </div>
        <div class="travel-body">
          <p>(Travel coming soon.)</p>
        </div>
      </div>
    </div>

  </div>

  <!-- IMPORTANT: must be a module or imports will fail and UI becomes unclickable -->
  <script type="module" src="js/main.js"></script>
</body>
</html>