export const TILE_W = 128
export const TILE_H = 64
export const GRID_COLS = 24
export const GRID_ROWS = 24

/**
 * Southwest-style isometric: near edge bottom-left, depth recedes up-right
 * (AWS / architecture-diagram convention). Tile anchor is the left vertex of
 * the top-face diamond.
 */
export function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col + row) * (TILE_W / 2),
    y: (row - col) * (TILE_H / 2),
  }
}

export function screenToIso(sx: number, sy: number): { col: number; row: number } {
  return {
    col: Math.round(sx / TILE_W - sy / TILE_H),
    row: Math.round(sx / TILE_W + sy / TILE_H),
  }
}

export function snapToGrid(sx: number, sy: number): { x: number; y: number } {
  const iso = screenToIso(sx, sy)
  return isoToScreen(iso.col, iso.row)
}

/** Top-face diamond relative to tile anchor (left vertex). */
export function tileTopFacePoly(offsetX = 0, offsetY = 0): number[] {
  const ox = offsetX
  const oy = offsetY
  return [
    ox,
    oy,
    ox + TILE_W / 2,
    oy - TILE_H / 2,
    ox + TILE_W,
    oy,
    ox + TILE_W / 2,
    oy + TILE_H / 2,
  ]
}
