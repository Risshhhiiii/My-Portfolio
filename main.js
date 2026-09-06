/* ═══════════════════════════════════════════════════════════
   UCHIHA ITACHI — scroll-scrubbed frames + mouse-tracked eyes
   ═══════════════════════════════════════════════════════════ */

import { askItachi, getInitializedSystemPrompt } from './src/ai/itachi-ai';

const MAIN_COUNT = 71;
const EYE_COUNT  = 51;
const pad = n => String(n).padStart(3, '0');

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/* fade in over [a,b], hold, fade out over [c,d] */
const window4 = (p, a, b, c, d) =>
  p < a || p > d ? 0 : p < b ? (p - a) / (b - a) : p > c ? 1 - (p - c) / (d - c) : 1;

/* ───────────────────────── preload ───────────────────────── */
const mainFrames = [];
const eyeFrames  = [];
let loaded = 0;
const total = MAIN_COUNT + EYE_COUNT;

const loaderEl  = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct  = document.getElementById('loaderPct');

function load(src, bucket, index) {
  return new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => {
      bucket[index] = img;
      loaded++;
      const pct = loaded / total;
      loaderFill.style.width = (pct * 100).toFixed(1) + '%';
      loaderPct.textContent = String(Math.round(pct * 100)).padStart(2, '0');
      res();
    };
    img.src = src;
  });
}

const jobs = [];
for (let i = 1; i <= MAIN_COUNT; i++) jobs.push(load(`/frames/main/${pad(i)}.jpg`, mainFrames, i - 1));
for (let i = 1; i <= EYE_COUNT;  i++) jobs.push(load(`/frames/eyes/${pad(i)}.jpg`, eyeFrames,  i - 1));

Promise.all(jobs).then(() => {
  setTimeout(() => {
    loaderEl.classList.add('done');
    document.body.classList.add('ready');
    // ensure first paint is correct once fonts/layout settle
    resizeAll();
    setTimeout(() => { loaderEl.style.display = 'none'; }, 1100);
  }, 420);
});

/* ─────────────────── canvas cover-draw helper ─────────────────── */
/* Keeps the backing store in step with the element's real box. Uses
   offsetWidth/Height, not getBoundingClientRect, because these canvases carry
   CSS transforms and a transformed rect would poison the size. */
