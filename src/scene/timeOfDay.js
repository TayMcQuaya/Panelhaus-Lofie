// Hour of day (0-24) + weather → every colour and light strength the scene needs.
import { clamp, lerp, mixRgb, smoothstep } from '../engine/ease.js'

const KEYS = [
  { h: 0, top: [11, 10, 31], bottom: [42, 30, 82], ambient: [0.3, 0.3, 0.48], day: 0, cloud: [44, 40, 78] },
  { h: 5, top: [11, 10, 31], bottom: [42, 30, 82], ambient: [0.3, 0.3, 0.48], day: 0, cloud: [44, 40, 78] },
  { h: 6.25, top: [60, 58, 122], bottom: [242, 160, 123], ambient: [0.7, 0.62, 0.74], day: 0.4, cloud: [242, 170, 160] },
  { h: 8, top: [110, 160, 214], bottom: [250, 214, 170], ambient: [0.92, 0.88, 0.86], day: 0.85, cloud: [250, 236, 226] },
  { h: 12, top: [80, 156, 214], bottom: [190, 226, 240], ambient: [1, 0.98, 0.95], day: 1, cloud: [255, 255, 255] },
  { h: 16.5, top: [92, 150, 210], bottom: [240, 214, 170], ambient: [0.98, 0.92, 0.84], day: 0.95, cloud: [255, 240, 220] },
  { h: 18.5, top: [64, 48, 120], bottom: [244, 138, 106], ambient: [0.72, 0.56, 0.62], day: 0.45, cloud: [240, 150, 140] },
  { h: 20, top: [30, 24, 70], bottom: [110, 56, 110], ambient: [0.42, 0.38, 0.58], day: 0.1, cloud: [80, 56, 100] },
  { h: 21.5, top: [12, 11, 34], bottom: [44, 32, 86], ambient: [0.3, 0.3, 0.48], day: 0, cloud: [44, 40, 78] },
  { h: 24, top: [11, 10, 31], bottom: [42, 30, 82], ambient: [0.3, 0.3, 0.48], day: 0, cloud: [44, 40, 78] },
]

const OVERCAST = { clear: 0, rain: 0.65, storm: 0.9, snow: 0.5 }

const LABELS = [
  [5, 'Night'], [7.5, 'Dawn'], [11, 'Morning'], [14, 'Midday'], [17.5, 'Afternoon'], [19.5, 'Dusk'], [21.5, 'Evening'], [24, 'Night'],
]

export function labelForHour(hour) {
  return LABELS.find(([end]) => hour < end)?.[1] ?? 'Night'
}

function sample(hour) {
  const i = KEYS.findIndex((k) => k.h > hour)
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.max(1, i)]
  const t = smoothstep(clamp((hour - a.h) / (b.h - a.h), 0, 1))
  return {
    top: mixRgb(a.top, b.top, t),
    bottom: mixRgb(a.bottom, b.bottom, t),
    ambient: mixRgb(a.ambient, b.ambient, t),
    daylight: lerp(a.day, b.day, t),
    cloud: mixRgb(a.cloud, b.cloud, t),
  }
}

function arcPosition(progress, lowY, highY) {
  return { x: lerp(110, 246, progress), y: lowY - Math.sin(progress * Math.PI) * (lowY - highY) }
}

export function timeOfDay(hour, weather) {
  const h = ((hour % 24) + 24) % 24
  const base = sample(h)
  const overcast = OVERCAST[weather] ?? 0
  const night = 1 - base.daylight

  const greyTop = mixRgb([112, 120, 138], [20, 20, 34], night)
  const greyBottom = mixRgb([150, 156, 170], [34, 32, 52], night)
  const snowTint = weather === 'snow' ? 0.15 : 0
  const top = mixRgb(base.top, greyTop, overcast * 0.85)
  const bottom = mixRgb(mixRgb(base.bottom, greyBottom, overcast * 0.85), [230, 232, 245], snowTint * base.daylight)
  const cloud = mixRgb(base.cloud, mixRgb([170, 174, 188], [40, 40, 58], night), overcast * 0.7)

  const dim = 1 - overcast * (weather === 'snow' ? 0.08 : 0.28)
  const ambient = base.ambient.map((c) => c * dim)
  if (weather === 'snow') ambient[2] *= 1.05

  const sunProgress = (h - 5.8) / 13.2
  const moonProgress = (((h - 19.2) % 24) + 24) % 24 / 10.8

  return {
    hour: h,
    weather,
    label: labelForHour(h),
    skyTop: top,
    skyBottom: bottom,
    cloud,
    ambient,
    daylight: base.daylight,
    night,
    overcast,
    sun: { visible: sunProgress > 0 && sunProgress < 1, ...arcPosition(clamp(sunProgress, 0, 1), 132, 46), low: 1 - Math.sin(clamp(sunProgress, 0, 1) * Math.PI) },
    moon: { visible: moonProgress > 0 && moonProgress < 1, ...arcPosition(clamp(moonProgress, 0, 1), 128, 50) },
    lampOn: base.daylight < 0.6 || overcast > 0.6,
    sunBeam: base.daylight * (1 - overcast * 0.85),
    moonBeam: night * (1 - overcast) * 0.6,
    fairy: 0.35 + 0.65 * night,
  }
}
