// Smudge FM: songs generated live in the browser. Every song has a `style`, and each style is its
// own little band:
//   lofi    Rhodes-ish chords, round bass, soft kick/snare, swung hats, a kalimba
//   ambient no drums: slow evolving pads, a music box through an echo, a breath of air
//   jazz    brushed swing: walking upright bass, muted guitar comping on 2 and 4, brushes, rim
//   dub     slow and deep: sub bass, a lone kick, offbeat piano stabs drowned in tape echo
import { createRng } from '../engine/rng.js'
import { noiseBuffer } from './audioEngine.js'

export const SYNTH_SONGS = [
  { title: 'Ink & Rain', mood: 'Lofi beats', style: 'lofi', bpm: 72, swing: 0.16, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36], scale: [60, 62, 64, 67, 69, 72, 74] },
  { title: 'Midnight Panels', mood: 'Late-night lofi', style: 'lofi', bpm: 80, swing: 0.2, chords: [[57, 60, 64, 67], [50, 53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 59, 62]], bass: [45, 38, 43, 36], scale: [57, 60, 62, 64, 67, 69, 72] },
  { title: 'Sponge Thoughts', mood: 'Mellow lofi', style: 'lofi', bpm: 76, swing: 0.14, chords: [[51, 55, 58, 62], [48, 51, 55, 58], [56, 60, 63, 67], [58, 62, 65, 68]], bass: [39, 36, 44, 46], scale: [63, 65, 67, 70, 72, 75] },
  // D dorian, two bars per chord: Dm(add9) - Bbmaj7 - G(add9) - Am7
  { title: 'Graphite Drift', mood: 'Ambient focus', style: 'ambient', bpm: 60, seconds: 240, chords: [[50, 57, 60, 64], [46, 53, 57, 62], [43, 50, 55, 59, 62], [45, 52, 57, 60]], bass: [38, 34, 31, 33], scale: [74, 76, 77, 81, 84, 86] },
  // Bb major ii-V-I-vi: Cm9 - F13 - Bbmaj7 - Gm7, walking bass, triplet swing
  { title: 'Panel by Panel', mood: 'Brushed jazz', style: 'jazz', bpm: 96, swing: 0.33, chords: [[51, 55, 58, 62], [51, 55, 57, 62], [50, 53, 57, 60], [46, 50, 53, 58]], bass: [36, 41, 46, 43], scale: [65, 67, 69, 70, 72, 74, 77] },
  // A minor, two bars per chord: Am - G - F - Em
  { title: 'Night Shift Dub', mood: 'Slow dub', style: 'dub', bpm: 66, seconds: 210, chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]], bass: [33, 31, 29, 28], scale: [69, 72, 74, 76, 79] },
]

const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
export const songSeconds = (index) => SYNTH_SONGS[index % SYNTH_SONGS.length].seconds ?? 180
const SONG_LEVEL = 1.8