function fitCanvas(canvas) {
  const isMobile = window.innerWidth <= 860;
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  const w = Math.round(canvas.offsetWidth  * dpr);
  const h = Math.round(canvas.offsetHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  return canvas.getContext('2d');
}

/* cheap per-frame guard: layout can change without a resize event
   (mobile URL bar collapse, zoom, devtools) */
function syncSize(canvas) {
  const isMobile = window.innerWidth <= 860;
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  const w = Math.round(canvas.offsetWidth * dpr);
  const h = Math.round(canvas.offsetHeight * dpr);
  return canvas.width !== w || canvas.height !== h;
}

/* Fills the canvas, but never crops the sides harder than `maxUp` allows —
   so on tall/narrow screens the composition (a face, two eyes) survives
   instead of zooming into a nostril. */
function drawCover(ctx, img, cw, ch, maxUp = 2.0) {
  if (!img || !img.naturalWidth) return false;
  const ir = img.naturalWidth / img.naturalHeight;
  let w = cw, h = cw / ir;                 // start by fitting the width
  if (h < ch) {                            // needs to grow to cover height
    const s = Math.min(ch / h, maxUp);
    w *= s; h *= s;
  }
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  return true;
}

/* ═══════════════════════════════════════════════════════════
   GHOST CURSOR
   Port of reactbits.dev/animations/ghost-cursor (three.js) to raw WebGL —
   same fbm-smoke fragment shader and trail ring-buffer, minus the dependency.
   Bloom/film-grain passes are dropped; the page already grains globally.
   ═══════════════════════════════════════════════════════════ */
function createGhostCursor(canvas, opts = {}) {
  const TRAIL    = opts.trailLength ?? 28;
  const INERTIA  = opts.inertia ?? 0.5;
  const MAX_DPR  = opts.maxDevicePixelRatio ?? 0.45;
  const BUDGET   = opts.targetPixels ?? 4.2e5;
  const BRIGHT   = opts.brightness ?? 1.45;
  const EDGE     = opts.edgeIntensity ?? 0.35;
  const FADE_DELAY = opts.fadeDelayMs ?? 900;
  const FADE_DUR   = opts.fadeDurationMs ?? 1400;
  const rgb = hexToRgb(opts.color ?? '#ff2b2b');

  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });
  if (!gl) return { resize() {}, move() {}, render() {}, ok: false };

  const VERT = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  /* fragment shader: verbatim from the react-bits component */
  const FRAG = `
    precision highp float;
    #define MAX_TRAIL_LENGTH ${TRAIL}

    uniform float iTime;
    uniform vec3  iResolution;
    uniform vec2  iMouse;
    uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
    uniform float iOpacity;
    uniform float iScale;
    uniform vec3  iBaseColor;
    uniform float iBrightness;
    uniform float iEdgeIntensity;

    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f *= f * (3. - 2. * f);
      return mix(mix(hash(i + vec2(0.,0.)), hash(i + vec2(1.,0.)), f.x),
                 mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for(int i=0;i<5;i++){
        v += a * noise(p);
        p = m * p * 2.0;
        a *= 0.5;
      }
      return v;
    }
    vec3 tint1(vec3 base){ return mix(base, vec3(1.0), 0.15); }
    vec3 tint2(vec3 base){ return mix(base, vec3(0.8, 0.9, 1.0), 0.25); }

    vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
      vec2 q = vec2(fbm(p * iScale + iTime * 0.1), fbm(p * iScale + vec2(5.2,1.3) + iTime * 0.1));
      vec2 r = vec2(fbm(p * iScale + q * 1.5 + iTime * 0.15), fbm(p * iScale + q * 1.5 + vec2(8.3,2.8) + iTime * 0.15));

      float smoke = fbm(p * iScale + r * 0.8);
      float radius = 0.5 + 0.3 * (1.0 / iScale);
      float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
      float alpha = pow(smoke, 2.5) * distFactor;

      vec3 c1 = tint1(iBaseColor);
      vec3 c2 = tint2(iBaseColor);
      vec3 color = mix(c1, c2, sin(iTime * 0.5) * 0.5 + 0.5);

      return vec4(color * alpha * intensity, alpha * intensity);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
      vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

      vec3 colorAcc = vec3(0.0);
      float alphaAcc = 0.0;

      vec4 b = blob(uv, mouse, 1.0, iOpacity);
      colorAcc += b.rgb;
      alphaAcc += b.a;

      for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
        vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
        float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
        t = pow(t, 2.0);
        if (t > 0.01) {
          vec4 bt = blob(uv, pm, t * 0.8, iOpacity);
          colorAcc += bt.rgb;
          alphaAcc += bt.a;
        }
      }

      colorAcc *= iBrightness;

      vec2 uv01 = gl_FragCoord.xy / iResolution.xy;
      float edgeDist = min(min(uv01.x, 1.0 - uv01.x), min(uv01.y, 1.0 - uv01.y));
      float distFromEdge = clamp(edgeDist * 2.0, 0.0, 1.0);
      float k = clamp(iEdgeIntensity, 0.0, 1.0);
      float edgeMask = mix(1.0 - k, 1.0, distFromEdge);

      float outAlpha = clamp(alphaAcc * iOpacity * edgeMask, 0.0, 1.0);
      gl_FragColor = vec4(colorAcc, outAlpha);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('ghost shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return { resize() {}, move() {}, render() {}, ok: false };

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return { resize() {}, move() {}, render() {}, ok: false };
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uTime = U('iTime'), uRes = U('iResolution'), uMouse = U('iMouse'),
        uPrev = U('iPrevMouse[0]'), uOpacity = U('iOpacity'), uScale = U('iScale'),
        uColor = U('iBaseColor'), uBright = U('iBrightness'), uEdge = U('iEdgeIntensity');

  gl.uniform3f(uColor, rgb[0], rgb[1], rgb[2]);
  gl.uniform1f(uBright, BRIGHT);
  gl.uniform1f(uEdge, EDGE);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* trail ring buffer, exactly as the original */
  const trail = new Float32Array(TRAIL * 2).fill(0.5);
  const flat  = new Float32Array(TRAIL * 2).fill(0.5);
  let head = 0;

  const target = { x: 0.5, y: 0.5 };
  const cur    = { x: 0.5, y: 0.5 };
  const vel    = { x: 0, y: 0 };
  let pointerActive = false;
  let lastMove = performance.now();
  let fade = 0;
  const t0 = performance.now();

  function resize() {
    const cssW = canvas.offsetWidth, cssH = canvas.offsetHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const need = cssW * cssH * dpr * dpr;
    const s = need <= BUDGET ? 1 : Math.max(0.4, Math.min(1, Math.sqrt(BUDGET / Math.max(1, need))));
    const pr = dpr * s;
    const w = Math.max(1, Math.floor(cssW * pr));
    const h = Math.max(1, Math.floor(cssH * pr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.uniform3f(uRes, w, h, 1);
    // matches calculateScale(): smaller side vs a 600px baseline
    const base = Math.min(Math.max(1, cssW), Math.max(1, cssH));
    gl.uniform1f(uScale, Math.max(0.5, Math.min(2.0, base / 600)));
  }

  /* x,y normalised to the element box; y is flipped for GL */
  function move(x, y, active = true) {
    target.x = clamp(x); target.y = clamp(1 - y);
    pointerActive = active;
    if (active) { lastMove = performance.now(); fade = 1; }
  }
  function leave() { pointerActive = false; lastMove = performance.now(); }

  function render() {
    const now = performance.now();

    if (pointerActive) {
      vel.x = target.x - cur.x; vel.y = target.y - cur.y;
      cur.x = target.x; cur.y = target.y;
      fade = 1;
    } else {
      vel.x *= INERTIA; vel.y *= INERTIA;
      if (vel.x * vel.x + vel.y * vel.y > 1e-6) { cur.x += vel.x; cur.y += vel.y; }
      const dt = now - lastMove;
      if (dt > FADE_DELAY) fade = Math.max(0, 1 - Math.min(1, (dt - FADE_DELAY) / FADE_DUR));
    }
    if (fade <= 0.001 && !pointerActive) { gl.clear(gl.COLOR_BUFFER_BIT); return false; }

    head = (head + 1) % TRAIL;
    trail[head * 2] = cur.x; trail[head * 2 + 1] = cur.y;
    for (let i = 0; i < TRAIL; i++) {
      const src = ((head - i) % TRAIL + TRAIL) % TRAIL;
      flat[i * 2] = trail[src * 2];
      flat[i * 2 + 1] = trail[src * 2 + 1];
    }

    gl.useProgram(prog);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, cur.x, cur.y);
    gl.uniform2fv(uPrev, flat);
    gl.uniform1f(uOpacity, fade);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  return { resize, move, leave, render, ok: true };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ═══════════════════ ACT I — scroll scrub ═══════════════════ */
const scrubSection = document.getElementById('scrub');
const mainCanvas   = document.getElementById('mainCanvas');
const scrubGlow    = document.getElementById('scrubGlow');
const tsukuyomiLockup = document.getElementById('tsukuyomiLockup');
const phases       = [...document.querySelectorAll('.phase')];
let mainCtx = fitCanvas(mainCanvas);

/* frame index is lerped toward the scroll target → butter-smooth both ways */
let frameTarget = 0, frameShown = 0, lastDrawn = -1;
let scrubProgress = 0;

let hasCompletedAwakening = false;

function readScrub() {
  if (isAutoScrubbing) return;
  const y = window.scrollY;
  const aboutSec = document.getElementById('about');
  const aboutTop = aboutSec ? aboutSec.offsetTop : window.innerHeight;

  if (y <= 25) {
    // Exact top landing: Pristine closed-eyes state + Tsukuyomi Lockup
    frameTarget = 0;
    frameShown = 0;
    scrubProgress = 0;
    if (tsukuyomiLockup) {
      tsukuyomiLockup.classList.remove('dissolved');
      tsukuyomiLockup.style.opacity = '1';
      tsukuyomiLockup.style.transform = 'translateX(-50%) translateY(0)';
      tsukuyomiLockup.style.filter = 'none';
      tsukuyomiLockup.style.pointerEvents = 'auto';
    }
  } else if (y < aboutTop) {
    // Returning towards hero from About: KEEP FRAME 0 (NEVER REVERSE ANIMATION)
    frameTarget = 0;
    frameShown = 0;
    scrubProgress = 0;

    if (tsukuyomiLockup) {
      const threshold = aboutTop * 0.45;
      if (y < threshold) {
        const fade = clamp(1 - (y / threshold));
        tsukuyomiLockup.classList.remove('dissolved');
        tsukuyomiLockup.style.opacity = fade.toFixed(3);
        tsukuyomiLockup.style.transform = `translateX(-50%) translateY(${((1 - fade) * -20).toFixed(1)}px)`;
        tsukuyomiLockup.style.pointerEvents = fade > 0.6 ? 'auto' : 'none';
      } else {
        tsukuyomiLockup.classList.add('dissolved');
        tsukuyomiLockup.style.pointerEvents = 'none';
      }
    }
  } else {
    // In sections below About
    if (tsukuyomiLockup && !tsukuyomiLockup.classList.contains('dissolved')) {
      tsukuyomiLockup.classList.add('dissolved');
      tsukuyomiLockup.style.pointerEvents = 'none';
    }
  }
}

/* caption choreography */
/* tuned to the footage: 1-13 closed · 14-24 opening · 25-52 sharingan · 53-71 crows */
const PHASE_WINDOWS = [
  [0.13, 0.17, 0.21, 0.25],   // 静寂
  [0.27, 0.31, 0.37, 0.42],   // 覚醒
  [0.45, 0.49, 0.63, 0.69],   // 写輪眼
  [0.74, 0.79, 0.97, 1.01],   // 烏
];

function paintOverlays(p) {
  if (isAutoScrubbing) {
    phases.forEach((el, i) => {
      const o = window4(p, ...PHASE_WINDOWS[i]);
      el.style.opacity = o.toFixed(3);
      el.style.setProperty('--y', `${((1 - o) * 34).toFixed(1)}px`);
      el.style.filter = `blur(${((1 - o) * 7).toFixed(2)}px)`;
    });
    scrubGlow.style.opacity = (clamp((p - 0.32) / 0.16) * 0.85).toFixed(3);
  } else {
    phases.forEach(el => { el.style.opacity = '0'; });
    scrubGlow.style.opacity = '0';
  }
}

/* ═════════════════ crow-feather particle field ═════════════════ */
const featherCanvas = document.getElementById('featherCanvas');
let fCtx = fitCanvas(featherCanvas);
const feathers = [];

function seedFeathers() {
  feathers.length = 0;
  const n = window.innerWidth < 820 ? 30 : 54;
  for (let i = 0; i < n; i++) {
    feathers.push({
      x: Math.random(), y: Math.random(),
      s: 0.35 + Math.random() * 1.15,      // scale
      vx: 0.18 + Math.random() * 0.5,      // drift speed
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      sway: Math.random() * Math.PI * 2,
      a: 0.16 + Math.random() * 0.5,
    });
  }
}
seedFeathers();

function drawFeather(ctx, f, w, h, dir, intensity) {
  const x = f.x * w, y = f.y * h;
  const len = 22 * f.s * (w / 1280 + 0.55);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.rot + Math.sin(f.sway) * 0.35 + (dir < 0 ? Math.PI : 0));
  ctx.globalAlpha = f.a * intensity;
  ctx.fillStyle = '#0d0d10';
  ctx.strokeStyle = 'rgba(255,43,43,.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.quadraticCurveTo(-len * 0.15, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(-len * 0.15,  len * 0.42, -len, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ═════════════════ AMATERASU — black flame hem ═════════════════ */
/* Amaterasu burns black, so the fire can't be read by its fill — it's read by
   the crimson rim around it. Every tongue is drawn twice: a hot additive halo
   first, then a slightly smaller pure-black core stamped on top. What survives
   between the two radii is the burning edge. */
const amaCanvas = document.getElementById('amaterasuCanvas');
let amaCtx = fitCanvas(amaCanvas);
const flames = [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let amaPainted = false;

function seedFlames() {
  flames.length = 0;
  /* One tongue every ~45px gives dense fiery coverage with 60% fewer draw calls */
  const n = Math.max(16, Math.round(window.innerWidth / 45));
  for (let i = 0; i < n; i++) {
    const depth = Math.random();                    // 0 far · 1 near
    flames.push({
      x: (i + Math.random() * 1.1) / n,             // 0..1 across the band
      depth,
      drift: (Math.random() - 0.5) * 0.05,          // lateral wander per second
      /* far tongues run tall and thin, near ones squat and fat — capped under
         1 so no tip is ever cut off flat by the canvas edge */
      h: (0.42 + Math.random() * 0.5) * (1.15 - depth * 0.35),
      w: (0.34 + Math.random() * 0.6) * (0.7 + depth * 0.7),
      speed: 0.7 + Math.random() * 1.25,            // lick rate
      lean: (Math.random() - 0.5) * 0.5,            // steady tilt off vertical
      phase: Math.random() * Math.PI * 2,
      seed: Math.random() * 100,
    });
  }
  /* far tongues first, so a near black body can eclipse a distant rim */
  flames.sort((a, b) => a.depth - b.depth);
}
seedFlames();

/* one tongue = a stack of shrinking blobs riding a leaning, wobbling spine */
function flameBlob(f, i, BLOBS, w, h, p, tall, wide) {
  const u = i / (BLOBS - 1);                        // 0 base → 1 tip
  const baseX = (f.x + Math.sin(p * 0.4 + f.seed) * f.drift) * w;
  return {
    u,
    x: baseX + (f.lean * u + Math.sin(p * 1.7 + u * 3.4 + f.seed) * 0.6 * u) * wide,
    /* the spine crowds its blobs toward the tip, which sharpens the taper */
    y: h - Math.pow(u, 0.82) * tall,
    r: wide * (1 - u * 0.78) + wide * 0.06,
  };
}

function drawFlame(ctx, f, w, h, t) {
  const p = f.phase + t * f.speed;
  const lick = 0.74 + Math.sin(p) * 0.18 + Math.sin(p * 2.9 + f.seed) * 0.08;
  const tall = h * f.h * lick;
  const wide = h * 0.24 * f.w;
  const near = 0.55 + f.depth * 0.45;               // distance dims everything
  const BLOBS = 5; // Optimized from 9 to 5: silky smooth, eliminates frame-rate stutter

  /* pass 1 — the halo. Hot only near the root; the tip burns out to nothing. */
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < BLOBS; i++) {
    const b = flameBlob(f, i, BLOBS, w, h, p, tall, wide);
    const r = b.r * 1.28;
    const heat = Math.pow(1 - b.u, 1.6) * 0.9 + 0.06;
    const g = ctx.createRadialGradient(b.x, b.y, r * 0.45, b.x, b.y, r);
    g.addColorStop(0,    `rgba(214,32,44,${0.42 * heat * near})`);
    g.addColorStop(0.55, `rgba(126,12,30,${0.2 * heat * near})`);
    g.addColorStop(1,    'rgba(46,0,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* pass 2 — the black body, punched inside the halo */
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < BLOBS; i++) {
    const b = flameBlob(f, i, BLOBS, w, h, p, tall, wide);
    const a = (0.97 - b.u * 0.42) * near;           // tips thin out into smoke
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0,   `rgba(3,2,4,${a})`);
    g.addColorStop(0.62, `rgba(6,3,8,${a * 0.8})`);
    g.addColorStop(1,   'rgba(9,5,11,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* a few sparks shed off the tips — cheap, and they sell the fire as alive */
function drawEmbers(ctx, w, h, t) {
  ctx.globalCompositeOperation = 'lighter';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const s = i * 12.9898;
    const life = (t * (0.22 + (i % 5) * 0.05) + i / n) % 1;
    const x = ((Math.sin(s) * 0.5 + 0.5) + Math.sin(t * 0.6 + s) * 0.02) * w;
    const y = h - life * h * 0.95;
    const a = Math.sin(life * Math.PI) * 0.5;
    const r = h * 0.018 * (1.4 - life * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,74,60,${a})`);
    g.addColorStop(1, 'rgba(120,10,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintAmaterasu(t) {
  const w = amaCanvas.width, h = amaCanvas.height;
  amaCtx.clearRect(0, 0, w, h);
  for (const f of flames) drawFlame(amaCtx, f, w, h, t);
  drawEmbers(amaCtx, w, h, t);
}

