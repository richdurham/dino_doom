/*
 * A headless stand-in for the browser, so the game in rex-rumble.html can be booted and
 * driven from Node with no dependencies and no real DOM.
 *
 * The game is one big inline <script>. It is run inside a `vm` context whose globals are
 * the stubs below: a 2D canvas that records nothing, a Web Audio graph that only counts
 * what was scheduled, localStorage, and enough of `document` and `window` for boot() to
 * get all the way to the title screen.
 *
 * Top-level `let` / `const` in a script never land on the vm context, so an eval hatch is
 * appended in the script's own scope. `boot()` hands it back as `ev`, and that is how the
 * checks read and poke game state:
 *
 *     const { boot } = require('./harness');
 *     const g = boot('rex-rumble.html');
 *     g.ev("loadLevel(0, true)");
 *     g.ev("update(1/60)");
 *     g.ev("P.hp");
 */
'use strict';
const fs = require('fs');
const vm = require('vm');

/* Each stub canvas gets its own flat colour. If they all shared one, different textures
   would bake to identical shade banks and a caller could not tell a sky pixel from a
   floor pixel in a rendered frame. */
let tintSeq = 0;
function nextTint() {
  const n = (++tintSeq * 2654435761) >>> 0;
  return [40 + (n & 0x7f), 40 + ((n >>> 8) & 0x7f), 40 + ((n >>> 16) & 0x7f)];
}

function makeCtx(cv) {
  const noop = function () {};
  const tint = cv.__tint || (cv.__tint = nextTint());
  return {
    canvas: cv,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', filter: 'none',
    shadowBlur: 0, shadowColor: '', globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, clip: noop, translate: noop, rotate: noop,
    scale: noop, transform: noop, setTransform: noop, resetTransform: noop, drawImage: noop,
    fillText: noop, strokeText: noop, setLineDash: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, putImageData: noop,
    measureText: function () { return { width: 10 }; },
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; },
    createPattern: function () { return {}; },
    createImageData: function (w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData: function (x, y, w, h) {
      // opaque, so the texture bakery has something to shade, in this canvas's own colour
      const d = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        d[i * 4] = tint[0]; d[i * 4 + 1] = tint[1]; d[i * 4 + 2] = tint[2]; d[i * 4 + 3] = 255;
      }
      return { width: w, height: h, data: d };
    }
  };
}

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [], childNodes: [],
    classList: { add: noop2, remove: noop2, toggle: noop2, contains: function () { return false; } },
    _html: '', _text: '', value: '', checked: false, disabled: false, width: 300, height: 150,
    appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild: function (c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    insertBefore: function (c) { this.children.push(c); return c; },
    remove: noop2, focus: noop2, blur: noop2, click: noop2,
    addEventListener: noop2, removeEventListener: noop2, dispatchEvent: function () { return true; },
    setAttribute: noop2, removeAttribute: noop2, getAttribute: function () { return null; },
    querySelector: function () { return makeEl('div'); }, querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 }; },
    getContext: function () { return this._ctx || (this._ctx = makeCtx(this)); },
    toDataURL: function () { return 'data:,'; },
    requestPointerLock: function () { return { catch: noop2 }; },
    scrollIntoView: noop2, contains: function () { return false; }
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return this._html; }, set: function (v) { this._html = String(v); } });
  Object.defineProperty(el, 'textContent', { get: function () { return this._text; }, set: function (v) { this._text = String(v); } });
  return el;
}
function noop2() {}

/* Web Audio, reduced to a counter. Every node the game builds is recorded in AC.log with
   the bus it was connected to, so the sound code really runs and a caller can assert on
   the mix without anything being played. */
