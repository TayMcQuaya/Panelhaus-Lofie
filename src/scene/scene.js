// Composes a frame: the outside view, the room and Smudge (lit by the light map), then everything
// that emits light on top.
import { makeLayer, W, H } from '../engine/canvas.js'
import { createSpring, stepSpring } from '../engine/ease.js'
import { createSmudge } from '../smudge/smudge.js'
import { createCity } from './city.js'
import { createLighting } from './lighting.js'
import { createPaperBalls } from './paperBalls.js'
import { createParticles } from './particles.js'
import { createProps } from './props.js'
import { createRoom, SHELL_MARGIN } from './room.js'
import { createSky } from './sky.js'
import { timeOfDay } from './timeOfDay.js'
import { createWeather } from './weather.js'
import { WEATHERS } from '../ui/settings.js'

export function createScene({ seed = 1, startProgress = 0.35, firstActivity = null, onThunder }) {
  const outside = makeLayer(W, H)
  const scene = makeLayer(W, H, true)
  const room = createRoom()
  const lighting = createLighting()
  const sky = createSky()
  const city = createCity()
  const weather = createWeather(onThunder)
  const particles = createParticles()
  const props = createProps({ particles })
  const paper = createPaperBalls()
  const smudge = createSmudge({ corkboard: props.corkboard, particles, paper, seed, startProgress, firstActivity })
  const lamp = createSpring(-1)
  // How much of each weather is showing. It eases toward the chosen one over world.weatherFade seconds.
  let mix = null

  function blendWeather(dt, world) {
    mix ??= { [world.weather]: 1 }
    const step = dt / Math.max(0.01, world.weatherFade ?? 0.01)
    const next = Object.fromEntries(WEATHERS.map((w) => {
      const now = mix[w] ?? 0
      return [w, w === world.weather ? Math.min(1, now + step) : Math.max(0, now - step)]
    }))
    const total = Object.values(next).reduce((a, b) => a + b, 0)
    mix = Object.fromEntries(Object.entries(next).map(([w, v]) => [w, v / total]))
  }

  function update(dt, world) {
    blendWeather(dt, world)
    world.env = timeOfDay(world.hour, world.weather, mix)
    if (lamp.x < 0) lamp.x = world.env.lampOn ? 1 : 0
    stepSpring(lamp, world.env.lampOn ? 1 : 0, 5, dt)
    sky.update(dt, world.env)
    city.update(dt, world.env)
    weather.update(dt, world.weather, mix)
    world.flash = weather.flash
    particles.update(dt)
    paper.update(dt)
    props.update(dt, world, smudge)
    smudge.update(dt, world)
  }

  // The bare room around the frame, tinted by the same daylight as the room inside it.
  function renderShell(ctx, world, view) {
    const { ambient } = world.env
    ctx.drawImage(room.shell, view.offsetX - SHELL_MARGIN.x, view.offsetY - SHELL_MARGIN.y)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = `rgb(${ambient.map((c) => Math.round(Math.min(1, c) * 255)).join(',')})`
    ctx.fillRect(0, 0, view.width, view.height)
    if (world.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'
      const f = Math.round(world.flash * 120)
      ctx.fillStyle = `rgb(${f},${f},${Math.round(f * 1.2)})`
      ctx.fillRect(0, 0, view.width, view.height)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function render(ctx, world) {
    const { env } = world
    const o = outside.ctx
    sky.draw(o, env, world.time)
    city.draw(o, env, world.time)
    weather.drawOutside(o, mix)

    const s = scene.ctx
    s.clearRect(0, 0, W, H)
    s.drawImage(room.back, 0, 0)
    props.drawBack(s, world, smudge)
    particles.drawRoom(s)
    paper.drawLanded(s)
    smudge.draw(s, room.stool)
    paper.drawFlying(s)
    props.drawFront(s)
    lighting.apply(s, env, { lamp: Math.max(0, lamp.x), bulbs: props.bulbs, fairy: env.fairy, flash: world.flash })

    ctx.drawImage(outside.canvas, 0, 0)
    ctx.drawImage(scene.canvas, 0, 0)
    weather.drawGlass(ctx, mix)
    props.drawGlow(ctx, env, Math.max(0, lamp.x), world.time)
    particles.drawGlow(ctx, env, Math.max(0, lamp.x))
  }

  return { update, render, renderShell, smudge, strikeLightning: weather.strike }
}