/* ═══════════════ ACT II — mouse-tracked eyes ═══════════════ */
const eyesSection = document.getElementById('eyes');
const eyeCanvas   = document.getElementById('eyeCanvas');
const eyeFlare    = document.getElementById('eyeFlare');
const eyeReadout  = document.getElementById('eyeReadout');
let eyeCtx = fitCanvas(eyeCanvas);

/* Gaze lookup table.
   The clip's pupils travel: centre(f1) -> far left(f5..9) -> centre(f13..27)
   -> far right(f30..41) -> back toward centre(f43..51). Feeding the raw
   sequence to the pointer made the eyes swing back left at the right-hand end.
   These are the only frames that form a monotonic left->right sweep, ordered by
   the measured red-pupil centroid (px, image space, 1280 wide). */
const GAZE_LUT = [
  { f: 5,  cx: 613.4 },   // far left
  { f: 4,  cx: 622.5 },
  { f: 3,  cx: 631.3 },
  { f: 2,  cx: 645.2 },
  { f: 1,  cx: 652.4 },   // centre
  { f: 28, cx: 652.5 },
  { f: 29, cx: 663.4 },
  { f: 30, cx: 671.4 },
  { f: 31, cx: 672.7 },   // far right
].map(o => ({ idx: o.f - 1, cx: o.cx }));

let mx = 0.5, my = 0.5;            // raw pointer, 0..1
let ex = 0.5, ey = 0.5;            // eased pointer
let gazePos = (GAZE_LUT.length - 1) / 2;   // float position along the LUT
let eyeLastKey = '';

window.addEventListener('pointermove', e => {
  mx = e.clientX / window.innerWidth;
  my = e.clientY / window.innerHeight;
  cursorX = e.clientX; cursorY = e.clientY;
}, { passive: true });

// touch: let a finger drag the gaze too
window.addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (!t) return;
  mx = t.clientX / window.innerWidth;
  my = t.clientY / window.innerHeight;
}, { passive: true });

/* ═══════════════ ACT III — ghost cursor + reveal + parallax ═══════════════ */
const jutsuSection = document.getElementById('contact') || document.getElementById('jutsu');
const jutsuReveal  = document.getElementById('jutsuReveal');
const ghostCanvas  = document.getElementById('ghostCanvas');
const ghost = createGhostCursor(ghostCanvas, {
  color: '#ff2b2b',      // sharingan red
  trailLength: 28,
  brightness: 0.45,      // 29 additive blobs stack fast — higher blows out to white
  edgeIntensity: 0.45,
});

let jutsuLit = false;
let revealX = 0.5, revealY = 0.5;      // eased, section-relative 0..1
let revealTX = 0.5, revealTY = 0.5;
let revealR = 0, revealRT = 420;   // starts closed: no shader work until hovered

function setLit(on) {
  if (jutsuLit === on) return;
  jutsuLit = on;
  jutsuSection.classList.toggle('lit', on);
  if (!on) ghost.leave();
}

jutsuSection.addEventListener('pointermove', e => {
  const r = jutsuSection.getBoundingClientRect();
  revealTX = clamp((e.clientX - r.left) / Math.max(1, r.width));
  revealTY = clamp((e.clientY - r.top) / Math.max(1, r.height));
  ghost.move(revealTX, revealTY, true);
  setLit(true);
}, { passive: true });

jutsuSection.addEventListener('pointerleave', () => setLit(false), { passive: true });

// hovering contact channels or form fields opens the reveal wider
document.querySelectorAll('#contact .channel-item, #contact .scroll-form, #contact input, #contact textarea, #contact button').forEach(el => {
  el.addEventListener('pointerenter', () => { revealRT = 580; }, { passive: true });
  el.addEventListener('pointerleave', () => { revealRT = 420; }, { passive: true });
});

/* parallax targets: heading bits carry an explicit data-px */
const pxItems = [...document.querySelectorAll('#contact [data-px]')]
  .map(el => ({ el, speed: parseFloat(el.dataset.px) || 0.2, delay: 0 }));

document.querySelectorAll('.jutsu__amaterasu').forEach(el => {
  pxItems.push({ el, speed: -0.22, delay: 0.1 });
});

// start hidden so nothing pops in before the first parallax paint
pxItems.forEach(it => { it.el.style.opacity = '0'; });
ghost.resize();

function paintJutsu() {
  const r = jutsuSection.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top > vh || r.bottom < 0) return;

  // 0 when the section is one viewport below, 1 once its top passes the middle
  const enter = clamp((vh - r.top) / (vh * 0.9));
  const sectionProgress = (r.top - vh / 2) / vh;

  for (const it of pxItems) {
    const local = clamp((enter - it.delay) / (1 - it.delay || 1));
    const eased = 1 - Math.pow(1 - local, 3);          // easeOutCubic
    // Pre-calculated relative drift: eliminates per-frame getBoundingClientRect layout thrashing
    const drift = sectionProgress * it.speed * 90;
    it.el.style.opacity = eased.toFixed(3);
    it.el.style.transform = `translate3d(0, ${(drift + (1 - eased) * 40).toFixed(1)}px, 0)`;
  }
}

/* ═════════════════════ custom cursor ═════════════════════ */
const cursorEl = document.getElementById('cursor');
let cursorX = window.innerWidth / 2, cursorY = window.innerHeight / 2;
let cx = cursorX, cy = cursorY;
document.querySelectorAll('a, button, input, textarea, .card, .gaze-node, .project-entry, .channel-item, .sound-widget, .eyes__sticky, .project-link-btn, .enter-btn').forEach(el => {
  el.addEventListener('pointerenter', () => cursorEl && cursorEl.classList.add('hot'));
  el.addEventListener('pointerleave', () => cursorEl && cursorEl.classList.remove('hot'));
});

/* ═════════════════════ scroll chrome ═════════════════════ */
const hint = document.getElementById('hint');
const railScroll = document.getElementById('railScroll');
let lastScrollY = window.scrollY;
let scrollDir = 1, scrollVel = 0;

function readScroll() {
  const y = window.scrollY;
  const d = y - lastScrollY;
  if (Math.abs(d) > 0.4) scrollDir = d > 0 ? 1 : -1;
  scrollVel = lerp(scrollVel, Math.min(Math.abs(d) / 42, 1), 0.12);
  lastScrollY = y;

  const doc = document.documentElement.scrollHeight - window.innerHeight;
  const pct = Math.round((y / (doc || 1)) * 100);
  railScroll.textContent = `SCROLL ${String(pct).padStart(3, '0')}%`;
  hint.classList.toggle('hide', y > window.innerHeight * 0.4);
}

/* ═══════════════════════════════════════════════════════════
   STORM — lightning flashes + synthesised thunder
   A strike is a burst of flickers; STRIKE_GAP is the beat between the
   flickers inside one strike. Strikes themselves recur on a random
   interval so it reads as weather rather than a strobe.
   ═══════════════════════════════════════════════════════════ */
