// A comic page Smudge draws: a seeded panel layout, turned into strokes that are laid down in
// order (pencil, then ink over the same lines, then colour), one pixel at a time.
import { makeLayer } from '../engine/canvas.js'
import { linePoints } from '../engine/draw.js'
import { createRng } from '../engine/rng.js'
import { PAGE } from '../scene/layout.js'

const PW = PAGE.w, PH = PAGE.h
export const PAGE_COLORS = ['#f4ead2', '#9cb8d8', '#1b2240', '#f2c230', '#ffffff', '#bcd8ea', '#3a3150', '#e8453c', '#f3a0b0', '#9fd8cb']
const [PAPER, PENCIL, INK, YELLOW, WHITE, SKY, DARK, RED, PINK, TEAL] = PAGE_COLORS.keys()
const SPEED = { pencil: 14, ink: 9, fill: 34 }
const TRAVEL_SPEED = 45

const LAYOUTS = [
  [[1, 1, 12, 10], [14, 1, 13, 10], [1, 12, 13, 11], [15, 12, 12, 11]],
  [[1, 1, 26, 10], [1, 12, 12, 11], [14, 12, 13, 11]],
  [[1, 1, 12, 10], [14, 1, 13, 10], [1, 12, 26, 11]],
  [[1, 1, 26, 7], [1, 9, 12, 6], [14, 9, 13, 6], [1, 16, 26, 7]],
]

const inPage = ([x, y]) => x >= 0 && x < PW && y >= 0 && y < PH
const dedupe = (points) => {
  const seen = new Set()
  return points.filter(([x, y]) => {
    const key = y * PW + x
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
const path = (points) => dedupe(points.filter(inPage))

function rectPath(x, y, w, h) {
  const pts = []
  for (let i = 0; i < w; i++) pts.push([x + i, y])
  for (let j = 1; j < h; j++) pts.push([x + w - 1, y + j])
  for (let i = w - 2; i >= 0; i--) pts.push([x + i, y + h - 1])
  for (let j = h - 2; j > 0; j--) pts.push([x, y + j])
  return path(pts)
}

function ellipsePath(cx, cy, rx, ry) {
  const pts = []
  const steps = Math.max(12, Math.round((rx + ry) * 4))
  for (let s = 0; s <= steps; s++) {
    const a = -Math.PI / 2 + (s / steps) * Math.PI * 2
    pts.push([Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)])
  }
  return path(pts)
}

const linePath = (x0, y0, x1, y1) => path(linePoints(x0, y0, x1, y1))

// Zig-zag scan of the inside of a shape, so colouring looks like a marker going back and forth.
function zigzagFill(x0, y0, x1, y1, inside) {
  const pts = []
  for (let y = y0; y <= y1; y++) {
    const row = []
    for (let x = x0; x <= x1; x++) if (inside(x, y)) row.push([x, y])
    if ((y - y0) % 2) row.reverse()
    pts.push(...row)
  }
  return path(pts)
}

const fillEllipse = (cx, cy, rx, ry) =>
  zigzagFill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / (rx - 0.6)) ** 2 + ((y - cy) / (ry - 0.6)) ** 2 < 1)

function smudgeHead(rng, ix, iy, iw, ih) {
  const r = Math.max(2, Math.min(4, Math.floor(Math.min(iw, ih) / 2) - 1))
  const cx = ix + rng.int(r + 1, Math.max(r + 1, iw - r - 2))
  const cy = iy + rng.int(r + 1, Math.max(r + 1, ih - r - 2))
  const lines = [ellipsePath(cx, cy, r, r)]
  if (r >= 3) {
    lines.push(path([[cx - 1, cy - 1]]), path([[cx + 1, cy - 1]]), linePath(cx - 1, cy + 1, cx + 1, cy + 1))
  } else {
    lines.push(path([[cx, cy]]))
  }
  if (rng.chance(0.5)) lines.push(linePath(cx + r - 1, cy + r - 1, cx + r - 1, cy + r + 1))
  return { lines, fills: [{ color: YELLOW, pixels: fillEllipse(cx, cy, r, r), overwrite: true }] }
}

function cityBlock(rng, ix, iy, iw, ih) {
  const lines = [], fills = []
  let x = ix
  while (x < ix + iw - 3) {
    const w = rng.int(3, 5)
    const h = rng.int(Math.min(3, ih - 1), Math.max(3, ih - 1))
    if (x + w > ix + iw) break
    lines.push(rectPath(x, iy + ih - h, w, h))
    const windows = []
    for (let wy = iy + ih - h + 2; wy < iy + ih - 1; wy += 2) if (w > 3) windows.push([x + 1 + (wy % 2), wy])
    fills.push({ color: YELLOW, pixels: path(windows), overwrite: true })
    x += w + rng.int(0, 1)
  }
  return { lines, fills }
}

