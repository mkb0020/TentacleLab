// stateManager.js
// UPDATED 3/21/26 @ 6PM

export class StateManager {
  constructor() {
    this.mode      = 'LAB'; 
    this._listeners = [];
  }

  // ── MODE SWITCHING ────────────────────────────────────────────────────────
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const fn of this._listeners) fn(mode);
  }

  /** REGISTER CALLBACK THAT FIRES WHEN MODE CHANGES. */
  onModeChange(fn) { this._listeners.push(fn); }

  get isLab()      { return this.mode === 'LAB';      }
  get isAquarium() { return this.mode === 'AQUARIUM'; }
}