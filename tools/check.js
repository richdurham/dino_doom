#!/usr/bin/env node
/*
 * Pre-merge checks for Rex Rumble. No dependencies — `node tools/check.js`.
 *
 * The game is one self-contained HTML file with no build step, so nothing catches a typo
 * or a broken floor until someone opens it. These four checks do:
 *
 *   1. syntax  — every inline <script> parses
 *   2. boot    — the game starts headlessly, which exercises the whole art bakery,
 *                the renderer set-up, input binding and the editor UI
 *   3. levels  — the shipped floors pass the game's OWN editor audit (reachable exit,
 *                key not locked behind its own gate, no tree plugging a corridor)
 *   4. palette — no two editor swatches are perceptually indistinguishable
 *   5. smoke   — every floor survives a burst of play with all the dinos awake
 *
 * The level check calls getEditorValidation() rather than reimplementing its rules, so it
 * cannot drift from what the in-game editor tells a player.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { boot, inlineScripts } = require('./harness');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'rex-rumble.html');

let failures = 0;
function pass(msg) { console.log('  ok    ' + msg); }
function fail(msg, detail) {
  failures++;
  console.log('  FAIL  ' + msg + (detail ? '\n        ' + String(detail).split('\n').join('\n        ') : ''));
}
function check(msg, cond, detail) { cond ? pass(msg) : fail(msg, detail); }

/* ----------------------------------------------------------------- 1. syntax */
console.log('\nsyntax');
['rex-rumble.html', 'index.html'].forEach(function (name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return check(name + ' exists', false);
  const scripts = inlineScripts(fs.readFileSync(file, 'utf8'));
  if (name === 'rex-rumble.html' && !scripts.length) return check(name + ' has an inline script', false);
  try {
    scripts.forEach(function (s, i) { new vm.Script(s, { filename: name + '#inline-' + i }); });
    const lines = scripts.reduce(function (a, s) { return a + s.split('\n').length; }, 0);
    pass(name + ': ' + scripts.length + ' inline script(s), ' + lines + ' lines parse');
  } catch (e) {
    fail(name + ' parses', e.message);
  }
});

