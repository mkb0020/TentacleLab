// config.js
// UPDATED 3.21.26 11:30AM

export const CFG = {
  // ── STRUCTURE ────────────────────────────────────────
  TENTACLE_COUNT:               8,
  TENTACLE_SEGMENTS:            12,
  TENTACLE_SEGMENT_LENGTH:     15,
  TENTACLE_BASE_WIDTH:         8.5,
  // ── MOTION ──────────────────────────────────────────
  TENTACLE_CURL_STRENGTH:    0.14,
  TENTACLE_MAX_BEND:     Math.PI / 3,
  TENTACLE_ANCHOR_SWAY:         0.5,
  TENTACLE_WANDER_SPEED:     0.01,   //PLACEHOLDER
  // ── ANCHORING ───────────────────────────────────────
  TENTACLE_ANCHOR_RADIUS:      18,
  TENTACLE_ANCHOR_Y_OFFSET:    32.5,
  // ── TIP PHYSICS ─────────────────────────────────────
  TENTACLE_TIP_GRAVITY:        160,
  TENTACLE_TIP_STIFFNESS:       7.5,
  TENTACLE_TIP_DRAG:         0.86,
  TENTACLE_TIP_BIAS:           65,
  TENTACLE_REACH:             120,   //PLACEHOLDER
  // ── REPULSION ───────────────────────────────────────
  TENTACLE_TIP_REPEL_RADIUS:   15,
  TENTACLE_TIP_REPEL_STRENGTH: 500,
  TENTACLE_REPEL_RADIUS:       20,
  TENTACLE_REPEL_STRENGTH:     500,
  // ── VISUAL ──────────────────────────────────────────
  SPLINE_COLOR:          '#44004d',
  GLOW_COLOR:            '#aa05ad',
  SIZE:                        115,
};

export const DEFAULTS = Object.freeze({ ...CFG });

// ── TANK PERFORMANCE BUDGET = TOTAL RENDERED SEGMENTS = CREATURES x TENTACLES x SEGMENTS PER TENTACLE.───────────────────────────
export const TANK = Object.freeze({
  SEGMENT_BUDGET: 600,   // SEGMENT_BUDGET IS PRIMARY GATE;
  MAX_CREATURES:  25,    // MSAFETY NET.
});