const STRIKE_GAP   = 500;          // ms between flickers within a strike
const STRIKE_EVERY = [3200, 7000]; // ms between strikes (random in range)

const stormFlash = document.getElementById('stormFlash');
const stormBolt  = document.getElementById('stormBolt');
const boltPath   = document.getElementById('boltPath');
const boltGlow   = document.getElementById('boltGlow');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── thunder: filtered noise + sub rumble, scaled to master volume ── */
let audioCtx = null, thunderOn = true;

function initAudio() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function getMasterVolume() {
  if (isMuted) return 0;
  return masterVolume > 0 ? masterVolume : 0.20;
}

function playThunder(power = 1) {
  const vol = getMasterVolume();
  if (vol <= 0.001) return; // Completely silent when muted or sound is off!

  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const dur = 2.2 + Math.random() * 2.4 * power;

  // noise burst = the crack
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;          // brown-ish noise
    d[i] = last * 3.2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400 * power, now);
  lp.frequency.exponentialRampToValueAtTime(90, now + dur);   // distance rolloff

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 28;

  // Master thunder volume node mapped to volume slider
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55 * power, now + 0.04);  // crack
  gain.gain.exponentialRampToValueAtTime(0.16 * power, now + 0.5);   // body
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);         // rumble tail

  // sub-bass shove you feel more than hear
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(58, now);
  sub.frequency.exponentialRampToValueAtTime(24, now + dur * 0.8);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(0.32 * power, now + 0.12);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);

  src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(masterGain);
  sub.connect(subGain); subGain.connect(masterGain);
  masterGain.connect(ctx.destination);

  src.start(now); src.stop(now + dur);
  sub.start(now); sub.stop(now + dur);
}

/* ── bolt geometry: recursive jagged polyline with forks ── */
function makeBolt() {
  const x0 = 80 + Math.random() * 840;
  let x = x0, y = 0;
  let dPath = `M ${x.toFixed(0)} 0`;
  const steps = 14 + Math.floor(Math.random() * 8);
  const forks = [];
  const drift = (Math.random() - 0.5) * 40;

  for (let i = 1; i <= steps; i++) {
    y = (i / steps) * (620 + Math.random() * 300);
    x += drift + (Math.random() - 0.5) * 130;
    x = Math.max(20, Math.min(980, x));
    dPath += ` L ${x.toFixed(0)} ${y.toFixed(0)}`;
    if (Math.random() < 0.30 && i > 3) {
      let fx = x, fy = y, f = `M ${x.toFixed(0)} ${y.toFixed(0)}`;
      const fs = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < fs; k++) {
        fx += (Math.random() - 0.5) * 150;
        fy += 40 + Math.random() * 80;
        f += ` L ${fx.toFixed(0)} ${fy.toFixed(0)}`;
      }
      forks.push(f);
    }
  }
  return { d: dPath + ' ' + forks.join(' '), x: x0 / 1000 };
}

let stormTimer = null;

function flicker(el, peak, ms) {
  el.style.transition = 'none';
  el.style.opacity = String(peak);
  requestAnimationFrame(() => {
    el.style.transition = `opacity ${ms}ms cubic-bezier(.22,1,.36,1)`;
    el.style.opacity = '0';
  });
}

function strike() {
  const heavy = Math.random() < 0.55;           // heavy = visible bolt
  const power = heavy ? 1 : 0.55 + Math.random() * 0.25;

  if (heavy) {
    const b = makeBolt();
    boltPath.setAttribute('d', b.d);
    boltGlow.setAttribute('d', b.d);
    stormFlash.style.setProperty('--bx', (b.x * 100).toFixed(0) + '%');
    flicker(stormBolt, 1, 190);
  } else {
    stormFlash.style.setProperty('--bx', (15 + Math.random() * 70).toFixed(0) + '%');
  }

  flicker(stormFlash, heavy ? 0.9 : 0.42, heavy ? 380 : 300);

  // the second beat of the same strike, one STRIKE_GAP later
  const beats = heavy ? 1 + Math.floor(Math.random() * 2) : 1;
  for (let i = 1; i <= beats; i++) {
    setTimeout(() => {
      flicker(stormFlash, (heavy ? 0.7 : 0.3) * (1 - i * 0.2), 260);
      if (heavy && i === 1) flicker(stormBolt, 0.75, 140);
    }, STRIKE_GAP * i);
  }

  // thunder trails the flash by the speed of sound
  setTimeout(() => playThunder(power), heavy ? 260 : 620);

  const [lo, hi] = STRIKE_EVERY;
  stormTimer = setTimeout(strike, lo + Math.random() * (hi - lo));
}

if (!reducedMotion) stormTimer = setTimeout(strike, 1800);

/* ── ambient theme & sound toggle ── */
let bgThemeAudio = null;
let isThemePlaying = false;
let masterVolume = 0.20; // Default 20% volume
let isMuted = false;
let savedVolume = 0.20;

function initBackgroundTheme() {
  if (!bgThemeAudio) {
    bgThemeAudio = new Audio('/itachi-theme.mp3');
    bgThemeAudio.loop = true;
    bgThemeAudio.volume = masterVolume;
    bgThemeAudio.addEventListener('error', () => {
      bgThemeAudio = new Audio('/itachi_uchiha_theme.mp3.mpeg');
      bgThemeAudio.loop = true;
      bgThemeAudio.volume = masterVolume;
    });
  }
}

function startBackgroundTheme() {
  initBackgroundTheme();
  if (bgThemeAudio && !isThemePlaying) {
    const playPromise = bgThemeAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isThemePlaying = true;
        isMuted = false;
        if (soundState) soundState.textContent = 'ON';
        if (soundToggle) soundToggle.setAttribute('aria-pressed', 'true');
        if (quickMuteBtn) quickMuteBtn.textContent = '🔇 MUTE';
      }).catch(() => {});
    }
  }
}

function toggleThemeAudio() {
  initBackgroundTheme();
  if (isThemePlaying) {
    if (bgThemeAudio) bgThemeAudio.pause();
    isThemePlaying = false;
    isMuted = true;
    if (soundState) soundState.textContent = 'OFF';
    if (soundToggle) soundToggle.setAttribute('aria-pressed', 'false');
    if (quickMuteBtn) quickMuteBtn.textContent = '🔊 UNMUTE';
  } else {
    if (bgThemeAudio) {
      const playPromise = bgThemeAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          isThemePlaying = true;
          isMuted = false;
          if (soundState) soundState.textContent = 'ON';
          if (soundToggle) soundToggle.setAttribute('aria-pressed', 'true');
          if (quickMuteBtn) quickMuteBtn.textContent = '🔇 MUTE';
        }).catch(() => {});
      }
    }
  }
}

const soundWidget = document.getElementById('soundWidget');
const soundToggle = document.getElementById('soundToggle');
const soundState  = document.getElementById('soundState');
const soundPanel  = document.getElementById('soundPanel');
const soundPanelClose = document.getElementById('soundPanelClose');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue  = document.getElementById('volumeValue');
const masterSoundSwitch = document.getElementById('masterSoundSwitch');
const masterSoundSwitchText = document.getElementById('masterSoundSwitchText');
const mobileSoundToggle = document.getElementById('mobileSoundToggle');
const mobileSoundState  = document.getElementById('mobileSoundState');

function syncAudioUI(vol, muted) {
  const pct = Math.round(vol * 100);
  const pctText = `${pct}%`;
  if (volumeValue) volumeValue.textContent = pctText;
  if (volumeSlider) volumeSlider.value = vol;

  if (mobileSoundState) {
    mobileSoundState.textContent = muted ? 'OFF' : pctText;
  }
  if (soundState) {
    soundState.textContent = muted ? 'OFF' : pctText;
  }
  if (soundToggle) {
    soundToggle.setAttribute('aria-pressed', String(!muted));
  }

  // Update Master Switch button
  if (masterSoundSwitch) {
    if (muted || vol <= 0.001) {
      masterSoundSwitch.classList.remove('active');
      masterSoundSwitch.classList.add('muted');
      const seal = masterSoundSwitch.querySelector('.switch-seal');
      if (seal) seal.textContent = '封';
      if (masterSoundSwitchText) masterSoundSwitchText.textContent = 'AUDIO OFF';
    } else {
      masterSoundSwitch.classList.add('active');
      masterSoundSwitch.classList.remove('muted');
      const seal = masterSoundSwitch.querySelector('.switch-seal');
      if (seal) seal.textContent = '解';
      if (masterSoundSwitchText) masterSoundSwitchText.textContent = 'AUDIO ON';
    }
  }

  // Update preset buttons highlight
  document.querySelectorAll('.sound-preset-btn').forEach(btn => {
    const bVol = parseFloat(btn.dataset.vol);
    if (!isNaN(bVol)) {
      if (muted && bVol === 0) {
        btn.classList.add('active');
      } else if (!muted && Math.abs(bVol - vol) < 0.05) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
}

function toggleSoundPanel(open) {
  if (!soundPanel) return;
  const willOpen = typeof open === 'boolean' ? open : !soundPanel.classList.contains('open');
  soundPanel.classList.toggle('open', willOpen);
  soundPanel.setAttribute('aria-hidden', String(!willOpen));

  const ctx = initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function setMasterVolumeLevel(val) {
  const clamped = Math.max(0, Math.min(1, val));
  initBackgroundTheme();
  masterVolume = clamped;
  if (clamped <= 0.001) {
    isMuted = true;
    if (bgThemeAudio) {
      try { bgThemeAudio.volume = 0; } catch (e) {}
    }
    syncAudioUI(0, true);
  } else {
    isMuted = false;
    savedVolume = clamped;
    if (bgThemeAudio) {
      try { bgThemeAudio.volume = clamped; } catch (e) {}
    }
    if (!isThemePlaying) startBackgroundTheme();
    syncAudioUI(clamped, false);
  }
}

function toggleMasterChakra() {
  initBackgroundTheme();
  const ctx = initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

  if (!isMuted && masterVolume > 0.001) {
    savedVolume = masterVolume;
    masterVolume = 0;
    isMuted = true;
    if (bgThemeAudio) {
      try { bgThemeAudio.volume = 0; } catch (e) {}
    }
    syncAudioUI(0, true);
  } else {
    isMuted = false;
    masterVolume = savedVolume > 0.001 ? savedVolume : 0.20;
    if (bgThemeAudio) {
      try { bgThemeAudio.volume = masterVolume; } catch (e) {}
    }
    syncAudioUI(masterVolume, false);
    startBackgroundTheme();
  }
}

// Sound toggle buttons open the Audio HUD Popover
if (soundToggle) {
  soundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPanel();
  });
}

if (mobileSoundToggle) {
  mobileSoundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPanel();
  });
}

