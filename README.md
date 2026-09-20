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
  * **Full Vertical Mouse & Touch Look**: Tilt your gaze up into the redwood canopy or down to the forest floor.
* **4-Angle Directional Dinosaur Sprites**:
  * Dinosaurs feature distinct front, side-profile (with dynamic flipping), and rear visual angles as they hunt, flee, or patrol.
* **Prehistoric Roster with Unique AI**:
  * 🟢 **Velociraptor**: Agile pack hunters that stalk and sprint to flank.
  * 🦏 **Triceratops**: Armored behemoths that charge with high knockback.
  * 🦅 **Pterosaur**: Flying predators swooping down from overhead.
  * 🐊 **Borealosuchus**: Prehistoric crocodilian lurkers lurking in the murky bayou.
  * 👹 **Carnotaurus (Sub-Boss)**: Fast, horned carnivore with a devastating charge.
  * 👑 **The Bone King (Boss)**: Colossal apex predator guarding the prehistoric Bone Throne.
* **5 Distinct Prehistoric Biomes**:
  1. **Floor 0: Verdant Canopy** — Open primeval forest with multi-layered depth trees, 100% organic tree-walls, and zero artificial doors.
  2. **Floor 1: Fernback Ruins** — Ancient stone pillars overgrown by primeval pines with hanging vine curtains.
  3. **Floor 2: Murky Bayou** — Deep cypress swamp with water ripples and a prehistoric bone gate locked by an amber fossil key.
  4. **Floor 3: Bubbling Basalt** — Volcanic obsidian caverns, ash floors, and the Carnotaurus sub-boss lair.
  5. **Floor 4: The Bone Throne** — Golden temple arena and the final showdown against The Bone King.
* **T-Rex Roar Stun Mechanic**: Unleash a powerful roar to terrify and stun surrounding dinosaurs.
* **Built-in In-Game Level Editor**:
  * Interactive grid painter directly in the browser (open via `Pause Menu` or `Title Screen`).
  * Real-time safety validation (ensures zero trees block 1-square passages or doors).
  * Texture pickers, ceiling height slider (`1.0x` to `4.0x`), entity counters, and 100% reachability audits.
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
| **Turn Camera** | Mouse horizontal move, or `←` / `→` | Drag on the right half, sideways |
| **Look Up / Down (Pitch)** | Mouse vertical move, `PageUp` / `PageDown`, `I` / `K` (`Home` to center) | Drag on the right half, up or down |
| **Claw** (quick swipe) | Left Mouse Click, `F` or `E` | **Claw** button |
| **Bite** (slow, strong) | Right Mouse Click or `Spacebar` | **Bite** button |
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

## 📜 Audio Credits
* Dinosaur Roar audio effect adapted from [BESTROFLMAN on FreeSound](https://freesound.org/people/BESTROFLMAN/sounds/212433/), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
* Procedural synthesizers for bites, footstep stomps, chomp impact, and ambient soundtrack generated in real-time via the Web Audio API.

---

## 📄 License
This project is open-source under the MIT License. Feel free to remix, build custom levels, and expand the dinosaur kingdom!