function speechBubble(rng, ix, iy, iw, ih) {
  const rx = Math.max(2, Math.min(5, Math.floor(iw / 2) - 1))
  const ry = ih >= 7 ? 2 : 1
  const cx = ix + rx + rng.int(0, Math.max(0, iw - rx * 2 - 1))
  const cy = iy + ry
  const lines = [ellipsePath(cx, cy, rx, ry), linePath(cx - 1, cy + ry + 1, cx - 2, cy + ry + 2)]
  if (rx >= 4) lines.push(linePath(cx - rx + 2, cy, cx + rx - 2, cy))
  return { lines, fills: [{ color: WHITE, pixels: fillEllipse(cx, cy, rx, ry + 0.4), overwrite: true }] }
}

function actionLines(rng, ix, iy, iw, ih) {
  const lines = []
  const n = Math.min(3, Math.floor(iw / 3))
  for (let k = 0; k < n; k++) {
    const x0 = ix + k * 3, y0 = iy + ih - 1
    lines.push(linePath(x0, y0, x0 + 3, Math.max(iy, y0 - 4)))
  }
  const bx = ix + iw - 3, by = iy + 2
  lines.push(linePath(bx - 2, by, bx + 2, by), linePath(bx, by - 2, bx, by + 2))
  return { lines, fills: [{ color: rng.pick([PINK, RED]), pixels: path([[bx - 1, by - 1], [bx + 1, by + 1], [bx + 1, by - 1], [bx - 1, by + 1]]), overwrite: true }] }
}

function sludgieBlob(rng, ix, iy, iw, ih) {
  const rx = Math.max(2, Math.min(4, Math.floor(iw / 2) - 1))
  const ry = Math.max(2, Math.min(3, Math.floor(ih / 2) - 1))
  const cx = ix + rng.int(rx, Math.max(rx, iw - rx - 1))
  const cy = iy + ih - ry - 1
  const eyes = path([[cx - 1, cy - 1], [cx + 1, cy - 1]])
  return {
    lines: [ellipsePath(cx, cy, rx, ry), linePath(cx - rx + 1, cy + ry, cx - rx + 1, Math.min(iy + ih - 1, cy + ry + 1))],
    fills: [{ color: DARK, pixels: fillEllipse(cx, cy, rx, ry), overwrite: true }, { color: RED, pixels: eyes, overwrite: true }],
  }
}

function moonPanel(rng, ix, iy, iw, ih) {
  const cx = ix + iw - 4, cy = iy + 3
  const stars = Array.from({ length: 3 }, () => [ix + rng.int(1, Math.max(1, iw - 7)), iy + rng.int(1, Math.max(1, ih - 2))])
  return {
    lines: [ellipsePath(cx, cy, 2, 2)],
    fills: [{ color: YELLOW, pixels: fillEllipse(cx, cy, 2, 2), overwrite: true }, { color: WHITE, pixels: path(stars), overwrite: true }],
    background: DARK,
  }
}

const CONTENT = [smudgeHead, smudgeHead, cityBlock, speechBubble, actionLines, sludgieBlob, moonPanel]

function buildStrokes(rng) {
  const panels = rng.pick(LAYOUTS)
  const borders = panels.map(([x, y, w, h]) => rectPath(x, y, w, h))
  const contentLines = [], objectFills = [], backgroundFills = []

  for (const [x, y, w, h] of panels) {
    const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2
    const pieces = [rng.pick(CONTENT)(rng, ix, iy, iw, ih)]
    if (iw >= 12 && rng.chance(0.6)) pieces.push(speechBubble(rng, ix + Math.floor(iw / 2), iy, Math.ceil(iw / 2), ih))
    else if (rng.chance(0.4)) pieces.push(rng.pick([smudgeHead, cityBlock])(rng, ix, iy, iw, ih))
    for (const piece of pieces) {
      contentLines.push(...piece.lines)
      objectFills.push(...piece.fills)
    }
    const background = pieces.find((p) => p.background)?.background ?? (rng.chance(0.55) ? rng.pick([SKY, PINK, TEAL, SKY]) : null)
    if (background !== null) {
      backgroundFills.push({ color: background, pixels: zigzagFill(ix, iy, ix + iw - 1, iy + ih - 1, () => true), overwrite: false })
    }
  }

  const lines = [...borders, ...contentLines].filter((p) => p.length)
  return [
    ...lines.map((pixels) => ({ layer: 'pencil', color: PENCIL, pixels })),
    ...lines.map((pixels) => ({ layer: 'ink', color: INK, pixels })),
    ...[...objectFills, ...backgroundFills].filter((f) => f.pixels.length).map((f) => ({ layer: 'fill', ...f })),
  ]
}

function inverseAffine() {
  const { u, v } = PAGE
  const det = u.x * v.y - v.x * u.y
  return (dx, dy) => ({ i: (dx * v.y - dy * v.x) / det, j: (u.x * dy - u.y * dx) / det })
}
const toPage = inverseAffine()

