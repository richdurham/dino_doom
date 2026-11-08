#!/usr/bin/env node
/*
 * Pre-merge checks for Rex Rumble. No dependencies — `node tools/check.js`.
 *
 * The game is one self-contained HTML file with no build step, so nothing catches a typo
 * or a broken floor until someone opens it. These checks do:
 *
 *   1. syntax  — every inline <script> parses
 *   2. boot    — the game starts headlessly, which exercises the whole art bakery,
 *                the renderer set-up, input binding and the editor UI
 *   3. levels  — the shipped floors pass the game's OWN editor audit (reachable exit,
 *                key not locked behind its own gate, no tree plugging a corridor)
 *   4. palette — no two editor swatches are perceptually indistinguishable
 *   5. goals   — a floor's exit footprint stays hidden until its goal is met, then appears
 *   6. smoke   — every floor survives a burst of play with all the dinos awake
 *   7. music   — every floor names a real track, every track plays without a bad note,
 *                and a boss brings in its theme
 *   8. ambience — every floor's tiles make their own sounds, louder up close, on the right side
 *   9. croc    — the Borealosuchus is armoured but for its back, and is slow to turn after a miss
 *  10. water   — deep water slows you, drops the camera to the surface, heaves the bob, and swishes
 *  11. mosasaurus — it can't leave the water, can't turn without swimming, swims on past you, and
 *                never gets stuck on a bank
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
  check('all seven floors are present', count === 7, count + ' floors');
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
    const v = JSON.parse(ev('JSON.stringify((function(){ var r = getEditorValidation(LEVELS[' + i + '].grid, goalOf(LEVELS[' + i + ']), !!LEVELS[' + i + '].bossKey, LEVELS[' + i + '].floor === "water");' +
      ' return { valid: r.valid, errors: r.errors, warnings: r.warnings, trees: r.treeIssues.size, counts: r.counts }; })())'));
    check('floor ' + i + ' "' + name + '" audits clean', v.valid && v.trees === 0,
      v.errors.concat(v.trees ? [v.trees + ' tree(s) blocking a passage'] : []).join('; '));
    if (v.warnings.length) console.log('        note: ' + v.warnings.join('; '));
  }

  /* Saved floors are kept by position, so a floor added in the middle must not shift them onto the wrong one. */
  const moved = JSON.parse(ev(`JSON.stringify((function () {
    var mine = Object.assign({}, LEVELS[3 + 1], { name: 'My Basalt' });
    var save = [null, null, null, mine, null, null];     // what floor 3 was before Glassmere Lake went in
    localStorage.setItem('rex_custom_levels_v6', JSON.stringify(save));
    loadSavedCustomLevels();
    var out = { lake: LEVELS[3].name, basalt: LEVELS[4].name, old: localStorage.getItem('rex_custom_levels_v6') };
    LEVELS[4] = JSON.parse(JSON.stringify(FACTORY_LEVELS[4]));
    saveCustomLevelsToStorage();
    return out;
  })())`));
  check('floors saved before Glassmere Lake stay on their own floors', moved.basalt === 'My Basalt' && moved.lake === 'Glassmere Lake' && moved.old === null,
    'floor 3 is ' + moved.lake + ', floor 4 is ' + moved.basalt + ', old save left behind: ' + !!moved.old);
  const puddle = JSON.parse(ev(`JSON.stringify((function () {
    var g = LEVELS[3].grid.slice();
    var clean = getEditorValidation(g, 'none', false, false).warnings;
    var cramped = ['%'.repeat(24), '%P.....................%', '%...~v~................%', '%....................E.%'];
    for (var y = 4; y < 24; y++) cramped.push('%'.repeat(24));
    return { lake: clean, cramped: getEditorValidation(cramped, 'none', false, false).warnings };
  })())`));
  check('the audit warns about a mosasaurus in a puddle, and not about the lake',
    puddle.cramped.some(function (w) { return /too little water/.test(w); }) && !puddle.lake.some(function (w) { return /too little water/.test(w); }),
    'puddle: ' + puddle.cramped.join('; ') + ' / lake: ' + puddle.lake.join('; '));

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

  /* ----------------------------------------------------------------- 5. goals */
  /* Each floor is played up to the edge of its goal and then over it: standing on the exit's
     square beforehand must not end the floor, and meeting the goal must make it appear. */
  console.log('\ngoals (the exit appears only once the floor\'s goal is met)');
  ev('startGame(false);');
  for (let i = 0; i < count; i++) {
    const name = ev('LEVELS[' + i + '].name');
    const g = JSON.parse(ev(`JSON.stringify((function () {
      loadLevel(${i}, true); mode = 'play';
      var goal = W.goal, hiddenAtStart = !W.exit.alive;
      if (goal === 'none') return { goal: goal, ok: !hiddenAtStart, why: 'exit hidden on a floor with no goal' };
      if (!hiddenAtStart) return { goal: goal, ok: false, why: 'exit visible before the goal is met' };
      P.x = W.exit.x; P.y = W.exit.y; P.invT = 1e9;
      W.things.forEach(function (t) { if (t.kind === 'dino') t.state = 'sleep'; });
      for (var f = 0; f < 10; f++) update(1 / 60);
      if (mode !== 'play') return { goal: goal, ok: false, why: 'walking onto the hidden exit ended the floor' };
      P.x = W.spawn.x; P.y = W.spawn.y;
      var todo = W.things.filter(function (t) {
        return goal === 'eggs' ? (t.kind === 'item' && t.type === 'egg') :
          goal === 'boss' ? (t.kind === 'dino' && t.isBoss) : t.kind === 'dino';
      });
      todo.slice(0, -1).forEach(function (t) { goal === 'eggs' ? pickup(t) : scareOff(t); });
      if (W.exit.alive) return { goal: goal, ok: false, why: 'exit appeared one short of the goal' };
      todo.slice(-1).forEach(function (t) { goal === 'eggs' ? pickup(t) : scareOff(t); });
      return { goal: goal, ok: W.exit.alive && W.goalMet, why: 'exit did not appear once the goal was met' };
    })())`));
    check('floor ' + i + ' "' + name + '" (goal: ' + g.goal + ')', g.ok, g.why);
  }

  /* "Boss drops key": the Iron Forge's exit sits behind a key gate and the Robo-Spinosaurus
     carries the only key. The audit must only accept that with the option on, and in play the
     key must fall where it dies and open the gate onto the exit. */
  const bk = JSON.parse(ev(`JSON.stringify((function () {
    var i = LEVELS.findIndex(function (L) { return L.bossKey; });
    if (i < 0) return { none: true };
    var L = LEVELS[i];
    var flaggedWithout = !getEditorValidation(L.grid, goalOf(L), false).valid;
    var validWith = getEditorValidation(L.grid, goalOf(L), true).valid;
    loadLevel(i, true); mode = 'play'; P.invT = 1e9;
    var boss = W.things.find(function (t) { return t.kind === 'dino' && t.isBoss; });
    var keysBefore = W.things.filter(function (t) { return t.type === 'key' && t.alive; }).length;
    scareOff(boss);
    var key = W.things.find(function (t) { return t.type === 'key' && t.alive; });
    var dropped = !!key && Math.hypot(key.x - boss.x, key.y - boss.y) < 0.01;
    if (key) pickup(key);
    // walk up to the gate in front of the exit and let it swing open
    var gate = null;
    W.doors.forEach(function (d, idx) { if (d.locked && Math.abs((idx % MW) + 0.5 - W.exit.x) + Math.abs(((idx / MW) | 0) + 0.5 - W.exit.y) <= 1) gate = { d: d, x: (idx % MW) + 0.5, y: ((idx / MW) | 0) + 1.5 }; });
    if (!gate) return { name: L.name, flaggedWithout: flaggedWithout, validWith: validWith, keysBefore: keysBefore, dropped: dropped, opened: false };
    P.x = gate.x; P.y = gate.y;
    for (var f = 0; f < 90; f++) update(1 / 60);
    return { name: L.name, flaggedWithout: flaggedWithout, validWith: validWith, keysBefore: keysBefore, dropped: dropped,
      opened: gate.d.open >= 1 && !solidAt(gate.x, gate.y - 1) };
  })())`));
  if (bk.none) check('a shipped floor uses "boss drops key"', false, 'no floor has bossKey set');
  else {
    check('"' + bk.name + '": the audit needs "boss drops key" to reach its exit', bk.flaggedWithout && bk.validWith,
      'flagged without the option: ' + bk.flaggedWithout + ', valid with it: ' + bk.validWith);
    check('"' + bk.name + '": beating the boss drops the key, and it opens the gate to the exit',
      bk.keysBefore === 0 && bk.dropped && bk.opened,
      'keys before: ' + bk.keysBefore + ', dropped at the boss: ' + bk.dropped + ', gate opened: ' + bk.opened);
  }

  /* ----------------------------------------------------------------- 6. smoke */
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

  /* ----------------------------------------------------------------- 7. music */
  /* Every floor names a real track, and every track plays a minute calm and a minute hunted
     through the stub Web Audio, which throws on a NaN pitch or a ramp to zero as a browser
     does. A track scheduling hundreds of notes a second has a runaway loop in it. */
  console.log('\nmusic');
  const tracks = JSON.parse(ev('JSON.stringify(Object.keys(MUSIC))'));
  for (let i = 0; i < count; i++) {
    const m = ev('LEVELS[' + i + '].music');
    check('floor ' + i + ' "' + ev('LEVELS[' + i + '].name') + '" plays a real track', tracks.indexOf(m) >= 0, 'music = ' + m);
  }
  check('an import naming an unknown track keeps the floor\'s own',
    ev("cleanLevel(Object.assign({}, LEVELS[0], { music: 'polka' }), LEVELS[0]).music") === ev('LEVELS[0].music'));
  tracks.forEach(function (id) {
    const r = JSON.parse(ev(`JSON.stringify((function () {
      var T = MUSIC[${JSON.stringify(id)}], spb = 60 / T.bpm / T.sub, out = {};
      try {
        [0, 1].forEach(function (heat) {
          var before = AC.log.length;
          for (var s = 0; s * spb < 60; s++) { AC.currentTime = s * spb; T.play(s, 0.05, heat, spb); }
          out[heat] = (AC.log.length - before) / 60;
        });
      } catch (e) { return { bad: e.message }; }
      finally { AC.currentTime = 0; }
      return { calm: out[0], hunted: out[1] };
    })())`));
    const silent = id === 'none';
    check('"' + id + '" plays calm and hunted' + (r.bad ? '' : ' (' + r.calm.toFixed(0) + ' and ' + r.hunted.toFixed(0) + ' notes a second)'),
      !r.bad && (silent || r.calm > 1) && r.hunted < 200, r.bad || 'calm ' + r.calm + ', hunted ' + r.hunted + ' notes a second');
  });
  const sch = JSON.parse(ev(`JSON.stringify((function () {
    loadLevel(3, true); mode = 'play'; SET.music = true;
    AC.currentTime = 100; musicTick();
    var track = musicTrack, n = AC.log.length;
    SET.music = false; AC.currentTime = 101; musicTick();
    var whileOff = AC.log.length - n;
    mode = 'editor'; edListenTo('temple'); AC.currentTime = 102; musicTick();
    var preview = musicTrack, previewNotes = AC.log.length - n - whileOff;
    edListenTo(null); SET.music = true; mode = 'play';
    return { track: track, want: LEVELS[3].music, whileOff: whileOff, preview: preview, previewNotes: previewNotes };
  })())`));
  check('a floor plays its own track', sch.track === sch.want, 'playing ' + sch.track + ', floor wants ' + sch.want);
  check('nothing new is scheduled with the music off', sch.whileOff === 0, sch.whileOff + ' notes');
  check('the editor\'s Listen plays the picked track, even with the music off', sch.preview === 'temple' && sch.previewNotes > 0,
    'playing ' + sch.preview + ', ' + sch.previewNotes + ' notes');
  const bt = JSON.parse(ev(`JSON.stringify((function () {
    loadLevel(5, true); mode = 'play'; P.invT = 1e9;
    AC.currentTime = 200; musicTick(); var floor = musicTrack;
    var boss = W.things.find(function (t) { return t.isBoss; });
    boss.state = 'chase'; AC.currentTime = 201; musicTick(); var fight = musicTrack;
    scareOff(boss); var quiet = wantedTrack();
    W.time = W.bossQuiet + 0.1; AC.currentTime = 202; musicTick();
    return { want: LEVELS[5].music, floor: floor, fight: fight, quiet: quiet, back: musicTrack };
  })())`));
  /* A hunt pushes the tempo up, but only on a bar line, and onto the spare echo line (retiming an echo
     that is ringing makes it warble). Between the two marks it holds, so it can't flutter. */
  const tp = JSON.parse(ev(`JSON.stringify((function () {
    loadLevel(0, true); mode = 'play';
    var T = MUSIC[W.def.music], bar = 4 * T.sub, at = [], log = [], orig = retime, phase = '';
    retime = function (T, spb, when) { at.push(step); log.push(phase + ': step ' + step + ' to ' + (60 / spb / T.sub).toFixed(1) + ' bpm'); orig(T, spb, when); };
    var stretch = function (heat, secs) { phase = 'heat ' + heat; musicHeat = heat; for (var i = 0; i < secs * 60; i++) { AC.currentTime += 1 / 60; musicTick(); } };
    var fresh = musicHeat;                 // a new floor starts calm, whatever the last one was doing
    AC.currentTime = 300; musicTick();
    stretch(0, 8); var calm = musicBpm, line = echoIn;
    stretch(1, 8); var hunted = musicBpm, moved = echoIn !== line, upAt = at.slice();
    stretch(0.45, 8); var between = musicBpm;
    stretch(0, 8); var after = musicBpm;
    retime = orig; musicHeat = 0;
    return { fresh: fresh, base: T.bpm, push: HUNT_PUSH, calm: calm, hunted: hunted, moved: moved, between: between, after: after,
      changes: at.length, offBar: at.filter(function (s) { return s % bar; }).length, upChanges: upAt.length, log: log.join(', ') };
  })())`));
  check('a hunt speeds the music up ' + Math.round((tp.push - 1) * 100) + '%, on a bar line, onto the spare echo',
    tp.fresh === 0 && tp.calm === tp.base && tp.upChanges === 1 && Math.abs(tp.hunted - tp.base * tp.push) < 1e-9 && tp.moved && tp.offBar === 0,
    'heat on arrival ' + tp.fresh + ', bpm calm ' + tp.calm + ', hunted ' + tp.hunted + ', echo moved: ' + tp.moved + '; changes: ' + tp.log);
  check('it holds while the hunt is in two minds, and slows back down once you\'re clear',
    tp.between === tp.hunted && tp.after === tp.base && tp.changes === 2 && tp.offBar === 0,
    'bpm half-hunted ' + tp.between + ', clear ' + tp.after + '; changes: ' + tp.log);
  check('a boss that notices you brings in the boss theme', bt.floor === bt.want && bt.fight === 'boss',
    'before: ' + bt.floor + ', once it noticed you: ' + bt.fight);
  check('when the boss falls, a moment\'s quiet, then the floor\'s own music', bt.quiet === null && bt.back === bt.want,
    'right after: ' + bt.quiet + ', then: ' + bt.back);

  /* -------------------------------------------------------------- 8. ambience */
  /* The tiles make their own sounds. Every shipped floor should make some, each kind should be louder up
     close than far off, it should swap sides when you turn round, and it should stop when you pause. */
  console.log('\nambience');
  for (let i = 0; i < count; i++) {
    const a = JSON.parse(ev(`JSON.stringify((function () {
      loadLevel(${i}, true); mode = 'play'; P.invT = 1e9;
      W.things.forEach(function (t) { if (t.kind === 'dino') t.state = 'sleep'; });
      var face = function (ang) { P.ang = ang; P.dirX = Math.cos(ang); P.dirY = Math.sin(ang); P.planeX = -P.dirY * FOV; P.planeY = P.dirX * FOV; };
      var names = Object.keys(AMBIENCE), out = { kinds: [], bad: [] };
      W.amb.forEach(function (k) {
        var name = names.find(function (n) { return AMBIENCE[n] === k.K; });
        out.kinds.push(name);
        if (!k.pts) return;
        // the open cells nearest to and furthest from this kind, and the one that hears it most to one side
        var near = null, far = null, side = null, dn = 99, df = -1, sp = 0;
        face(-Math.PI / 2);
        for (var y = 1; y < MH - 1; y++) for (var x = 1; x < MW - 1; x++) {
          if (tileAt(x, y) !== 0) continue;
          var d = 99;
          k.pts.forEach(function (p) { d = Math.min(d, Math.hypot(p.x - x - 0.5, p.y - y - 0.5)); });
          if (d < dn) { dn = d; near = [x + 0.5, y + 0.5]; }
          if (d > df) { df = d; far = [x + 0.5, y + 0.5]; }
          P.x = x + 0.5; P.y = y + 0.5;
          var h = ambHear(k);
          if (Math.abs(h.pan) > Math.abs(sp)) { sp = h.pan; side = [x + 0.5, y + 0.5]; }
        }
        P.x = near[0]; P.y = near[1]; var ln = ambHear(k).level;
        P.x = far[0]; P.y = far[1]; var lf = ambHear(k).level;
        if (!(ln > lf)) out.bad.push(name + ' is no louder up close (' + ln.toFixed(2) + ') than ' + df.toFixed(1) + ' tiles off (' + lf.toFixed(2) + ')');
        P.x = side[0]; P.y = side[1]; face(Math.PI / 2);
        var turned = ambHear(k).pan;
        if (!(Math.abs(sp) > 0.3 && Math.sign(turned) === -Math.sign(sp))) out.bad.push(name + ' does not swap sides when you turn round (' + sp.toFixed(2) + ' then ' + turned.toFixed(2) + ')');
      });
      // a few seconds of play: the beds start, one-off sounds play, nothing throws
      var n = AC.log.length;
      try { for (var f = 0; f < 300; f++) { AC.currentTime += 1 / 60; ambTick(1 / 60); } } catch (e) { out.bad.push('ambTick threw: ' + e.message); }
      out.sounds = AC.log.length - n;
      out.on = ambOn;
      mode = 'paused'; ambTick(1 / 60); out.offWhenPaused = !ambOn;
      mode = 'play';
      return out;
    })())`));
    const name = ev('LEVELS[' + i + '].name');
    check('floor ' + i + ' "' + name + '" makes its own sounds (' + a.kinds.join(', ') + ')',
      a.kinds.length > 0 && a.sounds > 0 && a.on && a.offWhenPaused && !a.bad.length,
      a.bad.concat(a.kinds.length ? [] : ['no ambience at all'], a.sounds ? [] : ['nothing played'],
        a.offWhenPaused ? [] : ['still playing while paused']).join('; '));
  }

  /* ------------------------------------------------------------------ 9. croc */
  /* The Borealosuchus takes 35% off everywhere but its rear, and a lunge that misses leaves it slow
     to come round, which is how you reach that rear. The Godot port pins the same eight things.
     Open ground and no other dinos, so the lunge can't hit a wall; calling updateDino directly
     keeps the player where the check put them. */
  console.log('\ncroc');
  const croc = JSON.parse(ev(`JSON.stringify((function () {
    loadLevel(2, true); mode = 'play';
    var t = W.things.find(function (o) { return o.kind === 'dino' && o.type === 'borealosuchus'; });
    W.things = W.things.filter(function (o) { return o === t || o.kind !== 'dino'; });
    for (var y = 1; y < MH - 1; y++) for (var x = 1; x < MW - 1; x++) W.tiles[y * MW + x] = 0;
    W.solids = [];
    W.doors.clear();
    P.invT = 0; P.hp = P.maxhp;
    var FRAME = 1 / 60, i;
    var place = function (ang) { t.x = 12; t.y = 12; t.angle = ang; t.state = 'chase'; t.t = 0; P.x = 15; P.y = 12; };
    var clawFacing = function (ang) { place(ang); var hp = t.hp; hurtDino(t, 24, 'claw', false); return hp - t.hp; };
    var out = { front: clawFacing(0), side: clawFacing(Math.PI / 2), back: clawFacing(Math.PI) };

    // the lunge, straight at the player
    place(0);
    t.coil = 0.01;
    updateDino(t, FRAME);
    out.lunged = t.lunging > 0;

    // the player steps aside, so it runs out without reaching them
    P.y += 2.2;
    for (i = 0; t.lunging > 0 && i < 120; i++) updateDino(t, FRAME);
    out.recover = t.recover; out.afterMiss = t.state;

    var ang = t.angle, cx = t.x, cy = t.y;
    for (i = 0; i < 30; i++) updateDino(t, FRAME);
    out.turned = Math.abs(t.angle - ang); out.moved = Math.hypot(t.x - cx, t.y - cy);

    // one tile behind it, well within reach, but not in front of its jaws
    var hp = P.hp;
    P.x = t.x - Math.cos(t.angle); P.y = t.y - Math.sin(t.angle);
    for (i = 0; i < 12; i++) updateDino(t, FRAME);
    out.behind = t.state; out.behindHurt = hp - P.hp; out.stillRecovering = t.recover > 0;

    // one tile in front of its nose
    P.x = t.x + Math.cos(t.angle); P.y = t.y + Math.sin(t.angle);
    updateDino(t, FRAME);
    out.inFront = t.state;
    return out;
  })())`));
  check('its scales take 35% off from the front', Math.abs(croc.front - 15.6) < 1e-6, 'a 24 claw did ' + croc.front);
  check('and from the side', Math.abs(croc.side - 15.6) < 1e-6, 'a 24 claw did ' + croc.side);
  check('but from behind it takes the full hit', Math.abs(croc.back - 24) < 1e-6, 'a 24 claw did ' + croc.back);
  check('a coiled croc lunges', croc.lunged);
  check('a missed lunge leaves it recovering', croc.recover > 0 && croc.afterMiss === 'chase',
    'recover ' + croc.recover + ', state ' + croc.afterMiss);
  check('while recovering it barely turns and stays put', croc.turned < 0.35 && croc.moved < 0.001,
    'turned ' + croc.turned + ' rad, moved ' + croc.moved + ' over 0.5 s');
  check('while recovering it can\'t bite what\'s behind it',
    croc.stillRecovering && croc.behind === 'chase' && croc.behindHurt === 0,
    'still recovering: ' + croc.stillRecovering + ', state ' + croc.behind + ', player lost ' + croc.behindHurt + ' hp');
  check('but it still bites what\'s in front of it', croc.inFront === 'wind', 'state ' + croc.inFront);

  /* ----------------------------------------------------------------- 10. water */
  /* A bare field in three bands, dry, shallow and deep, walked along for four seconds each. */
  console.log('\nwater');
  const water = JSON.parse(ev(`JSON.stringify((function () {
    loadLevel(3, true); mode = 'play';
    W.things = W.things.filter(function (o) { return o.kind !== 'dino' && o.kind !== 'tree' && o.kind !== 'item' && o.kind !== 'decor'; });
    W.solids = []; W.doors.clear();
    for (var i = 0; i < MW * MH; i++) {
      var x = i % MW, y = (i / MW) | 0;
      W.tiles[i] = x === 0 || y === 0 || x === MW - 1 || y === MH - 1 ? 2 : 0;
      W.depth[i] = y < 8 ? DRY : y < 16 ? SHALLOW : DEEP;
    }
    var swishes = 0, orig = SFX.swish;
    SFX.swish = function (s) { swishes++; orig(s); };
    var out = {};
    var walk = function (name, row, held) {
      P.x = 2; P.y = row + 0.5; P.ang = 0; P.lookPitch = 0; P.atk = null; shake = 0;
      keys.KeyW = held;
      var f;
      for (f = 0; f < 90; f++) update(1 / 60);              // long enough to settle at this depth
      P.x = 2; swishes = 0;
      var lo = 1e9, hi = -1e9, turns = 0, last = 0;
      for (f = 0; f < 240; f++) {
        update(1 / 60);
        var b = P.pitch - P.lookPitch;
        lo = Math.min(lo, b); hi = Math.max(hi, b);
        if (f && (b > 0) !== (last > 0)) turns++;
        last = b;
      }
      var px = (P.dirX * 0.6 + 0.5);
      renderWorld({ x: P.x, y: P.y, dirX: P.dirX, dirY: P.dirY, planeX: P.planeX, planeY: P.planeY, pitch: 0, eyeH: P.eye });
      var pixel = buf[(RH - 1) * RW + (RW >> 1)], floorTex = W.floorByDepth.findIndex(function (t) { return t.shades.some(function (b) { return b[0] === pixel; }); });
      out[name] = { speed: (P.x - 2) / 4, eye: P.eye, bob: (hi - lo) / 2, turns: turns, swishes: swishes, floorTex: floorTex, swim: P.swim };
      keys.KeyW = false;
    };
    walk('dry', 4, true); walk('shallow', 12, true); walk('deep', 20, true); walk('treading', 20, false);
    SFX.swish = orig;
    return out;
  })())`));
  check('shallow water doesn\'t slow you down', Math.abs(water.shallow.speed - water.dry.speed) < 0.05, water.shallow.speed + ' against ' + water.dry.speed);
  check('deep water halves your speed', Math.abs(water.deep.speed - water.dry.speed / 2) < 0.05, water.deep.speed + ' against ' + water.dry.speed);
  check('the camera only drops in the deep, to just above the surface', water.dry.eye === 0.5 && water.shallow.eye === 0.5 && water.deep.eye < 0.22,
    'eye height ' + water.dry.eye + ' dry, ' + water.shallow.eye + ' shallow, ' + water.deep.eye + ' deep');
  check('swimming bobs bigger', water.deep.bob > water.dry.bob * 2.5, 'amplitude ' + water.deep.bob + ' against ' + water.dry.bob);
  check('and slower', water.deep.turns < water.dry.turns * 0.6, water.deep.turns + ' zero crossings against ' + water.dry.turns);
  check('every stroke swishes', water.deep.swishes >= 4 && water.deep.swishes <= 9, water.deep.swishes + ' swishes in 4 s');
  check('but not on foot, in the shallows or treading water', water.dry.swishes === 0 && water.shallow.swishes === 0 && water.treading.swishes === 0,
    water.dry.swishes + ' dry, ' + water.shallow.swishes + ' shallow, ' + water.treading.swishes + ' treading water');
  check('each band draws its own floor', water.dry.floorTex === 0 && water.shallow.floorTex === 1 && water.deep.floorTex === 2,
    'dry ' + water.dry.floorTex + ', shallow ' + water.shallow.floorTex + ', deep ' + water.deep.floorTex);

  /* ------------------------------------------------------------ 11. mosasaurus */
  /* One mosasaurus, driven directly so the player stays where the check put them. The pass and the turn are
     tested in open water; getting stuck is tested in the awkward shapes a floor can have. */
  console.log('\nmosasaurus');
  const mosa = JSON.parse(ev(`JSON.stringify((function () {
    var FRAME = 1 / 60, out = {};
    var sea = function () {
      loadLevel(3, true); mode = 'play';
      W.things = W.things.filter(function (o) { return o.kind !== 'dino' && o.kind !== 'tree'; });
      W.solids = []; W.doors.clear();
      for (var i = 0; i < MW * MH; i++) {
        var x = i % MW, y = (i / MW) | 0;
        W.tiles[i] = x === 0 || y === 0 || x === MW - 1 || y === MH - 1 ? 2 : 0;
        W.depth[i] = DEEP;
      }
      spawnDino(W, 'mosasaurus', 4.5, 12.5);
      var t = W.things[W.things.length - 1];
      t.state = 'chase'; t.angle = 0;
      return t;
    };

    // a pass at someone who stays put
    var t = sea();
    P.x = 9; P.y = 12.5; P.hp = P.maxhp; P.invT = 0;
    t.coil = MOSA_TELL;
    var i, hits = 0, slowest = 9, px = t.x, py = t.y, hp = P.hp, passedAt = -1;
    for (i = 0; i < 180 && !(i > 30 && !(t.lunging > 0) && !(t.coil > 0)); i++) {
      updateDino(t, FRAME);
      slowest = Math.min(slowest, Math.hypot(t.x - px, t.y - py) / FRAME); px = t.x; py = t.y;
      if (P.hp < hp) { hits++; hp = P.hp; }
      if (P.invT > 0) P.invT -= FRAME;
    }
    out.hits = hits; out.slowest = slowest; out.beyond = t.x - P.x; out.recovering = t.recover > 0;

    // it carries on swimming after the pass
    px = t.x; py = t.y;
    for (i = 0; i < 40; i++) updateDino(t, FRAME);
    out.after = Math.hypot(t.x - px, t.y - py);

    // the same pass, but the player swims out of the line when the flash starts
    t = sea();
    P.x = 8.5; P.y = 12.5; P.hp = P.maxhp; P.invT = 0;
    t.coil = MOSA_TELL;
    for (i = 0; i < 180 && !(i > 30 && !(t.lunging > 0) && !(t.coil > 0)); i++) { P.y += 1.575 * FRAME; updateDino(t, FRAME); }
    out.dodged = P.maxhp - P.hp;

    // a claw during the flash knocks it off, and it swims away
    t = sea();
    P.x = 6; P.y = 12.5; P.hp = P.maxhp; P.invT = 1e9;
    t.coil = MOSA_TELL;
    updateDino(t, FRAME);
    hurtDino(t, 24, 'claw', false);
    px = t.x; py = t.y;
    updateDino(t, FRAME);
    out.clawed = { coil: t.coil, lunging: t.lunging || 0, state: t.state, moved: Math.hypot(t.x - px, t.y - py) };

    // its heading is bought with distance, in open water
    t = sea();
    t.x = 12; t.y = 12; P.x = 12; P.y = 20; P.invT = 1e9;
    var worst = 0;
    for (i = 0; i < 120; i++) {
      var a0 = t.angle, x0 = t.x, y0 = t.y;
      swimOn(t, a0 + Math.PI, t.def.speed, MOSA_TURN, FRAME);
      worst = Math.max(worst, Math.abs(wrapAngle(t.angle - a0)) / (Math.hypot(t.x - x0, t.y - y0) || 1e-9));
    }
    out.turnPerTile = worst; out.turnLimit = MOSA_TURN;

    // a land dino out of its depth wades, at a little over half speed
    var pace = function (depth) {
      var w = sea();
      w.alive = false;
      spawnDino(W, 'borealosuchus', 4.5, 12.5);
      var c = W.things[W.things.length - 1];
      for (var k = 0; k < MW * MH; k++) if (W.tiles[k] === 0) W.depth[k] = depth;
      c.state = 'chase'; c.angle = 0; P.x = 20; P.y = 12.5; P.invT = 1e9;
      for (var f = 0; f < 60; f++) updateDino(c, FRAME);
      return { dist: c.x - 4.5, sink: c.sink };
    };
    out.dry = pace(DRY); out.wade = pace(DEEP);

    // the shapes it could get stuck in: 40 s each, called from a spot beyond each corner of the map in turn
    var shapes = {
      'a small pond': ['%..P...................%', '%...DDDD...............%', '%...DvDD...............%', '%...DDDD...............%', '%...DDDD...............%'],
      'a one-wide channel': ['%..P...................%', '%......................%', '%.vDDDDDDDDDDDDDDDDDDD.%', '%......................%'],
      'a dead-end bay': ['%..P...................%', '%.DDDDDDDD.............%', '%.DDvDDDDDDDDDDDDDDD...%', '%.DDDDDDDD.............%'],
      'an L-shaped lake': ['%..P...................%', '%.DDDDDDDDDDDD.........%', '%.DvDDDDDDDDDD.........%', '%.DDDDDDDDDDDD.........%', '%.DDD..................%', '%.DDD..................%', '%.DDD..................%', '%.DDDDDDDDDDDDDDD......%', '%.DDDDDDDDDDDDDDD......%'],
      'the shallows': ['%..P...................%', '%.~~~~~~~~~~~~~~~~~~~~.%', '%.~~~~~~~~v~~~~~~~~~~~.%', '%.~~~~~~~~~~~~~~~~~~~~.%'],
      'a swamp full of trees': ['%..P....T...T...T......%', '%...T.......T.....T....%', '%.T.......v........T...%', '%.....T.....T...T......%', '%..T....T..........T...%', '%......................%']
    };
    var spots = [[2.5, 1.5], [20.5, 1.5], [22.5, 9.5], [2.5, 22.5], [12.5, 1.5]];
    var roam = function (t, secs) {
      var longest = 0, still = 0, off = 0, path = 0, grid = {}, px = t.x, py = t.y, winStart = 0, winPath = 0, worstWin = 1e9;
      for (var f = 0; f < secs * 60; f++) {
        var sp = spots[(f / 480 | 0) % spots.length];
        P.x = sp[0]; P.y = sp[1]; P.invT = 1e9;
        updateDino(t, FRAME);
        if (W.mosaHold > 0) W.mosaHold -= FRAME;
        var m = Math.hypot(t.x - px, t.y - py);
        px = t.x; py = t.y;
        path += m; winPath += m;
        if (f - winStart >= 180) { worstWin = Math.min(worstWin, winPath); winStart = f; winPath = 0; }
        still = m < 1e-4 ? still + FRAME : 0;
        if (still > longest) longest = still;
        grid[(t.y | 0) * MW + (t.x | 0)] = 1;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          var cx = t.x + c[0] * MOSA_R * 0.98, cy = t.y + c[1] * MOSA_R * 0.98;
          if (solidAt(cx, cy) || depthAt(cx, cy) === DRY) off++;
        });
      }
      return { longest: longest, off: off, path: path, cells: Object.keys(grid).length, worstWin: worstWin };
    };
    out.shapes = {};
    var saved = LEVELS[3];
    Object.keys(shapes).forEach(function (name) {
      var rows = ['%'.repeat(24)].concat(shapes[name]);
      while (rows.length < 24) rows.push('%'.repeat(24));
      LEVELS[3] = Object.assign({}, saved, { grid: rows, floor: /swamp/.test(name) ? 'water' : 'grass' });
      loadLevel(3, true); mode = 'play';
      var m = W.things.filter(function (o) { return o.type === 'mosasaurus'; })[0];
      m.state = 'chase';
      out.shapes[name] = roam(m, 40);
    });
    LEVELS[3] = saved;

    // and the real floor, all of them at once, with the player on the bank and then out in the deep
    loadLevel(3, true); mode = 'play';
    W.things.forEach(function (o) { if (o.kind === 'dino' && o.type !== 'mosasaurus') o.alive = false; if (o.type === 'mosasaurus') o.state = 'chase'; });
    var all = W.things.filter(function (o) { return o.type === 'mosasaurus'; });
    var bad = 0, frozen = 0, last = all.map(function (o) { return [o.x, o.y, 0]; }), worst2 = 0;
    for (var f = 0; f < 60 * 90; f++) {
      var a = f * 0.004;
      P.x = f < 60 * 45 ? 4.5 : 10 + Math.cos(a) * 5; P.y = f < 60 * 45 ? 2.5 : 6.5 + Math.sin(a * 1.3) * 2;
      P.hp = P.maxhp; P.invT = 1e9;
      update(1 / 60);
      mode = 'play';
      for (var j = 0; j < all.length; j++) {
        var o = all[j];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          var cx = o.x + c[0] * MOSA_R * 0.98, cy = o.y + c[1] * MOSA_R * 0.98;
          if (solidAt(cx, cy) || depthAt(cx, cy) === DRY) bad++;
        });
        if (Math.hypot(o.x - last[j][0], o.y - last[j][1]) < 1e-4) { last[j][2] += FRAME; worst2 = Math.max(worst2, last[j][2]); } else last[j][2] = 0;
        last[j][0] = o.x; last[j][1] = o.y;
      }
    }
    out.lake = { off: bad, longest: worst2 };
    return out;
  })())`));
  // it may legitimately stop to pivot, but one full turn is the most that can ever take
  const MAX_PIVOT = ev('TAU / MOSA_SPIN + 0.05');
  check('a pass bites someone who stays put, once', mosa.hits === 1, mosa.hits + ' bites');
  check('it never stops during a pass', mosa.slowest > 1, 'slowest ' + mosa.slowest + ' tiles a second');
  check('it carries on well past you', mosa.beyond > 2, 'ended ' + mosa.beyond + ' tiles beyond the player');
  check('and is still swimming afterwards, coming round', mosa.recovering && mosa.after > 1, 'recovering: ' + mosa.recovering + ', swam ' + mosa.after + ' tiles in 2/3 s');
  check('you can swim out of its line once it flashes', mosa.dodged === 0, 'lost ' + mosa.dodged + ' hp');
  check('a claw during the flash knocks it off, and it swims away', mosa.clawed.coil <= 0 && mosa.clawed.lunging <= 0 && mosa.clawed.state === 'chase' && mosa.clawed.moved > 0,
    JSON.stringify(mosa.clawed));
  check('it can\'t turn without swimming', mosa.turnPerTile <= mosa.turnLimit + 1e-6, mosa.turnPerTile + ' radians per tile, limit ' + mosa.turnLimit);
  check('a land dino wades through the deep at about half speed, up to its chest',
    Math.abs(mosa.wade.dist / mosa.dry.dist - 0.55) < 0.05 && mosa.wade.sink > 0.2 && mosa.dry.sink === 0,
    'covered ' + mosa.dry.dist + ' dry and ' + mosa.wade.dist + ' deep, sinking ' + mosa.wade.sink);
  Object.keys(mosa.shapes).forEach(function (name) {
    const r = mosa.shapes[name];
    check('in ' + name + ' it stays in the water and keeps moving (' + r.path.toFixed(0) + ' tiles over ' + r.cells + ' cells)',
      r.off === 0 && r.longest < MAX_PIVOT && r.worstWin > 0.5 && r.cells >= 5,
      'off the water ' + r.off + ' times, stopped for up to ' + r.longest.toFixed(2) + ' s, least movement in any 3 s ' + r.worstWin.toFixed(2) + ', ' + r.cells + ' cells');
  });
  check('on Glassmere Lake none of them leave the water or get stuck', mosa.lake.off === 0 && mosa.lake.longest < MAX_PIVOT,
    'off the water ' + mosa.lake.off + ' times, stopped for up to ' + mosa.lake.longest.toFixed(2) + ' s');

  done();
})().catch(function (e) {
  fail('the checks ran to completion', e.stack);
  done();
});

function done() {
  console.log('\n' + (failures ? failures + ' check(s) failed' : 'all checks passed'));
  process.exit(failures ? 1 : 0);
}
