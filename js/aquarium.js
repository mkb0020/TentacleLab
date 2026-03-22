// AQUARIUM.JS
// UPDATED: 3.22.26 @ 9:30AM

import { Creature }     from './creature.js';
import { Environment }  from './environment.js';
import { TANK }         from './config.js';

export class Aquarium {
  /**
   * @param {number} w  
   * @param {number} h  
   */
  constructor(w, h) {
    this.w          = w;
    this.h          = h;
    this.creatures  = [];
    this.env        = new Environment(w, h);
  }

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  resize(w, h) {
    this.w = w;
    this.h = h;
    this.env.resize(w, h);
  }


  /** TOTAL SEGMENT COUNT ACCROSS ALL LIVING CREATURES */
  get totalSegments() {
    return this.creatures.reduce(
      (sum, c) => sum + c.cfg.TENTACLE_COUNT * c.cfg.TENTACLE_SEGMENTS, 0
    );
  }

  /**
   * 0–1 ratio of how full the tank is.
   * Uses whichever limit (segments or count) is more constrained.
   */
  get capacityRatio() {
    const bySegments  = this.totalSegments / TANK.SEGMENT_BUDGET;
    const byCount     = this.creatures.length / TANK.MAX_CREATURES;
    return Math.min(1, Math.max(bySegments, byCount));
  }

  /**
   * How many segments the CURRENT lab config would cost if added.
   * @param {object} cfg  The lab's live CFG object
   */
  incomingCost(cfg) {
    return cfg.TENTACLE_COUNT * cfg.TENTACLE_SEGMENTS;
  }

  /**
   * Check whether a given config can be added right now.
   * @param {object} cfg
   * @returns {{ ok: boolean, reason: 'budget'|'count'|null }}
   */
  canAdd(cfg) {
    if (this.creatures.length >= TANK.MAX_CREATURES) {
      return { ok: false, reason: 'count' };
    }
    if (this.totalSegments + this.incomingCost(cfg) > TANK.SEGMENT_BUDGET) {
      return { ok: false, reason: 'budget' };
    }
    return { ok: true, reason: null };
  }

  /**
   * ATTEMPTS TO SPAWN A CREATURE. RETURNS A RESULT OBJECT SO CALLERS CAN SHOW FEEDBACK WHEN TANK IF FULL
   *
   * @param {object}                cfg
   * @param {HTMLImageElement|null} headImg
   * @returns {{ added: boolean, creature: Creature|null, reason: string|null }}
   */
  addCreature(cfg, headImg = null) {
    const check = this.canAdd(cfg);
    if (!check.ok) {
      return { added: false, creature: null, reason: check.reason };
    }

    const margin = cfg.SIZE * 1.2;
    const x = margin + Math.random() * (this.w - margin * 2);
    const y = margin + Math.random() * (this.h - margin * 2);
    const c = new Creature({ ...cfg }, x, y, headImg);
    this.creatures.push(c);
    return { added: true, creature: c, reason: null };
  }

  get count() { return this.creatures.filter(c => c.alive).length; }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  /**
   * @param {number} dt    
   * @param {number} time  
   */
  update(dt, time) {
    this.env.update(dt);

    const bounds = { w: this.w, h: this.h };
    for (const c of this.creatures) {
      c.update(dt, time, bounds);
    }

    this._resolveCollisions(dt);

    // PRUNE DEAD CREATURES 
    this.creatures = this.creatures.filter(c => c.alive);
  }

  // ── SOFT CREATURE COLLISIONS ──────────────────────────────────────────────
  /**
   * PAIRWISE SWEEP — WHEN TWO CREATURES OVERLAP, APPLY A GENTLE SEPARATING
   * VELOCITY IMPULSE PROPORTIONAL TO PENETRATION DEPTH.  NO HARD SNAP:
   * THE UNDERWATER FEEL COMES FROM THE IMPULSE BEING SMALL AND THE EXISTING
   * DRAG
   *
   * @param {number} dt  DELTA TIME (SECONDS) — USED TO SCALE THE SOFT PUSH
   */
  _resolveCollisions(dt) {
    const cs = this.creatures;
    const n  = cs.length;

    for (let i = 0; i < n; i++) {
      const a = cs[i];
      if (!a.alive) continue;

      for (let j = i + 1; j < n; j++) {
        const b = cs[j];
        if (!b.alive) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        // COMBINED RADIUS — HEAD SIZE IS THE COLLISION BOUNDARY
        const minDist = (a.cfg.SIZE + b.cfg.SIZE) * 0.5;
        const minDistSq = minDist * minDist;

        if (distSq >= minDistSq) continue; // NO OVERLAP — SKIP

        const dist   = Math.sqrt(distSq) || 0.0001;
        const nx     = dx / dist;  // UNIT NORMAL POINTING A → B
        const ny     = dy / dist;

        // OVERLAP RATIO (0 = JUST TOUCHING, 1 = FULLY COINCIDENT)
        const overlap = 1 - dist / minDist;

        const impulse = overlap * 55 * dt;

        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;

        const correction = (minDist - dist) * 0.08;
        a.x -= nx * correction;
        a.y -= ny * correction;
        b.x += nx * correction;
        b.y += ny * correction;
      }
    }
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────
  draw(ctx) {
    this.env.drawBackground(ctx);
    this.env.drawLightShafts(ctx);
    this.env.drawSurfaceShimmer(ctx);
    this.env.drawSeaweed(ctx);
    for (const c of this.creatures) {
      c.draw(ctx);
    }
    this.env.drawBubbles(ctx);
    this.env.drawVignette(ctx);
  }
}