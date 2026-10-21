// The workshop's still parts, painted once into a cached layer behind Smudge (we see him from
// behind, so the desk and drafting board are all further back than he is), plus the room shell.
import { makeLayer, W, H } from '../engine/canvas.js'
import { bayer, disc, ditherGradient, ditherRect, ellipse, fillPoly, line, px, rect, shadedEllipse, text3x5, textWidth, thickLine } from '../engine/draw.js'
import { P } from '../engine/palette.js'
import { createRng } from '../engine/rng.js'
import { BOARD, CABINET, CLOCK, CORK, CRATE, DESK, FLOOR_Y, GLASS, INK_JAR, LAMP, LAVA, PANES, POSTER, RECORD, SHELF, SILL_Y, STOOL } from './layout.js'

const mod = (n, m) => ((n % m) + m) % m

// The room shell (ceiling, wall, wainscot, floor) takes a horizontal range and extra height so the
// same drawing can continue past the 480x270 frame on screens that aren't 16:9.
function drawCeiling(ctx, x0 = 0, x1 = W, top = 0) {
  rect(ctx, x0, top, x1 - x0, 7 - top, P.ceiling[0])
  for (let y = 6 - 9; y > top; y -= 9) rect(ctx, x0, y, x1 - x0, 1, P.ceiling[1])
  rect(ctx, x0, 6, x1 - x0, 1, P.ceiling[1])
  rect(ctx, x0, 7, x1 - x0, 2, P.wood[2])
  rect(ctx, x0, 9, x1 - x0, 1, P.wood[0])
}

function drawWall(ctx, x0 = 0, x1 = W) {
  for (let y = 10; y < 150; y++) {
    for (let x = x0; x < x1; x++) {
      const m = mod(x, 12)
      let color = m < 6 ? P.wall[2] : P.wall[1]
      const motif = (m === 9 && y % 14 === 7) || ((m === 8 || m === 10) && y % 14 === 8) || (m === 9 && y % 14 === 9)
      if (motif) color = P.wall[3]
      if (y < 16 && bayer(mod(x, 4), y) < (16 - y) / 7) color = P.wall[0]
      px(ctx, x, y, color)
    }
  }
}

function drawWainscot(ctx, from = 0, to = W) {
  rect(ctx, from, 150, to - from, 76, P.wood[1])
  rect(ctx, from, 150, to - from, 1, P.wood[4])
  rect(ctx, from, 151, to - from, 2, P.wood[3])
  rect(ctx, from, 153, to - from, 1, P.wood[0])
  for (let x0 = -6 + Math.floor((from + 6) / 40) * 40 - 40; x0 < to; x0 += 40) {
    const x = x0 + 5, y = 159, w = 30, h = 60
    rect(ctx, x, y, w, 1, P.wood[0])
    rect(ctx, x, y, 1, h, P.wood[0])
    rect(ctx, x, y + h, w + 1, 1, P.wood[3])
    rect(ctx, x + w, y, 1, h, P.wood[3])
    rect(ctx, x + 1, y + 1, w - 1, h - 1, P.wood[2])
    for (let i = 0; i < 5; i++) {
      const gx = x + 4 + i * 6
      for (let gy = y + 3; gy < y + h - 2; gy++) if (bayer(mod(gx, 4), gy) < 0.45) px(ctx, gx + ((gy >> 3) & 1), gy, P.wood[1])
    }
  }
  rect(ctx, from, 225, to - from, 7, P.wood[0])
  rect(ctx, from, 225, to - from, 1, P.wood[3])
  rect(ctx, from, 226, to - from, 1, P.wood[2])
}

// Plank rows get taller toward the viewer, which is what makes the floor read as receding.
function drawFloor(ctx, rng, x0 = 0, x1 = W, bottom = H) {
  let y = FLOOR_Y
  for (let r = 0; y < bottom; r++) {
    const height = 4 + r
    rect(ctx, x0, y, x1 - x0, height, r % 2 ? P.floor[1] : P.floor[2])
    rect(ctx, x0, y, x1 - x0, 1, P.floor[0])
    let x = x0 + rng.int(-30, 0)
    while (x < x1) {
      rect(ctx, x, y, 1, height, P.floor[0])
      px(ctx, x + 1, y + 1, P.floor[3])
      x += rng.int(38, 70)
    }
    for (let i = 0; i < (x1 - x0) / 12; i++) px(ctx, rng.int(x0, x1), y + rng.int(1, height - 1), P.floor[r % 2 ? 0 : 1])
    y += height
  }
  ditherRect(ctx, x0, FLOOR_Y, x1 - x0, 3, P.floor[1], P.floor[0], 0.5)
}

