// AUDIO.JS
// UPDATED 3.27.26 @ 12:30am

const AMBIENT_SRC  = 'public/audio/ambience.m4a';
const LOOP_COUNT   = 9;
const LOOP_SRCS    = Array.from({ length: LOOP_COUNT }, (_, i) =>
  `public/audio/loop${String(i).padStart(2, '0')}.m4a`
);
const SFX_SRCS = [
  'public/audio/plop.m4a',
  'public/audio/doop.m4a',
  'public/audio/plonk.m4a',
  'public/audio/breep.m4a',
  'public/audio/drip.m4a',
];

// ── SCHEDULER CONSTANTS ───────────────────────────────────────────────────────
const LOOK_AHEAD    = 0.25;  // SECONDS — HOW FAR AHEAD TO SCHEDULE LAYERS
const TICK_INTERVAL = 100;   // MS    — HOW OFTEN THE SCHEDULER CHECKS
const LAYER_CHANCE  = 0.65;  // 0–1   — PROBABILITY A BOUNDARY GETS A LAYER
                              //         (SKIP ~35% SO IT NEVER FEELS MECHANICAL)
const LAYER_GAIN_RATIO = 0.75; // LAYERS SIT SLIGHTLY UNDER THE AMBIENT LEVEL

export class AudioSystem {
  constructor() {
    this._ctx          = null;

    // GAIN NODES
    this._ambientGain  = null;   // AMBIENT LOOP
    this._layerGain    = null;   // LOOP LAYERS
    this._sfxGain      = null;   // CLICK SFX

    this._sfxBuffers   = [];     // DECODED SFX FILES
    this._loopBuffers  = [];     // DECODED loop00–09 FILES

    this._loopDuration       = 0;    // DURATION OF ONE 4-BAR CYCLE (FROM AMBIENT BUFFER)
    this._ambientStart       = 0;    // AUDIOCONTEXT TIME WHEN AMBIENT FIRST PLAYED
    this._scheduledBoundaries = new Set(); // TRACKS WHICH GRID POINTS ARE ALREADY HANDLED
    this._lastLoopIndex      = -1;   // AVOIDS PLAYING THE SAME LAYER TWICE IN A ROW
    this._schedulerTimer     = null; // SETINTERVAL HANDLE

    this._volume       = 0.30;
    this._muted        = false;
    this._squishClock  = 0;     // THROTTLE TIMESTAMP FOR SFX
  }

  // ── INIT - CALLED ON FIRST USER GESTURE TO SATISFY BROWSER AUTOPLAY POLICY.  SAFE TO CALL MULTIPLE TIMES.
  ensureInit() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._buildGraph();
      this._loadAmbient();   // MUST FINISH FIRST — PROVIDES loopDuration FOR SCHEDULER
      this._loadLoops();     // PARALLEL — SCHEDULER WON'T FIRE UNTIL BUFFERS ARE READY
      this._loadSFX();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ── AUDIO GRAPH - THREE PARALLEL GAIN NODES: AMBIENT, LAYERS, SFX — ALL TO DESTINATION.  VOLUME/MUTE TARGETS ALL THREE SO ONE SLIDER CONTROLS EVERYTHING.
  _buildGraph() {
    const ctx = this._ctx;

    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 0;   // SILENT UNTIL FADE-IN AFTER LOAD
    this._ambientGain.connect(ctx.destination);

    this._layerGain = ctx.createGain();
    this._layerGain.gain.value = 0;     // SILENT UNTIL FADE-IN AFTER LOAD
    this._layerGain.connect(ctx.destination);

    this._sfxGain = ctx.createGain();
    this._sfxGain.gain.value = this._muted ? 0 : this._volume;
    this._sfxGain.connect(ctx.destination);
  }

  // ── AMBIENT TRACK - DECODED INTO AN AUDIOBUFFER AND PLAYED AS A LOOPING BUFFERSOURCE. BUFFER DURATION → _loopDuration, WHICH DEFINES THE 4-BAR SCHEDULING GRID.
  async _loadAmbient() {
    try {
      const buf = await this._fetchBuffer(AMBIENT_SRC);
      if (!buf) return;

      // CAPTURE THE 4-BAR GRID LENGTH FROM THE BUFFER ITSELF — NO HARDCODING
      this._loopDuration = buf.duration;
      this._ambientStart = this._ctx.currentTime;

      const src  = this._ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      src.connect(this._ambientGain);
      src.start(this._ambientStart);

      // GENTLE FADE-IN SO IT DOESN'T STARTLE
      const target = this._muted ? 0 : this._volume;
      const fadeEnd = this._ctx.currentTime + 2.5;
      this._ambientGain.gain.linearRampToValueAtTime(target,                      fadeEnd);
      this._layerGain.gain.linearRampToValueAtTime(target * LAYER_GAIN_RATIO,     fadeEnd);

      this._startScheduler();

    } catch (err) {
      console.warn('[AudioSystem] Could not load ambient track:', err);
    }
  }