if (soundPanelClose) {
  soundPanelClose.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPanel(false);
  });
}

if (masterSoundSwitch) {
  masterSoundSwitch.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMasterChakra();
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    setMasterVolumeLevel(parseFloat(e.target.value));
  });
}

// Preset Buttons (0%, 25%, 35%, 70%, 100%)
document.querySelectorAll('.sound-preset-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const v = parseFloat(btn.dataset.vol);
    if (!isNaN(v)) {
      setMasterVolumeLevel(v);
    }
  });
});

if (soundPanel) {
  soundPanel.addEventListener('click', e => e.stopPropagation());
}

document.addEventListener('click', () => {
  if (soundPanel && soundPanel.classList.contains('open')) {
    toggleSoundPanel(false);
  }
});

/* ═════════════════════ resize ═════════════════════ */
function resizeAll() {
  mainCtx = fitCanvas(mainCanvas);
  fCtx    = fitCanvas(featherCanvas);
  eyeCtx  = fitCanvas(eyeCanvas);
  amaCtx  = fitCanvas(amaCanvas);
  lastDrawn = -1; eyeLastKey = '';
  seedFeathers();
  seedFlames(); amaPainted = false;
  ghost.resize();
}
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resizeAll, 140); });

/* ═════════════════════ main loop ═════════════════════ */
let hadFeathers = false;

function tick() {
  readScroll();
  readScrub();

  /* — Amaterasu: only paint when contact section is actually in viewport — */
  const amaRect = amaCanvas.getBoundingClientRect();
  const amaVisible = amaRect.top < window.innerHeight && amaRect.bottom > 0;
  if (!reduceMotion && !document.hidden && amaVisible && !isAutoScrubbing) {
    paintAmaterasu(performance.now() / 1000);
  } else if (!amaPainted && amaVisible) { 
    paintAmaterasu(0); 
    amaPainted = true; 
  }

  /* — Act I: scrubbed frames — */
  if (isAutoScrubbing) {
    frameShown = frameTarget;
  } else {
    frameShown = 0;
    frameTarget = 0;
  }

  const idx = Math.round(clamp(frameShown, 0, MAIN_COUNT - 1));
  if (idx !== lastDrawn) {
    const w = mainCanvas.width, h = mainCanvas.height;
    mainCtx.clearRect(0, 0, w, h);
    if (drawCover(mainCtx, mainFrames[idx], w, h)) lastDrawn = idx;
  }
  paintOverlays(scrubProgress);

  /* — feathers: fly forward only during cinematic awakening sequence — */
  if (isAutoScrubbing && scrubProgress > 0.38) {
    hadFeathers = true;
    const fw = featherCanvas.width, fh = featherCanvas.height;
    fCtx.clearRect(0, 0, fw, fh);
    const fIntensity = clamp((scrubProgress - 0.38) / 0.32);
    for (const f of feathers) {
      f.x += f.vx * 0.005;
      f.y += Math.sin(f.sway) * 0.001 + f.vx * 0.0015;
      f.sway += 0.03;
      f.rot  += f.spin * 0.8;
      if (f.x > 1.15) f.x = -0.15;
      if (f.x < -0.15) f.x = 1.15;
      if (f.y > 1.15) f.y = -0.15;
      if (f.y < -0.15) f.y = 1.15;
      drawFeather(fCtx, f, fw, fh, 1, fIntensity);
    }
  } else if (hadFeathers) {
    fCtx.clearRect(0, 0, featherCanvas.width, featherCanvas.height);
    hadFeathers = false;
  }

  /* — Act II: gaze follows the pointer or focused target node — */
  const targetX = targetGazeOverride !== null ? targetGazeOverride : mx;
  ex = lerp(ex, targetX, targetGazeOverride !== null ? 0.16 : 0.08);
  ey = lerp(ey, my, 0.08);

  const eyeRect = eyesSection.getBoundingClientRect();
  const eyeVisible = eyeRect.top < window.innerHeight && eyeRect.bottom > 0;

  if (eyeVisible) {
    /* pointer X walks the monotonic gaze table — left stays left, right stays
       right. The image itself never moves; only which frame is shown changes. */
    gazePos = lerp(gazePos, ex * (GAZE_LUT.length - 1), 0.14);
    const g = clamp(gazePos, 0, GAZE_LUT.length - 1);
    const i0 = Math.floor(g), i1 = Math.min(i0 + 1, GAZE_LUT.length - 1);
    const t = g - i0;
    const key = `${i0}|${t.toFixed(2)}`;

    if (key !== eyeLastKey) {
      const w = eyeCanvas.width, h = eyeCanvas.height;
      eyeCtx.clearRect(0, 0, w, h);
      // crossfade the two nearest gaze frames so the sweep reads continuous
      eyeCtx.globalAlpha = 1;
      const okA = drawCover(eyeCtx, eyeFrames[GAZE_LUT[i0].idx], w, h, 1.18);
      if (t > 0.01 && i1 !== i0) {
        eyeCtx.globalAlpha = t;
        drawCover(eyeCtx, eyeFrames[GAZE_LUT[i1].idx], w, h, 1.18);
        eyeCtx.globalAlpha = 1;
      }
      if (okA) eyeLastKey = key;
    }

    eyeFlare.style.setProperty('--mx', (ex * 100).toFixed(1) + '%');
    eyeFlare.style.setProperty('--my', (ey * 100).toFixed(1) + '%');

    const axis = (ex - 0.5) * 200;
    const dir = axis < -8 ? '左' : axis > 8 ? '右' : '中';
    const focusTag = activeTargetLabel ? ` · [${activeTargetLabel}]` : '';
    eyeReadout.textContent =
      `視線 ${dir} ${Math.abs(axis).toFixed(1).padStart(4, '0')} / FRAME ` +
      String(GAZE_LUT[Math.round(g)].idx + 1).padStart(2, '0') + focusTag;
  }

  /* — Act III: parallax, reveal mask, ghost cursor — */
  paintJutsu();

  const jr = jutsuSection.getBoundingClientRect();
  if (jr.top < window.innerHeight && jr.bottom > 0) {
    revealX = lerp(revealX, revealTX, 0.13);
    revealY = lerp(revealY, revealTY, 0.13);
    revealR = lerp(revealR, jutsuLit ? revealRT : 0, 0.09);
    const rs = jutsuSection.style;
    rs.setProperty('--rx', (revealX * 100).toFixed(2) + '%');
    rs.setProperty('--ry', (revealY * 100).toFixed(2) + '%');
    rs.setProperty('--r',  revealR.toFixed(0) + 'px');
    if (ghost.ok && (jutsuLit || revealR > 1)) ghost.render();
  }

  /* — cursor — */
  if (cursorEl) {
    cx = lerp(cx, cursorX, 0.25);
    cy = lerp(cy, cursorY, 0.25);
    cursorEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ═════════════════════ reveals ═════════════════════ */
/* #jutsu is excluded — it runs the scroll-driven parallax instead */
document.querySelectorAll(
  '.quote__jp, .quote blockquote, .quote__mark, .footer__big, .footer__row'
).forEach((el, i) => {
  el.setAttribute('data-reveal', '');
  if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', i % 4);
});

const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.18 });
document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

// Ensure reload ALWAYS resets to the top landing page
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);
if (window.location.hash) {
  history.replaceState(null, document.title, window.location.pathname + window.location.search);
}

window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});

/* ═════════════════════ CINEMATIC AWAKENING PORTAL & TSUKUYOMI LOCK ═════════════════════ */
let isAutoScrubbing = false;
let isAwakened = false;
let targetGazeOverride = null;
let activeTargetLabel = '';

