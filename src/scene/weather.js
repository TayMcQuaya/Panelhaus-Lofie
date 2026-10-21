// Rain, snow and storms outside the glass; drops and frost on the glass itself; lightning.
import { line, px, rect } from '../engine/draw.js'
import { createRng } from '../engine/rng.js'
import { GLASS, PANES } from './layout.js'

const RAIN_COUNT = { rain: 110, storm: 200 }
const insideGlass = (x, y) => PANES.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)

export function createWeather(onThunder) {
  const rng = createRng(99)
  const spawnDrop = (anyY) => ({
    x: GLASS.x + rng.range(-10, GLASS.w),
    y: anyY ? GLASS.y + rng.range(0, GLASS.h) : GLASS.y - rng.range(2, 12),
    speed: rng.range(150, 220),
    len: rng.int(3, 5),
  })
  const spawnFlake = (anyY) => ({
    x: GLASS.x + rng.range(0, GLASS.w),
    y: anyY ? GLASS.y + rng.range(0, GLASS.h) : GLASS.y - 2,
    speed: rng.range(9, 22),
    drift: rng.range(0, Math.PI * 2),
    size: rng.chance(0.25) ? 2 : 1,
  })
  const rain = Array.from({ length: RAIN_COUNT.storm }, () => spawnDrop(true))
  const snow = Array.from({ length: 90 }, () => spawnFlake(true))
  const glassDrops = Array.from({ length: 16 }, () => {
    const pane = rng.pick(PANES)
    return { x: pane.x + rng.int(2, pane.w - 3), y: pane.y + rng.int(2, pane.h - 6), pane, sliding: 0, trail: 0, wait: rng.range(1, 8) }
  })

  let flash = 0
  let flashQueue = []
  let bolt = null
  let nextBolt = rng.range(5, 12)

  function strike() {
    const startX = GLASS.x + rng.int(20, GLASS.w - 20)
    const points = [[startX, GLASS.y]]
    let x = startX
    for (let y = GLASS.y; y < GLASS.y + 70; y += rng.int(4, 8)) {
      x += rng.int(-4, 4)
      points.push([x, y])
    }
    bolt = { points, life: 0.35 }
    flashQueue = [[0, 0.95], [0.07, 0.15], [0.14, 0.7], [0.3, 0.25]]
    onThunder?.(rng.range(0.5, 2.2))
  }

  function update(dt, weather) {
    const wet = weather === 'rain' || weather === 'storm'
    const count = RAIN_COUNT[weather] ?? 0
    const wind = weather === 'storm' ? 0.45 : 0.18
    for (let i = 0; i < count; i++) {
      const d = rain[i]
      d.y += d.speed * dt * (weather === 'storm' ? 1.25 : 1)
      d.x += d.speed * dt * wind
      if (d.y > GLASS.y + GLASS.h + 4) Object.assign(d, spawnDrop(false))
    }
    if (weather === 'snow') {
      for (const f of snow) {
        f.y += f.speed * dt
        f.drift += dt * 1.3
        f.x += Math.sin(f.drift) * 6 * dt
        if (f.y > GLASS.y + GLASS.h + 2) Object.assign(f, spawnFlake(false))
      }
    }
    if (wet) {
      for (const g of glassDrops) {
        g.wait -= dt
        if (g.wait <= 0 && !g.sliding) g.sliding = rng.range(14, 30)
        if (g.sliding) {
          g.y += g.sliding * dt
          g.trail = Math.min(6, g.trail + g.sliding * dt)
          if (g.y > g.pane.y + g.pane.h - 2) {
            g.pane = rng.pick(PANES)
            Object.assign(g, { x: g.pane.x + rng.int(2, g.pane.w - 3), y: g.pane.y + rng.int(2, 18), sliding: 0, trail: 0, wait: rng.range(2, 9) })
          }
        }
      }
    }

    if (weather === 'storm') {
      nextBolt -= dt
      if (nextBolt <= 0) { strike(); nextBolt = rng.range(8, 22) }
    }
    flashQueue = flashQueue.map(([at, v]) => [at - dt, v])
    while (flashQueue.length && flashQueue[0][0] <= 0) flash = Math.max(flash, flashQueue.shift()[1])
    flash = Math.max(0, flash - dt * 3.2)
    if (bolt) { bolt.life -= dt; if (bolt.life <= 0) bolt = null }
  }

  function drawOutside(ctx, weather) {
    if (bolt) {
      for (let i = 1; i < bolt.points.length; i++) {
        const [ax, ay] = bolt.points[i - 1], [bx, by] = bolt.points[i]
        line(ctx, ax, ay, bx, by, '#f4f0ff')
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.55
      rect(ctx, GLASS.x, GLASS.y, GLASS.w, GLASS.h, '#e6e8ff')
      ctx.globalAlpha = 1
    }
    const count = RAIN_COUNT[weather] ?? 0
    if (count) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = '#c4d4ec'
      const wind = weather === 'storm' ? 0.45 : 0.18
      for (let i = 0; i < count; i++) {
        const d = rain[i]
        for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(d.x + k * wind), Math.round(d.y + k), 1, 1)
      }
      ctx.globalAlpha = 1
    }
    if (weather === 'snow') {
      ctx.fillStyle = '#f4f6ff'
      for (const f of snow) {
        ctx.globalAlpha = f.size === 2 ? 0.95 : 0.7
        ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size)
      }
      ctx.globalAlpha = 1
    }
  }

  // Drawn after lighting so the glass catches light from outside, not from the lamp.
  function drawGlass(ctx, weather) {
    if (weather === 'rain' || weather === 'storm') {
      for (const g of glassDrops) {
        const x = Math.round(g.x), y = Math.round(g.y)
        if (!insideGlass(x, y)) continue
        ctx.globalAlpha = 0.22
        for (let k = 1; k <= g.trail; k++) if (insideGlass(x, y - k)) px(ctx, x, y - k, '#dfe9ff')
        ctx.globalAlpha = 0.55
        rect(ctx, x, y, 2, 2, '#b8cae6')
        ctx.globalAlpha = 0.9
        px(ctx, x, y, '#ffffff')
      }
      ctx.globalAlpha = 1
    }
    if (weather === 'snow') {
      ctx.fillStyle = '#eef3ff'
      for (const p of PANES) {
        for (let j = 0; j < 9; j++) {
          for (let i = 0; i < 12 - j; i++) {
            const seedValue = ((i * 73 + j * 151 + p.x) % 17) / 17
            if (seedValue > 0.35 + j * 0.06) continue
            ctx.globalAlpha = 0.5
            ctx.fillRect(p.x + i, p.y + p.h - 1 - j, 1, 1)
            ctx.fillRect(p.x + p.w - 1 - i, p.y + p.h - 1 - j, 1, 1)
          }
        }
      }
      ctx.globalAlpha = 1
    }
  }

  return {
    update,
    drawOutside,
    drawGlass,
    strike,
    get flash() { return flash },
  }
}