function drawRug(ctx) {
  const top = 237, bottom = 258
  const leftTop = 146, rightTop = 300, leftBottom = 128, rightBottom = 318
  fillPoly(ctx, [[leftTop, top], [rightTop, top], [rightBottom, bottom], [leftBottom, bottom]], P.rug[0])
  fillPoly(ctx, [[leftTop + 2, top + 1], [rightTop - 2, top + 1], [rightBottom - 3, bottom - 1], [leftBottom + 3, bottom - 1]], P.rug[1])
  fillPoly(ctx, [[leftTop + 7, top + 4], [rightTop - 7, top + 4], [rightBottom - 10, bottom - 4], [leftBottom + 10, bottom - 4]], P.rug[2])
  fillPoly(ctx, [[leftTop + 10, top + 6], [rightTop - 10, top + 6], [rightBottom - 14, bottom - 6], [leftBottom + 14, bottom - 6]], P.rug[3])
  const midY = (top + bottom) / 2
  for (let x = 160; x < 290; x += 14) {
    fillPoly(ctx, [[x, midY - 4], [x + 5, midY], [x, midY + 4], [x - 5, midY]], P.rug[4])
    px(ctx, x, midY, P.rug[2])
  }
  for (let y = top + 1; y < bottom; y += 2) {
    const t = (y - top) / (bottom - top)
    px(ctx, Math.round(leftTop + (leftBottom - leftTop) * t) - 2, y, P.rug[2])
    px(ctx, Math.round(rightTop + (rightBottom - rightTop) * t) + 2, y, P.rug[2])
  }
}

function drawWindow(ctx) {
  rect(ctx, 100, 30, 156, 108, P.frame[2])
  rect(ctx, 100, 30, 156, 1, P.frame[3])
  rect(ctx, 100, 30, 1, 108, P.frame[3])
  rect(ctx, 255, 30, 1, 108, P.frame[1])
  rect(ctx, GLASS.x - 1, GLASS.y - 1, GLASS.w + 2, GLASS.h + 1, P.frame[0])
  rect(ctx, 176, GLASS.y, 4, GLASS.h, P.frame[2])
  rect(ctx, 176, GLASS.y, 1, GLASS.h, P.frame[3])
  rect(ctx, 179, GLASS.y, 1, GLASS.h, P.frame[1])
  rect(ctx, GLASS.x, 85, GLASS.w, 4, P.frame[2])
  rect(ctx, GLASS.x, 85, GLASS.w, 1, P.frame[3])
  rect(ctx, GLASS.x, 88, GLASS.w, 1, P.frame[1])
  for (const p of PANES) ctx.clearRect(p.x, p.y, p.w, p.h)

  rect(ctx, 96, SILL_Y, 164, 4, P.frame[2])
  rect(ctx, 96, SILL_Y, 164, 1, P.frame[3])
  rect(ctx, 96, SILL_Y + 3, 164, 1, P.frame[1])
  rect(ctx, 102, SILL_Y + 4, 152, 5, P.frame[1])
  rect(ctx, 102, SILL_Y + 8, 152, 1, P.frame[0])
  ditherRect(ctx, 102, SILL_Y + 9, 152, 2, P.wall[1], P.wall[0], 0.6)
}

function drawCurtain(ctx, anchorX, dir) {
  const top = 28, tieY = 102, bottom = 152
  for (let y = top; y <= bottom; y++) {
    const width = y < tieY ? Math.round(20 - (y - top) * (11 / (tieY - top))) : Math.round(9 + (y - tieY) * (8 / (bottom - tieY)))
    for (let i = 0; i < width; i++) {
      const x = anchorX + dir * i
      const fold = Math.sin((i / width) * Math.PI * 3 + (y < tieY ? 0 : 0.6))
      let shade = fold > 0.55 ? 3 : fold > 0 ? 2 : fold > -0.6 ? 1 : 0
      if (i === width - 1) shade = 0
      if (y === bottom) shade = 0
      px(ctx, x, y, P.curtain[shade])
    }
  }
  rect(ctx, dir > 0 ? anchorX : anchorX - 10, tieY - 1, 11, 3, P.mustard[1])
  rect(ctx, dir > 0 ? anchorX : anchorX - 10, tieY - 1, 11, 1, P.mustard[2])
}

function drawCurtainRod(ctx) {
  rect(ctx, 86, 25, 184, 2, P.brass[1])
  rect(ctx, 86, 25, 184, 1, P.brass[2])
  disc(ctx, 85, 26, 2, P.brass[1])
  disc(ctx, 271, 26, 2, P.brass[1])
  for (let x = 90; x < 268; x += 6) px(ctx, x, 27, P.brass[0])
}

function drawBook(ctx, x, bottom, w, h, color, rng) {
  rect(ctx, x, bottom - h, w, h, color)
  rect(ctx, x, bottom - h, 1, h, 'rgba(255,255,255,0.18)')
  rect(ctx, x + w - 1, bottom - h, 1, h, 'rgba(0,0,0,0.28)')
  rect(ctx, x, bottom - h, w, 1, 'rgba(255,255,255,0.22)')
  if (rng.chance(0.6)) rect(ctx, x, bottom - h + 3, w, 1, P.brass[2])
  if (rng.chance(0.4)) rect(ctx, x, bottom - 4, w, 1, 'rgba(0,0,0,0.3)')
}

