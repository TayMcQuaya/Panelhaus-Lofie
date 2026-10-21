// Smudge, seen from behind at his drafting board. A behaviour loop drives a part-based rig through
// critically damped springs, so every move eases in and out.
//
// The rig: a sponge ball with one shoulder on each side (always the same two points), two noodle
// arms solved with IK, dangling legs, and a face that only exists when he turns. `turn` runs from
// 0 (back to us) to 1 (facing us); negative values mean he glances left over his shoulder. While
// his back is to us the arms reach away from us, so the body is drawn over them; once he has
// turned more than halfway they are in front of him and drawn over the body.
import { clamp, createSpring, stepSpring } from '../engine/ease.js'
import { createRng } from '../engine/rng.js'
import { DESK, DESK_REST, INK_JAR, MUG_HOME, PAGE, SMUDGE_HOME, STOOL, pageToScreen } from '../scene/layout.js'
import { drawBall } from '../scene/paperBalls.js'
import { drawMugAt } from '../scene/props.js'
import { bodySprite } from './body.js'
import { createComicPage } from './comicPage.js'
import { drawFace } from './face.js'
import { drawBoot, drawHand, drawLimb, drawTool, solveIK } from './limbs.js'

const ARM = { upper: 14, lower: 15 }
const SHOULDER = { x: 18, y: 3 }
const PEN_OFFSET = { x: -1, y: 4 }
const FACE_EDGE = 18
const TOOL_FOR_LAYER = { pencil: 'pencil', ink: 'ink', fill: 'fill' }
const BREAKS = ['think', 'stretch', 'glance', 'coffee', 'breathe']
const DURATION = { switch: 1.2, dip: 2.6, think: 5, stretch: 4.6, glance: 4.4, coffee: 10, breathe: 10.5, show: 6.2, reject: 5.4 }
const REJECT_CHANCE = 0.25
const BIN_AIM = 0.45
const TIDY_AT = 6
const TIDY = { turn: 1.2, perBall: 1.7 }

const vecSpring = (p) => ({ x: createSpring(p.x), y: createSpring(p.y) })
const stepVec = (s, target, omega, dt) => { stepSpring(s.x, target.x, omega, dt); stepSpring(s.y, target.y, omega, dt) }
const vec = (s) => ({ x: s.x.x, y: s.y.x })
const phase = (t, ...edges) => edges.filter((e) => t >= e).length

