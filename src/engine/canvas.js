export const W = 480
export const H = 270

export function makeLayer(w = W, h = H, readable = false) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', readable ? { willReadFrequently: true } : undefined)
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

// Fills the whole window without cropping: the 480x270 scene is scaled to fit entirely, and the
// screen canvas is made exactly as large as the window in scene pixels. Whatever is left over
// around the scene (on windows that aren't 16:9) is filled by the caller, e.g. with the room
// continuing past the frame. A whole-number scale is used when it is close, so pixels stay even.
export function attachDisplay(canvas, { fixed = false } = {}) {
  const ctx = canvas.getContext('2d')
  const view = { width: W, height: H, offsetX: 0, offsetY: 0 }

  const fit = () => {
    if (fixed) {
      canvas.width = W
      canvas.height = H
      ctx.imageSmoothingEnabled = false
      return
    }
    const dpr = window.devicePixelRatio || 1
    const deviceW = window.innerWidth * dpr
    const deviceH = window.innerHeight * dpr
    const fitScale = Math.min(deviceW / W, deviceH / H)
    const wholeScale = Math.floor(fitScale)
    const scale = wholeScale >= 1 && wholeScale / fitScale >= 0.9 ? wholeScale : fitScale
    view.width = Math.ceil(deviceW / scale)
    view.height = Math.ceil(deviceH / scale)
    view.offsetX = Math.floor((view.width - W) / 2)
    view.offsetY = Math.floor((view.height - H) / 2)
    canvas.width = view.width
    canvas.height = view.height
    ctx.imageSmoothingEnabled = false
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${(view.width * scale) / dpr}px`,
      height: `${(view.height * scale) / dpr}px`,
    })
  }
  fit()
  window.addEventListener('resize', fit)
  return { ctx, view }
}
