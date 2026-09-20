# Rex Rumble — code review

**Reviewed:** `rex-rumble.html`, `index.html`, `README.md`, `.github/workflows/deploy-pages.yml`

| Round | Version | Notes |
|---|---|---|
| 1 | The original single file, 2277 lines | No longer in the repo. Its detail is kept in the appendix at the end. |
| 2 | Commit `15174b4`: five floors, six dinos, level editor, roar sample, Pages wrapper (~3,660 script lines) | Reviewed, then fixed in this pass. **The fixes are uncommitted in your working tree.** |

`L###` line references appear only in the appendix and point at the retired Round 1 file; use the function names there.

## How this was done

- Read every changed region of the game, the wrapper and the workflow, then **tested** each suspicion instead of trusting my reading. Findings are marked **[V]** (reproduced by running it) or **[R]** (read only).
- **Headless:** the game's script runs in a Node `vm` sandbox with a stubbed DOM, driven by a bot that plays each floor (BFS route, key, eggs, exit, boss fights), a random-input fuzzer, and targeted regression checks.
- **Browser:** loaded in the built-in browser at desktop, 1024×768 and 768×1024, with real `TouchEvent`s / `PointerEvent`s, and the live GitHub Pages site (byte-identical to `HEAD` when I checked).
- The harness is a throwaway in my session scratchpad, not in the repo. After the fixes: **69 regression checks pass, the bot clears all five floors (both bosses included), and 1,000,000 fuzz frames (random keys, look, attacks, roars and joystick input, at 1/60 s and 50 ms steps) found no wall or tree clipping, NaNs or exceptions.**
- **Not tested:** real tablet or phone hardware (iPadOS Safari, Android Chrome, real multi-touch), Firefox/Safari, a granted pointer lock (this pane refuses it), and Enter/Space activating a focused button (the pane's synthetic key events can't).

## Verdict

The expansion is a real step up: the ceiling-height rendering is correct, the four-angle sprites, the directional-armour combat, the editor and the Pages deployment all work, and the shipped floors are clean. But the editor and the new attacks shipped with bugs that could strand or mislead a player, and most of my Round 1 input and AI findings were still open. This pass fixes everything that was a clear bug, adds proper tablet touch support, and corrects the docs. **One big item is deliberately left for you: dino pathfinding** (see "Still open").

## What changed in this pass

**Bugs (all with a regression check that fails on the old code)**
- **Editor soft-lock.** Pause → *Edit this floor* → close left a black screen that Esc couldn't escape. Now it returns to the pause menu. The pause menu also gained *Restart this floor* and a note when you've edited the floor you're playing.
- **Trike and crocodile attacks worked exactly once.** The `!t.pawing` / `!t.lunging` guards never became falsy again, because the countdowns end at a tiny negative number. Now `> 0` tests; the carnotaurus had the same latent trap.
- **Export wasn't valid JSON**, so Import rejected its own output. Export is now real JSON.
- **A bad import could break a floor.** A typo'd texture (`'grasss'`) became `''` and the renderer threw every frame. Imports and saved data are now sanitised (unknown textures fall back, height clamped to 1–4), and `buildLevel` falls back to a known texture as a last line of defence.
- **Trees could block the only way through.** `buildLevel` ran the "does this tree plug a corridor?" test while the grid was half-read, so the editor flagged a tree that the game then spawned anyway (unwinnable level). Trees now spawn after the grid is read. All 35 shipped trees still spawn.
- **The editor froze the factory floors.** Opening and closing it saved all five floors, and saved data overrides the built-in ones, so later level updates never reached you. Storage now holds only floors you changed (`rex_custom_levels_v6`), and v5 saves are migrated once.
- **Typing in the editor triggered game hotkeys** ("m" toggled music) and key auto-repeat was swallowed in text fields. Both fixed; Esc closes the import box first.
- **Melee ignored walls** (the boss hit me through one, and my bite hit it back). Chase→strike, the swing, the charges and your attacks now need line of sight. A roar no longer wakes sleepers (least of all through walls); sleepers within 2 tiles no longer wake through walls; pack wake-up needs line of sight.
- **Score farming** by dying and retrying. A retry now restores the score and roars you arrived with. Playtesting an edited floor uses its own score and can no longer set your best score.
- **Doors bumped a sprinting player** for 0.35 s. They now trigger at 2.2 tiles and open at 2.0/s (0 stalled frames, was 21).
- **Music burst.** After a pause the scheduler queued every missed beat (458 audio nodes in one frame). Now a handful. Also removed an orphan `createGain` per beat.
- **Editor polish that was simply broken:** the selected-tile highlight had no CSS (so nothing lit up), the palette text was wrong (meat +28 not +35, star = extra roar), and editor messages were drawn on the canvas *behind* the editor where nobody could see them.
- **Claw marks** on the overlays now hug the title instead of striking through the subtitle.