function drawBookRow(ctx, rng, x0, x1, bottom, maxH) {
  let x = x0
  while (x < x1) {
    const w = rng.int(3, 5)
    if (x + w > x1) break
    drawBook(ctx, x, bottom, w, rng.int(maxH - 9, maxH), rng.pick(P.bookColors), rng)
    x += w
  }
  return x
}

function drawComicStack(ctx, rng, x, bottom, count) {
  for (let i = 0; i < count; i++) {
    const offset = rng.int(-1, 1)
    rect(ctx, x + offset, bottom - 2 - i * 2, 18, 2, rng.pick(['#e2d4b4', '#c94a4a', '#ffd84a', '#4e7a8a', '#efe6d0']))
    px(ctx, x + offset + 17, bottom - 2 - i * 2, 'rgba(0,0,0,0.3)')
  }
}

function drawJar(ctx, x, bottom, color) {
  rect(ctx, x, bottom - 7, 5, 7, P.outline)
  rect(ctx, x + 1, bottom - 6, 3, 5, color)
  rect(ctx, x + 1, bottom - 9, 3, 2, P.metal[2])
  px(ctx, x + 1, bottom - 5, 'rgba(255,255,255,0.5)')
}

function drawShelf(ctx, rng) {
  const { x, y, w } = SHELF
  const bottom = FLOOR_Y
  rect(ctx, x + 3, y + 4, w - 6, bottom - y - 4, P.wood[0])
  for (let gx = x + 6; gx < x + w - 4; gx += 8) for (let gy = y + 6; gy < bottom; gy += 2) if (bayer(gx, gy) < 0.3) px(ctx, gx, gy, P.ceiling[1])
  rect(ctx, x, y, 4, bottom - y, P.wood[2])
  rect(ctx, x, y, 1, bottom - y, P.wood[4])
  rect(ctx, x + w - 4, y, 4, bottom - y, P.wood[2])
  rect(ctx, x + w - 1, y, 1, bottom - y, P.wood[1])
  rect(ctx, x - 2, y - 2, w + 4, 4, P.wood[3])
  rect(ctx, x - 2, y - 2, w + 4, 1, P.wood[4])
  rect(ctx, x - 2, y + 2, w + 4, 1, P.wood[0])

  const shelves = [84, 118, 152, 188]
  for (const sy of shelves) {
    rect(ctx, x + 4, sy, w - 8, 3, P.wood[3])
    rect(ctx, x + 4, sy, w - 8, 1, P.wood[4])
    rect(ctx, x + 4, sy + 3, w - 8, 1, P.ceiling[0])
  }
  rect(ctx, x + 4, 224, w - 8, 8, P.wood[2])
  rect(ctx, x + 4, 224, w - 8, 1, P.wood[4])

  const inner0 = x + 5, inner1 = x + w - 5
  // top compartment: books + a leaning book
  const after = drawBookRow(ctx, rng, inner0, inner0 + 34, 84, 27)
  line(ctx, after + 1, 83, after + 6, 62, P.bookColors[1])
  line(ctx, after + 2, 83, after + 7, 62, P.bookColors[1])
  drawComicStack(ctx, rng, inner1 - 19, 84, 5)
  // comic long boxes
  ;['COMICS', 'INK'].forEach((label, i) => {
    const bw = 27, bx = inner0 + i * (bw + 2)
    rect(ctx, bx, 101, bw, 17, P.white)
    rect(ctx, bx, 101, bw, 1, '#ffffff')
    rect(ctx, bx, 117, bw, 1, P.paperShade)
    rect(ctx, bx + bw - 1, 101, 1, 17, P.paperShade)
    rect(ctx, bx + 2, 104, bw - 4, 9, '#e9dfc8')
    text3x5(ctx, label, bx + Math.floor((bw - textWidth(label)) / 2), 106, P.ink)
  })
  // books + figurine
  drawBookRow(ctx, rng, inner0, inner0 + 30, 152, 29)
  rect(ctx, x + 47, 131, 15, 21, 'rgba(180,220,255,0.18)')
  rect(ctx, x + 47, 131, 15, 1, 'rgba(220,240,255,0.55)')
  rect(ctx, x + 47, 131, 1, 21, 'rgba(220,240,255,0.4)')
  rect(ctx, x + 61, 131, 1, 21, 'rgba(220,240,255,0.25)')
  rect(ctx, x + 46, 149, 17, 3, P.navyCab[2])
  shadedEllipse(ctx, x + 54, 141, 4.5, 4.5, P.smudge.slice(1), P.smudgeOutline)
  px(ctx, x + 55, 140, P.outline); px(ctx, x + 57, 140, P.outline)
  px(ctx, x + 51, 147, P.boot.b); px(ctx, x + 56, 147, P.boot.b)
  line(ctx, x + 52, 145, x + 52, 147, P.smudge[2]); line(ctx, x + 56, 145, x + 56, 147, P.smudge[2])
  // ink jars + brush cup
  const jarColors = ['#1b2240', '#c94a4a', '#ffd84a', '#4ee6d0', '#6b4a7a', '#1b2240']
  jarColors.forEach((c, i) => drawJar(ctx, inner0 + i * 6, 188, c))
  rect(ctx, inner1 - 12, 178, 9, 10, P.pot[2])
  rect(ctx, inner1 - 12, 178, 9, 1, P.pot[3])
  for (let i = 0; i < 4; i++) line(ctx, inner1 - 10 + i * 2, 177, inner1 - 12 + i * 3, 165 + i, i % 2 ? P.birch[3] : P.wood[3])
  // bottom: big art books lying down + basket
  for (let i = 0; i < 4; i++) rect(ctx, inner0, 222 - i * 4, 26 - i * 2, 4, P.bookColors[(i * 3) % P.bookColors.length])
  rect(ctx, inner0 + 30, 206, 22, 18, P.mustard[1])
  for (let by = 207; by < 224; by += 3) rect(ctx, inner0 + 30, by, 22, 1, P.mustard[0])
  for (let bx = inner0 + 31; bx < inner0 + 52; bx += 4) rect(ctx, bx, 206, 1, 18, P.mustard[2])

  // top of the shelf: plant and a little stack
  rect(ctx, x + 6, y - 9, 9, 7, P.pot[2])
  rect(ctx, x + 6, y - 9, 9, 1, P.pot[3])
  for (const [lx, ly] of [[x + 8, y - 13], [x + 12, y - 15], [x + 4, y - 11], [x + 15, y - 11]]) ellipse(ctx, lx, ly, 2.5, 1.5, P.leaf[2])
  for (let i = 0; i < 9; i++) px(ctx, x + 3 - (i > 4 ? 1 : 0), y - 4 + i * 2, P.leaf[1 + (i % 2)])
  drawComicStack(ctx, rng, x + 30, y - 2, 3)
}

