// config.js
// UPDATED 3.22.26 @ 9:30 AM

export const CFG = {
  // ── STRUCTURE ────────────────────────────────────────
  TENTACLE_COUNT:               8,
  TENTACLE_SEGMENTS:            12,
  TENTACLE_SEGMENT_LENGTH:     11.5,
  TENTACLE_BASE_WIDTH:         4,
  // ── MOTION ──────────────────────────────────────────
  TENTACLE_CURL_STRENGTH:    0.14,
  TENTACLE_MAX_BEND:     Math.PI / 3,
  TENTACLE_ANCHOR_SWAY:         0.5,
  TENTACLE_WANDER_SPEED:     0.01,   //PLACEHOLDER
  // ── ANCHORING ───────────────────────────────────────
  TENTACLE_ANCHOR_RADIUS:      10.5,
  TENTACLE_ANCHOR_Y_OFFSET:    19.5,
  // ── TIP PHYSICS ─────────────────────────────────────
  TENTACLE_TIP_GRAVITY:        160,
  TENTACLE_TIP_STIFFNESS:       7.5,
  TENTACLE_TIP_DRAG:         0.86,
  TENTACLE_TIP_BIAS:           65,
  TENTACLE_REACH:             120,   //PLACEHOLDER
  TENTACLE_TIP_REPEL_RADIUS:   15,
  TENTACLE_TIP_REPEL_STRENGTH: 500,
  TENTACLE_REPEL_RADIUS:       20,
  TENTACLE_REPEL_STRENGTH:     500,
  SPLINE_COLOR:          '#44004d',
  GLOW_COLOR:            '#aa05ad',
  SIZE:                        80,
};

export const DEFAULTS = Object.freeze({ ...CFG });

export const TANK = Object.freeze({
  SEGMENT_BUDGET: 600,
  MAX_CREATURES:  25,
});


export const HEAD_CONFIGS = [
  {
    name: 'Cirrus tranquillus', // NAME NOT FINALIZED - ONCE traits.js IS COMPLETED, NAMES WILL BE REVISED TO MATCH THEIR TRAITS: Cirrus tranquillus = whispy + chill 
    cfg: {
      TENTACLE_COUNT: 4, // NON-AGGRESSIVE / CHILL
      TENTACLE_SEGMENTS: 8,
      TENTACLE_SEGMENT_LENGTH: 19.50,
      TENTACLE_BASE_WIDTH: 2.50, // THIN / WHISPY
      TENTACLE_CURL_STRENGTH: 0.15,
      TENTACLE_MAX_BEND: Math.PI * 0.433,  // ~78°
      TENTACLE_ANCHOR_SWAY: 0.50,
      TENTACLE_ANCHOR_RADIUS: 9.50,
      TENTACLE_ANCHOR_Y_OFFSET: 22.00,
      TENTACLE_TIP_GRAVITY: 173,
      TENTACLE_TIP_STIFFNESS: 11.00,
      TENTACLE_TIP_DRAG: 0.94,
      TENTACLE_TIP_BIAS: 35,
      TENTACLE_TIP_REPEL_RADIUS: 25,
      TENTACLE_TIP_REPEL_STRENGTH: 320,
      TENTACLE_REPEL_RADIUS: 15,
      TENTACLE_REPEL_STRENGTH: 625,
      SIZE: 66,
      SPLINE_COLOR: '#1c2939',
      GLOW_COLOR:   '#716085',
    },
  },
  {
    name: 'Amethystus curiosus', // NAME NOT FINALIZED - ONCE traits.js IS COMPLETED, NAMES WILL BE REVISED TO MATCH THEIR TRAITS: Amethystus curiosus = amethyst/purple + curious 
    cfg: {
      TENTACLE_COUNT:              6, // HIGHER THENTACLE COUNT THAN THE OTHER ONE BUT NOT QUITE AT 8 SO IT's CURIOUS BUT  NOT A COMPLETE SOCIAL BUTTERFLY
      TENTACLE_SEGMENTS:           12,
      TENTACLE_SEGMENT_LENGTH:     11.5,
      TENTACLE_BASE_WIDTH:         4,
      TENTACLE_CURL_STRENGTH:      0.14,
      TENTACLE_MAX_BEND:           Math.PI / 3,
      TENTACLE_ANCHOR_SWAY:        0.5,
      TENTACLE_WANDER_SPEED:       0.01,
      TENTACLE_ANCHOR_RADIUS:      10.5,
      TENTACLE_ANCHOR_Y_OFFSET:    19.5,
      TENTACLE_TIP_GRAVITY:        160,
      TENTACLE_TIP_STIFFNESS:      7.5,
      TENTACLE_TIP_DRAG:           0.86,
      TENTACLE_TIP_BIAS:           65,
      TENTACLE_REACH:              120,
      TENTACLE_TIP_REPEL_RADIUS:   15,
      TENTACLE_TIP_REPEL_STRENGTH: 500,
      TENTACLE_REPEL_RADIUS:       20,
      TENTACLE_REPEL_STRENGTH:     500,
      SIZE:                        80,
      SPLINE_COLOR:                '#44004d', // PURPLE-ISH -> Amethystus
      GLOW_COLOR:                  '#aa05ad',
    },
  },
];