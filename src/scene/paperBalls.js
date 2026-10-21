// Crumpled drafts: balls Smudge throws at the bin under his desk. Hits pile up in the bin, misses
// stay on the floor until he tidies them up.
import { shadedEllipse } from '../engine/draw.js'
import { createRng } from '../engine/rng.js'
import { FRONT_FLOOR_Y } from './layout.js'

const BALL_RAMP = ['#b8ae98', '#e4dccb', '#fbf6ea']
const BALL_OUTLINE = '#8a826e'
const BIN_MOUTH = { x: 269, y: 210 }
// Where extra balls sit on top of the bin's heap, in fill order.
const BIN_HEAP = [[265, 206], [273, 206], [269, 204], [262, 208], [276, 208], [268, 201], [272, 202]]
const FLOOR_AREA = { x0: 160, x1: 262, y0: FRONT_FLOOR_Y + 2, y1: FRONT_FLOOR_Y + 13 }

export const drawBall = (ctx, x, y) => shadedEllipse(ctx, x, y, 3, 2.5, BALL_RAMP, BALL_OUTLINE)

export function createPaperBalls() {
  const rng = createRng(77)
  const floor = []
  const flying = []
  let inBin = 0

  function throwBall(fromX, fromY, intoBin) {
    const to = intoBin
      ? BIN_MOUTH
      : { x: rng.int(FLOOR_AREA.x0, FLOOR_AREA.x1), y: rng.int(FLOOR_AREA.y0, FLOOR_AREA.y1) }
    const distance = Math.hypot(to.x - fromX, to.y - fromY)
    flying.push({ from: { x: fromX, y: fromY }, to, intoBin, t: 0, duration: 0.45 + distance / 260, height: 14 + distance * 0.18 })
  }

  function update(dt) {
    for (const ball of flying) {
      ball.t += dt / ball.duration
      if (ball.t < 1) continue
      ball.done = true
      if (ball.intoBin) inBin = Math.min(BIN_HEAP.length, inBin + 1)
      else floor.push({ ...ball.to })
    }
    for (let i = flying.length - 1; i >= 0; i--) if (flying[i].done) flying.splice(i, 1)
  }

  function takeFromFloor(ball) {
    const i = floor.indexOf(ball)
    if (i >= 0) floor.splice(i, 1)
  }

  // Lit with the room: balls lying on the floor and heaped in the bin.
  function drawLanded(ctx) {
    for (const [x, y] of BIN_HEAP.slice(0, inBin)) drawBall(ctx, x, y)
    for (const ball of floor) drawBall(ctx, ball.x, ball.y)
  }

  function drawFlying(ctx) {
    for (const ball of flying) {
      const t = Math.min(1, ball.t)
      const x = ball.from.x + (ball.to.x - ball.from.x) * t
      const y = ball.from.y + (ball.to.y - ball.from.y) * t - Math.sin(t * Math.PI) * ball.height
      drawBall(ctx, x, y)
    }
  }

  // For testing the tidy-up: drop some balls straight onto the floor.
  function scatterOnFloor(count) {
    for (let i = 0; i < count; i++) floor.push({ x: rng.int(FLOOR_AREA.x0, FLOOR_AREA.x1), y: rng.int(FLOOR_AREA.y0, FLOOR_AREA.y1) })
  }

  return { throwBall, update, takeFromFloor, scatterOnFloor, drawLanded, drawFlying, floor }
}
