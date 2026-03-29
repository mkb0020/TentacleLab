// CREATURE.JS
// UPDATED: 3.29.26 @ 8:30 AM

import { TentacleSystem } from './tentacles.js';
import { deriveTraits }   from './traits.js';

// HOW FAST HUNGER RISES PER SECOND AT METBOLISM = 1
//  AT METABOLISM 0.1 (MIN) CREATURE TAKES ~55 SECONDS TO GO - TO 1
// AT 1.0 (MAX) TAKES ~5.5s — DELIBERATELY PUNISHING 
const HUNGER_RATE = 0.018;

export class Creature {
  /**
   * @param {object}                cfg      DEEP-COPIED CONFIG SNAPSHOT
   * @param {number}                x        INITIAL WORLD X
   * @param {number}                y        INITIAL WORLD Y
   * @param {HTMLImageElement|null} headImg  HEAD SPRITE (NULL = FLOW FALLBACK)
   */
  constructor(cfg, x, y, headImg = null) {
    // ── IDENTITY ──────────────────────────────────────────────────────────
    this.cfg     = { ...cfg };
    this.headImg = headImg;
    this.traits  = deriveTraits(cfg);

    // ── PHYSICS ───────────────────────────────────────────────────────────
    this.x     = x;
    this.y     = y;
    this.scale = 1.0;
    this.vx    = (Math.random() - 0.5) * 25;
    this.vy    = (Math.random() - 0.5) * 25;

    // ── WANDER STATE ──────────────────────────────────────────────────────
    this._wAngle  = Math.random() * Math.PI * 2;
    this._wTimer  = 0;
    this._wPeriod = 1.2 + Math.random() * 2.5;

    // ── LIFE STATE ────────────────────────────────────────────────────────
    this.alive = true;
    this.age   = 0;     //  SECONDS SINCE SPAWN

    this.hunger = 0.3 + Math.random() * 0.2;  // START SLIGHTLY HUNGRY
    this.health = 1.0;

    // WHAT CREATURE IS CURRENTLY "DOING" - READABLE BY HUD / DEBUG OVERLAY
    // VALUES: 'WANDERING' | 'ATTRACTED' | 'FLEEING' | 'AGGRESSIVE' | 'HUNGRY'
    this.behaviorState = 'wandering';

    // ── TENTACLE SYSTEM ───────────────────────────────────────────────────
    this._sys = new TentacleSystem(this, this.cfg);
  }

  // ── EFFECTIVE AGGRESSION ──────────────────────────────────────────────────
  // HUNGER MAKES CREATURES MEANER. THIS IS WHAT THE BEHAVIOR ENGINE SHOULD
  // READ — NOT TRAITS.AGGRESSION DIRECTLY.
  get effectiveAggression() {
    const hungerBoost = Math.max(0, this.hunger - 0.55) * 0.7;
    return Math.min(1, this.traits.aggression + hungerBoost);
  }

  // ── EFFECTIVE SPEED SCALE ────────────────────────────────────────────────
  // OVERFED / VERY SICK CREATURES MOVE SLUGGISHLY
  get effectiveSpeedScale() {
    if (this.health < 0.4) return 0.35 + this.health * 0.5;  // VERY SICK = VERY SLOW
    if (this.hunger < 0.08) return 0.55;                      // STUFFED = LETHARGIC
    return 1.0;
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

    this._tickHunger(dt);

    this._stepWander(dt);
    this._steerBoundary(dt, bounds);

    // APPLY SPEED SCALE AFTER STEERING IS COMPUTED 
    const spd = this.effectiveSpeedScale;
    if (spd < 1.0) {
      this.vx *= spd;
      this.vy *= spd;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this._updateTipBias();
    this._sys.update(dt, time);
  }

  // ── HUNGER ───────────────────────────────────────────────────────────────
  _tickHunger(dt) {
    // METABOLISM DRIVES HOW FAST HUNGER RISES
    this.hunger += this.traits.metabolism * HUNGER_RATE * dt;
    this.hunger  = Math.min(this.hunger, 1.0);

    // STARVATION STARTS CHIPPING HEALTH ONCE HUNGER IS CRITICAL
    if (this.hunger > 0.85) {
      this.health -= (this.hunger - 0.85) * 0.08 * dt;
    }

    // UPDATE BEHAVIORAL READOUT SO HUD / DEBUG CAN SURFACE IT
    if (this.hunger > 0.75) {
      this.behaviorState = 'hungry';
    }

    if (this.health <= 0) {
      this.health = 0;
      this.alive  = false;
      this._sys.triggerDeath();
    }
  }

  // ── WANDER ───────────────────────────────────────────────────────────────
  _stepWander(dt) {
    this._wTimer += dt;

    if (this._wTimer >= this._wPeriod) {
      this._wTimer  = 0;
      this._wPeriod = 1 + Math.random() * 3;

      const maxTurn = Math.PI * this.traits.wanderErratic;
      this._wAngle += (Math.random() - 0.5) * 2 * maxTurn;
    }

    const spd = this.traits.wanderSpeed;
    const tx  = Math.cos(this._wAngle) * spd;
    const ty  = Math.sin(this._wAngle) * spd;

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

  // ── TIP BIAS ─────────────────────────────────────────────────────────────
  _updateTipBias() {
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 8) return;

    const tx = -this.vx / speed;
    const ty = -this.vy / speed;
    const px = -ty;
    const py =  tx;

    const bias = this.cfg.TENTACLE_TIP_BIAS ?? 65;
    const n    = this._sys.tentacles.length;

    this._sys.tentacles.forEach((t, i) => {
      const spread = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
      t.tipBiasX   = tx * bias * 0.45 + px * spread * bias * 0.55;
      t.tipBiasY   = ty * bias * 0.45 + py * spread * bias * 0.55;
    });
  }

  // ── DRAW ─────────────────────────────────────────────────────────────────
  draw(ctx) {
    if (!this.alive) return;

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

  // BEHAVIOR STATE TINT — SUBTLE HUE SHIFT SO SOCIAL STATES ARE READABLE
  if (this.behaviorState !== 'wandering') {
    const tintMap = {
      hungry:     'rgba(255, 200, 50, 0.2)',
      aggressive: 'rgba(255, 60, 60, 0.2)',
      fleeing:    'rgba(60, 200, 255, 0.2)',
      attracted:  'rgba(180, 100, 255, 0.2)',
    };
    const tint = tintMap[this.behaviorState];
    if (tint) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowBlur  = 28;
      ctx.shadowColor = tint;
      ctx.fillStyle   = tint;
      ctx.beginPath();
      ctx.arc(this.x, this.y, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

    ctx.restore();
  }
}