**Input and robustness**
- **Pointer lock refused** (iframes, cooldown after Esc): clicks now attack, the player gets a one-line hint, and there's no more unhandled promise rejection (was: every click retried the lock and nothing ever attacked).
- **Focus loss** (alt-tab, app switch, notification pull-down) releases held keys and fingers and pauses. Audio resumes when the tab returns.
- **Hidden menus can't hold focus** (`visibility:hidden` after the fade, plus a `blur()`), so Enter can't re-fire a stale button. Verified with a real click: focus is on `BODY`.
- `P` now pauses (the docs already promised it), and mouse-look spikes are clamped.
- **Start-up no longer waits for the web font.** The Google Fonts stylesheet loads without blocking, and `boot` no longer waits for `window.load`, so the game starts instantly offline or on a bad network.
- Paused / cleared / game-over screens draw the still scene once instead of every frame (battery).

**Docs**
- README and `index.html` listed controls the game never had (Q/E to turn, P to pause, left click = Bite, right click = Roar). They now match the game. Two were implemented rather than dropped: **P pauses**, and **Q / E turn** (E used to claw, so Claw is now left click or F). "100% reachability audits" was claimed but didn't exist; **the editor now really does a reachability audit** (flood-fill from the spawn: exit, key and eggs, with key gates counted only if a key can be fetched first). The audio credit now names CC BY 3.0. The wrapper page lost an invalid `allow="pointer-lock"` and a misleading "(Esc)" label, and gained touch instructions.

## Tablet and touch controls

The game already had basic touch controls; they were tuned for phones and had gaps on tablets. Now:

- **Detection:** the primary pointer decides at start-up (`(pointer: coarse)`), then it follows what you actually use. A real touch switches to touch controls; a real mouse switches back. That fixes touch-screen laptops, whose invisible touch layer used to swallow the mouse, and tablets with a paired trackpad.
- **Walk stick:** a visible floating stick appears under your left thumb (ring and knob), with a dead zone so finger drift doesn't walk you around. It scales with the screen, and if your finger runs far past the ring the ring follows.
- **Look:** drag on the right half, sideways and up/down, as before.
- **Buttons:** Claw, Bite and Roar are laid out as a thumb arc at the bottom right (Roar above Bite, Claw to its left) and scale with the shorter screen side (68–130 px), respecting safe areas. The pause button scales too.
- **Portrait:** a "turn your device sideways" hint. The controls sit on the black bars so they don't cover the view.
- **Editor on a touch screen:** painting uses pointer events, so you can drag a stroke with a finger; the layout stacks at narrow widths instead of clipping the palette; storage is written once per stroke, not per cell. Erase with the *Floor* tile.
- **Wrapper page:** touch instructions and a touch card, the Fullscreen button is hidden where unsupported (iPhone), and `100dvh` for the full-window mode.
- **Verified:** synthetic touch sequences (start, drift, push, over-drag, release, second finger looking, blur mid-touch, all three buttons), and visually at 1024×768 and 768×1024 (stick, buttons, rotate hint, the editor with a drag stroke). **Not verified on real hardware.**

## Status of every finding

