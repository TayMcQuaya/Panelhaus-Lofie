// The workshop's still parts, painted once into a cached layer behind Smudge (we see him from
// behind, so the desk and drafting board are all further back than he is), plus the room shell.
import { makeLayer, W, H } from '../engine/canvas.js'
import { bayer, disc, ditherGradient, ditherRect, drawSprite, ellipse, fillPoly, line, px, rect, shadedEllipse, text3x5, textWidth, thickLine } from '../engine/draw.js'
import { P } from '../engine/palette.js'
import { createRng } from '../engine/rng.js'
import { BIN, BOARD, CABINET, CABINET_SURFACE_Y, CLOCK, CORK, CRATE, DESK, FIGURINE, FLOOR_Y, GLASS, INK_JAR, LAMP, LAVA, PANES, POSTER, recede, RECORD, SHELF, SILL_Y, STOOL, VANISH, VIEW_DEPTH } from './layout.js'

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

// Floorboards run from the wall toward the viewer, so their edges converge on the vanishing point
// and widen toward the bottom of the screen. Board ends are short crosswise seams, spaced evenly in
// real depth (which bunches them up near the wall) and staggered from board to board.
const BOARD_W = 11
const PLANK_LEN = 110
const boardHash = (k) => {
  const s = Math.sin(k * 127.1 + 31.7) * 43758.5453
  return s - Math.floor(s)
}

function drawFloor(ctx, rng, x0 = 0, x1 = W, bottom = H) {
  const span = FLOOR_Y - VANISH.y
  const toScreen = (u, scale) => Math.round(VANISH.x + (u - VANISH.x) * scale)
  const plankAt = (k, depth) => Math.floor((depth + boardHash(k) * PLANK_LEN) / PLANK_LEN)
  for (let y = FLOOR_Y; y < bottom; y++) {
    const scale = (y - VANISH.y) / span
    const depthHere = (scale - 1) * VIEW_DEPTH
    const depthAbove = ((y - 1 - VANISH.y) / span - 1) * VIEW_DEPTH
    const first = Math.floor((VANISH.x + (x0 - VANISH.x) / scale) / BOARD_W)
    const last = Math.ceil((VANISH.x + (x1 - VANISH.x) / scale) / BOARD_W)
    for (let k = first; k <= last; k++) {
      const left = toScreen(k * BOARD_W, scale)
      const width = toScreen((k + 1) * BOARD_W, scale) - left
      const plank = plankAt(k, depthHere)
      const seam = y > FLOOR_Y && plank !== plankAt(k, depthAbove)
      const tone = boardHash(k * 7 + plank) < 0.5 ? P.floor[1] : P.floor[2]
      rect(ctx, left, y, width, 1, seam ? P.floor[0] : tone)
      px(ctx, left, y, P.floor[0])
      if (!seam && plank !== plankAt(k, depthAbove - 3)) px(ctx, left + 1, y, P.floor[3])
    }
    for (let i = 0; i < (x1 - x0) / 40; i++) px(ctx, rng.int(x0, x1), y, P.floor[0])
  }
  ditherRect(ctx, x0, FLOOR_Y, x1 - x0, 3, P.floor[1], P.floor[0], 0.5)
}

