import { describe, expect, it } from 'vitest'
import { HALF_H, HALF_W } from '../math/iso'
import {
  compareUnitPaintOrder,
  composeHexClusterUnits,
  composeShardReplicaUnits,
  HEX_CLUSTER_PITCH,
} from './composePacking'

describe('composeHexClusterUnits (from shard-cluster.svg)', () => {
  it('returns origin for one unit', () => {
    expect(composeHexClusterUnits(1)).toEqual([{ dx: 0, dy: 0 }])
  })

  it('centers a 4-unit diamond nest', () => {
    const u = composeHexClusterUnits(4)
    expect(u).toHaveLength(4)
    const sumX = u.reduce((s, p) => s + p.dx, 0)
    const sumY = u.reduce((s, p) => s + p.dy, 0)
    expect(sumX).toBeCloseTo(0, 5)
    expect(sumY).toBeCloseTo(0, 5)
  })

  it('matches shard-cluster nest density at full unit size (~74px step)', () => {
    const u = composeHexClusterUnits(4)
    // Back→NE tip delta ≈ pitch along +i (scaled from tiny export cubes)
    const back = u[0]
    const ne = u[1]
    expect(ne.dx - back.dx).toBeCloseTo(HEX_CLUSTER_PITCH * HALF_W, 5)
    expect(ne.dy - back.dy).toBeCloseTo(HEX_CLUSTER_PITCH * HALF_H, 5)
    expect(ne.dx - back.dx).toBeCloseTo(73.6, 1)
    expect(ne.dy - back.dy).toBeCloseTo(42.55, 1)
  })
})

describe('composeShardReplicaUnits', () => {
  it('places a mini-stack on each shard', () => {
    const u = composeShardReplicaUnits(3, 2, 26.084, 4, 3)
    expect(u).toHaveLength(6)
    // Three distinct shard anchors (dx), each with two shelf dy values
    const xs = new Set(u.map((p) => p.dx.toFixed(3)))
    expect(xs.size).toBe(3)
    const sameShard = u.filter((p) => Math.abs(p.dx - u[0].dx) < 0.01)
    expect(sameShard).toHaveLength(2)
    expect(sameShard[1].dy - sameShard[0].dy).toBeCloseTo(-26.084, 5)
  })
})

describe('compareUnitPaintOrder', () => {
  it('paints shelf stacks bottom → top', () => {
    const ordered = [
      { dx: 0, dy: -54 },
      { dx: 0, dy: 0 },
      { dx: 0, dy: -27 },
    ].sort(compareUnitPaintOrder)
    expect(ordered.map((u) => u.dy)).toEqual([0, -27, -54])
  })

  it('paints diamond nests back → front (north under south)', () => {
    const ordered = [
      { dx: 0, dy: -9 },
      { dx: 15, dy: 5 },
      { dx: -15, dy: 5 },
    ].sort(compareUnitPaintOrder)
    expect(ordered[0].dy).toBe(-9)
    expect(ordered[1].dy).toBe(5)
    expect(ordered[2].dy).toBe(5)
  })
})
