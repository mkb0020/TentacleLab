// updated 3.20.25 @ 7:30PM
// ui.js 


// ── SLIDER PARAM DEFINITIONS ─────────────────────────────────────────────────
const PARAMS = [
  // STRUCTURE
  { key: 'TENTACLE_COUNT',              label: 'Tentacle QTY',           min: 1,    max: 8,    step: 1,    rebuild: true },
  { key: 'TENTACLE_SEGMENTS',           label: 'Segments',        min: 2,    max: 14,   step: 1,    rebuild: true },
  { key: 'TENTACLE_SEGMENT_LENGTH',     label: 'Seg Length',      min: 3,    max: 70,   step: 0.5,  live: 'segLen' },
  { key: 'TENTACLE_BASE_WIDTH',         label: 'Base Width',      min: 2,    max: 50,   step: 0.5,  live: 'baseWidth' },
  // MOTION
  { key: 'TENTACLE_CURL_STRENGTH',      label: 'Curl Strength',   min: 0,    max: 2.0,  step: 0.01, live: 'curlStr' },
  { key: 'TENTACLE_MAX_BEND',           label: 'Max Bend (°)',    min: 10,   max: 180,  step: 1,    special: 'maxBend' },
  { key: 'TENTACLE_ANCHOR_SWAY',        label: 'Anchor Sway',     min: 0,    max: 30,   step: 0.5,  live: 'anchorSway' },
  // ANCHORING
  { key: 'TENTACLE_ANCHOR_RADIUS',      label: 'Anchor Radius',   min: 0,    max: 100,  step: 0.5,  live: 'anchorRad' },
  { key: 'TENTACLE_ANCHOR_Y_OFFSET',    label: 'Anchor Y Offset', min: -30,  max: 80,   step: 0.5,  live: 'anchorYOff' },
  // TIP PHYSICS
  { key: 'TENTACLE_TIP_GRAVITY',        label: 'Tip Gravity',     min: 0,    max: 250,  step: 1,    live: 'tipGravity' },
  { key: 'TENTACLE_TIP_STIFFNESS',      label: 'Tip Stiffness',   min: 1,    max: 25,   step: 0.5,  live: 'tipStiffness' },
  { key: 'TENTACLE_TIP_DRAG',           label: 'Tip Drag',        min: 0.70, max: 0.99, step: 0.01, live: 'tipDrag' },
  { key: 'TENTACLE_TIP_BIAS',           label: 'Tip Bias',        min: 0,    max: 150,  step: 1,    special: 'tipBias' },
  // REPULSION
  { key: 'TENTACLE_TIP_REPEL_RADIUS',   label: 'Tip Repel Rad',   min: 10,   max: 150,  step: 1,    live: 'tipRepelRad' },
  { key: 'TENTACLE_TIP_REPEL_STRENGTH', label: 'Tip Repel Str',   min: 50,   max: 1000, step: 5,    live: 'tipRepelStr' },
  { key: 'TENTACLE_REPEL_RADIUS',       label: 'Body Repel Rad',  min: 5,    max: 150,  step: 1,    live: 'repelRadius' },
  { key: 'TENTACLE_REPEL_STRENGTH',     label: 'Body Repel Str',  min: 50,   max: 1000, step: 5,    live: 'repelStr' },
  // VISUAL
  { key: 'SIZE',                        label: 'Head Size',       min: 30,   max: 200,  step: 1,    visual: true },
];

const SECTION_BEFORE = {
  TENTACLE_CURL_STRENGTH:    '── MOTION ──',
  TENTACLE_ANCHOR_RADIUS:    '── ANCHORING ──',
  TENTACLE_TIP_GRAVITY:      '── TIP PHYSICS ──',
  TENTACLE_TIP_REPEL_RADIUS: '── REPULSION ──',
  SIZE:                      '── VISUAL ──',
};

export class TentacleLabUI {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {object}            opts.cfg       
   * @param {object}            opts.defaults  
   * @param {{ current: import('./tentacles.js').TentacleSystem }} opts.systemRef
   * @param {() => void}        opts.onRebuild 
   * @param {(img: HTMLImageElement) => void} opts.onHeadLoad
   * @param {import('./audio.js').AudioSystem} opts.audio
   */
  constructor({ canvas, cfg, defaults, systemRef, onRebuild, onHeadLoad, audio }) {
    this._canvas     = canvas;
    this._cfg        = cfg;
    this._defaults   = defaults;
    this._systemRef  = systemRef;
    this._onRebuild  = onRebuild;
    this._onHeadLoad = onHeadLoad;
    this._audio      = audio;

    this._panel   = null;
    this._toast   = null;
    this._sliders = {};   // KEY → { input, valueEl, param }
  }

