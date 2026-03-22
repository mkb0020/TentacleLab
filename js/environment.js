// environment.js
// UPDATED: 3/22/2026 @ 9:30AM

// ── PALETTE ──────────────────────────────────────────────────────────────────
const P = {
  deepBg:       '#050012',
  bosonBlue:    '#170032',
  protonPurple: '#37025a',
  vortex:       '#830cde',
  plasma:       '#A55AFF',
  aqua:         '#00ffff',
  alphaAqua:    '#67FEBD',
  periwinkle:   '#667eea',
  babyBlue:     '#c4b5fd',
};

// ── ENVIRONMENT ──────────────────────────────────────────────────────────────
export class Environment {
  /**
   * @param {number} w  
   * @param {number} h  
   */
constructor(w, h) {
  this.w = w;
  this.h = h;
  this._t = 0;

  this._bgImg = new Image();
  this._bgImg.src = 'public/images/aquarium.png';

  this._bubbles     = [];
  this._lightShafts = [];
  this._spawnBubbles(30);
  this._spawnShafts(4);
  this._spawnSeaweed();

}

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  resize(w, h) { this.w = w; this.h = h; }

  update(dt) {
    this._t += dt;

    for (const b of this._bubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(this._t * b.wobbleSpd + b.wobblePhase) * 0.35;
      if (b.y < -b.r * 2) this._resetBubble(b, true);
    }
  }

