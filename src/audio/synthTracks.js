// Smudge FM: songs generated live in the browser.
//
// Most songs use the `lofi` style, a small configurable band: each song picks its drum pattern,
// chord instrument and rhythm, bass, and lead (see LOFI_DEFAULTS). Two songs have styles of
// their own:
//   ambient  no drums: slow evolving pads, a music box through an echo, a breath of air
//   dub      slow and deep: sub bass, a lone kick, offbeat piano stabs drowned in tape echo
// Everything goes through a gentle lowpass "tape" filter, so nothing is ever harsh.
import { createRng } from '../engine/rng.js'
import { noiseBuffer } from './audioEngine.js'

const LOFI_DEFAULTS = {
  drums: 'boombap', // boombap | soft | half | bossa
  chordVoice: 'keys', // keys | pluck | pulse
  chordRhythm: 'whole', // whole | push | bossa | arp
  bassVoice: 'round', // round | sub | upright | chip
  bassRhythm: 'lofi', // lofi | bossa | half
  lead: 'kalimba', // kalimba | musicBox | chip | null
  leadChance: 0.2,
  leadOctave: 12,
  padLayer: false,
  echoKeys: 0,
  swing: 0.15,
}

export const SYNTH_SONGS = [
  { title: 'Ink & Rain', mood: 'Lofi beats', style: 'lofi', bpm: 72, swing: 0.16, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36], scale: [60, 62, 64, 67, 69, 72, 74] },
  { title: 'Midnight Panels', mood: 'Late-night lofi', style: 'lofi', bpm: 80, swing: 0.2, chords: [[57, 60, 64, 67], [50, 53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 59, 62]], bass: [45, 38, 43, 36], scale: [57, 60, 62, 64, 67, 69, 72] },
  { title: 'Sponge Thoughts', mood: 'Mellow lofi', style: 'lofi', bpm: 76, swing: 0.14, chords: [[51, 55, 58, 62], [48, 51, 55, 58], [56, 60, 63, 67], [58, 62, 65, 68]], bass: [39, 36, 44, 46], scale: [63, 65, 67, 70, 72, 75] },
  // D dorian, two bars per chord: Dm(add9) - Bbmaj7 - G(add9) - Am7
  { title: 'Graphite Drift', mood: 'Ambient focus', style: 'ambient', bpm: 60, seconds: 240, chords: [[50, 57, 60, 64], [46, 53, 57, 62], [43, 50, 55, 59, 62], [45, 52, 57, 60]], bass: [38, 34, 31, 33], scale: [74, 76, 77, 81, 84, 86] },
  // Chiptune lofi: a soft square-wave arpeggio, triangle bass and a vibrato lead. Am7 - Fmaj7 - Cmaj7 - G6
  {
    title: 'Panel by Panel', mood: 'Chiptune lofi', style: 'lofi', bpm: 78, swing: 0.1,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]], bass: [45, 41, 36, 43], scale: [69, 72, 74, 76, 79, 81],
    drums: 'soft', chordVoice: 'pulse', chordRhythm: 'arp', bassVoice: 'chip', lead: 'chip', leadChance: 0.32, leadOctave: 0, echoKeys: 0.25,
  },
  // A minor, two bars per chord: Am - G - F - Em
  { title: 'Night Shift Dub', mood: 'Slow dub', style: 'dub', bpm: 66, seconds: 210, chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]], bass: [33, 31, 29, 28], scale: [69, 72, 74, 76, 79] },
  // D major, bright and bouncy: Dmaj9 - Bm7 - Gmaj7 - A6
  {
    title: 'Morning Ink', mood: 'Sunny lofi', style: 'lofi', bpm: 86, swing: 0.18,
    chords: [[54, 57, 61, 64], [50, 54, 57, 61], [55, 59, 62, 66], [52, 57, 61, 66]], bass: [38, 35, 31, 33], scale: [74, 76, 78, 81, 83, 86],
    chordRhythm: 'push', lead: 'kalimba', leadChance: 0.28, leadOctave: 0,
  },
  // E minor, slow and wet: Em9 - Cmaj7 - Am9 - B7sus
  {
    title: 'Rain on the Glass', mood: 'Rainy-day lofi', style: 'lofi', bpm: 66, swing: 0.1,
    chords: [[55, 59, 62, 66], [52, 55, 59, 64], [55, 57, 60, 64], [54, 57, 59, 64]], bass: [40, 36, 33, 35], scale: [76, 79, 81, 83, 86],
    drums: 'soft', echoKeys: 0.35, lead: 'musicBox', leadChance: 0.14, leadOctave: 0,
  },
  // G major bossa: Gmaj7 - Em7 - Am7 - D9
  {
    title: 'Cocoa Bossa', mood: 'Lofi bossa', style: 'lofi', bpm: 84, swing: 0,
    chords: [[54, 59, 62, 66], [52, 55, 59, 62], [55, 60, 64, 67], [54, 57, 60, 64]], bass: [43, 40, 45, 38], scale: [67, 69, 71, 74, 76, 79],
    drums: 'bossa', chordVoice: 'pluck', chordRhythm: 'bossa', bassVoice: 'upright', bassRhythm: 'bossa', leadChance: 0.1,
  },
  // Db major, slow and warm: Dbmaj9 - Bbm9 - Gbmaj7 - Ab7sus
  {
    title: 'Lamp Light', mood: 'Warm & slow', style: 'lofi', bpm: 62, swing: 0.12, seconds: 200,
    chords: [[53, 56, 60, 63], [49, 53, 56, 60], [53, 58, 61, 65], [51, 54, 56, 61]], bass: [37, 34, 30, 32], scale: [73, 75, 77, 80, 82],
    drums: 'half', bassVoice: 'sub', bassRhythm: 'half', lead: 'musicBox', leadChance: 0.1, leadOctave: 0, padLayer: true,
  },
  // F major lullaby on a soft harp-like arpeggio: Fmaj9 - Em7 - Dm9 - Gsus
  {
    title: 'Cat Nap', mood: 'Sleepy lofi', style: 'lofi', bpm: 70, swing: 0.12,
    chords: [[57, 60, 64, 67], [55, 59, 62, 64], [53, 57, 60, 64], [55, 60, 62, 67]], bass: [41, 40, 38, 43], scale: [72, 74, 77, 79, 81],
    drums: 'soft', chordVoice: 'pluck', chordRhythm: 'arp', lead: 'musicBox', leadChance: 0.1, leadOctave: 0,
  },
  // C minor, neon and spacey: Cm9 - Abmaj7 - Ebmaj7 - Bb6
  {
    title: 'City Lights', mood: 'Neon lofi', style: 'lofi', bpm: 80, swing: 0.15,
    chords: [[51, 55, 58, 62], [51, 55, 56, 60], [51, 55, 58, 62], [50, 53, 55, 58]], bass: [36, 32, 39, 34], scale: [72, 75, 77, 79, 82],
    chordRhythm: 'push', bassVoice: 'sub', lead: null, echoKeys: 0.4, padLayer: true,
  },
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
  let leadIndex = 0

  // --- small building blocks ---

  function gain(value) {
    const g = ctx.createGain()
    g.gain.value = value
    return g
  }

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

  // Optionally send a voice into the tape echo as well as the mix.
  function toMix(node, echo = 0) {
    node.connect(songOut)
    if (echo > 0) node.connect(gain(echo)).connect(echoIn)
  }

  // --- instruments ---

  // Rhodes-ish electric piano: a sine carrier with a decaying FM bell, wobbling like old tape.
  function keys(t, midi, dur, vel) {
    const f = mtof(midi)
    const end = t + dur
    const amp = envGain(t, 0.07 * vel, 0.01, 1.4, 0.5, end)
    const carrier = voice('sine', f)
    const mod = voice('sine', f)
    const modGain = ctx.createGain()
    modGain.gain.setValueAtTime(f * 1.6 * vel, t)
    modGain.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9)
    mod.connect(modGain).connect(carrier.frequency)
    const { depth } = wobble
    depth.connect(carrier.detune)
    carrier.onended = () => depth.disconnect(carrier.detune)
    carrier.connect(amp)
    toMix(amp, song.echoKeys)
    for (const osc of [carrier, mod]) { osc.start(t); osc.stop(end + 0.6) }
  }

  // Soft nylon/harp pluck: a triangle with a quick decay, rounded off by a lowpass.
  function pluck(t, midi, level) {
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(level, t + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    const osc = voice('triangle', mtof(midi))
    const shimmer = voice('sine', mtof(midi) * 2)
    const shimmerGain = gain(0.25)
    osc.connect(amp)
    shimmer.connect(shimmerGain).connect(amp)
    const tone = lowpass(1500, 0.3)
    amp.connect(tone)
    toMix(tone, song.echoKeys)
    for (const o of [osc, shimmer]) { o.start(t); o.stop(t + 0.95) }
  }

  // Retro-game pulse wave, filtered warm and kept quiet: the "pleasant buzz" of a chip song.
  function pulse(t, midi, dur, level) {
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(level, t + 0.01)
    amp.gain.exponentialRampToValueAtTime(level * 0.4, t + dur * 0.8)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
    const osc = voice('square', mtof(midi))
    osc.connect(lowpass(1100, 0.2)).connect(amp)
    toMix(amp, song.echoKeys)
    osc.start(t); osc.stop(t + dur + 0.1)
  }

  // Chip lead: a soft square with delayed vibrato, like an old handheld humming a tune.
  function chipLead(t, midi, dur) {
    const osc = voice('square', mtof(midi))
    const vibrato = voice('sine', 5.5)
    const vibratoDepth = ctx.createGain()
    vibratoDepth.gain.setValueAtTime(0, t)
    vibratoDepth.gain.linearRampToValueAtTime(12, t + Math.min(0.25, dur * 0.5))
    vibrato.connect(vibratoDepth).connect(osc.detune)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(0.022, t + 0.02)
    amp.gain.setValueAtTime(0.022, t + dur * 0.7)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(lowpass(1400, 0.2)).connect(amp)
    toMix(amp, 0.35)
    for (const o of [osc, vibrato]) { o.start(t); o.stop(t + dur + 0.05) }
  }

  function roundBass(t, midi, dur) {
    const osc = voice('triangle', mtof(midi))
    const amp = envGain(t, 0.22, 0.015, 0.5, 0.2, t + dur)
    osc.connect(lowpass(420)).connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + dur + 0.3)
  }

  // Deep sub bass that holds the root.
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

  // The triangle bass of an old game console: clean, a little hollow.
  function chipBass(t, midi, dur) {
    const amp = envGain(t, 0.2, 0.01, 0.3, 0.08, t + dur)
    const osc = voice('triangle', mtof(midi))
    osc.connect(lowpass(900)).connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + dur + 0.1)
  }

  function kalimba(t, midi) {
    const f = mtof(midi)
    for (const [mult, level] of [[1, 0.06], [2.01, 0.018]]) {
      const osc = voice('sine', f * mult)
      const amp = ctx.createGain()
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(level, t + 0.005)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + (mult === 1 ? 1.1 : 0.4))
      osc.connect(amp).connect(songOut)
      osc.start(t); osc.stop(t + 1.2)
    }
  }

  // A music-box tine: pure tone with a glassy overtone, sent into the echo.
  function musicBox(t, midi, level) {
    const f = mtof(midi)
    for (const [mult, peak, decay] of [[1, level, 1.8], [3.01, level * 0.22, 0.35]]) {
      const osc = voice('sine', f * mult)
      const amp = ctx.createGain()
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(peak, t + 0.004)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      osc.connect(amp)
      toMix(amp, 1)
      osc.start(t); osc.stop(t + decay + 0.05)
    }
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

  function kick(t, level = 0.5) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.14)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(level, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    osc.connect(amp).connect(songOut)
    osc.start(t); osc.stop(t + 0.4)
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

  function rim(t, level, echoed = false) {
    const osc = voice('triangle', 1650)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(level, t)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    osc.connect(amp)
    toMix(amp, echoed ? 1 : 0)
    osc.start(t); osc.stop(t + 0.05)
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
      overtone.connect(gain(0.3)).connect(amp)
      osc.connect(amp)
      amp.connect(lowpass(1800)).connect(songOut)
      amp.connect(echoIn)
      for (const o of [osc, overtone]) { o.start(t); o.stop(t + 0.35) }
    }
  }

  // --- the configurable lofi band ---

  function playChord(t, notes, dur, vel) {
    switch (song.chordVoice) {
      case 'pluck': notes.forEach((m, i) => pluck(t + i * 0.02, m, 0.05 * vel)); break
      case 'pulse': notes.forEach((m) => pulse(t, m, dur, 0.012 * vel)); break
      default: notes.forEach((m, i) => keys(t + i * 0.014, m, dur, vel))
    }
  }

  function lofiChords(inBar, t, swung, chord, barStart) {
    switch (song.chordRhythm) {
      case 'push':
        if (inBar === 0) playChord(t, chord, stepDur * 6, 0.9)
        if (inBar === 6) playChord(swung, chord, stepDur * 4, 0.45)
        if (inBar === 11) playChord(t, chord, stepDur * 4, 0.55)
        break
      case 'bossa':
        if ([0, 3, 6, 10, 13].includes(inBar)) playChord(t, chord, stepDur * 2, inBar === 0 ? 1 : 0.7)
        break
      case 'arp': {
        // Up and back down the chord, one note every eighth.
        if (inBar % 2 !== 0) break
        const order = [0, 1, 2, 3, 2, 1, 2, 3]
        const midi = chord[order[(inBar / 2) % order.length] % chord.length] + (song.chordVoice === 'pulse' ? 0 : 12)
        if (song.chordVoice === 'pulse') pulse(swung, midi, stepDur * 1.8, 0.016)
        else pluck(swung, midi, 0.05)
        if (inBar === 0 && song.chordVoice !== 'pulse') playChord(t, chord, stepDur * 8, 0.5)
        break
      }
      default:
        if (inBar === 0 && barStart) playChord(t, chord, stepDur * 15, 0.9)
        if (inBar === 10 && song.chordVoice === 'keys' && rng.chance(0.6)) chord.slice(1).forEach((m, i) => keys(swung + i * 0.012, m + 12, stepDur * 5, 0.45))
    }
    if (song.padLayer && inBar === 0) chord.forEach((m, i) => pad(t + i * 0.06, m, stepDur * 15, 0.012))
  }

  function lofiBass(inBar, t, swung, root) {
    const play = { round: roundBass, sub, upright, chip: chipBass }[song.bassVoice]
    switch (song.bassRhythm) {
      case 'bossa':
        if (inBar === 0) play(t, root, stepDur * 3)
        if (inBar === 6) play(t, root + 7, stepDur * 2)
        if (inBar === 8) play(t, root + 7, stepDur * 3)
        if (inBar === 14) play(t, root + 12, stepDur * 2)
        break
      case 'half':
        if (inBar === 0) play(t, root, stepDur * 10)
        if (inBar === 12 && rng.chance(0.6)) play(t, root + 7, stepDur * 3)
        break
      default:
        if (inBar === 0) play(t, root, stepDur * 6)
        if (inBar === 10) play(swung, root + (rng.chance(0.5) ? 7 : 12), stepDur * 3)
    }
  }

  function lofiDrums(inBar, t, swung, breakdown) {
    if (breakdown && inBar >= 4) return
    switch (song.drums) {
      case 'soft':
        if (inBar === 0 || inBar === 9) kick(t, 0.32)
        if (inBar === 4 || inBar === 12) rim(t, 0.05)
        if (inBar % 4 === 2) noiseHit(swung, 'highpass', 7600, 0.7, 0.022, 0.04)
        break
      case 'half':
        if (inBar === 0 || (inBar === 11 && rng.chance(0.4))) kick(t, 0.38)
        if (inBar === 8) noiseHit(t, 'bandpass', 1500, 0.8, 0.12, 0.25)
        if (inBar % 2 === 0) noiseHit(swung, 'highpass', 7600, 0.7, inBar % 4 === 0 ? 0.03 : 0.018, 0.04)
        break
      case 'bossa':
        if (inBar === 0 || inBar === 8) kick(t, 0.3)
        if ([3, 6, 10, 12].includes(inBar)) rim(t, 0.045)
        noiseHit(t, 'highpass', 6800, 0.6, inBar % 4 === 0 ? 0.02 : 0.011, 0.05)
        break
      default:
        if (inBar === 0 || inBar === 10 || (inBar === 7 && rng.chance(0.3))) kick(swung)
        if (inBar === 4 || inBar === 12) noiseHit(t, 'bandpass', 1700, 0.8, 0.16, 0.2)
        if (inBar % 2 === 0 && rng.chance(0.9)) noiseHit(swung, 'highpass', 7200, 0.7, inBar % 4 === 0 ? 0.05 : 0.03, 0.05)
    }
  }

  function lofiLead(inBar, swung, breakdown) {
    if (!song.lead || inBar % 2 !== 0) return
    if (!rng.chance(song.leadChance * (breakdown ? 1.8 : 1))) return
    // The lead wanders stepwise through the scale, so phrases sound like little tunes.
    leadIndex = Math.max(0, Math.min(song.scale.length - 1, leadIndex + rng.pick([-2, -1, -1, 1, 1, 2])))
    const midi = song.scale[leadIndex] + song.leadOctave
    if (song.lead === 'chip') chipLead(swung, midi, stepDur * rng.pick([2, 2, 3, 4]))
    else if (song.lead === 'musicBox') musicBox(swung, midi, 0.045)
    else kalimba(swung, midi)
  }

  function scheduleLofi(s, t) {
    const inBar = s % 16
    const bar = Math.floor(s / 16)
    const barsPerChord = song.barsPerChord ?? 1
    const chordIndex = Math.floor(bar / barsPerChord) % song.chords.length
    const chord = song.chords[chordIndex]
    const breakdown = bar % 8 === 7
    const swung = inBar % 4 === 2 ? t + song.swing * stepDur * 2 : t
    lofiChords(inBar, t, swung, chord, bar % barsPerChord === 0)
    lofiBass(inBar, t, swung, song.bass[chordIndex])
    lofiDrums(inBar, t, swung, breakdown)
    lofiLead(inBar, swung, breakdown)
  }

  // --- the two songs with styles of their own ---

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

  function scheduleStep(s, t) {
    if (song.style === 'ambient') scheduleAmbient(s, t)
    else if (song.style === 'dub') scheduleDub(s, t)
    else scheduleLofi(s, t)
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
    const base = SYNTH_SONGS[index % SYNTH_SONGS.length]
    song = base.style === 'lofi' ? { ...LOFI_DEFAULTS, ...base } : base
    rng = createRng(index * 97 + 3)
    leadIndex = Math.floor(song.scale.length / 2)
    stepDur = 60 / song.bpm / 4
    songOut = ctx.createGain()
    const tape = lowpass(3600, 0.4)
    songOut.connect(tape).connect(output)
    // Tape echo on a dotted eighth: each repeat a little darker than the last.
    echoIn = gain(0.55)
    const delay = ctx.createDelay(2)
    delay.delayTime.value = stepDur * 3
    const feedback = gain(0.48)
    const tone = lowpass(1600)
    echoIn.connect(delay)
    delay.connect(tone)
    tone.connect(feedback).connect(delay)
    tone.connect(songOut)
    echoLoop = { delay, feedback }
    songOut.gain.setValueAtTime(0.0001, ctx.currentTime)
    songOut.gain.exponentialRampToValueAtTime(SONG_LEVEL, ctx.currentTime + 0.8)
    const lfo = voice('sine', 0.35)
    const depth = gain(7)
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