export function createSynthPlayer(ctx, output) {
  let song = null
  let songOut = null
  let timer = null
  let step = 0
  let nextStepTime = 0
  let startTime = 0
  let stepDur = 0.2
  let rng = null
  let wobble = null
  let echoIn = null
  let echoLoop = null

  function envGain(t, peak, attack, decay, release, end) {
    const g = ctx.createGain()
    const decayEnd = Math.min(t + attack + decay, end - 0.001)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.25), decayEnd)
    g.gain.setValueAtTime(Math.max(0.0002, peak * 0.25), end)
    g.gain.exponentialRampToValueAtTime(0.0001, end + release)
    return g
  }

  function keys(t, midi, dur, vel, bus) {
    const f = mtof(midi)
    const end = t + dur
    const amp = envGain(t, 0.07 * vel, 0.01, 1.4, 0.5, end)
    const carrier = ctx.createOscillator()
    carrier.frequency.value = f
    const mod = ctx.createOscillator()
    mod.frequency.value = f
    const modGain = ctx.createGain()
    modGain.gain.setValueAtTime(f * 1.6 * vel, t)
    modGain.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9)
    mod.connect(modGain).connect(carrier.frequency)
    const { depth } = wobble
    depth.connect(carrier.detune)
    carrier.onended = () => depth.disconnect(carrier.detune)
    carrier.connect(amp).connect(bus)
    for (const osc of [carrier, mod]) { osc.start(t); osc.stop(end + 0.6) }
  }

  function bass(t, midi, dur) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = mtof(midi)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const amp = envGain(t, 0.22, 0.015, 0.5, 0.2, t + dur)
    osc.connect(lp).connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + dur + 0.3)
  }

  function kalimba(t, midi) {
    const f = mtof(midi)
    for (const [mult, level] of [[1, 0.06], [2.01, 0.018]]) {
      const osc = ctx.createOscillator()
      osc.frequency.value = f * mult
      const amp = ctx.createGain()
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(level, t + 0.005)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + (mult === 1 ? 1.1 : 0.4))
      osc.connect(amp).connect(songOut)
      osc.start(t); osc.stop(t + 1.2)
    }
  }

  function kick(t) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.14)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.5, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    osc.connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + 0.4)
  }

  function noiseHit(t, type, freq, q, level, length) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 'white', 1)
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(level, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length)
    src.connect(filter).connect(amp).connect(songOut)
    src.start(t, Math.random() * 0.5); src.stop(t + length + 0.02)
  }

  // --- instruments for the ambient, jazz and dub styles ---

  function voice(type, freq, detune = 0) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    return osc
  }

  function lowpass(freq, q = 0.7) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    f.Q.value = q
    return f
  }

  // Two detuned saws through a filter that opens and closes over the chord: a slow, warm pad.
  function pad(t, midi, dur, level) {
    const f = mtof(midi)
    const filter = lowpass(380, 0.4)
    filter.frequency.setValueAtTime(380, t)
    filter.frequency.linearRampToValueAtTime(1150, t + dur * 0.45)
    filter.frequency.linearRampToValueAtTime(520, t + dur)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.linearRampToValueAtTime(level, t + Math.min(1.8, dur * 0.35))
    amp.gain.setValueAtTime(level, t + dur - 0.2)
    amp.gain.linearRampToValueAtTime(0.0001, t + dur + 2.2)
    filter.connect(amp).connect(songOut)
    for (const detune of [-8, 7]) {
      const osc = voice('sawtooth', f, detune)
      osc.connect(filter)
      osc.start(t); osc.stop(t + dur + 2.3)
    }
  }

  // A music-box tine: pure tone with a glassy overtone, sent into the echo.
  function musicBox(t, midi, level) {
    const f = mtof(midi)
    for (const [mult, gain, decay] of [[1, level, 1.8], [3.01, level * 0.22, 0.35]]) {
      const osc = voice('sine', f * mult)
      const amp = ctx.createGain()
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.004)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      osc.connect(amp)
      amp.connect(songOut)
      amp.connect(echoIn)
      osc.start(t); osc.stop(t + decay + 0.05)
    }
  }

  // A soft swell of filtered noise, like air moving through the room.
  function breath(t, dur, level) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 'pink', 6)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.linearRampToValueAtTime(level, t + dur * 0.5)
    amp.gain.linearRampToValueAtTime(0.0001, t + dur)
    src.connect(lowpass(700)).connect(amp).connect(songOut)
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05)
  }

  // Muted, warm guitar pluck: a saw whose filter snaps shut, short decay.
  function pluck(t, midi, level) {
    const filter = lowpass(2600, 1.2)
    filter.frequency.setValueAtTime(2600, t)
    filter.frequency.exponentialRampToValueAtTime(520, t + 0.22)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(level, t + 0.006)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    const osc = voice('sawtooth', mtof(midi))
    osc.connect(filter).connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + 0.75)
  }

  // Upright bass: round sine and triangle with a soft thump at the front.
  function upright(t, midi, dur) {
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(0.26, t + 0.02)
    amp.gain.exponentialRampToValueAtTime(0.08, t + dur)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12)
    const filter = lowpass(650)
    filter.connect(amp).connect(songOut)
    for (const type of ['sine', 'triangle']) {
      const osc = voice(type, mtof(midi))
      osc.connect(filter)
      osc.start(t); osc.stop(t + dur + 0.15)
    }
  }

  // A brush swept across the snare: a short bandpassed noise swell.
  function brush(t, level, length = 0.2) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 'white', 1)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 3800
    band.Q.value = 0.5
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.linearRampToValueAtTime(level, t + length * 0.35)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length)
    src.connect(band).connect(amp).connect(songOut)
    src.start(t, Math.random() * 0.5); src.stop(t + length + 0.02)
  }

  function rim(t, level, echoed = false) {
    const osc = voice('triangle', 1650)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(level, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    osc.connect(amp)
    amp.connect(songOut)
    if (echoed) amp.connect(echoIn)
    osc.start(t); osc.stop(t + 0.05)
  }

  // Deep sub bass that holds the root under the dub.
  function sub(t, midi, dur) {
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(0.34, t + 0.04)
    amp.gain.setValueAtTime(0.34, t + dur * 0.8)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const osc = voice('sine', mtof(midi))
    osc.connect(lowpass(220)).connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + dur + 0.05)
  }

  // Short piano stab whose tail lives in the tape echo.
  function stab(t, notes, level) {
    for (const midi of notes) {
      const f = mtof(midi)
      const amp = ctx.createGain()
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(level, t + 0.008)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
      const osc = voice('triangle', f)
      const overtone = voice('sine', f * 2)
      const otGain = ctx.createGain()
      otGain.gain.value = 0.3
      osc.connect(amp)
      overtone.connect(otGain).connect(amp)
      amp.connect(lowpass(1800)).connect(songOut)
      amp.connect(echoIn)
      for (const o of [osc, overtone]) { o.start(t); o.stop(t + 0.35) }
    }
  }

  function scheduleAmbient(s, t) {
    const inBar = s % 16
    const bar = Math.floor(s / 16)
    const chordIndex = Math.floor(bar / 2) % song.chords.length
    const chord = song.chords[chordIndex]
    if (inBar === 0 && bar % 2 === 0) {
      const dur = stepDur * 32
      chord.forEach((m, i) => pad(t + i * 0.09, m, dur, 0.022))
      pad(t, song.bass[chordIndex], dur, 0.03)
      breath(t + stepDur * 4, stepDur * 20, 0.018)
    }
    // A sparse music-box line: a few notes per bar, never on a fixed grid.
    if (inBar % 2 === 0 && rng.chance(inBar === 0 ? 0.55 : 0.16)) {
      musicBox(t + rng.range(0, stepDur * 0.4), rng.pick(song.scale), 0.05)
    }
  }

  function scheduleJazz(s, t) {
    const inBar = s % 16
    const bar = Math.floor(s / 16)
    const chordIndex = bar % song.chords.length
    const chord = song.chords[chordIndex]
    const nextRoot = song.bass[(chordIndex + 1) % song.chords.length]
    const root = song.bass[chordIndex]
    const swung = inBar % 4 === 2 ? t + song.swing * stepDur * 2 : t
    // Walking bass on every beat: root, fifth, a chord tone, then a step into the next root.
    if (inBar % 4 === 0) {
      const beat = inBar / 4
      const walk = [root, root + 7, root + rng.pick([3, 4, 9, 10]), nextRoot + rng.pick([-1, 1])][beat]
      upright(t, walk, stepDur * 3.6)
    }
    // Guitar comps on 2 and 4, with an occasional pushed chord before the bar line.
    if (inBar === 4 || inBar === 12 || (inBar === 14 && rng.chance(0.25))) {
      chord.forEach((m, i) => pluck(swung + i * 0.012, m, 0.045))
    }
    if (inBar === 4 || inBar === 12) brush(t, 0.07, 0.24)
    if (inBar % 4 === 2) brush(swung, 0.035, 0.12)
    if (inBar === 0 && rng.chance(0.35)) rim(t + stepDur * 7, 0.05)
    // Now and then a little single-note guitar line.
    if (inBar % 2 === 0 && bar % 4 >= 2 && rng.chance(0.3)) pluck(swung, rng.pick(song.scale), 0.05)
  }

  function scheduleDub(s, t) {
    const inBar = s % 16
    const bar = Math.floor(s / 16)
    const chordIndex = Math.floor(bar / 2) % song.chords.length
    const chord = song.chords[chordIndex]
    const root = song.bass[chordIndex]
    if (inBar === 0) {
      kickSoft(t)
      sub(t, root, stepDur * 6)
    }
    if (inBar === 10) sub(t, root + (rng.chance(0.5) ? 7 : 0), stepDur * 4)
    // Offbeat stabs, the dub signature, each one repeating off into the echo.
    if (inBar === 2 || inBar === 10 || (inBar === 6 && rng.chance(0.5))) stab(t, chord, 0.035)
    if (inBar === 8) rim(t, 0.06, true)
    if (inBar % 4 === 2) noiseHit(t, 'highpass', 8000, 0.7, 0.018, 0.04)
    if (bar % 4 === 3 && inBar === 12 && rng.chance(0.6)) musicBox(t, rng.pick(song.scale), 0.035)
  }

  function kickSoft(t) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(90, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.42, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + 0.55)
  }

  function scheduleStep(s, t) {
    if (song.style === 'ambient') return scheduleAmbient(s, t)
    if (song.style === 'jazz') return scheduleJazz(s, t)
    if (song.style === 'dub') return scheduleDub(s, t)
    scheduleLofi(s, t)
  }

  function scheduleLofi(s, t) {
    const inBar = s % 16
    const bar = Math.floor(s / 16)
    const chordIndex = bar % song.chords.length
    const breakdown = bar % 8 === 7
    const swung = inBar % 4 === 2 ? t + song.swing * stepDur * 2 : t

    if (inBar === 0) {
      song.chords[chordIndex].forEach((m, i) => keys(t + i * 0.014, m, stepDur * 15, 0.9, songOut))
      bass(t, song.bass[chordIndex], stepDur * 6)
    }
    if (inBar === 10 && rng.chance(0.6)) song.chords[chordIndex].slice(1).forEach((m, i) => keys(swung + i * 0.012, m + 12, stepDur * 5, 0.45, songOut))
    if (inBar === 10) bass(swung, song.bass[chordIndex] + (rng.chance(0.5) ? 7 : 12), stepDur * 3)

    if (!breakdown || inBar < 4) {
      if (inBar === 0 || inBar === 10 || (inBar === 7 && rng.chance(0.3))) kick(swung)
      if (inBar === 4 || inBar === 12) noiseHit(t, 'bandpass', 1700, 0.8, 0.16, 0.2)
      if (inBar % 2 === 0 && rng.chance(0.9)) noiseHit(swung, 'highpass', 7200, 0.7, inBar % 4 === 0 ? 0.05 : 0.03, 0.05)
    }
    if (inBar % 2 === 0 && rng.chance(breakdown ? 0.35 : 0.2)) kalimba(swung, rng.pick(song.scale) + 12)
  }

  function tick() {
    const ahead = document.hidden ? 1.6 : 0.25
    while (nextStepTime < ctx.currentTime + ahead) {
      scheduleStep(step, nextStepTime)
      nextStepTime += stepDur
      step++
    }
  }

  // `offset` (seconds) starts the song part-way through, which is how seeking works for songs
  // that are generated rather than recorded.
  function play(index, offset = 0) {
    stop()
    song = SYNTH_SONGS[index % SYNTH_SONGS.length]
    rng = createRng(index * 97 + 3)
    stepDur = 60 / song.bpm / 4
    songOut = ctx.createGain()
    const tape = ctx.createBiquadFilter()
    tape.type = 'lowpass'
    tape.frequency.value = 3600
    tape.Q.value = 0.4
    songOut.connect(tape).connect(output)
    // Tape echo on a dotted eighth: each repeat a little darker than the last.
    echoIn = ctx.createGain()
    echoIn.gain.value = 0.55
    const delay = ctx.createDelay(2)
    delay.delayTime.value = stepDur * 3
    const feedback = ctx.createGain()
    feedback.gain.value = 0.48
    const tone = lowpass(1600)
    echoIn.connect(delay)
    delay.connect(tone)
    tone.connect(feedback).connect(delay)
    tone.connect(songOut)
    echoLoop = { delay, feedback }
    songOut.gain.setValueAtTime(0.0001, ctx.currentTime)
    songOut.gain.exponentialRampToValueAtTime(SONG_LEVEL, ctx.currentTime + 0.8)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.35
    const depth = ctx.createGain()
    depth.gain.value = 7
    lfo.connect(depth)
    lfo.start()
    wobble = { lfo, depth }
    step = Math.max(0, Math.ceil(offset / stepDur))
    nextStepTime = ctx.currentTime + 0.08
    startTime = nextStepTime - step * stepDur
    tick()
    timer = setInterval(tick, 50)
  }

  function stop() {
    if (!song) return
    clearInterval(timer)
    const out = songOut, { lfo } = wobble, loop = echoLoop
    out.gain.cancelScheduledValues(ctx.currentTime)
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime)
    out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    // Notes already scheduled ahead keep sounding into `out`; cut it loose once they are silent,
    // and break the echo's feedback loop so it can be released.
    setTimeout(() => { out.disconnect(); lfo.stop(); loop.feedback.disconnect(); loop.delay.disconnect() }, 2200)
    song = null
  }

  return {
    play,
    stop,
    elapsed: () => (song ? Math.max(0, ctx.currentTime - startTime) : 0),
    beatPhase: () => (song ? (((ctx.currentTime - startTime) / (stepDur * 4)) % 1 + 1) % 1 : 0),
  }
}