Round 1 IDs are in the appendix. **Fixed** = fixed in this pass; **Open** = still there.

| ID | Sev | Finding | Status |
|---|---|---|---|
| I1 | High | Pointer lock refused: clicks never attack | **Fixed** |
| A1 | High | No pathfinding: dinos pin to walls | **Open** (your call, below) |
| I2 | Med | Touch detection misclassifies laptops | **Fixed** |
| G1 | Med | Google Fonts blocks start-up | **Fixed** |
| A3 | Med | Melee ignores walls | **Fixed** |
| M1 | Med | Music burst after a pause | **Fixed** |
| I4 | Med | Hidden overlay keeps focus | **Fixed** (verified: focus goes to `BODY`) |
| I3 | Med | No blur handling | **Fixed** |
| A4 | Low | Roar wakes sleepers through walls | **Fixed** (plus proximity and pack wake-ups) |
| A12 | Low | Score farming | **Fixed** |
| C1 | Low | Door bump | **Fixed** |
| I5, I7, I9 | Low | Key-repeat blocked everywhere; `movementX` spikes; audio never resumed | **Fixed** |
| P1 | Low | Full render behind menus | **Fixed** |
| Claw marks overshoot the title | Low | Slash across the subtitle on every menu | **Fixed** |
| R7 | Info | Baking flattens soft alpha | Open (harmless; only the poof fade is lost) |
| Dead `createGain` per beat | Low | Orphan node | **Fixed** |
| R1–R6 | Low/Info | Door texture scroll, sprite sort key, sprite cull, aspect, dead horizon line, floor mirror | Open (cosmetic) |
| C2, C4, C5 | Low/Info | Doors never close; no player↔dino collision; three radii | Open |
| C3 | Low | Duplicate "Locked" toast at paired gates | Open (trivial) |
| A2, A7, A9, A10 | Low | String concat per frame; mode change mid-update; O(n²) separate; per-frame LOS | Open |
| I6, I8 | Low | Shift = Roar; Esc-resume needs a double click | Open |
| P2, P3 | Low | Minimap redrawn per frame; no 60 fps cap | Open |
| K1–K6, dead code | Low | Endianness assumption, trusts level data, `pauseRefresh`, unused fields | Open |
| **New in Round 2** | | | |
| N1 | **High** | Editor soft-lock from the pause menu [V] | **Fixed** |
| N2 | **High** | Trike and crocodile attack only once [V] | **Fixed** |
| N3 | Med | Export isn't valid JSON, so Import fails [V] | **Fixed** |
| N4 | Med | Typo'd import texture crashes the renderer [V] | **Fixed** |
| N5 | Med | Tree spawn test runs on a half-built map [V] | **Fixed** |
| N6 | Med | Editor freezes the factory floors [R, then covered by test] | **Fixed** |
| N7 | Low | Editor typing triggers game hotkeys; repeat swallowed [R, test] | **Fixed** |
| N8 | Med | README and wrapper describe controls the game doesn't have (Q/E turn, P pause, mouse buttons) [V] | **Fixed** (Q/E and P implemented; the mouse-button rows corrected) |
| N9 | Low | Palette text wrong; selected tile never highlighted; editor messages invisible | **Fixed** |
| N10 | Low | README claims a reachability audit that didn't exist | **Fixed** (implemented) |
| N11 | Low | Playtest carried old score and could set the best score | **Fixed** |
| N12 | Low | Wrapper: invalid `pointer-lock` policy, misleading Esc label | **Fixed** |
| N13 | Info | Sprite memory tripled; render cost up ~4× | Open (numbers below) |
| N14 | Info | Roar sample is embedded as base64 *and* loaded from `sounds/` | Open |

## Still open, and what I'd do

