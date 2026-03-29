// food.js
//UPDATED 3.29.26 @7AM

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const MAX_PARTICLES = 60;
const CLUSTER_SIZE  = 8;      
const LIFETIME      = 38;     
const SINK_SPEED    = 22;     
export const EAT_RADIUS = 24; 

// ── FOOD PARTICLE ─────────────────────────────────────────────────────────────
class FoodParticle {
  constructor(x, y) {
    this.x        = x + (Math.random() - 0.5) * 32;
    this.y        = y + (Math.random() - 0.5) * 14;
    this.vx       = (Math.random() - 0.5) * 10;
    this.vy       = 3 + Math.random() * 7;     
    this.phase    = Math.random() * Math.PI * 2;
    this.r        = 2.2 + Math.random() * 1.6;
    this.life     = LIFETIME * (0.75 + Math.random() * 0.5);
    this.age      = 0;
    this.eaten    = false;
    this._hitFloor = false;
  }

  update(dt, time, w, h) {
    this.age += dt;

    // GRAVITY — ACCELERATE UP TO TERMINAL VELOCITY
    this.vy   = Math.min(this.vy + 28 * dt, SINK_SPEED);
    // HORIZONTAL WOBBLE — SINE DRIFT FOR ORGANIC FLOAT
    this.x   += this.vx * dt + Math.sin(time * 1.3 + this.phase) * 0.55;
    this.y   += this.vy * dt;
    this.vx  *= 0.975;  

    // SOFT SIDE-WALL BOUNCE
    if (this.x < this.r)     { this.x = this.r;     this.vx *= -0.4; }
    if (this.x > w - this.r) { this.x = w - this.r; this.vx *= -0.4; }

    // DISAPPEAR AT BOTTOM
    if (this.y + this.r >= h) this._hitFloor = true;
  }

  get alpha() {
    if (this.expired) return 0;
    const fadeIn  = Math.min(1, this.age / 0.5);
    const lifeT   = this.age / this.life;
    const fadeOut = lifeT > 0.68 ? Math.max(0, 1 - (lifeT - 0.68) / 0.32) : 1;
    return fadeIn * fadeOut;
  }

  get expired() {
    return this._hitFloor || this.eaten || this.age >= this.life;
  }
}

// ── EAT FLASH ─────────────────────────────────────────────────────────────────
const FLASH_DUR = 0.42;  

class EatFlash {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; }
  update(dt)  { this.t += dt; }
  get done()  { return this.t >= FLASH_DUR; }
  get alpha() { return Math.max(0, 1 - this.t / FLASH_DUR); }
  get radius(){ return 5 + (this.t / FLASH_DUR) * 22; }
}

// ── FOOD SYSTEM ───────────────────────────────────────────────────────────────
export class FoodSystem {
  constructor() {
    this._particles = [];
    this._flashes   = [];
  }

  get count() { return this._particles.length; }
  get isFull() { return this._particles.length >= MAX_PARTICLES; }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * SPAWN A CLUSTER AT (x, y). RESPECTS THE MAX_PARTICLES CAP.
   * @returns {boolean} TRUE IF AT LEAST ONE PARTICLE WAS ADDED
   */
  spawnCluster(x, y) {
    const space = MAX_PARTICLES - this._particles.length;
    if (space <= 0) return false;
    const count = Math.min(CLUSTER_SIZE, space);
    for (let i = 0; i < count; i++) this._particles.push(new FoodParticle(x, y));
    return true;
  }

  /**
   * FIND THE NEAREST UNEATEN PARTICLE WITHIN maxRadius.
   * RETURNS { particle, dist } OR null.
   */
  getNearestParticle(cx, cy, maxRadius) {
    let best = null, bestDist = maxRadius;
    for (const p of this._particles) {
      if (p.eaten) continue;
      const dx = p.x - cx, dy = p.y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best ? { particle: best, dist: bestDist } : null;
  }

  /** MARK A PARTICLE AS EATEN AND TRIGGER A RIPPLE FLASH. */
  eat(particle) {
    particle.eaten = true;
    this._flashes.push(new EatFlash(particle.x, particle.y));
  }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────
  update(dt, time, w, h) {
    for (const p of this._particles) p.update(dt, time, w, h);
    this._particles = this._particles.filter(p => !p.expired);

    for (const f of this._flashes) f.update(dt);
    this._flashes = this._flashes.filter(f => !f.done);
  }

  draw(ctx) {
    // ── FOOD PARTICLES ───────────────────────────────────────────────────────
    for (const p of this._particles) {
      const a = p.alpha;
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = a;

      // GLOW PASS
      ctx.shadowBlur  = 10;
      ctx.shadowColor = 'rgba(255, 210, 60, 0.85)';
      ctx.fillStyle   = '#ffd84a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // BRIGHT CORE
      ctx.shadowBlur = 0;
      ctx.fillStyle  = 'rgba(255,255,220,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ── EAT RIPPLE FLASHES ────────────────────────────────────────────────────
    for (const f of this._flashes) {
      ctx.save();
      ctx.globalAlpha = f.alpha * 0.75;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth   = 1.8 * (1 - f.t / FLASH_DUR);
      ctx.shadowBlur  = 14;
      ctx.shadowColor = 'rgba(255, 210, 60, 0.9)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}