export function createComicPage(seed) {
  const rng = createRng(seed)
  const strokes = buildStrokes(rng)
  const grid = new Uint8Array(PW * PH)
  let strokeIndex = 0
  let progress = 0
  let plotted = 0
  let travel = null
  let done = false
  let version = 0
  let flatVersion = -1
  let skewVersion = -1
  const tip = { x: strokes[0].pixels[0][0] + 0.5, y: strokes[0].pixels[0][1] + 0.5, lifted: true }
  const flat = makeLayer(PW, PH)
  const skewBounds = boardBounds()
  const skew = makeLayer(skewBounds.w, skewBounds.h)

  function plot(stroke, k) {
    const [x, y] = stroke.pixels[k]
    const o = y * PW + x
    const current = grid[o]
    if (stroke.layer === 'pencil' && current !== PAPER) return
    if (stroke.layer === 'fill') {
      if (current === INK) return
      if (!stroke.overwrite && current !== PAPER && current !== PENCIL) return
    }
    grid[o] = stroke.color
    version++
  }

  function nextStroke() {
    strokeIndex++
    progress = 0
    plotted = 0
    if (strokeIndex >= strokes.length) { done = true; return }
    const [x, y] = strokes[strokeIndex].pixels[0]
    travel = { x: x + 0.5, y: y + 0.5 }
  }

  function advance(dt) {
    if (done) return
    if (travel) {
      const dx = travel.x - tip.x, dy = travel.y - tip.y
      const dist = Math.hypot(dx, dy)
      const step = TRAVEL_SPEED * dt
      if (dist <= step) { tip.x = travel.x; tip.y = travel.y; travel = null }
      else { tip.x += (dx / dist) * step; tip.y += (dy / dist) * step }
      tip.lifted = true
      return
    }
    const stroke = strokes[strokeIndex]
    progress = Math.min(stroke.pixels.length - 1, progress + SPEED[stroke.layer] * dt)
    while (plotted <= Math.floor(progress)) plot(stroke, plotted++)
    const k = Math.floor(progress), f = progress - k
    const [ax, ay] = stroke.pixels[k]
    const [bx, by] = stroke.pixels[Math.min(k + 1, stroke.pixels.length - 1)]
    tip.x = ax + (bx - ax) * f + 0.5
    tip.y = ay + (by - ay) * f + 0.5
    tip.lifted = false
    if (plotted >= stroke.pixels.length) nextStroke()
  }

  // Jump straight to a share of the work, without animating (used for the opening page).
  function skipTo(fraction) {
    const target = Math.floor(strokes.length * fraction)
    while (!done && strokeIndex < target) {
      const stroke = strokes[strokeIndex]
      for (let k = 0; k < stroke.pixels.length; k++) plot(stroke, k)
      nextStroke()
    }
    if (!done) {
      travel = null
      const [x, y] = strokes[strokeIndex].pixels[0]
      tip.x = x + 0.5; tip.y = y + 0.5
    }
  }

  function renderImage(layer, pixelAt) {
    const { canvas, ctx } = layer
    const image = ctx.createImageData(canvas.width, canvas.height)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = pixelAt(x, y)
        if (index < 0) continue
        const hex = PAGE_COLORS[index]
        const o = (y * canvas.width + x) * 4
        image.data[o] = parseInt(hex.slice(1, 3), 16)
        image.data[o + 1] = parseInt(hex.slice(3, 5), 16)
        image.data[o + 2] = parseInt(hex.slice(5, 7), 16)
        image.data[o + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }

  function flatCanvas() {
    if (flatVersion !== version) {
      renderImage(flat, (x, y) => grid[y * PW + x])
      flatVersion = version
    }
    return flat.canvas
  }

  function skewedCanvas() {
    if (skewVersion !== version) {
      renderImage(skew, (x, y) => {
        const { i, j } = toPage(skewBounds.x + x + 0.5 - PAGE.origin.x, skewBounds.y + y + 0.5 - PAGE.origin.y)
        if (i < 0 || j < 0 || i >= PW || j >= PH) return -1
        return grid[Math.floor(j) * PW + Math.floor(i)]
      })
      skewVersion = version
    }
    return skew.canvas
  }

  const layerNow = () => (done ? null : strokes[strokeIndex].layer)
  const inkLaid = () => strokes.slice(0, strokeIndex).filter((s) => s.layer === 'ink').reduce((n, s) => n + s.pixels.length, 0) + (layerNow() === 'ink' ? plotted : 0)

  return {
    seed,
    advance,
    skipTo,
    tip,
    flatCanvas,
    skewedCanvas,
    skewBounds,
    layerNow,
    inkLaid,
    get done() { return done },
    get progress() { return done ? 1 : strokeIndex / strokes.length },
  }
}

function boardBounds() {
  const corners = [[0, 0], [PW, 0], [PW, PH], [0, PH]].map(([i, j]) => ({
    x: PAGE.origin.x + i * PAGE.u.x + j * PAGE.v.x,
    y: PAGE.origin.y + i * PAGE.u.y + j * PAGE.v.y,
  }))
  const x = Math.floor(Math.min(...corners.map((c) => c.x)))
  const y = Math.floor(Math.min(...corners.map((c) => c.y)))
  return { x, y, w: Math.ceil(Math.max(...corners.map((c) => c.x))) - x + 1, h: Math.ceil(Math.max(...corners.map((c) => c.y))) - y + 1 }
}

export function createFinishedPage(seed) {
  const page = createComicPage(seed)
  page.skipTo(1)
  return page
}
