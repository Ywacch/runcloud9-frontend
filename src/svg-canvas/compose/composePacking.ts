import { HALF_H, HALF_W } from '../math/iso'
import type { UnitOffset } from './composeAppServer'

/**
 * Diamond nest density from `shard-cluster.svg`, scaled to our unit size.
 *
 * In the export, cube tops are only ~26px wide and neighbor tips are ~15px
 * apart (ratio ≈ 0.59). Copying that 15px gap onto our full-size marks
 * (Redis ~126, DB ~90) piles them into a blob. Scale the same ratio up:
 * tipStep ≈ 0.59 × unitWidth → pitch ≈ 1.15 half-cells for a major-cell mark.
 */
export const HEX_CLUSTER_PITCH = 1.15

/** Lattice slots for a diamond / hex nest (back → NE → SE → front). */
const HEX_SLOTS = [
  { i: 0, j: 0 },
  { i: 1, j: 0 },
  { i: 0, j: 1 },
  { i: 1, j: 1 },
] as const

/**
 * In-plane diamond cluster for Redis replicas / DB shards.
 * Centered on the node anchor; count 1–4.
 */
export function composeHexClusterUnits(
  count: number,
  pitch: number = HEX_CLUSTER_PITCH,
): UnitOffset[] {
  const n = Math.max(1, Math.min(HEX_SLOTS.length, Math.floor(count)))
  if (n === 1) return [{ dx: 0, dy: 0 }]
  const slots = HEX_SLOTS.slice(0, n)
  const avgI = slots.reduce((s, p) => s + p.i, 0) / n
  const avgJ = slots.reduce((s, p) => s + p.j, 0) / n
  return slots.map((p) => {
    const i = (p.i - avgI) * pitch
    const j = (p.j - avgJ) * pitch
    return {
      dx: (i - j) * HALF_W,
      dy: (i + j) * HALF_H,
    }
  })
}

/**
 * SVG paint order for composed units.
 * - Same column (shelf stack): bottom first, top last.
 * - In-plane nest: back (smaller dy) first, front last — so the north mark
 *   does not cover the two southern ones (Redis fan bug).
 */
export function compareUnitPaintOrder(a: UnitOffset, b: UnitOffset): number {
  if (Math.abs(a.dx - b.dx) < 0.01) return b.dy - a.dy
  return a.dy - b.dy || a.dx - b.dx
}

/**
 * Vertical shelf stack (Cloudcraft / Pixi): pure screen-Y, dx = 0.
 * `step` must be tuned to body height (tight peek for cubes, air gap for thin slabs).
 */
export function composeShelfStack(
  replicas: number,
  step: number,
  maxReplicas: number,
): UnitOffset[] {
  const n = Math.max(1, Math.min(maxReplicas, Math.floor(replicas)))
  return Array.from({ length: n }, (_, k) => ({
    dx: 0,
    dy: k === 0 ? 0 : -k * step,
  }))
}

/**
 * DB / any shard×replica compose: hex-cluster of shard anchors, each with a
 * vertical replica shelf stack (architecture: mini-stack per shard).
 */
export function composeShardReplicaUnits(
  shards: number,
  replicas: number,
  stackStep: number,
  maxShards: number,
  maxReplicas: number,
): UnitOffset[] {
  const shardN = Math.max(1, Math.min(maxShards, Math.floor(shards)))
  const repN = Math.max(1, Math.min(maxReplicas, Math.floor(replicas)))
  const cluster = composeHexClusterUnits(shardN)
  const units: UnitOffset[] = []
  for (const c of cluster) {
    for (let r = 0; r < repN; r++) {
      units.push({
        dx: c.dx,
        dy: c.dy - (r === 0 ? 0 : r * stackStep),
      })
    }
  }
  return units
}
