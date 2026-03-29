
// mobileUI.js
// // UPDATED: 3.29.26 @ 7am

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PEEK_H     = 72;    // PX — VISIBLE HEIGHT WHEN COLLAPSED (HANDLE + TAB/AQ BAR)
const SNAP_VEL   = 380;   // PX/S — FLICK SPEED THRESHOLD FOR AUTO-SNAP
const SNAP_FRAC  = 0.28;  // FRACTION OF TRAVEL NEEDED TO TRIGGER SNAP ON SLOW DRAG
const BREAKPOINT = 900;   // MAX WIDTH (PX) TO ACTIVATE MOBILE MODE

// ── UTIL ──────────────────────────────────────────────────────────────────────
export function isMobile() {
  return window.innerWidth <= BREAKPOINT;
}

export class MobileSheet {
  /**
   * MOVES DOM PANEL DOM INTO SWIPEABLE BOTTOM SHEET
   *
   * @param {object}   opts
   * @param {Function} opts.onRelease         LAB → RELEASE CREATURE TO AQUARIUM
   * @param {Function} opts.onAddCreature     AQ  → ADD CURRENT CONFIG TO TANK
   * @param {Function} opts.onRemoveCreature  AQ  → TOGGLE REMOVAL MODE
   * @param {Function} opts.onBackToLab       AQ  → RETURN TO LAB
   */
  constructor({ onRelease, onAddCreature, onRemoveCreature, onBackToLab, onFeed }) {
    this._cb = { onRelease, onAddCreature, onRemoveCreature, onBackToLab, onFeed };

    this._active   = false;
    this._sheet    = null;
    this._mode     = 'LAB';
    this._tab      = 'design';
    this._expanded = false;
    this._mounted  = false;

    // GESTURE STATE
    this._drag      = false;
    this._startY    = 0;
    this._startPx   = 0;  // translateY AT DRAG START
    this._curPx     = 0;  // CURRENT translateY (0 = FULLY EXPANDEDd, collapsedY = PEEKING)
    this._lastY     = 0;
    this._lastT     = 0;
    this._velY      = 0;
    this._expandH   = 0;  // COMPUTED FROM ELEMENT HEIGHT

    
  }

  get active() { return this._active; }

  // ── INIT  - CALL AFTER ui.build() AND aqUI.build() HAVE RUN SO DOM ELEMENTS EXIST ───────────────────────────────────────────────────────────────────
  init() {
    if (!isMobile()) return;
    this._active = true;
    this._hideDesktopUI();
    this._build();
    window.addEventListener('resize', () => this._onResize());
  }

  _hideDesktopUI() {
    ['tlab-panel', 'tlab-left-panel',
     'tlab-open-left', 'tlab-open-right',
     'tlab-aquarium-hud']
      .forEach(id => document.getElementById(id)?.classList.add('mobile-hidden'));
  }

  // ── BUILD ──────────────────────────────────────────────────────────────────
  _build() {
    const sheet = document.createElement('div');
    sheet.id = 'ms-sheet';

    sheet.innerHTML = `

      <!-- ── DRAG HANDLE ──────────────────────────────── -->
      <div id="ms-handle" class="ms-handle">
        <div class="ms-pip"></div>
        <span id="ms-mode-label" class="ms-mode-label">LAB</span>
      </div>

      <!-- ── LAB SECTION ──────────────────────────────── -->
      <div id="ms-lab" class="ms-section ms-lab-section active">

        <div class="ms-tab-bar">
          <button class="ms-tab active" data-tab="design">⬡ TENTACLE SETTINGS</button>
          <button class="ms-tab"        data-tab="studio">◈ MISC SETTINGS</button>
          <button id="ms-release" class="ms-release-btn">Release →</button>
        </div>

        <div class="ms-panels">
          <div class="ms-panel active" id="ms-panel-design">
            <div class="ms-scroll" id="ms-design-host"></div>
          </div>
          <div class="ms-panel" id="ms-panel-studio">
            <div class="ms-scroll" id="ms-studio-host"></div>
          </div>
        </div>

      </div>

      <!-- ── AQUARIUM SECTION ──────────────────────────── -->
      <div id="ms-aq" class="ms-section ms-aq-section">

        <div class="ms-aq-bar">
          <div id="ms-aq-count" class="ms-aq-count">🐙 × 0</div>
          <div class="ms-aq-cap-wrap">
            <div class="ms-aq-cap-outer">
              <div id="ms-aq-cap-fill" class="ms-aq-cap-fill"></div>
            </div>
            <span id="ms-aq-cap-label" class="ms-aq-cap-label">0%</span>
          </div>
          <button id="ms-aq-back-peek" class="ms-aq-btn ms-aq-back">← Lab</button>
        </div>

        <div class="ms-aq-body">
          <button id="ms-aq-add"    class="ms-aq-action ms-aq-add">+ Add to Tank</button>
          <button id="ms-aq-feed"   class="ms-aq-action ms-aq-feed">🍤 Feed</button>
          <button id="ms-aq-remove" class="ms-aq-action ms-aq-remove">− Remove</button>
          <button id="ms-aq-back2"  class="ms-aq-action ms-aq-back-lg">← Back to Lab</button>
        </div>

      </div>
    `;

    document.body.appendChild(sheet);
    this._sheet = sheet;

    this._mountLabContent();
    this._wireButtons();
    this._wireGestures();

    // READ ACTUAL HEIGHT AFTER PAINT
    requestAnimationFrame(() => {
      this._expandH = this._sheet.offsetHeight;
      this._setExpanded(false, false);   // START COLLAPSED
    });
  }

