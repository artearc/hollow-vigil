# Hollow Vigil

A dark-fantasy survival roguelike built with Three.js. Hold the Drowned Nave for ten minutes against an ever-growing horde and four bosses, combining nine schools of magic whose effects feed into one another.

**Play:** open the GitHub Pages link for this repository in a desktop browser.

## Controls
- **WASD / arrow keys:** move
- **Space:** dash (brief invulnerability)
- **E:** your character's rite (charges as you kill)
- **Esc:** pause
- A gamepad is also supported.

## Running locally
The game uses ES modules, so it has to be served over HTTP; opening `index.html` directly won't work:

```
npx serve .
```

Then open the address it prints.

## Structure
- `src/core`: utilities, input, spatial grid, save data
- `src/render`: renderer and post-processing, particles, ribbons, decals, telegraphs, VFX
- `src/world`: environment and props
- `src/game`: player, enemies, weapons, combat and synergies, bosses, director, progression
- `src/ui`: HUD, menus, damage numbers
- `src/audio`: fully procedural audio (Web Audio)