function FakeAudioContext() {
  const ac = this;
  ac.currentTime = 0;
  ac.sampleRate = 44100;
  ac.state = 'running';
  ac.log = [];
  ac.destination = { _name: 'destination', connect: noop2 };
  const param = function () {
    return {
      value: 0,
      setValueAtTime: function () { return this; },
      exponentialRampToValueAtTime: function () { return this; },
      linearRampToValueAtTime: function () { return this; }
    };
  };
  const node = function (kind) {
    return { _kind: kind, _to: null, connect: function (d) { this._to = d; return d; }, disconnect: noop2 };
  };
  ac.createGain = function () { return Object.assign(node('gain'), { gain: param() }); };
  ac.createOscillator = function () {
    return Object.assign(node('osc'), {
      type: 'square', frequency: param(), detune: param(),
      start: function (t) { ac.log.push({ kind: 'osc', t: t, to: this._to }); }, stop: noop2
    });
  };
  ac.createBufferSource = function () {
    return Object.assign(node('src'), {
      buffer: null, playbackRate: param(),
      start: function (t) { ac.log.push({ kind: 'noise', t: t, to: this._to }); }, stop: noop2
    });
  };
  ac.createBiquadFilter = function () {
    return Object.assign(node('filter'), { type: 'bandpass', frequency: param(), Q: param(), gain: param() });
  };
  ac.createBuffer = function (ch, len) {
    return { numberOfChannels: ch, length: len, getChannelData: function () { return new Float32Array(len); } };
  };
  ac.resume = function () { return Promise.resolve(); };
  ac.close = function () { return Promise.resolve(); };
}

/* Pull the inline scripts out of an HTML file (ignoring any with a src attribute). */
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/*
 * Run the game and return handles on it.
 *
 * The page starts itself with `setTimeout(boot, 30)`, so the returned promise resolves
 * once that has run and the title screen is up.
 */
function boot(htmlPath) {
  const src = fs.readFileSync(htmlPath, 'utf8');
  const scripts = inlineScripts(src);
  if (!scripts.length) throw new Error('no inline <script> found in ' + htmlPath);

  const store = {};
  const els = {};
  const raf = [];
  const doc = {
    readyState: 'complete', hidden: false, pointerLockElement: null,
    body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
    createElement: makeEl,
    createElementNS: function (ns, t) { return makeEl(t); },
    createTextNode: function (t) { return { nodeValue: t }; },
    getElementById: function (id) { return els[id] || (els[id] = makeEl('div')); },
    querySelector: function () { return makeEl('div'); },
    querySelectorAll: function () { return []; },
    addEventListener: noop2, removeEventListener: noop2,
    exitPointerLock: noop2, hasFocus: function () { return true; },
    fonts: { ready: Promise.resolve(), load: function () { return Promise.resolve(); }, add: noop2 }
  };

  const win = {
    innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
    document: doc,
    location: { href: 'file:///rex-rumble.html', search: '', protocol: 'file:' },
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      clear: function () { for (const k in store) delete store[k]; }
    },
    addEventListener: noop2, removeEventListener: noop2,
    requestAnimationFrame: function (fn) { raf.push(fn); return raf.length; },
    cancelAnimationFrame: noop2,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function () { return 0; }, clearInterval: noop2,
    matchMedia: function (q) {
      return { matches: false, media: q, addEventListener: noop2, removeEventListener: noop2, addListener: noop2 };
    },
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; } }; },
    Audio: function () {
      return { play: function () { return { catch: noop2 }; }, cloneNode: function () { return this; }, load: noop2, volume: 1, preload: '' };
    },
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext,
    performance: { now: Date.now },
    Image: function () { return makeEl('img'); },
    navigator: { maxTouchPoints: 0, userAgent: 'node', vibrate: noop2 },
    console: console, Math: Math, JSON: JSON, Date: Date
  };
  win.window = win; win.self = win; win.globalThis = win; win.top = win;

  const ctx = vm.createContext(win);
  scripts.forEach(function (code, i) {
    // the eval hatch has to be appended inside the script's own scope to see its `let`s
    new vm.Script(code + '\n;globalThis.__ev = function (e) { return eval(e); };',
      { filename: htmlPath + '#inline-' + i }).runInContext(ctx);
  });

  return {
    win: win, doc: doc, raf: raf, els: els, store: store,
    ev: function (expr) { return win.__ev(expr); },
    // resolves once the page's own deferred boot() has run
    ready: function () { return new Promise(function (r) { setTimeout(r, 120); }); }
  };
}

module.exports = { boot: boot, inlineScripts: inlineScripts };
