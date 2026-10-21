// Light map: ambient tint for the time of day plus warm and cool light pools, quantised with
// ordered dithering so the falloff stays pixel art. 128 in the light map means "lit as drawn".
import { makeLayer, W, H } from '../engine/canvas.js'
import { bayer } from '../engine/draw.js'
import { mixRgb } from '../engine/ease.js'
import { CLOCK, FIGURINE, FLOOR_Y, LAMP_POOL, LAMP, LAVA, SMUDGE_HOME } from './layout.js'

const STEPS = 10

function addRadial(ctx, x, y, radius, rgb, intensity) {
  if (intensity <= 0.002) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  const c = (k) => `rgb(${Math.round(rgb[0] * intensity * k * 0.5)},${Math.round(rgb[1] * intensity * k * 0.5)},${Math.round(rgb[2] * intensity * k * 0.5)})`
  g.addColorStop(0, c(1))
  g.addColorStop(0.45, c(0.45))
  g.addColorStop(1, 'rgb(0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function addPolygon(ctx, points, rgb, intensity) {
  if (intensity <= 0.002) return
  ctx.fillStyle = `rgb(${Math.round(rgb[0] * intensity * 0.5)},${Math.round(rgb[1] * intensity * 0.5)},${Math.round(rgb[2] * intensity * 0.5)})`
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
}

// Light coming through the two lower panes, thrown across the floor away from the sun or moon.
function windowBeams(sourceX) {
  const throwX = (178 - sourceX) * 0.9
  return [[106, 175], [180, 249]].map(([x0, x1]) => [
    [x0, 140], [x1, 140], [x1 + throwX + 24, FLOOR_Y + 30], [x0 + throwX - 4, FLOOR_Y + 30],
  ])
}

export function createLighting() {
  const map = makeLayer(W, H, true)

  function buildMap(env, extras) {
    const ctx = map.ctx
    ctx.globalCompositeOperation = 'source-over'
    const a = env.ambient
    ctx.fillStyle = `rgb(${Math.round(a[0] * 128)},${Math.round(a[1] * 128)},${Math.round(a[2] * 128)})`
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'

    const lamp = extras.lamp
    addRadial(ctx, LAMP_POOL.x, LAMP_POOL.y, 64, [255, 196, 130], lamp * 0.78)
    addRadial(ctx, LAMP_POOL.x - 10, LAMP_POOL.y + 10, 170, [255, 170, 110], lamp * 0.36)
    addRadial(ctx, LAMP.bulbX, LAMP.bulbY, 12, [255, 230, 180], lamp * 0.8)
    addRadial(ctx, SMUDGE_HOME.x + 14, SMUDGE_HOME.seatY - 30, 30, [255, 190, 120], lamp * 0.28)

    for (const bulb of extras.bulbs) {
      addRadial(ctx, bulb.x, bulb.y + 2, 16, bulb.rgb, extras.fairy * 0.38 * bulb.glow)
    }

    const sunColor = mixRgb([255, 236, 196], [255, 170, 110], env.sun.low ?? 0)
    if (env.sun.visible && env.sunBeam > 0.05) {
      for (const beam of windowBeams(env.sun.x)) addPolygon(ctx, beam, sunColor, env.sunBeam * 0.3)
    }
    if (env.moon.visible && env.moonBeam > 0.05) {
      for (const beam of windowBeams(env.moon.x)) addPolygon(ctx, beam, [140, 160, 255], env.moonBeam * 0.3)
    }
    addRadial(ctx, 178, 90, 150, [255, 250, 240], env.daylight * (1 - env.overcast * 0.5) * 0.12)
    addRadial(ctx, 145, 124, 46, [255, 90, 160], (env.night > 0.25 || env.overcast > 0.6 ? 1 : 0) * 0.45)
    addRadial(ctx, FIGURINE.x, FIGURINE.y, 14, [255, 220, 120], env.night * 0.55)
    // The lava lamp washes the right side of the room in a soft pink-orange.
    addRadial(ctx, LAVA.x, LAVA.glassTop + 5, 95, [255, 120, 160], 0.15 + env.night * 0.4)
    addRadial(ctx, LAVA.x + 30, LAVA.glassTop - 60, 120, [255, 150, 170], env.night * 0.28)
    addRadial(ctx, LAVA.x, LAVA.glassTop + 6, 28, [255, 170, 110], 0.2 + env.night * 0.45)
    addRadial(ctx, CLOCK.x, CLOCK.y, 18, [255, 200, 150], lamp * 0.15)

    if (extras.flash > 0) {
      ctx.fillStyle = `rgb(${Math.round(120 * extras.flash)},${Math.round(126 * extras.flash)},${Math.round(150 * extras.flash)})`
      ctx.fillRect(0, 0, W, H)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function apply(sceneCtx, env, extras) {
    buildMap(env, extras)
    const scene = sceneCtx.getImageData(0, 0, W, H)
    const light = map.ctx.getImageData(0, 0, W, H).data
    const s = scene.data
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4
        if (s[o + 3] === 0) continue
        const t = bayer(x, y)
        s[o] = Math.min(255, s[o] * (Math.floor((light[o] / 128) * STEPS + t) / STEPS))
        s[o + 1] = Math.min(255, s[o + 1] * (Math.floor((light[o + 1] / 128) * STEPS + t) / STEPS))
        s[o + 2] = Math.min(255, s[o + 2] * (Math.floor((light[o + 2] / 128) * STEPS + t) / STEPS))
      }
    }
    sceneCtx.putImageData(scene, 0, 0)
  }

  return { apply }
}
