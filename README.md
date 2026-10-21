# Smudge's Workshop

A cozy lofi scene: Smudge the sponge sits in his comic workshop and draws comic pages nonstop while music
plays. Every pixel is drawn by code into a 480×270 canvas, scaled up crisply.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer (it comes with npm). Check with `node -v`.

```
git clone <this repo's URL>
cd <repo folder>
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173), then click **Smudge's Workshop** to come in.
Browsers only start audio after a click. Vite reloads the page when you save a file.

| Command | Does |
|---|---|
| `npm install` | Installs the two dependencies (Vite and the Pixelify Sans font). Run once, and again after pulling changes to `package.json` |
| `npm run dev` | Starts the local dev server with live reload |
| `npm run build` | Builds the finished static site into `dist/` |
| `npm run preview` | Serves the `dist/` build locally, to check it before deploying |

On Windows, run these in PowerShell or Command Prompt, not in WSL. `node_modules` contains platform-specific
build tools, so a folder installed from WSL won't run from Windows (and the other way round). If you switch,
delete `node_modules` and run `npm install` again.

## Put it online (GitHub Pages)

The site is fully static, so GitHub Pages can host it for free. The workflow in
`.github/workflows/deploy.yml` builds and publishes it on every push to `main`.

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages**, and under **Build and deployment → Source** choose
   **GitHub Actions**.
3. Push (or run the workflow by hand from the **Actions** tab). When it finishes, the site is at
   `https://<your-username>.github.io/<repo-name>/`.

No configuration change is needed for the repo name: `vite.config.js` uses relative paths (`base: './'`),
so the build works at any address, including a custom domain.

## Controls

| Key | Does |
|---|---|
| Space | Play / pause |
| ← / → | Previous / next track |
| M | Song list (or click the song title) |
| S | Shuffle on / off |
| A | Ambience mixer |
| T | Time of day (Auto follows your clock, Cycle runs a day in 24 minutes, Manual holds an hour) |
| W | Weather: clear, rain, storm, snow |
| H | Hide / show the controls |
| F | Fullscreen |
| Esc | Close the open panel |

The controls fade after 3 seconds without mouse movement. Settings are remembered in this browser.

## Your music and sounds

- Music: see [public/music/README.md](public/music/README.md). Put files in `public/music/` and list them in
  `tracks.json`. The six built-in Smudge FM songs are generated live in the browser (lofi beats, ambient,
  brushed jazz, slow dub).
- Ambience: see [public/ambience/README.md](public/ambience/README.md). Drop `rain.mp3`, `thunder.mp3`,
  `city.mp3`, `clock.mp3` or `purr.mp3` there to replace a synthesised layer.

## Testing helpers (URL parameters)

| Parameter | Example | Does |
|---|---|---|
| `t` | `?t=22` | Hold the scene at an hour (0-23.99) |
| `weather` | `?weather=storm` | Start with a weather |
| `act` | `?act=coffee` | Start Smudge on an activity: `think`, `stretch`, `glance`, `coffee`, `breathe`, `show`, `dip`, `reject`, `tidy` |
| `track` | `?track=3` | Start on a given song (0-5) |
| `levels` | `?levels=1` | Log music vs ambience loudness to the console |
| `skip` | `?act=breathe&skip=4` | Fast-forward the simulation by that many seconds before the first frame |
| `panel` | `?panel=weather` | Open a panel on load |
| `progress` | `?progress=0.9` | How far along the first page is (0-1) |
| `seed` | `?seed=42` | Same seed → same comic pages |
| `speed` | `?speed=8` | Run time faster |
| `ui` | `?ui=0` | Hide all controls and the start screen |
| `crop` | `?crop=150,90,6` | Magnify a region (x, y, scale) to inspect pixels |
| `perf` | `?perf=1` | Log frame cost to the console every 5 seconds |
| `autostart` | `?autostart=1` | Skip the click (only where autoplay is allowed) |

## Layout

```
src/engine/   canvas scaling, palette, pixel primitives, seeded RNG, springs
src/scene/    layout (all coordinates), time of day, sky, city, weather, room, props, lighting, particles
src/smudge/   body, face, limbs (IK), comic page generator, behaviour loop
src/audio/    audio engine, Smudge FM song generator, music player, ambience
src/ui/       controls, settings, styles
```

Design notes and the scale table: [docs/PLAN_SMUDGE_LOFI_WORKSHOP.md](docs/PLAN_SMUDGE_LOFI_WORKSHOP.md).