function drawHangingPlant(ctx) {
  line(ctx, 92, 10, 88, 33, P.birch[2])
  line(ctx, 92, 10, 97, 33, P.birch[2])
  rect(ctx, 85, 33, 15, 7, P.pot[2])
  rect(ctx, 85, 33, 15, 1, P.pot[3])
  rect(ctx, 86, 39, 13, 1, P.pot[0])
  const vines = [[86, 0.8, 70], [91, -0.6, 92], [97, 0.5, 60], [99, -0.9, 45]]
  for (const [startX, sway, length] of vines) {
    for (let i = 0; i < length; i += 4) {
      const vx = Math.round(startX + Math.sin(i / 12) * sway * 3)
      const vy = 40 + i
      px(ctx, vx, vy, P.leaf[1])
      px(ctx, vx, vy + 1, P.leaf[1])
      const side = (i / 4) % 2 ? 1 : -1
      ellipse(ctx, vx + side * 2, vy + 2, 1.5, 1, P.leaf[(i / 4) % 3 === 0 ? 3 : 2])
    }
  }
}

function drawCorkboard(ctx, rng) {
  const { x, y, w, h } = CORK
  rect(ctx, x, y, w, h, P.wood[2])
  rect(ctx, x, y, w, 1, P.wood[4])
  rect(ctx, x, y + h - 1, w, 1, P.wood[0])
  for (let j = 3; j < h - 3; j++) {
    for (let i = 3; i < w - 3; i++) {
      const n = rng.next()
      px(ctx, x + i, y + j, n < 0.15 ? P.cork[0] : n < 0.55 ? P.cork[1] : n < 0.9 ? P.cork[2] : P.cork[3])
    }
  }
  // a sticky note and a reference sketch of Smudge
  rect(ctx, x + w - 15, y + 5, 10, 10, '#ffe27a')
  rect(ctx, x + w - 15, y + 5, 10, 2, '#f5cc4a')
  line(ctx, x + w - 13, y + 9, x + w - 8, y + 9, '#8a6a3a')
  line(ctx, x + w - 13, y + 11, x + w - 9, y + 11, '#8a6a3a')
}