function drawRug(ctx) {
  const top = 237, bottom = 258
  const leftTop = 146, rightTop = 300
  // The side edges run toward the vanishing point, like the floorboards under the rug.
  const towardViewer = (x) => Math.round(VANISH.x + (x - VANISH.x) * (bottom - VANISH.y) / (top - VANISH.y))
  const leftBottom = towardViewer(leftTop), rightBottom = towardViewer(rightTop)
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

// How deep the bookshelf is, in wall pixels: shallow, so the perspective stays a gentle hint.
const SHELF_DEPTH = 16

// The bookshelf is drawn straight-on, like everything on it, so no side panels: its depth comes from
// shadow inside each compartment, darkest under the board above and along both sides.
function drawShelfDepth(ctx, x, y, w, boards) {
  const x0 = x + 4, x1 = x + w - 4
  const tops = [y + 4, ...boards.slice(0, -1).map((sy) => sy + 3)]
  tops.forEach((top, i) => {
    const floor = boards[i]
    ctx.fillStyle = '#120a10'
    ;[0.4, 0.26, 0.14].forEach((alpha, row) => {
      ctx.globalAlpha = alpha
      ctx.fillRect(x0, top + row, x1 - x0, 1)
    })
    ;[0.3, 0.15].forEach((alpha, col) => {
      ctx.globalAlpha = alpha
      ctx.fillRect(x0 + col, top, 1, floor - top)
      ctx.fillRect(x1 - 1 - col, top, 1, floor - top)
    })
    ctx.globalAlpha = 1
  })
}

// A shelf board: below eye level a strip of its top surface shows, evenly across its width.
function drawShelfBoard(ctx, x0, x1, sy) {
  const backY = Math.round(recede(x0, sy, SHELF_DEPTH)[1])
  if (backY < sy) rect(ctx, x0, backY, x1 - x0, sy - backY, P.wood[3])
  rect(ctx, x0, sy, x1 - x0, 2, P.wood[2])
  rect(ctx, x0, sy, x1 - x0, 1, P.wood[4])
  rect(ctx, x0, sy + 2, x1 - x0, 1, P.ceiling[0])
}

// A small pothos on top of the bookshelf, same outlined leaves as the hanging one, with a vine
// spilling over the left edge of the shelf.
function drawShelfTopPlant(ctx, x, y) {
  const potLeft = x + 6, potTop = y - 10
  rect(ctx, potLeft, potTop + 2, 10, 7, P.pot[2])
  rect(ctx, potLeft + 7, potTop + 2, 3, 7, P.pot[1])
  rect(ctx, potLeft, potTop + 2, 1, 7, P.pot[3])
  rect(ctx, potLeft + 1, potTop + 8, 8, 1, P.pot[0])
  rect(ctx, potLeft - 1, potTop, 12, 2, P.pot[3])
  rect(ctx, potLeft - 1, potTop + 2, 12, 1, P.pot[0])
  // The vine hangs from the pot's left side down past the crown, leaves alternating sides.
  for (let vy = potTop + 4; vy <= y + 24; vy++) px(ctx, Math.round(x + 3 + Math.sin((vy - potTop) / 7) * 1.5), vy, P.leaf[1])
  for (let i = 0, vy = potTop + 7; vy < y + 22; i++, vy += 6) {
    const vx = Math.round(x + 3 + Math.sin((vy - potTop) / 7) * 1.5)
    drawPothosLeaf(ctx, vx + (i % 2 ? 1 : -1), vy - 2, vy > y + 12 ? 0 : 1, i % 2 === 0, false)
  }
  // Crown of leaves above the pot.
  for (const [lx, ly, size, left, back] of [[potLeft + 2, potTop - 4, 2, true, true], [potLeft + 8, potTop - 5, 2, false, true], [potLeft + 4, potTop - 2, 2, true, false], [potLeft + 6, potTop - 3, 1, false, false], [potLeft + 10, potTop, 1, false, false]]) {
    drawPothosLeaf(ctx, lx, ly, size, left, back)
  }
}

function drawShelf(ctx, rng) {
  const { x, y, w } = SHELF
  const bottom = FLOOR_Y
  wallShadow(ctx, x - 2, y - 2, w + 4, bottom - y + 2, -4, -1)
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
  drawShelfDepth(ctx, x, y, w, [...shelves, 224])
  for (const sy of shelves) drawShelfBoard(ctx, x + 4, x + w - 4, sy)
  drawShelfBoard(ctx, x + 4, x + w - 4, 224)
  rect(ctx, x + 4, 226, w - 8, 6, P.wood[2])

  const inner0 = x + 5, inner1 = x + w - 5
  // Things on a shelf below eye level stand a little back from its front edge, on the visible top,
  // with a soft shadow line in front of their feet.
  const onShelf = (sy, drawItems) => {
    const lift = Math.max(0, Math.round((sy - recede(x, sy, SHELF_DEPTH)[1]) * 0.6))
    ctx.save()
    ctx.translate(0, -lift)
    drawItems()
    ctx.restore()
    if (!lift) return
    ctx.globalAlpha = 0.3
    rect(ctx, x + 4, sy - lift, w - 8, 1, '#120a10')
    ctx.globalAlpha = 1
  }
  // top compartment: books + a leaning book
  const after = drawBookRow(ctx, rng, inner0, inner0 + 34, 84, 27)
  line(ctx, after + 1, 83, after + 6, 62, P.bookColors[1])
  line(ctx, after + 2, 83, after + 7, 62, P.bookColors[1])
  drawComicStack(ctx, rng, inner1 - 19, 84, 5)
  // comic long boxes
  onShelf(118, () => ['COMICS', 'INK'].forEach((label, i) => {
    const bw = 27, bx = inner0 + i * (bw + 2)
    rect(ctx, bx, 101, bw, 17, P.white)
    rect(ctx, bx, 101, bw, 1, '#ffffff')
    rect(ctx, bx, 117, bw, 1, P.paperShade)
    rect(ctx, bx + bw - 1, 101, 1, 17, P.paperShade)
    rect(ctx, bx + 2, 104, bw - 4, 9, '#e9dfc8')
    text3x5(ctx, label, bx + Math.floor((bw - textWidth(label)) / 2), 106, P.ink)
  }))
  // books + figurine
  onShelf(152, () => {
    drawBookRow(ctx, rng, inner0, inner0 + 30, 152, 29)
    const fx = FIGURINE.x, fy = FIGURINE.y
    rect(ctx, fx - 7, fy - 10, 15, 21, 'rgba(180,220,255,0.18)')
    rect(ctx, fx - 7, fy - 10, 15, 1, 'rgba(220,240,255,0.55)')
    rect(ctx, fx - 7, fy - 10, 1, 21, 'rgba(220,240,255,0.4)')
    rect(ctx, fx + 7, fy - 10, 1, 21, 'rgba(220,240,255,0.25)')
    rect(ctx, fx - 8, fy + 8, 17, 3, P.navyCab[2])
    shadedEllipse(ctx, fx, fy, 4.5, 4.5, P.smudge.slice(1), P.smudgeOutline)
    px(ctx, fx + 1, fy - 1, P.outline); px(ctx, fx + 3, fy - 1, P.outline)
    px(ctx, fx - 3, fy + 6, P.boot.b); px(ctx, fx + 2, fy + 6, P.boot.b)
    line(ctx, fx - 2, fy + 4, fx - 2, fy + 6, P.smudge[2]); line(ctx, fx + 2, fy + 4, fx + 2, fy + 6, P.smudge[2])
  })
  // ink jars + brush cup
  onShelf(188, () => {
    const jarColors = ['#1b2240', '#c94a4a', '#ffd84a', '#4ee6d0', '#6b4a7a', '#1b2240']
    jarColors.forEach((c, i) => drawJar(ctx, inner0 + i * 6, 188, c))
    rect(ctx, inner1 - 12, 178, 9, 10, P.pot[2])
    rect(ctx, inner1 - 12, 178, 9, 1, P.pot[3])
    for (let i = 0; i < 4; i++) line(ctx, inner1 - 10 + i * 2, 177, inner1 - 12 + i * 3, 165 + i, i % 2 ? P.birch[3] : P.wood[3])
  })
  // bottom: big art books lying down + basket
  onShelf(224, () => {
    for (let i = 0; i < 4; i++) rect(ctx, inner0, 220 - i * 4, 26 - i * 2, 4, P.bookColors[(i * 3) % P.bookColors.length])
    rect(ctx, inner0 + 30, 206, 22, 18, P.mustard[1])
    for (let by = 207; by < 224; by += 3) rect(ctx, inner0 + 30, by, 22, 1, P.mustard[0])
    for (let bx = inner0 + 31; bx < inner0 + 52; bx += 4) rect(ctx, bx, 206, 1, 18, P.mustard[2])
  })

  drawShelfTopPlant(ctx, x, y)
  drawComicStack(ctx, rng, x + 30, y - 2, 3)
}

// Pothos leaves, drawn pointing right (flipped for the left side): o outline, L lit top half,
// S shaded bottom half, H the golden fleck pothos leaves have.
const POTHOS_LEAF = ['.ooo...', 'oLLLoo.', 'oLHLLLo', 'oSSSSo.', 'oSSoo..', '.oo....']
const POTHOS_LEAF_SMALL = ['.oo...', 'oLLoo.', 'oLHLLo', 'oSSSo.', '.ooo..']
const POTHOS_LEAF_TIP = ['.oo..', 'oLLoo', 'oSSo.', '.oo..']
const POTHOS_COLORS = { o: P.leaf[0], L: P.leaf[3], S: P.leaf[2], H: P.leaf[4] }
const POTHOS_SHADE = { o: P.leaf[0], L: P.leaf[2], S: P.leaf[1], H: P.leaf[3] }

// Vines trailing from the hanging pot: where they leave the rim, how far they hang, how much they
// wave, and whether they sit behind the others (darker).
const POTHOS_VINES = [
  { x: 98, length: 50, sway: 2.5, phase: 1.2, back: true },
  { x: 87, length: 74, sway: 3, phase: 0, back: true },
  { x: 91, length: 98, sway: 3.5, phase: 2.1, back: false },
  { x: 96, length: 66, sway: 2.5, phase: 4, back: false },
  { x: 85, length: 40, sway: 2, phase: 3, back: false },
]

function drawPothosLeaf(ctx, x, y, size, faceLeft, back) {
  const rows = size === 2 ? POTHOS_LEAF : size === 1 ? POTHOS_LEAF_SMALL : POTHOS_LEAF_TIP
  const width = rows[0].length
  drawSprite(ctx, rows, back ? POTHOS_SHADE : POTHOS_COLORS, faceLeft ? x - width + 1 : x, y, faceLeft)
}

function drawPothosVine(ctx, { x, length, sway, phase, back }) {
  const top = 39
  const vineX = (y) => Math.round(x + Math.sin((y - top) / 11 + phase) * sway - Math.sin(phase) * sway)
  for (let y = top; y <= top + length; y++) px(ctx, vineX(y), y, back ? P.leaf[0] : P.leaf[1])
  // Leaves alternate sides every few pixels and get smaller toward the end of the vine.
  for (let i = 0, y = top + 3; y < top + length - 1; i++, y += 6) {
    const left = (i + Math.round(phase)) % 2 === 0
    const toEnd = (top + length - y) / length
    const size = toEnd > 0.45 ? 2 : toEnd > 0.15 ? 1 : 0
    drawPothosLeaf(ctx, vineX(y) + (left ? -1 : 1), y - 2, size, left, back)
  }
}

function drawHangingPlant(ctx) {
  // Macramé hanger: three cords from the hook, gathered by a knot, opening around the pot.
  for (const endX of [85, 92, 100]) line(ctx, 92, 10, endX, 33, P.birch[2])
  rect(ctx, 90, 21, 5, 2, P.birch[3])
  px(ctx, 91, 21, P.birch[4])
  disc(ctx, 92, 9, 1, P.brass[1])
  // Pot: it hangs above eye level, so we see its rounded underside rather than into it.
  ellipse(ctx, 92, 39, 7, 2, P.pot[0])
  ellipse(ctx, 92, 38, 7, 1.5, P.pot[1])
  rect(ctx, 84, 32, 17, 2, P.pot[3])
  rect(ctx, 85, 34, 15, 4, P.pot[2])
  rect(ctx, 96, 34, 4, 4, P.pot[1])
  rect(ctx, 85, 34, 15, 1, P.pot[0])
  for (const vine of POTHOS_VINES.filter((v) => v.back)) drawPothosVine(ctx, vine)
  // Leaves spilling over the rim.
  for (const [lx, ly, left, back] of [[86, 27, true, true], [97, 27, false, true], [83, 30, true, false], [94, 28, false, false], [89, 26, true, false], [100, 31, false, false]]) {
    drawPothosLeaf(ctx, lx, ly, 2, left, back)
  }
  for (const vine of POTHOS_VINES.filter((v) => !v.back)) drawPothosVine(ctx, vine)
}

function drawCorkboard(ctx, rng) {
  const { x, y, w, h } = CORK
  wallShadow(ctx, x, y, w, h, 2, 3)
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
  wallShadow(ctx, x - 1, y - 1, w + 2, h + 2, 2, 2)
  rect(ctx, x - 1, y - 1, w + 2, h + 2, P.outline)
  ditherGradient(ctx, x, y, w, h, ['#3b2c6b', '#2a2150', '#1d173a'])
  for (const [sx, sy] of [[x + 4, y + 25], [x + 42, y + 28], [x + 39, y + 52], [x + 6, y + 50], [x + 24, y + 26]]) px(ctx, sx, sy, '#fff4d6')
  const centred = (text) => x + Math.round((w - textWidth(text)) / 2)
  // Title block: DAY / OF THE / SMUDGIES, the cover of the game (clicking the poster opens it)
  text3x5(ctx, 'DAY', centred('DAY') + 1, y + 4, '#ff5fa2')
  text3x5(ctx, 'DAY', centred('DAY'), y + 3, '#ffd84a')
  for (const [dx, len] of [[0, 3], [6, 4], [9, 2]]) rect(ctx, centred('DAY') + dx, y + 8, 1, len, '#ffd84a')
  text3x5(ctx, 'OF THE', centred('OF THE'), y + 12, '#efe6d0')
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
  ctx.globalAlpha = 0.24
  disc(ctx, CLOCK.x + 2, CLOCK.y + 3, 11.5, '#120a10')
  ctx.globalAlpha = 1
  disc(ctx, CLOCK.x, CLOCK.y + 1, 11.5, P.ceiling[0])
  disc(ctx, CLOCK.x, CLOCK.y, 11.5, P.wood[3])
  disc(ctx, CLOCK.x, CLOCK.y, 9.5, P.frame[3])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    px(ctx, CLOCK.x + Math.round(Math.sin(a) * 8), CLOCK.y - Math.round(Math.cos(a) * 8), i % 3 === 0 ? P.outline : P.frame[0])
  }
}

