// CREATURE.JS
// UPDATED: 3.21.26 @ 12PM

import { TentacleSystem } from './tentacles.js';
import { deriveTraits }   from './traits.js';

export class Creature {
  /**
   * @param {object}                cfg      DEEP-COPIED CONFIG SNAPSHOT
   * @param {number}                x        INITIAL WORLD X
   * @param {number}                y        INITIAL WORLD Y
   * @param {HTMLImageElement|null} headImg  HEAD SPRITE (NULL = FLOW FALLBACK)
   */
  constructor(cfg, x, y, headImg = null) {
    // ── IDENTITY ──────────────────────────────────────────────────────────
    this.cfg     = { ...cfg };        // OWN COPY - MUTATIONS DON'T BLEED OVER 
    this.headImg = headImg;
    this.traits  = deriveTraits(cfg); // HIDDEN NUMBERS

    // ── PHYSICS ───────────────────────────────────────────────────────────
    // TENACLESYSTEM READS X / Y / SCALE DIRECTLY FROM `THIS` EACH FRAME
    this.x     = x;
    this.y     = y;
    this.scale = 1.0;
    this.vx    = (Math.random() - 0.5) * 25;
    this.vy    = (Math.random() - 0.5) * 25;

    // ── WANDER STATE ──────────────────────────────────────────────────────
    this._wAngle  = Math.random() * Math.PI * 2; // CURRENT SWIM HEADING (RAD)
    this._wTimer  = 0;
    this._wPeriod = 1.2 + Math.random() * 2.5;   // SECONDS BETWEEN NUDGES

    // ── LIFE STATE ────────────────────────────────────────────────────────
    this.alive = true;
    this.age   = 0;     // SECONDS SINCE SPAWN

    // V2 HOOKS —
    this.hunger  = 0.5; // 0 = FULL, 1 = STARVING
    this.health  = 1.0; // 0 = DEAD

    // ── TENTACLE SYSTEM ───────────────────────────────────────────────────
    this._sys = new TentacleSystem(this, this.cfg);
  }

  // ── MAIN UPDATE ──────────────────────────────────────────────────────────
  /**
   * @param {number} dt     DELTA TIME IN SECONDS
   * @param {number} time   GLOBAL TIME (PASSED TO TENTACLE WAVE ANIMATION)
   * @param {{ w: number, h: number }} bounds  TANK DIMENSIONS
   */
  update(dt, time, bounds) {
    if (!this.alive) return;
    this.age += dt;

    this._stepWander(dt);
    this._steerBoundary(dt, bounds);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this._updateTipBias();
    this._sys.update(dt, time);
  }

  // ── WANDER ───────────────────────────────────────────────────────────────
  _stepWander(dt) {
    this._wTimer += dt;

    if (this._wTimer >= this._wPeriod) {
      this._wTimer  = 0;
      this._wPeriod = 1 + Math.random() * 3;

      // ERRATIC CREATURES TURN HARDER; CALM ONES MAKE GENTLE ARCS
      const maxTurn = Math.PI * this.traits.wanderErratic;
      this._wAngle += (Math.random() - 0.5) * 2 * maxTurn;
    }

    // CRUISE SPEED FROM HIDDEN TRAIT
    const spd = this.traits.wanderSpeed;
    const tx  = Math.cos(this._wAngle) * spd;
    const ty  = Math.sin(this._wAngle) * spd;

    // SMOOTH VELOCITY TOWARD TARGET HEADING (DELIBERATE SWIMMING, NOT JERKY)
    const smooth = Math.min(1, 1.8 * dt);
    this.vx += (tx - this.vx) * smooth;
    this.vy += (ty - this.vy) * smooth;
  }

  // ── BOUNDARY AVOIDANCE ────────────────────────────────────────────────────
  _steerBoundary(dt, { w, h }) {
    const margin = this.cfg.SIZE * 0.75;
    const force  = 7;

    if (this.x < margin)       this.vx += (margin - this.x)         * force * dt;
    if (this.x > w - margin)   this.vx -= (this.x - (w - margin))   * force * dt;
    if (this.y < margin)       this.vy += (margin - this.y)         * force * dt;
    if (this.y > h - margin)   this.vy -= (this.y - (h - margin))   * force * dt;
  }

  // ── TIP BIAS: TRAIL BEHIND MOVEMENT - POINTS TENTACLE REST-POSITIONS OPPOSITE TO VELOCITY DIRECTION SO ARMS -  NATURALLY STREAM BEHIND THE CREATURE AS IT SWIMS.
  _updateTipBias() {
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 8) return;  // HOVERING — KEEP EXISTING FAN LAYOUT

    // REVERSE UNIT VECTOR (TRAIL DIRECTION)
    const tx = -this.vx / speed;
    const ty = -this.vy / speed;

    // PERPENDICULAR SPREAD AXIS
    const px = -ty;
    const py =  tx;

    const bias = this.cfg.TENTACLE_TIP_BIAS ?? 65;
    const n    = this._sys.tentacles.length;

    this._sys.tentacles.forEach((t, i) => {
      const spread = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0; // −1 … +1
      t.tipBiasX   = tx * bias * 0.45 + px * spread * bias * 0.55;
      t.tipBiasY   = ty * bias * 0.45 + py * spread * bias * 0.55;
    });
  }

  // ── DRAW ─────────────────────────────────────────────────────────────────
  draw(ctx) {
    if (!this.alive) return;

    // TENTACLES BEHIND HEAD
    this._sys.draw(ctx);

    const size = this.cfg.SIZE * this.scale;
    ctx.save();
    ctx.shadowBlur  = 22;
    ctx.shadowColor = this.cfg.GLOW_COLOR;

    if (this.headImg?.complete && this.headImg.naturalWidth > 0) {
      ctx.drawImage(this.headImg, this.x - size / 2, this.y - size / 2, size, size);
    } else {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = this.cfg.GLOW_COLOR;
      ctx.beginPath();
      ctx.arc(this.x, this.y, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}