1. **Dino pathfinding (A1) — needs your decision.** Chasers still walk in a straight line, so they pin against the nearest wall. With every dino woken and the player standing still for 60 s, only **3/7, 2/8, 2/8, 1/16 and 1/18** ever reached the player (unchanged from before). This is a gameplay-feel call, not a bug fix: real pathfinding will make the game noticeably harder. Note the interaction with this pass: since melee now needs line of sight, a dino wedged behind a wall is *harmless and can't be hit*, where before it hit through the wall. The fix I'd make is a breadth-first flow-field from the player's cell (576 cells) recomputed when the player changes cell, used when line of sight is blocked. You'd also decide whether dinos may open doors.
2. **Memory and render cost.** The four-angle sprite banks took baked memory from 11.9 MB to **34.4 MB** (king alone 8.6 MB), and software render time from 0.27 ms to about **1.0 ms** on desktop. That is still fine on a mid-range phone on the JS side (my estimate: 5–10 ms at 5–10× slower), but the headroom shrank. Cheap wins if you need it: 4 shades instead of 8 for sprites (roughly −14 MB), and only dinos need the `flash` bank. I'd add a `?fps` overlay and test on a real tablet before optimising.
3. **The small ones:** share the "Locked" toast flag between paired gates (C3); unify collision radii (C5); pick the sprite sort key by depth (R2); cache the minimap (P2). None affects play much.
4. **The audio is stored twice** (base64 in the HTML *and* `sounds/…mp3`). Fine for now; a build step would embed it once.

## Measurements (desktop; not a phone)

| | Round 1 | Round 2 (after fixes) |
|---|---|---|
| Baked pixel banks | 11.9 MB | 34.4 MB |
| `renderWorld` in V8 | 0.27 ms | ~1.0 ms |
| `update()` per frame | negligible | 0.03 ms |
| Script size | 80 KB | 177 KB at `HEAD`, 190 KB after these fixes (35 KB of it is one base64 line) |

## Q1 — one file, or split?

**Still: split, along the seams that exist, after the tests are committed.** The case is stronger now. The file went from 2,277 to 4,145 lines, the editor is a self-contained ~560-line subsystem, art is ~1,250 lines, and a 35 KB base64 line makes diffs and editing awkward. Keep the rules from Round 1: classic scripts concatenated in order (not ES modules, which `file://` blocks), the built `rex-rumble.html` committed as the deliverable, a first commit that reproduces the current script byte for byte, and a stale-artifact check in CI. New this round: a build script is also the natural place to **embed the roar MP3 once** (from `sounds/`) and to inline the font if you ever want it bundled. Suggested files: `util`, `textures`, `sprites`, `data` (levels and stats), `world`, `render`, `audio`, `input`, `game`, `hud`, `editor`, `main`.

## Q2 — a headless test harness

**Done as a spike, and it earned its keep**: it found the trike/crocodile one-shot bug, the tree-ordering bug, the melee-through-walls bug and confirmed every fix. What exists (in my scratchpad, ~400 lines): the stub DOM and `vm` loader, a level linter, a five-floor bot, a fuzzer, and the 69 regression checks above (editor flows, storage migration, LOS combat, touch and pointer sequences, audio scheduling, retry rules). The five-floor bot takes about a second, the regression suite 7 s, and the 1M-frame fuzz about 19 s. **I haven't added it to the repo because you didn't ask for it.** If you want it, I'd put it in `tests/` with a `node tests/run.js` entry point and add it as a step in the Pages workflow *before* the deploy, so a broken build can't publish. Two things it can't cover, and you'd still check by hand: how things look, and behaviour on real touch hardware.

## Suggested next steps

1. Commit these fixes (I haven't committed anything) and try the touch controls on a real tablet: landscape and portrait, and the editor.
2. Decide on pathfinding (A1).
3. Add the tests to the repo and CI.
4. Then the mechanical split.

---

## Appendix — Round 1 detail (the original 2277-line version)

*These sections are the original review, kept for reference. The `L###` references point at that retired file, and several findings below are now fixed (see the status table above).*

### 1. Raycaster correctness

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

### 2. Collision and movement

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

### 3. Enemy AI state machine

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

### 4. Input

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

### 5. Performance

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

### 6. Coincidences and dead code

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