/* ------------------------------------------------------------------- 2. boot */
(async function () {
  console.log('\nboot');
  let game = null;
  try {
    game = boot(GAME);
    await game.ready();
  } catch (e) {
    fail('the game boots headlessly', e.stack);
    return done();
  }
  const ev = game.ev;
  check('the game reaches the title screen', ev('mode') === 'title', 'mode = ' + ev('mode'));
  check('textures and sprites are baked',
    ev('Object.keys(TEX).length') > 10 && ev('Object.keys(SPR).length') > 10,
    ev('Object.keys(TEX).length') + ' textures, ' + ev('Object.keys(SPR).length') + ' sprite banks');

  /* ---------------------------------------------------------------- 3. levels */
  console.log('\nlevels (the editor\'s own audit)');
  const count = ev('LEVELS.length');
  check('all five floors are present', count === 5, count + ' floors');
  for (let i = 0; i < count; i++) {
    const name = ev('LEVELS[' + i + '].name');
    /* The editor's audit reads row[x] straight, so a row that is short just yields
       undefined and quietly audits as open floor. Check the shape first. */
    const shape = JSON.parse(ev('JSON.stringify((function(){ var g = LEVELS[' + i + '].grid;' +
      ' return { rows: g.length, bad: g.map(function (r, y) { return [y, r.length]; })' +
      '   .filter(function (p) { return p[1] !== 24; }) }; })())'));
    check('floor ' + i + ' "' + name + '" is 24 rows of 24', shape.rows === 24 && !shape.bad.length,
      shape.rows !== 24 ? shape.rows + ' rows' :
        shape.bad.map(function (p) { return 'row ' + p[0] + ' is ' + p[1] + ' wide'; }).join('; '));
    const v = JSON.parse(ev('JSON.stringify((function(){ var r = getEditorValidation(LEVELS[' + i + '].grid);' +
      ' return { valid: r.valid, errors: r.errors, warnings: r.warnings, trees: r.treeIssues.size, counts: r.counts }; })())'));
    check('floor ' + i + ' "' + name + '" audits clean', v.valid && v.trees === 0,
      v.errors.concat(v.trees ? [v.trees + ' tree(s) blocking a passage'] : []).join('; '));
    if (v.warnings.length) console.log('        note: ' + v.warnings.join('; '));
  }

  /* --------------------------------------------------------------- 4. palette */
  /* Tile swatches that look alike make the editor hard to read at a glance. The glyph
     carries the meaning, so the colour only has to be a clear second signal — but two
     greens for "tree" and "raptor" is not one. dE is CIEDE2000: under about 12, two
     swatches read as the same colour at chip size. */
  console.log('\npalette separation');
  const toLab = function (h) {
    const v = [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; })
      .map(function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    let X = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047;
    let Y = (v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722);
    let Z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
    const g = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    X = g(X); Y = g(Y); Z = g(Z);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const de = function (p, q) {
    const C1 = Math.hypot(p[1], p[2]), C2 = Math.hypot(q[1], q[2]), Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
    const a1 = (1 + G) * p[1], a2 = (1 + G) * q[1];
    const Cp1 = Math.hypot(a1, p[2]), Cp2 = Math.hypot(a2, q[2]);
    const ang = function (x, y) { const d = Math.atan2(y, x) * 180 / Math.PI; return d < 0 ? d + 360 : d; };
    const h1 = Cp1 === 0 ? 0 : ang(a1, p[2]), h2 = Cp2 === 0 ? 0 : ang(a2, q[2]);
    const dL = q[0] - p[0], dC = Cp2 - Cp1;
    let dh = 0;
    if (Cp1 * Cp2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * Math.PI / 360);
    const Lb = (p[0] + q[0]) / 2, Cpb = (Cp1 + Cp2) / 2;
    let hb;
    if (Cp1 * Cp2 === 0) hb = h1 + h2;
    else { hb = (h1 + h2) / 2; if (Math.abs(h1 - h2) > 180) hb += (h1 + h2 < 360) ? 180 : -180; }
    const T = 1 - 0.17 * Math.cos((hb - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hb * Math.PI / 180)
      + 0.32 * Math.cos((3 * hb + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hb - 63) * Math.PI / 180);
    const Sl = 1 + (0.015 * Math.pow(Lb - 50, 2)) / Math.sqrt(20 + Math.pow(Lb - 50, 2));
    const Sc = 1 + 0.045 * Cpb, Sh = 1 + 0.015 * Cpb * T;
    const Rt = -2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + Math.pow(25, 7)))
      * Math.sin(60 * Math.exp(-Math.pow((hb - 275) / 25, 2)) * Math.PI / 180);
    return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
  };
  // the key gate is meant to match its key; the two grey walls are told apart by pattern
  const EXEMPT = { 'K|k': 1, '#|%': 1 };
  const MIN_DE = 12;
  const swatches = JSON.parse(ev('JSON.stringify(Object.keys(ED_PALETTE).reduce(function (a, c) {' +
    ' return a.concat(ED_PALETTE[c].map(function (i) { return { ch: i.ch, label: i.label, color: i.color }; })); }, []))'));
  swatches.forEach(function (s) { s.lab = toLab(s.color); });
  let closest = { d: Infinity };
  const clashes = [];
  for (let i = 0; i < swatches.length; i++) for (let j = i + 1; j < swatches.length; j++) {
    const a = swatches[i], b = swatches[j];
    if (EXEMPT[[a.ch, b.ch].sort().join('|')]) continue;
    const d = de(a.lab, b.lab);
    if (d < closest.d) closest = { d: d, a: a, b: b };
    if (d < MIN_DE) clashes.push(`${a.label} (${a.ch}) and ${b.label} (${b.ch}) are dE ${d.toFixed(1)} apart`);
  }
  check(`no two swatches are closer than dE ${MIN_DE}`, clashes.length === 0, clashes.join('; '));
  console.log(`        closest pair: ${closest.a.label} vs ${closest.b.label} at dE ${closest.d.toFixed(1)}`);

  /* ----------------------------------------------------------------- 5. smoke */
  console.log('\nsmoke (900 frames a floor, every dino awake)');
  ev('startGame(false);');
  for (let i = 0; i < count; i++) {
    const name = ev('LEVELS[' + i + '].name');
    ev('curLevel = ' + i + '; loadLevel(' + i + ', true); mode = "play";');
    ev('W.things.forEach(function (t) { if (t.kind === "dino") t.state = "chase"; }); void 0;');
    // one batched call: 900 evals a floor would dominate the runtime
    const r = JSON.parse(ev(`JSON.stringify((function () {
      var s = ${1000 + i * 37} >>> 0;
      function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
      for (var f = 0; f < 900; f++) {
        keys.KeyW = rnd() < 0.5; keys.KeyA = rnd() < 0.2; keys.KeyD = rnd() < 0.2; keys.KeyS = rnd() < 0.12;
        look.dx = (rnd() - 0.5) * 40; look.dy = (rnd() - 0.5) * 20;
        if (rnd() < 0.06) attack(rnd() < 0.5 ? 'claw' : 'bite');
        if (rnd() < 0.005) doRoar();
        try { update(rnd() < 0.1 ? 0.05 : 1 / 60); } catch (e) { return { bad: 'threw on frame ' + f + ': ' + e.message }; }
        if (!isFinite(P.x) || !isFinite(P.y) || !isFinite(P.ang)) return { bad: 'player went NaN on frame ' + f };
        if (P.x < 0.2 || P.x > 23.8 || P.y < 0.2 || P.y > 23.8) return { bad: 'player left the grid on frame ' + f };
        if (solidAt(P.x, P.y)) return { bad: 'player ended up inside a wall on frame ' + f };
        for (var j = 0; j < W.things.length; j++) {
          var t = W.things[j];
          if (t.kind !== 'dino' || !t.alive) continue;
          if (!isFinite(t.x) || !isFinite(t.y) || !isFinite(t.angle)) return { bad: t.type + ' went NaN on frame ' + f };
          if (t.x < 0.2 || t.x > 23.8 || t.y < 0.2 || t.y > 23.8) return { bad: t.type + ' left the grid on frame ' + f };
        }
        if (P.hp <= 0) { P.hp = P.maxhp; mode = 'play'; }
        if (mode !== 'play') mode = 'play';
      }
      try { renderWorld({ x: P.x, y: P.y, dirX: P.dirX, dirY: P.dirY, planeX: P.planeX, planeY: P.planeY, pitch: P.pitch }); }
      catch (e) { return { bad: 'renderWorld threw: ' + e.message }; }
      return { bad: null };
    })())`));
    check('floor ' + i + ' "' + name + '" plays and renders', !r.bad, r.bad);
  }

  done();
})().catch(function (e) {
  fail('the checks ran to completion', e.stack);
  done();
});

function done() {
  console.log('\n' + (failures ? failures + ' check(s) failed' : 'all checks passed'));
  process.exit(failures ? 1 : 0);
}
