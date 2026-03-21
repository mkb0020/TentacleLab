// AQUARIUM.JS
// UPDATED: 3.21.26 @ 12PM

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

    // PRUNE DEAD CREATURES 
    this.creatures = this.creatures.filter(c => c.alive);
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