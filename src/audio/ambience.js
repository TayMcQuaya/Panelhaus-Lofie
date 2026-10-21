// Five ambience layers, each with its own volume. Each is synthesised until a real file exists at
// public/ambience/<id>.mp3 (checked once at start), which then replaces it.
import { loopNoise, noiseBuffer } from './audioEngine.js'

// `weathers`: the layer only exists (and is only offered in the mixer) in those weathers.
export const AMBIENCE_LAYERS = [
  { id: 'rain', label: 'Rain', weathers: ['rain', 'storm'] },
  { id: 'thunder', label: 'Thunder', weathers: ['storm'] },
  { id: 'city', label: 'City' },
  { id: 'clock', label: 'Clock' },
  { id: 'purr', label: 'Cat purr' },
]

const BASE = import.meta.env.BASE_URL

function filter(ctx, type, frequency, q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function gain(ctx, value) {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

const SYNTH = {
  rain(ctx, out) {
    loopNoise(ctx, 'pink', 6).connect(filter(ctx, 'highpass', 420)).connect(filter(ctx, 'lowpass', 2400)).connect(gain(ctx, 0.3)).connect(out)
    loopNoise(ctx, 'brown', 6).connect(filter(ctx, 'lowpass', 260)).connect(gain(ctx, 0.15)).connect(out)
  },
  city(ctx, out) {
    loopNoise(ctx, 'brown', 4).connect(filter(ctx, 'lowpass', 360)).connect(gain(ctx, 0.45)).connect(out)
  },
  purr(ctx, out) {
    const am = gain(ctx, 0.5)
    const flutter = ctx.createOscillator()
    flutter.frequency.value = 26
    flutter.connect(gain(ctx, 0.5)).connect(am.gain)
    const breath = gain(ctx, 0.55)
    const lungs = ctx.createOscillator()
    lungs.frequency.value = 0.32
    lungs.connect(gain(ctx, 0.45)).connect(breath.gain)
    loopNoise(ctx, 'brown', 3).connect(filter(ctx, 'lowpass', 210)).connect(am).connect(breath).connect(gain(ctx, 1.6)).connect(out)
    flutter.start()
    lungs.start()
  },
  clock() {},
  thunder() {},
}

async function findFile(id) {
  const url = `${BASE}ambience/${id}.mp3`
  const response = await fetch(url, { method: 'HEAD' })
  return response.ok && (response.headers.get('content-type') ?? '').startsWith('audio/') ? url : null
}

export function createAmbience(engine) {
  const outputs = {}
  const volumes = {}
  let ctx = null
  let thunderBuffer = null
  let nextCar = 6, nextHorn = 40, nextRumble = 30, nextTick = 0, tock = false
  let timer = null
  const fileLayers = new Set()

  function oneShotNoise(at, color, filterType, from, to, length, peak, out) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, color, 6)
    const f = filter(ctx, filterType, from)
    f.frequency.setValueAtTime(from, at)
    f.frequency.exponentialRampToValueAtTime(to, at + length)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.4, length * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, at + length)
    src.connect(f).connect(g).connect(out)
    src.start(at, Math.random() * 2)
    src.stop(at + length + 0.05)
  }

  function rumble(at, strength) {
    if (thunderBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = thunderBuffer
      src.connect(gain(ctx, strength)).connect(outputs.thunder)
      src.start(at)
      return
    }
    if (strength > 0.7) oneShotNoise(at, 'white', 'highpass', 1800, 900, 0.35, 0.12 * strength, outputs.thunder)
    oneShotNoise(at, 'brown', 'lowpass', 600, 100, 4.5 + Math.random() * 2, 0.6 * strength, outputs.thunder)
  }

  function carPass(at) {
    oneShotNoise(at, 'pink', 'bandpass', 450, 950, 3.6, 0.14, outputs.city)
  }

  function horn(at) {
    for (const f of [330, 415]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.025, at + 0.03)
      g.gain.setValueAtTime(0.025, at + 0.3)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4)
      osc.connect(filter(ctx, 'lowpass', 1100)).connect(g).connect(outputs.city)
      osc.start(at); osc.stop(at + 0.45)
    }
  }

  function tick(at) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 'white', 1)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
    src.connect(filter(ctx, 'bandpass', tock ? 2300 : 3300, 4)).connect(g).connect(outputs.clock)
    src.start(at, Math.random() * 0.5)
    src.stop(at + 0.05)
    tock = !tock
  }

  // Event sounds (traffic, ticks, distant thunder) are scheduled a little ahead on the audio clock.
  function schedule() {
    const now = ctx.currentTime
    if (nextTick < now) nextTick = Math.ceil(now)
    while (nextTick < now + 0.6) { if (!fileLayers.has('clock')) tick(nextTick); nextTick += 1 }
    if (now > nextCar) { if (volumes.city > 0) carPass(now + 0.05); nextCar = now + 7 + Math.random() * 14 }
    if (now > nextHorn) { if (volumes.city > 0) horn(now + 0.05); nextHorn = now + 40 + Math.random() * 60 }
    if (now > nextRumble) { if (volumes.thunder > 0) rumble(now + 0.05, 0.35 + Math.random() * 0.25); nextRumble = now + 25 + Math.random() * 40 }
  }

  async function useFileIfPresent(id) {
    const url = await findFile(id)
    if (!url) return
    if (id === 'thunder') {
      const data = await (await fetch(url)).arrayBuffer()
      thunderBuffer = await ctx.decodeAudioData(data)
      return
    }
    const audio = new Audio(url)
    audio.loop = true
    const layer = gain(ctx, volumes[id])
    ctx.createMediaElementSource(audio).connect(layer).connect(engine.ambience)
    outputs[id].disconnect()
    outputs[id] = layer
    fileLayers.add(id)
    await audio.play()
    console.info(`[ambience] using ${url}`)
  }

  function start(initialVolumes) {
    ctx = engine.ctx
    for (const { id } of AMBIENCE_LAYERS) {
      volumes[id] = initialVolumes[id] ?? 0
      outputs[id] = gain(ctx, volumes[id])
      outputs[id].connect(engine.ambience)
      SYNTH[id](ctx, outputs[id])
    }
    nextCar += ctx.currentTime; nextHorn += ctx.currentTime; nextRumble += ctx.currentTime
    schedule()
    timer = setInterval(schedule, 200)
    for (const { id } of AMBIENCE_LAYERS) {
      useFileIfPresent(id).catch((err) => console.warn(`[ambience] could not use file for ${id}`, err))
    }
  }

  function setVolume(id, value) {
    volumes[id] = value
    if (outputs[id]) outputs[id].gain.setTargetAtTime(value, ctx.currentTime, 0.15)
  }

  function thunderClap(delaySeconds) {
    if (!ctx || !volumes.thunder) return
    rumble(ctx.currentTime + delaySeconds, 1)
  }

  return { start, setVolume, thunderClap, get started() { return timer !== null } }
}
