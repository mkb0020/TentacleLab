// traits.js
// UPDATED: 3.23.26 1:30AM

// ── HELPERS (MODULE-LEVEL SO LENGTHPREFERENCESCORE CAN USE THEM) ─────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// CLASSIFICATION BASED ON TOTAL TENTACLE LENGTH (segments × segmentLength)
function getLengthClass(length) {
  if (length <= 75)  return 'short';
  if (length <= 150) return 'medium';
  return 'long';
}

// MINIMUM POSSIBLE LENGTH: 1 seg × 3 px = 3; "nope" threshold = 3 × 20 = 60
const NOPE_LENGTH = 60;


// ── TRAIT DERIVATION ──────────────────────────────────────────────────────────

/**
 * DERIVES ALL HIDDEN CREATURE TRAITS FROM ITS VISIBLE CONFIG.
 * EACH TRAIT IS A 0–1 FLOAT UNLESS OTHERWISE NOTED.
 *
 * @param {object} cfg  CREATURE CONFIG (TENTACLE_COUNT, TENTACLE_SEGMENTS, ETC.)
 * @returns {object}    FLAT TRAIT OBJECT — ALL VALUES ARE NUMBERS
 */
export function deriveTraits(cfg) {
  const n    = cfg.TENTACLE_COUNT;
  const curl = cfg.TENTACLE_CURL_STRENGTH;
  const width = cfg.TENTACLE_BASE_WIDTH;
  const segs  = cfg.TENTACLE_SEGMENTS;

 // ── NORMALIZE — MAP EACH RAW VALUE TO 0–1 USING ITS ACTUAL SLIDER MAX ───
  const norm = {
    width: clamp(cfg.TENTACLE_BASE_WIDTH      / 50,  0, 1),
    count: clamp(cfg.TENTACLE_COUNT           / 8,   0, 1),
    segs:  clamp(cfg.TENTACLE_SEGMENTS        / 14,  0, 1),
    curl:  clamp(cfg.TENTACLE_CURL_STRENGTH   / 2.0, 0, 1),
    stiff: clamp(cfg.TENTACLE_TIP_STIFFNESS   / 25,  0, 1),
  };

  // ── PHYSICAL -  RAW TENTACLE REACH — USED BY NATURAL SELECTION HELPERS
  const length = segs * cfg.TENTACLE_SEGMENT_LENGTH;

  // ── MOVEMENT - MORE TENTACLES + MORE CURL = FASTER, MORE NERVOUS SWIMMER
  const wanderSpeed   = clamp(25 + curl * 45 + n * 4, 20, 120);

  const wanderErratic = clamp(0.15 + curl * 0.5, 0.1, 0.9);  // HOW OFTEN THE CREATURE SPONTANEOUSLY CHANGES DIRECTION


  // ── CORE SOCIAL ───────────────────────────────────────────────────────────
 // LONG-SEGMENT CREATURES PREFER SPARSE TENTACLE COUNTS

  const attraction  = clamp(1 - segs / 14, 0, 1);

  // CREATURES FAR FROM 4 TENTACLES ARE MORE AGGRESSIVE
  const aggression  = clamp(Math.abs(n - 4) / 4, 0, 1);

  // HIGHER COUNT = NEEDS MORE COMPANY
  const sociability = clamp(n / 8, 0.1, 1.0);

  // THICC BODIED CREATURES HAVE FAST METABOLISM
  const metabolism  = clamp(width / 50, 0.1, 1.0);

  // PERSONAL SPACE NEEDS
  const personalSpace = clamp(width * 7, 35, 130);

  // ── PERSONALITY ───────────────────────────────────────────────────────────
  const curiosity = clamp(
    0.5 +
    (norm.count - 0.5) * 0.3 +  // MORE TENTACLES = MORE CURIOUS
    (1 - norm.width)  * 0.4,    // THINNER = MORE CURIOUS
    0, 1
  );

  const skittishness = clamp(
    (1 - norm.stiff) * 0.7 +    // FLOPPY = JUMPY
    norm.curl * 0.3,             // TWITCHY -> NERVOUS
    0, 1
  );

  const dominance = clamp(
    norm.width * 0.6 +           // THICC = PRESENCE
    norm.count * 0.4,            // MORE LIMBS -> CONTROL
    0, 1
  );

  const playfulness = clamp(
    norm.curl * 0.7 +            // EXPRESSIVE
    norm.segs * 0.3,             // MORE JOINTS = MORE FLOURISH
    0, 1
  );

  const laziness = clamp(
    (1 - clamp(wanderSpeed / 120, 0, 1)) * 0.6 +  // SLOWER = LAZIER
    (1 - curiosity) * 0.4,                         // LOW CURIOSITY = LAZIER
    0, 1
  );

  // ── SOCIAL ────────────────────────────────────────────────────────────────

// HOW "AVERAGE" THIS CREATURE IS — USED AS A BIAS: MID-RANGE CREATURES TEND
  // TO SEEK OTHERS LIKE THEMSELVES. NOTE: ACTUAL PAIRWISE SIMILARITY COMPARISON
  // SHOULD HAPPEN AT INTERACTION TIME (SEE COMPUTEINTERACTION IN AQUARIUM LOGIC).

  const similarityAffinity = clamp(
    1 - (
      Math.abs(norm.segs  - 0.5) * 0.5 +
      Math.abs(norm.width - 0.5) * 0.3 +
      Math.abs(norm.count - 0.5) * 0.2
    ),
    0, 1
  );

  // CREATURES WITH LOTS OF LIMBS + HIGH CURL ARE SHY IN CROWDS —
  // THEY ALREADY HAVE PLENTY OF "TENTACLES" OF THEIR OWN
  const crowdFear = clamp(
    norm.count * 0.5 +
    norm.curl  * 0.3 +
    (1 - norm.stiff) * 0.2,
    0, 1
  );

  const boldness = clamp(
    (1 - skittishness) * 0.6 +
    curiosity          * 0.3 +
    dominance          * 0.1,
    0, 1
  );

  // ── DRIVES (GOAL WEIGHTS) - THESE ARE USED BY THE BEHAVIOR ENGINE TO WEIGHT COMPETING IMPULSES
  const socialDrive       = clamp(sociability * (1 - aggression), 0, 1);
  const explorationDrive  = clamp(curiosity   * (1 - sociability), 0, 1);
  const territorialDrive  = clamp(dominance   * (1 - sociability), 0, 1);

  const reproductiveDrive = clamp(
    boldness    * 0.4 +
    curiosity   * 0.3 +
    playfulness * 0.2 +
    sociability * 0.1,
    0, 1
  );

  const foodDrive = clamp(
    metabolism       * 0.5 +
    curiosity        * 0.2 +
    (1 - laziness)   * 0.2 +
    boldness         * 0.1,
    0, 1
  );

  // ── RETURN ALL TRAITS ─────────────────────────────────────────────────────
  return {
    wanderSpeed,
    wanderErratic,
    attraction,
    aggression,
    sociability,
    metabolism,
    personalSpace,
    length,           
    curiosity,
    skittishness,
    dominance,
    playfulness,
    laziness,
    similarityAffinity,
    crowdFear,
    boldness,
    socialDrive,
    explorationDrive,
    territorialDrive,
    reproductiveDrive,
    foodDrive,
  };
}


