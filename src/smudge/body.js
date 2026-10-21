// Smudge's sponge body: a lit sphere with pores and water droplets fixed in body space,
// cached per squash shape so breathing and bouncing cost nothing per frame.
import { makeLayer } from '../engine/canvas.js'
import { bayer } from '../engine/draw.js'
import { hexRgb } from '../engine/ease.js'
import { P } from '../engine/palette.js'
import { createRng } from '../engine/rng.js'

const LIGHT = (() => {
  const v = [-0.5, -0.62, 0.6]
  const len = Math.hypot(...v)
  return v.map((c) => c / len)
})()

const PORES = (() => {
  const rng = createRng(4242)
  const list = []
  for (let tries = 0; list.length < 34 && tries < 800; tries++) {
    const a = rng.next() * Math.PI * 2
    const d = Math.sqrt(rng.next()) * 0.88
    const u = Math.cos(a) * d, v = Math.sin(a) * d
    if (list.some((p) => Math.hypot(p.u - u, p.v - v) < 0.2)) continue
    list.push({ u, v, size: rng.pick([1, 1, 2, 2, 2, 3]) })
  }
  return list
})()

const DROPLETS = [{ u: -0.52, v: -0.3 }, { u: 0.3, v: 0.5 }, { u: -0.18, v: 0.66 }, { u: 0.6, v: -0.45 }]

const ramp = P.smudge.map(hexRgb)
const outline = hexRgb(P.smudgeOutline)
const cache = new Map()

export function bodySprite(rx, ry) {
  const key = `${rx},${ry}`
  if (!cache.has(key)) cache.set(key, buildBody(rx, ry))
  return cache.get(key)
}

function buildBody(rx, ry) {
  const w = Math.ceil(rx) * 2 + 3
  const h = Math.ceil(ry) * 2 + 3
  const cx = (w - 1) / 2, cy = (h - 1) / 2
  const layer = makeLayer(w, h)
  const image = layer.ctx.createImageData(w, h)
  const level = new Int8Array(w * h).fill(-1)
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

  const set = (x, y, rgb) => {
    const o = (y * w + x) * 4
    image.data[o] = rgb[0]; image.data[o + 1] = rgb[1]; image.data[o + 2] = rgb[2]; image.data[o + 3] = 255
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) { set(x, y, outline); continue }
      const nx = (x - cx) / rx, ny = (y - cy) / ry
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      let lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
      if (ny > 0.55 && nz < 0.6) lit += 0.12 // bounce light from the stool
      const l = Math.max(0, Math.min(4, Math.floor(lit * 4.6 + bayer(x, y) - 0.35)))
      level[y * w + x] = l
      set(x, y, ramp[l])
    }
  }

  const levelAt = (x, y) => level[y * w + x]
  for (const pore of PORES) {
    const px = Math.round(cx + pore.u * rx), py = Math.round(cy + pore.v * ry)
    const cells = pore.size === 1 ? [[0, 0]] : pore.size === 2 ? [[0, 0], [1, 0]] : [[0, 0], [1, 0], [-1, 0], [0, -1], [1, -1]]
    if (cells.some(([dx, dy]) => levelAt(px + dx, py + dy) < 0 || levelAt(px + dx, py + dy + 1) < 0)) continue
    const base = levelAt(px, py)
    for (const [dx, dy] of cells) set(px + dx, py + dy, ramp[Math.max(0, base - 2)])
    const lipCells = pore.size === 1 ? [[0, 1]] : [[0, 1], [1, 1]]
    for (const [dx, dy] of lipCells) if (levelAt(px + dx, py + dy) >= 0) set(px + dx, py + dy, ramp[Math.min(4, base + 1)])
  }

  for (const d of DROPLETS) {
    const px = Math.round(cx + d.u * rx), py = Math.round(cy + d.v * ry)
    if (levelAt(px, py) < 0 || levelAt(px, py + 1) < 0) continue
    set(px, py, [255, 255, 255])
    set(px, py + 1, [196, 230, 246])
  }

  layer.ctx.putImageData(image, 0, 0)
  return { canvas: layer.canvas, cx, cy }
}
