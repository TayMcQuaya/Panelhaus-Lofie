import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import './ui/styles.css'
import { createAmbience } from './audio/ambience.js'
import { createAudioEngine } from './audio/audioEngine.js'
import { createMusicPlayer } from './audio/musicPlayer.js'
import { attachDisplay, H, makeLayer, W } from './engine/canvas.js'
import { createScene } from './scene/scene.js'
import { createControls } from './ui/controls.js'
import { loadSettings, saveSettings, TIME_MODES, WEATHERS } from './ui/settings.js'

const WEATHER_AMBIENCE = {
  clear: { rain: 0, thunder: 0 },
  rain: { rain: 0.3, thunder: 0 },
  storm: { rain: 0.35, thunder: 0.3 },
  snow: { rain: 0, thunder: 0 },
}

// Query parameters for testing and screenshots: ?t=22&weather=rain&progress=0.5&speed=4&ui=0
const params = new URLSearchParams(location.search)
const numberParam = (name, lo, hi) => {
  const raw = params.get(name)
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= lo && value <= hi ? value : null
}

const settings = loadSettings()
const forcedHour = numberParam('t', 0, 23.99)
if (forcedHour !== null) Object.assign(settings, { timeMode: 'manual', manualHour: forcedHour })
if (WEATHERS.includes(params.get('weather'))) {
  settings.weather = params.get('weather')
  Object.assign(settings.ambience, WEATHER_AMBIENCE[settings.weather])
}

const localHour = () => {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
}

const world = {
  time: 0,
  hour: settings.timeMode === 'manual' ? settings.manualHour : localHour(),
  timeMode: settings.timeMode,
  weather: settings.weather,
  music: { playing: false, beatPhase: 0 },
  env: null,
  flash: 0,
}

const engine = createAudioEngine()
const player = createMusicPlayer(engine)
const ambience = createAmbience(engine)
const scene = createScene({
  seed: numberParam('seed', 1, 1e6) ?? Math.floor(Math.random() * 1e5) + 1,
  startProgress: numberParam('progress', 0, 1) ?? 0.35,
  firstActivity: params.get('act'),
  onThunder: (delay) => ambience.thunderClap(delay),
})

let saveTimer = null
const persist = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveSettings({ ...settings, trackIndex: player.index }), 400)
}

const app = {
  settings,
  setMusicVolume(v) { settings.musicVolume = v; player.setVolume(v); persist() },
  setAmbience(id, v) { settings.ambience[id] = v; ambience.setVolume(id, v); persist() },
  setTimeMode(mode) {
    if (!TIME_MODES.includes(mode)) return
    settings.timeMode = mode
    world.timeMode = mode
    if (mode === 'manual') settings.manualHour = world.hour
    controls.renderSettings()
    persist()
  },
  setManualHour(hour) {
    settings.manualHour = Math.min(23.99, Math.max(0, hour))
    settings.timeMode = 'manual'
    world.timeMode = 'manual'
    world.hour = settings.manualHour
    controls.renderSettings()
    persist()
  },
  setWeather(weather) {
    if (!WEATHERS.includes(weather)) return
    settings.weather = weather
    world.weather = weather
    for (const [id, v] of Object.entries(WEATHER_AMBIENCE[weather])) app.setAmbience(id, v)
    if (weather === 'storm') setTimeout(scene.strikeLightning, 900)
    controls.renderSettings()
    persist()
  },
}

const controls = createControls({ player, app })
player.onChange(persist)
// ?track=3 starts on a given song (for testing); otherwise the last song you listened to.
player.init(numberParam('track', 0, 199) ?? settings.trackIndex)

const startOverlay = document.getElementById('start')
async function enter() {
  startOverlay.classList.add('leaving')
  setTimeout(() => startOverlay.remove(), 900)
  await engine.start()
  player.setVolume(settings.musicVolume)
  ambience.start(settings.ambience)
  player.play()
}
document.getElementById('start-button').addEventListener('click', enter, { once: true })

