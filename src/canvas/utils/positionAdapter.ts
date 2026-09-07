import { GRID_COLS, GRID_ROWS } from '../constants'
import { boundedPlacementIsoBounds } from '../../svg-canvas/math/iso'

const GRID_ORIGIN = Math.floor(GRID_COLS / 2)
const GRID_MARGIN = 2

/** Inclusive iso cell bounds matching the centered Pixi GridLayer footprint. */
export const ISO_COL_MIN = -GRID_ORIGIN + GRID_MARGIN
export const ISO_COL_MAX = GRID_COLS - GRID_ORIGIN - 1 - GRID_MARGIN
export const ISO_ROW_MIN = -GRID_ORIGIN + GRID_MARGIN
export const ISO_ROW_MAX = GRID_ROWS - GRID_ORIGIN - 1 - GRID_MARGIN

export type IsoPlacementBounds = {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

export function nodeToIso(pos: [number, number, number]): { col: number; row: number } {
  return {
    col: Math.round(pos[0] / 2),
    row: Math.round(pos[2] / 2),
  }
}

export function isoToNode(col: number, row: number): [number, number, number] {
  return [col * 2, 0.3, row * 2]
}

function clampIsoCellToBounds(
  col: number,
  row: number,
  bounds: IsoPlacementBounds,
): { col: number; row: number } {
  return {
    col: Math.max(bounds.minCol, Math.min(bounds.maxCol, Math.round(col))),
    row: Math.max(bounds.minRow, Math.min(bounds.maxRow, Math.round(row))),
  }
}

export function clampIsoCell(col: number, row: number): { col: number; row: number } {
  return clampIsoCellToBounds(col, row, {
    minCol: ISO_COL_MIN,
    maxCol: ISO_COL_MAX,
    minRow: ISO_ROW_MIN,
    maxRow: ISO_ROW_MAX,
  })
}

/** Scale and shift arranged store positions into the given iso cell bounds. */
export function fitStorePositionsToIsoBounds(
  positions: Record<string, [number, number, number]>,
  bounds: IsoPlacementBounds,
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
  const availCol = bounds.maxCol - bounds.minCol
  const availRow = bounds.maxRow - bounds.minRow

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

  const gridCenterCol = (bounds.minCol + bounds.maxCol) / 2
  const gridCenterRow = (bounds.minRow + bounds.maxRow) / 2
  let shiftCol = Math.round(gridCenterCol - (minCol + maxCol) / 2)
  let shiftRow = Math.round(gridCenterRow - (minRow + maxRow) / 2)

  if (minCol + shiftCol < bounds.minCol) shiftCol = bounds.minCol - minCol
  if (maxCol + shiftCol > bounds.maxCol) shiftCol = bounds.maxCol - maxCol
  if (minRow + shiftRow < bounds.minRow) shiftRow = bounds.minRow - minRow
  if (maxRow + shiftRow > bounds.maxRow) shiftRow = bounds.maxRow - maxRow

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const col = scaledCols[i] + shiftCol
    const row = scaledRows[i] + shiftRow
    const clamped = clampIsoCellToBounds(col, row, bounds)
    positions[id] = [clamped.col * 2, positions[id][1], clamped.row * 2]
  }
}

/** Pixi grid clamp (24×24 lattice). */
export function fitStorePositionsToGrid(
  positions: Record<string, [number, number, number]>,
): void {
  fitStorePositionsToIsoBounds(positions, {
    minCol: ISO_COL_MIN,
    maxCol: ISO_COL_MAX,
    minRow: ISO_ROW_MIN,
    maxRow: ISO_ROW_MAX,
  })
}

/** SVG bounded floor slab — auto-arrange target. */
export function fitStorePositionsToBoundedSlab(
  positions: Record<string, [number, number, number]>,
): void {
  fitStorePositionsToIsoBounds(positions, boundedPlacementIsoBounds())
}
