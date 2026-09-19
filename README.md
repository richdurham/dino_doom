# 🦖 Rex Rumble (Dino Doom)

A retro-style 2.5D prehistoric raycasting action game inspired by classic *Wolfenstein 3D* and *Doom*, built entirely in self-contained **HTML5 Canvas** and **Vanilla JavaScript** with procedural graphics, authentic synthesizer sound effects, and Web Audio.

![Rex Rumble Gameplay](https://raw.githubusercontent.com/richdurham/dino_doom/main/screenshot.png)

---

## 🌟 Features

* **Pure Vanilla HTML5 / JS**: Zero external dependencies, zero bundlers, zero build steps. Just open `rex-rumble.html` in any modern web browser to play!
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
  * Auto-saves to `localStorage`, with one-click **Playtest**, **Export JSON**, **Import**, and **Reset Floor** to factory defaults.

---

## 🎮 How to Play

### Quick Start
1. Clone or download this repository.
2. Double-click `rex-rumble.html` to open it in Chrome, Firefox, Safari, or Edge.
3. Click to lock mouse pointer and start stomping!

### Controls

| Action | Keyboard / Mouse | Touch |
| :--- | :--- | :--- |
| **Move & Strafe** | `W`, `A`, `S`, `D` or Arrow Keys | Left virtual joystick |
| **Turn Camera** | Mouse horizontal move or `Q`, `E` | Right screen drag horizontal |
| **Look Up / Down (Pitch)** | Mouse vertical move, `PageUp` / `PageDown`, `I` / `K` (`Home` to center) | Right screen drag vertical |
| **Bite / Chomp Attack** | `Spacebar` or Left Mouse Click | Tap Chomp button |
| **Prehistoric Roar (Stun)** | `R` or Right Mouse Click | Tap Roar button |
| **Pause / Level Editor** | `Escape` or `P` | Tap Pause button |

---

## 🗺️ Level Editor & Modding

The game includes a full level creation suite built directly into the engine:
* Press `Escape` while playing and click **"Edit this floor"** (or click **"Level Editor"** from the title screen).
* Select tiles from the palette (Walls, Doors, Trees, Dino Eggs, Enemies, Keys, Items) and paint directly onto the 24×24 grid.
* Click **"Playtest"** to instantly test your custom layout.
* Click **"Export Level"** to get the JSON representation to share or permanently bake into `rex-rumble.html`.

---

## 📜 Audio Credits
* Dinosaur Roar audio effect adapted from [BESTROFLMAN on FreeSound](https://freesound.org/people/BESTROFLMAN/sounds/212433/) under Creative Commons.
* Procedural synthesizers for bites, footstep stomps, chomp impact, and ambient soundtrack generated in real-time via the Web Audio API.

---

## 📄 License
This project is open-source under the MIT License. Feel free to remix, build custom levels, and expand the dinosaur kingdom!