// Debug: ?levels=1 logs music vs ambience loudness (dBFS, averaged) every 4 seconds.
if (params.get('levels') === '1') {
  const sums = { music: [], ambience: [] }
  setInterval(() => {
    const now = engine.levels()
    if (!now) return
    for (const key of Object.keys(sums)) if (Number.isFinite(now[key])) sums[key].push(now[key])
  }, 100)
  setInterval(() => {
    const avg = (list) => (list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : 'silent')
    console.info(`[levels] music ${avg(sums.music)} dB · ambience ${avg(sums.ambience)} dB`)
    sums.music.length = 0
    sums.ambience.length = 0
  }, 4000)
}

// Debug: ?autostart=1 skips the click (only works where the browser allows autoplay).
if (params.get('autostart') === '1') enter()

// Debug: ?panel=weather opens a panel on load, for screenshots of the UI.
document.querySelector(`[data-panel="${CSS.escape(params.get('panel') ?? '')}"]`)?.click()

if (params.get('ui') === '0') {
  document.body.classList.add('ui-hidden')
  startOverlay.remove()
}

// Debug: ?crop=x,y,scale magnifies one region of the buffer, for inspecting pixel detail.
const crop = params.get('crop')?.split(',').map(Number)
const cropping = crop?.length === 3 && crop.every(Number.isFinite)
const canvas = document.getElementById('scene')
const { ctx, view } = attachDisplay(canvas, { fixed: cropping })
const frameLayer = makeLayer(W, H)
if (cropping) {
  const [cx, cy, cs] = crop
  Object.assign(canvas.style, { position: 'fixed', left: `${-cx * cs}px`, top: `${-cy * cs}px`, width: `${480 * cs}px`, height: `${270 * cs}px` })
}

const speed = numberParam('speed', 0.1, 50) ?? 1
let last = performance.now()
let refreshIn = 0

// Debug: ?perf=1 logs the average and worst frame cost (update + render) every 5 seconds.
const perf = params.get('perf') === '1' ? { total: 0, worst: 0, frames: 0, since: performance.now() } : null
function recordPerf(cost) {
  perf.total += cost
  perf.worst = Math.max(perf.worst, cost)
  perf.frames++
  if (performance.now() - perf.since < 5000) return
  console.info(`[perf] ${perf.frames} frames, avg ${(perf.total / perf.frames).toFixed(2)} ms, worst ${perf.worst.toFixed(2)} ms`)
  Object.assign(perf, { total: 0, worst: 0, frames: 0, since: performance.now() })
}

function advanceClock(dt) {
  if (world.timeMode === 'auto') world.hour = localHour()
  else if (world.timeMode === 'cycle') world.hour = (world.hour + dt / 60) % 24
  else world.hour = settings.manualHour
}

// Debug: ?skip=4 fast-forwards the simulation 4 seconds before the first frame (for screenshots
// of a moment inside an activity).
const skip = numberParam('skip', 0, 600) ?? 0
for (let i = 0; i < skip * 60; i++) {
  world.time += 1 / 60
  advanceClock(1 / 60)
  scene.update(1 / 60, world)
}

function frame(now) {
  const workStart = performance.now()
  const dt = Math.min(0.1, Math.max(0, now - last) / 1000) * speed
  last = now
  player.update()
  world.music.playing = player.playing
  world.music.beatPhase = player.beatPhase()
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)))
  for (let i = 0; i < steps; i++) {
    world.time += dt / steps
    advanceClock(dt / steps)
    scene.update(dt / steps, world)
  }
  scene.render(frameLayer.ctx, world)
  if (view.width !== W || view.height !== H) scene.renderShell(ctx, world, view)
  ctx.drawImage(frameLayer.canvas, view.offsetX, view.offsetY)
  if (perf) recordPerf(performance.now() - workStart)

  refreshIn -= dt
  if (refreshIn <= 0) {
    refreshIn = 0.25
    controls.refresh({ status: scene.smudge.status(), hour: world.hour, label: world.env.label, weather: world.weather })
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
