export const TILE_W = 128
export const TILE_H = 64
export const GRID_COLS = 24
export const GRID_ROWS = 24

export function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  }
}

export function screenToIso(sx: number, sy: number): { col: number; row: number } {
  return {
    col: Math.round(sx / TILE_W + sy / TILE_H),
    row: Math.round(-sx / TILE_W + sy / TILE_H),
  }
}

export function snapToGrid(sx: number, sy: number): { x: number; y: number } {
  const iso = screenToIso(sx, sy)
  return isoToScreen(iso.col, iso.row)
}
