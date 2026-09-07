/** Cloudcraft-faithful isometric lattice (research §4–5). */

export const CELL_W = 128
export const CELL_H = 74

/**
 * Fine drag snap — quarter of a major cell.
 * Live Cloudcraft: 1 outer (major) cell = 4 smallest steps;
 * 1 inner (2×2) box = 2 steps. Research’s 64×37 is the half-cell
 * (inner-box) spacing; smooth sliding uses half of that again.
 */
export const SNAP_W = 32
export const SNAP_H = 18.5

/** Half-cell (inner-box) spacing = 2 fine snaps. */
export const HALF_W = CELL_W / 2 // 64
export const HALF_H = CELL_H / 2 // 37

export type IsoPoint = { i: number; j: number }
export type WorldPoint = { x: number; y: number }

/** Lattice → world (SVG user units). Integer i,j = half-cell steps. */
export function isoToScreen(i: number, j: number): WorldPoint {
  return {
    x: (i - j) * HALF_W,
    y: (i + j) * HALF_H,
  }
}

/** World → continuous lattice coords (no rounding). */
export function screenToIso(x: number, y: number): IsoPoint {
  return {
    i: x / CELL_W + y / CELL_H,
    j: y / CELL_H - x / CELL_W,
  }
}

/** Nearest integer lattice point (half-cell / inner-box). */
export function snapIso(i: number, j: number): IsoPoint {
  return { i: Math.round(i), j: Math.round(j) }
}

/**
 * Snap onto the fine 32×18.5 world lattice (quarter-cell).
 * Matches Cloudcraft’s smallest drag step along the inner grid.
 */
export function snapWorld(x: number, y: number): WorldPoint {
  return {
    x: Math.round(x / SNAP_W) * SNAP_W,
    y: Math.round(y / SNAP_H) * SNAP_H,
  }
}

/** Convenience: snap from continuous iso onto fine world lattice. */
export function snapWorldFromIso(i: number, j: number): WorldPoint {
  const { x, y } = isoToScreen(i, j)
  return snapWorld(x, y)
}

/**
 * Diamond (parallelogram) corners for an axis-aligned iso footprint
 * spanning `cols` × `rows` full cells, anchored at lattice origin of the
 * top-left-ish corner (i=0,j=0 → left vertex style matching research).
 */
export function isoFootprintDiamond(
  originI: number,
  originJ: number,
  cols: number,
  rows: number,
): WorldPoint[] {
  const a = isoToScreen(originI, originJ)
  const b = isoToScreen(originI + cols, originJ)
  const c = isoToScreen(originI + cols, originJ + rows)
  const d = isoToScreen(originI, originJ + rows)
  return [a, b, c, d]
}

export function pointsAttr(pts: WorldPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

/** Bounded floor slab — keep in sync with `components/Floor.tsx` paint. */
export const BOUNDED_MAJOR_COLS = 5
export const BOUNDED_MAJOR_ROWS = 9
export const BOUNDED_COLS = BOUNDED_MAJOR_COLS * 2
export const BOUNDED_ROWS = BOUNDED_MAJOR_ROWS * 2
export const BOUNDED_ORIGIN_I = -BOUNDED_MAJOR_COLS + 0.5
export const BOUNDED_ORIGIN_J = -BOUNDED_MAJOR_ROWS + 0.5

export type BoundedSlabIso = {
  minI: number
  maxI: number
  minJ: number
  maxJ: number
}

export function boundedSlabIsoBounds(): BoundedSlabIso {
  return {
    minI: BOUNDED_ORIGIN_I,
    maxI: BOUNDED_ORIGIN_I + BOUNDED_COLS,
    minJ: BOUNDED_ORIGIN_J,
    maxJ: BOUNDED_ORIGIN_J + BOUNDED_ROWS,
  }
}

/** Half-cell inset so arranged glyphs stay on the bounded paint slab. */
export const BOUNDED_PLACE_MARGIN = 1

export type BoundedPlacementIso = {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

/** Integer lattice bounds for auto-arrange (matches store col/row = iso i/j). */
export function boundedPlacementIsoBounds(): BoundedPlacementIso {
  const b = boundedSlabIsoBounds()
  return {
    minCol: Math.ceil(b.minI) + BOUNDED_PLACE_MARGIN,
    maxCol: Math.floor(b.maxI) - BOUNDED_PLACE_MARGIN,
    minRow: Math.ceil(b.minJ) + BOUNDED_PLACE_MARGIN,
    maxRow: Math.floor(b.maxJ) - BOUNDED_PLACE_MARGIN,
  }
}

export function storePositionInBoundedSlab(
  pos: [number, number, number],
  margin = 0,
): boolean {
  const col = Math.round(pos[0] / 2)
  const row = Math.round(pos[2] / 2)
  return pointInBoundedSlab(isoToScreen(col, row), margin)
}

export function isoInBoundedSlab(i: number, j: number, margin = 0): boolean {
  const b = boundedSlabIsoBounds()
  return (
    i >= b.minI - margin &&
    i <= b.maxI + margin &&
    j >= b.minJ - margin &&
    j <= b.maxJ + margin
  )
}

export function pointInBoundedSlab(p: WorldPoint, margin = 0): boolean {
  const { i, j } = screenToIso(p.x, p.y)
  return isoInBoundedSlab(i, j, margin)
}

export function segmentInBoundedSlab(
  a: WorldPoint,
  b: WorldPoint,
  margin = 0,
): boolean {
  const samples = 12
  for (let k = 0; k <= samples; k++) {
    const t = k / samples
    if (
      !pointInBoundedSlab(
        { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        margin,
      )
    ) {
      return false
    }
  }
  return true
}

/** Every shaft sample stays inside the bounded iso table (ports may kiss the rim). */
export function pathInBoundedSlab(path: WorldPoint[], margin = 0.25): boolean {
  if (path.length < 2) return true
  for (let i = 1; i < path.length; i++) {
    if (!segmentInBoundedSlab(path[i - 1], path[i], margin)) return false
  }
  return true
}

/** Enlarge a viewBox-aligned AABB into an iso diamond (~2.2× overfill). */
export function infiniteFloorDiamond(
  viewX: number,
  viewY: number,
  viewW: number,
  viewH: number,
  overfill = 2.2,
): WorldPoint[] {
  const cx = viewX + viewW / 2
  const cy = viewY + viewH / 2
  const hw = (viewW * overfill) / 2
  const hh = (viewH * overfill) / 2
  // Iso diamond in screen space (not lattice) so it always covers the camera.
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ]
}
