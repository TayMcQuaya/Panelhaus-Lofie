export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (t) => t * t * (3 - 2 * t)

export const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

export function rgbCss(c, alpha = 1) {
  const [r, g, b] = c.map((v) => Math.round(clamp(v, 0, 255)))
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Critically damped spring, implicit integration: stable at any frame rate, never overshoots.
export const createSpring = (x = 0) => ({ x, v: 0 })

export function stepSpring(spring, target, omega, dt) {
  const f = 1 + 2 * dt * omega
  const oo = omega * omega
  const hoo = dt * oo
  const hhoo = dt * hoo
  const detInv = 1 / (f + hhoo)
  const x = (f * spring.x + dt * spring.v + hhoo * target) * detInv
  const v = (spring.v + hoo * (target - spring.x)) * detInv
  spring.x = x
  spring.v = v
}
