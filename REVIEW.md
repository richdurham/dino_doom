# Rex Rumble — code review

**Target:** `rex-rumble.html` (2277 lines, 86 KB, one inline `<script>` of ~80 KB)
**Scope:** assessment only. No game code was changed; this file is the only thing added to the repo.
**Line references** are `L123` = line 123 of `rex-rumble.html`.

## How this was done

1. Read the whole file in chunks.
2. Where a claim could be tested, tested it, and marked the finding accordingly:
   - **[V]** verified by running it (headless in Node with a stubbed DOM, or live in a browser pane).
   - **[R]** read-only: I believe it from the code but did not reproduce it.
3. The headless spike (~200 lines: a `vm` sandbox with a stub DOM, a level linter, a bot that plays each floor, a movement fuzzer) lives in the session scratchpad, not in this repo. It doubles as the feasibility answer to question 2, and I can promote it to `tests/` if you want it.

Not tested: a real phone, Firefox/Safari, real audio output, real touch hardware. Performance numbers are desktop numbers plus reasoning.

## Verdict

This is a well-built little engine. The raycaster is textbook-correct, the code reads clearly, and the level data is clean. In a 1.2-million-frame random-input fuzz across all three floors (including the worst-case 50 ms timestep) the player and every dino stayed out of walls, with no NaNs and no exceptions. A scripted bot clears all three floors: it opens the doors, takes the key and every egg, is refused the exit until the boss is dead, then beats the boss with real bites and triggers the exit.

The problems are at the edges: input fallbacks, enemy navigation, and a few "works because nothing has pushed on it yet" spots. The most important ones:

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| I1 | **High** | If pointer lock is denied, mouse attacks never work and nothing reports the failure | [V] |
| A1 | **High** | Dinos have no pathfinding and pin themselves to the nearest wall | [V] |
| I2 | Med | `'ontouchstart' in window` misclassifies touch-screen laptops; the touch overlay then swallows the mouse | [R] |
| G1 | Med | Google Fonts `<link>` in a file that must work offline; it also gates boot | [R] |
| A3 | Med | Melee (both directions) ignores walls; the boss can hit you through one | [V] |
| M1 | Med | Music scheduler bursts 458 audio nodes in one frame after a 60 s pause | [V] |
| I4 | Med | The hidden overlay keeps keyboard focus; Enter can re-fire a stale button | focus [V], activation [R] |
| I3 | Med | No `blur` handling: keys and joystick can stick after alt-tab or app switch | [R] |
| A4 | Low | Roar wakes sleeping dinos through walls, permanently | [V] |
| A12 | Low | Die-and-retry keeps and re-earns score, so score is farmable | [V] |
| C1 | Low | Doors take 0.61 s to open but a sprinting player arrives in 0.27 s, so a 0.35 s bump | [V] |

Everything else is in the sections below.

---

## 1. Raycaster correctness

**Correct as written:**

- **DDA (L1228–1253).** Standard `sideDist` / `deltaDist` setup, the `1e30` sentinel for a zero ray component, and perpendicular distance from `sd - dd`. The 64-step guard is safe: the longest ray in a 24×24 map crosses fewer than 48 cells. Leaving the grid breaks out with `tile = 1` (L1244).
- **Fisheye: none.**
  - Walls use perpendicular distance (L1255).
  - Floor and ceiling rows use `0.5·RH / p` (L1202), which is exactly the relation implied by `lineH = RH / pd`. So the floor meets the wall base without a seam, and still does when the horizon shifts for head-bob, because both use the same `horizon`.
  - Sprites are transformed into camera space and use the perpendicular depth `tY` for both size and the z-test (L1301–1321).
- **Wall texture mapping (L1261–1266).** `wallX`, the `texX` flips for the far sides, and the `texPos` start and clip handling are all right.
- **Z-buffer (L1257, L1321).** One depth per column, sprites skip columns where a nearer wall exists. The `tyi < sw` guard (L1327) correctly prevents the classic last-row overread.
- **Tile IDs vs `WALLTEX` (L1047).** Match `buildLevel` (L1086–1092).

