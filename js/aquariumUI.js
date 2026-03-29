// AQUARIUMUI.JS
// UPDATED: 3.29.26 @ 7am
export class AquariumUI {
  /**
   * @param {object} opts
   * @param {() => void}  opts.onBackToLab    
   * @param {() => void}  opts.onAddCreature  
   */
    constructor({ onBackToLab, onAddCreature, onRemoveCreature, onFeedToggle }) {
      this._onBackToLab    = onBackToLab;
      this._onAddCreature  = onAddCreature;
      this._onRemoveCreature = onRemoveCreature;
      this._onFeedToggle   = onFeedToggle;   
      this._hud            = null;
      this._countEl        = null;
      this._capFillEl      = null;
      this._capLabelEl     = null;
      this._addBtn         = null;
      this._removeBtn      = null;
      this._feedBtn        = null;           
    }

  // ── BUILD ─────────────────────────────────────────────────────────────────
  build() {
    if (document.getElementById('tlab-aquarium-hud')) return;
    const hud = document.createElement('div');
    hud.id        = 'tlab-aquarium-hud';
    hud.className = 'hidden';
    hud.innerHTML = `
      <button id="aq-back-btn"  class="aq-btn aq-back">← Lab</button>
      <div    id="aq-count"     class="aq-count">🐙 × 0</div>
      <div    id="aq-capacity"  class="aq-capacity" title="Tank capacity">
        <div  id="aq-cap-fill"  class="aq-cap-fill"></div>
      </div>
      <span   id="aq-cap-label" class="aq-cap-label">0%</span>
      <button id="aq-add-btn"   class="aq-btn aq-add">+ Add to Tank</button>
      <button id="aq-remove-btn"   class="aq-btn aq-remove">- Remove</button> 
      <button id="aq-feed-btn"  class="aq-btn aq-feed">🍤 Feed</button>
    `;
    document.body.appendChild(hud);

    this._hud        = hud;
    this._countEl    = hud.querySelector('#aq-count');
    this._capFillEl  = hud.querySelector('#aq-cap-fill');
    this._capLabelEl = hud.querySelector('#aq-cap-label');
    this._addBtn     = hud.querySelector('#aq-add-btn');
    this._removeBtn  = hud.querySelector('#aq-remove-btn');  
    this._feedBtn = hud.querySelector('#aq-feed-btn');
    hud.querySelector('#aq-feed-btn').addEventListener('click', () => this._onFeedToggle?.());

    hud.querySelector('#aq-back-btn').addEventListener('click', () => this._onBackToLab());
    this._addBtn.addEventListener('click', () => this._onAddCreature());
    this._removeBtn.addEventListener('click', () => this._onRemoveCreature());  
  }

  // ── STATE ─────────────────────────────────────────────────────────────────
  show()  { this._hud?.classList.remove('hidden'); }
  hide()  { this._hud?.classList.add('hidden'); }

  setCount(n) {
    if (this._countEl) {
      this._countEl.textContent = `🐙 × ${n}`;
    }
  }

  /**
   * Update the capacity bar.
   * @param {number} ratio  0–1  Current fill level of the tank
   * @param {boolean} full  Whether the tank is at or over capacity
   */
  setCapacity(ratio, full = false) {
    if (!this._capFillEl) return;

    const pct = Math.round(ratio * 100);
    this._capFillEl.style.width = `${pct}%`;

  
    let color;
    if (ratio < 0.60)      color = 'var(--AlphaAqua)';
    else if (ratio < 0.85) color = 'var(--OptimalOrange)';
    else                   color = 'var(--OrbitalOrange)';

    this._capFillEl.style.background = color;
    this._capFillEl.style.boxShadow  = `0 0 6px ${color}`;

    if (this._capLabelEl) {
      this._capLabelEl.textContent  = `${pct}%`;
      this._capLabelEl.style.color  = color;
    }

    if (this._addBtn) { // DIM WHEN TANK IS FULL
      this._addBtn.style.opacity      = full ? '0.35' : '';
      this._addBtn.style.pointerEvents = full ? 'none' : '';
      this._addBtn.title              = full
        ? 'Tank at capacity — too many segments!'
        : '';
    }
  }


  setRemovalMode(active) {
  if (!this._removeBtn) return;
  this._removeBtn.classList.toggle('active', active);
  this._removeBtn.textContent = active ? '✕ Cancel Remove' : '− Remove';
}

setFeedMode(active) {
    if (!this._feedBtn) return;
    this._feedBtn.classList.toggle('active', active);
    this._feedBtn.textContent = active ? '✕ Stop Feeding' : '🍤 Feed';
  }
}