function drawPoster(ctx) {
  const { x, y, w, h } = POSTER
  rect(ctx, x - 1, y - 1, w + 2, h + 2, P.outline)
  ditherGradient(ctx, x, y, w, h, ['#3b2c6b', '#2a2150', '#1d173a'])
  for (const [sx, sy] of [[x + 4, y + 25], [x + 42, y + 28], [x + 39, y + 52], [x + 6, y + 50], [x + 24, y + 26]]) px(ctx, sx, sy, '#fff4d6')
  const centred = (text) => x + Math.round((w - textWidth(text)) / 2)
  // Title block: SMUDGE / AND THE / SMUDGIES, like the comic's cover
  text3x5(ctx, 'SMUDGE', centred('SMUDGE') + 1, y + 4, '#ff5fa2')
  text3x5(ctx, 'SMUDGE', centred('SMUDGE'), y + 3, '#ffd84a')
  for (const [dx, len] of [[2, 3], [9, 4], [17, 2], [21, 3]]) rect(ctx, centred('SMUDGE') + dx, y + 8, 1, len, '#ffd84a')
  text3x5(ctx, 'AND THE', centred('AND THE'), y + 12, '#efe6d0')
  text3x5(ctx, 'SMUDGIES', centred('SMUDGIES') + 1, y + 19, P.outline)
  text3x5(ctx, 'SMUDGIES', centred('SMUDGIES'), y + 18, '#6ee6d2')
  // Cover art: Smudge flanked by two Smudgies (the inky blobs from the game)
  const cx = x + 24, cy = y + 41
  for (const side of [-1, 1]) {
    const bx = cx + side * 15, by = cy + 7
    shadedEllipse(ctx, bx, by, 5, 4, ['#1d1530', '#2c2245', '#3d3160'], '#0e0a18')
    px(ctx, bx - 2, by - 1, '#ff4a4a'); px(ctx, bx + 1, by - 1, '#ff4a4a')
    rect(ctx, bx - 2, by + 1, 4, 1, '#efe6d0')
    rect(ctx, bx - 3 + side, by + 4, 1, 2, '#2c2245')
  }
  shadedEllipse(ctx, cx, cy, 10, 10, P.smudge, P.smudgeOutline)
  for (const [ox, oy] of [[-5, -5], [5, 3], [-6, 3], [2, -7], [6, -3], [-2, 6]]) px(ctx, cx + ox, cy + oy, P.smudge[1])
  rect(ctx, cx - 4, cy - 4, 2, 3, P.outline)
  rect(ctx, cx + 2, cy - 4, 2, 3, P.outline)
  px(ctx, cx - 4, cy - 4, P.eyeShine); px(ctx, cx + 2, cy - 4, P.eyeShine)
  rect(ctx, cx - 3, cy + 2, 7, 1, P.mouth)
  rect(ctx, cx - 2, cy + 3, 5, 1, P.mouth)
  rect(ctx, cx - 1, cy + 3, 3, 1, P.tongue)
  // Issue number and price box
  rect(ctx, x + 2, y + h - 9, 11, 8, '#ffd84a')
  text3x5(ctx, '#1', x + 4, y + h - 8, P.outline)
  rect(ctx, x + w - 14, y + h - 7, 12, 5, '#ff5fa2')
  text3x5(ctx, '25', x + w - 11, y + h - 7, '#fff4d6')
  ctx.globalAlpha = 0.55
  rect(ctx, x - 2, y - 2, 6, 3, '#efe6d0')
  rect(ctx, x + w - 4, y - 2, 6, 3, '#efe6d0')
  ctx.globalAlpha = 1
}

function drawClockFace(ctx) {
  disc(ctx, CLOCK.x, CLOCK.y + 1, 11.5, P.ceiling[0])
  disc(ctx, CLOCK.x, CLOCK.y, 11.5, P.wood[3])
  disc(ctx, CLOCK.x, CLOCK.y, 9.5, P.frame[3])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    px(ctx, CLOCK.x + Math.round(Math.sin(a) * 8), CLOCK.y - Math.round(Math.cos(a) * 8), i % 3 === 0 ? P.outline : P.frame[0])
  }
}

function drawCabinet(ctx) {
  const { x, y, w, h } = CABINET
  rect(ctx, x, y + 3, w, h - 6, P.navyCab[1])
  rect(ctx, x - 2, y, w + 4, 3, P.navyCab[3])
  rect(ctx, x - 2, y, w + 4, 1, '#5a6d96')
  rect(ctx, x - 2, y + 3, w + 4, 1, P.navyCab[0])
  for (const dx of [3, w / 2 + 1]) {
    const dw = w / 2 - 4
    rect(ctx, x + dx, y + 7, dw, h - 14, P.navyCab[2])
    rect(ctx, x + dx, y + 7, dw, 1, P.navyCab[3])
    rect(ctx, x + dx, y + h - 8, dw, 1, P.navyCab[0])
    rect(ctx, x + dx + 3, y + 10, dw - 6, h - 20, P.navyCab[1])
  }
  rect(ctx, x + w / 2 - 3, y + 18, 2, 2, P.brass[2])
  rect(ctx, x + w / 2 + 2, y + 18, 2, 2, P.brass[2])
  rect(ctx, x + 2, y + h - 3, 3, 3, P.navyCab[0])
  rect(ctx, x + w - 5, y + h - 3, 3, 3, P.navyCab[0])

  // record player base, record sleeves and a succulent on top
  const rx = RECORD.x - 16
  rect(ctx, rx, 186, 36, 8, P.wood[3])
  rect(ctx, rx, 186, 36, 1, P.wood[4])
  rect(ctx, rx, 193, 36, 1, P.wood[1])
  rect(ctx, rx + 3, 190, 3, 2, P.metal[2])
  rect(ctx, rx + 30, 190, 3, 2, P.metal[2])
  const sleeves = ['#c94a4a', '#ffd84a', '#4e7a8a', '#efe6d0', '#6b4a7a']
  sleeves.forEach((c, i) => {
    rect(ctx, rx + 41 + i * 3, 177 + (i % 2), 14, 17 - (i % 2), c)
    rect(ctx, rx + 41 + i * 3, 177 + (i % 2), 1, 17 - (i % 2), 'rgba(0,0,0,0.25)')
  })
  drawLavaLampShell(ctx)
}

