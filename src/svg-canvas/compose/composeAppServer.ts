import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import { HALF_H } from '../math/iso'

export type UnitOffset = { dx: number; dy: number }

export { APP_SERVER_REPLICA_MAX }

/**
 * App-server body vertical edge (see AppServerGlyph left/right faces).
 * Must stay in sync with the glyph extrusion.
 */
export const APP_SERVER_SIDE_H = HALF_H // 37

/**
 * Collapsed replica shelf rise — strictly less than body height so each
 * lower top-face peeks as a shelf (Cloudcraft / Pixi STACK_STEP rule).
 *
 * Measured from Cloudcraft Redis brand (`Caching Cluster Architecture (1).svg`):
 *   half-cell ≈ 63 × 36.373, thin-slab sideH = halfH/2 ≈ 18.187,
 *   brand stackStep = 1.5 * sideH ≈ 27.28, dx = 0 always.
 * That brand step is for *thin* slabs (intentional air gap). Applying ~27 to
 * a full-height cube is the floating-slab slop. Full cubes use sideH/2.
 */
export const APP_SERVER_STACK_STEP = APP_SERVER_SIDE_H / 2 // 18.5

/**
 * Whole-unit offsets relative to node anchor (left tip of primary top face).
 * replicas > 1 → pure screen-Y shelf stack (no diagonal drift).
 * Brand-mark rule: always whole units — never multiply slabs inside one glyph.
 */
export function composeAppServerUnits(replicas: number): UnitOffset[] {
  const n = Math.max(1, Math.min(APP_SERVER_REPLICA_MAX, Math.floor(replicas)))
  return Array.from({ length: n }, (_, k) => ({
    dx: 0,
    dy: k === 0 ? 0 : -k * APP_SERVER_STACK_STEP,
  }))
}