function lockTsukuyomi() {
  isAwakened = false;
  document.body.classList.add('tsukuyomi-locked');
  document.documentElement.classList.add('tsukuyomi-locked');
  const lockup = document.getElementById('tsukuyomiLockup');
  if (lockup) {
    lockup.classList.remove('dissolved');
    lockup.style.pointerEvents = 'auto';
  }
}

function unlockTsukuyomi() {
  isAwakened = true;
  document.body.classList.remove('tsukuyomi-locked');
  document.documentElement.classList.remove('tsukuyomi-locked');
  // On mobile: reveal the commune/AI orb whenever the user moves past the hero screen
  if (window.innerWidth <= 860) {
    const orb = document.getElementById('aiSummonOrb');
    if (orb) orb.classList.add('awake');
  }
}

// Initial state: Always start locked on the hero landing screen
lockTsukuyomi();
window.scrollTo(0, 0);

function pulseTsukuyomiButton() {
  const btn = document.getElementById('enterGenjutsuBtn');
  if (btn) {
    btn.classList.remove('btn-pulse');
    void btn.offsetWidth; // trigger reflow
    btn.classList.add('btn-pulse');
  }
}

const mangekyoAudio = new Audio('/mangekyo.mp3');
mangekyoAudio.preload = 'auto';

function playAwakeningSound() {
  if (isMuted) return;
  const vol = masterVolume > 0 ? masterVolume : 0.20;
  const targetSFXVol = Math.min(1, Math.max(0.65, vol * 2.2));

  // Resume Web Audio immediately on user interaction
  const ctx = initAudio();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // 1. Play authentic Mangekyo Sharingan sound effect
  try {
    mangekyoAudio.currentTime = 0;
    mangekyoAudio.volume = targetSFXVol;
    const playPromise = mangekyoAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const fb = new Audio('/mangekio_sharingan.mp3.mpeg');
        fb.volume = targetSFXVol;
        fb.play().catch(() => {
          const fb2 = new Audio('/sharingan.mp3');
          fb2.volume = targetSFXVol;
          fb2.play().catch(() => {});
        });
      });
    }
  } catch (e) {}

  // 2. Synthesize deep atmospheric sub-bass pulse scaled to volume
  if (ctx) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(vol, now);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(65, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 3.8);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.55, now + 0.18);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

    sub.connect(subGain);
    subGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    sub.start(now);
    sub.stop(now + 4.1);
  }
}

function startCinematicAwakening() {
  if (isAutoScrubbing) return;
  unlockTsukuyomi();
  isAutoScrubbing = true;

  const lockup = document.getElementById('tsukuyomiLockup');
  if (lockup) {
    lockup.classList.add('dissolved');
    lockup.style.pointerEvents = 'none';
  }

  // Trigger audio immediately on user gesture
  playAwakeningSound();

  const aboutSec = document.getElementById('about');
  const targetY = aboutSec ? aboutSec.offsetTop : window.innerHeight;
  const startY = window.scrollY;
  const isMobile = window.innerWidth <= 860;
  // Extended 3.8s duration for an extra smooth, majestic awakening and crow sequence
  const duration = 3800;
  const startTime = performance.now();

  // Piecewise curve calibrated to the 72 frames:
  // 0% - 25%: Eyes open smoothly (frames 1 to 25)
  // 25% - 62%: Sharingan ignites, spins, and focuses (frames 25 to 52)
  // 62% - 82%: Explosive crow dispersion across the full screen (frames 53 to 71)
  // 82% - 100%: Holds final crow frame as the screen smoothly glides down into About
  function awakeningCurve(t) {
    if (t < 0.25) {
      const k = t / 0.25;
      return 0.35 * (1 - Math.pow(1 - k, 2.2));
    } else if (t < 0.62) {
      const k = (t - 0.25) / 0.37;
      const easeK = 0.5 * (1 - Math.cos(k * Math.PI));
      return 0.35 + 0.38 * easeK;
    } else if (t < 0.82) {
      const k = (t - 0.62) / 0.20;
      return 0.73 + 0.27 * (1 - Math.pow(1 - k, 1.7));
    } else {
      return 1.0;
    }
  }

  // Temporarily set scrollBehavior to auto so RAF window.scrollTo does not fight CSS smooth scroll
  document.documentElement.style.scrollBehavior = 'auto';

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = awakeningCurve(progress);

    // Directly drive the canvas frame from the calibrated curve
    scrubProgress = eased;
    frameTarget = eased * (MAIN_COUNT - 1);
    frameShown = frameTarget;

    // Smooth scroll transition begins as crows disperse across the screen (progress >= 0.76)
    if (progress >= 0.76) {
      const sp = (progress - 0.76) / 0.24;
      // Hermite smooth cubic ease: 3*sp^2 - 2*sp^3 for a silky, gentle glide down
      const scrollEase = sp * sp * (3 - 2 * sp);
      window.scrollTo(0, startY + (targetY - startY) * scrollEase);
    } else if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
      document.documentElement.style.scrollBehavior = 'smooth';
      isAutoScrubbing = false;
      hasCompletedAwakening = true;
      // Fade out feathers smoothly instead of instantaneous harsh wipe
      if (featherCanvas) {
        featherCanvas.style.transition = 'opacity 0.6s ease';
        featherCanvas.style.opacity = '0';
        setTimeout(() => {
          fCtx.clearRect(0, 0, featherCanvas.width, featherCanvas.height);
          featherCanvas.style.opacity = '1';
          featherCanvas.style.transition = '';
          hadFeathers = false;
        }, 650);
      } else {
        hadFeathers = false;
      }
      // After entering / awakening completes, play the Itachi theme if not muted
      if (!isMuted && masterVolume > 0) {
        startBackgroundTheme();
      }
      // On mobile: reveal the commune orb now that the cinematic is done
      if (window.innerWidth <= 860) {
        const orb = document.getElementById('aiSummonOrb');
        if (orb) {
          orb.classList.add('awake');
        }
      }
    }

  }

  requestAnimationFrame(step);
}

const enterGenjutsuBtn = document.getElementById('enterGenjutsuBtn');
if (enterGenjutsuBtn) {
  let touchAwakened = false;
  const triggerAwakening = (e) => {
    if (touchAwakened) return;
    touchAwakened = true;
    setTimeout(() => { touchAwakened = false; }, 800);
    e.preventDefault();
    e.stopPropagation();
    startCinematicAwakening();
  };
  enterGenjutsuBtn.addEventListener('click', triggerAwakening);
  enterGenjutsuBtn.addEventListener('touchend', triggerAwakening, { passive: false });
}

// Keyboard shortcut: Space or Enter triggers awakening when on landing screen
window.addEventListener('keydown', (e) => {
  if (window.scrollY <= 20 && !isAutoScrubbing) {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        startCinematicAwakening();
      } else if (['ArrowDown', 'PageDown'].includes(e.code)) {
        if (!isAwakened) {
          e.preventDefault();
          pulseTsukuyomiButton();
        }
      }
    }
  }
});

// Intercept scroll wheel attempts on locked landing screen
window.addEventListener('wheel', (e) => {
  if (!isAwakened && window.scrollY <= 15 && e.deltaY > 0 && !isAutoScrubbing) {
    e.preventDefault();
    pulseTsukuyomiButton();
  }
}, { passive: false });

// Intercept touch swipe attempts on locked landing screen and handle mobile pull-to-refresh
const mobilePullRefresh = document.getElementById('mobilePullRefresh');
const pullRefreshIcon   = document.getElementById('pullRefreshIcon');
const pullRefreshText   = document.getElementById('pullRefreshText');
const pullRefreshJp     = document.getElementById('pullRefreshJp');

let touchLandingStartY = 0;
let touchLandingStartX = 0;
let isPullingToRefresh = false;
let pullDistance = 0;
let pullThresholdMet = false;
let hasVibrated = false;

