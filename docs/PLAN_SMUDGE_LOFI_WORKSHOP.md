# Plan: Smudge's Lofi Workshop

Date: 2026-10-21
Status: first playable version built 2026-10-21, awaiting the owner's review

## Goal

A cozy lofi web scene in the style of loficities.com: Smudge the sponge (Comic-Pro2 / Day of the
Smudgies) sits in his comic workshop and draws comic pages, nonstop, while music plays. The viewer picks
music, mixes ambience, and sets time of day and weather. Every pixel is drawn by code, like Lofi Cities
and the Smudgies game, but with richer shading, a curated palette and a denser environment than the game.

## References used

| Source | What it gives us |
|---|---|
| `Comic-Pro2/public/images/smudge-pack/smudge-canonical.png` | canonical look: round yellow sponge, pores, water droplets, thin yellow limbs, brown boots, black oval eyes, pink tongue, dark-blue ink drips from hands and feet |
| `Comic-Pro2/public/images/Smudge_the_dirty_sponge/09-sitting.png`, `17-stretching.png`, `12-thinking.png` | sitting, stretching and thinking poses |
| `Comic-Pro2/public/images/smudge/inking.png` | Smudge drawing on a board, focused expression |
| Day of the Smudgies (title + Tumble's street) | code-drawn 320x200 pixel art, dark outline, indigo/violet night city, warm window lights, pink neon "TUMBLE'S" sign, Pixelify Sans font, black cat on a roof |
| loficities.com | 480x270 scene, full-bleed, UI that fades on mouse idle, H hides UI, weather override, per-sound ambience sliders, music up-next list |

## Scope

In:
- One scene: side view of the workshop with a big window onto the city.
- Smudge animated at the drafting table, with a behaviour loop (see below). The comic page he draws
  visibly fills up; finished pages get pinned to the wall.
- Time of day: **Auto** (follows the viewer's clock), **Cycle** (a full day in 24 minutes), or a manual
  slider. Dawn, day, dusk and night each have their own palette and lighting.
- Weather: clear, rain, thunderstorm, snow.
- Music player: play/pause, prev/next, track list, volume. Placeholder tracks are synthesised in the
  browser; real files drop into `public/music/` via `tracks.json` and replace them.
- Ambience mixer: rain, thunder, vinyl crackle, city, clock tick, cat purr, one slider each. Synthesised
  placeholders, same file override as music.
- UI overlay that fades when the mouse stops, `H` to hide, fullscreen, settings remembered in the browser.

Out (later, if wanted): focus timer, multiple rooms, chat/social, radio sync, OBS mode, pixelised real
Smudgies comic pages on the wall, mobile drag-to-pan.

## Stack

Vite + vanilla JS, no framework. One `<canvas>` with a 480x270 logical buffer, scaled by the largest
integer factor that fits (1920x1080 → exactly 4x), `image-rendering: pixelated`, dark frame colour
around it. Controls are plain HTML/CSS on top of the canvas. Deploys as static files.

## Scale ("realistic dimensions")

Smudge is kid-sized. One metre is about 90 px; the frame shows about 3 m of height and 5.3 m of width.

| Thing | Real size | Pixels |
|---|---|---|
| Smudge body (sponge ball) | ~0.45 m | ~40 px diameter |
| Smudge standing height | ~1.1 m | ~100 px |
| Drafting table top | ~0.95 m high | ~85 px |
| Stool seat | ~0.65 m | ~58 px |
| Window | 1.6 x 1.2 m | ~145 x 108 px |
| Door-height shelf | 2 m | ~180 px |
| Cat | 0.45 m long | ~40 px |
| Mug | 0.1 m | ~9 px |

Every prop is drawn against this table, so nothing looks toy-sized next to him.

## Art direction

- **Palette:** curated named ramps rather than free colours. Warm interior: amber, terracotta, cream,
  walnut and oak browns. Cool exterior: indigo, violet, dusk teal. Accents: Tumble's neon pink and teal.
  Smudge: a 5-step yellow ramp, from deep ochre shadow to pale highlight, plus ink navy `#1b2240`.
- **Outline:** a dark, coloured outline (not pure black), as in the game, on characters and key props.
- **Lighting:** a light map composited over the scene each frame. The room is tinted by the time of day,
  and warm pools are added for the desk lamp, fairy lights and a neon spill. Light falloff uses ordered
  (Bayer) dithering so gradients stay pixel-art and do not turn into smooth blur. Lightning flashes
  the whole room.
- **Font:** Pixelify Sans, the same as the game.

## Scene layers (back to front)

1. Sky gradient for the time of day; sun or moon; stars that twinkle; clouds that drift.
2. City in 3 parallax rows. Building windows light up from seeded randomness at dusk. Antenna lights
   blink. The Tumble's Comics neon sign is across the street.
3. Weather seen through the window: rain streaks, snow, lightning; drops running down the glass.
4. Window frame and sill: plant, steaming mug, sleeping cat (on the sill by day, on the rug at night).
5. Wall: wood wainscot and wallpaper, shelves of comics and ink jars, a corkboard where finished pages
   get pinned, fairy lights, a "DAY OF THE SMUDGIES #1" poster (clicking it opens the game), a clock that shows the real time.
6. Floor: wood planks, rug, record player whose vinyl spins while music plays, comic stacks, a bin with
   crumpled paper balls, an ink stain that grows slowly from Smudge's drips.
7. Drafting table, tilted towards the camera so the page reads as a slanted rectangle, with a desk lamp.
8. Smudge on his stool.
9. Light map, then particles: dust motes in the lamp beam, mug steam, ink drips.

Static layers are pre-rendered to offscreen canvases and redrawn only when time of day or weather
changes.

## Smudge

**Rig, not flipbook.** Smudge is built from parts so he can move smoothly at 60 fps and stay crisp:
- Body: a procedurally drawn shaded sponge disc with pores and droplets fixed in body space, cached in
  3 squash variants for breathing and leaning.
- Face: eyes (blink, look at page, look at window, sleepy at night) and mouth (focused with tongue out,
  smile, "o" while thinking, yawn).
- Arms: two-segment limbs solved with simple IK from shoulder to target, drawn as outlined 2-3 px lines.
  The drawing hand's target is the pen tip on the page, so the pen really follows the strokes.
- Legs: dangle from the stool, boots swing lazily.
- All positions round to whole pixels at draw time, so nothing shimmers. Motion uses easing curves.

**Behaviour loop** (weighted random, never the same action twice in a row):
- Draw (most of the time): pencils a panel, then inks it. Head tilts to follow the hand.
- Dip pen in the ink jar; a drip falls.
- Lean back and look at the page (thinking face).
- Sip from the mug.
- Stretch both arms up (`17-stretching` reference).
- Glance out of the window.
- Page done: lift it, pin it on the corkboard, take a fresh sheet. The board holds the last 6 pages.
- When music plays, his head bobs to the track's BPM. At night he yawns more often.

**The comic page:** each page is generated from a seed: a panel layout of 2-3 rows, then strokes per
panel (tiny Smudge doodles, buildings, speech bubbles, motion lines, hatching). The strokes are drawn in
order: pencil (light blue), then ink (navy), then a few yellow spot fills. Page space maps onto the
slanted board with an affine transform, which also gives the IK target.

## Audio

- One `AudioContext` with three buses: music, ambience, master. It starts on the first click, as
  browsers require.
- **Music:** `public/music/tracks.json` lists `{ title, artist, src, bpm }`. Tracks without a `src` are
  played by the built-in synth: 3 placeholder lofi loops (Rhodes-like chords through a lowpass,
  soft kick/snare, swung hats, vinyl wobble, 70-85 BPM).
- **Ambience:** each layer has a synth placeholder (filtered noise for rain, low rumble bursts for thunder,
  random clicks for crackle, brown noise plus occasional distant traffic for city, a tick for the clock,
  a low pulse for the purr). An optional `public/ambience/<name>.mp3` replaces each one when present.
- Picking a weather fades its matching ambience up, as on Lofi Cities. The sliders still win.

## Controls

| Control | Where | Keys |
|---|---|---|
| Play/pause, prev/next, volume, track list | bottom player bar | Space, ←/→ |
| Ambience sliders | Ambience panel | A |
| Time: Auto / Cycle / manual slider | Time panel | T |
| Weather: clear / rain / storm / snow | Weather panel | W |
| Hide UI, fullscreen | corner buttons | H, F |

Settings are saved in `localStorage`. If storage is blocked, the scene runs on defaults.

## Files

```
index.html
package.json, vite.config.js
src/main.js                 boot, game loop (fixed 60 Hz update, render on rAF)
src/engine/                 canvas scaling, palette, pixel primitives, seeded RNG, dithering
src/scene/                  timeOfDay, sky, city, weather, room, props/*, lighting, particles
src/smudge/                 smudge (behaviour state machine), body, face, limbs (IK), comicPage
src/audio/                  audioEngine, musicPlayer, synthTracks, ambience
src/ui/                     controls, panels, settings store, styles.css
public/music/tracks.json    track list (placeholders until real tracks arrive)
public/ambience/            optional real ambience files
public/fonts/               Pixelify Sans
```

## Error handling

- Audio cannot start before a user gesture: show a "click to start" overlay and do not fail silently.
- A track or ambience file that fails to load is logged to the console, skipped, and falls back to its
  synth placeholder.
- A malformed `tracks.json` is logged and replaced by the built-in placeholder list.
- Settings loaded from storage are checked against allowed values (weather, time mode, volumes 0-1);
  anything else falls back to the default.

## Verification

UI and art get no automated tests, per the testing rules. Checks instead:
- Headless Chrome screenshots of dawn, day, dusk and night × clear, rain, storm, snow, compared by eye.
- A screen recording of 2 minutes of Smudge's loop, checked for pops, shimmer and repeated actions.
- A frame-time trace in Chrome DevTools: target under 4 ms per frame on a laptop.
- Audio: each control exercised by hand; a bad `src` in `tracks.json` falls back to synth.

## Build order

1. Vite skeleton, canvas scaling, loop, palette, primitives.
2. Room, window, city, sky with time of day and the lighting pass. A static scene that looks right first.
3. Smudge rig: body, face, limbs, sitting pose. Then the drawing behaviour and comic page.
4. The rest of the behaviour loop, the corkboard, the cat and props animation.
5. Weather: visuals, then lightning.
6. Audio engine, synth music, ambience, then the player UI.
7. UI panels, shortcuts, settings, fade on idle.
8. Polish pass on palette and timing, verification screenshots.
