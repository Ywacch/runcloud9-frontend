import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import { HALF_H } from '../math/iso'
import { composeShelfStack } from './composePacking'

export type UnitOffset = { dx: number; dy: number }

export { APP_SERVER_REPLICA_MAX }

/**
 * App-server / worker cube vertical edge (image-backed ≈ half-cell).
 * Stack step must stay below this so lower tops peek as shelves.
 */
export const APP_SERVER_SIDE_H = HALF_H // 37

/**
 * Collapsed replica shelf rise for full cubes (app-server).
 * Matches Pixi `STACK_STEP` (16): tight peek, no floating air gap.
 */
export const APP_SERVER_STACK_STEP = 16

/** Thin cache-slab rise — Cloudcraft Redis-measured 1.5 × thin side (~27.28). */
export const CACHE_SLAB_STACK_STEP = 27.28

/**
 * Worker replica shelf rise — same air-gapped step as Redis brand slabs
 * (stacked with visible gaps, not diamond-fanned).
 */
export const WORKER_STACK_STEP = CACHE_SLAB_STACK_STEP

/**
 * DB replica tip rise — `db.svg` tip step (26.084).
 * Must stay below the Quiver drum body (~48px at h=76) so upper discs
 * cover lower top faces (shelf peek), not float with full ellipses showing.
 */
export const DATABASE_STACK_STEP = 26.084

/**
 * Whole-unit offsets relative to node anchor (left tip of primary top face).
 * replicas > 1 → pure screen-Y shelf stack (no diagonal drift).
 */
export function composeAppServerUnits(replicas: number): UnitOffset[] {
  return composeShelfStack(
    replicas,
    APP_SERVER_STACK_STEP,
    APP_SERVER_REPLICA_MAX,
  )
}