**Findings:**

| ID | Sev | Finding |
|----|-----|---------|
| R1 | Low | **Doors don't slide, they scroll.** `texX = (texX + open·64) & 63` (L1266) wraps the texture, so the bone handle reappears on the other side, and the door stays a full opaque cell until `open > 0.98` (L1249), then vanishes. Collision opens at `0.92` (L1156). The 0.92–0.98 window is only ~40 ms, so it doesn't matter in play, but the visual isn't a sliding door. The usual fix is to `continue` the DDA when the shifted `texX ≥ 64`. |
| R2 | Low | **Sprite sort key ≠ sprite depth key.** Sort uses squared Euclidean distance (L1291, L1295); the z-test and size use perpendicular `tY`. They can disagree for two sprites far apart at wide angles, giving an occasional wrong overlap. Sort by `tY` (compute it before sorting). Also `t._d` (L1291) bolts a new field onto every thing each frame; a parallel array avoids the hidden-class churn. |
| R3 | Low | **Whole-sprite cull at `tY < 0.22` (L1303).** A big sprite (the king is `scale 2.3`) whose centre goes behind the camera plane pops out while its body still fills the screen edge. Cosmetic. |
| R4 | Info | **Vertical scale vs horizontal.** `lineH = RH / pd` gives 270 px per world unit vertically; with `planeY = 0.72` the horizontal focal length is 240 / 0.72 ≈ 333 px. Square-pixel projection would want a plane of `RW / (2·RH) ≈ 0.889`. The world is drawn ~19% squashed vertically relative to square pixels. It reads fine in a screenshot, so treat it as a style constant, not a bug. Note that `0.72` is written twice (L1354 and `FOV` at L1359) and the value is coupled to the 16:9 render size. |
| R5 | Info | **The horizon line (L1224–1225) is dead.** Every wall column spans the horizon row (any `lineH ≥ 2`), so the dark line is always overwritten. It is harmless and is what fills the one row the floor and ceiling loops skip. |
| R6 | Info | **Floor sampling mirrors at negative coordinates.** `(fy·64)|0` truncates toward zero, so the texture mirrors across 0. Invisible today because the closed border walls hide everything outside the map. It would show if a level ever had an open edge. |
| R7 | Info | **Bake flattens soft alpha.** `a < 24 → 0, else 255` (L159–162). Anti-aliased edges become hard, and any authored soft alpha is lost: the exit portal's glow (3134 semi-transparent source pixels [V]) bakes to a solid rim, and the poof's `globalAlpha` fade (L868) never fades. In the screenshot the portal still reads well; only the poof fade is actually lost, and it lasts 0.5 s. |

Visual check in a real browser: perspective, textures, sprite depth ordering, and item placement (`vOff`) all look right. (`vOff` positive means lower on screen; that convention is undocumented.)

---

## 2. Collision and movement

**`moveCircle` (L1174–1181) is correct for its job.** It is really an axis-aligned box of half-size `r`, resolved one axis at a time, testing the two leading corners. That is sufficient because `2r < 1`: any 1×1 solid cell that touches the leading edge must contain a corner. Diagonal squeezes between two diagonally-adjacent solids are blocked by the two axis tests. Nothing tunnels: `dt` is clamped to 0.05 (L2240), so the player's max step is 0.158, and the largest impulses (roar push 0.5, bite knockback 0.34) are under a wall's thickness.

**Can the player clip through walls or get stuck in a doorway?** Not in anything I could provoke. [V] 1.2 M fuzz frames (random keys, random mouse-look, random attacks and roars, `dt` of 1/60 and 0.05, all three floors): zero frames with the player or any dino centre inside a solid tile or off-map.

**Findings:**

