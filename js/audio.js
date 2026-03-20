// AUDIO.JS —
// Updated 3.20.26 @ 7:30 PM
// AMBIENT: PUBLIC/AUDIO/AMBIENCE.M4A  (LOOPS CONTINUOUSLY)
// SFX POOL: PLOP / DOOP / PLONK / BREEP .M4A  (ONE PICKED AT RANDOM PER SQUISH)

const AMBIENT_SRC = 'public/audio/ambience.wav';
const SFX_SRCS    = [
  'public/audio/plop.m4a',
  'public/audio/doop.m4a',
  'public/audio/plonk.m4a',
  'public/audio/breep.m4a',
  'public/audio/drip.m4a',
];

export class AudioSystem {
  constructor() {
    this._ctx         = null;
    this._ambientGain = null;  // MASTER GAIN FOR AMBIENT TRACK
    this._sfxGain     = null;  // MASTER GAIN FOR SFX (SHARES SAME VOLUME)
    this._sfxBuffers  = [];    // DECODED AUDIOBUFFERS, ONE PER SFX FILE
    this._volume      = 0.30;
    this._muted       = false;
    this._squishClock = 0;     // THROTTLE — MS TIMESTAMP OF LAST SFX PLAY
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────
  // CALLED ON FIRST USER GESTURE TO SATISFY BROWSER AUTOPLAY POLICY.
  // SAFE TO CALL MULTIPLE TIMES.
  ensureInit() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._buildGraph();
      this._loadAmbient();
      this._loadSFX();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ── AUDIO GRAPH ──────────────────────────────────────────────────────────────
  // TWO PARALLEL GAIN NODES — AMBIENT AND SFX — BOTH ROUTED TO DESTINATION.
  // MUTE/VOLUME TARGETS BOTH GAINS TOGETHER.
  _buildGraph() {
    const ctx = this._ctx;

    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 0;  // START SILENT, FADE IN ONCE TRACK LOADS
    this._ambientGain.connect(ctx.destination);

    this._sfxGain = ctx.createGain();
    this._sfxGain.gain.value = this._muted ? 0 : this._volume;
    this._sfxGain.connect(ctx.destination);
  }

  // ── AMBIENT TRACK ────────────────────────────────────────────────────────────
  // DECODED INTO AN AUDIOBUFFER AND PLAYED AS A LOOPING BUFFERSOURCE SO IT GOES
  // THROUGH THE WEB AUDIO GAIN GRAPH (VOLUME + MUTE WORK CORRECTLY).
  async _loadAmbient() {
    try {
      const buf = await this._fetchBuffer(AMBIENT_SRC);
      if (!buf) return;

      const src  = this._ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      src.connect(this._ambientGain);
      src.start(0);

      // GENTLE FADE-IN SO IT DOESN'T STARTLE
      const target = this._muted ? 0 : this._volume;
      this._ambientGain.gain.linearRampToValueAtTime(target, this._ctx.currentTime + 2.5);
    } catch (err) {
      console.warn('[AudioSystem] Could not load ambient track:', err);
    }
  }

  // ── SFX POOL ─────────────────────────────────────────────────────────────────
  // ALL FOUR FILES ARE DECODED UP FRONT SO PLAYBACK IS INSTANT (NO FETCH DELAY ON CLICK).
  async _loadSFX() {
    const results = await Promise.allSettled(SFX_SRCS.map(src => this._fetchBuffer(src)));
    this._sfxBuffers = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean);

    if (this._sfxBuffers.length === 0) {
      console.warn('[AudioSystem] No SFX files loaded — check public/audio/ paths.');
    }
  }

  // FETCH + DECODE A SINGLE AUDIO FILE → AUDIOBUFFER
  async _fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const ab  = await res.arrayBuffer();
    return this._ctx.decodeAudioData(ab);
  }

  // ── PLAY SQUISH ──────────────────────────────────────────────────────────────
  // PICKS A RANDOM BUFFER FROM THE POOL AND FIRES IT.
  // THROTTLED TO ONE PLAY PER 200MS SO RAPID SLIDER DRAGS DON'T OVERLAP BADLY.
  playSquish(now = performance.now()) {
    this.ensureInit();
    if (this._muted) return;
    if (now - this._squishClock < 200) return;
    if (this._sfxBuffers.length === 0) return;
    this._squishClock = now;

    const buf = this._sfxBuffers[Math.floor(Math.random() * this._sfxBuffers.length)];
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this._sfxGain);
    src.start(this._ctx.currentTime);
  }

  // ── VOLUME CONTROLS ──────────────────────────────────────────────────────────
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (!this._ctx || this._muted) return;
    const t = this._ctx.currentTime;
    this._ambientGain?.gain.linearRampToValueAtTime(this._volume, t + 0.2);
    this._sfxGain?.gain.linearRampToValueAtTime(this._volume, t + 0.2);
  }

  setMuted(muted) {
    this._muted = muted;
    if (!this._ctx) return;
    const target = muted ? 0 : this._volume;
    const t      = this._ctx.currentTime;
    this._ambientGain?.gain.linearRampToValueAtTime(target, t + 0.45);
    this._sfxGain?.gain.linearRampToValueAtTime(target, t + 0.45);
  }

  get muted()       { return this._muted; }
  get initialized() { return !!this._ctx; }
}