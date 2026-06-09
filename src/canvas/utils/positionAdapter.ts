import { GRID_COLS, GRID_ROWS } from '../constants'

const GRID_ORIGIN = Math.floor(GRID_COLS / 2)
const GRID_MARGIN = 2

/** Inclusive iso cell bounds matching the centered GridLayer footprint. */
export const ISO_COL_MIN = -GRID_ORIGIN + GRID_MARGIN
export const ISO_COL_MAX = GRID_COLS - GRID_ORIGIN - 1 - GRID_MARGIN
export const ISO_ROW_MIN = -GRID_ORIGIN + GRID_MARGIN
export const ISO_ROW_MAX = GRID_ROWS - GRID_ORIGIN - 1 - GRID_MARGIN

export function nodeToIso(pos: [number, number, number]): { col: number; row: number } {
  return {
    col: Math.round(pos[0] / 2),
    row: Math.round(pos[2] / 2),
  }
}

export function isoToNode(col: number, row: number): [number, number, number] {
  return [col * 2, 0.3, row * 2]
}

export function clampIsoCell(col: number, row: number): { col: number; row: number } {
  return {
    col: Math.max(ISO_COL_MIN, Math.min(ISO_COL_MAX, Math.round(col))),
    row: Math.max(ISO_ROW_MIN, Math.min(ISO_ROW_MAX, Math.round(row))),
  }
}

/** Scale and shift arranged store positions so every node stays on the visible grid. */
export function fitStorePositionsToGrid(
  positions: Record<string, [number, number, number]>,
): void {
  const ids = Object.keys(positions)
  if (ids.length === 0) return

  const cols = ids.map((id) => nodeToIso(positions[id]).col)
  const rows = ids.map((id) => nodeToIso(positions[id]).row)

  let minCol = Math.min(...cols)
  let maxCol = Math.max(...cols)
  let minRow = Math.min(...rows)
  let maxRow = Math.max(...rows)

  const spanCol = maxCol - minCol
  const spanRow = maxRow - minRow
  const availCol = ISO_COL_MAX - ISO_COL_MIN
  const availRow = ISO_ROW_MAX - ISO_ROW_MIN

  const scaleCol = spanCol > availCol ? availCol / spanCol : 1
  const scaleRow = spanRow > availRow ? availRow / spanRow : 1
  const scale = Math.min(scaleCol, scaleRow)

  const scaledCols = cols.map((col) =>
    spanCol === 0 ? col : Math.round(minCol + (col - minCol) * scale),
  )
  const scaledRows = rows.map((row) =>
    spanRow === 0 ? row : Math.round(minRow + (row - minRow) * scale),
  )

  minCol = Math.min(...scaledCols)
  maxCol = Math.max(...scaledCols)
  minRow = Math.min(...scaledRows)
  maxRow = Math.max(...scaledRows)

  const gridCenterCol = (ISO_COL_MIN + ISO_COL_MAX) / 2
  const gridCenterRow = (ISO_ROW_MIN + ISO_ROW_MAX) / 2
  let shiftCol = Math.round(gridCenterCol - (minCol + maxCol) / 2)
  let shiftRow = Math.round(gridCenterRow - (minRow + maxRow) / 2)

  if (minCol + shiftCol < ISO_COL_MIN) shiftCol = ISO_COL_MIN - minCol
  if (maxCol + shiftCol > ISO_COL_MAX) shiftCol = ISO_COL_MAX - maxCol
  if (minRow + shiftRow < ISO_ROW_MIN) shiftRow = ISO_ROW_MIN - minRow
  if (maxRow + shiftRow > ISO_ROW_MAX) shiftRow = ISO_ROW_MAX - maxRow

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const col = scaledCols[i] + shiftCol
    const row = scaledRows[i] + shiftRow
    const clamped = clampIsoCell(col, row)
    positions[id] = [clamped.col * 2, positions[id][1], clamped.row * 2]
  }
}