| ID | Sev | Finding |
|----|-----|---------|
| C1 | Low | **Door bump.** [V] Doors start opening at 1.6 tiles from the door centre (L1902) but only become passable at `open ≥ 0.92` (L1156), i.e. 0.61 s at `dt·1.5`. A sprinting player reaches the door face in ~0.27 s, so there is a 0.35 s (21-frame) stall against a closed door. Trigger earlier (~2.2), or start opening on line of sight. |
| C2 | Low | **Doors never close.** Once open they stay open, and the trigger ignores walls (any side, any angle within 1.6). Dinos treat closed doors as absolute barriers (`solidAt`, L1156), which feeds A1. |
| C3 | Low | **Duplicate "Locked" toast.** [V] The boss floor has two adjacent `K` cells, each with its own `nagged` flag (L1904), so standing between them shows the message twice. `nagged` is never reset, so on a one-door floor the message appears once per level even if you walk away and come back. |
| C4 | Info | **No player↔dino collision.** Only dino↔dino separation exists (L1836), so the player can walk through and stand inside a dino (the sprite is culled at `tY < 0.22`). Probably intended for an arcade feel; worth knowing. |
| C5 | Low | **Three different radii: 0.26 (player), 0.28 (`separate`, L1849), 0.30 (chase and knockback).** [V] An entity at 0.27–0.30 clearance from a wall cannot slide along it at `r = 0.30`: the tangential probe lands inside the wall. Whether `separate()` can actually push a dino into that band I could not reproduce in a quick test, so this is latent. Cheap fix: one `RADIUS` constant per entity type used everywhere. |

---

## 3. Enemy AI state machine

```
sleep ──(LOS ≤ sight | hit | chain-wake ≤5 | roar)──▶ chase
chase ──(dist ≤ reach)──▶ wind ──(wind+0.18s)──▶ rest ──(rest)──▶ chase
any awake ──(roar)──▶ stun ──(stun ≤ 0)──▶ chase
any ──(hp ≤ 0, via hurtDino)──▶ poof ──(0.5s)──▶ alive=false
```

**As a state machine it cannot deadlock.** Every non-sleep state has a finite timer or a distance condition with an exit, and all timers advance with `dt`. `poof` always ends. `sleep` is intentionally sticky. The bot runs and the fuzz agree: no state got stuck.

**The real deadlock is spatial, not in the state machine:**

