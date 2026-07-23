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
