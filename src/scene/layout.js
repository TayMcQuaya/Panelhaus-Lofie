// One source of truth for where things are. Scale: ~90 px per metre, Smudge is kid-sized.
// The floor is seen slightly from above, so things standing further into the room sit lower on
// screen: wall furniture stands on FLOOR_Y, Smudge's stool stands on the rug at FRONT_FLOOR_Y.
export const FLOOR_Y = 232
export const FRONT_FLOOR_Y = FLOOR_Y + 17

export const GLASS = { x: 106, y: 36, w: 144, h: 102 }
export const PANES = [
  { x: 106, y: 36, w: 70, h: 49 },
  { x: 180, y: 36, w: 70, h: 49 },
  { x: 106, y: 89, w: 70, h: 49 },
  { x: 180, y: 89, w: 70, h: 49 },
]
export const SILL_Y = 138

// Smudge's desk stands against the wall under the window: a 0.75 m top seen slightly from above
// (back edge higher than the front edge), front legs a little into the room.
export const DESK = { x: 168, w: 132, backY: 159, frontY: 165, apronY: 171, footY: 242 }

// We watch Smudge from behind: he sits on a tall stool in front of the desk, a little left of the
// drafting board, so the page shows over his right shoulder.
const SEAT_Y = FRONT_FLOOR_Y - 62
export const STOOL = { x: 190, w: 32, seatY: SEAT_Y, ringY: SEAT_Y + 23, footY: FRONT_FLOOR_Y }
export const SMUDGE_HOME = { x: 206, seatY: SEAT_Y + 2 }

// The page on the drafting board, which leans back on the desk facing Smudge (and us).
// Page pixel (i, j) → screen origin + i*u + j*v.
export const PAGE = {
  w: 34,
  h: 24,
  origin: { x: 222, y: 137 },
  u: { x: 1, y: 0 },
  v: { x: -2 / 24, y: 1 },
}

export function pageToScreen(i, j) {
  return {
    x: PAGE.origin.x + i * PAGE.u.x + j * PAGE.v.x,
    y: PAGE.origin.y + i * PAGE.u.y + j * PAGE.v.y,
  }
}

const corner = (i, j, dx, dy) => {
  const p = pageToScreen(i, j)
  return [p.x + dx, p.y + dy]
}
export const BOARD = [
  corner(0, 0, -4, -4),
  corner(PAGE.w, 0, 4, -4),
  corner(PAGE.w, PAGE.h, 4, 3),
  corner(0, PAGE.h, -4, 3),
]

// Where his hands rest on the desk while he isn't drawing (just either side of his body).
// (far enough out that the arm lies along the desk instead of folding up against the body)
export const DESK_REST = { left: { x: 168, y: 165 }, right: { x: 245, y: 166 } }
export const INK_JAR = { x: 261, y: 157, mouthX: 264, mouthY: 157 }
export const MUG_HOME = { x: 173, y: 156 }
export const CRATE = { x: 150, y: FRONT_FLOOR_Y - 27, w: 22, h: 27 }
export const CAT_SPOT = { x: 130, y: 132 }
export const LAMP = { baseX: 286, baseY: 164, elbowX: 290, elbowY: 128, headX: 272, headY: 119, bulbX: 270, bulbY: 124 }
export const LAMP_POOL = pageToScreen(PAGE.w / 2, PAGE.h / 2)

export const CORK = { x: 292, y: 44, w: 110, h: 74 }
export const CORK_SLOTS = [0, 1].flatMap((row) =>
  [0, 1].map((col) => ({ x: 307 + col * 46, y: 54 + row * 31 })),
)
export const CLOCK = { x: 436, y: 38 }
export const POSTER = { x: 412, y: 62, w: 48, h: 66 }
export const CABINET = { x: 304, y: 194, w: 88, h: 38 }
export const RECORD = { x: 326, y: 185 }
// Lava lamp at the right end of the cabinet: glass from glassTop to baseY - 8.
export const LAVA = { x: 385, baseY: 194, glassTop: 166 }
export const SHELF = { x: 8, y: 46, w: 66 }
export const FIGURINE = { x: 62, y: 141 }