// ── NATURAL SELECTION HELPERS ─────────────────────────────────────────────────
// THESE TAKE TWO *TRAIT* OBJECTS (ALREADY DERIVED) AND RETURN A 0–1 SCORE.
// CALL THEM FROM YOUR INTERACTION / BEHAVIOR ENGINE, NOT FROM DERIVETRAITS.

/**
 * HOW ATTRACTED CREATURE A IS TO CREATURE B BASED ON THEIR TENTACLE REACH.
 * SHORT CREATURES LOVE LONG ONES; LONG CREATURES LOVE TINY ONES; MEDIUM IS CHILL. *
 * @param {{ length: number }} traitA
 * @param {{ length: number }} traitB
 * @returns {number} 0–1
 */
export function lengthPreferenceScore(traitA, traitB) {
  const myClass     = getLengthClass(traitA.length);
  const theirLength = traitB.length;

  if (myClass === 'short') {
    // SHORT CREATURES LOVE LONG ONES - THE LONGER THE BETTER
    return clamp((theirLength - 150) / 200, 0, 1);
  }

  if (myClass === 'medium') {
    // MEDIUM IS INDIFFERENT
    return 0.6;
  }

  // LONG CREATURES LOVE TINY ONES BUT HATE ANY THAT ARE LONGER THAN NOPE LENGTH
  if (theirLength < NOPE_LENGTH) return 1.0;
  return clamp(1 - (theirLength - NOPE_LENGTH) / 150, 0, 1);
}

/**
  * PAIRWISE SIMILARITY SCORE BETWEEN TWO CREATURES (0 = TOTALLY DIFFERENT, 1 = TWINS).
 * USE THIS AT INTERACTION TIME TO MODULATE ATTRACTION/REPULSION.
 *
 * @param {object} cfgA  Raw config of creature A
 * @param {object} cfgB  Raw config of creature B
 * @returns {number} 0–1
 */
export function configSimilarity(cfgA, cfgB) {
  const dn = Math.abs(cfgA.TENTACLE_COUNT          - cfgB.TENTACLE_COUNT)          / 7;
  const ds = Math.abs(cfgA.TENTACLE_SEGMENTS        - cfgB.TENTACLE_SEGMENTS)        / 12;
  const dw = Math.abs(cfgA.TENTACLE_BASE_WIDTH      - cfgB.TENTACLE_BASE_WIDTH)      / 48;
  const dc = Math.abs(cfgA.TENTACLE_CURL_STRENGTH   - cfgB.TENTACLE_CURL_STRENGTH)   / 2.0;
  return clamp(1 - (dn * 0.35 + ds * 0.25 + dw * 0.25 + dc * 0.15), 0, 1);
}