// Props that move: the clock, the record player, the cat on the sill, the mug, the corkboard of
// finished pages, and the lights that glow (fairy lights, desk lamp, figurine).
import { disc, ellipse, fillPoly, line, px, rect, shadedEllipse, thickLine } from '../engine/draw.js'
import { hexRgb } from '../engine/ease.js'
import { P } from '../engine/palette.js'
import { createRng } from '../engine/rng.js'
import { createFinishedPage } from '../smudge/comicPage.js'
import { CAT_SPOT, CLOCK, CORK_SLOTS, FIGURINE, LAMP, LAMP_POOL, LAVA, MUG_HOME, PAGE, RECORD } from './layout.js'
import { fairyBulbs } from './room.js'

const PIN_COLORS = ['#e8453c', '#ffd84a', '#4ee6d0', '#ff7aa8', '#7aa8ff', '#e8453c']

// The COMICS long box on the shelf, where pages go when the corkboard is full.
const ARCHIVE_BOX = { x: 15, y: 101, w: 23 }

function createCorkboard(startPages) {
  const slots = CORK_SLOTS.map((slot, i) => ({ ...slot, page: i < startPages.length ? startPages[i] : null, pin: PIN_COLORS[i] }))
  let nextSlot = startPages.length % slots.length
  let flying = null
  let retiring = null
  let archived = 0

  // A full board files its oldest page away in the comics box before the new one goes up.
  function pin(page, fromX, fromY) {
    const slot = slots[nextSlot]
    nextSlot = (nextSlot + 1) % slots.length
    if (slot.page) {
      retiring = { page: slot.page, fromX: slot.x, fromY: slot.y, t: 0 }
      slot.page = null
    }
    flying = { page, slot, fromX, fromY, t: 0 }
  }

  function update(dt) {
    if (retiring) {
      retiring.t += dt / 1.1
      if (retiring.t >= 1) { retiring = null; archived++ }
    }
    if (!flying) return
    flying.t += dt / 1.2
    if (flying.t >= 1) { flying.slot.page = flying.page; flying = null }
  }

  // Filed pages stick up out of the box, a few more every time the board overflows.
  function drawArchive(ctx) {
    const visible = Math.min(6, archived)
    for (let i = 0; i < visible; i++) {
      rect(ctx, ARCHIVE_BOX.x + 1 + (i % 2), ARCHIVE_BOX.y - 1 - i, ARCHIVE_BOX.w - 2, 1, i % 2 ? P.paper : P.paperShade)
    }
  }

  function drawPinned(ctx) {
    for (const slot of slots) {
      if (!slot.page || flying?.slot === slot) continue
      rect(ctx, slot.x + 1, slot.y + 1, PAGE.w, PAGE.h, 'rgba(30,16,8,0.45)')
      ctx.drawImage(slot.page.flatCanvas(), slot.x, slot.y)
      disc(ctx, slot.x + PAGE.w / 2, slot.y + 1, 1.5, slot.pin)
      px(ctx, slot.x + PAGE.w / 2 - 1, slot.y, '#ffffff')
    }
  }

  // The finished page sails across the room in an arc and lands on the board; a retired page
  // shrinks away into the comics box on the shelf.
  function drawFlying(ctx) {
    if (retiring) {
      const t = retiring.t
      const e = t * t * (3 - 2 * t)
      const scale = 1 - e * 0.75
      const x = retiring.fromX + (ARCHIVE_BOX.x - retiring.fromX) * e
      const y = retiring.fromY + (ARCHIVE_BOX.y - 12 - retiring.fromY) * e - Math.sin(t * Math.PI) * 30
      ctx.drawImage(retiring.page.flatCanvas(), Math.round(x), Math.round(y), Math.round(PAGE.w * scale), Math.round(PAGE.h * scale))
    }
    if (!flying) return
    const t = flying.t
    const e = t * t * (3 - 2 * t)
    const x = flying.fromX + (flying.slot.x - flying.fromX) * e
    const y = flying.fromY + (flying.slot.y - flying.fromY) * e - Math.sin(t * Math.PI) * 26
    rect(ctx, x + 2, y + 3, PAGE.w, PAGE.h, 'rgba(20,14,30,0.3)')
    ctx.drawImage(flying.page.flatCanvas(), Math.round(x), Math.round(y))
  }

  return { pin, update, drawPinned, drawArchive, drawFlying, get count() { return slots.filter((s) => s.page).length } }
}

