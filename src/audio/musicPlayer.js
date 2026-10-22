// The music library from public/music/tracks.json, grouped into stations (Smudge FM, Panel Haus
// Radio, ...). A track with a `src` streams that audio file; a track without one is a Smudge FM
// song generated live (and a file that fails to load falls back to one, so music never stops).
//
// Files are never downloaded up front. A song streams when it plays, and the next one starts
// buffering shortly before the current one ends, so songs follow each other without a gap.
import { SYNTH_SONGS, createSynthPlayer, songSeconds } from './synthTracks.js'

const BASE = import.meta.env.BASE_URL
const AUDIO_FILE = /^(https:\/\/[^\s"'<>]+|[\w\-./ ]+)\.(mp3|ogg|m4a|wav|aac|flac)$/i
const STATION_ID = /^[a-z0-9-]{1,40}$/
const PREFETCH_SECONDS = 20
// Song files are normalised to -18 LUFS, which already sits level with the generated songs
// (measured in the player: both land around -24 to -27 dB on the music bus).
const FILE_TRIM = 1

export const HOUSE_ARTIST = 'Smudge FM'
const HOUSE_STATION = { id: 'smudge-fm', name: 'Smudge FM', about: 'Chill lofi, made live' }

const defaultLibrary = () => ({
  stations: [HOUSE_STATION],
  tracks: SYNTH_SONGS.map((s, i) => ({ title: s.title, artist: HOUSE_ARTIST, mood: s.mood, bpm: s.bpm, src: null, synth: i, seconds: null, station: HOUSE_STATION.id })),
})

const cleanText = (value, max) => (typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null)
const inRange = (value, lo, hi) => (Number.isFinite(value) && value >= lo && value <= hi ? value : null)

function validateTrack(item, i, stationIds) {
  if (!item || typeof item !== 'object') return null
  const title = cleanText(item.title, 120)
  if (!title) return null
  const src = cleanText(item.src, 500)
  const validSrc = src && AUDIO_FILE.test(src) && !src.includes('..') ? src : null
  if (src && !validSrc) console.warn(`[music] ignoring src for "${title}": not an audio file path`)
  const synth = Number.isInteger(item.synth) && item.synth >= 0 && item.synth < SYNTH_SONGS.length ? item.synth : i % SYNTH_SONGS.length
  const station = stationIds.includes(item.station) ? item.station : stationIds[0]
  return {
    title,
    artist: cleanText(item.artist, 120) ?? '',
    mood: cleanText(item.mood, 40) ?? (validSrc ? '' : SYNTH_SONGS[synth].mood),
    // Smudge bobs his head to the beat only when the tempo is known.
    bpm: validSrc ? inRange(item.bpm, 40, 220) : SYNTH_SONGS[synth].bpm,
    src: validSrc,
    synth,
    seconds: validSrc ? inRange(item.seconds, 1, 3600) : null,
    station,
  }
}

// Accepts { stations, tracks } or, for older lists, a plain array of tracks.
export function validateLibrary(raw) {
  const list = Array.isArray(raw) ? raw : raw?.tracks
  if (!Array.isArray(list)) return null
  const stations = (Array.isArray(raw?.stations) ? raw.stations : [HOUSE_STATION]).slice(0, 12).flatMap((s) => {
    const id = typeof s?.id === 'string' && STATION_ID.test(s.id) ? s.id : null
    const name = cleanText(s?.name, 40)
    return id && name ? [{ id, name, about: cleanText(s.about, 80) ?? '' }] : []
  })
  if (!stations.length) return null
  const ids = stations.map((s) => s.id)
  const tracks = list.slice(0, 500).map((item, i) => validateTrack(item, i, ids)).filter(Boolean)
  const used = stations.filter((s) => tracks.some((t) => t.station === s.id))
  return tracks.length ? { stations: used, tracks } : null
}

async function loadLibrary() {
  const response = await fetch(`${BASE}music/tracks.json`, { cache: 'no-cache' })
  if (!response.ok) {
    console.warn(`[music] tracks.json not found (${response.status}); using the built-in songs`)
    return defaultLibrary()
  }
  const parsed = await response.json().catch((err) => {
    console.warn('[music] tracks.json is not valid JSON; using the built-in songs', err)
    return null
  })
  return validateLibrary(parsed) ?? defaultLibrary()
}

const resolveSrc = (src) => (src.startsWith('https://') ? src : `${BASE}music/${src.replace(/^\/+/, '')}`)

export function createMusicPlayer(engine) {
  let library = defaultLibrary()
  let index = 0
  let playing = false
  let synth = null
  let synthOn = false
  let element = null
  let elementChain = null
  let volume = 0.7
  let muted = false
  let shuffle = false
  let buffering = false
  let pendingOffset = 0
  let upcoming = null
  let prefetched = null
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn())
  const tracks = () => library.tracks
  const synthLength = () => songSeconds(tracks()[index].synth)
  const stationOf = (i) => tracks()[i].station
  const stationIndices = (id) => tracks().flatMap((t, i) => (t.station === id ? [i] : []))

  async function init(startIndex = 0) {
    library = await loadLibrary()
    index = Math.min(Math.max(0, startIndex), tracks().length - 1)
    // If playback started before the list arrived, switch to the song that should be playing.
    if (playing) startCurrent()
    emit()
  }

  function stopCurrent() {
    if (element) {
      element.pause()
      element.removeAttribute('src')
      element.load()
      elementChain.forEach((node) => node.disconnect())
      element = null
      elementChain = null
    }
    if (synthOn) { synth.stop(); synthOn = false }
    buffering = false
  }

  function playSynth(songIndex, offset = 0) {
    synth ??= createSynthPlayer(engine.ctx, engine.music)
    synth.play(songIndex, offset)
    synthOn = true
  }

  function playFile(track) {
    const audio = new Audio()
    audio.preload = 'auto'
    if (track.src.startsWith('https://')) audio.crossOrigin = 'anonymous'
    audio.src = resolveSrc(track.src)
    element = audio
    const source = engine.ctx.createMediaElementSource(audio)
    const trim = engine.ctx.createGain()
    trim.gain.value = FILE_TRIM
    source.connect(trim).connect(engine.music)
    elementChain = [source, trim]
    const mine = () => element === audio
    const fallBack = (reason) => {
      if (!mine()) return
      console.warn(`[music] "${track.title}" could not play (${reason}); playing a Smudge FM song instead`)
      stopCurrent()
      playSynth(track.synth)
      emit()
    }
    const setBuffering = (value) => {
      if (!mine() || buffering === value) return
      buffering = value
      emit()
    }
    audio.addEventListener('waiting', () => setBuffering(true))
    audio.addEventListener('playing', () => setBuffering(false))
    audio.addEventListener('ended', () => mine() && next())
    audio.addEventListener('error', () => fallBack(audio.error?.message || 'load error'))
    buffering = true
    audio.play().catch((err) => fallBack(err.message))
  }

  function startCurrent() {
    stopCurrent()
    upcoming = null
    const track = tracks()[index]
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
    index = ((i % tracks().length) + tracks().length) % tracks().length
    pendingOffset = 0
    stopCurrent()
    if (playing) startCurrent()
    emit()
  }

  // The song after this one, always within the current station; random (but decided once, so the
  // prefetched file is the one that plays) when shuffle is on.
  function chooseNext() {
    const list = stationIndices(stationOf(index))
    if (list.length < 2) return index
    if (shuffle) {
      const others = list.filter((i) => i !== index)
      return others[Math.floor(Math.random() * others.length)]
    }
    return list[(list.indexOf(index) + 1) % list.length]
  }

  const next = () => select(upcoming ?? chooseNext())

  function prev() {
    if (elapsed() > 4) { select(index); return }
    const list = stationIndices(stationOf(index))
    select(list[(list.indexOf(index) - 1 + list.length) % list.length])
  }

  function toggleShuffle() {
    shuffle = !shuffle
    upcoming = null
    if (shuffle && stationIndices(stationOf(index)).length > 1) {
      select(chooseNext())
      play()
    }
    emit()
  }

  // Start a station: its first song, or a random one with shuffle on.
  function playStation(id) {
    const list = stationIndices(id)
    if (!list.length) return
    select(shuffle ? list[Math.floor(Math.random() * list.length)] : list[0])
    play()
  }

  function elapsed() {
    if (element) return element.currentTime || 0
    return synthOn ? synth.elapsed() : pendingOffset
  }

  function duration() {
    const track = tracks()[index]
    if (element) return Number.isFinite(element.duration) ? element.duration : track.seconds ?? 0
    if (track.src) return track.seconds ?? 0
    return synthLength()
  }

  function progress() {
    const total = duration()
    return total ? Math.min(1, elapsed() / total) : 0
  }

  // Jump to a point in the current song (0-1). A file seeks directly; a generated song restarts
  // from that bar. While paused, the position is kept for when playback resumes.
  function seek(fraction) {
    const f = Math.min(0.995, Math.max(0, fraction))
    if (element) {
      if (element.duration) element.currentTime = f * element.duration
    } else if (playing && synthOn) {
      playSynth(tracks()[index].synth, f * synthLength())
    } else if (!tracks()[index].src) {
      pendingOffset = f * synthLength()
    }
    emit()
  }

  function beatPhase() {
    const { bpm } = tracks()[index]
    if (element) return bpm ? ((element.currentTime * bpm) / 60) % 1 : 0.99
    return synthOn ? synth.beatPhase() : 0
  }

  // Warm the browser's cache with the next song's file shortly before this one ends.
  function prefetchNext() {
    if (upcoming === null) upcoming = chooseNext()
    const track = tracks()[upcoming]
    if (!track.src || prefetched === track.src) return
    prefetched = track.src
    const warm = new Audio()
    warm.preload = 'auto'
    if (track.src.startsWith('https://')) warm.crossOrigin = 'anonymous'
    warm.src = resolveSrc(track.src)
  }

  // Called every frame.
  function update() {
    if (!playing) return
    // Generated songs have no natural end, so move on after their set length.
    if (synthOn && !element && synth.elapsed() > synthLength()) next()
    const left = duration() - elapsed()
    if (left > 0 && left < PREFETCH_SECONDS) prefetchNext()
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
    playStation,
    update,
    setVolume,
    toggleMute,
    toggleShuffle,
    // Length of track i in seconds when known before it plays.
    trackLength: (i) => (tracks()[i].src ? tracks()[i].seconds : songSeconds(tracks()[i].synth)),
    seek,
    progress,
    elapsed,
    duration,
    beatPhase,
    stationIndices,
    onChange: (fn) => listeners.add(fn),
    get tracks() { return tracks() },
    get stations() { return library.stations },
    get station() { return stationOf(index) },
    get index() { return index },
    get playing() { return playing },
    get current() { return tracks()[index] },
    get volume() { return volume },
    get muted() { return muted },
    get shuffle() { return shuffle },
    get buffering() { return buffering },
  }
}