// The lava lamp's metal base and cap; the glowing glass is drawn live in props.
function drawLavaLampShell(ctx) {
  const { x, baseY, glassTop } = LAVA
  fillPoly(ctx, [[x - 3, baseY - 8], [x + 3, baseY - 8], [x + 5, baseY], [x - 5, baseY]], '#4a2c4e')
  line(ctx, x - 3, baseY - 8, x + 3, baseY - 8, '#8a5a8a')
  line(ctx, x - 4, baseY - 4, x + 4, baseY - 4, '#3a2040')
  rect(ctx, x - 1, glassTop - 3, 3, 3, '#4a2c4e')
  px(ctx, x - 1, glassTop - 3, '#8a5a8a')
}

function drawMonstera(ctx) {
  rect(ctx, 446, 208, 22, 24, P.pot[2])
  rect(ctx, 444, 206, 26, 4, P.pot[3])
  rect(ctx, 446, 210, 22, 1, P.pot[0])
  rect(ctx, 466, 210, 2, 22, P.pot[1])
  const leaves = [[438, 172, 11, 7], [460, 158, 10, 7], [468, 186, 9, 6], [444, 192, 9, 6], [452, 176, 8, 6], [470, 168, 7, 6]]
  for (const [lx, ly] of leaves) line(ctx, 457, 206, lx, ly + 3, P.leaf[1])
  for (const [lx, ly, rx, ry] of leaves) {
    shadedEllipse(ctx, lx, ly, rx, ry, P.leaf.slice(1), P.leaf[0])
    for (let i = -rx + 3; i < rx - 2; i += 4) line(ctx, lx + i, ly + ry - 1, lx + i + 1, ly + 1, P.leaf[0])
    line(ctx, lx - rx + 2, ly, lx + rx - 2, ly - 1, P.leaf[1])
  }
}

// Soft contact shadow so furniture sits on the rug instead of floating against the wall.
function contactShadow(ctx, cx, y, rx) {
  ctx.globalAlpha = 0.28
  ellipse(ctx, cx, y + 1, rx, 1.6, '#120a10')
  ctx.globalAlpha = 0.18
  ellipse(ctx, cx, y + 1, rx + 4, 2.4, '#120a10')
  ctx.globalAlpha = 1
}

// A round wooden stool seen from behind: four splayed legs (the far pair shorter, further back),
// a foot ring, and a dished seat whose top surface shows because we look slightly down on it.
function drawStool(ctx) {
  const { x, w, seatY, ringY, footY } = STOOL
  const cx = x + w / 2
  contactShadow(ctx, cx, footY, w / 2 + 6)
  thickLine(ctx, cx - 7, seatY + 4, cx - 10, footY - 6, 1, P.wood[1])
  thickLine(ctx, cx + 7, seatY + 4, cx + 10, footY - 6, 1, P.wood[1])
  rect(ctx, cx - 11, ringY, 22, 2, P.metal[1])
  thickLine(ctx, x + 3, seatY + 4, x - 3, footY, 1, P.wood[2])
  thickLine(ctx, x + w - 3, seatY + 4, x + w + 3, footY, 1, P.wood[2])
  line(ctx, x + 3, seatY + 4, x - 3, footY, P.wood[3])
  line(ctx, x + w - 4, seatY + 4, x + w + 2, footY, P.wood[3])
  rect(ctx, x - 1, ringY + 2, w + 2, 2, P.metal[2])
  rect(ctx, x - 1, ringY + 2, w + 2, 1, P.metal[3])
  ellipse(ctx, cx, seatY + 3, w / 2 + 1, 2.5, P.wood[1])
  ellipse(ctx, cx, seatY + 1, w / 2, 2.5, P.wood[3])
  ellipse(ctx, cx, seatY + 1, w / 2 - 3, 1.5, P.wood[4])
}

