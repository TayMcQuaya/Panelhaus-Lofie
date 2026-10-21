// Pixel primitives. Everything snaps to whole pixels so nothing blurs or shimmers.

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x, y) => BAYER4[((y & 3) << 2) | (x & 3)]

export function px(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function linePoints(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const points = []
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    points.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
  return points
}

export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color
  for (const [x, y] of linePoints(x0, y0, x1, y1)) ctx.fillRect(x, y, 1, 1)
}

const discRowCache = new Map()
function discRows(r) {
  if (discRowCache.has(r)) return discRowCache.get(r)
  const rows = []
  const reach = Math.floor(r)
  for (let dy = -reach; dy <= reach; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy))
    rows.push({ dy, x0: -half, w: half * 2 + 1 })
  }
  discRowCache.set(r, rows)
  return rows
}

export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color
  const x = Math.round(cx), y = Math.round(cy)
  for (const row of discRows(r)) ctx.fillRect(x + row.x0, y + row.dy, row.w, 1)
}

// A line drawn with a round brush; used for limbs, lamp arms, stems.
export function thickLine(ctx, x0, y0, x1, y1, r, color) {
  ctx.fillStyle = color
  const rows = discRows(r)
  for (const [x, y] of linePoints(x0, y0, x1, y1)) {
    for (const row of rows) ctx.fillRect(x + row.x0, y + row.dy, row.w, 1)
  }
}

export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))))
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1)
  }
}

// Sphere-lit ellipse with ordered dithering between ramp steps and a 1px outline.
export function shadedEllipse(ctx, cx, cy, rx, ry, ramp, outline, light = [-0.45, -0.6, 0.66]) {
  const ox = Math.round(cx), oy = Math.round(cy)
  const inside = (x, y) => (x / rx) ** 2 + (y / ry) ** 2 <= 1
  const xr = Math.ceil(rx), yr = Math.ceil(ry)
  for (let y = -yr; y <= yr; y++) {
    for (let x = -xr; x <= xr; x++) {
      if (!inside(x, y)) continue
      const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)
      if (edge && outline) { px(ctx, ox + x, oy + y, outline); continue }
      const nx = x / rx, ny = y / ry
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const lit = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2])
      const level = Math.min(ramp.length - 1, Math.floor(lit * (ramp.length - 0.2) + bayer(ox + x, oy + y) - 0.5))
      px(ctx, ox + x, oy + y, ramp[Math.max(0, level)])
    }
  }
}

// Convex polygon fill by scanline.
export function fillPoly(ctx, points, color) {
  ctx.fillStyle = color
  const ys = points.map((p) => p[1])
  const top = Math.floor(Math.min(...ys)), bottom = Math.ceil(Math.max(...ys))
  for (let y = top; y <= bottom; y++) {
    const sy = y + 0.5
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i]
      const [bx, by] = points[(i + 1) % points.length]
      if ((sy < ay) === (sy < by)) continue
      const x = ax + ((sy - ay) / (by - ay)) * (bx - ax)
      lo = Math.min(lo, x); hi = Math.max(hi, x)
    }
    if (hi >= lo) ctx.fillRect(Math.round(lo), y, Math.round(hi) - Math.round(lo) + 1, 1)
  }
}

// Ordered-dither blend of two colours over a rect: ratio 0 → all a, 1 → all b.
export function ditherRect(ctx, x, y, w, h, colorA, colorB, ratio) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      px(ctx, x + i, y + j, bayer(x + i, y + j) < ratio ? colorB : colorA)
    }
  }
}

// Vertical gradient through a list of colours, dithered between neighbours.
export function ditherGradient(ctx, x, y, w, h, colors) {
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * (colors.length - 1)
    const i0 = Math.min(colors.length - 2, Math.floor(t))
    const f = t - i0
    for (let i = 0; i < w; i++) {
      px(ctx, x + i, y + j, bayer(x + i, y + j) < f ? colors[i0 + 1] : colors[i0])
    }
  }
}

export function drawSprite(ctx, rows, colors, x, y, flipX = false) {
  const width = rows[0].length
  rows.forEach((row, j) => {
    for (let i = 0; i < width; i++) {
      const key = row[flipX ? width - 1 - i : i]
      if (key === '.' || !colors[key]) continue
      px(ctx, x + i, y + j, colors[key])
    }
  })
}

const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '#': ['#.#', '###', '#.#', '###', '#.#'], "'": ['#', '#', '.', '.', '.'],
  '!': ['#', '#', '#', '.', '#'], ' ': ['.', '.', '.', '.', '.'],
}

export function textWidth(str) {
  return [...str].reduce((w, ch) => w + (GLYPHS[ch] ?? GLYPHS[' '])[0].length + 1, -1)
}

export function text3x5(ctx, str, x, y, color) {
  ctx.fillStyle = color
  let cursor = Math.round(x)
  for (const ch of str) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' ']
    glyph.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(cursor + i, Math.round(y) + j, 1, 1)
    })
    cursor += glyph[0].length + 1
  }
}