window.addEventListener('touchstart', (e) => {
  if (e.touches && e.touches[0]) {
    touchLandingStartY = e.touches[0].clientY;
    touchLandingStartX = e.touches[0].clientX;
  }
  // If at the top of the first page on mobile, arm pull-to-refresh
  if (window.innerWidth <= 860 && window.scrollY <= 8 && e.touches && e.touches[0]) {
    isPullingToRefresh = true;
    pullDistance = 0;
    pullThresholdMet = false;
    hasVibrated = false;
    if (mobilePullRefresh) {
      mobilePullRefresh.style.transition = 'none';
    }
  } else {
    isPullingToRefresh = false;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!e.touches || !e.touches[0]) return;
  const currentY = e.touches[0].clientY;
  const currentX = e.touches[0].clientX;
  const dy = touchLandingStartY - currentY; // positive = user swiped UP (scrolls down)
  const pullDown = currentY - touchLandingStartY; // positive = user pulled DOWN (scrolls up above top)
  const dx = Math.abs(currentX - touchLandingStartX);

  // 1. Mobile Pull-to-Refresh: user scrolls up / pulls down at top of first page
  if (isPullingToRefresh && window.innerWidth <= 860 && window.scrollY <= 5 && pullDown > 0 && pullDown > dx) {
    pullDistance = pullDown;
    const visualOffset = Math.min(75, Math.pow(pullDistance, 0.82) * 1.5);
    const rotation = pullDistance * 2.8;

    if (mobilePullRefresh) {
      mobilePullRefresh.style.transform = `translate(-50%, ${visualOffset - 50}px)`;
      mobilePullRefresh.style.opacity = String(Math.min(1, visualOffset / 35));
    }

    if (pullRefreshIcon) {
      pullRefreshIcon.style.transform = `rotate(${rotation}deg)`;
    }

    if (pullDistance >= 65) {
      if (!pullThresholdMet) {
        pullThresholdMet = true;
        if (mobilePullRefresh) mobilePullRefresh.classList.add('ready');
        if (pullRefreshText) pullRefreshText.textContent = 'RELEASE TO RELOAD';
        if (pullRefreshJp) pullRefreshJp.textContent = '幻術解除 · 離して更新';
        if (!hasVibrated && navigator.vibrate) {
          try { navigator.vibrate(22); } catch (err) {}
          hasVibrated = true;
        }
      }
    } else {
      if (pullThresholdMet) {
        pullThresholdMet = false;
        if (mobilePullRefresh) mobilePullRefresh.classList.remove('ready');
        if (pullRefreshText) pullRefreshText.textContent = 'PULL TO RELOAD';
        if (pullRefreshJp) pullRefreshJp.textContent = '現実を再同期 · SHARINGAN';
      }
    }

    if (pullDown > 10 && e.cancelable) {
      e.preventDefault();
    }
    return;
  }

  // 2. Locked Landing Screen: prevent scrolling down into About until awakened
  if (!isAwakened && window.scrollY <= 15 && dy > 10 && !isAutoScrubbing) {
    if (e.cancelable) e.preventDefault();
    pulseTsukuyomiButton();
  }
}, { passive: false });

const handlePullRefreshEnd = () => {
  if (!isPullingToRefresh || window.innerWidth > 860) return;
  isPullingToRefresh = false;

  if (pullThresholdMet) {
    if (mobilePullRefresh) {
      mobilePullRefresh.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease';
      mobilePullRefresh.style.transform = 'translate(-50%, 25px)';
      mobilePullRefresh.classList.add('refreshing');
    }
    if (pullRefreshText) pullRefreshText.textContent = 'RELOADING REALITY...';
    if (pullRefreshJp) pullRefreshJp.textContent = '同期中 · REFRESHING';
    if (pullRefreshIcon) pullRefreshIcon.classList.add('spinning');

    setTimeout(() => {
      window.location.reload();
    }, 280);
  } else {
    if (mobilePullRefresh) {
      mobilePullRefresh.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
      mobilePullRefresh.style.transform = 'translate(-50%, -130%)';
      mobilePullRefresh.style.opacity = '0';
      mobilePullRefresh.classList.remove('ready');
    }
  }
};

window.addEventListener('touchend', handlePullRefreshEnd, { passive: true });
window.addEventListener('touchcancel', handlePullRefreshEnd, { passive: true });

// Re-lock when scrolling back up to top
window.addEventListener('scroll', () => {
  if (window.scrollY <= 5 && !isAutoScrubbing && isAwakened) {
    lockTsukuyomi();
  }
}, { passive: true });

// Mobile navigation drawer toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileDrawerClose = document.getElementById('mobileDrawerClose');
const chromeNav = document.querySelector('.chrome__nav');

function setMobileNav(open) {
  if (!chromeNav) return;
  const willOpen = typeof open === 'boolean' ? open : !chromeNav.classList.contains('open');
  chromeNav.classList.toggle('open', willOpen);
  if (mobileMenuBtn) {
    mobileMenuBtn.classList.toggle('active', willOpen);
    mobileMenuBtn.setAttribute('aria-expanded', String(willOpen));
  }
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobileNav();
  });
}

if (mobileDrawerClose) {
  mobileDrawerClose.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobileNav(false);
  });
}

// Close mobile drawer on resize to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 860 && chromeNav && chromeNav.classList.contains('open')) {
    setMobileNav(false);
  }
});

// Chrome Nav Links: clicking any nav link unlocks scroll immediately and closes mobile drawer
document.querySelectorAll('.chrome__nav a').forEach(link => {
  link.addEventListener('click', () => {
    unlockTsukuyomi();
    setMobileNav(false);
  });
});

// Logo click: smooth return to top (Tsukuyomi landing)
const chromeLogo = document.getElementById('chromeLogo') || document.querySelector('.chrome__mark');
if (chromeLogo) {
  chromeLogo.addEventListener('click', () => {
    unlockTsukuyomi();
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      if (window.scrollY <= 5) lockTsukuyomi();
    }, 600);
  });
}

// Touch drag interaction for Amaterasu on mobile
if (jutsuSection) {
  const handleJutsuTouch = (e) => {
    if (!e.touches || !e.touches[0]) return;
    const t = e.touches[0];
    const r = jutsuSection.getBoundingClientRect();
    if (t.clientY >= r.top && t.clientY <= r.bottom) {
      revealTX = clamp((t.clientX - r.left) / Math.max(1, r.width));
      revealTY = clamp((t.clientY - r.top) / Math.max(1, r.height));
      ghost.move(revealTX, revealTY, true);
      setLit(true);
    }
  };
  jutsuSection.addEventListener('touchstart', handleJutsuTouch, { passive: true });
  jutsuSection.addEventListener('touchmove', handleJutsuTouch, { passive: true });
}

/* ═════════════════════ SKILLS & PROJECTS GAZE HOVER ═════════════════════ */
document.querySelectorAll('.gaze-node').forEach(node => {
  node.addEventListener('mouseenter', () => {
    const val = parseFloat(node.dataset.gaze);
    if (!isNaN(val)) {
      targetGazeOverride = val;
      activeTargetLabel = node.querySelector('.node-title')?.textContent || '';
      node.classList.add('active-gaze');
      if (eyeFlare) eyeFlare.style.opacity = '0.5';
    }
  });

  node.addEventListener('mouseleave', () => {
    targetGazeOverride = null;
    activeTargetLabel = '';
    node.classList.remove('active-gaze');
    if (eyeFlare) eyeFlare.style.opacity = '';
  });
});

/* ═════════════════════ ABOUT SECTION INTERACTIVITY & PARALLAX ═════════════════════ */
const aboutSectionEl = document.getElementById('about');
const aboutBackdropKanji = document.querySelector('.about-backdrop-kanji');

if (aboutSectionEl && aboutBackdropKanji) {
  aboutSectionEl.addEventListener('mousemove', (e) => {
    const rect = aboutSectionEl.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    aboutBackdropKanji.style.transform = `translate3d(${(-nx * 35).toFixed(1)}px, ${(-ny * 25).toFixed(1)}px, 0)`;
  });

  aboutSectionEl.addEventListener('mouseleave', () => {
    aboutBackdropKanji.style.transform = 'translate3d(0, 0, 0)';
    aboutBackdropKanji.style.transition = 'transform 0.6s ease';
  });

  aboutSectionEl.addEventListener('mouseenter', () => {
    aboutBackdropKanji.style.transition = 'none';
  });
}

// Interactive toast notification for About interactions
let activeToastTimeout = null;
function showAboutToast(message) {
  let toast = document.getElementById('shinobiToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shinobiToast';
    toast.className = 'shinobi-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-seal">印</span> <span>${escapeHtml(message)}</span>`;
  toast.classList.add('visible');
  
  if (activeToastTimeout) clearTimeout(activeToastTimeout);
  activeToastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2800);
}

// Interactive Shinobi Tech Tags Click
document.querySelectorAll('.shinobi-tech-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const tech = tag.dataset.tech || tag.textContent.trim();
    showAboutToast(`SHINOBI ARSENAL: ${tech} verified`);
  });
});

// Interactive Philosophy Stat Cards Click
document.querySelectorAll('.p-stat-card').forEach(card => {
  card.addEventListener('click', () => {
    const val = card.querySelector('.p-stat-val')?.textContent || '';
    const label = card.querySelector('.p-stat-label')?.textContent || '';
    showAboutToast(`TELEMETRY VERIFIED // ${label}: ${val}`);
  });
});

// Interactive Shinobi Lineage Entry Click
document.querySelectorAll('.lineage-entry').forEach(entry => {
  entry.addEventListener('click', () => {
    const title = entry.querySelector('.lineage-title')?.textContent || 'HONOR';
    const badge = entry.querySelector('.lineage-badge')?.textContent || 'SEAL';
    showAboutToast(`LINEAGE SEAL [${badge}] · ${title}`);
  });
});

// Interactive Project Tech Pills Click
document.querySelectorAll('.shinobi-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const tech = pill.dataset.tech || pill.textContent.trim();
    showAboutToast(`PROJECT STACK // ${tech} active`);
  });
});

// Project Entry Watermark Parallax
document.querySelectorAll('.project-entry').forEach(entry => {
  const wm = entry.querySelector('.project-entry__watermark');
  if (wm) {
    entry.addEventListener('mousemove', (e) => {
      const rect = entry.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      wm.style.transform = `translate3d(${(nx * 20).toFixed(1)}px, ${(ny * 15).toFixed(1)}px, 0)`;
    });
    entry.addEventListener('mouseleave', () => {
      wm.style.transform = 'translate3d(0, 0, 0)';
      wm.style.transition = 'transform 0.5s ease';
    });
    entry.addEventListener('mouseenter', () => {
      wm.style.transition = 'none';
    });
  }
});

