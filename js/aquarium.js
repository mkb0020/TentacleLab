// AQUARIUM.JS
// UPDATED: 3.29.26 @ 8:30AM

import { Creature }                              from './creature.js';
import { Environment }                           from './environment.js';
import { TANK }                                  from './config.js';
import { lengthPreferenceScore, configSimilarity } from './traits.js';
import { FoodSystem, EAT_RADIUS }                from './food.js';

// ── BEHAVIOR CONSTANTS ────────────────────────────────────────────────────────
// HOW FAR A CREATURE CAN "SENSE" OTHERS (PX).
// KEPT DELIBERATELY MODEST SO BEHAVIOR FEELS LOCAL, NOT TELEPATHIC.
const SENSE_RADIUS    = 240;
const SENSE_RADIUS_SQ = SENSE_RADIUS * SENSE_RADIUS;

// MAX STEERING FORCE APPLIED PER FRAME (KEEPS THINGS FLOATY, NOT SNAPPY)
const MAX_STEER       = 2.2;

// HOW STRONGLY SOCIAL FORCES COMPETE WITH THE WANDER DRIVE
const SOCIAL_WEIGHT   = 0.65;




export class Aquarium {
  /**
   * @param {number} w
   * @param {number} h
   */
  constructor(w, h) {
    this.w         = w;
    this.h         = h;
    this.creatures = [];
    this.env       = new Environment(w, h);
    this.hoveredCreature = null;
    this.foodSystem = new FoodSystem();  
    this._onEat     = null; 
  }

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  resize(w, h) {
    this.w = w;
    this.h = h;
    this.env.resize(w, h);
  }

  // ── CAPACITY ──────────────────────────────────────────────────────────────
  get totalSegments() {
    return this.creatures.reduce(
      (sum, c) => sum + c.cfg.TENTACLE_COUNT * c.cfg.TENTACLE_SEGMENTS, 0
    );
  }

  get capacityRatio() {
    const bySegments = this.totalSegments / TANK.SEGMENT_BUDGET;
    const byCount    = this.creatures.length / TANK.MAX_CREATURES;
    return Math.min(1, Math.max(bySegments, byCount));
  }

  incomingCost(cfg) {
    return cfg.TENTACLE_COUNT * cfg.TENTACLE_SEGMENTS;
  }

  canAdd(cfg) {
    if (this.creatures.length >= TANK.MAX_CREATURES) {
      return { ok: false, reason: 'count' };
    }
    if (this.totalSegments + this.incomingCost(cfg) > TANK.SEGMENT_BUDGET) {
      return { ok: false, reason: 'budget' };
    }
    return { ok: true, reason: null };
  }

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