  // ── DRAW LAYERS ──────────────────────────────────────────────────────────
drawBackground(ctx) {
  // 1. BACKGROUND IMAGE ( AQUARIUM ART, FULL SIZE)
  if (this._bgImg?.complete && this._bgImg.naturalWidth > 0) {
    ctx.drawImage(this._bgImg, 0, 0, this.w, this.h);
  }

  // 2. DARK GRADIENT OVERLAY ON TOP 
  ctx.save();
  ctx.globalAlpha = 0.45;  // 0.3 = MORE IMAGE, 0.6 = MORE DARK
  const g = ctx.createLinearGradient(0, 0, 0, this.h);
  g.addColorStop(0,    '#040010');
  g.addColorStop(0.25, '#07001e');
  g.addColorStop(0.6,  '#0b0024');
  g.addColorStop(1,    '#170032');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, this.w, this.h);
  ctx.restore();
}

  /** DRIFTING DIAGONAL LIGHT BEAMS — MIMICS SUNLIGHT FILTERING THROUGH WATER. */
  drawLightShafts(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const s of this._lightShafts) {
      const t  = this._t;
      const cx = s.x + Math.sin(t * s.driftSpd + s.phase) * 55;
      const hw = s.halfWidth;

      const g = ctx.createLinearGradient(cx, 0, cx, this.h * 0.75);
      g.addColorStop(0,    `rgba(103,254,189,${s.alpha * 1.8})`);
      g.addColorStop(0.35, `rgba(165,90,255,${s.alpha})`);
      g.addColorStop(0.75, `rgba(102,126,234,${s.alpha * 0.4})`);
      g.addColorStop(1,    'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.25, 0);
      ctx.lineTo(cx + hw * 0.25, 0);
      ctx.lineTo(cx + hw * 1.2,  this.h * 0.75);
      ctx.lineTo(cx - hw * 1.2,  this.h * 0.75);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /** SUBTLE SHIMMER LINES NEAR THE TOP — THE WATER-SURFACE LENS EFFECT. */
  drawSurfaceShimmer(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    const lineCount = 9;
    for (let i = 0; i < lineCount; i++) {
      const baseY  = this.h * 0.04 + i * 7;
      const y      = baseY + Math.sin(this._t * 0.5 + i * 0.8) * 5;
      const g      = ctx.createLinearGradient(0, y - 3, 0, y + 3);
      g.addColorStop(0,   'rgba(0,255,255,0)');
      g.addColorStop(0.5, 'rgba(103,254,189,0.9)');
      g.addColorStop(1,   'rgba(0,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 3, this.w, 6);
    }
    ctx.restore();
  }

  /** BUBBLES — DRAW ON TOP OF CREATURES SO THEY FLOAT IN FRONT. */
  drawBubbles(ctx) {
    ctx.save();
    for (const b of this._bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,255,${b.alpha * 0.7})`;
      ctx.lineWidth   = b.r * 0.18;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.alpha * 0.55})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(103,254,189,${b.alpha * 0.05})`;
      ctx.fill();
    }
    ctx.restore();
  }

  /** DARK RADIAL VIGNETTE — FRAMES THE TANK, ADDS DEPTH. */
  drawVignette(ctx) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const r  = Math.max(this.w, this.h) * 0.72;
    const g  = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,10,0.25)');
    g.addColorStop(1,   'rgba(0,0,12,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────
  _spawnBubbles(count) {
    for (let i = 0; i < count; i++) {
      const b = this._makeBubble();
      b.y = Math.random() * this.h;  
      this._bubbles.push(b);
    }
  }

  _makeBubble() {
    const r = 1.2 + Math.random() * 4.5;
    return {
      x:          Math.random() * this.w,
      y:          this.h + r,
      r,
      speed:      18 + Math.random() * 38,
      alpha:      0.12 + Math.random() * 0.28,
      wobbleSpd:  0.6 + Math.random() * 1.8,
      wobblePhase: Math.random() * Math.PI * 2,
    };
  }

  _resetBubble(b, atBottom = false) {
    const fresh = this._makeBubble();
    Object.assign(b, fresh);
    if (!atBottom) b.y = Math.random() * this.h;
    else b.x = Math.random() * this.w;  // NEW RANDOM x POSITION WHEN RECYCLING
  }

  _spawnShafts(count) {
    for (let i = 0; i < count; i++) {
      this._lightShafts.push({
        x:        (this.w / count) * i + Math.random() * (this.w / count),
        halfWidth: 28 + Math.random() * 65,
        alpha:    0.018 + Math.random() * 0.022,
        driftSpd: 0.08 + Math.random() * 0.18,
        phase:    Math.random() * Math.PI * 2,
      });
    }
  }

  // ── SEAWEED ───────────────────────────────────────────────────────────────
_spawnSeaweed() {
  const xFracs = [0.03, 0.09,   // LEFT SIDE
                  0.9, 0.97];   // RIGHT SIDE

  this._seaweedClusters = xFracs.map(xf => {
    const strandCount = 5 + Math.floor(Math.random() * 5);
    const strands = [];
    for (let j = 0; j < strandCount; j++) {
      strands.push({
        offset:        (Math.random() - 0.5) * 40,
        height:        70 + Math.random() * 120,
        swayAmount:    20 + Math.random() * 10,
        baseThickness: 7  + Math.random() * 2,
        tipThickness:  0.6 + Math.random(),
        hue:           120 + Math.random() * 10,
        phase:         Math.random() * Math.PI * 2,
      });
    }
    return { xFrac: xf, strands };
  });
}

drawSeaweed(ctx) {
  ctx.save();
  for (const cluster of this._seaweedClusters) {
    const baseX = cluster.xFrac * this.w;
    for (const strand of cluster.strands) {
      this._drawSeaweedStrand(ctx, baseX + strand.offset, this.h, strand);
    }
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

_drawSeaweedStrand(ctx, baseX, baseY, strand) {
  const { height, swayAmount, baseThickness, tipThickness, hue, phase } = strand;
  const segments = 10;
  const points   = [];

  for (let i = 0; i <= segments; i++) {
    const t    = i / segments;
    const y    = baseY - height * t;
    const sway = Math.sin(this._t * 0.8 + phase + t * 1.5) * swayAmount * t;
    points.push({ x: baseX + sway, y, t });
  }

  ctx.lineCap = 'round';

  for (let i = 1; i < points.length - 1; i++) {
    const p0   = points[i - 1];
    const p1   = points[i];
    const p2   = points[i + 1];
    const cp1x = (p0.x + p1.x) / 2;
    const cp1y = (p0.y + p1.y) / 2;
    const cp2x = (p1.x + p2.x) / 2;
    const cp2y = (p1.y + p2.y) / 2;

    ctx.beginPath();
    ctx.lineWidth   = baseThickness * (1 - p1.t) + tipThickness * p1.t;
    ctx.strokeStyle = `hsl(${hue}, 100%, 15%)`;
    ctx.shadowColor = 'rgba(0, 96, 0, 0.5)';
    ctx.shadowBlur  = 5;
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    ctx.stroke();
  }
}
}