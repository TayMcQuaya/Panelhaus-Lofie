// One AudioContext with music and ambience buses into a gentle master compressor.
// Browsers only allow audio after a user gesture, so `start()` is called from the first click.
// Ambience sits well under the music: a full slider is a backdrop, never the main act.
const AMBIENCE_LEVEL = 0.5

export function createAudioEngine() {
  let ctx = null
  let master, music, ambience, ambienceOut
  let ambienceMuted = false

  function start() {
    if (ctx) return ctx.resume()
    ctx = new AudioContext()
    master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.ratio.value = 3
    master.connect(compressor).connect(ctx.destination)
    music = ctx.createGain()
    ambience = ctx.createGain()
    ambienceOut = ctx.createGain()
    ambienceOut.gain.value = ambienceMuted ? 0 : AMBIENCE_LEVEL
    ambience.connect(ambienceOut).connect(master)
    music.connect(master)
    return ctx.resume()
  }

  // Debug: RMS loudness of each bus in dBFS, for balancing music against ambience.
  let meters = null
  function levels() {
    if (!ctx) return null
    meters ??= Object.fromEntries(['music', 'ambience'].map((name) => {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 8192
      ;({ music, ambience: ambienceOut })[name].connect(analyser)
      return [name, analyser]
    }))
    return Object.fromEntries(Object.entries(meters).map(([name, analyser]) => {
      const data = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length)
      return [name, rms > 0 ? 20 * Math.log10(rms) : -Infinity]
    }))
  }

  // Silences every ambience layer at once without touching their individual levels.
  function setAmbienceMuted(muted) {
    ambienceMuted = muted
    ambienceOut?.gain.setTargetAtTime(muted ? 0 : AMBIENCE_LEVEL, ctx.currentTime, 0.08)
  }

  return {
    start,
    levels,
    setAmbienceMuted,
    get ctx() { return ctx },
    get master() { return master },
    get music() { return music },
    get ambience() { return ambience },
  }
}

const bufferCache = new WeakMap()

export function noiseBuffer(ctx, color = 'white', seconds = 2) {
  const perCtx = bufferCache.get(ctx) ?? new Map()
  bufferCache.set(ctx, perCtx)
  const key = `${color}:${seconds}`
  if (perCtx.has(key)) return perCtx.get(key)
  const length = Math.floor(ctx.sampleRate * seconds)
  const warmup = Math.floor(ctx.sampleRate * 0.5)
  const fade = Math.floor(ctx.sampleRate * 0.25)
  const raw = new Float32Array(warmup + length + fade)
  let last = 0, b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < raw.length; i++) {
    const white = Math.random() * 2 - 1
    if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02
      raw[i] = last * 3.5
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046
      b1 = 0.963 * b1 + white * 0.2965164
      b2 = 0.57 * b2 + white * 1.0526913
      raw[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2
    } else {
      raw[i] = white
    }
  }
  // Seamless loop: skip the filters' warm-up, then crossfade the tail into the head so the jump
  // from the last sample back to the first never clicks (that click was an audible crackle).
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const head = raw[warmup + i]
    if (i >= fade) { data[i] = head; continue }
    const t = i / fade
    data[i] = head * Math.sqrt(t) + raw[warmup + length + i] * Math.sqrt(1 - t)
  }
  perCtx.set(key, buffer)
  return buffer
}

export function loopNoise(ctx, color, seconds = 2) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx, color, seconds)
  source.loop = true
  source.start()
  return source
}
