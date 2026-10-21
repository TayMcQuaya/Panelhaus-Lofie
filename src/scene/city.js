// The city through the window: far and mid skyline, Tumble's Comics across the street,
// lit windows that come and go, blinking antennas, a plane at night, birds by day.
import { makeLayer, W, H } from '../engine/canvas.js'
import { disc, px, rect, text3x5, textWidth } from '../engine/draw.js'
import { lerp, mixRgb, rgbCss } from '../engine/ease.js'
import { createRng } from '../engine/rng.js'
import { GLASS } from './layout.js'

const LEFT = GLASS.x - 6
const RIGHT = GLASS.x + GLASS.w + 6
const BOTTOM = GLASS.y + GLASS.h
const NEAR_TOP = 100
const SIGN = { x: 125, y: 102, w: 39, h: 17, text: "TUMBLE'S" }

function makeRow(rng, minW, maxW, minTop, maxTop) {
  const buildings = []
  let x = LEFT
  while (x < RIGHT) {
    const w = rng.int(minW, maxW)
    buildings.push({ x, w, top: rng.int(minTop, maxTop), antenna: rng.chance(0.3), tower: false, seed: rng.int(0, 1e6) })
    x += w + rng.int(0, 2)
  }
  return buildings
}

function makeWindows(rng, building, spacingX, spacingY) {
  const windows = []
  for (let y = building.top + 4; y < NEAR_TOP - 1; y += spacingY) {
    for (let x = building.x + 2; x < building.x + building.w - 2; x += spacingX) {
      windows.push({ x, y, threshold: rng.next(), warm: rng.pick(['#ffd27a', '#ffd27a', '#ffb35c', '#fff0b8', '#a8e0ff']), forced: null })
    }
  }
  return windows
}

