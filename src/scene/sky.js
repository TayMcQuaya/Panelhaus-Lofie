// Sky seen through the window: dithered gradient, stars, sun, moon, drifting clouds.
import { makeLayer } from '../engine/canvas.js'
import { bayer, disc } from '../engine/draw.js'
import { mixRgb, rgbCss } from '../engine/ease.js'
import { createRng } from '../engine/rng.js'
import { GLASS } from './layout.js'

const BANDS = 10

function makeStars(rng) {
  return Array.from({ length: 46 }, () => ({
    x: GLASS.x + rng.int(0, GLASS.w - 1),
    y: GLASS.y + rng.int(0, 62),
    phase: rng.range(0, Math.PI * 2),
    speed: rng.range(0.6, 2.2),
    big: rng.chance(0.12),
    color: rng.pick(['#ffffff', '#fff4d6', '#d6e4ff']),
  }))
}

function makeClouds(rng) {
  return Array.from({ length: 7 }, (_, i) => {
    const puffCount = rng.int(3, 5)
    const puffs = Array.from({ length: puffCount }, (_, p) => ({
      dx: p * rng.int(4, 6) - puffCount * 2.5,
      dy: rng.int(-2, 1),
      r: rng.range(3, 5.5),
    }))
    return {
      x: GLASS.x + rng.range(-20, GLASS.w + 10),
      y: GLASS.y + 8 + i * 7 + rng.int(-3, 3),
      speed: rng.range(1.2, 3.2),
      puffs,
    }
  })
}

export function createSky() {
  const rng = createRng(7)
  const stars = makeStars(rng)
  const clouds = makeClouds(rng)
  const gradient = makeLayer(GLASS.w, GLASS.h)
  let gradientKey = ''

  function renderGradient(env) {
    const image = gradient.ctx.createImageData(GLASS.w, GLASS.h)
    const bandColor = (b) => mixRgb(env.skyTop, env.skyBottom, Math.min(1, b / (BANDS - 1)))
    for (let j = 0; j < GLASS.h; j++) {
      // The bottom third of the glass is hidden by the street, so the gradient finishes above it.
      const t = Math.min(1, j / 74) ** 0.9 * (BANDS - 1)
      const band = Math.floor(t)
      const f = t - band
      for (let i = 0; i < GLASS.w; i++) {
        const c = bandColor(bayer(i, j) < f ? band + 1 : band)
        const o = (j * GLASS.w + i) * 4
        image.data[o] = c[0]; image.data[o + 1] = c[1]; image.data[o + 2] = c[2]; image.data[o + 3] = 255
      }
    }
    gradient.ctx.putImageData(image, 0, 0)
  }

  function update(dt, env) {
    for (const cloud of clouds) {
      cloud.x += cloud.speed * dt * (1 + env.overcast)
      if (cloud.x > GLASS.x + GLASS.w + 30) cloud.x = GLASS.x - 30
    }
  }

  function drawStars(ctx, env, t) {
    const visibility = env.night * (1 - env.overcast)
    if (visibility < 0.05) return
    for (const s of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase)
      ctx.globalAlpha = visibility * twinkle
      ctx.fillStyle = s.color
      ctx.fillRect(s.x, s.y, 1, 1)
      if (s.big && twinkle > 0.8) {
        ctx.globalAlpha = visibility * 0.5
        ctx.fillRect(s.x - 1, s.y, 1, 1); ctx.fillRect(s.x + 1, s.y, 1, 1)
        ctx.fillRect(s.x, s.y - 1, 1, 1); ctx.fillRect(s.x, s.y + 1, 1, 1)
      }
    }
    ctx.globalAlpha = 1
  }

  function drawSun(ctx, env) {
    if (!env.sun.visible) return
    const color = mixRgb([255, 246, 210], [255, 150, 84], env.sun.low ** 2)
    const fade = 1 - env.overcast * 0.8
    ctx.globalAlpha = 0.12 * fade
    disc(ctx, env.sun.x, env.sun.y, 13, rgbCss(color))
    ctx.globalAlpha = 0.22 * fade
    disc(ctx, env.sun.x, env.sun.y, 9.5, rgbCss(color))
    ctx.globalAlpha = fade
    disc(ctx, env.sun.x, env.sun.y, 6.5, rgbCss(color))
    ctx.globalAlpha = 1
  }

  function drawMoon(ctx, env) {
    if (!env.moon.visible) return
    const fade = (1 - env.overcast * 0.85) * Math.min(1, env.night * 1.5)
    if (fade <= 0.02) return
    const { x, y } = env.moon
    ctx.globalAlpha = 0.1 * fade
    disc(ctx, x, y, 12, '#f4edd0')
    ctx.globalAlpha = fade
    disc(ctx, x, y, 6.5, '#f4edd0')
    disc(ctx, x - 2, y - 2, 1.5, '#d8cfa8')
    disc(ctx, x + 2, y + 2, 1, '#d8cfa8')
    ctx.fillStyle = '#d8cfa8'
    ctx.fillRect(Math.round(x) + 3, Math.round(y) - 3, 1, 1)
    ctx.fillStyle = '#fffbea'
    ctx.fillRect(Math.round(x) - 4, Math.round(y) - 3, 1, 2)
    ctx.globalAlpha = 1
  }

  function drawClouds(ctx, env) {
    const visibleCount = Math.round(3 + env.overcast * 4)
    const body = rgbCss(env.cloud)
    const shade = rgbCss(env.cloud.map((c) => c * 0.8))
    ctx.globalAlpha = 0.75 + env.overcast * 0.25
    for (const cloud of clouds.slice(0, visibleCount)) {
      for (const p of cloud.puffs) disc(ctx, cloud.x + p.dx, cloud.y + p.dy + 1, p.r, shade)
      for (const p of cloud.puffs) disc(ctx, cloud.x + p.dx, cloud.y + p.dy, p.r - 0.8, body)
    }
    ctx.globalAlpha = 1
  }

  function draw(ctx, env, t) {
    const key = [...env.skyTop, ...env.skyBottom].map((v) => Math.round(v / 3)).join(',')
    if (key !== gradientKey) {
      renderGradient(env)
      gradientKey = key
    }
    ctx.drawImage(gradient.canvas, GLASS.x, GLASS.y)
    drawStars(ctx, env, t)
    drawMoon(ctx, env)
    drawSun(ctx, env)
    drawClouds(ctx, env)
  }

  return { update, draw }
}
