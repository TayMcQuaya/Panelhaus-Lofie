// Noodle limbs solved with two-bone IK, plus hands, boots and the drawing tools.
import { disc, drawSprite, line, px, thickLine } from '../engine/draw.js'
import { P } from '../engine/palette.js'

// Rubber-hose arms: past full reach the segments stretch (normally up to 45%, more for gags)
// instead of falling short, which suits a sponge and keeps the pen on the page.
//
// Of the two possible elbows, the one that hangs lower wins, the way a real arm falls under its
// own weight. When both are about equally low (hand straight above or below the shoulder), the
// elbow points `outward` (-1 left, 1 right), so it never folds across the body.
export function solveIK(sx, sy, tx, ty, baseUpper, baseLower, outward, maxStretch = 1.45) {
  const dx = tx - sx, dy = ty - sy
  const reach = Math.hypot(dx, dy)
  const stretch = Math.min(maxStretch, Math.max(1, reach / ((baseUpper + baseLower) * 0.94)))
  const upper = baseUpper * stretch, lower = baseLower * stretch
  const d = Math.min(Math.max(reach, Math.abs(upper - lower) + 0.01), upper + lower - 0.01)
  const base = Math.atan2(dy, dx)
  const bendAngle = Math.acos(Math.max(-1, Math.min(1, (upper * upper + d * d - lower * lower) / (2 * upper * d))))
  const elbowAt = (sign) => ({ x: sx + Math.cos(base + sign * bendAngle) * upper, y: sy + Math.sin(base + sign * bendAngle) * upper })
  const a = elbowAt(1), b = elbowAt(-1)
  const elbow = Math.abs(a.y - b.y) > 3 ? (a.y > b.y ? a : b) : ((a.x - b.x) * outward > 0 ? a : b)
  const hand = reach > upper + lower ? { x: sx + Math.cos(base) * (upper + lower), y: sy + Math.sin(base) * (upper + lower) } : { x: tx, y: ty }
  return { elbow, hand }
}

export function drawLimb(ctx, points, shade = 3) {
  // Shaded like the body: mid-tone fill, a darker underside, a highlight only one step lighter.
  for (let i = 1; i < points.length; i++) thickLine(ctx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, 2.5, P.smudgeOutline)
  for (let i = 1; i < points.length; i++) thickLine(ctx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, 1.5, P.smudge[shade])
  for (let i = 1; i < points.length; i++) line(ctx, points[i - 1].x, points[i - 1].y + 1, points[i].x, points[i].y + 1, P.smudge[Math.max(0, shade - 1)])
  for (let i = 1; i < points.length; i++) line(ctx, points[i - 1].x, points[i - 1].y - 1, points[i].x, points[i].y - 1, P.smudge[Math.min(4, shade + 1)])
}

export function drawHand(ctx, x, y, inkSide = 1) {
  disc(ctx, x, y, 3.5, P.smudgeOutline)
  disc(ctx, x, y, 2.5, P.smudge[2])
  px(ctx, x - 1, y - 1, P.smudge[3])
  px(ctx, x + 1, y + 1, P.smudge[1])
  const rx = Math.round(x), ry = Math.round(y)
  px(ctx, rx + inkSide, ry + 1, P.ink)
  px(ctx, rx, ry + 2, P.ink)
  px(ctx, rx + inkSide * 2, ry, P.inkMid)
  px(ctx, rx + inkSide, ry + 2, P.ink)
}

// Boots seen end-on: the heel from behind, the inky toe cap from the front.
const BOOT_HEEL = ['.ooooo.', 'obbbbbo', 'olbbbso', 'ossssso', '.ooooo.']
const BOOT_TOE = ['.ooooo.', 'olbbbbo', 'olbiibo', 'ossssso', '.ooooo.']
const BOOT_COLORS = { o: P.boot.o, l: P.boot.l, b: P.boot.b, s: P.boot.s, i: P.boot.i }

export function drawBoot(ctx, ankleX, ankleY, facingUs) {
  drawSprite(ctx, facingUs ? BOOT_TOE : BOOT_HEEL, BOOT_COLORS, Math.round(ankleX) - 3, Math.round(ankleY))
}

const TOOLS = {
  pencil: { body: '#e8823a', shine: '#f6b06a', tip: '#3a3a44' },
  ink: { body: '#262838', shine: '#4a4e6a', tip: '#c8d0e0' },
  fill: { body: '#ffd84a', shine: '#fff0a0', tip: '#e8a020' },
}

export function drawTool(ctx, tool, handX, handY, tipX, tipY) {
  const t = TOOLS[tool] ?? TOOLS.pencil
  const dx = tipX - handX, dy = tipY - handY
  const len = Math.hypot(dx, dy) || 1
  const backX = handX - (dx / len) * 3, backY = handY - (dy / len) * 3
  line(ctx, backX, backY, tipX, tipY, t.body)
  line(ctx, backX + 1, backY, tipX + 1, tipY, t.shine)
  px(ctx, tipX, tipY, t.tip)
}
