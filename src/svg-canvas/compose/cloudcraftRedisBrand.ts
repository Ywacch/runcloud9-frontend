/**
 * Measured from Cloudcraft export:
 * `Caching Cluster Architecture (1).svg` (ElastiCache / Redis brand body).
 *
 * One logical instance = three thin red slabs + logo badge.
 * replicas = N → N full marks (never 3N slabs). See architecture §3.3.
 */

/** Iso half-step used in the export (Cloudcraft uses 63, we use 64). */
export const CC_HALF_W = 63
export const CC_HALF_H = 36.373

/** Vertical edge of each thin brand slab (= CC_HALF_H / 2). */
export const CC_REDIS_SIDE_H = 18.187

/**
 * Rise between consecutive slab top-face left tips.
 * = 1.5 * CC_REDIS_SIDE_H ≈ 27.28. Pure screen-Y (dx = 0).
 */
export const CC_REDIS_STACK_STEP = 27.28

/** Outer silhouette shelf notch along iso edge (= half-cell / 8). */
export const CC_REDIS_SHELF_JOG = { dx: 7.875, dy: 4.547 }

export function composeRedisBrandSlabs(): { dx: number; dy: number }[] {
  // Bottom → middle → top (paint bottom first).
  return [0, 1, 2].map((k) => ({
    dx: 0,
    dy: -k * CC_REDIS_STACK_STEP,
  }))
}
