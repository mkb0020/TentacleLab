// tentacles.js 
// UPDATED 3.20.26 @ 7:30PM

const HALF_PI = Math.PI * 0.5;

// BOTTOM ARC: ANCHORS SPREAD ACROSS LOWER HALF OF BODY (~150° → 30°)
// IN CANVAS COORDS: 0=RIGHT  π/2=DOWN  π=LEFT  3π/2=UP
const ARC_START = Math.PI / 6;        // RIGHTMOST ANCHOR ANGLE
const ARC_END   = Math.PI * (5 / 6);  // LEFTMOST ANCHOR ANGLE


// ── SINGLE TENTACLE ───────────────────────────────────────────────────────────
class Tentacle {
  /**
   * @param {number} anchorAngle  ANGLE (RADIANS) FROM BODY CENTER WHERE THIS TENTACLE ATTACHES
   * @param {object} cfg          CONFIG BLOCK (HAS ALL TENTACLE_* VALUES)
   * @param {number} phaseOffset  UNIQUE PER-TENTACLE PHASE SO EACH WANDERS INDEPENDENTLY
   */
  constructor(anchorAngle, cfg, phaseOffset) {
    this.segCount     = cfg.TENTACLE_SEGMENTS;
    this.segLen       = cfg.TENTACLE_SEGMENT_LENGTH;
    this.baseWidth    = cfg.TENTACLE_BASE_WIDTH;
    this.reach        = cfg.TENTACLE_REACH;
    this.curlStr      = cfg.TENTACLE_CURL_STRENGTH;
    this.wanderSpd    = cfg.TENTACLE_WANDER_SPEED;
    this.anchorAng    = anchorAngle;
    this.anchorRad    = cfg.TENTACLE_ANCHOR_RADIUS;
    this.anchorYOff   = cfg.TENTACLE_ANCHOR_Y_OFFSET;
    this.repelRadius  = cfg.TENTACLE_REPEL_RADIUS;
    this.repelStr     = cfg.TENTACLE_REPEL_STRENGTH;
    this.tipGravity   = cfg.TENTACLE_TIP_GRAVITY;
    this.tipRepelRad  = cfg.TENTACLE_TIP_REPEL_RADIUS;
    this.tipRepelStr  = cfg.TENTACLE_TIP_REPEL_STRENGTH;
    this.maxBend      = cfg.TENTACLE_MAX_BEND   ?? Math.PI;
    this.tipStiffness = cfg.TENTACLE_TIP_STIFFNESS ?? 6;
    this.tipDrag      = cfg.TENTACLE_TIP_DRAG      ?? 0.92;
    this.anchorSway   = cfg.TENTACLE_ANCHOR_SWAY   ?? 0;

    // TIP DIRECTIONAL BIAS — SET BY TentacleSystem AFTER CONSTRUCTION
    this.tipBiasX = 0;
    this.tipBiasY = 0;

    // PER-TENTACLE CURL DIRECTION — RANDOMIZED SO ARMS WRITHE INDEPENDENTLY
    this.curlDir = Math.random() > 0.5 ? 1 : -1;

    // IRRATIONAL Y PHASE OFFSET — DESYNC X/Y WANDER AXES FOR ORGANIC FEEL
    this.phaseX = phaseOffset;
    this.phaseY = phaseOffset + 1.91;

    // TIP VELOCITY — DRIVES THE INERTIA/DRAG SPRING SYSTEM
    this.tipVx = 0;
    this.tipVy = 0;

    // xs[0] = TIP   xs[segCount] = BASE (at body anchor)
    this.xs = new Float32Array(this.segCount + 1);
    this.ys = new Float32Array(this.segCount + 1);

    // PRE-ALLOCATED SEGMENT LENGTHS — CACHED FORWARD PASS FOR REUSE IN BACKWARD PASS
    this.segLens = new Float32Array(this.segCount + 1);

    // DEATH DROOP STATE
    this.dying    = false;
    this.deathT   = 0;
    this.deathDur = 0.55;
    this.drapVy   = 0;
    this.alpha    = 1;
  }

  /** SEED ALL SEGMENTS AT BODY CENTER BEFORE FIRST UPDATE */
  initialize(cx, cy) {
    for (let i = 0; i <= this.segCount; i++) {
      this.xs[i] = cx;
      this.ys[i] = cy;
    }
  }