// The desk against the wall, with the tilted drafting board, ink, paper and a clamp lamp on it.
function drawDesk(ctx) {
  const { x, w, backY, frontY, apronY, footY } = DESK
  for (const lx of [x + 3, x + w - 5]) rect(ctx, lx, apronY, 2, FLOOR_Y - apronY, P.wood[0])
  contactShadow(ctx, x + 2, footY, 5)
  contactShadow(ctx, x + w - 2, footY, 5)
  fillPoly(ctx, [[x, backY], [x + w, backY], [x + w + 2, frontY], [x - 2, frontY]], P.wood[3])
  for (let gy = backY + 1; gy < frontY; gy += 2) rect(ctx, x + 6, gy, w - 12, 1, 'rgba(255,240,210,0.07)')
  rect(ctx, x - 2, frontY, w + 4, 1, P.wood[4])
  rect(ctx, x - 2, frontY + 1, w + 4, apronY - frontY - 1, P.wood[2])
  rect(ctx, x - 2, apronY, w + 4, 1, P.wood[0])
  for (const [dx, dw] of [[8, 44], [w - 52, 44]]) {
    rect(ctx, x + dx, frontY + 2, dw, apronY - frontY - 3, P.wood[1])
    rect(ctx, x + dx + dw / 2 - 2, frontY + 3, 4, 1, P.brass[2])
  }
  for (const lx of [x - 2, x + w - 2]) {
    rect(ctx, lx, apronY, 4, footY - apronY, P.wood[2])
    rect(ctx, lx, apronY, 1, footY - apronY, P.wood[4])
    rect(ctx, lx + 3, apronY, 1, footY - apronY, P.wood[0])
  }

  // drafting board leaning back on the desk, its shadow on the wall and desk
  const [tl, tr, br, bl] = BOARD
  ctx.globalAlpha = 0.35
  fillPoly(ctx, [[tl[0] + 3, tl[1] - 2], [tr[0] + 3, tr[1] - 2], [br[0] + 3, br[1] - 1], [bl[0] + 3, bl[1] - 1]], '#120a10')
  ctx.globalAlpha = 1
  fillPoly(ctx, BOARD, P.birch[2])
  line(ctx, tl[0], tl[1], tr[0], tr[1], P.birch[4])
  line(ctx, tl[0], tl[1], bl[0], bl[1], P.birch[3])
  line(ctx, tr[0], tr[1], br[0], br[1], P.birch[1])
  rect(ctx, bl[0] - 1, bl[1] - 2, br[0] - bl[0] + 3, 3, P.birch[1])
  rect(ctx, bl[0] - 1, bl[1] - 2, br[0] - bl[0] + 3, 1, P.birch[4])
  line(ctx, bl[0] + 6, bl[1] - 3, bl[0] + 12, bl[1] - 3, '#e8823a')
  line(ctx, bl[0] + 15, bl[1] - 3, bl[0] + 20, bl[1] - 3, '#4ea0d8')
  rect(ctx, br[0] - 8, bl[1] - 4, 3, 2, '#ff9aa8')

  // ink jar and a stack of fresh paper
  const { x: jx, y: jy } = INK_JAR
  rect(ctx, jx - 1, jy - 1, 8, 9, P.outline)
  rect(ctx, jx, jy + 1, 6, 6, P.ink)
  rect(ctx, jx, jy + 3, 6, 2, P.paper)
  rect(ctx, jx + 1, jy + 1, 1, 2, P.inkShine)
  rect(ctx, jx, jy - 1, 6, 2, P.metal[2])
  rect(ctx, jx + 1, jy - 1, 4, 1, P.ink)
  for (let i = 0; i < 4; i++) rect(ctx, 272 + (i % 2), frontY - 3 - i, 12, 1, i % 2 ? P.paper : P.paperShade)

  // clamp lamp: round base, two arm segments, a green shade aimed at the page
  ellipse(ctx, LAMP.baseX, LAMP.baseY - 1, 5, 1.5, P.metal[1])
  rect(ctx, LAMP.baseX - 1, LAMP.baseY - 5, 3, 4, P.metal[1])
  thickLine(ctx, LAMP.baseX, LAMP.baseY - 5, LAMP.elbowX, LAMP.elbowY, 0.5, P.metal[2])
  disc(ctx, LAMP.elbowX, LAMP.elbowY, 1.5, P.metal[3])
  thickLine(ctx, LAMP.elbowX, LAMP.elbowY, LAMP.headX + 3, LAMP.headY - 1, 0.5, P.metal[2])
  fillPoly(ctx, [[LAMP.headX - 1, LAMP.headY - 4], [LAMP.headX + 5, LAMP.headY - 2], [LAMP.headX + 3, LAMP.headY + 4], [LAMP.headX - 7, LAMP.headY + 5]], '#2f6d64')
  line(ctx, LAMP.headX - 1, LAMP.headY - 4, LAMP.headX + 5, LAMP.headY - 2, '#5ea89a')
  line(ctx, LAMP.headX - 7, LAMP.headY + 5, LAMP.headX + 3, LAMP.headY + 4, '#1d4842')
}

