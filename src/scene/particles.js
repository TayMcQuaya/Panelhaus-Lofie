// Small living things: ink drips that leave a growing stain, mug steam, music notes, dust motes.
import { drawSprite, px } from '../engine/draw.js'
import { createRng } from '../engine/rng.js'
import { FRONT_FLOOR_Y, LAMP, LAMP_POOL } from './layout.js'

const NOTE = ['..#.', '..##', '..#.', '..#.', '###.', '##..']
const STAIN_LIMIT = 80

export function createParticles() {
  const rng = createRng(5)
  const drips = []
  const steam = []
  const notes = []
  const stain = [[262, 164], [263, 164], [266, 165], [240, 164]]
  const dust = Array.from({ length: 22 }, () => ({ x: rng.range(0, 1), y: rng.range(0, 1), phase: rng.range(0, 6), speed: rng.range(0.4, 1.2) }))
  let steamBudget = 0

  // A drop of ink that falls until it lands (on the desk by default, the floor otherwise).
  function inkDrip(x, y, landY = FRONT_FLOOR_Y + rng.int(0, 5)) {
    drips.push({ x: Math.round(x), y, vy: 0, landY })
  }

  function steamFrom(x, y) {
    steamBudget += 1
    if (steamBudget < 14) return
    steamBudget = 0
    steam.push({ x: x + rng.range(-1, 1), y, life: 0, max: rng.range(1.6, 2.6), phase: rng.range(0, 6) })
  }

  function note(x, y) {
    notes.push({ x, y, life: 0, max: 3.4, phase: rng.range(0, 6), color: rng.pick(['#fff2c4', '#ff9ec4', '#ffd84a', '#9fe8da']) })
  }

  function update(dt) {
    for (const d of drips) {
      d.vy += 260 * dt
      d.y += d.vy * dt
      if (d.y >= d.landY) {
        d.done = true
        if (stain.length < STAIN_LIMIT) stain.push([d.x + rng.int(-1, 1), d.landY], [d.x + rng.int(-2, 2), d.landY + rng.int(0, 1)])
      }
    }
    for (const s of steam) { s.life += dt; s.y -= 7 * dt; s.x += Math.sin(s.life * 3 + s.phase) * 3 * dt }
    for (const n of notes) { n.life += dt; n.y -= 8 * dt; n.x += Math.sin(n.life * 2 + n.phase) * 5 * dt }
    for (const m of dust) { m.phase += dt * m.speed }
    remove(drips, (d) => d.done)
    remove(steam, (s) => s.life > s.max)
    remove(notes, (n) => n.life > n.max)
  }

  // Lit with the room: drips and the stain on the floor.
  function drawRoom(ctx) {
    for (const [x, y] of stain) px(ctx, x, y, '#1b2240')
    for (const d of drips) {
      px(ctx, d.x, d.y, '#1b2240')
      px(ctx, d.x, d.y - 1, '#2d3c72')
    }
  }

  // Drawn over the lit scene: steam, notes and dust catching the light.
  function drawGlow(ctx, env, lamp) {
    for (const s of steam) {
      ctx.globalAlpha = 0.45 * (1 - s.life / s.max)
      px(ctx, s.x, s.y, '#f4eee4')
      if (s.life < s.max * 0.5) px(ctx, s.x + 1, s.y + 1, '#f4eee4')
    }
    for (const n of notes) {
      ctx.globalAlpha = Math.min(1, n.life * 2) * (1 - n.life / n.max) * 0.9
      drawSprite(ctx, NOTE, { '#': n.color }, Math.round(n.x), Math.round(n.y))
    }
    const motes = lamp > 0.3 ? 'lamp' : env.sunBeam > 0.3 ? 'sun' : null
    if (motes) {
      for (const m of dust) {
        const x = motes === 'lamp' ? LAMP.headX - 22 + m.x * 34 + Math.sin(m.phase) * 3 : 140 + m.x * 120 + Math.sin(m.phase) * 4
        const y = motes === 'lamp' ? LAMP.headY + 6 + m.y * (LAMP_POOL.y - LAMP.headY - 4) + Math.cos(m.phase * 0.7) * 2 : 150 + m.y * 70 + Math.cos(m.phase * 0.7) * 3
        ctx.globalAlpha = (0.25 + 0.35 * Math.sin(m.phase * 2.3) ** 2) * (motes === 'lamp' ? lamp : env.sunBeam)
        px(ctx, x, y, motes === 'lamp' ? '#ffe2a8' : '#fff8e0')
      }
    }
    ctx.globalAlpha = 1
  }

  return { inkDrip, steamFrom, note, update, drawRoom, drawGlow }
}

function remove(list, predicate) {
  for (let i = list.length - 1; i >= 0; i--) if (predicate(list[i])) list.splice(i, 1)
}