  // ── REMOVAL ───────────────────────────────────────────────────────────────
removeCreatureAt(x, y) {
  let best = null, bestDist = Infinity;
  for (const c of this.creatures) {
    if (!c.alive) continue;
    const dx = c.x - x, dy = c.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitR = Math.max(55, c.cfg.SIZE * 0.65);
    if (dist < hitR && dist < bestDist) { bestDist = dist; best = c; }
  }
  if (best) {
    best.alive = false;
    best._sys.triggerDeath();
    this.hoveredCreature = null;
    return true;
  }
  return false;
}

getCreatureAt(x, y) {
  let best = null, bestDist = Infinity;
  for (const c of this.creatures) {
    if (!c.alive) continue;
    const dx = c.x - x, dy = c.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitR = Math.max(55, c.cfg.SIZE * 0.65);
    if (dist < hitR && dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

  // ── UPDATE ────────────────────────────────────────────────────────────────
  /**
   * @param {number} dt
   * @param {number} time
   */
  update(dt, time) {
    this.env.update(dt);
    this.foodSystem.update(dt, time, this.w, this.h);

    const bounds = { w: this.w, h: this.h };

    for (const c of this.creatures) {
      c.update(dt, time, bounds);
    }

    this._applyBehavior(dt);

    this._resolveCollisions(dt);

    // PRUNE DEAD CREATURES
    this.creatures = this.creatures.filter(c => c.alive);
  }

  // ── SOCIAL BEHAVIOR ───────────────────────────────────────────────────────
  /**
   * PAIRWISE SCAN: FOR EVERY LIVING CREATURE A, LOOK AT EVERY OTHER LIVING
   * CREATURE B WITHIN SENSE_RADIUS AND COMPUTE HOW A FEELS ABOUT B.
   *
   * INFLUENCES IN PRIORITY ORDER:
   *   1. PERSONAL SPACE VIOLATION  → ALWAYS REPEL, OVERRIDES EVERYTHING
   *   2. HUNGER-BOOSTED AGGRESSION → FLEE FROM OR ATTACK BASED ON DOMINANCE
   *   3. TRAIT-BASED ATTRACTION    → LENGTH PREFERENCE + SIMILARITY AFFINITY
   *
   * THE RESULT IS A SMALL VELOCITY NUDGE — FLOATY, NOT TELEPORTY.

   */
  _applyBehavior(dt) {
    const cs = this.creatures;
    const n  = cs.length;

    for (let i = 0; i < n; i++) {
      const a = cs[i];
      if (!a.alive) continue;

      let steerX = 0;
      let steerY = 0;
      let dominated = false; 

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = cs[j];
        if (!b.alive) continue;

        const dx     = b.x - a.x;
        const dy     = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > SENSE_RADIUS_SQ || distSq < 0.001) continue;

        const dist = Math.sqrt(distSq);
        const nx   = dx / dist;   // UNIT VECTOR POINTING A → B
        const ny   = dy / dist;

        // PROXIMITY falloff: 1.0 WHEN TOUCHING, 0.0 at SENSE_RADIUS
        const proximity = 1 - dist / SENSE_RADIUS;

        // ── 1. PERSONAL SPACE ───────────────────────────────────────────
        // ALWAYS FLEE IF B IS INSIDE A'S PERSONAL BUBBLE, REGARDLESS OF
        // FEELINGS — EVEN CREATURES THAT LIKE EACH OTHER NEED ROOM.
        if (dist < a.traits.personalSpace) {
          const flee = (1 - dist / a.traits.personalSpace) * 1.1;
          steerX -= nx * flee;
          steerY -= ny * flee;
          continue; // SKIP SOCAIL CALC FOR THIS PAIR
        }

        // ── 2. AGGRESSION (HUNGER-BOOSTED) ──────────────────────────────
        const aggression = a.effectiveAggression;

        // CROWD FEAR: TENTACLE-RICH CREATURES HATE BEING SURROUNDED
        const crowdPenalty = a.traits.crowdFear * proximity * 0.3;

        // IF A IS DOMINANT OVER B, IT CHASES; IF WEAKER, IT FLEES
        if (aggression > 0.5) {
          if (a.traits.dominance >= b.traits.dominance) {
            // PREDATORY: MOVE TOWARD B
            steerX += nx * aggression * 0.6 * proximity;
            steerY += ny * aggression * 0.6 * proximity;
          } else {
            // OUTMATCHED: FLEE FROM B
            steerX -= nx * aggression * 0.4 * proximity;
            steerY -= ny * aggression * 0.4 * proximity;
            dominated = true;
          }
        }

        // ── 3. ATTRACTION ────────────────────────────────────────────────
        // BASE ATTRACTION FROM TRAIT, THEN LAYERED WITH:
        //   • HOW MUCH A LIKES B'S TENTACLE LENGTH (LENGTHPREFERENCESCORE)
        //   • SIMILARITY AFFINITY: MID-RANGE CREATURES DRAWN TO THEIR OWN KIND
        if (aggression < 0.7) { // DON'T ATTRACT WHILE VERY AGGRESSIVE
          const lengthPref  = lengthPreferenceScore(a.traits, b.traits);
          const similarity  = configSimilarity(a.cfg, b.cfg);

          let attrScore = a.traits.attraction;
          attrScore    += a.traits.similarityAffinity * similarity * 0.35;
          attrScore    *= 0.5 + lengthPref * 0.5;   // LENGTH MODULATES, NEVER KILLS
          attrScore    -= crowdPenalty;
          attrScore     = Math.max(0, attrScore);

          steerX += nx * attrScore * proximity * 0.5;
          steerY += ny * attrScore * proximity * 0.5;
        }
      }

// ── FOOD SEEKING ──────────────────────────────────────────────────────
if (a.hunger > 0.3) {
  const senseR = 100 + a.traits.foodDrive * 120;
  const result = this.foodSystem.getNearestParticle(a.x, a.y, senseR);
  if (result) {
    const { particle, dist } = result;
    if (dist < EAT_RADIUS) {
      // CLOSE ENOUGH — EAT IT
      this.foodSystem.eat(particle);
      a.hunger = Math.max(0, a.hunger - 0.30);
      this._onEat?.();
    } else {
      const fdx     = particle.x - a.x;
      const fdy     = particle.y - a.y;
      const fnx     = fdx / dist;
      const fny     = fdy / dist;
      const urgency = a.hunger * (0.8 + a.traits.foodDrive * 0.8);
      const falloff = Math.max(0, 1 - dist / senseR);

      // REDIRECT WANDER ANGLE SO LOCOMOTION COOPERATES WITH FOOD SEEKING.
      // THIS IS THE KEY FIX — WITHOUT THIS, WANDER FIGHTS EVERY NUDGE.
      const targetAng = Math.atan2(fdy, fdx);
      let angDiff = targetAng - a._wAngle;
      if (angDiff >  Math.PI) angDiff -= Math.PI * 2;
      if (angDiff < -Math.PI) angDiff += Math.PI * 2;
      a._wAngle += angDiff * urgency * falloff * 0.25;

      // DIRECT VELOCITY BOOST — BYPASSES SOCIAL CAP SO HUNGER IS ACTUALLY FELT.
      // SCALES WITH CREATURE'S OWN WANDER SPEED SO FAST CREATURES CHASE HARDER.
      const boost = urgency * falloff * a.traits.wanderSpeed * 0.8;
      a.vx += fnx * boost * dt;
      a.vy += fny * boost * dt;
    }
  }
}

      // ── APPLY STEERING ─────────────────────────────────────────────────
      const mag = Math.hypot(steerX, steerY);
      if (mag > 0.001) {
        const capped = Math.min(mag, MAX_STEER);
        const ux     = steerX / mag;
        const uy     = steerY / mag;

        // SKITTISH CREATURES REACT MORE; LAZY ONES DAMP SOCIAL FORCES
        const reactivity = 0.6 + a.traits.boldness * 0.4 - a.traits.laziness * 0.3;
        const strength   = capped * SOCIAL_WEIGHT * reactivity * a.traits.wanderSpeed;

        a.vx += ux * strength * dt;
        a.vy += uy * strength * dt;
      }

      // UPDATE READABLE BEHAVIOR STATE FOR HUD / FUTURE STATUS MESSAGES
      if (a.behaviorState !== 'hungry') { // HUNGER STATE SET BY CREATURE ITSELF
        if (dominated)               a.behaviorState = 'fleeing';
        else if (a.effectiveAggression > 0.5) a.behaviorState = 'aggressive';
        else if (Math.hypot(steerX, steerY) > 0.15) a.behaviorState = 'attracted';
        else                         a.behaviorState = 'wandering';
      }
    }
  }

  // ── SOFT CREATURE COLLISIONS ──────────────────────────────────────────────
  /**
   * PHYSICAL BODY SEPARATION — UNCHANGED FROM ORIGINAL.
   * BEHAVIOR STEERING HAPPENS BEFORE THIS, COLLISIONS RESOLVE AFTER.
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

        const dx     = b.x - a.x;
        const dy     = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        const minDist   = (a.cfg.SIZE + b.cfg.SIZE) * 0.5;
        const minDistSq = minDist * minDist;

        if (distSq >= minDistSq) continue;

        const dist    = Math.sqrt(distSq) || 0.0001;
        const nx      = dx / dist;
        const ny      = dy / dist;
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
  draw(ctx, removalMode = false) {
    this.env.drawBackground(ctx);
    this.env.drawLightShafts(ctx);
    this.env.drawSurfaceShimmer(ctx);
    this.env.drawSeaweed(ctx);
    for (const c of this.creatures) {
      c.draw(ctx);
    }
    this.foodSystem.draw(ctx);
    // ── REMOVAL MODE HOVER HIGHLIGHT ─────────────────────────────────────
    if (removalMode && this.hoveredCreature?.alive) {
      const c = this.hoveredCreature;
      const r = c.cfg.SIZE * c.scale * 0.58;
      const arm = r * 0.38;
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = 'rgba(255, 60, 60, 0.75)';
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.88)';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = 'rgba(255, 110, 110, 0.95)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - arm, c.y - arm); ctx.lineTo(c.x + arm, c.y + arm);
      ctx.moveTo(c.x + arm, c.y - arm); ctx.lineTo(c.x - arm, c.y + arm);
      ctx.stroke();
      ctx.restore();
    }
    this.env.drawBubbles(ctx);
    this.env.drawVignette(ctx);
  }
}