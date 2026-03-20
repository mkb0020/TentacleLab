// main.js
// UPDATED 3.20.26 @ 7:30PN
import { CFG, DEFAULTS }    from './config.js';
import { TentacleSystem }   from './tentacles.js';
import { TentacleLabUI }    from './ui.js';
import { AudioSystem }      from './audio.js';

// ── CANVAS SETUP ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const PANEL_W = 350;  // MUST MATCH #tlab-panel WIDTH IN ui.js CSS !!!!!!!

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function playW() { return canvas.width }

// ── CREATURE ─────────────────────────────────────────────────────────────────
const creature = {
  x:     playW() / 2,
  y:     canvas.height / 3,
  scale: 1.0,
};

// ── TENTACLE SYSTEM ──────────────────────────────────────────────────────────
// systemRef.current IS KEPT UP-TO-DATE ADTER EVERY REBUILD SO UI CAN HOT PATCH
const systemRef = { current: null };

function rebuildSystem() {
  creature.x = Math.min(creature.x, playW() - CFG.SIZE / 2);
  systemRef.current = new TentacleSystem(creature, CFG);
}
rebuildSystem();

// ── HEAD IMAGE ────────────────────────────────────────────────────────────────
let headImg = new Image();
headImg.src = 'public/images/head.png';
headImg.onerror = () => { headImg = null; };

function loadCustomHead(img) { headImg = img; }

// ── AUDIO ─────────────────────────────────────────────────────────────────────
const audio = new AudioSystem();

// ── UI ────────────────────────────────────────────────────────────────────────
const ui = new TentacleLabUI({
  canvas,
  cfg:        CFG,
  defaults:   DEFAULTS,
  systemRef,
  onRebuild:  rebuildSystem,
  onHeadLoad: loadCustomHead,
  audio,
});
ui.build();

// ── DRAG SUPPORT ─────────────────────────────────────────────────────────────
let dragging  = false;
let dragOffX  = 0;
let dragOffY  = 0;
let hasDragged = false;  // USED TO SUPPRESS DRAG HINT AFTER FIRST DRAG

function clientToCanvas(e) {
  const r   = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left) * (canvas.width  / r.width),
    y: (src.clientY - r.top)  * (canvas.height / r.height),
  };
}

function hitTestCreature(x, y) {
  const dx  = x - creature.x;
  const dy  = y - creature.y;
  const rad = CFG.SIZE * 0.65 * creature.scale;
  return dx * dx + dy * dy < rad * rad;
}

canvas.addEventListener('pointerdown', e => {
  audio.ensureInit();
  const { x, y } = clientToCanvas(e);
  if (x >= playW()) return;  // CLICK LANDED IN PANEL GAP - IGNORE
  if (hitTestCreature(x, y)) {
    dragging  = true;
    hasDragged = true;
    dragOffX  = creature.x - x;
    dragOffY  = creature.y - y;
    audio.playSquish(performance.now() - 9999);  // FORCE PAST THROTTLE
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const { x, y } = clientToCanvas(e);
  const margin   = CFG.SIZE * 0.5;
  creature.x = Math.max(margin, Math.min(playW() - margin, x + dragOffX));
  creature.y = Math.max(margin, Math.min(canvas.height - margin, y + dragOffY));
});

canvas.addEventListener('pointerup', () => {
  dragging = false;
  canvas.style.cursor = '';
});

// ── RENDERING HELPERS ────────────────────────────────────────────────────────
function drawBackground(W, H) {
  ctx.fillStyle = '#050012';
  ctx.fillRect(0, 0, W, H);
}

function drawGrid(W, H) {
  ctx.strokeStyle = 'rgba(50,25,90,0.22)';
  ctx.lineWidth   = 1;
  const G = 55;
  for (let x = 0; x < W; x += G) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += G) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawCrosshair(W, H) {
  const ex = creature.x;
  const ey = creature.y;
  ctx.strokeStyle = 'rgba(100,60,180,0.12)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 10]);
  ctx.beginPath(); ctx.moveTo(ex, 0);  ctx.lineTo(ex, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(W, ey);  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWatermark(W, H) {
  ctx.save();
  ctx.globalAlpha    = 0.035;
  ctx.fillStyle      = '#8040c0';
  ctx.font           = 'bold 90px "Courier New", monospace';
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  ctx.fillText('LAB', W / 2, H / 2);
  ctx.restore();
}

function drawBody() {
  const size = CFG.SIZE * creature.scale;
  ctx.save();
  ctx.shadowBlur  = 22;
  ctx.shadowColor = CFG.GLOW_COLOR;
  if (headImg && headImg.complete && headImg.naturalWidth > 0) {
    ctx.drawImage(headImg, creature.x - size / 2, creature.y - size / 2, size, size);
  } else { // FALLBACK
    ctx.globalAlpha = 0.75;
    ctx.fillStyle   = CFG.GLOW_COLOR;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHUD(W, H) {
  ctx.save();
  ctx.font         = '9px "Courier New", monospace';
  ctx.fillStyle    = 'rgba(140,110,220,0.50)';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    `count:${CFG.TENTACLE_COUNT}  segs:${CFG.TENTACLE_SEGMENTS}  curl:${CFG.TENTACLE_CURL_STRENGTH.toFixed(2)}  drag:yes`,
    8, H - 8
  );
  ctx.restore();

  if (!hasDragged) { // GOES AWAY AFTER FIRST DRAG
    ctx.save();
    ctx.font         = '12px "Courier New", monospace';
    ctx.fillStyle    = 'rgba(0,255,255,0.6)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('[ click & drag the head ]', W / 2, 16);
    ctx.restore();
  }
}

// ── RAF LOOP ─────────────────────────────────────────────────────────────────
let lastNow = performance.now();
let time    = 0;

function tick(now) {
  requestAnimationFrame(tick);

  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow  = now;
  time    += dt;

  const W = playW();
  const H = canvas.height;

  // Reposition creature if window resized too narrow
  creature.x = Math.min(creature.x, W - CFG.SIZE / 2);

  drawBackground(W, H);
  drawGrid(W, H);
  drawCrosshair(W, H);
  drawWatermark(W, H);

  const sys = systemRef.current;
  if (sys) {
    sys.update(dt, time);
    sys.draw(ctx);     // tentacles behind body
  }

  drawBody();          // head on top of tentacles
  drawHUD(W, H);
}

requestAnimationFrame(tick);