function drawClockHands(ctx, hour, seconds) {
  const hand = (fraction, length, color) => {
    const a = fraction * Math.PI * 2
    line(ctx, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(a) * length, CLOCK.y - Math.cos(a) * length, color)
  }
  hand((hour % 12) / 12, 4.5, P.outline)
  hand(hour % 1, 7, P.outline)
  if (seconds !== null) hand(seconds / 60, 7, P.red)
  px(ctx, CLOCK.x, CLOCK.y, P.brass[2])
}

function drawRecordPlayer(ctx, angle, playing) {
  const { x, y } = RECORD
  ellipse(ctx, x, y + 1, 13, 3.5, '#2a2630')
  ellipse(ctx, x, y, 12, 3, '#141018')
  ellipse(ctx, x, y, 8, 2, '#221d2a')
  ellipse(ctx, x, y, 7, 1.5, '#141018')
  ellipse(ctx, x, y, 3, 1, '#ff7aa8')
  for (const offset of [0, Math.PI]) {
    const a = angle + offset
    px(ctx, x + Math.cos(a) * 9.5, y + Math.sin(a) * 2.2, '#77708a')
    px(ctx, x + Math.cos(a + 0.25) * 9.5, y + Math.sin(a + 0.25) * 2.2, '#4a4458')
  }
  px(ctx, x + Math.cos(angle * 1) * 2, y + Math.sin(angle) * 0.6, '#ffd0e0')
  px(ctx, x, y, P.metal[3])
  disc(ctx, x + 16, y - 2, 1.5, P.metal[2])
  const armEnd = playing ? { x: x + 7, y: y - 1 } : { x: x + 17, y: y + 3 }
  thickLine(ctx, x + 16, y - 2, armEnd.x, armEnd.y, 0.5, P.metal[3])
  rect(ctx, armEnd.x - 1, armEnd.y, 2, 1, P.metal[1])
}

function drawCat(ctx, t, earTwitch, tailFlick) {
  // A ginger cat asleep in a loaf on the sill: round body, big head resting at the front,
  // pointed ears, closed eyes, paws tucked, tail wrapped round with a cream tip that flicks.
  const { x, y } = CAT_SPOT
  const breath = Math.sin(t * 1.6) > 0.2 ? 1 : 0
  const outline = '#3f1d0a'
  const ramp = P.cat.slice(1)

  shadedEllipse(ctx, x + 2, y + 1 - breath * 0.5, 10, 5.5 + breath * 0.5, ramp, outline)
  for (const sx of [x + 2, x + 5, x + 8]) {
    px(ctx, sx, y - 3, P.cat[1]); px(ctx, sx - 1, y - 2, P.cat[1]); px(ctx, sx - 1, y - 1, P.cat[1])
  }

  // tail: round the back end and along the front, over the tucked paws
  thickLine(ctx, x + 11, y + 4, x + 6, y + 6, 1.5, outline)
  thickLine(ctx, x + 6, y + 6, x - 6, y + 6, 1.5, outline)
  line(ctx, x + 10, y + 4, x + 6, y + 5, P.cat[2])
  line(ctx, x + 6, y + 5, x - 5, y + 5, P.cat[2])
  line(ctx, x + 6, y + 6, x - 5, y + 6, P.cat[1])
  const tip = tailFlick > 0 ? -1 : 0
  rect(ctx, x - 7, y + 4 + tip, 3, 2, P.cat[4])

  const hx = x - 8, hy = y
  const twitch = earTwitch > 0 ? 1 : 0
  fillPoly(ctx, [[hx - 5, hy - 1], [hx - 4 - twitch, hy - 8], [hx, hy - 4]], outline)
  fillPoly(ctx, [[hx, hy - 4], [hx + 4, hy - 8], [hx + 5, hy - 1]], outline)
  fillPoly(ctx, [[hx - 4, hy - 2], [hx - 3 - twitch, hy - 6], [hx - 1, hy - 4]], P.cat[2])
  fillPoly(ctx, [[hx + 1, hy - 4], [hx + 3, hy - 6], [hx + 4, hy - 2]], P.cat[2])
  px(ctx, hx - 3 - twitch, hy - 4, P.tongue)
  px(ctx, hx + 3, hy - 4, P.tongue)
  shadedEllipse(ctx, hx, hy, 5.5, 4.5, ramp, outline)
  px(ctx, hx - 1, hy - 3, P.cat[1]); px(ctx, hx, hy - 4, P.cat[1]); px(ctx, hx + 1, hy - 3, P.cat[1])
  ellipse(ctx, hx, hy + 2, 2.5, 1.2, P.cat[4])
  // closed, content eyes
  px(ctx, hx - 3, hy, outline); px(ctx, hx - 2, hy + 1, outline); px(ctx, hx - 1, hy, outline)
  px(ctx, hx + 1, hy, outline); px(ctx, hx + 2, hy + 1, outline); px(ctx, hx + 3, hy, outline)
  px(ctx, hx, hy + 1, '#e86a80')
  px(ctx, hx, hy + 2, outline)
}