  build() {
    this._buildPanel();
  }

  destroy() {
    this._panel?.remove();
    this._toast?.remove();
  }

  _injectStyles() {
    // NO -OP: STYLES ARE NOW IN js/assets/css/styles.css
  }

  _buildPanel() {
    let leftPanel = document.getElementById('tlab-left-panel');
    if (!leftPanel) {
      leftPanel = document.createElement('div');
      leftPanel.id = 'tlab-left-panel';
      leftPanel.innerHTML = `
        <div id="tlab-left-header">
          <button id="tlab-toggle-right" title="Toggle right panel">»</button>
        </div>
        <div id="tlab-left-content">
          <div id="tlab-audio-row">
            <button id="tlab-mute-btn" title="Toggle ambient audio"></button>
            <span id="tlab-vol-label">VOL</span>
            <input id="tlab-vol-slider" type="range" min="0" max="1" step="0.02" value="${this._audio._volume}">
          </div>
          <div id="tlab-colors"></div>
          <div id="tlab-buttons">
            <button class="tlab-btn rand" id="tlab-rand-btn">Surprise Config!</button>
            <button class="tlab-btn copy" id="tlab-copy-btn">Copy Config</button>
            <button class="tlab-btn" id="tlab-reset-btn">Reset</button>
            <button class="tlab-btn load" id="tlab-load-btn">Load New Head</button>
          </div>
        </div>
        <input type="file" id="tlab-file-input" accept="image/*">
      `;
      document.body.appendChild(leftPanel);
    }

    let panel = document.getElementById('tlab-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tlab-panel';
      panel.innerHTML = `
        <div id="tlab-header">
          <button id="tlab-toggle-left" title="Toggle left panel">«</button>
        </div>
        <div id="tlab-sliders"></div>
        <div id="tlab-footer"></div>
      `;
      document.body.appendChild(panel);
    }

    this._panel = panel;
    this._leftPanel = leftPanel;

    let toast = document.getElementById('tlab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tlab-toast';
      document.body.appendChild(toast);
    }
    this._toast = toast;

    const initialVolSlider = leftPanel.querySelector('#tlab-vol-slider');
    if (initialVolSlider) {
      initialVolSlider.value = String(this._audio._volume ?? 0.5);
    }

    this._buildSliders();

    // ── AUDIO CONTROLS ────────────────────────────────────────────────────
    const muteBtn = leftPanel.querySelector('#tlab-mute-btn');
    const volSlider = leftPanel.querySelector('#tlab-vol-slider');

    muteBtn.addEventListener('click', () => {
      this._audio.ensureInit();
      const nowMuted = !this._audio.muted;
      this._audio.setMuted(nowMuted);
      muteBtn.classList.toggle('muted', nowMuted);
    });

    volSlider.addEventListener('input', () => {
      this._audio.ensureInit();
      this._audio.setVolume(parseFloat(volSlider.value));
    });

    // ── ACTION BUTTONS ────────────────────────────────────────────────────
    leftPanel.querySelector('#tlab-rand-btn').addEventListener('click', () => {
      this._randomize();
    });

    leftPanel.querySelector('#tlab-copy-btn').addEventListener('click', () => {
      this._copyConfig();
    });

    leftPanel.querySelector('#tlab-reset-btn').addEventListener('click', () => {
      this._resetDefaults();
      this._showToast('↩ Reset to defaults');
    });

    // ── LOAD HEAD ─────────────────────────────────────────────────────────
    const fileInput = leftPanel.querySelector('#tlab-file-input');
    leftPanel.querySelector('#tlab-load-btn').addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { this._onHeadLoad(img); this._showToast('✔ Custom head loaded!'); };
      img.onerror = () => this._showToast('✘ Could not load image');
      img.src = url;
    });

    // ── TOGGLE BUTTONS ────────────────────────────────────────────────────
    // External small handles, outside of panel so hidden panels can be reopened.
    let openLeftBtn = document.getElementById('tlab-open-left');
    if (!openLeftBtn) {
      openLeftBtn = document.createElement('button');
      openLeftBtn.id = 'tlab-open-left';
      openLeftBtn.title = 'Show left panel';
      openLeftBtn.textContent = '»';
      document.body.appendChild(openLeftBtn);
    }

    let openRightBtn = document.getElementById('tlab-open-right');
    if (!openRightBtn) {
      openRightBtn = document.createElement('button');
      openRightBtn.id = 'tlab-open-right';
      openRightBtn.title = 'Show right panel';
      openRightBtn.textContent = '«';
      document.body.appendChild(openRightBtn);
    }

    const updateToggleButtons = () => {
      openLeftBtn.style.display = leftPanel.classList.contains('hidden') ? 'block' : 'none';
      openRightBtn.style.display = panel.classList.contains('hidden') ? 'block' : 'none';
    };

    leftPanel.querySelector('#tlab-toggle-right').addEventListener('click', () => {
      leftPanel.classList.toggle('hidden');
      updateToggleButtons();
    });

    panel.querySelector('#tlab-toggle-left').addEventListener('click', () => {
      panel.classList.toggle('hidden');
      updateToggleButtons();
    });

    openLeftBtn.addEventListener('click', () => {
      leftPanel.classList.remove('hidden');
      updateToggleButtons();
    });

    openRightBtn.addEventListener('click', () => {
      panel.classList.remove('hidden');
      updateToggleButtons();
    });

    updateToggleButtons();
  }

  // ── SLIDERS ───────────────────────────────────────────────────────────────
  _buildSliders() {
    const container = this._panel.querySelector('#tlab-sliders');
    container.innerHTML = '';
    this._sliders = {};

    const colorsContainer = this._leftPanel.querySelector('#tlab-colors');
    colorsContainer.innerHTML = '';

    for (const param of PARAMS) {
      // Section dividers
      if (SECTION_BEFORE[param.key]) {
        const sec = document.createElement('div');
        sec.className   = 'tlab-section';
        sec.textContent = SECTION_BEFORE[param.key];
        container.appendChild(sec);
      }

      // Color pickers right after the VISUAL section header
      if (param.key === 'SIZE') {
        this._buildColorRow(colorsContainer, 'Spline Color', 'SPLINE_COLOR');
        this._buildColorRow(colorsContainer, 'Glow Color',   'GLOW_COLOR');
      }

      let rawVal = this._cfg[param.key];
      if (param.special === 'maxBend') rawVal = Math.round((rawVal ?? Math.PI) * (180 / Math.PI));
      if (rawVal === undefined) rawVal = param.min;

      const row = document.createElement('div');
      row.className = 'tlab-row';
      row.innerHTML = `
        <label>${param.label}</label>
        <input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${rawVal}">
        <span class="tlab-val">${this._fmt(rawVal, param)}</span>
      `;
      container.appendChild(row);

      const input   = row.querySelector('input');
      const valueEl = row.querySelector('.tlab-val');
      this._sliders[param.key] = { input, valueEl, param };

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valueEl.textContent = this._fmt(v, param);
        this._applyParam(param, v);
        this._audio.playSquish();
      });
    }
  }

  _buildColorRow(container, label, cfgKey) {
    const row = document.createElement('div');
    row.className = 'tlab-color-row';
    row.innerHTML = `<label>${label}</label><input type="color" value="${this._cfg[cfgKey]}">`;
    container.appendChild(row);

    const picker = row.querySelector('input');
    picker.addEventListener('input', () => {
      this._cfg[cfgKey] = picker.value;
      // LIVE - TentacleSyste.draw() READS FROM CFG EACH FRAME- NO REBUILD NEEDED
    });

    // STORE REFERENCES FOR SYNC DURING RESET  RANDOMIZE 
    if (!this._colorPickers) this._colorPickers = {};
    this._colorPickers[cfgKey] = picker;
  }

  _syncSlidersToConfig() {
    for (const [key, { input, valueEl, param }] of Object.entries(this._sliders)) {
      let v = this._cfg[key];
      if (param.special === 'maxBend') v = Math.round((v ?? Math.PI) * (180 / Math.PI));
      if (v === undefined) v = param.min;
      input.value = v;
      valueEl.textContent = this._fmt(v, param);
    }
    // SYNC COLOR PICKERS
    if (this._colorPickers) {
      for (const [key, picker] of Object.entries(this._colorPickers)) {
        picker.value = this._cfg[key];
      }
    }
  }

  _fmt(v, param) {
    if (param.step >= 1)   return Math.round(v).toString();
    if (param.step >= 0.1) return v.toFixed(1);
    return v.toFixed(2);
  }

  // ── APPLY SINGLE PARAM ────────────────────────────────────────────────────
  _applyParam(param, value) {
    const cfg    = this._cfg;
    const system = this._systemRef.current;

    // ── MAX BEND —SLIDER IN DEGREES - CONFIG IN RADIANS  ──────────────────
    if (param.special === 'maxBend') {
      const rad = value * (Math.PI / 180);
      cfg.TENTACLE_MAX_BEND = rad;
      if (system) for (const t of system.tentacles) t.maxBend = rad;
      return;
    }

    // ── TIP BIAS — FANS  PER TENTACLES  ───────────────────────────────
    if (param.special === 'tipBias') {
      cfg.TENTACLE_TIP_BIAS = value;
      if (system) {
        const n = system.tentacles.length;
        system.tentacles.forEach((t, i) => {
          if      (i === 0)     { t.tipBiasX =  value; t.tipBiasY = 0; }
          else if (i === n - 1) { t.tipBiasX = -value; t.tipBiasY = 0; }
          else                  { t.tipBiasX = 0;      t.tipBiasY = value; }
        });
      }
      return;
    }

    // WRITE TO CONFIG
    cfg[param.key] = value;

    // Structural change — full rebuild required (Float32Arrays reallocated)
    if (param.rebuild) {
      this._onRebuild();
      return;
    }

    // Visual only — no tentacle hot-patch needed (draw() reads cfg directly)
    if (param.visual) return;

    // Scalar live patch — hot-update running tentacle instances
    if (param.live && system) {
      for (const t of system.tentacles) t[param.live] = value;
    }
  }

  // ── RANDOMIZE ─────────────────────────────────────────────────────────────
  _randomize() {
    this._audio.ensureInit();
    this._audio.playSquish(performance.now() - 9999); // force past throttle

    for (const param of PARAMS) {
      // Keep structural params reasonable so it doesn't look broken
      const min = param.key === 'TENTACLE_COUNT'    ? 1
                : param.key === 'TENTACLE_SEGMENTS'  ? 3
                : param.min;
      const max = param.key === 'TENTACLE_COUNT'    ? 6
                : param.key === 'TENTACLE_SEGMENTS'  ? 10
                : param.max;

      let v = min + Math.random() * (max - min);
      // Snap to step
      v = Math.round(v / param.step) * param.step;
      v = Math.max(param.min, Math.min(param.max, v));

      this._cfg[param.key] = param.special === 'maxBend'
        ? (v * Math.PI / 180)
        : v;
    }

    // Random neon colors
    const hue1 = Math.floor(Math.random() * 360);
    const hue2 = (hue1 + 30 + Math.floor(Math.random() * 60)) % 360;
    this._cfg.SPLINE_COLOR = `hsl(${hue1}, 90%, 55%)`;
    this._cfg.GLOW_COLOR   = `hsl(${hue2}, 100%, 70%)`;

    this._syncSlidersToConfig();
    this._onRebuild();
    this._showToast('🎲 Randomized!');
  }

  // ── RESET DEFAULTS ────────────────────────────────────────────────────────
  _resetDefaults() {
    Object.assign(this._cfg, this._defaults);
    this._syncSlidersToConfig();
    this._onRebuild();
  }

  // ── COPY CONFIG ───────────────────────────────────────────────────────────
  _copyConfig() {
    const cfg   = this._cfg;
    const lines = PARAMS.map(p => {
      const val = cfg[p.key];
      if (val === undefined) return null;

      let valStr;
      if (p.special === 'maxBend') {
        valStr = this._nicePI(val / Math.PI);
        const deg = Math.round(val * 180 / Math.PI);
        return `  ${p.key}: ${valStr},  // ~${deg}°`;
      } else if (p.step < 1) {
        valStr = val.toFixed(2);
      } else {
        valStr = String(val);
      }
      return `  ${p.key}: ${valStr},`;
    }).filter(Boolean);

    const out = [
      '// Tentacle Lab export',
      '// Paste into js/config.js inside the CFG object',
      '// ─'.repeat(20),
      ...lines,
      `  SPLINE_COLOR: '${cfg.SPLINE_COLOR}',`,
      `  GLOW_COLOR:   '${cfg.GLOW_COLOR}',`,
    ].join('\n');

    navigator.clipboard.writeText(out)
      .then(() => this._showToast('✔ Config copied to clipboard!'))
      .catch(() => {
        console.log('[TentacleLab] Config:\n', out);
        this._showToast('✔ Config logged to console');
      });
  }

  // ── TOAST ─────────────────────────────────────────────────────────────────
  _showToast(msg) {
    if (!this._toast) return;
    this._toast.textContent = msg;
    this._toast.classList.add('show');
    setTimeout(() => this._toast?.classList.remove('show'), 2000);
  }

  // CONVERT A PI FRACTION TO A READABLE EXPRESSION
  _nicePI(f) {
    const twelfths = Math.round(f * 12);
    const map = { 12: 'Math.PI', 6: 'Math.PI / 2', 4: 'Math.PI / 3', 3: 'Math.PI / 4', 2: 'Math.PI / 6', 1: 'Math.PI / 12' };
    return map[twelfths] ?? `Math.PI * ${f.toFixed(3)}`;
  }
}