| ID | Sev | Finding |
|----|-----|---------|
| A1 | **High** | **No pathfinding.** [V] Chase moves in a straight line, and the "wedged" test (L1827–1832) only fires when the position is *exactly* unchanged, so a dino sliding along a wall is never considered stuck. `t.side` (L1830) is chosen once and never reset. Result: dinos pin against the wall face nearest the player and jitter. Test: wake every dino on each floor and park an invulnerable player at spawn for 60 s → only **1/8, 1/16 and 1/18** dinos ever reached striking distance; the rest sat 3–16 tiles away against walls. Caveat: in real play dinos wake by line of sight, so they do approach at first. But the first door, corner or turn you take strands them. A BFS flow-field from the player's cell (576 cells) recomputed when the player changes cell would fix it cheaply; closed doors need to count as passable for dinos (or they open them). |
| A3 | Med | **Melee ignores walls.** [V] Both the chase→wind trigger (L1822) and the hit check (L1807) are pure distance; the player's attack (L1701) is distance plus arc. Putting the boss on the far side of a 1-tile wall (centres 1.56 apart, reach 1.9 + 0.45): it hit the player through the wall at frame 33 (100 → 83 hp), and the player's bite hits it back. Add `losClear` to all three. |
| A4 | Low | **Roar wakes sleepers through walls.** [V] `doRoar` (L1745–1755) sets every dino within 7.5 tiles to `stun` regardless of walls or sleep, and `stun` exits to `chase`, so a roar permanently wakes anything nearby even with no line of sight. Skip `sleep`, or require LOS. (`wake()`'s chain radius of 5 at L1776 also ignores walls.) |
| A12 | Low | **Score farming.** [V] `loadLevel` (L1599) doesn't restore `totalScore`, and the game-over text promises "you keep your score" (L1673). Clearing floor 1's dinos gave 950; dying, retrying, and clearing again gave 1900. Every-egg bonus (+500) repeats too. Snapshot the score at floor start and restore it on retry. |
| A7 | Low | **Mode changes mid-`update`.** `gameOver()` (L1765) and `levelClear()` (L1929) run inside `update`, which then finishes the frame. Death and touching the exit on the same frame would show "Floor cleared" at 0 hp. Very rare; set a pending mode and apply it at the end of `update`. |
| A2 | Low | **String concat per chasing dino per frame** (`before = t.x + ',' + t.y`, L1827 and L1829) just to detect "didn't move". Compare numbers. |
| A9 | Info | **Dead things are never removed from `W.things`.** Every loop checks `alive`; growth is bounded (kills + meat drops), but `separate()` (L1836) is O(n²) over *all* things. Filter to a dino list once. |
| A10 | Info | **Sleepers do a full LOS ray-march every frame** (up to `dist·6` `solidAt` calls, L1162–1171). Fine at this scale (~1.4k calls worst case); stagger it if you add more dinos. |

"Targets that never reset": `t.side` (A1), `d.nagged` (C3), and `P.roars` isn't restored when you retry a floor (L1603–1604 reset hp and keys but not roars). Not a soft-lock, since stars respawn, but a retry can start with 0 roars.

---

## 4. Input

**I1 — pointer lock denied (High) [V].** Live in the browser pane, where lock is refused:

- `mousedown` (L1490) re-requests the lock and *returns*, so every click retries and none attacks. Three clicks produced zero attacks.
- `requestPointerLock()` returns a Promise in current Chromium. Nothing catches it, so each attempt logs an unhandled rejection, and `pointerlockerror` is not listened for. The player gets no message.
- Mouse-look is gated on the lock (L1496), so it silently does nothing; only the arrow keys turn.
- The title screen documents left/right click as the attack controls (L1580). Keyboard attacks (F/E, Space) keep the game playable, but nothing tells the player that.
- Where the API is absent (older WebKit), L1490 calls it unguarded and throws; the other two call sites (L1619, L1636) are guarded.

Fix: listen for `pointerlockerror` (and `.catch()` the promise), set a `noLock` flag, let clicks attack when it's set, and show a one-line hint.

**Other input findings:**

| ID | Sev | Finding |
|----|-----|---------|
| I2 | Med | **Touch detection is a one-way trap [R].** `'ontouchstart' in window` (L2268) is true on many Windows/ChromeOS touch laptops. That sets `touchMode`, which shows `#touchzone` (`inset:0`, z-index 10, L75) *over the canvas*. The zone only has touch listeners, so mouse events never reach the canvas: no mouse-look, no mouse attacks, no lock request (L1619), and the pause-on-lock-loss path is disabled (L1499). `touchMode` is never cleared. Use `matchMedia('(pointer: coarse)')` and/or switch modes on the first real `touchstart` vs `mousemove`. |
| I3 | Med | **No `blur` / `visibilitychange` handling [R].** Holding W then alt-tabbing loses the `keyup`, so the player keeps walking on return. In `touchMode` nothing pauses on blur either, and a lost `touchend` (iOS gestures, app switch) leaves `joy.active` stuck. On blur: clear `keys`, `joy`, `lookPtr`, and `pause()`. |
| I4 | Med | **The hidden overlay keeps focus.** `.hide` (L38) sets only `opacity` and `pointer-events`, so the button you just clicked stays focused and invisible [V: `document.activeElement` was "Start stomping" mid-game]. The game never handles Enter, so by the HTML spec Enter fires a click on it: "Start stomping" would restart the run, and "Next floor" would call `loadLevel(curLevel + 1)` again (past the last floor, `LEVELS[3]` is undefined and `buildLevel` throws after `curLevel` was already changed at L1600). **Activation is [R]:** this pane's synthetic key events failed a control test (a focused visible button didn't respond to Enter either), so I couldn't confirm it. It takes five seconds by hand. Fix: `visibility:hidden` after the fade, `inert`, or `blur()` in `hideOverlay`. |
| I5 | Low | **`if (e.repeat) preventDefault()` on every key (L1474)** blocks held-Tab navigation and browser shortcuts in menus. Scope it to game keys while `mode === 'play'`. |
| I6 | Low | **Shift = Roar (L1481).** Shift is the universal sprint key and roars are the scarcest resource (max 3). Expect accidental roars. Consider dropping the alias. |
| I7 | Low | **Unclamped `movementX` accumulation (L1496).** A spurious huge first event after lock (a known Chromium quirk) will spin the player. Clamp per frame. |
| I8 | Low | **Esc after pausing:** `resume()` requests the lock without user activation (Esc keydown doesn't count), so it is rejected, and the first click is then swallowed by the L1490 "request and return". The user needs a click to lock and another to attack. Works, but feels like a double-click. |
| I9 | Low | **AudioContext is only resumed in `startGame`** (L1381). On iOS an interruption (call, Siri) leaves it suspended until a restart. Resume on `visibilitychange` / next pointer event. |

**Touch handlers with a finger that ends off-canvas:** this specific case is *fine*. Touch events are always dispatched to the element the touch started on, even after the finger leaves the element or the window, so `touchend` / `touchcancel` reach `up()` (L1526) and reset `joy` / `lookPtr`. What does break is a *lost* event (I3). Smaller notes: the joystick has no dead zone (`/60`, L1518) so finger drift moves the player; there is no vertical look; the third finger is ignored.

---

## 5. Performance

**Measured [V], desktop only:**

| What | Result |
|------|--------|
| `renderWorld` software raster, V8 in Node (opaque-square sprites, the pessimistic case) | 0.27 ms/frame |
| `renderWorld` including `putImageData`, Chromium | 0.24 ms |
| Full CPU frame (`update` + render + upscale `drawImage` + `drawHUD`), Chromium | 0.41 ms |
| rAF cadence in the pane | median 8.3 ms, p95 10.3 ms (a 120 Hz display) |
| Baked pixel banks | 11.9 MB total: textures 1.63, dino frames 3.80, king 2.85, items/decor/fx 3.66 |
| Other buffers | scene 0.49 MB; main canvas 3.9 MB here (1324×744), up to ~8 MB at 1080p × dpr 2 |

**Would it hold 60 fps on a mid-range phone?** The JavaScript side almost certainly yes. Even at 5–10× slower than this machine the CPU frame is ~2–4 ms of a 16.7 ms budget. The unmeasured risk is not the pixel loops; it is the canvas 2D work that runs outside the JS timers: the `drawImage` upscale into a ~1–2 Mpx backing store (dpr is capped at 2, L2227), the two gradients, ~25 fills/strokes, and `strokeText` for messages. My `drawHUD` figure (0.03 ms) is only command recording, not GPU raster. I could not measure that here. Cheap ways to find out: an `?fps` overlay, DevTools 6× CPU throttle, and one run on a real phone. If it is tight, cap dpr at 1.5 first.

**Memory:** 12 MB of banks is not a concern on phones. If you ever need it back: 8 → 4 shades for sprites saves ~3.5 MB, and only dinos need a `flash` bank. `bake()` also makes a redundant copy at boot (`d.data.buffer.slice(0)`, L153; `getImageData`'s buffer is already private).

**Per-frame allocations** (small, ~30 objects/frame, so a minor-GC nudge, not a 60 fps risk):

- the camera object literal (L2248)
- `const list = []` and the sort comparator closure (L1285, L1295)
- the two strings per chasing dino (A2)
- the `W.doors.forEach` closure (L1899)
- two `CanvasGradient`s, ~8 style and font strings, `String(totalScore)` and `W.eggs + '/' + …` in the HUD (L2137–2155)

**Wasted work worth fixing:**

- **P1.** `paused`, `clear` and `dead` still render the full 3D scene and HUD every frame (L2246–2255) under an opaque overlay. Render once on entering those modes. This is a battery win on phones, where menus are open a lot.
- **P2.** The minimap issues up to 576 `fillRect`s per frame (L2102–2107); it only changes when the player enters a new cell. Cache it to an offscreen canvas.
- **P3.** rAF at 120/144 Hz renders at display rate. Everything is `dt`-based, so capping at 60 halves the cost on high-refresh phones.
- Wall and sprite loops write column-major with a 1920-byte stride. That is standard for this genre, and the 518 KB buffer fits in L2, so it is not worth changing.

---

## 6. Coincidences and dead code

**Works only because of something else:**

| ID | Finding |
|----|---------|
| K1 | **Little-endian assumption.** Banks are packed `ABGR` into `Uint32Array` (L162, L174) over `ImageData` (L1045). True on every shipping browser; worth a one-line comment. |
| K2 | **The engine trusts the level data.** The DDA guard and closed borders (L1241–1244), `WALLTEX[tile] \|\| TEX.stone` (L1270, which masks a bad tile id as stone), and `row[x]` on a short row (L1084, `undefined` becomes open floor) all assume 24×24 closed grids. I linted all three shipped grids: 24×24, closed, every pickup and dino reachable, key reachable without passing its own door, exit reachable only through the key door on floors 2 and 3. Add that as a load-time assert or a test. |
| K3 | **Radii 0.26 / 0.28 / 0.30** (C5) coexist only because nothing pushes an entity into the 0.28–0.30 band. |
| K4 | **`pauseRefresh()` (L1633)** rebuilds the pause overlay by faking `mode = 'play'` and calling `pause()`, which only works because `pause()` early-returns unless `mode === 'play'`. |
| K5 | **`loadLevel(i)` past the last floor** throws after mutating `curLevel` (L1600), reachable through I4. |
| K6 | **Seed-free randomness.** `Math.random` is used inline (wedge side, bob phase, meat drops, growls), so tests must stub it. The spike does. |

**Dead or stale code:**

- `keyNeeded` (L1077, L1092) is set and never read; `hasKey` (L1077) is never touched again.
- `P.roarMeter` (L1729) is write-only; `P.stomp` (L1356) is never used; `P.eggs` (L1595, L1955) is write-only (the HUD reads `W.eggs`).
- `lerp` (L131) is unused; `ITEMS.egg.pts` (L1059) is unused (the pickup hardcodes 50, L1955).
- `const g = AC.createGain()` in `musicTick` (L1448) creates an orphan node every step.
- `SET.sfx` and `SET.sens` are loaded, saved and read, but no UI sets them.
- The `t.spr === 'exit'` half of the last branch in `update` (L1933) is unreachable, since exits `continue` at L1930.
- The comment at L948 mentions a `MAPKEY` that doesn't exist.
- CSS: the empty `:root:not([data-theme="light"]){ }` (L19); `--moss` and `--fern` are defined and never used (L12); the dark/light `--surround` scaffold (L19–21) can't matter because the page is always dark.

**Music catch-up (M1) [V].** `nextNote` is set once at `audioStart` (L1392) and `musicTick` only runs in `play` (L1443). After a pause (or a tab in the background) the `while (nextNote < currentTime + 0.3)` loop (L1445) replays every missed 8th-note: a 60 s pause produced **458 audio nodes in one frame**. Most have start and stop times in the past, so they are silent, but it is a frame hitch and pointless churn. On resume set `nextNote = max(nextNote, AC.currentTime)`.

**Google Fonts (G1) [R].** `<link rel="stylesheet" href="https://fonts.googleapis.com/…">` (L9) is render-blocking and `boot` waits for `window.load` (L2273–2274), which waits for that stylesheet. Fully offline, the request fails fast and the fallback stack is used. On a captive or black-holed network the "Drawing dinosaurs…" screen can sit for the connection timeout. It also contradicts the header comment's "nothing is downloaded" (L120). Either drop the link and rely on the fallback stack, or inline a Latin-subset base64 woff2 (the build step in Q1 is the natural place to do that).

---

## Cheap art and CSS fixes (only ones I'd make)

- **Claw marks overshoot the title.** [V] `.claws` (L48) is an SVG with `inset:-14% -10%`, but an SVG is a replaced element and doesn't stretch to the inset box: measured, the claws span 251–448 px against a title at 260–322, so they strike through the subtitle and body text on every overlay. Give it an explicit `width:120%; height:128%; left:-10%; top:-14%`.
- **Toasts near the centre.** The stack grows upward from `y = 208` (L2185), so it climbs to 172 of 270. A one-line alternative is `y = 40 + i*18` (top centre, between the hearts and the minimap), growing downward.
- Raptor and arms: no cheap fix that I can vouch for. The frog read likely comes from two high, wide-set eyes on a round skull plus a wide grin (L540–541, L533–538); narrowing the eye spacing and lengthening the snout might help, but I did not try it.

---

## Q1 — One file, or split into `src/*.js` plus a build script?

**Recommendation: split, along the seams that already exist, and do it *after* the test harness exists.**

**Why split.** The file is already organised as banner-commented sections. About a third is drawing code (textures and sprites, L126–947); the art is what you'll iterate on most (the raptor, the arms) and the part that least needs to be in the same buffer as the AI. Levels are data, and per-section diffs, reviews and edits get much easier. The single-file constraint is a property of the *artifact*, not of the source.

**The constraint that shapes the design: file://.** Use **classic scripts concatenated in order, not ES modules.** `type="module"` from `file://` is blocked by CORS in Chrome and Firefox, and the code already lives in one shared global scope: `TEX`, `SPR`, `W`, `P`, `SET`, `SFX` and the rest are referenced across sections. Plain concatenation preserves those semantics exactly, so the split is a mechanical no-op with nothing to export or import.

**Suggested layout (line ranges are the current seams):**

```
src/
  template.html        head, CSS, markup, <!-- @script --> marker      (L1–117)
  js/00-util.js        TAU, clamp, rngFrom, newCv, bake                (L126–179)
  js/10-textures.js    tex*()                                          (L181–390)
  js/20-sprites.js     ink/eye/draw*, buildArt                         (L392–947)
  js/30-data.js        LEVELS, DINOS, ITEMS                            (L948–1063)
  js/40-world.js       buildLevel, solidAt, losClear, moveCircle       (L1065–1181)
  js/50-render.js      shadeIdx, renderWorld                           (L1183–1337)
  js/60-audio.js                                                       (L1376–1457)
  js/70-input.js                                                       (L1465–1553)
  js/80-game.js        flow, combat, AI, update, pickup                (L1555–1966)
  js/90-hud.js                                                         (L1968–2222)
  js/99-main.js        resize, frame, boot                             (L2224–2274)
build.js               ~30 lines, Node, no deps: read template, concat js/* in name
                       order with /* --- file --- */ banners, write rex-rumble.html
tests/headless.js
```

**Rules that keep it safe:**

1. Commit the generated `rex-rumble.html`. It is the deliverable and must stay openable straight from the repo. Add a check that fails when the artifact is stale (`node build.js && git diff --exit-code rex-rumble.html`).
2. First commit is byte-for-byte: concatenating the new files must reproduce the current script apart from banner comments. That is a trivial diff to verify, so the refactor itself is provably risk-free.
3. Optional `dev.html` with one `<script src>` per file. Classic scripts load fine from `file://`, so you can iterate without running the build.
4. Do the font inlining (G1) in `build.js`.

**When I would *not* split:** if the game is finished and you won't touch the art or levels again. A single file is a genuine virtue for sharing. But the tradeoff tilts toward splitting as soon as you keep iterating on sprites, levels or AI; a build script this small (~30 lines) carries almost no maintenance burden.

**Sequence:** harness → mechanical split → bug fixes. The harness is what makes the split and the later fixes (pathfinding, LOS melee, the audio scheduler) safe.

---

## Q2 — Is there enough structure for a headless test harness?

**Yes, and it is worth recreating.** I checked this by building one without touching the source: `vm.runInContext` over the extracted inline script, a stubbed DOM, then `boot()` called by hand. About 65 lines of stub plus a few short tests, ~200 lines in total, and it ran the results in this review. The full 1.2 M-frame fuzz takes **7 s**; a bot playthrough of all three floors takes **~1 s**.

**Why the structure is sufficient:**

- `update(dt)` takes an injectable timestep and is separate from rendering, so no `requestAnimationFrame` is needed; drive it in a loop.
- `renderWorld(cam)` takes a plain camera object, so it can be called from any pose.
- Everything is reachable as top-level bindings inside the sandbox (`W`, `P`, `keys`, `mode`, `msgs`, `attack()`, `doRoar()`, `hurtDino()`, `loadLevel()`), so tests can read and poke game state directly. Top-level `let`/`const` persist across `runInContext` calls in one context.
- Gameplay functions are small and mostly pure over `W`/`P`.

**Friction (all workable without refactoring):**

- **Randomness.** `Math.random` is used inline. Stub it with a seeded generator (the spike does this).
- **DOM and canvas.** `getContext('2d')` is used at bake time. A `Proxy` whose methods are no-ops, plus a `getImageData` that returns opaque pixels, is enough. Wall pixels become non-empty so `renderWorld` can be sanity-checked. (My first version returned an empty buffer from `createImageData`, and a benchmark against it was meaningless, which is a good argument for an assertion that `buf` is fully written.)
- **Typed-array writes never throw.** Out-of-range writes silently no-op, so a render bug won't raise an exception. Assert on outputs (`zbuf` finite and > 0, no zero pixels after the floor pass, a golden checksum for a few fixed poses).
- **No state-reset API.** A fresh `vm` context per test is cheap and sidesteps it.
- **Audio.** A fake `AudioContext` that counts created nodes is 15 lines and is how M1 was measured.

**What to cover (the original four checks plus what this review found):**

1. **Level lint (static, no engine).** 24×24, closed border, exactly one `P` and one `E`, everything reachable, key reachable without crossing its own door, boss present iff `boss: true`. (Written and passing.)
2. **Smoke and fuzz.** N frames per floor with random keys, look, attacks and roars, at `dt = 1/60` and `0.05`. Invariants: no exception; player and dinos never inside a solid tile; all numbers finite; `hp` in range; `msgs.length ≤ 3`; every dino state in the known set. (Written; 0 violations today.)
3. **Bot playthrough per floor** — the original harness's core: BFS route with steering. Assert doors open (count them), key picked up, `eggs === eggsTotal`, exit triggers `mode === 'clear'`, on the boss floor the exit is refused until the boss is dead, and the boss dies to real `attack('bite')` calls. Add a stuck detector. (Written; passes on all three floors.)
4. **Unit tables.** `moveCircle` (slide, corner, no tunnelling at 0.05), door timing (would pin C1), `resolveAttack` reach, arc and max hits, `losClear`, wake chain, score restore on retry (pins A12).
5. **AI liveness.** Every awake dino with a walkable path to the player should reach it within T seconds. Fails today (A1); keep it as an expected failure that then drives the pathfinding fix.
6. **Regression tests for this review's bugs**, written to fail first: melee through a wall (A3), roar waking through walls (A4), 60 s music gap creating < K nodes (M1).
7. **Input via recorded listeners.** The stub already records every `addEventListener`. Fire synthetic events for: click with `requestPointerLock` returning a rejected promise (I1), touchstart/move/end/cancel sequences, and blur clearing `keys` (I3).
8. **Render smoke.** From N random poses: no exception, `zbuf` sane, every pixel written, plus a sprite behind a wall column is not drawn.

**What a headless harness cannot cover:** how the art looks, audible audio, real pointer lock, touch hardware, CSS/layout, and phone performance. Those need a browser (a Playwright smoke test is optional and not worth it before the cheap wins here), and for performance a real device.

**Effort:** roughly a day to turn the spike into a tidy `tests/headless.js` with a `node --test` runner and CI hook. Since `boot()`, `update()` and `renderWorld()` are already callable, the game itself needs no changes for this.

---

## Suggested order of work

1. Harness from the spike (a day). Then the mechanical split, verified byte-for-byte.
2. I1 (pointer-lock fallback), I2 (touch detection), G1 (fonts), I4 (overlay focus): small, high-value, easy to test.
3. A3 and A4 (LOS on melee and roar), A12 (score restore), M1 (`nextNote` clamp), I3 (blur).
4. A1 (pathfinding): the largest change and the one that most affects how the game plays. Doors need a decision: can dinos open them?
5. Cleanups: dead code, allocations, P1–P3, the claw and toast CSS/coords.