/* ═════════════════════ CONTACT FORM DISPATCH (DIRECT AJAX TO EMAIL) ═════════════════════ */
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const msgInput = document.getElementById('contactMsg');
    const submitBtn = contactForm.querySelector('.transmit-btn');

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const msg = msgInput?.value.trim() || '';

    if (!name || !email || !msg) return;

    // UI Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="transmit-seal">印</span>
        <span class="transmit-text">COMMUNING GATEWAY...</span>
      `;
    }

    if (formStatus) {
      formStatus.style.color = 'var(--blood-hot)';
      formStatus.innerHTML = `<span>[GATEWAY ACTIVE]: SUMMONING CROW TRANSMISSION TO RISHI RAJ SHARMA...</span>`;
    }

    // Audio cue
    playThunder(0.7);

    try {
      const response = await fetch('https://formsubmit.co/ajax/rishisharma21950@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email,
          message: msg,
          _subject: `[Tsukuyomi Portfolio] Transmission from ${name}`,
          _template: 'box',
          _captcha: 'false'
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && (data.success === 'true' || data.success === true || data.message || response.status === 200)) {
        if (formStatus) {
          formStatus.style.color = '#7ee787';
          formStatus.innerHTML = `<strong>✓ DISPATCH TRANSMITTED:</strong> Message delivered directly to Rishi Raj Sharma's inbox (<span style="color: #fff;">rishisharma21950@gmail.com</span>).`;
        }
        contactForm.reset();
        showAboutToast(`TRANSMISSION DELIVERED TO RISHI RAJ SHARMA`);
      } else {
        throw new Error(data.message || 'Form transmission error.');
      }
    } catch (err) {
      console.warn('FormSubmit AJAX fallback to mailto:', err);
      if (formStatus) {
        formStatus.style.color = '#ffb703';
        formStatus.innerHTML = `<span>[FALLBACK ENGAGED]: Routing dispatch through direct transmission stream...</span>`;
      }
      // Fallback to mailto so user message is never lost
      const mailtoUrl = `mailto:rishisharma21950@gmail.com?subject=${encodeURIComponent('Tsukuyomi Transmission from ' + name)}&body=${encodeURIComponent(msg + '\n\nFrom: ' + name + ' (' + email + ')')}`;
      window.location.href = mailtoUrl;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span class="transmit-seal">印</span>
          <span class="transmit-text">SUMMON TRANSMISSION</span>
          <span class="transmit-arrow">→</span>
        `;
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   ACT IV — TSUKUYOMI INTELLIGENCE TERMINAL CONTROLLER
   ═══════════════════════════════════════════════════════════ */
const termScreen = document.getElementById('termScreen');
const termForm = document.getElementById('termForm');
const termInput = document.getElementById('termInput');
const termSendBtn = document.getElementById('termSendBtn');
const termAbortBtn = document.getElementById('termAbortBtn');
const termProviderTag = document.getElementById('termProviderTag');
const aiStatusBadge = document.getElementById('aiStatusBadge');
const aiSummonOrb = document.getElementById('aiSummonOrb');

let chatHistory = [];
let isGenerating = false;
let currentAbortController = null;

// Initial greeting & boot sequence
function initTerminal() {
  if (!termScreen) return;
  
  termScreen.innerHTML = `
    <div class="term-msg term-msg--boot">
      <div>RS-WORKSTATION BIOS v4.20 · 2026.09.06 · ALL SUBSYSTEMS NOMINAL</div>
      <div>NEURAL INGESTION: GITHUB @Risshhhiiii · KNOWLEDGE BASE: 7.8k TOKENS SYNCED</div>
      <div>ENGINE: GEMINI // 3.6-FLASH · FALLBACK: GROQ INFERENCE</div>
    </div>
    <div class="term-msg term-msg--bot">
      <div class="bot-tag"><span>印</span> ITACHI UCHIHA // GUARDIAN INTELLIGENCE</div>
      <div class="bot-body">Tsukuyomi link established. I am Itachi — guardian of Rishi Raj Sharma's architecture, distributed microservices, and neural vision telemetry.

State your inquiry or select a chakra seal above. I measure engineering truth, not pleasantries.</div>
    </div>
  `;

  // Pre-initialize system prompt
  getInitializedSystemPrompt().catch(() => {});
}

initTerminal();

// Floating Summon Orb Click
if (aiSummonOrb) {
  aiSummonOrb.addEventListener('click', () => {
    unlockTsukuyomi();
    const intelligenceSection = document.getElementById('intelligence');
    if (intelligenceSection) {
      intelligenceSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        termInput?.focus();
        const terminal = document.getElementById('shinobiTerminal');
        if (terminal) {
          terminal.style.boxShadow = '0 0 50px rgba(255, 43, 43, 0.7)';
          setTimeout(() => { terminal.style.boxShadow = ''; }, 1200);
        }
      }, 700);
    }
  });
}

// Quick Chakra Seals
document.querySelectorAll('.seal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.getAttribute('data-query');
    if (query && !isGenerating) {
      playThunder(0.5);
      if (termInput) termInput.value = query;
      handleSendMessage(query);
    }
  });
});

// Format bot response (markdown headers, italics, code, and bolding)
function formatResponseText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^\*\n]+)\*/g, '<em style="color: #ff7b72;">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(255,43,43,0.15); padding: 2px 6px; border-radius: 4px; color: #ff7b72; font-family: monospace;">$1</code>')
    .replace(/^([A-Z\s\-_]{3,}):/gm, '<strong style="color: #ff5e52; letter-spacing: 0.12em; display: block; margin-top: 0.5rem;">$1:</strong>')
    .replace(/─{4,}/g, '<span style="color: rgba(255,43,43,0.3); display: block; margin: 0.4rem 0;">───────────────────────────</span>');
}

// Send Message Handler
async function handleSendMessage(promptText) {
  const text = (promptText || termInput?.value || '').trim();
  if (!text || isGenerating) return;

  if (termInput) termInput.value = '';
  isGenerating = true;

  // UI state for generating
  if (termSendBtn) termSendBtn.style.display = 'none';
  if (termAbortBtn) termAbortBtn.style.display = 'inline-flex';
  if (termInput) termInput.disabled = true;

  // Append user message
  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'term-msg term-msg--user';
  userMsgEl.innerHTML = `<span class="user-prompt-tag">rishi@workstation:~$</span><span>${escapeHtml(text)}</span>`;
  termScreen.appendChild(userMsgEl);

  // Append bot placeholder
  const botMsgEl = document.createElement('div');
  botMsgEl.className = 'term-msg term-msg--bot';
  botMsgEl.innerHTML = `
    <div class="bot-tag"><span>印</span> ITACHI UCHIHA</div>
    <div class="bot-body"><span class="term-loading-indicator">COMMUNING WITH SHADOWS...</span><span class="cursor-blink"></span></div>
  `;
  termScreen.appendChild(botMsgEl);
  termScreen.scrollTop = termScreen.scrollHeight;

  const botBody = botMsgEl.querySelector('.bot-body');
  currentAbortController = new AbortController();

  try {
    const result = await askItachi(text, {
      history: chatHistory,
      signal: currentAbortController.signal,
      onProviderChange: (provider) => {
        if (termProviderTag) termProviderTag.textContent = `[ENGINE: ${provider}]`;
        if (aiStatusBadge) aiStatusBadge.textContent = `SHADOW ORCHESTRATOR ONLINE // ${provider}`;
      },
      onChunk: (_chunk, accumulated) => {
        if (botBody) {
          botBody.innerHTML = formatResponseText(accumulated) + '<span class="cursor-blink"></span>';
          termScreen.scrollTop = termScreen.scrollHeight;
        }
      }
    });

    if (botBody) {
      botBody.innerHTML = formatResponseText(result.text);
    }

    // Save to history
    chatHistory.push({ id: Math.random().toString(36), role: 'user', content: text });
    chatHistory.push({ id: Math.random().toString(36), role: 'assistant', content: result.text });

  } catch (err) {
    if (err.name === 'AbortError') {
      if (botBody) {
        botBody.innerHTML += '<br><span style="color: #ffb703; font-size: 0.8rem;">[SESSION INTERRUPTED BY USER (^C)]</span>';
      }
    } else {
      if (botBody) {
        botBody.innerHTML = `<span style="color: #ff4a3c;">[ERROR]: ${err.message || 'Transmission failed.'}</span>`;
      }
    }
  } finally {
    isGenerating = false;
    currentAbortController = null;
    if (termSendBtn) termSendBtn.style.display = 'inline-flex';
    if (termAbortBtn) termAbortBtn.style.display = 'none';
    if (termInput) {
      termInput.disabled = false;
      termInput.focus();
    }
    termScreen.scrollTop = termScreen.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Form Submit
if (termForm) {
  termForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });
}

// Abort Button Click
if (termAbortBtn) {
  termAbortBtn.addEventListener('click', () => {
    currentAbortController?.abort();
  });
}

// Keyboard shortcuts (Ctrl+C to abort)
if (termInput) {
  termInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      currentAbortController?.abort();
    }
  });
}