  // ── MOUNT 
  _mountLabContent() {
    if (this._mounted) return;
    this._mounted = true;

    // DESIGN TAB 
    const designHost = document.getElementById('ms-design-host');
    const sliders    = document.getElementById('tlab-sliders');
    if (designHost && sliders) designHost.appendChild(sliders);

    // STUDIO TAB
    const studioHost = document.getElementById('ms-studio-host');
    if (studioHost) {
      ['tlab-audio-row', 'tlab-head-selector', 'tlab-colors', 'tlab-buttons']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) studioHost.appendChild(el);
        });
    }
  }

  // ── WIRE BUTTONS ───────────────────────────────────────────────────────────
  _wireButtons() {
    // LAB — RELEASE
    document.getElementById('ms-release')?.addEventListener('click', () => {
      this._cb.onRelease?.();
    });

    // LAB — TABS 
    document.querySelectorAll('#ms-lab .ms-tab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._switchTab(btn.dataset.tab);
        if (!this._expanded) this._setExpanded(true);
      });
    });

    // AQ BUTTONS
    document.getElementById('ms-aq-back-peek')?.addEventListener('click', () => this._cb.onBackToLab?.());
    document.getElementById('ms-aq-back2')?.addEventListener('click',    () => this._cb.onBackToLab?.());
    document.getElementById('ms-aq-add')?.addEventListener('click',      () => this._cb.onAddCreature?.());
    document.getElementById('ms-aq-remove')?.addEventListener('click',   () => this._cb.onRemoveCreature?.());
    document.getElementById('ms-aq-feed')?.addEventListener('click', () => this._cb.onFeed?.());

    // HANDLE TAP — TOGGLE (but not on child buttons/inputs)
    document.getElementById('ms-handle')?.addEventListener('click', e => {
      if (e.target.closest('button, input, select')) return;
      this._setExpanded(!this._expanded);
    });

    // PEEK BARS — TAP TO EXPAND
    document.querySelector('#ms-lab .ms-tab-bar')?.addEventListener('click', e => {
      if (e.target.closest('.ms-tab, .ms-release-btn')) return;
      if (!this._expanded) this._setExpanded(true);
    });

    document.querySelector('#ms-aq .ms-aq-bar')?.addEventListener('click', e => {
      if (e.target.closest('button, input')) return;
      this._setExpanded(!this._expanded);
    });
  }

  // ── TAB SWITCHING ──────────────────────────────────────────────────────────
  _switchTab(tab) {
    this._tab = tab;
    document.querySelectorAll('#ms-lab .ms-tab')
      .forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    document.querySelectorAll('#ms-lab .ms-panel')
      .forEach(el => el.classList.toggle('active', el.id === `ms-panel-${tab}`));
  }

  // ── MODE SWITCHING ─────────────────────────────────────────────────────────
  setMode(mode) {
    if (!this._active) return;
    this._mode = mode;
    const isLab = mode === 'LAB';
    document.getElementById('ms-lab')?.classList.toggle('active', isLab);
    document.getElementById('ms-aq')?.classList.toggle('active', !isLab);
    const lbl = document.getElementById('ms-mode-label');
    if (lbl) lbl.textContent = mode;
    this._setExpanded(false);   // ALWAYS COLLAPSE ON MODE SWITCH
  }

  // ── AQUARIUM STATE SYNC ────────────────────────────────────────────────────
  setCount(n) {
    const el = document.getElementById('ms-aq-count');
    if (el) el.textContent = `🐙 × ${n}`;
  }

  setCapacity(ratio, full = false) {
    const fill  = document.getElementById('ms-aq-cap-fill');
    const label = document.getElementById('ms-aq-cap-label');
    if (!fill) return;
    const pct   = Math.round(ratio * 100);
    fill.style.width = `${pct}%`;
    const color = ratio < 0.60 ? 'var(--AlphaAqua)'
                : ratio < 0.85 ? 'var(--OptimalOrange)'
                :                'var(--OrbitalOrange)';
    fill.style.background = color;
    fill.style.boxShadow  = `0 0 6px ${color}`;
    if (label) { label.textContent = `${pct}%`; label.style.color = color; }
    const addBtn = document.getElementById('ms-aq-add');
    if (addBtn) {
      addBtn.style.opacity      = full ? '0.35' : '';
      addBtn.style.pointerEvents = full ? 'none' : '';
    }
  }

  setRemovalMode(active) {
    const btn = document.getElementById('ms-aq-remove');
    if (btn) {
      btn.classList.toggle('active', active);
      btn.textContent = active ? '✕ Cancel Remove' : '− Remove';
    }
  }

  setFeedMode(active) {
    const btn = document.getElementById('ms-aq-feed');
    if (btn) {
      btn.classList.toggle('active', active);
      btn.textContent = active ? '✕ Stop Feeding' : '🍤 Feed';
    }
  }

  // ── EXPAND / COLLAPSE ──────────────────────────────────────────────────────
  _setExpanded(expanded, animate = true) {
    this._expanded = expanded;
    const collapsedY = this._expandH - PEEK_H;
    const targetY    = expanded ? 0 : collapsedY;
    this._curPx = targetY;
    this._sheet.style.transition = animate
      ? 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)'
      : 'none';
    this._sheet.style.transform  = `translateY(${targetY}px)`;
  }

  // ── GESTURES ───────────────────────────────────────────────────────────────
  _wireGestures() {
    const handle = document.getElementById('ms-handle');

    const onStart = e => {
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      this._drag     = true;
      this._startY   = y;
      this._startPx  = this._curPx;
      this._lastY    = y;
      this._lastT    = Date.now();
      this._velY     = 0;
      this._sheet.style.transition = 'none';
    };

    const onMove = e => {
      if (!this._drag) return;
      const y   = e.touches ? e.touches[0].clientY : e.clientY;
      const now = Date.now();
      const dt  = Math.max(1, now - this._lastT);
      this._velY  = (y - this._lastY) / dt * 1000;
      this._lastY = y;
      this._lastT = now;
      const max   = Math.max(1, this._expandH - PEEK_H);
      const raw   = this._startPx + (y - this._startY);
      this._curPx = Math.max(0, Math.min(max, raw));
      this._sheet.style.transform = `translateY(${this._curPx}px)`;
    };

    const onEnd = () => {
      if (!this._drag) return;
      this._drag = false;
      const max      = Math.max(1, this._expandH - PEEK_H);
      const progress = 1 - this._curPx / max;   // 0 = COLLAPSED, 1 = EXPANDED
      const snap = this._velY < -SNAP_VEL ? true    // FAST SWIPE UP → EXPAND
                 : this._velY >  SNAP_VEL ? false   // FAST SWIPE DOWN → COLLAPSE
                 : progress > SNAP_FRAC;             // SLOW DRAG → THRESHOLD
      this._setExpanded(snap);
    };

    // HANDLE DRAGS THE SHEET
    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('mousedown',  onStart);
    window.addEventListener('touchmove',  onMove,  { passive: true });
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('touchend',   onEnd);
    window.addEventListener('mouseup',    onEnd);
  }

  // ── RESIZE ─────────────────────────────────────────────────────────────────
  _onResize() {
    // RE-READ HEIGHT IN CASE VIEWPORT CHANGED
    this._expandH = this._sheet.offsetHeight;
    this._setExpanded(this._expanded, false);
  }
}