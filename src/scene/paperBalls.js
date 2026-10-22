// Crumpled drafts: balls Smudge throws at the bin under his desk. Hits pile up in the bin, misses
// stay on the floor until he tidies them up.
//
// The bin is seen a little from above, so a ball in it is drawn between the bin's back (the inside,
// baked into the room) and the front of its rim (drawn again on top): only its top shows over the
// lip. A ball heading for the bin aims at the exact heap spot it will fill, and once it is falling
// in it moves to that same layer, so it drops behind the lip instead of landing on top of it.
import { drawSprite, ellipse } from '../engine/draw.js'
import { createRng } from '../engine/rng.js'
import { FRONT_FLOOR_Y } from './layout.js'
import { drawBinFront } from './room.js'

// Crumpled paper, lit from the upper left: a lumpy outline (o), bright folds (w), paper (l), folds
// turned away from the light (s) and crease lines (d). Three variants so a pile isn't copy-pasted.
const BALL_SPRITES = [
  ['.oo.oo.', 'owwdwlo', 'owlswso', 'odwlsdo', 'olsdsso', '.ooooo.'],
  ['..ooo..', '.owwlo.', 'owdwwlo', 'olwsdso', 'owsldso', '.oosoo.'],
  ['.ooo.o.', 'owlwdlo', 'odwwlso', 'olsdwso', '.olssdo', '..ooo..'],
]
const BALL_COLORS = { o: '#7d7462', w: '#fbf6ea', l: '#e4dccb', s: '#bdb39c', d: '#968c76' }
// One crumpled ball that has been lying by the bin all along.
const STRAY_BALL = { x: 286, y: 236, variant: 2 }
// Where balls settle in the bin, in fill order: a bottom layer just under the rim, then a heap
// that rises over it as the bin fills.
const BIN_HEAP = [[266, 213], [274, 213], [270, 212], [267, 210], [273, 210], [270, 208], [270, 205]]
const BALLS_IN_BIN_AT_START = 3
const FLOOR_AREA = { x0: 160, x1: 262, y0: FRONT_FLOOR_Y + 2, y1: FRONT_FLOOR_Y + 13 }

export const drawBall = (ctx, x, y, variant = 0) => drawSprite(ctx, BALL_SPRITES[variant % BALL_SPRITES.length], BALL_COLORS, Math.round(x) - 3, Math.round(y) - 3)

function drawFloorBall(ctx, { x, y, variant }) {
  ctx.globalAlpha = 0.3
  ellipse(ctx, x, y + 3, 3, 1, '#120a10')
  ctx.globalAlpha = 1
  drawBall(ctx, x, y, variant)
}

export function createPaperBalls() {
  const rng = createRng(77)
  const floor = []
  const flying = []
  // The variant of each ball in the bin, bottom of the heap first.
  const heap = Array.from({ length: BALLS_IN_BIN_AT_START }, (_, i) => i)
  let headingForBin = 0
  // The ball Smudge is holding (crumpled or picked up) keeps its look when he throws it.
  let heldVariant = 0

  function throwBall(fromX, fromY, intoBin) {
    const variant = heldVariant
    heldVariant = (heldVariant + 1) % BALL_SPRITES.length
    let to
    if (intoBin) {
      const [x, y] = BIN_HEAP[Math.min(heap.length + headingForBin, BIN_HEAP.length - 1)]
      to = { x, y }
      headingForBin++
    } else {
      to = { x: rng.int(FLOOR_AREA.x0, FLOOR_AREA.x1), y: rng.int(FLOOR_AREA.y0, FLOOR_AREA.y1) }
    }
    const distance = Math.hypot(to.x - fromX, to.y - fromY)
    flying.push({ from: { x: fromX, y: fromY }, to, intoBin, variant, t: 0, duration: 0.45 + distance / 260, height: 14 + distance * 0.18 })
  }

  function update(dt) {
    for (const ball of flying) {
      ball.t += dt / ball.duration
      if (ball.t < 1) continue
      ball.done = true
      if (ball.intoBin) {
        headingForBin--
        if (heap.length < BIN_HEAP.length) heap.push(ball.variant)
      } else {
        floor.push({ ...ball.to, variant: ball.variant })
      }
    }
    for (let i = flying.length - 1; i >= 0; i--) if (flying[i].done) flying.splice(i, 1)
  }

  function takeFromFloor(ball) {
    const i = floor.indexOf(ball)
    if (i >= 0) floor.splice(i, 1)
    heldVariant = ball.variant ?? heldVariant
  }

  const positionOf = (ball) => {
    const t = Math.min(1, ball.t)
    return {
      x: ball.from.x + (ball.to.x - ball.from.x) * t,
      y: ball.from.y + (ball.to.y - ball.from.y) * t - Math.sin(t * Math.PI) * ball.height,
    }
  }
  // Past the top of its arc, a ball bound for the bin is falling into it.
  const droppingIn = (ball) => ball.intoBin && ball.t > 0.5

  // Lit with the room: the bin's contents (and balls falling into it) behind the rim's front, then
  // balls lying on the floor.
  function drawLanded(ctx) {
    heap.forEach((variant, i) => drawBall(ctx, BIN_HEAP[i][0], BIN_HEAP[i][1], variant))
    for (const ball of flying.filter(droppingIn)) {
      const { x, y } = positionOf(ball)
      drawBall(ctx, x, y, ball.variant)
    }
    drawBinFront(ctx)
    drawFloorBall(ctx, STRAY_BALL)
    for (const ball of floor) drawFloorBall(ctx, ball)
  }

  function drawFlying(ctx) {
    for (const ball of flying) {
      if (droppingIn(ball)) continue
      const { x, y } = positionOf(ball)
      drawBall(ctx, x, y, ball.variant)
    }
  }

  // For testing the tidy-up: drop some balls straight onto the floor.
  function scatterOnFloor(count) {
    for (let i = 0; i < count; i++) floor.push({ x: rng.int(FLOOR_AREA.x0, FLOOR_AREA.x1), y: rng.int(FLOOR_AREA.y0, FLOOR_AREA.y1), variant: i % BALL_SPRITES.length })
  }

  return { throwBall, update, takeFromFloor, scatterOnFloor, drawLanded, drawFlying, floor, get heldVariant() { return heldVariant } }
}
