// Track list from public/music/tracks.json. Tracks with a `src` play that file; tracks without one,
// or whose file fails, play a synthesised placeholder so the player always works.
import { SYNTH_SONGS, createSynthPlayer, songSeconds } from './synthTracks.js'

const BASE = import.meta.env.BASE_URL
const AUDIO_FILE = /^(https:\/\/[^\s"'<>]+|[\w\-./ ]+)\.(mp3|ogg|m4a|wav|aac|flac)$/i

export const HOUSE_ARTIST = 'Smudge FM'
const defaultTracks = () => SYNTH_SONGS.map((s, i) => ({ title: s.title, artist: HOUSE_ARTIST, mood: s.mood, bpm: s.bpm, src: null, synth: i }))

const cleanText = (value, max) => (typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null)

export function validateTracks(raw) {
  if (!Array.isArray(raw)) return null
  const tracks = raw.slice(0, 200).flatMap((item, i) => {
    if (!item || typeof item !== 'object') return []
    const title = cleanText(item.title, 120)
    if (!title) return []
    const src = cleanText(item.src, 500)
    const validSrc = src && AUDIO_FILE.test(src) && !src.includes('..') ? src : null
    if (src && !validSrc) console.warn(`[music] ignoring src for "${title}": not an audio file path`)
    const bpm = Number.isFinite(item.bpm) && item.bpm >= 40 && item.bpm <= 220 ? item.bpm : 80
    const synth = Number.isInteger(item.synth) && item.synth >= 0 && item.synth < SYNTH_SONGS.length ? item.synth : i % SYNTH_SONGS.length
    const mood = cleanText(item.mood, 40) ?? (validSrc ? '' : SYNTH_SONGS[synth].mood)
    return [{ title, artist: cleanText(item.artist, 120) ?? '', mood, bpm: validSrc ? bpm : SYNTH_SONGS[synth].bpm, src: validSrc, synth }]
  })
  return tracks.length ? tracks : null
}

async function loadTrackList() {
  const response = await fetch(`${BASE}music/tracks.json`, { cache: 'no-cache' })
  if (!response.ok) {
    console.warn(`[music] tracks.json not found (${response.status}); using placeholder tracks`)
    return defaultTracks()
  }
  const parsed = await response.json().catch((err) => {
    console.warn('[music] tracks.json is not valid JSON; using placeholder tracks', err)
    return null
  })
  return validateTracks(parsed) ?? defaultTracks()
}

const resolveSrc = (src) => (src.startsWith('https://') ? src : `${BASE}music/${src.replace(/^\/+/, '')}`)

export function createMusicPlayer(engine) {
  let tracks = defaultTracks()
  let index = 0
  let playing = false
  let synth = null
  let synthOn = false
  let element = null
  let elementSource = null
  let volume = 0.7
  let muted = false
  let shuffle = false
  let pendingOffset = 0
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn())
  const synthLength = () => songSeconds(tracks[index].synth)

  async function init(startIndex = 0) {
    tracks = await loadTrackList()
    index = Math.min(Math.max(0, startIndex), tracks.length - 1)
    emit()
  }

  function stopCurrent() {
    if (element) {
      element.pause()
      element.removeAttribute('src')
      elementSource.disconnect()
      element = null
      elementSource = null
    }
    if (synthOn) { synth.stop(); synthOn = false }
  }

  function playSynth(songIndex, offset = 0) {
    synth ??= createSynthPlayer(engine.ctx, engine.music)
    synth.play(songIndex, offset)
    synthOn = true
  }

  function playFile(track) {
    const audio = new Audio()
    if (track.src.startsWith('https://')) audio.crossOrigin = 'anonymous'
    audio.src = resolveSrc(track.src)
    element = audio
    elementSource = engine.ctx.createMediaElementSource(audio)
    elementSource.connect(engine.music)
    const fallBack = (reason) => {
      if (element !== audio) return
      console.warn(`[music] "${track.title}" could not play (${reason}); playing the built-in song instead`)
      stopCurrent()
      playSynth(track.synth)
      emit()
    }
    audio.addEventListener('ended', () => element === audio && next())
    audio.addEventListener('error', () => fallBack(audio.error?.message || 'load error'))
    audio.play().catch((err) => fallBack(err.message))
  }

  function startCurrent() {
    stopCurrent()
    const track = tracks[index]
    if (track.src) playFile(track)
    else playSynth(track.synth, pendingOffset)
    pendingOffset = 0
  }

  function play() {
    if (playing) return
    playing = true
    if (element) element.play()
    else startCurrent()
    emit()
  }

  function pause() {
    if (!playing) return
    playing = false
    if (element) {
      element.pause()
    } else {
      // A generated song can't be paused, so remember where it was and resume from there.
      if (synthOn) pendingOffset = synth.elapsed() % synthLength()
      stopCurrent()
    }
    emit()
  }

  const toggle = () => (playing ? pause() : play())

  function select(i) {
    index = ((i % tracks.length) + tracks.length) % tracks.length
    pendingOffset = 0
    stopCurrent()
    if (playing) startCurrent()
    emit()
  }

  // With shuffle on, "next" (and the end of a song) picks any other track at random.
  const randomOther = () => (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length
  const next = () => select(shuffle && tracks.length > 1 ? randomOther() : index + 1)

  function toggleShuffle() {
    shuffle = !shuffle
    if (shuffle && tracks.length > 1) {
      select(randomOther())
      play()
    }
    emit()
  }
  const prev = () => (elapsed() > 4 ? select(index) : select(index - 1))

  function elapsed() {
    if (element) return element.currentTime || 0
    return synthOn ? synth.elapsed() : 0
  }

  function duration() {
    if (element) return Number.isFinite(element.duration) ? element.duration : 0
    return synthLength()
  }

  function progress() {
    if (element) return element.duration ? element.currentTime / element.duration : 0
    if (!synthOn) return pendingOffset / synthLength()
    return Math.min(1, synth.elapsed() / synthLength())
  }

  // Jump to a point in the current song (0-1). A file seeks directly; a generated song restarts
  // from that bar. While paused, the position is kept for when playback resumes.
  function seek(fraction) {
    const f = Math.min(0.995, Math.max(0, fraction))
    if (element) {
      if (element.duration) element.currentTime = f * element.duration
    } else if (playing && synthOn) {
      playSynth(tracks[index].synth, f * synthLength())
    } else {
      pendingOffset = f * synthLength()
    }
    emit()
  }

  function beatPhase() {
    if (element) return ((element.currentTime * tracks[index].bpm) / 60) % 1
    return synthOn ? synth.beatPhase() : 0
  }

  // Called every frame: placeholder songs have no natural end, so move on after a set length.
  function update() {
    if (playing && synthOn && !element && synth.elapsed() > synthLength()) next()
  }

  function applyGain() {
    if (engine.music) engine.music.gain.setTargetAtTime(muted ? 0 : volume, engine.ctx.currentTime, 0.05)
  }

  function setVolume(v) {
    volume = v
    applyGain()
  }

  function toggleMute() {
    muted = !muted
    applyGain()
    emit()
  }

  return {
    init,
    play,
    pause,
    toggle,
    next,
    prev,
    select,
    update,
    setVolume,
    toggleMute,
    toggleShuffle,
    // Length of track i in seconds, when known before it plays (generated songs).
    trackLength: (i) => (tracks[i].src ? null : songSeconds(tracks[i].synth)),
    seek,
    progress,
    elapsed,
    duration,
    beatPhase,
    onChange: (fn) => listeners.add(fn),
    get tracks() { return tracks },
    get index() { return index },
    get playing() { return playing },
    get current() { return tracks[index] },
    get volume() { return volume },
    get muted() { return muted },
    get shuffle() { return shuffle },
  }
}