// The lava lamp's glowing glass: a magenta liquid with warm blobs that rise and sink slowly.
// Drawn after lighting because it gives light rather than receiving it.
const LAVA_BLOBS = [
  { period: 9.5, phase: 0, r: 2.2 },
  { period: 13, phase: 2.1, r: 1.6 },
  { period: 7.5, phase: 4.4, r: 1.9 },
]

function drawLavaLamp(ctx, env, t) {
  const { x, baseY, glassTop } = LAVA
  const bottom = baseY - 9
  const height = bottom - glassTop + 1
  const halfWidth = (y) => 1.6 + Math.sin(((y - glassTop) / height) * Math.PI * 0.85) * 1.8
  const strength = 0.55 + env.night * 0.45

  ctx.globalAlpha = 0.12 * strength
  disc(ctx, x, glassTop + height * 0.4, 11, '#ff7aa8')
  ctx.globalAlpha = strength
  for (let y = glassTop; y <= bottom; y++) {
    const hw = Math.round(halfWidth(y))
    rect(ctx, x - hw, y, hw * 2 + 1, 1, y > bottom - 5 ? '#d8487e' : '#9a2f72')
  }
  rect(ctx, x - 3, bottom - 1, 7, 2, '#ffa050')
  for (const blob of LAVA_BLOBS) {
    const travel = 0.5 + 0.5 * Math.sin((t / blob.period) * Math.PI * 2 + blob.phase)
    const by = bottom - 2 - travel * (height - 6)
    const r = Math.min(blob.r, halfWidth(by) - 0.4)
    disc(ctx, x, by, r, '#ffa050')
    px(ctx, x - 1, by - Math.floor(r), '#ffe0a8')
  }
  px(ctx, x - Math.round(halfWidth(glassTop + 6)) + 1, glassTop + 4, '#ffd0e8')
  ctx.globalAlpha = 1
}

export function drawMugAt(ctx, x, y) {
  rect(ctx, x - 1, y - 1, 9, 10, P.outline)
  rect(ctx, x, y, 7, 8, P.mug[2])
  rect(ctx, x + 5, y, 2, 8, P.mug[1])
  rect(ctx, x, y + 3, 7, 2, '#ff7aa8')
  rect(ctx, x + 1, y, 5, 1, '#5a3420')
  rect(ctx, x - 3, y + 2, 2, 4, P.outline)
  rect(ctx, x - 2, y + 3, 1, 2, P.mug[2])
}