// The cabinet stands right of the eye and below it: its top and its left side show.
const CABINET_DEPTH = 24

function drawCabinet(ctx) {
  const { x, y, w, h } = CABINET
  wallShadow(ctx, x, y - 6, w + 2, h + 6, 4, -1)
  contactShadow(ctx, x + w / 2, FLOOR_Y - 1, w / 2 + 4)
  const [topBackLeftX, topBackY] = recede(x - 2, y, CABINET_DEPTH)
  const [topBackRightX] = recede(x + w + 2, y, CABINET_DEPTH)
  fillPoly(ctx, [[topBackLeftX, topBackY], [topBackRightX, topBackY], [x + w + 2, y], [x - 2, y]], P.navyCab[2])
  line(ctx, Math.round(topBackLeftX), Math.round(topBackY), Math.round(topBackRightX), Math.round(topBackY), P.navyCab[1])
  const [sideBackX, sideBackTop] = recede(x, y + 3, CABINET_DEPTH)
  fillPoly(ctx, [[sideBackX, sideBackTop], [x, y + 3], [x, FLOOR_Y], [sideBackX, FLOOR_Y]], P.navyCab[0])
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

  // Record player, a row of record sleeves and the lava lamp, standing on the middle of the top
  // with a thin shadow at their feet.
  const surface = CABINET_SURFACE_Y
  const rx = RECORD.x - 16
  const sleevesX = rx + 39
  ctx.globalAlpha = 0.35
  for (const [x0, x1] of [[rx, rx + 36], [sleevesX, sleevesX + 26], [LAVA.x - 5, LAVA.x + 6]]) rect(ctx, x0, surface, x1 - x0, 1, '#0b0f1c')
  ctx.globalAlpha = 1
  rect(ctx, rx, surface - 8, 36, 8, P.wood[3])
  rect(ctx, rx, surface - 8, 36, 1, P.wood[4])
  rect(ctx, rx, surface - 1, 36, 1, P.wood[1])
  rect(ctx, rx + 3, surface - 4, 3, 2, P.metal[2])
  rect(ctx, rx + 30, surface - 4, 3, 2, P.metal[2])
  const sleeves = ['#c94a4a', '#ffd84a', '#4e7a8a', '#efe6d0', '#6b4a7a']
  sleeves.forEach((c, i) => {
    rect(ctx, sleevesX + i * 3, surface - 17 + (i % 2), 14, 17 - (i % 2), c)
    rect(ctx, sleevesX + i * 3, surface - 17 + (i % 2), 1, 17 - (i % 2), 'rgba(0,0,0,0.25)')
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

const PLANT_POT = { cx: 457, rimY: 203, bottomY: 231 }

// Leaf colours by depth: leaves at the back sit in shadow, the front ones catch a little shine.
const LEAF_TONES = [
  { shade: P.leaf[1], lit: P.leaf[2], rib: P.leaf[0], stem: P.leaf[1], shine: null },
  { shade: P.leaf[2], lit: P.leaf[3], rib: P.leaf[1], stem: P.leaf[1], shine: null },
  { shade: P.leaf[2], lit: P.leaf[3], rib: P.leaf[1], stem: P.leaf[2], shine: P.leaf[4] },
]

// Each leaf: where its stem ends, the way it points (radians, screen space), length, half-width
// and depth (0 back, 2 front). Listed back to front so nearer leaves overlap farther ones.
const MONSTERA_LEAVES = [
  { x: 447, y: 171, angle: -2.35, length: 17, width: 8, depth: 0 },
  { x: 465, y: 166, angle: -0.95, length: 15, width: 7, depth: 0 },
  { x: 441, y: 186, angle: -2.95, length: 16, width: 8, depth: 1 },
  { x: 457, y: 163, angle: -1.7, length: 19, width: 9, depth: 1 },
  { x: 467, y: 183, angle: -0.55, length: 12, width: 6, depth: 1 },
  { x: 450, y: 193, angle: -2.55, length: 15, width: 7, depth: 2 },
  { x: 462, y: 191, angle: -0.6, length: 14, width: 7, depth: 2 },
]

// Terracotta pot seen from a little above: an oval rim with the soil inside, a tapered body with a
// rounded bottom, and an oval saucer.
function drawPlantPot(ctx) {
  const { cx, rimY, bottomY } = PLANT_POT
  ellipse(ctx, cx, bottomY - 1, 12.5, 2, P.pot[0])
  ellipse(ctx, cx, bottomY - 2, 12, 1.5, P.pot[1])
  const bodyTop = rimY + 5
  const bodyBottom = bottomY - 3
  ellipse(ctx, cx, bodyBottom, 9, 1.5, P.pot[1])
  for (let y = bodyTop; y < bodyBottom; y++) {
    const half = Math.round(11.5 - ((y - bodyTop) / (bodyBottom - bodyTop)) * 2.5)
    for (let x = cx - half; x <= cx + half; x++) {
      const across = (x - (cx - half)) / (half * 2) + (bayer(x, y) - 0.5) * 0.12
      const color = across < 0.14 ? P.pot[3] : across < 0.62 ? P.pot[2] : across < 0.86 ? P.pot[1] : P.pot[0]
      px(ctx, x, y, y === bodyTop ? P.pot[0] : color)
    }
  }
  // Rim: a band whose lower edge curves toward us, topped by an oval lip around the soil.
  ellipse(ctx, cx, rimY + 4, 14.5, 1.5, P.pot[1])
  rect(ctx, cx - 14, rimY + 1, 29, 4, P.pot[2])
  rect(ctx, cx + 9, rimY + 1, 6, 4, P.pot[1])
  rect(ctx, cx - 14, rimY + 1, 1, 4, P.pot[3])
  ellipse(ctx, cx, rimY + 1, 14.5, 2.4, P.pot[3])
  ellipse(ctx, cx, rimY + 1, 12.5, 1.4, '#2b1a14')
  line(ctx, cx - 6, rimY + 2, cx + 4, rimY + 2, '#3d2619')
}

// A curved stem from the soil, rising first and then bending out to the leaf.
function drawLeafStem(ctx, leaf) {
  const { cx, rimY } = PLANT_POT
  const start = [cx + Math.sign(leaf.x - cx) * 2, rimY + 1]
  const control = [cx + (leaf.x - cx) * 0.4, (rimY + leaf.y) / 2 - 8]
  const color = LEAF_TONES[leaf.depth].stem
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t * t * leaf.x
    const y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t * t * leaf.y
    px(ctx, Math.round(x), Math.round(y), color)
  }
}

// One heart-shaped monstera leaf, rasterised in its own frame: `along` runs from the stem to the
// tip, `across` from the midrib to the edge. Bigger leaves get the plant's typical splits, which
// let the wall show through.
function drawMonsteraLeaf(ctx, { x, y, angle, length, width, depth }) {
  const tone = LEAF_TONES[depth]
  const dir = [Math.cos(angle), Math.sin(angle)]
  const normal = [-dir[1], dir[0]]
  const halfWidth = (along) => {
    const t = along / length
    if (t < -0.18 || t > 1) return -1
    if (t < 0) return width * 0.8 * Math.sqrt(1 - (t / 0.18) ** 2)
    return width * Math.sin(Math.PI * (t * 0.85 + 0.15)) ** 0.7 * (1.1 - 0.45 * t)
  }
  const splits = (length >= 17 ? [0.32, 0.6] : length >= 14 ? [0.45] : []).map((t) => t * length)
  const inLeaf = (along, across) => {
    const half = halfWidth(along)
    const side = Math.abs(across)
    if (half < 0 || side > half) return false
    if (along < 0 && side < -along * 3) return false
    return !splits.some((s) => side > half * 0.5 && Math.abs(along - (s + side * 0.6)) < 0.55)
  }
  const local = (px0, py0) => {
    const dx = px0 - x, dy = py0 - y
    return [dx * dir[0] + dy * dir[1], dx * normal[0] + dy * normal[1]]
  }
  const inside = (px0, py0) => inLeaf(...local(px0, py0))
  const reach = Math.ceil(length + width + 2)
  for (let py0 = Math.floor(y - reach); py0 <= y + reach; py0++) {
    for (let px0 = Math.floor(x - reach); px0 <= x + reach; px0++) {
      if (!inside(px0, py0)) continue
      const [along, across] = local(px0, py0)
      const edge = !inside(px0 + 1, py0) || !inside(px0 - 1, py0) || !inside(px0, py0 + 1) || !inside(px0, py0 - 1)
      // The half whose edge faces up is the one in the light.
      const litSide = across * normal[1] < 0
      const half = halfWidth(along)
      let color = litSide ? tone.lit : tone.shade
      if (edge) color = P.leaf[0]
      else if (Math.abs(across) < 0.6 && along > 0 && along < length * 0.9) color = tone.rib
      else if (tone.shine && litSide && Math.abs(across) > half * 0.25 && Math.abs(across) < half * 0.6 && along > length * 0.15 && along < length * 0.6 && bayer(px0, py0) > 0.4) color = tone.shine
      px(ctx, px0, py0, color)
    }
  }
}

function drawMonstera(ctx) {
  wallShadow(ctx, PLANT_POT.cx - 13, PLANT_POT.rimY, 27, PLANT_POT.bottomY - PLANT_POT.rimY, 3, -1)
  contactShadow(ctx, PLANT_POT.cx, PLANT_POT.bottomY, 14)
  drawPlantPot(ctx)
  for (const leaf of MONSTERA_LEAVES) {
    drawLeafStem(ctx, leaf)
    drawMonsteraLeaf(ctx, leaf)
  }
}

// Soft contact shadow so furniture sits on the rug instead of floating against the wall.
// A soft shadow on the wall behind something that stands or hangs in front of it, offset away from
// the light (dx, dy). Drawn before the object, so only the sliver beside it shows. This gap of
// shadow is what keeps furniture from looking painted onto the wall.
function wallShadow(ctx, x, y, w, h, dx, dy = 0) {
  const bottom = Math.min(y + h + dy, FLOOR_Y)
  ctx.globalAlpha = 0.16
  rect(ctx, x + dx * 1.6, y + dy * 1.6, w, bottom - (y + dy * 1.6), '#120a10')
  ctx.globalAlpha = 0.24
  rect(ctx, x + dx, y + dy, w, bottom - (y + dy), '#120a10')
  ctx.globalAlpha = 1
}

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

  drawDeskLamp(ctx)
}

// Mustard enamel: it stands out against the green wallpaper and the red curtain behind it.
const LAMP_ENAMEL = ['#5a3c14', '#a8711f', '#d39a32', '#f0c766']

// Anglepoise lamp: weighted base, two outlined steel arms with a spring and brass joints, and an
// enamel shade aimed at the page.
function drawDeskLamp(ctx) {
  const { baseX, baseY, elbowX, elbowY, headX, headY } = LAMP
  const [outline, shade, body, shine] = LAMP_ENAMEL
  ellipse(ctx, baseX, baseY - 1, 6, 2, outline)
  ellipse(ctx, baseX, baseY - 1.5, 5, 1.2, body)
  line(ctx, baseX - 3, baseY - 3, baseX + 1, baseY - 3, shine)
  rect(ctx, baseX - 1, baseY - 6, 3, 4, outline)
  px(ctx, baseX, baseY - 5, shade)

  const arm = (x0, y0, x1, y1) => {
    thickLine(ctx, x0, y0, x1, y1, 1, P.metal[0])
    line(ctx, x0, y0, x1, y1, P.metal[3])
  }
  arm(baseX, baseY - 6, elbowX, elbowY)
  // The balance spring runs beside the lower arm.
  for (let i = 0; i < 9; i++) {
    const t = 0.15 + i * 0.06
    px(ctx, Math.round(baseX + (elbowX - baseX) * t) + 2 + (i % 2), Math.round(baseY - 6 + (elbowY - baseY + 6) * t), P.metal[2])
  }
  arm(elbowX, elbowY, headX + 3, headY - 1)
  for (const [jx, jy] of [[baseX, baseY - 6], [elbowX, elbowY], [headX + 3, headY - 1]]) {
    disc(ctx, jx, jy, 1.5, P.brass[0])
    px(ctx, Math.round(jx), Math.round(jy), P.brass[2])
  }

  const h = (dx, dy) => [headX + dx, headY + dy]
  fillPoly(ctx, [h(-2, -5), h(6, -3), h(4, 6), h(-9, 6)], outline)
  fillPoly(ctx, [h(-1, -4), h(5, -2), h(3, 4), h(-7, 5)], body)
  fillPoly(ctx, [h(1, 0), h(4, 0), h(3, 4), h(-3, 4)], shade)
  line(ctx, headX - 1, headY - 4, headX + 4, headY - 2, shine)
  line(ctx, headX - 3, headY - 1, headX, headY - 3, shine)
  // Inner rim of the shade's opening.
  line(ctx, headX - 7, headY + 5, headX + 3, headY + 4, '#3a2610')
  disc(ctx, headX + 5, headY - 3, 1, P.brass[1])
}

// A wooden crate of comics beside the stool.
function drawCrate(ctx) {
  const { x, y, w, h } = CRATE
  const depth = 22
  contactShadow(ctx, x + w / 2, y + h, w / 2 + 3)
  // Left of the eye and below it: the open top (dark inside) and the right side show.
  const [backLeftX, backY] = recede(x - 1, y - 1, depth)
  const [backRightX] = recede(x + w + 1, y - 1, depth)
  fillPoly(ctx, [[backLeftX, backY], [backRightX, backY], [x + w + 1, y - 1], [x - 1, y - 1]], P.wood[0])
  line(ctx, Math.round(backLeftX), Math.round(backY), Math.round(backRightX), Math.round(backY), P.wood[3])
  const [sideBackX, sideBackTop] = recede(x + w, y, depth)
  fillPoly(ctx, [[x + w, y], [sideBackX, sideBackTop], [sideBackX, y + h], [x + w, y + h]], P.wood[1])
  for (let i = 0; i < 3; i++) line(ctx, x + w, y + 2 + i * 6, Math.round(sideBackX), y + 1 + i * 6, P.wood[2])
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

// Waste bin tucked under the desk: a round wire bin seen from a little above, with an oval rim and
// the dark inside showing, a body that narrows toward its rounded bottom, and ribs. The crumpled
// drafts inside are drawn live by paperBalls, then drawBinFront puts the front of the rim back over
// them so they sit in the bin rather than on top of it.
function drawBin(ctx) {
  const { cx, top, rimRx, rimRy, openingRx, openingRy } = BIN
  const bottom = FLOOR_Y
  contactShadow(ctx, cx, bottom - 1, 9)
  ellipse(ctx, cx, bottom - 1, 6, 1.5, P.metal[1])
  // Cylinder shading across the body: dark edges, one narrow highlight left of centre, a gradual
  // fall into shadow on the right. Ribs darken the lit metal by one step.
  const RAMP = [P.metal[1], P.metal[2], P.metal[3], P.metal[2], P.metal[2], P.metal[1], P.metal[1], P.metal[0]]
  for (let y = top; y < bottom - 1; y++) {
    const half = Math.round(7.5 - ((y - top) / (bottom - top)) * 1.5)
    for (let x = cx - half; x <= cx + half; x++) {
      const across = (x - (cx - half)) / (half * 2 + 1)
      const step = Math.min(RAMP.length - 1, Math.floor(across * RAMP.length))
      const color = RAMP[step]
      const rib = (x - cx + 30) % 3 === 0 && step > 0 && step < RAMP.length - 1
      px(ctx, x, y, rib ? P.metal[Math.max(0, P.metal.indexOf(color) - 1)] : color)
    }
  }
  ellipse(ctx, cx, top, rimRx, rimRy, P.metal[3])
  ellipse(ctx, cx, top, openingRx, openingRy, P.metal[0])
}

// The near half of the bin's rim: the ring between the rim's outer oval and the opening, from the
// middle row down. Same row maths as `ellipse`, so it lands exactly on the rim drawn above.
export function drawBinFront(ctx) {
  const { cx, top, rimRx, rimRy, openingRx, openingRy } = BIN
  const halfAt = (rx, ry, dy) => (Math.abs(dy) > Math.floor(ry) ? -1 : Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))))
  for (let dy = 0; dy <= Math.floor(rimRy); dy++) {
    const outer = halfAt(rimRx, rimRy, dy)
    const inner = halfAt(openingRx, openingRy, dy)
    for (let dx = inner + 1; dx <= outer; dx++) {
      px(ctx, cx - dx, top + dy, P.metal[3])
      px(ctx, cx + dx, top + dy, P.metal[3])
    }
  }
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