export function createCity(seed = 11) {
  const rng = createRng(seed)
  const far = makeRow(rng, 7, 15, 52, 92)
  const mid = makeRow(rng, 12, 22, 72, 100)
  mid[Math.floor(mid.length / 2)].tower = true
  const midWindows = mid.flatMap((b) => makeWindows(rng, b, 3, 4))
  const farWindows = far.flatMap((b) => makeWindows(rng, b, 4, 5))
  const antennas = far.filter((b) => b.antenna).map((b) => ({ x: b.x + Math.floor(b.w / 2), y: b.top - rng.int(5, 9), phase: rng.range(0, 2) }))

  const cache = makeLayer(W, H)
  let cacheKey = ''
  let litVersion = 0
  let toggleTimer = 2
  let neonFlicker = 0
  let nextFlicker = rng.range(8, 20)
  let plane = null
  let nextPlane = 12
  let birds = null
  let nextBirds = 6

  const isLit = (w, env) => w.forced ?? env.night * (1 - env.daylight * 0.5) > w.threshold * 0.85 + 0.08

  function renderBuildings(ctx, env) {
    ctx.clearRect(0, 0, W, H)
    const farColor = mixRgb(mixRgb([46, 42, 82], [164, 186, 206], env.daylight), env.skyBottom, 0.3)
    const midColor = mixRgb(mixRgb([30, 27, 56], [116, 132, 158], env.daylight), env.skyBottom, 0.14)
    const midShade = midColor.map((c) => c * 0.82)
    const dayWindow = rgbCss(mixRgb(midColor, [200, 226, 240], 0.45))

    for (const b of far) rect(ctx, b.x, b.top, b.w, BOTTOM - b.top, rgbCss(farColor))
    for (const w of farWindows) {
      if (isLit(w, env)) { ctx.globalAlpha = 0.55; px(ctx, w.x, w.y, w.warm); ctx.globalAlpha = 1 }
    }
    for (const a of antennas) rect(ctx, a.x, a.y, 1, far.find((b) => a.x >= b.x && a.x < b.x + b.w).top - a.y, rgbCss(farColor))

    for (const b of mid) {
      rect(ctx, b.x, b.top, b.w, BOTTOM - b.top, rgbCss(midColor))
      rect(ctx, b.x, b.top, 2, BOTTOM - b.top, rgbCss(midShade))
      rect(ctx, b.x - 1, b.top - 1, b.w + 2, 1, rgbCss(midShade))
      if (b.tower) drawWaterTower(ctx, b.x + Math.floor(b.w / 2) - 4, b.top - 1, midShade)
    }
    for (const w of midWindows) {
      if (isLit(w, env)) rect(ctx, w.x, w.y, 1, 2, w.warm)
      else if (env.daylight > 0.4) { ctx.globalAlpha = 0.6; rect(ctx, w.x, w.y, 1, 2, dayWindow); ctx.globalAlpha = 1 }
    }
    drawNearBuilding(ctx, env)
  }

  function drawWaterTower(ctx, x, baseY, color) {
    const c = rgbCss(color)
    rect(ctx, x + 1, baseY - 4, 1, 4, c); rect(ctx, x + 6, baseY - 4, 1, 4, c)
    rect(ctx, x, baseY - 11, 8, 7, c)
    rect(ctx, x + 1, baseY - 13, 6, 2, c)
    rect(ctx, x + 3, baseY - 14, 2, 1, c)
    ctx.globalAlpha = 0.25
    rect(ctx, x, baseY - 9, 8, 1, '#000000')
    rect(ctx, x, baseY - 6, 8, 1, '#000000')
    ctx.globalAlpha = 1
  }

  function drawNearBuilding(ctx, env) {
    const light = lerp(0.45, 1, env.daylight) * (1 - env.overcast * 0.25)
    const brick = rgbCss([118 * light, 60 * light, 56 * light])
    const joint = rgbCss([78 * light, 38 * light, 40 * light])
    const trim = rgbCss([70 * light, 64 * light, 86 * light])
    rect(ctx, LEFT, NEAR_TOP, RIGHT - LEFT, BOTTOM - NEAR_TOP, brick)
    for (let y = NEAR_TOP + 3; y < BOTTOM; y += 3) {
      rect(ctx, LEFT, y, RIGHT - LEFT, 1, joint)
      const offset = (y / 3) % 2 === 0 ? 0 : 3
      for (let x = LEFT + offset; x < RIGHT; x += 6) px(ctx, x, y + 1, joint)
    }
    rect(ctx, LEFT, NEAR_TOP - 2, RIGHT - LEFT, 2, trim)
    const shade = (rgb) => rgbCss(rgb.map((c) => c * light))
    const lampsOn = env.night > 0.3 || env.overcast > 0.6

    // Tumble's Comics & Copy, as in Day of the Smudgies: neon sign box, striped awning,
    // a lit window full of comic covers, a teal door and an OPEN sign.
    rect(ctx, SIGN.x, SIGN.y, SIGN.w, SIGN.h, '#14101e')
    rect(ctx, SIGN.x, SIGN.y, SIGN.w, 1, shade([78, 230, 208]))
    rect(ctx, SIGN.x, SIGN.y + SIGN.h - 1, SIGN.w, 1, shade([78, 230, 208]))
    rect(ctx, SIGN.x, SIGN.y, 1, SIGN.h, shade([78, 230, 208]))
    rect(ctx, SIGN.x + SIGN.w - 1, SIGN.y, 1, SIGN.h, shade([78, 230, 208]))

    for (let x = 110; x < 178; x += 4) {
      const teal = (x / 4) % 2 === 0
      rect(ctx, x, 121, 4, 5, teal ? shade([52, 168, 156]) : shade([236, 226, 204]))
      rect(ctx, x, 121, 4, 1, teal ? shade([90, 200, 186]) : shade([250, 244, 228]))
      px(ctx, x + 1, 126, teal ? shade([40, 128, 120]) : shade([206, 196, 176]))
      px(ctx, x + 2, 126, teal ? shade([40, 128, 120]) : shade([206, 196, 176]))
    }
    rect(ctx, 110, 127, 68, BOTTOM - 127, shade([40, 72, 76]))
    const glow = lampsOn ? '#ffd690' : rgbCss(mixRgb([170, 190, 200], [255, 214, 144], env.night))
    rect(ctx, 112, 128, 64, BOTTOM - 128, glow)
    const covers = ['#e8453c', '#4a7ad8', '#ffd84a', '#3fae6a', '#b06ad8', '#ff8a3a', '#efe6d0']
    covers.forEach((c, i) => {
      rect(ctx, 114 + i * 9, 130, 6, 8, c)
      rect(ctx, 115 + i * 9, 131, 4, 2, 'rgba(255,255,255,0.45)')
    })

    // The door shares the shop window's baseline and stands only a little taller than it.
    rect(ctx, 181, 124, 10, BOTTOM - 124, shade([30, 60, 62]))
    rect(ctx, 182, 125, 8, BOTTOM - 125, shade([46, 128, 122]))
    rect(ctx, 183, 127, 6, 4, lampsOn ? '#ffe2a0' : shade([150, 190, 196]))
    px(ctx, 188, 132, '#e0c07a')

    rect(ctx, 195, 125, 19, 8, '#14101e')
    text3x5(ctx, 'OPEN', 197, 126, lampsOn ? '#ff4a4a' : '#7a3a3a')

    for (const wx of [197, 213]) {
      rect(ctx, wx - 1, 104, 10, 13, trim)
      rect(ctx, wx, 105, 8, 11, env.night > 0.35 ? '#ffcf7a' : rgbCss(mixRgb([60, 70, 90], [170, 196, 210], env.daylight)))
      rect(ctx, wx + 3, 105, 1, 11, trim)
      rect(ctx, wx - 1, 117, 10, 1, shade([150, 140, 160]))
    }

    // Street lamp on the corner
    rect(ctx, 236, 110, 1, BOTTOM - 110, '#1a1624')
    rect(ctx, 233, 107, 7, 3, '#1a1624')
    rect(ctx, 234, 110, 5, 1, lampsOn ? '#fff0b8' : '#5a5868')
  }

  function drawSign(ctx, env, t) {
    const on = env.night > 0.25 || env.overcast > 0.6
    const title = { x: SIGN.x + Math.round((SIGN.w - textWidth(SIGN.text)) / 2), y: SIGN.y + 3 }
    const sub = { x: SIGN.x + Math.round((SIGN.w - textWidth('COMICS')) / 2), y: SIGN.y + 10 }
    if (on) {
      ctx.globalAlpha = 0.14 + Math.sin(t * 3) * 0.02
      rect(ctx, SIGN.x - 4, SIGN.y - 4, SIGN.w + 8, SIGN.h + 8, '#ff5fa2')
      ctx.globalAlpha = 0.1
      disc(ctx, 236, 112, 4, '#fff0b8')
      disc(ctx, 204, 129, 5, '#ff4a4a')
      ctx.globalAlpha = 1
    }
    let cursor = title.x
    ;[...SIGN.text].forEach((ch, i) => {
      const flickerOff = on && i === 4 && neonFlicker > 0 && Math.sin(t * 60) > 0
      text3x5(ctx, ch, cursor, title.y, flickerOff ? '#5a3048' : on ? '#ff6fae' : '#7a4a62')
      cursor += textWidth(ch) + 1
    })
    text3x5(ctx, 'COMICS', sub.x, sub.y, on ? '#5ef0dc' : '#3a6a66')
  }

  function update(dt, env) {
    toggleTimer -= dt
    if (toggleTimer <= 0) {
      toggleTimer = rng.range(2.5, 6)
      const w = rng.pick(midWindows)
      w.forced = w.forced === null ? !isLit(w, env) : null
      litVersion++
    }
    neonFlicker = Math.max(0, neonFlicker - dt)
    nextFlicker -= dt
    if (nextFlicker <= 0) { neonFlicker = rng.range(0.3, 0.9); nextFlicker = rng.range(10, 28) }

    nextPlane -= dt
    if (!plane && nextPlane <= 0 && env.night > 0.5) plane = { x: LEFT - 4, y: GLASS.y + rng.int(6, 22) }
    if (plane) {
      plane.x += 9 * dt
      if (plane.x > RIGHT + 4) { plane = null; nextPlane = rng.range(30, 70) }
    }

    nextBirds -= dt
    if (!birds && nextBirds <= 0 && env.daylight > 0.5 && env.overcast < 0.7) {
      birds = Array.from({ length: rng.int(2, 4) }, (_, i) => ({ x: RIGHT + i * 7, y: GLASS.y + 20 + rng.int(-4, 8) + i * 2, phase: rng.range(0, 6) }))
    }
    if (birds) {
      for (const b of birds) b.x -= 15 * dt
      if (birds.every((b) => b.x < LEFT - 5)) { birds = null; nextBirds = rng.range(20, 45) }
    }
  }

  function draw(ctx, env, t) {
    const key = `${Math.round(env.daylight * 40)}|${Math.round(env.overcast * 10)}|${env.skyBottom.map((v) => Math.round(v / 4))}|${litVersion}`
    if (key !== cacheKey) { renderBuildings(cache.ctx, env); cacheKey = key }
    ctx.drawImage(cache.canvas, 0, 0)

    for (const a of antennas) {
      if ((t + a.phase) % 2 < 0.35) px(ctx, a.x, a.y - 1, '#ff4040')
    }
    if (plane) {
      px(ctx, plane.x, plane.y, '#ffffff')
      if (t % 1 < 0.5) px(ctx, plane.x - 2, plane.y, '#ff4848')
      if (t % 1.3 < 0.12) { ctx.globalAlpha = 0.5; disc(ctx, plane.x, plane.y, 1.5, '#ffffff'); ctx.globalAlpha = 1 }
    }
    if (birds) {
      for (const b of birds) {
        const up = Math.sin(t * 9 + b.phase) > 0
        const c = rgbCss(mixRgb([40, 40, 60], env.skyBottom, 0.2))
        px(ctx, b.x, b.y, c)
        px(ctx, b.x - 1, b.y + (up ? -1 : 0), c)
        px(ctx, b.x + 1, b.y + (up ? -1 : 0), c)
      }
    }
    drawSign(ctx, env, t)
  }

  return { update, draw }
}