  /**
   * @param {number} dt
   * @param {number} time    GLOBAL TIME (DRIVES CURL WAVE ANIMATION)
   * @param {number} bodyX
   * @param {number} bodyY
   * @param {number} scale   CREATURE SCALE — SEGMENT LENGTH AND REACH SCALE WITH THIS
   */
  update(dt, time, bodyX, bodyY, scale) {
    const segLen  = this.segLen  * scale;
    const anchorR = this.anchorRad * scale;

    // ANCHOR POINT — WHERE THIS TENTACLE MEETS THE BODY
    const sway = Math.sin(time * 1.5 + this.phaseX) * this.anchorSway * scale;
    const ax = bodyX + Math.cos(this.anchorAng) * anchorR + sway;
    const ay = bodyY + Math.sin(this.anchorAng) * anchorR + this.anchorYOff * scale;

    // ── TIP REST POINT (PASSIVE GRAVITY ANCHOR) ──────────────────────────────
    if (!this.dying) {
      const restX = bodyX + this.tipBiasX * scale;
      const restY = bodyY + this.anchorYOff * scale + this.tipGravity * scale + this.tipBiasY * scale;

      this.tipVx += (restX - this.xs[0]) * this.tipStiffness * dt;
      this.tipVy += (restY - this.ys[0]) * this.tipStiffness * dt;
      this.tipVx *= this.tipDrag;
      this.tipVy *= this.tipDrag;

      // CLAMP MAX TIP SPEED — PREVENTS SPRING EXPLOSION ON LARGE POSITION DELTAS
      const maxSpeed = 200 * scale;
      const speed    = Math.hypot(this.tipVx, this.tipVy);
      if (speed > maxSpeed) {
        const inv   = maxSpeed / speed;
        this.tipVx *= inv;
        this.tipVy *= inv;
      }

      this.xs[0] += this.tipVx * dt;
      this.ys[0] += this.tipVy * dt;
    } else {
      // DEATH DROOP — GRAVITY TAKES OVER, TIP FALLS
      this.deathT += dt;
      this.drapVy += 400 * dt;
      this.ys[0]  += this.drapVy * dt;
      this.alpha   = Math.max(0, 1 - this.deathT / this.deathDur);
    }

    // ── FORWARD PASS: TIP → BASE ──────────────────────────────────────────────
    // TRAVELLING WAVE: NEGATIVE TIME SIGN MAKES CURL CRAWL FROM BASE → TIP
    for (let i = 1; i <= this.segCount; i++) {
      const dx  = this.xs[i - 1] - this.xs[i];
      const dy  = this.ys[i - 1] - this.ys[i];
      const tipFactor = (this.segCount - i) / this.segCount; // 0 AT BASE, ~1 AT TIP
      const ang = Math.atan2(dy, dx)
                + Math.sin(i * 0.8 - time * 2.2 + this.phaseX) * this.curlStr * tipFactor * this.curlDir;
      const sl  = segLen * (0.95 + Math.sin(time * 1.3 + i * 1.7 + this.phaseX) * 0.05); // MICRO STRETCH
      this.segLens[i] = sl;
      this.xs[i] = this.xs[i - 1] - Math.cos(ang) * sl;
      this.ys[i] = this.ys[i - 1] - Math.sin(ang) * sl;
    }

    // ── LOCK BASE TO ANCHOR ───────────────────────────────────────────────────
    this.xs[this.segCount] = ax;
    this.ys[this.segCount] = ay;

    // ── BACKWARD PASS: BASE → TIP (RECONCILE ANCHOR) ─────────────────────────
    for (let i = this.segCount - 1; i >= 0; i--) {
      const sl  = this.segLens[i + 1];
      const dx  = this.xs[i + 1] - this.xs[i];
      const dy  = this.ys[i + 1] - this.ys[i];
      const d   = Math.sqrt(dx * dx + dy * dy) || 1;
      const inv = sl / d;

      let nx = this.xs[i + 1] - dx * inv;
      let ny = this.ys[i + 1] - dy * inv;

      // ANGLE CAP — SKIP BASE SEGMENT (i = segCount-1) — NO PARENT REFERENCE
      if (i < this.segCount - 1) {
        const pdx       = this.xs[i + 1] - this.xs[i + 2];
        const pdy       = this.ys[i + 1] - this.ys[i + 2];
        const parentAng = Math.atan2(pdy, pdx);

        let diff = Math.atan2(ny - this.ys[i + 1], nx - this.xs[i + 1]) - parentAng;

        // NORMALIZE TO [-PI, PI]
        if (diff >  Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) > this.maxBend) {
          const clampedAng = parentAng + Math.sign(diff) * this.maxBend;
          nx = this.xs[i + 1] + Math.cos(clampedAng) * sl;
          ny = this.ys[i + 1] + Math.sin(clampedAng) * sl;
        }
      }

      this.xs[i] = nx;
      this.ys[i] = ny;
    }

