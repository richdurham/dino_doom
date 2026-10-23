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
  check('all six floors are present', count === 6, count + ' floors');
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
    const v = JSON.parse(ev('JSON.stringify((function(){ var r = getEditorValidation(LEVELS[' + i + '].grid, goalOf(LEVELS[' + i + ']), !!LEVELS[' + i + '].bossKey);' +
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
    loadLevel(4, true); mode = 'play'; P.invT = 1e9;
    AC.currentTime = 200; musicTick(); var floor = musicTrack;
    var boss = W.things.find(function (t) { return t.isBoss; });
    boss.state = 'chase'; AC.currentTime = 201; musicTick(); var fight = musicTrack;
    scareOff(boss); var quiet = wantedTrack();
    W.time = W.bossQuiet + 0.1; AC.currentTime = 202; musicTick();
    return { want: LEVELS[4].music, floor: floor, fight: fight, quiet: quiet, back: musicTrack };
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

  done();
})().catch(function (e) {
  fail('the checks ran to completion', e.stack);
  done();
});

function done() {
  console.log('\n' + (failures ? failures + ' check(s) failed' : 'all checks passed'));
  process.exit(failures ? 1 : 0);
}
