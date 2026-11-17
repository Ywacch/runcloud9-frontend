import { HALF_H, HALF_W, isoToScreen, screenToIso, type WorldPoint } from './iso'

/** Flat lattice step. Matches the isometric half-cell along x. */
export const FLAT_STEP = HALF_W

export function clampProjection(t: number): number {
  if (!Number.isFinite(t)) return 0
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

/**
 * Lattice (i, j) to screen.
 * t = 0 is isoToScreen. t = 1 is a square grid.
 * Dependency layers advance by decreasing j (bottom-left to top-right in iso).
 * Flat maps that direction to +x, and sibling spread (i) to +y.
 */
export function projectLattice(i: number, j: number, t: number): WorldPoint {
  const u = clampProjection(t)
  if (u === 0) return isoToScreen(i, j)
  const iso = isoToScreen(i, j)
  const flatX = -j * FLAT_STEP
  const flatY = i * FLAT_STEP
  return {
    x: iso.x + (flatX - iso.x) * u,
    y: iso.y + (flatY - iso.y) * u,
  }
}

/**
 * Inverse of projectLattice.
 * t = 0 matches screenToIso.
 */
export function latticeFromScreen(x: number, y: number, t: number): { i: number; j: number } {
  const u = clampProjection(t)
  if (u === 0) return screenToIso(x, y)
  const a = 1 - u
  const denom = HALF_H * a * a + HALF_H * a + FLAT_STEP * u
  const i = (y + HALF_H * a * (x / HALF_W)) / denom
  const j = a * i - x / HALF_W
  return { i, j }
}

/** Iso-world point to the screen point at this projection. */
export function presentWorld(p: WorldPoint, t: number): WorldPoint {
  if (clampProjection(t) === 0) return p
  const { i, j } = screenToIso(p.x, p.y)
  return projectLattice(i, j, t)
}

/** Screen point back to iso world. Drag and snap stay in that space. */
export function modelWorld(p: WorldPoint, t: number): WorldPoint {
  if (clampProjection(t) === 0) return p
  const { i, j } = latticeFromScreen(p.x, p.y, t)
  return isoToScreen(i, j)
}
