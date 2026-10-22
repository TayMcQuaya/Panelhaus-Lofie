// Viewer preferences in localStorage. Anything stored is checked against allowed values;
// if storage is blocked (private mode), the scene simply runs on defaults.
import { AMBIENCE_LAYERS } from '../audio/ambience.js'

// v3: ambience was rebalanced and the crackle layer removed, so older saved sliders no longer apply.
const KEY = 'smudge-workshop-settings-v3'
export const WEATHERS = ['clear', 'rain', 'storm', 'snow']
export const TIME_MODES = ['auto', 'cycle', 'manual']
// 'auto': the weather changes on its own now and then. 'fixed': it stays on the one you picked.
export const WEATHER_MODES = ['auto', 'fixed']

export const DEFAULTS = {
  musicVolume: 0.7,
  ambience: { rain: 0, thunder: 0, city: 0.25, clock: 0, purr: 0 },
  ambienceMuted: false,
  timeMode: 'auto',
  manualHour: 21,
  weather: 'clear',
  weatherMode: 'auto',
  trackIndex: 0,
}

const unit = (v, fallback) => (Number.isFinite(v) && v >= 0 && v <= 1 ? v : fallback)

export function sanitize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const ambience = Object.fromEntries(AMBIENCE_LAYERS.map(({ id }) => [id, unit(source.ambience?.[id], DEFAULTS.ambience[id])]))
  return {
    musicVolume: unit(source.musicVolume, DEFAULTS.musicVolume),
    ambience,
    ambienceMuted: source.ambienceMuted === true,
    timeMode: TIME_MODES.includes(source.timeMode) ? source.timeMode : DEFAULTS.timeMode,
    manualHour: Number.isFinite(source.manualHour) && source.manualHour >= 0 && source.manualHour < 24 ? source.manualHour : DEFAULTS.manualHour,
    weather: WEATHERS.includes(source.weather) ? source.weather : DEFAULTS.weather,
    weatherMode: WEATHER_MODES.includes(source.weatherMode) ? source.weatherMode : DEFAULTS.weatherMode,
    trackIndex: Number.isInteger(source.trackIndex) && source.trackIndex >= 0 && source.trackIndex < 200 ? source.trackIndex : 0,
  }
}

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSettings() {
  const store = storage()
  if (!store) return sanitize(null)
  try {
    return sanitize(JSON.parse(store.getItem(KEY) ?? 'null'))
  } catch {
    return sanitize(null)
  }
}

export function saveSettings(settings) {
  try {
    storage()?.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage full or blocked: preferences just won't persist this session.
  }
}
