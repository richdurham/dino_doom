# 🦖 Rex Rumble (Dino Doom)

> ### 🎮 **[▶ Play Online in Browser (No Install Needed)](https://richdurham.github.io/dino_doom/)**

A retro-style 2.5D prehistoric raycasting action game inspired by classic *Wolfenstein 3D* and *Doom*, built entirely in self-contained **HTML5 Canvas** and **Vanilla JavaScript** with procedural graphics, authentic synthesizer sound effects, and Web Audio.

![Rex Rumble Gameplay](https://raw.githubusercontent.com/richdurham/dino_doom/main/screenshot.png)

---

## 🌟 Features

* **Pure Vanilla HTML5 / JS**: Zero bundlers, zero build steps, and it works offline. Just open `rex-rumble.html` in any modern web browser to play! (The rounded *Fredoka* font is an optional web font loaded in the background when you're online; offline, the game uses your system font.)
* **Touch controls for phones and tablets**: a floating walk stick under your left thumb, drag-to-look on the right (up and down too), and thumb-sized Claw / Bite / Roar buttons that scale with your screen. The level editor works with a finger too.
* **2.5D Raycasting Engine with Dynamic Ceilings**:
  * **Custom Heights (`ceilH`)**: Levels range from standard cavern ceilings to soaring `2.8x` redwood forest canopies and `3.2x` monumental throne halls.
  * **Four ceilings**: open sky, forest canopy, cave rock and temple gold, so no two floors read as the same room.
  * **Seamless sky**: flat blue with sparse clouds cut from a noise field that wraps, stretched over six grid squares instead of repeating in every one — so there is no tile edge to spot and no clouds marching in rows.
  * **Full Vertical Mouse & Touch Look**: Tilt your gaze up into the redwood canopy or down to the forest floor.
* **4-Angle Directional Dinosaur Sprites**:
  * Dinosaurs feature distinct front, side-profile (with dynamic flipping), and rear visual angles as they hunt, flee, or patrol.
* **Prehistoric Roster with Unique AI**:
  * 🟠 **Velociraptor**: Amber, tiger-striped pack hunters with a red feather crest. One that spots you screeches for the rest, and the pack fans out to arrive from different sides. Each raptor crouches, springs, slashes and immediately backs out of reach.
  * 🦏 **Triceratops**: Armored behemoths. They paw the ground along the line they intend to charge — seven tenths of a second to leave it.
  * 🦅 **Pterosaur**: Purple flyers that circle overhead, rear up with a screech, then dive-bomb in a straight line. Sidestep it!
  * 🐊 **Borealosuchus**: Prehistoric crocodilian lurkers of the murky bayou. They coil before they snap forward.
  * 👹 **Carnotaurus (Sub-Boss)**: Fast, horned carnivore that rears up and keeps aiming before it commits to a charge line.
  * 👑 **The Bone King (Boss)**: Colossal apex predator guarding the prehistoric Bone Throne.
  * 🤖 **The Robo-Spinosaurus (Final Boss)**: A steel spinosaurus with a furnace in its chest and cannons for arms.
    * **Fire breath** at range. First it *breathes in*: its belly, cheeks and sail vents blaze orange, embers stream into its jaws, and a rising whoosh plays for over a second. Then it roars and hoses fire down a line that sweeps after you, slower than you can walk sideways. The arena's pillars stop the flames.
    * **Arm cannons** up close. Both arms come up with a charging whine while it flashes red, then it blasts everything in front of it and throws you back.
    * Claw it during either wind-up to knock it off; bite it while it roars or breathes fire for double damage. Below half health it overheats: shorter cooldowns and a faster sweep. A boss health bar shows once it notices you.
* **6 Distinct Prehistoric Biomes**:
  1. **Floor 0: Verdant Canopy** — Open primeval forest under a wide blue sky, with multi-layered depth trees, 100% organic tree-walls, and zero artificial doors.
  2. **Floor 1: Fernback Ruins** — Ancient stone pillars overgrown by primeval pines with hanging vine curtains.
  3. **Floor 2: Murky Bayou** — Deep cypress swamp with water ripples and a prehistoric bone gate locked by an amber fossil key.
  4. **Floor 3: Bubbling Basalt** — Volcanic obsidian caverns, ash floors, and the Carnotaurus sub-boss lair.
  5. **Floor 4: The Bone Throne** — Golden temple arena and the showdown against The Bone King.
  6. **Floor 5: The Iron Forge** — Riveted iron walls, steel floors and lava pillars for cover. The final fight against the Robo-Spinosaurus.
* **Read-the-tell Combat**: Every dino pulses **red** while it winds up, so a strike can be seen coming and stepped away from.
  * **Claw** is fast and wide, hits three at once, and lands early enough to knock a dino clean off a strike it has already started.
  * **Bite** is slow and roots you where you stand — but it does **double damage** to a dino already committed to its own move. Reading the flash and biting into it beats swinging on reflex; per second, spamming the big attack is the worse habit.
* **Eggs worth finding**: each floor leaves at most one egg in plain sight, as a breadcrumb near your route. The rest sit in thicket nests, in wall alcoves off the main path, or under guard — so clearing a floor means searching it.
* **T-Rex Roar Stun Mechanic**: Unleash a powerful roar to terrify and stun surrounding dinosaurs.
* **Built-in In-Game Level Editor**:
  * Interactive grid painter directly in the browser (open via `Pause Menu` or `Title Screen`).
  * Real-time safety validation (ensures zero trees block 1-square passages or doors).
  * Texture pickers, ceiling height slider (`1.0x` to `4.0x`), entity counters, and 100% reachability audits.
  * The grid takes whatever room the window has and never clips — and if it ever runs out, that side scrolls like the palette does. Embedded on the web page, opening the editor gives the frame the extra height a square map needs.
  * Saves the floors you change to `localStorage` (floors you haven't touched keep following updates to the game), with one-click **Playtest**, **Export JSON**, **Import**, and **Reset Floor** to factory defaults. Imports with a typo'd texture or an out-of-range ceiling height fall back to safe values instead of breaking the floor.

---

## 🎮 How to Play

### Quick Start
1. Clone or download this repository.
2. Double-click `rex-rumble.html` to open it in Chrome, Firefox, Safari, or Edge.
3. Click to lock mouse pointer and start stomping!

### Controls

| Action | Keyboard / Mouse | Touch (phone & tablet) |
| :--- | :--- | :--- |
| **Move & Strafe** | `W`, `A`, `S`, `D` (`↑` / `↓` also walk) | Drag anywhere on the left half; a stick appears under your thumb |
| **Turn Camera** | Mouse horizontal move, or `Q` / `E` (`←` / `→` also turn) | Drag on the right half, sideways |
| **Look Up / Down (Pitch)** | Mouse vertical move, `PageUp` / `PageDown`, `I` / `K` (`Home` to center) | Drag on the right half, up or down |
| **Claw** (fast, wide, interrupts a wind-up) | Left Mouse Click or `F` | **Claw** button |
| **Bite** (slow, roots you, doubles on a committed dino) | Right Mouse Click or `Spacebar` | **Bite** button |
| **Prehistoric Roar (Stun)** | `R` or `Shift` | **Roar** button |
| **Pause / Level Editor** | `Escape` or `P` | **II** button (top left) |
| **Music on / off** | `M` | Pause menu |

The game picks touch or mouse controls from your device, and switches on the fly: touch a touch-screen laptop and the touch controls appear; move the mouse and they go away. If your browser blocks pointer lock (some embeds do), mouse-look is off, clicks still attack, and the arrow keys turn. On a tablet, landscape and the **Full Window** button on the web page give the biggest view.

---

## 🗺️ Level Editor & Modding

The game includes a full level creation suite built directly into the engine:
* Press `Escape` while playing and click **"Edit this floor"** (or click **"Level Editor"** from the title screen).
* Select tiles from the palette (Walls, Doors, Trees, Dino Eggs, Enemies, Keys, Items) and paint directly onto the 24×24 grid.
* Click **"Playtest"** to instantly test your custom layout.
* Click **"Export Level"** to get the JSON representation to share or permanently bake into `rex-rumble.html`.

---

## ✅ Checks

The game has no build step and no dependencies, and neither do its checks:

```sh
node tools/check.js
```

It parses every inline script, boots the game headlessly (`tools/harness.js` stubs the DOM,
the 2D canvas and Web Audio), runs **the in-game editor's own audit** over all six shipped
floors, and plays 900 frames on each one with every dino awake — watching for exceptions,
NaNs, and anything clipping out of the grid.

The floor audit calls `getEditorValidation()` rather than reimplementing its rules, so it
can't drift from what the editor tells you when you build a level yourself.

GitHub Actions runs the same command on every pull request.

---

## 📜 Audio Credits
* Dinosaur Roar audio effect adapted from [BESTROFLMAN on FreeSound](https://freesound.org/people/BESTROFLMAN/sounds/212433/), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
* Procedural synthesizers for bites, footstep stomps, chomp impact, and the soundtrack, all generated in real time via the Web Audio API. Effects and music sit on separate buses, and the arrangement thickens while dinos are actually hunting you.

---

## 📄 License
This project is open-source under the MIT License. Feel free to remix, build custom levels, and expand the dinosaur kingdom!