  // ── LOOP LAYER POOL - ALL TEN FILES DECODED UP FRONT — PLAYBACK IS INSTANT AT SCHEDULE TIME.
  async _loadLoops() {
    const results = await Promise.allSettled(LOOP_SRCS.map(src => this._fetchBuffer(src)));
    this._loopBuffers = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean);

    if (this._loopBuffers.length === 0) {
      console.warn('[AudioSystem] No loop layers loaded — check public/audio/loop*.m4a paths.');
    } else {
      console.log(`[AudioSystem] ${this._loopBuffers.length} loop layers ready.`);
    }
  }

  // ── LAYER SCHEDULER ───────────────────────────────────────────────────────────
  _startScheduler() {
    if (this._schedulerTimer) return;
    this._schedulerTimer = setInterval(() => this._scheduleTick(), TICK_INTERVAL);
  }

  _scheduleTick() {
    if (!this._ctx || this._loopDuration === 0 || this._loopBuffers.length === 0) return;

    const now     = this._ctx.currentTime;
    const elapsed = now - this._ambientStart;
    const period  = this._loopDuration;

    // CHECK THE CURRENT AND NEXT BOUNDARY SO WE NEVER MISS ONE DUE TO TIMER JITTER
    const currentPeriod = Math.floor(elapsed / period);
    for (let offset = 0; offset <= 1; offset++) {
      const boundary = this._ambientStart + (currentPeriod + offset) * period;

      // SKIP PAST BOUNDARIES AND ALREADY-HANDLED ONES
      if (boundary <= now) continue;
      if (this._scheduledBoundaries.has(boundary)) continue;

      // ONLY ACT IF THE BOUNDARY IS WITHIN OUR LOOK-AHEAD WINDOW
      if (boundary - now > LOOK_AHEAD) continue;

      // MARK THIS BOUNDARY AS HANDLED (WHETHER OR NOT WE PLAY SOMETHING)
      this._scheduledBoundaries.add(boundary);

      // PROBABILISTIC SKIP — SO NOT EVERY BOUNDARY GETS A LAYER
      if (!this._muted && Math.random() < LAYER_CHANCE) {
        this._scheduleLayer(boundary);
      }
    }

    // PRUNE STALE KEYS SO THE SET DOESN'T GROW FOREVER (KEEP ONLY BOUNDARIES WITHIN THE LAST TWO FULL CYCLES)
    const pruneBelow = now - period * 2;
    for (const b of this._scheduledBoundaries) {
      if (b < pruneBelow) this._scheduledBoundaries.delete(b);
    }
  }

  // PICKS A RANDOM LOOP (NEVER THE LAST ONE) AND FIRES IT AT startTime ON THE WEB AUDIO CLOCK — PERFECTLY ALIGNED TO THE AMBIENT GRID.
  _scheduleLayer(startTime) {
    if (this._loopBuffers.length === 0) return;

    // PICK AVOIDING IMMEDIATE REPEAT
    let idx;
    if (this._loopBuffers.length === 1) {
      idx = 0;
    } else {
      do {
        idx = Math.floor(Math.random() * this._loopBuffers.length);
      } while (idx === this._lastLoopIndex);
    }
    this._lastLoopIndex = idx;

    const src = this._ctx.createBufferSource();
    src.buffer = this._loopBuffers[idx];
    src.connect(this._layerGain);
    src.start(startTime);

    console.log(
      `[AudioSystem] layer loop${String(idx).padStart(2, '0')} @ t=${startTime.toFixed(3)}s`
    );
  }

  // ── SFX POOL - ALL FILES DECODED UP FRONT SO PLAYBACK IS INSTANT (NO FETCH DELAY ON CLICK).
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

  // ── PLAY SQUISH - PICKS A RANDOM BUFFER FROM THE POOL AND FIRES IT. THROTTLED TO ONE PLAY PER 200MS SO RAPID SLIDER DRAGS DON'T STACK BADLY.
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
    this._ambientGain?.gain.linearRampToValueAtTime(this._volume,                     t + 0.2);
    this._layerGain?.gain.linearRampToValueAtTime(this._volume * LAYER_GAIN_RATIO,    t + 0.2);
    this._sfxGain?.gain.linearRampToValueAtTime(this._volume,                         t + 0.2);
  }

  setMuted(muted) {
    this._muted = muted;
    if (!this._ctx) return;
    const target = muted ? 0 : this._volume;
    const t      = this._ctx.currentTime;
    this._ambientGain?.gain.linearRampToValueAtTime(target,                    t + 0.45);
    this._layerGain?.gain.linearRampToValueAtTime(target * LAYER_GAIN_RATIO,   t + 0.45);
    this._sfxGain?.gain.linearRampToValueAtTime(target,                        t + 0.45);
  }

  get muted()       { return this._muted; }
  get initialized() { return !!this._ctx; }
}