// traits.js
// UPDATED: 3/21/26 @ 6pm

/**
 * @param {object} cfg  
 * @returns {object}    
 */
export function deriveTraits(cfg) {
  const n      = cfg.TENTACLE_COUNT;
  const segLen = cfg.TENTACLE_SEGMENT_LENGTH;
  const curl   = cfg.TENTACLE_CURL_STRENGTH;
  const width  = cfg.TENTACLE_BASE_WIDTH;
  const segs   = cfg.TENTACLE_SEGMENTS;

  return {
    // ── MOVEMENT ─────────────────────────────────────────────────────────
    // MORE TENTACLES + MORE CURL = FASTER, MORE NERVOUS SWIMMER
    wanderSpeed: clamp(25 + curl * 45 + n * 4, 20, 120),

    // HOW OFTEN THE CREATURE SPONTANEOUSLY CHANGES DIRECTION (PER SECOND)
    wanderErratic: clamp(0.15 + curl * 0.5, 0.1, 0.9),

    // ── SOCIAL (V2 — WIRED BUT DORMANT FOR NOW) ─────────────────────────────────
    // LONG-SEGMENT CREATURES ARE ATTRACTED TO SPARSE TENTACLE COUNTS
    attraction:   clamp(1 - segs / 14, 0, 1),

    // CREATURES FAR FROM 4 TENTACLES ARE MORE AGGRESSIVE
    aggression:   clamp(Math.abs(n - 4) / 4, 0, 1),

    // HIGHER COUNT = NEEDS COMPANY MORE
    sociability:  clamp(n / 8, 0.1, 1.0),

    // THICK-BODIED CREATURES HAVE FASTER METABOLISM
    metabolism:   clamp(width / 50, 0.1, 1.0),

    // ── PHYSICAL ──────────────────────────────────────────────────────────
    // HOW MUCH PERSONAL SPACE BEFORE THEY FEEL CROWDED
    personalSpace: clamp(width * 7, 35, 130),
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }