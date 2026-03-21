// main.js
// UPDATED: 3.21.26 @ 12PM

import { CFG, DEFAULTS }    from './config.js';
import { TentacleSystem }   from './tentacles.js';
import { TentacleLabUI }    from './ui.js';
import { AudioSystem }      from './audio.js';
import { StateManager }     from './stateManager.js';
import { Aquarium }         from './aquarium.js';
import { AquariumUI }       from './aquariumUI.js';

// ── CANVAS SETUP ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const PANEL_W = 350;   // MUST MATCH #tlab-panel WIDTH IN styles.css

// ── STATE ─────────────────────────────────────────────────────────────────────
const stateMgr = new StateManager();

// ── AQUARIUM ──────────────────────────────────────────────────────────────────
const aquarium = new Aquarium(window.innerWidth, window.innerHeight);

// ── LAB: CREATURE + SYSTEM ────────────────────────────────────────────────────
const labCreature = {
  x:     window.innerWidth  / 2,
  y:     window.innerHeight / 3,
  scale: 1.0,
};

const systemRef = { current: null };

function labPlayW() {
  return canvas.width - PANEL_W;
}

function rebuildSystem() {
  labCreature.x = Math.min(labCreature.x, labPlayW() - CFG.SIZE / 2);
  systemRef.current = new TentacleSystem(labCreature, CFG);
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  aquarium.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();
rebuildSystem();

// ── HEAD IMAGE ────────────────────────────────────────────────────────────────
let headImg = new Image();
headImg.src = 'public/images/head.png';
headImg.onerror = () => { headImg = null; };

function loadCustomHead(img) { headImg = img; }

// ── AUDIO ─────────────────────────────────────────────────────────────────────
const audio = new AudioSystem();

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const el = document.getElementById('tlab-toast');
  if (!el) return;
  el.textContent  = msg;
  el.style.background = isError
    ? 'rgba(200, 40, 60, 0.92)'
    : 'rgba(30, 160, 60, 0.92)';
  el.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el?.classList.remove('show'), 2800);
}

// ── CAPACITY HELPERS ──────────────────────────────────────────────────────────
function syncCapacityUI() {
  const ratio = aquarium.capacityRatio;
  const full  = !aquarium.canAdd(CFG).ok;
  aqUI.setCapacity(ratio, full);
  aqUI.setCount(aquarium.count);
}

function blockedMessage(reason) {
  if (reason === 'count') return '🚫 Tank full — max creatures reached!';
  return '🚫 Tank at capacity — too many segments! Try a simpler creature.';
}

// ── UI — LAB ──────────────────────────────────────────────────────────────────
const ui = new TentacleLabUI({
  canvas,
  cfg:        CFG,
  defaults:   DEFAULTS,
  systemRef,
  onRebuild:  rebuildSystem,
  onHeadLoad: loadCustomHead,
  audio,

  // V2: RELEASE TO AQUARIUM
  onRelease: () => {
    const result = aquarium.addCreature(CFG, headImg);
    if (!result.added) {
      showToast(blockedMessage(result.reason), true);
      return;
    }
    switchToAquarium();
    syncCapacityUI();
  },
});
ui.build();

// ── UI — AQUARIUM ─────────────────────────────────────────────────────────────
const aqUI = new AquariumUI({
  onBackToLab:   switchToLab,
  onAddCreature: () => {
    const result = aquarium.addCreature(CFG, headImg);
    if (!result.added) {
      showToast(blockedMessage(result.reason), true);
    }
    syncCapacityUI();
  },
});
aqUI.build();

// ── MODE SWITCHES ─────────────────────────────────────────────────────────────
function switchToAquarium() {
  stateMgr.setMode('AQUARIUM');
  document.getElementById('tlab-panel')?.classList.add('hidden');
  document.getElementById('tlab-left-panel')?.classList.add('hidden');
  document.getElementById('tlab-open-left')?.classList.add('hidden');
  document.getElementById('tlab-open-right')?.classList.add('hidden');
  aqUI.show();
}

function switchToLab() {
  stateMgr.setMode('LAB');
  document.getElementById('tlab-panel')?.classList.remove('hidden');
  document.getElementById('tlab-left-panel')?.classList.remove('hidden');
  const updateToggles = ui._updateToggleButtons?.bind(ui);
  if (updateToggles) updateToggles();
  aqUI.hide();
}