export function createProps({ particles }) {
  const rng = createRng(21)
  const bulbs = fairyBulbs().map((b) => ({ ...b, rgb: hexRgb(b.color), glow: 1 }))
  const corkboard = createCorkboard([101, 102, 103, 104].map(createFinishedPage))
  let recordAngle = 0
  let nextNote = 1
  let earTwitch = 0, nextTwitch = rng.range(4, 9)
  let tailFlick = 0, nextFlick = rng.range(3, 7)

  function update(dt, world, smudge) {
    if (world.music.playing) {
      recordAngle += dt * Math.PI * 2 * 0.55
      nextNote -= dt
      if (nextNote <= 0) { particles.note(RECORD.x - 4 + rng.range(-3, 3), RECORD.y - 6); nextNote = rng.range(1.6, 2.6) }
    }
    if (!smudge.mugHeld) particles.steamFrom(MUG_HOME.x + 3, MUG_HOME.y - 1)
    earTwitch = Math.max(0, earTwitch - dt)
    nextTwitch -= dt
    if (nextTwitch <= 0) { earTwitch = 0.18; nextTwitch = rng.range(4, 11) }
    tailFlick = Math.max(0, tailFlick - dt)
    nextFlick -= dt
    if (nextFlick <= 0) { tailFlick = 0.35; nextFlick = rng.range(3, 8) }
    for (const b of bulbs) b.glow = 0.7 + 0.3 * Math.sin(world.time * 1.4 + b.phase)
    corkboard.update(dt)
  }

  function drawBack(ctx, world, smudge) {
    drawClockHands(ctx, world.env.hour, world.timeMode === 'auto' ? new Date().getSeconds() + new Date().getMilliseconds() / 1000 : null)
    drawRecordPlayer(ctx, recordAngle, world.music.playing)
    drawCat(ctx, world.time, earTwitch, tailFlick)
    if (!smudge.mugHeld) drawMugAt(ctx, MUG_HOME.x, MUG_HOME.y)
    corkboard.drawPinned(ctx)
    corkboard.drawArchive(ctx)
  }

  function drawFront(ctx) {
    corkboard.drawFlying(ctx)
  }

  // Emissive pass, after lighting: these make light rather than receive it.
  function drawGlow(ctx, env, lamp, t) {
    drawLavaLamp(ctx, env, t)
    for (const b of bulbs) {
      ctx.globalAlpha = 0.22 * env.fairy * b.glow
      disc(ctx, b.x, b.y + 1, 2.5, b.color)
      ctx.globalAlpha = Math.min(1, 0.5 + env.fairy * b.glow * 0.6)
      rect(ctx, b.x, b.y, 1, 2, b.color)
      px(ctx, b.x, b.y, '#ffffff')
    }
    ctx.globalAlpha = 1
    if (lamp > 0.05) {
      ctx.globalAlpha = 0.06 * lamp
      fillPoly(ctx, [[LAMP.headX - 6, LAMP.headY + 6], [LAMP.headX + 4, LAMP.headY + 4], [LAMP_POOL.x + 22, LAMP_POOL.y + 14], [LAMP_POOL.x - 22, LAMP_POOL.y + 16]], '#ffe0a0')
      ctx.globalAlpha = 0.35 * lamp
      disc(ctx, LAMP.bulbX, LAMP.bulbY, 3, '#fff0c8')
      ctx.globalAlpha = lamp
      rect(ctx, LAMP.bulbX - 1, LAMP.bulbY - 1, 3, 2, '#fffbe8')
      ctx.globalAlpha = 1
    }
    if (env.night > 0.4) {
      ctx.globalAlpha = env.night * 0.25
      disc(ctx, FIGURINE.x, FIGURINE.y - 2, 6, '#fff0a0')
      ctx.globalAlpha = 1
    }
  }

  return { update, drawBack, drawFront, drawGlow, corkboard, bulbs }
}