export function createSmudge({ corkboard, particles, paper, seed = 1, startProgress = 0.35, firstActivity = null }) {
  const rng = createRng(seed * 31 + 7)
  let pageNumber = corkboard.count + 1
  let drafts = 0
  const pageSeed = () => seed * 1000 + pageNumber + drafts * 7919
  let page = createComicPage(pageSeed())
  page.skipTo(startProgress)

  const state = {
    activity: 'draw',
    t: 0,
    drawBout: rng.range(10, 18),
    lastBreak: null,
    tool: TOOL_FOR_LAYER[page.layerNow()] ?? 'pencil',
    inkAtLastDip: page.inkLaid(),
    mugHeld: false,
    heldPage: null,
    pageScale: 1,
    ballIn: null,
    tidyQueue: [],
    reviewed: false,
    pageSwapped: false,
    nextDrip: rng.range(5, 10),
    blinkIn: rng.range(1.5, 4),
    blinking: 0,
    startled: 0,
    startleCooldown: 0,
    squashOverride: null,
    eyes: 'open',
    mouth: 'smile',
    nightness: 0,
    clock: 0,
  }

  const lean = createSpring(0)
  const lift = createSpring(0)
  const turn = createSpring(0)
  const look = vecSpring({ x: 0, y: 0 })
  const rightHand = vecSpring(DESK_REST.right)
  const leftHand = vecSpring(DESK_REST.left)
  const heldPagePos = vecSpring(PAGE.origin)

  let squash = { rx: 20, ry: 19 }
  let center = { x: SMUDGE_HOME.x, y: SMUDGE_HOME.seatY - 19 }
  let legSwing = 0

  const shoulders = () => ({
    left: { x: center.x - SHOULDER.x, y: center.y + SHOULDER.y },
    right: { x: center.x + SHOULDER.x, y: center.y + SHOULDER.y },
  })
  const lap = () => ({ left: { x: center.x - 9, y: center.y + 13 }, right: { x: center.x + 9, y: center.y + 13 } })
  // Relaxed, hanging arms that react to the swivel: they swing out mid-turn, trail behind the
  // rotation, and sway a little, so a turn never looks like a statue being rotated.
  const sides = () => {
    const swing = Math.sin(clamp(Math.abs(turn.x), 0, 1) * Math.PI) * 7
    const drag = clamp(-turn.v * 7, -7, 7)
    const sway = Math.sin(state.clock * 2.1) * 1.2
    return {
      left: { x: center.x - 18 - swing + drag, y: center.y + 15 - swing * 0.6 + sway },
      right: { x: center.x + 18 + swing + drag, y: center.y + 15 - swing * 0.6 - sway },
    }
  }
  const mouth = () => ({ x: center.x, y: center.y + 3 })
  const penTipScreen = () => {
    const p = pageToScreen(page.tip.x, page.tip.y)
    return { x: p.x, y: p.y + (page.tip.lifted ? 1 : 0) }
  }
  const penHandFor = (tip) => ({ x: tip.x + PEN_OFFSET.x, y: tip.y + PEN_OFFSET.y })
  const facingUs = () => turn.x > 0.5

  function begin(activity) {
    state.activity = activity
    state.t = 0
    state.pageSwapped = false
    state.squashOverride = null
    if (activity === 'draw') state.drawBout = rng.range(10, 18)
  }

  function pickBreak() {
    if (paper.floor.length >= TIDY_AT) {
      state.tidyQueue = [...paper.floor]
      begin('tidy')
      return
    }
    const weights = { think: 2.5, stretch: state.nightness > 0.5 ? 2 : 1.2, glance: 2, coffee: 2.2, breathe: 1.4 }
    const options = BREAKS.filter((b) => b !== state.lastBreak)
    const total = options.reduce((sum, b) => sum + weights[b], 0)
    let roll = rng.next() * total
    const choice = options.find((b) => (roll -= weights[b]) <= 0) ?? options[0]
    state.lastBreak = choice
    begin(choice)
  }

  function updateDraw(dt, targets) {
    if (page.done) { begin('show'); return }
    const needed = TOOL_FOR_LAYER[page.layerNow()]
    // When the pencils are done he looks the sketch over, and sometimes it doesn't make the cut.
    if (needed === 'ink' && !state.reviewed) {
      state.reviewed = true
      if (rng.chance(REJECT_CHANCE)) { begin('reject'); return }
    }
    if (needed !== state.tool) { begin(needed === 'ink' ? 'dip' : 'switch'); return }
    if (state.tool === 'ink' && page.inkLaid() - state.inkAtLastDip > 80) { begin('dip'); return }
    state.drawBout -= dt
    if (state.drawBout <= 0 && page.tip.lifted) { pickBreak(); return }

    page.advance(dt)
    const tip = penTipScreen()
    targets.right = penHandFor(tip)
    targets.rightOmega = 36
    // Lean and rise toward the stroke so the arm keeps a comfortable bend.
    targets.lean = clamp((tip.x - (SMUDGE_HOME.x + 26)) * 0.3, -2, 6)
    targets.lift = clamp((tip.y - 152) * 0.25, -4, 0)
    if (state.tool === 'ink') {
      state.nextDrip -= dt
      if (state.nextDrip <= 0) {
        const hand = vec(rightHand)
        particles.inkDrip(hand.x, hand.y + 3, DESK.frontY - 1)
        state.nextDrip = rng.range(6, 13)
      }
    }
  }

  function updateSwitch(targets) {
    targets.right = DESK_REST.right
    if (state.t > 0.6) state.tool = TOOL_FOR_LAYER[page.layerNow()] ?? state.tool
    if (state.t >= DURATION.switch) begin('draw')
  }

  function updateDip(targets) {
    const t = state.t
    const jarHand = penHandFor({ x: INK_JAR.mouthX, y: INK_JAR.mouthY })
    if (t < 1.5) {
      const bob = t > 0.7 ? Math.sin((t - 0.7) * 12) * 1.5 + 1.5 : 0
      targets.right = { x: jarHand.x, y: jarHand.y + bob }
      targets.lean = 8
    } else {
      targets.right = penHandFor(penTipScreen())
    }
    if (t > 1.2 && state.tool !== 'ink') {
      state.tool = 'ink'
      particles.inkDrip(INK_JAR.mouthX, INK_JAR.mouthY + 2, DESK.frontY - 1)
    }
    if (t >= DURATION.dip) { state.inkAtLastDip = page.inkLaid(); begin('draw') }
  }

  // Back to us: scratches the top of his head, then gets an idea and leans in.
  function updateThink(targets) {
    const t = state.t
    const scratching = t > 0.5 && t < 3.6
    targets.right = scratching ? { x: center.x + 9 + Math.sin(t * 22) * 1.5, y: center.y - 18 } : DESK_REST.right
    targets.lean = scratching ? -1 : 2
    targets.lift = t > 3.6 && t < 4.4 ? -2 : 0
    if (t >= DURATION.think) begin('draw')
  }

  // Back to us: both arms up over his head, body stretched tall.
  function updateStretch(targets) {
    const up = state.t > 0.4 && state.t < 3.6
    targets.right = up ? { x: center.x + 13, y: center.y - 36 } : DESK_REST.right
    targets.left = up ? { x: center.x - 13, y: center.y - 36 } : DESK_REST.left
    targets.lift = up ? -3 : 0
    state.squashOverride = up ? { rx: 19, ry: 21 } : null
    if (state.t >= DURATION.stretch) begin('draw')
  }

  // Glances left at the window over his shoulder: his face peeks round the side of the ball.
  function updateGlance(targets) {
    const t = state.t
    targets.turn = t > 0.3 && t < 3.6 ? -0.42 : 0
    targets.look = { x: -1, y: -1 }
    state.mouth = 'smile'
    if (t >= DURATION.glance) begin('draw')
  }

  // Takes the mug from the desk, swivels round to us, sips twice, turns back and puts it down.
  function updateCoffee(targets) {
    const t = state.t
    const grip = { x: MUG_HOME.x + 3, y: MUG_HOME.y + 4 }
    const p = phase(t, 1.2, 2.4, 4.4, 5.4, 6.8, 8.0, 9.2)
    if (p === 0) targets.left = grip
    if (p >= 1 && p < 7) state.mugHeld = true
    if (p === 1) { targets.turn = 1; targets.left = sides().left }
    if (p === 2 || p === 4) { targets.turn = 1; targets.left = { x: mouth().x - 2, y: mouth().y + 4 }; state.eyes = 'happy'; state.mouth = 'hidden' }
    if (p === 3) { targets.turn = 1; targets.left = lap().left; state.mouth = 'grin' }
    if (p === 5) targets.left = sides().left
    if (p === 6) targets.left = grip
    if (p >= 1 && p <= 4) targets.right = sides().right
    if (state.mugHeld && p >= 2 && p <= 4) particles.steamFrom(vec(leftHand).x - 1, vec(leftHand).y - 7)
    if (p === 7) state.mugHeld = false
    if (t >= DURATION.coffee) { state.mugHeld = false; begin('draw') }
  }

  // Turns round, closes his eyes and breathes: arms float up on the in-breath, down on the out-breath.
  function updateBreathe(targets) {
    const t = state.t
    const facing = t > 0.2 && t < 9
    targets.turn = facing ? 1 : 0
    if (t < 1.4 || t > 8.6) {
      if (facing) { targets.left = sides().left; targets.right = sides().right }
      return t >= DURATION.breathe && begin('draw')
    }
    const inhale = Math.sin(((t - 1.4) / 3.6) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5
    targets.left = { x: center.x - 24, y: center.y + 12 - inhale * 26 }
    targets.right = { x: center.x + 24, y: center.y + 12 - inhale * 26 }
    targets.lift = -inhale * 2
    state.squashOverride = inhale > 0.6 ? { rx: 19, ry: 21 } : inhale < 0.25 ? { rx: 21, ry: 18 } : null
    state.eyes = 'happy'
    state.mouth = inhale > 0.5 ? 'o' : 'smile'
  }

  // Page finished: lifts it off the board, turns round to show it to us, grins, and it flies to
  // the corkboard while he turns back to a fresh sheet.
  function updateShow(targets) {
    const t = state.t
    const p = phase(t, 0.8, 2.0, 4.2, 5.4)
    const held = { x: center.x - PAGE.w / 2, y: center.y - 2 }
    if (p === 0) {
      targets.left = pageToScreen(1, PAGE.h / 2)
      targets.right = pageToScreen(PAGE.w - 1, PAGE.h / 2)
      targets.lean = 4
    } else if (p <= 2) {
      state.heldPage = page
      targets.held = p === 1 ? { x: center.x - PAGE.w / 2, y: center.y - 30 } : held
      targets.turn = 1
      const hp = vec(heldPagePos)
      targets.left = { x: hp.x, y: hp.y + PAGE.h / 2 }
      targets.right = { x: hp.x + PAGE.w, y: hp.y + PAGE.h / 2 }
      targets.leftOmega = 16
      targets.rightOmega = 16
      if (p === 2) {
        state.eyes = 'happy'
        state.mouth = 'grin'
        targets.lift = -1 - Math.abs(Math.sin(t * 7)) * 2
        legSwing += 0.08
      }
    } else {
      if (!state.pageSwapped) {
        state.pageSwapped = true
        state.heldPage = null
        const hp = vec(heldPagePos)
        corkboard.pin(page, hp.x, hp.y)
        pageNumber++
        freshPage()
      }
      targets.turn = p === 3 ? 1 : 0
      if (p === 3) { targets.left = sides().left; targets.right = sides().right; state.mouth = 'smile' }
    }
    if (t >= DURATION.show) begin('draw')
  }

  function freshPage() {
    page = createComicPage(pageSeed())
    state.inkAtLastDip = 0
    state.tool = 'pencil'
    state.reviewed = false
  }

  // Not happy with the sketch: a head shake, the page comes off the board, gets crumpled into a
  // ball over his head and thrown over his shoulder at the bin. He doesn't always hit it.
  function updateReject(targets) {
    const t = state.t
    const p = phase(t, 1.4, 2.2, 3.4, 3.9)
    const overHead = { x: center.x - PAGE.w / 2, y: center.y - 46 }
    if (p === 0) {
      targets.lean = -2 + (t > 0.4 && t < 1.3 ? Math.sin(t * 16) * 2 : 0)
      return
    }
    if (p === 1) {
      targets.left = pageToScreen(2, 8)
      targets.right = pageToScreen(PAGE.w - 2, 8)
      targets.lean = 3
      return
    }
    if (p === 2) {
      state.heldPage = page
      targets.held = overHead
      state.pageScale = clamp(1 - (t - 2.6) / 0.8, 0, 1)
      const hp = vec(heldPagePos)
      const squeeze = (1 - state.pageScale) * (PAGE.w / 2 - 3)
      targets.left = { x: hp.x + squeeze, y: hp.y + PAGE.h / 2 }
      targets.right = { x: hp.x + PAGE.w - squeeze, y: hp.y + PAGE.h / 2 }
      targets.leftOmega = 14
      targets.rightOmega = 14
      if (state.pageScale === 0) { state.heldPage = null; state.ballIn = 'right' }
      return
    }
    if (p === 3) {
      state.heldPage = null
      state.ballIn = 'right'
      targets.right = { x: center.x + 14, y: center.y - 34 }
      targets.lift = -2
      return
    }
    if (state.ballIn) {
      const hand = vec(rightHand)
      paper.throwBall(hand.x, hand.y, rng.chance(BIN_AIM))
      state.ballIn = null
      state.pageScale = 1
      drafts++
      freshPage()
    }
    if (t >= DURATION.reject) begin('draw')
  }

  // Too many misses on the floor: he turns round and, being a sponge, stretches an arm all the
  // way down to each ball and lobs it into the bin.
  function updateTidy(targets) {
    const t = state.t
    const queue = state.tidyQueue
    const workEnd = TIDY.turn + queue.length * TIDY.perBall
    targets.turn = t < workEnd ? 1 : 0
    targets.look = { x: 0, y: 1 }
    state.squashOverride = null
    if (t < TIDY.turn || t >= workEnd) {
      if (t >= workEnd + TIDY.turn + 0.3) { state.tidyQueue = []; begin('draw') }
      return
    }
    const index = Math.floor((t - TIDY.turn) / TIDY.perBall)
    const local = (t - TIDY.turn) % TIDY.perBall
    const ball = queue[index]
    const side = ball.x < center.x ? 'left' : 'right'
    const sideSign = side === 'left' ? -1 : 1
    targets.lean = sideSign * 4
    if (local < 0.7) {
      targets[side] = { x: ball.x, y: ball.y - 2 }
      targets[`${side}Omega`] = 7
    } else if (local < 1.15) {
      if (!state.ballIn) { paper.takeFromFloor(ball); state.ballIn = side }
      targets[side] = { x: center.x + sideSign * 20, y: center.y - 12 }
      targets[`${side}Omega`] = 12
    } else if (state.ballIn) {
      const hand = vec(side === 'left' ? leftHand : rightHand)
      paper.throwBall(hand.x, hand.y, true)
      state.ballIn = null
    }
    state.mouth = index === queue.length - 1 && local > 1.15 ? 'grin' : 'smile'
  }

  function updateBlink(dt) {
    if (state.blinking > 0) { state.blinking -= dt; return }
    state.blinkIn -= dt
    if (state.blinkIn <= 0) {
      state.blinking = 0.13
      state.blinkIn = rng.chance(0.2) ? 0.25 : rng.range(2.2, 5.5)
    }
  }

  function update(dt, world) {
    state.nightness = world.env.night
    state.clock = world.time
    state.t += dt
    state.eyes = world.env.hour >= 23.5 || world.env.hour < 4 ? 'sleepy' : 'open'
    state.mouth = 'smile'
    state.startleCooldown -= dt

    const targets = {
      right: DESK_REST.right, left: DESK_REST.left, lean: 0, lift: 0, turn: 0,
      look: { x: 0, y: 0 }, rightOmega: 9, leftOmega: 8, held: null,
    }

    if (world.flash > 0.7 && state.startleCooldown <= 0 && state.activity !== 'show') {
      state.startleCooldown = 6
      state.startled = 0.9
    }

    switch (state.activity) {
      case 'draw': updateDraw(dt, targets); break
      case 'switch': updateSwitch(targets); break
      case 'dip': updateDip(targets); break
      case 'think': updateThink(targets); break
      case 'stretch': updateStretch(targets); break
      case 'glance': updateGlance(targets); break
      case 'coffee': updateCoffee(targets); break
      case 'breathe': updateBreathe(targets); break
      case 'show': updateShow(targets); break
      case 'reject': updateReject(targets); break
      case 'tidy': updateTidy(targets); break
    }

    // Lightning: he jumps and peeks round at the window.
    if (state.startled > 0) {
      state.startled -= dt
      targets.lift = -3
      if (turn.x < 0.5) targets.turn = -0.4
      state.eyes = 'open'
      state.mouth = 'o'
      targets.look = { x: -1, y: -1 }
    }
    updateBlink(dt)
    if (state.blinking > 0 && state.eyes !== 'happy') state.eyes = 'blink'

    // While swivelling, the arms swing out to his sides so they pass the body edge cleanly.
    const swivelling = Math.abs(turn.x - targets.turn) > 0.15 && Math.abs(targets.turn) > 0.6
    if (swivelling && !state.mugHeld && !state.heldPage && !state.ballIn) {
      targets.left = sides().left
      targets.right = sides().right
      targets.leftOmega = 6
      targets.rightOmega = 6
    }

    stepSpring(lean, targets.lean, 6, dt)
    stepSpring(lift, targets.lift, 10, dt)
    stepSpring(turn, targets.turn, 5, dt)
    stepVec(look, targets.look, 10, dt)
    stepVec(rightHand, targets.right, targets.rightOmega, dt)
    stepVec(leftHand, targets.left, targets.leftOmega, dt)
    if (targets.held) stepVec(heldPagePos, targets.held, 6, dt)

    const breathing = Math.sin(world.time * (Math.PI * 2) / 4.2) > 0.35
    const onBeat = world.music.playing && world.music.beatPhase < 0.16
    squash = state.squashOverride ?? (onBeat ? { rx: 21, ry: 18 } : breathing ? { rx: 20, ry: 20 } : { rx: 20, ry: 19 })
    center = {
      x: Math.round(SMUDGE_HOME.x + lean.x),
      y: Math.round(SMUDGE_HOME.seatY - squash.ry + lift.x),
    }
    legSwing += dt * 1.4
  }

  // Legs dangle to the foot ring. From behind they hang on the far side of the stool, in its
  // shadow; facing us they come down in front of it.
  function drawLegs(ctx) {
    const front = facingUs()
    for (const side of [-1, 1]) {
      const swing = Math.sin(legSwing + (side > 0 ? 0 : 1.7)) * 1.2
      const hip = { x: center.x + side * 6, y: SMUDGE_HOME.seatY - 3 }
      const ankle = { x: center.x + side * 7 + swing, y: STOOL.ringY - 5 }
      drawLimb(ctx, [hip, ankle], front ? 2 : 1)
      drawBoot(ctx, ankle.x, ankle.y, front)
    }
  }

  function drawArm(ctx, side) {
    const sh = shoulders()[side]
    const hand = vec(side === 'left' ? leftHand : rightHand)
    // Elbows hang down under their own weight; tidying up, the sponge arms stretch to the floor.
    const outward = side === 'right' ? 1 : -1
    const maxStretch = state.activity === 'tidy' ? 3.6 : 1.45
    const arm = solveIK(sh.x, sh.y, hand.x, hand.y, ARM.upper, ARM.lower, outward, maxStretch)
    drawLimb(ctx, [sh, arm.elbow, arm.hand], 2)
    if (side === 'left' && state.mugHeld) drawMugAt(ctx, Math.round(arm.hand.x) - 3, Math.round(arm.hand.y) - 7)
    if (state.ballIn === side) drawBall(ctx, arm.hand.x, arm.hand.y - 3)
    if (side === 'right' && !state.heldPage && !state.ballIn) {
      const tipDir = facingUs() ? { x: 2, y: -3 } : { x: -PEN_OFFSET.x, y: -PEN_OFFSET.y }
      drawTool(ctx, state.tool, arm.hand.x, arm.hand.y, arm.hand.x + tipDir.x, arm.hand.y + tipDir.y)
    }
    drawHand(ctx, arm.hand.x, arm.hand.y, side === 'right' ? 1 : -1)
  }

  function drawHeldPage(ctx) {
    if (!state.heldPage) return
    const hp = vec(heldPagePos)
    const s = state.pageScale
    if (s < 0.3) { drawBall(ctx, hp.x + PAGE.w / 2, hp.y + PAGE.h / 2); return }
    // Crumpling: the sheet shrinks toward its centre between his hands.
    const w = Math.max(2, Math.round(PAGE.w * s)), h = Math.max(2, Math.round(PAGE.h * (0.4 + 0.6 * s)))
    const x = Math.round(hp.x + (PAGE.w - w) / 2), y = Math.round(hp.y + (PAGE.h - h) / 2)
    ctx.fillStyle = 'rgba(20,14,30,0.35)'
    ctx.fillRect(x + 1, y + 2, w, h)
    ctx.drawImage(state.heldPage.flatCanvas(), x, y, w, h)
  }

  function drawFaceIfVisible(ctx) {
    const amount = Math.abs(turn.x)
    if (amount < 0.22) return
    const offset = Math.sign(turn.x) * (1 - Math.min(1, amount)) * FACE_EDGE
    drawFace(ctx, {
      x: center.x + offset,
      y: center.y - 1,
      turn: clamp(offset / 9, -1, 1),
      look: vec(look),
      eyes: state.eyes,
      mouth: amount > 0.6 ? state.mouth : 'none',
      brows: 'none',
    })
  }

  // Everything Smudge, in the right depth order for the way he is facing. The stool is passed in
  // because his legs go behind it when his back is to us and in front of it when he faces us.
  function draw(ctx, stool) {
    if (!state.heldPage) ctx.drawImage(page.skewedCanvas(), page.skewBounds.x, page.skewBounds.y)
    const front = facingUs()
    if (front) ctx.drawImage(stool, 0, 0)
    drawLegs(ctx)
    if (!front) ctx.drawImage(stool, 0, 0)
    if (!front) {
      drawHeldPage(ctx)
      drawArm(ctx, 'left')
      drawArm(ctx, 'right')
    }
    const sprite = bodySprite(squash.rx, squash.ry)
    ctx.drawImage(sprite.canvas, Math.round(center.x - sprite.cx), Math.round(center.y - sprite.cy))
    drawFaceIfVisible(ctx)
    if (front) {
      drawHeldPage(ctx)
      drawArm(ctx, 'left')
      drawArm(ctx, 'right')
    }
  }

  if (firstActivity === 'tidy') {
    paper.scatterOnFloor(TIDY_AT)
    state.tidyQueue = [...paper.floor]
  }
  if ([...BREAKS, 'show', 'dip', 'reject', 'tidy'].includes(firstActivity)) begin(firstActivity)

  const LAYER_WORD = { pencil: 'pencilling', ink: 'inking', fill: 'colouring' }
  function status() {
    switch (state.activity) {
      case 'draw':
      case 'switch': return `${LAYER_WORD[page.layerNow()] ?? 'finishing'} page ${pageNumber}`
      case 'dip': return 'dipping his pen'
      case 'think': return 'scratching his head over the next panel'
      case 'stretch': return 'stretching'
      case 'glance': return 'looking out the window'
      case 'coffee': return 'taking a cocoa break'
      case 'breathe': return 'doing his breathing exercises'
      case 'show': return `showing you page ${pageNumber - (state.pageSwapped ? 1 : 0)}`
      case 'reject': return state.t < 1.4 ? 'not happy with that sketch' : 'crumpling a draft'
      case 'tidy': return 'tidying up his crumpled drafts'
      default: return 'drawing'
    }
  }

  return {
    update,
    draw,
    status,
    get mugHeld() { return state.mugHeld },
    get pageNumber() { return pageNumber },
    get pageProgress() { return page.progress },
  }
}