// ── DRAG (LAB MODE ONLY) ──────────────────────────────────────────────────────
let dragging   = false;
let dragOffX   = 0;
let dragOffY   = 0;
let hasDragged = false;

function clientToCanvas(e) {
  const r   = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left) * (canvas.width  / r.width),
    y: (src.clientY - r.top)  * (canvas.height / r.height),
  };
}

function hitTestCreature(x, y) {
  const dx  = x - labCreature.x;
  const dy  = y - labCreature.y;
  const rad = CFG.SIZE * 0.65 * labCreature.scale;
  return dx * dx + dy * dy < rad * rad;
}

canvas.addEventListener('pointerdown', e => {
  if (stateMgr.isAquarium) return;
  audio.ensureInit();
  const { x, y } = clientToCanvas(e);
  if (x >= labPlayW()) return;
  if (hitTestCreature(x, y)) {
    dragging   = true;
    hasDragged = true;
    dragOffX   = labCreature.x - x;
    dragOffY   = labCreature.y - y;
    audio.playSquish(performance.now() - 9999);
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const { x, y } = clientToCanvas(e);
  const margin   = CFG.SIZE * 0.5;
  labCreature.x = Math.max(margin, Math.min(labPlayW() - margin, x + dragOffX));
  labCreature.y = Math.max(margin, Math.min(canvas.height - margin, y + dragOffY));
});

canvas.addEventListener('pointerup', () => {
  dragging = false;
  canvas.style.cursor = '';
});

// ── LAB RENDERING ─────────────────────────────────────────────────────────────
function drawLabBackground(W, H) {
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
  const ex = labCreature.x;
  const ey = labCreature.y;
  ctx.strokeStyle = 'rgba(100,60,180,0.12)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 10]);
  ctx.beginPath(); ctx.moveTo(ex, 0);  ctx.lineTo(ex, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,  ey); ctx.lineTo(W,  ey); ctx.stroke();
  ctx.setLineDash([]);
}

function drawWatermark(W, H) {
  ctx.save();
  ctx.globalAlpha  = 0.035;
  ctx.fillStyle    = '#8040c0';
  ctx.font         = 'bold 90px "Courier New", monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAB', W / 2, H / 2);
  ctx.restore();
}

function drawLabBody() {
  const size = CFG.SIZE * labCreature.scale;
  ctx.save();
  ctx.shadowBlur  = 22;
  ctx.shadowColor = CFG.GLOW_COLOR;
  if (headImg?.complete && headImg.naturalWidth > 0) {
    ctx.drawImage(headImg, labCreature.x - size / 2, labCreature.y - size / 2, size, size);
  } else {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle   = CFG.GLOW_COLOR;
    ctx.beginPath();
    ctx.arc(labCreature.x, labCreature.y, size * 0.4, 0, Math.PI * 2);
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
    `count:${CFG.TENTACLE_COUNT}  segs:${CFG.TENTACLE_SEGMENTS}  curl:${CFG.TENTACLE_CURL_STRENGTH.toFixed(2)}`,
    8, H - 8
  );
  ctx.restore();

  if (!hasDragged) {
    ctx.save();
    ctx.font         = '12px "Courier New", monospace';
    ctx.fillStyle    = 'rgba(0,255,255,0.6)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('[ click & drag the head ]', W / 2, 16);
    ctx.restore();
  }
}

// ── RAF LOOP ──────────────────────────────────────────────────────────────────
let lastNow = performance.now();
let time    = 0;

function tick(now) {
  requestAnimationFrame(tick);

  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow  = now;
  time    += dt;

  const W = canvas.width;
  const H = canvas.height;

  if (stateMgr.isLab) {
    // ── LAB MODE ──────────────────────────────────────────────────────────
    const PW = labPlayW();
    labCreature.x = Math.min(labCreature.x, PW - CFG.SIZE / 2);

    drawLabBackground(W, H);
    drawGrid(W, H);
    drawCrosshair(W, H);
    drawWatermark(W, H);

    const sys = systemRef.current;
    if (sys) { sys.update(dt, time); sys.draw(ctx); }

    drawLabBody();
    drawHUD(W, H);

  } else {
    // ── AQUARIUM MODE ─────────────────────────────────────────────────────
    aquarium.update(dt, time);
    aquarium.draw(ctx);
    syncCapacityUI();
  }
}

requestAnimationFrame(tick);