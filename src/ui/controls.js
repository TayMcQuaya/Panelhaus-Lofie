// The overlay: player bar, panels, keyboard shortcuts and fade-on-idle.
// All text from tracks.json is set with textContent, never as markup.
import { AMBIENCE_LAYERS } from '../audio/ambience.js'

const IDLE_MS = 3000
const $ = (id) => document.getElementById(id)

export function formatHour(hour) {
  const h = Math.floor(hour) % 24
  const m = Math.floor((hour % 1) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function createControls({ player, app }) {
  const panels = { music: $('panel-music'), ambience: $('panel-ambience'), time: $('panel-time'), weather: $('panel-weather') }
  const toggles = [...document.querySelectorAll('[data-panel]')]
  let openPanel = null
  let idleTimer = null

  function showPanel(name) {
    openPanel = openPanel === name ? null : name
    for (const [key, el] of Object.entries(panels)) el.hidden = key !== openPanel
    for (const button of toggles) button.setAttribute('aria-pressed', String(button.dataset.panel === openPanel))
    $('np-open').setAttribute('aria-expanded', String(openPanel === 'music'))
    // Opening the song list lands on the song that is playing.
    if (openPanel === 'music') {
      const current = $('track-list').querySelector('[aria-current="true"]')
      current?.scrollIntoView({ block: 'nearest' })
      current?.focus({ preventScroll: true })
    }
    wake()
  }

  // A click anywhere outside the open panel (and outside the buttons that open panels) closes it.
  document.addEventListener('pointerdown', (event) => {
    if (!openPanel) return
    const inside = panels[openPanel].contains(event.target) || event.target.closest('[data-panel], #np-open')
    if (!inside) showPanel(openPanel)
  })

  // Player
  $('play').addEventListener('click', () => player.toggle())
  $('prev').addEventListener('click', () => player.prev())
  $('next').addEventListener('click', () => player.next())
  const volume = $('volume')
  volume.value = String(app.settings.musicVolume)
  volume.addEventListener('input', () => app.setMusicVolume(Number(volume.value)))
  $('mute').addEventListener('click', () => player.toggleMute())
  $('shuffle').addEventListener('click', () => player.toggleShuffle())
  $('np-open').addEventListener('click', () => showPanel('music'))

  // Click (or drag) anywhere on the progress bar to jump to that point; arrow keys nudge 5%.
  const seekBar = $('seek')
  const seekTo = (event) => {
    const box = seekBar.getBoundingClientRect()
    player.seek((event.clientX - box.left) / box.width)
  }
  seekBar.addEventListener('pointerdown', (event) => {
    seekTo(event)
    seekBar.setPointerCapture(event.pointerId)
  })
  seekBar.addEventListener('pointerup', (event) => {
    if (seekBar.hasPointerCapture(event.pointerId)) seekTo(event)
  })
  seekBar.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 0.05, ArrowLeft: -0.05 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    event.stopPropagation()
    player.seek(player.progress() + step)
  })

  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const span = (className, text) => Object.assign(document.createElement('span'), { className, textContent: text })

  // One row per song: number (or a little equaliser on the one playing), title over its style,
  // and its length. Clicking a row plays it.
  function renderTracks() {
    const list = $('track-list')
    $('track-count').textContent = `${player.tracks.length} songs${player.shuffle ? ' · shuffle on' : ''}`
    list.replaceChildren(...player.tracks.map((track, i) => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'track-row'
      const current = i === player.index
      button.setAttribute('aria-current', String(current))
      const lead = current ? span('eq', '') : span('number', String(i + 1).padStart(2, '0'))
      if (current) lead.append(...[0, 1, 2].map(() => document.createElement('i')))
      const text = document.createElement('span')
      text.className = 'track-text'
      text.append(span('track-title', track.title), span('track-mood', [track.mood, track.artist].filter(Boolean).join(' · ')))
      const length = player.trackLength(i)
      button.append(lead, text, span('track-length', length ? clock(length) : ''))
      button.addEventListener('click', () => {
        player.select(i)
        player.play()
      })
      item.append(button)
      return item
    }))
  }

  // Arrow keys move between songs inside the open list.
  $('track-list').addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    event.stopPropagation()
    const rows = [...$('track-list').querySelectorAll('.track-row')]
    const at = rows.indexOf(document.activeElement)
    rows[Math.max(0, Math.min(rows.length - 1, at + step))]?.focus()
  })

  function renderPlayer() {
    const track = player.current
    $('np-title').textContent = track?.title ?? '—'
    $('np-artist').textContent = track?.artist ?? ''
    const mute = $('mute')
    mute.dataset.muted = String(player.muted)
    mute.setAttribute('aria-pressed', String(player.muted))
    mute.setAttribute('aria-label', player.muted ? 'Unmute music' : 'Mute music')
    $('shuffle').setAttribute('aria-pressed', String(player.shuffle))
    const play = $('play')
    play.dataset.playing = String(player.playing)
    document.body.dataset.playing = String(player.playing)
    play.setAttribute('aria-label', player.playing ? 'Pause' : 'Play')
    renderTracks()
    renderProgress()
  }
  player.onChange(renderPlayer)

  // Ambience sliders
  const sliders = {}
  $('ambience-sliders').replaceChildren(...AMBIENCE_LAYERS.map(({ id, label }) => {
    const row = document.createElement('label')
    row.className = 'slider-row'
    const name = document.createElement('span')
    name.className = 'slider-label'
    name.textContent = label
    const input = document.createElement('input')
    Object.assign(input, { type: 'range', min: '0', max: '1', step: '0.01', value: String(app.settings.ambience[id]) })
    input.setAttribute('aria-label', `${label} volume`)
    const value = document.createElement('span')
    value.className = 'slider-value'
    const showValue = () => { value.textContent = String(Math.round(Number(input.value) * 100)) }
    input.addEventListener('input', () => { app.setAmbience(id, Number(input.value)); showValue() })
    sliders[id] = { input, showValue, row }
    showValue()
    row.append(name, input, value)
    return row
  }))

  // Time
  const hourSlider = $('hour-slider')
  hourSlider.addEventListener('input', () => app.setManualHour(Number(hourSlider.value)))
  for (const button of document.querySelectorAll('#time-modes button')) {
    button.addEventListener('click', () => app.setTimeMode(button.dataset.mode))
  }
  for (const button of document.querySelectorAll('#time-presets button')) {
    button.addEventListener('click', () => app.setManualHour(Number(button.dataset.hour)))
  }

  // Weather
  for (const button of document.querySelectorAll('#weather-buttons button')) {
    button.addEventListener('click', () => app.setWeather(button.dataset.weather))
  }

  function renderSettings() {
    const s = app.settings
    for (const button of document.querySelectorAll('#time-modes button')) button.setAttribute('aria-pressed', String(button.dataset.mode === s.timeMode))
    for (const button of document.querySelectorAll('#weather-buttons button')) button.setAttribute('aria-pressed', String(button.dataset.weather === s.weather))
    for (const { id, weathers } of AMBIENCE_LAYERS) {
      sliders[id].row.hidden = Boolean(weathers) && !weathers.includes(s.weather)
      if (document.activeElement === sliders[id].input) continue
      sliders[id].input.value = String(s.ambience[id])
      sliders[id].showValue()
    }
    const notes = { auto: 'Follows your clock.', cycle: 'A full day passes every 24 minutes.', manual: 'Held at the hour you pick.' }
    $('time-note').textContent = notes[s.timeMode]
  }

  // Panels, shortcuts, fullscreen, hide
  for (const button of toggles) button.addEventListener('click', () => showPanel(button.dataset.panel))

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }
  $('fullscreen').addEventListener('click', toggleFullscreen)

  const hint = $('hint')
  function toggleHidden() {
    const hidden = document.body.classList.toggle('ui-hidden')
    hint.hidden = !hidden
    if (hidden) setTimeout(() => { hint.hidden = true }, 2500)
  }
  $('hide-ui').addEventListener('click', toggleHidden)
  $('show-ui').addEventListener('click', toggleHidden)

  const KEYS = {
    ' ': () => player.toggle(),
    ArrowRight: () => player.next(),
    ArrowLeft: () => player.prev(),
    m: () => showPanel('music'),
    s: () => player.toggleShuffle(),
    a: () => showPanel('ambience'),
    t: () => showPanel('time'),
    w: () => showPanel('weather'),
    h: toggleHidden,
    f: toggleFullscreen,
    Escape: () => openPanel && showPanel(openPanel),
  }
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement && event.key !== 'Escape') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const action = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
    wake()
  })

  function wake() {
    document.body.classList.remove('idle')
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      const hoveringUi = document.querySelector('#ui :hover')
      if (openPanel || hoveringUi) { wake(); return }
      document.body.classList.add('idle')
    }, IDLE_MS)
  }
  for (const type of ['pointermove', 'pointerdown', 'touchstart']) window.addEventListener(type, wake, { passive: true })

  // Called a few times a second with live scene info.
  function refresh({ status, hour, label, weather }) {
    $('status').textContent = `Smudge is ${status}`
    const weatherWord = weather === 'clear' ? '' : ` · ${weather[0].toUpperCase()}${weather.slice(1)}`
    $('time-label').textContent = `${label} · ${formatHour(hour)}${weatherWord}`
    $('hour-readout').textContent = formatHour(hour)
    if (document.activeElement !== hourSlider) hourSlider.value = String(hour)
    renderProgress()
  }

  function renderProgress() {
    const fraction = player.progress()
    $('np-progress').style.width = `${(fraction * 100).toFixed(1)}%`
    seekBar.setAttribute('aria-valuenow', String(Math.round(fraction * 100)))
    $('np-time').textContent = `${clock(fraction * player.duration())} / ${clock(player.duration())}`
  }

  renderPlayer()
  renderSettings()
  wake()
  return { refresh, renderSettings }
}
