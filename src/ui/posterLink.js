// The poster on the wall is the cover of Day of the Smudgies: hovering it lights its frame, and a
// click opens the game in a new tab. The canvas has no DOM per object, so the pointer is mapped
// back into scene pixels and tested against the poster's rectangle.
import { POSTER } from '../scene/layout.js'

export const GAME_URL = 'https://panel.haus/smudgies/play/'
const HIGHLIGHT = '#ffd84a'

function isOverPoster({ x, y }) {
  return x >= POSTER.x - 1 && x < POSTER.x + POSTER.w + 1 && y >= POSTER.y - 1 && y < POSTER.y + POSTER.h + 1
}

export function createPosterLink(canvas, view) {
  let hovering = false

  const toScene = (event) => {
    const box = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - box.left) * (canvas.width / box.width) - view.offsetX,
      y: (event.clientY - box.top) * (canvas.height / box.height) - view.offsetY,
    }
  }

  const setHovering = (next) => {
    if (next === hovering) return
    hovering = next
    canvas.classList.toggle('over-poster', hovering)
    canvas.title = hovering ? 'Play Day of the Smudgies' : ''
  }

  canvas.addEventListener('pointermove', (event) => setHovering(isOverPoster(toScene(event))))
  canvas.addEventListener('pointerleave', () => setHovering(false))
  canvas.addEventListener('click', (event) => {
    if (isOverPoster(toScene(event))) window.open(GAME_URL, '_blank', 'noopener')
  })

  // Drawn on the frame each tick, because the poster itself lives in the room's cached layer.
  function drawHighlight(ctx) {
    if (!hovering) return
    const { x, y, w, h } = POSTER
    ctx.fillStyle = HIGHLIGHT
    ctx.fillRect(x - 2, y - 2, w + 4, 1)
    ctx.fillRect(x - 2, y + h + 1, w + 4, 1)
    ctx.fillRect(x - 2, y - 2, 1, h + 4)
    ctx.fillRect(x + w + 1, y - 2, 1, h + 4)
  }

  return { drawHighlight }
}
