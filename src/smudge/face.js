// Smudge's face: two tall oval eyes and an expressive mouth, slid across the sphere to turn his head.
import { px, rect } from '../engine/draw.js'
import { P } from '../engine/palette.js'

const EYE_OPEN = ['.#.', '###', '###', '###', '.#.']

function drawEye(ctx, x, y, state, narrow) {
  if (state === 'blink') { rect(ctx, x - 1, y + 2, narrow ? 2 : 3, 1, P.outline); return }
  if (state === 'happy') {
    px(ctx, x - 1, y + 2, P.outline); px(ctx, x, y + 1, P.outline); px(ctx, x + 1, y + 2, P.outline)
    return
  }
  const rows = state === 'sleepy' ? EYE_OPEN.slice(2) : EYE_OPEN
  const top = state === 'sleepy' ? y + 2 : y
  rows.forEach((row, j) => {
    for (let i = 0; i < 3; i++) {
      if (row[i] !== '#') continue
      if (narrow && i === 2) continue
      px(ctx, x - 1 + i, top + j, P.outline)
    }
  })
  if (state === 'sleepy') rect(ctx, x - 1, top - 1, narrow ? 2 : 3, 1, P.smudge[1])
  else px(ctx, x - 1 + (narrow ? 0 : 0), y + 1, P.eyeShine)
}

function drawBrows(ctx, nearX, farX, y, brows) {
  if (brows === 'focus') {
    px(ctx, nearX - 1, y - 2, P.outline); px(ctx, nearX, y - 3, P.outline); px(ctx, nearX + 1, y - 3, P.outline)
    px(ctx, farX + 1, y - 2, P.outline); px(ctx, farX, y - 3, P.outline)
  } else if (brows === 'raised') {
    rect(ctx, nearX - 1, y - 4, 3, 1, P.outline)
    rect(ctx, farX - 1, y - 4, 2, 1, P.outline)
  }
}

function drawMouth(ctx, x, y, mouth) {
  const dark = P.mouth, tongue = P.tongue
  switch (mouth) {
    case 'smile':
      px(ctx, x - 3, y, dark); px(ctx, x + 3, y, dark)
      rect(ctx, x - 2, y + 1, 5, 1, dark)
      break
    case 'grin':
      rect(ctx, x - 3, y, 7, 1, dark)
      px(ctx, x - 2, y + 1, dark); rect(ctx, x - 1, y + 1, 3, 1, tongue); px(ctx, x + 2, y + 1, dark)
      rect(ctx, x - 1, y + 2, 3, 1, dark)
      break
    case 'focus':
      rect(ctx, x - 2, y, 4, 1, dark)
      px(ctx, x + 2, y, tongue); px(ctx, x + 2, y + 1, tongue); px(ctx, x + 3, y + 1, '#e86a80')
      break
    case 'o':
      rect(ctx, x, y, 2, 3, dark)
      break
    case 'yawn':
      rect(ctx, x - 1, y - 1, 4, 1, dark)
      rect(ctx, x - 2, y, 6, 3, dark)
      rect(ctx, x - 1, y + 3, 4, 1, dark)
      rect(ctx, x - 1, y + 2, 4, 1, tongue)
      break
    case 'hmm':
      rect(ctx, x - 2, y + 1, 2, 1, dark); rect(ctx, x, y, 2, 1, dark)
      break
    default:
      rect(ctx, x - 2, y, 4, 1, dark)
  }
}

// face: { x, y } centre in screen pixels, turn -1..1, look {x,y} in -1..1, eyes, mouth, brows
export function drawFace(ctx, face) {
  const fx = Math.round(face.x), fy = Math.round(face.y)
  const lookX = Math.round(face.look.x), lookY = Math.round(face.look.y)
  const spacing = 10 - Math.round(Math.abs(face.turn) * 2)
  const nearX = fx + Math.ceil(spacing / 2) + lookX
  const farX = fx - Math.floor(spacing / 2) + lookX
  const eyeY = fy - 6 + lookY
  drawEye(ctx, nearX, eyeY, face.eyes, false)
  drawEye(ctx, farX, eyeY, face.eyes, Math.abs(face.turn) > 0.55)
  drawBrows(ctx, nearX, farX, eyeY, face.brows)
  if (face.mouth !== 'hidden') drawMouth(ctx, fx + Math.round(face.turn) + lookX, fy + 1 + Math.max(0, lookY), face.mouth)
}
