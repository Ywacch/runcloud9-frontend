import { TILE_W, TILE_H } from '../constants'

/**
 * Vertical screen-space rise between stacked replica boxes. Deliberately smaller
 * than any body's `sideHeight` so each lower box's top face peeks out as a
 * "shelf" above the one in front of it (Cloudcraft-style stacked servers),
 * instead of leaving a gap that reads as a floating slab.
 */
export const STACK_STEP = 16

/** Top-face `oy` of replica box `i` (i=0 is the front/base box at oy=0). */
export function collapsedSlabOy(i: number): number {
  return -i * STACK_STEP
}

/**
 * Screen-space offset for an exploded replica slot.
 * Primary stays at origin; replicas fan along iso row axis (alternating sides)
 * with enough spread so full-height slabs don't overlap.
 */
export function expandedSlotOffset(idx: number): { x: number; y: number } {
  if (idx === 0) return { x: 0, y: 0 }
  const step = Math.ceil(idx / 2)
  const dir = idx % 2 === 1 ? -1 : 1
  const spread = 1.3
  return {
    x: dir * step * spread * (TILE_W / 2),
    y: dir * step * spread * (TILE_H / 2),
  }
}

/**
 * Collapsed offset for a replica in a horizontal cluster (hex-tube / queue
 * layout): replicas lie side-by-side along the iso row axis, centered on the
 * tile so the cluster reads as one row of tubes.
 */
export function clusteredRowOffset(idx: number, count: number): { x: number; y: number } {
  const stepX = TILE_W * 0.22
  const stepY = TILE_H * 0.22
  const centered = idx - (count - 1) / 2
  return { x: centered * stepX, y: centered * stepY }
}