    // ── REPULSION PASS — PUSH SEGMENTS AWAY FROM BODY CENTER ─────────────────
    if (!this.dying) {
      const repR  = this.repelRadius * scale;
      const repR2 = repR * repR;
      for (let i = 0; i < this.segCount; i++) {
        const dx = this.xs[i] - bodyX;
        const dy = this.ys[i] - bodyY;
        const d2 = dx * dx + dy * dy;
        if (d2 < repR2 && d2 > 0.01) {
          const d    = Math.sqrt(d2);
          const push = (1 - d / repR) * this.repelStr * scale * dt;
          this.xs[i] += (dx / d) * push;
          this.ys[i] += (dy / d) * push;
        }
      }
    }
  }

  /**
   * CATMULL-ROM SPLINE RENDER — SMOOTH TAPERED RIBBON
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} scale
   * @param {string} splineColor
   * @param {string} glowColor
   */
  draw(ctx, scale, splineColor, glowColor) {
    if (this.alpha <= 0.01) return;

    const n = this.segCount;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // TWO PASSES: GLOW THEN SOLID
    for (let pass = 0; pass < 2; pass++) {
      const isGlow = pass === 0;
      ctx.shadowBlur  = isGlow ? 3 : 0;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = isGlow ? glowColor : splineColor;

      // CATMULL-ROM — SEPARATE SEGMENT BETWEEN EACH PAIR OF POINTS
      // WIDTH TAPERS BASE → TIP
      for (let i = n - 1; i >= 0; i--) {
        const t0 = i       / n;
        const t1 = (i + 1) / n;
        const w0 = (0.25 + t0 * 0.75) * this.baseWidth * scale;
        const w1 = (0.25 + t1 * 0.75) * this.baseWidth * scale;
        ctx.lineWidth = (w0 + w1) * 0.5;

        const p0x = this.xs[Math.max(0, i - 1)],  p0y = this.ys[Math.max(0, i - 1)];
        const p1x = this.xs[i],                    p1y = this.ys[i];
        const p2x = this.xs[i + 1],                p2y = this.ys[i + 1];
        const p3x = this.xs[Math.min(n, i + 2)],  p3y = this.ys[Math.min(n, i + 2)];

        // CATMULL-ROM → CUBIC BEZIER CONVERSION (ALPHA=0.5)
        const cp1x = p1x + (p2x - p0x) / 6;
        const cp1y = p1y + (p2y - p0y) / 6;
        const cp2x = p2x - (p3x - p1x) / 6;
        const cp2y = p2y - (p3y - p1y) / 6;

        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  triggerDeath() {
    this.dying  = true;
    this.deathT = 0;
    this.drapVy = 0;
  }

  get isDone() {
    return this.dying && this.deathT >= this.deathDur;
  }
}


// ── TENTACLE SYSTEM ───────────────────────────────────────────────────────────
export class TentacleSystem {
  /**
   * @param {{ x: number, y: number, scale: number }} creature
   * @param {object} cfg  Live config reference — draw() reads SPLINE_COLOR / GLOW_COLOR each frame
   */
  constructor(creature, cfg) {
    this.creature = creature;
    this.cfg      = cfg;

    const count = cfg.TENTACLE_COUNT;
    this.tentacles = [];

    for (let i = 0; i < count; i++) {
      const t_          = count > 1 ? i / (count - 1) : 0.5;
      const jitter      = (Math.random() - 0.5) * 0.25;
      const angle       = ARC_START + t_ * (ARC_END - ARC_START) + jitter;
      const phaseOffset = angle + Math.random() * Math.PI;
      const t           = new Tentacle(angle, cfg, phaseOffset);
      t.initialize(creature.x, creature.y);

      // PER-TENTACLE DIRECTIONAL BIAS — FANS TIPS OUTWARD FOR ORGANIC SPREAD
      const bias = cfg.TENTACLE_TIP_BIAS || 0;
      if      (i === 0)         { t.tipBiasX =  bias; t.tipBiasY =    0; }
      else if (i === count - 1) { t.tipBiasX = -bias; t.tipBiasY =    0; }
      else                      { t.tipBiasX =     0; t.tipBiasY = bias; }

      this.tentacles.push(t);
    }
  }

  /** @param {number} dt   @param {number} time  GLOBAL TIME */
  update(dt, time) {
    const c = this.creature;
    for (const t of this.tentacles) {
      t.update(dt, time, c.x, c.y, c.scale);
    }

    // TIP-TO-TIP REPULSION — SPREAD TIPS SO ALL TENTACLES ARE VISIBLE
    const n = this.tentacles.length;
    for (let i = 0; i < n; i++) {
      const ti = this.tentacles[i];
      if (ti.dying) continue;
      const repR  = ti.tipRepelRad * c.scale;
      const repR2 = repR * repR;
      for (let j = i + 1; j < n; j++) {
        const tj = this.tentacles[j];
        if (tj.dying) continue;
        const dx = ti.xs[0] - tj.xs[0];
        const dy = ti.ys[0] - tj.ys[0];
        const d2 = dx * dx + dy * dy;
        if (d2 < repR2 && d2 > 0.01) {
          const d    = Math.sqrt(d2);
          const push = (1 - d / repR) * ti.tipRepelStr * c.scale * 0.5 * dt;
          const nx   = dx / d;
          const ny   = dy / d;
          ti.xs[0] += nx * push;
          ti.ys[0] += ny * push;
          tj.xs[0] -= nx * push;
          tj.ys[0] -= ny * push;
        }
      }
    }
  }

  /** DRAW ALL TENTACLES — CALL BEFORE DRAWING BODY SO BODY RENDERS ON TOP */
  draw(ctx) {
    const c = this.creature;
    for (const t of this.tentacles) {
      // Read colors live from cfg so color pickers take effect immediately
      t.draw(ctx, c.scale, this.cfg.SPLINE_COLOR, this.cfg.GLOW_COLOR);
    }
  }

  triggerDeath() { for (const t of this.tentacles) t.triggerDeath(); }
  get isDone()   { return this.tentacles.every(t => t.isDone); }
}