// A wooden crate of comics beside the stool.
function drawCrate(ctx) {
  const { x, y, w, h } = CRATE
  contactShadow(ctx, x + w / 2, y + h, w / 2 + 3)
  rect(ctx, x, y, w, h, P.wood[1])
  for (let i = 0; i < 3; i++) {
    rect(ctx, x, y + 1 + i * 6, w, 5, P.wood[3])
    rect(ctx, x, y + 1 + i * 6, w, 1, P.wood[4])
  }
  rect(ctx, x, y, 2, h, P.wood[2])
  rect(ctx, x + w - 2, y, 2, h, P.wood[0])
  rect(ctx, x - 1, y - 1, w + 2, 2, P.wood[4])
  rect(ctx, x + 4, y - 4, 13, 3, '#c94a4a')
  rect(ctx, x + 5, y - 6, 12, 2, '#efe6d0')
}

// Waste bin tucked under the desk, crumpled drafts in and around it.
function drawBin(ctx) {
  const bx0 = 262
  rect(ctx, bx0, 214, 15, 18, P.metal[2])
  for (let i = 0; i < 15; i += 3) rect(ctx, bx0 + i, 214, 1, 18, P.metal[1])
  rect(ctx, bx0 - 1, 213, 17, 2, P.metal[3])
  for (const [dx, by] of [[4, 211], [10, 210], [7, 208]]) shadedEllipse(ctx, bx0 + dx, by, 3, 2.5, ['#b8ae98', '#e4dccb', '#fbf6ea'], '#8a826e')
  shadedEllipse(ctx, bx0 + 24, 236, 3, 2.5, ['#b8ae98', '#e4dccb', '#fbf6ea'], '#8a826e')
}

function drawFairyWire(ctx, hooks) {
  for (let i = 0; i < hooks.length - 1; i++) {
    const [ax, ay] = hooks[i], [bx, by] = hooks[i + 1]
    let prev = null
    for (let x = ax; x <= bx; x++) {
      const t = (x - ax) / (bx - ax)
      const y = Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 7)
      if (prev && Math.abs(prev - y) > 1) line(ctx, x - 1, prev, x, y, P.ceiling[1])
      else px(ctx, x, y, P.ceiling[1])
      prev = y
    }
  }
}

export const FAIRY_HOOKS = [[88, 17], [150, 19], [210, 17], [268, 19], [334, 16], [404, 19], [470, 16]]

export function fairyBulbs() {
  const bulbs = []
  const colors = ['#ffcf6b', '#ff7aa8', '#7ee8d6', '#fff2c4', '#ffa65a']
  for (let i = 0; i < FAIRY_HOOKS.length - 1; i++) {
    const [ax, ay] = FAIRY_HOOKS[i], [bx, by] = FAIRY_HOOKS[i + 1]
    for (let x = ax + 4; x < bx - 2; x += 8) {
      const t = (x - ax) / (bx - ax)
      bulbs.push({ x, y: Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 7) + 1, color: colors[bulbs.length % colors.length], phase: bulbs.length * 1.7 })
    }
  }
  return bulbs
}

export function createRoom() {
  const back = makeLayer(W, H)
  const rng = createRng(3)
  const ctx = back.ctx
  drawWall(ctx)
  drawCeiling(ctx)
  drawWainscot(ctx)
  drawFloor(ctx, rng)
  drawRug(ctx)
  drawShelf(ctx, rng)
  drawWindow(ctx)
  drawCurtain(ctx, 88, 1)
  drawCurtain(ctx, 268, -1)
  drawCurtainRod(ctx)
  drawHangingPlant(ctx)
  drawCorkboard(ctx, rng)
  drawPoster(ctx)
  drawClockFace(ctx)
  drawCabinet(ctx)
  drawMonstera(ctx)
  drawBin(ctx)
  drawDesk(ctx)
  drawCrate(ctx)
  drawFairyWire(ctx, FAIRY_HOOKS)
  const stool = makeLayer(W, H)
  drawStool(stool.ctx)
  return { back: back.canvas, stool: stool.canvas, shell: createShell() }
}

// The bare room continued in every direction, shown around the 480x270 frame on windows that
// aren't 16:9 so the scene fills the screen without cropping anything.
export const SHELL_MARGIN = { x: 240, y: 140 }

function createShell() {
  const { x: mx, y: my } = SHELL_MARGIN
  const layer = makeLayer(W + mx * 2, H + my * 2)
  const ctx = layer.ctx
  const rng = createRng(17)
  ctx.translate(mx, my)
  drawWall(ctx, -mx, W + mx)
  drawCeiling(ctx, -mx, W + mx, -my)
  drawWainscot(ctx, -mx, W + mx)
  drawFloor(ctx, rng, -mx, W + mx, H + my)
  return layer.canvas
}
