import { describe, expect, it } from 'vitest'
import { HALF_H, HALF_W } from '../math/iso'
import { emptyConfig, type SvgNode } from '../store/svgTypes'
import {
  CACHE_SLAB_STACK_STEP,
  DATABASE_STACK_STEP,
  WORKER_STACK_STEP,
} from './composeAppServer'
import { composeFanUnits, composeGlyph, composeMqParallelUnits } from './composeGlyph'

function node(partial: Partial<SvgNode> & Pick<SvgNode, 'archetype' | 'engine'>): SvgNode {
  return {
    id: 'n1',
    x: 0,
    y: 0,
    label: 'T2',
    config: emptyConfig(),
    archetype: partial.archetype,
    engine: partial.engine,
    topology: {
      replicas: 1,
      shards: 1,
      packing: 'stack',
      ...partial.topology,
    },
  }
}

describe('composeGlyph', () => {
  it('redis replicas 1 → one brand unit, stack', () => {
    const c = composeGlyph(
      node({ archetype: 'cache', engine: 'redis', topology: { replicas: 1, shards: 1, packing: 'stack' } }),
    )
    expect(c.brandBody).toBe('redis')
    expect(c.units).toHaveLength(1)
    expect(c.packing).toBe('stack')
  })

  it('redis replicas 3 → three diamond-nest marks, never 9 slabs', () => {
    const c = composeGlyph(
      node({
        archetype: 'cache',
        engine: 'redis',
        topology: { replicas: 3, shards: 1, packing: 'fan' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.packing).toBe('fan')
    expect(c.units.some((u) => u.dx !== 0)).toBe(true)
  })

  it('worker replicas 3 → air-gapped shelf stack (Redis spacing, not fan)', () => {
    const c = composeGlyph(
      node({
        archetype: 'worker',
        engine: 'generic',
        topology: { replicas: 3, shards: 1, packing: 'stack' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.units.every((u) => u.dx === 0)).toBe(true)
    expect(c.units[1].dy).toBeCloseTo(-WORKER_STACK_STEP, 5)
    expect(c.packing).toBe('stack')
  })

  it('memcached replicas 3 → thin-slab shelf stack with air gap', () => {
    const c = composeGlyph(
      node({
        archetype: 'cache',
        engine: 'memcached',
        topology: { replicas: 3, shards: 1, packing: 'stack' },
      }),
    )
    expect(c.brandBody).toBeNull()
    expect(c.units).toHaveLength(3)
    expect(c.units.every((u) => u.dx === 0)).toBe(true)
    expect(c.units[1].dy).toBeCloseTo(-CACHE_SLAB_STACK_STEP, 5)
    expect(c.packing).toBe('stack')
  })

  it('database shards 3 → diamond nest (shard-cluster)', () => {
    const c = composeGlyph(
      node({
        archetype: 'database',
        engine: 'postgres',
        topology: { replicas: 1, shards: 3, packing: 'fan' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.tubeCount).toBe(3)
    expect(c.packing).toBe('fan')
  })

  it('database shards capped at DB_SHARD_MAX (3)', () => {
    const c = composeGlyph(
      node({
        archetype: 'database',
        engine: 'postgres',
        topology: { replicas: 1, shards: 9, packing: 'fan' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.tubeCount).toBe(3)
  })

  it('database shards × replicas → mini-stack per shard', () => {
    const c = composeGlyph(
      node({
        archetype: 'database',
        engine: 'postgres',
        topology: { replicas: 2, shards: 3, packing: 'fan' },
      }),
    )
    expect(c.units).toHaveLength(6)
    expect(c.packing).toBe('fan')
  })

  it('database replicas 3 (1 shard) → air-gapped shelf from db.svg', () => {
    const c = composeGlyph(
      node({
        archetype: 'database',
        engine: 'postgresql',
        topology: { replicas: 3, shards: 1, packing: 'stack' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.units.every((u) => u.dx === 0)).toBe(true)
    expect(c.units[1].dy).toBeCloseTo(-DATABASE_STACK_STEP, 5)
    expect(c.units[2].dy).toBeCloseTo(-2 * DATABASE_STACK_STEP, 5)
    expect(c.packing).toBe('stack')
  })

  it('mq tubeCount tracks shards', () => {
    expect(
      composeGlyph(
        node({
          archetype: 'message-queue',
          engine: 'kafka',
          topology: { replicas: 1, shards: 3, packing: 'stack' },
        }),
      ).tubeCount,
    ).toBe(3)
  })

  it('mq shards → parallel units (not a single stacked origin)', () => {
    const c = composeGlyph(
      node({
        archetype: 'message-queue',
        engine: 'kafka',
        topology: { replicas: 1, shards: 3, packing: 'stack' },
      }),
    )
    expect(c.units).toHaveLength(3)
    expect(c.units[0]).not.toEqual({ dx: 0, dy: 0 })
    expect(c.units[2]).not.toEqual({ dx: 0, dy: 0 })
    const ys = c.units.map((u) => u.dy)
    expect(new Set(ys).size).toBe(3)
    expect(c.packing).toBe('fan')
  })

  it('mq single shard → stack packing (no zone)', () => {
    expect(
      composeGlyph(
        node({
          archetype: 'message-queue',
          engine: 'kafka',
          topology: { replicas: 1, shards: 1, packing: 'stack' },
        }),
      ).packing,
    ).toBe('stack')
  })

  it('client / loadgen is a single procedural unit (never stacks)', () => {
    const c = composeGlyph(
      node({
        archetype: 'client',
        engine: 'generic',
        topology: { replicas: 5, shards: 3, packing: 'fan' },
      }),
    )
    expect(c.units).toEqual([{ dx: 0, dy: 0 }])
    expect(c.packing).toBe('stack')
    expect(c.brandBody).toBeNull()
  })

  it('load-balancer is a single unit', () => {
    expect(
      composeGlyph(
        node({
          archetype: 'load-balancer',
          engine: 'generic',
          topology: { replicas: 2, shards: 1, packing: 'stack' },
        }),
      ).units,
    ).toEqual([{ dx: 0, dy: 0 }])
  })
})

describe('composeMqParallelUnits', () => {
  it('centers the lane around the origin', () => {
    const u = composeMqParallelUnits(2)
    expect(u).toHaveLength(2)
    expect(u[0].dy).toBeCloseTo(-u[1].dy)
    expect(u[0].dx).toBeCloseTo(-u[1].dx)
  })

  it('keeps parallel iso pitch along +i (across trough)', () => {
    const [a, , c] = composeMqParallelUnits(3)
    expect(a.dx / a.dy).toBeCloseTo(HALF_W / HALF_H, 5)
    expect(c.dx / c.dy).toBeCloseTo(HALF_W / HALF_H, 5)
    expect(Math.sign(a.dx)).toBe(Math.sign(a.dy))
  })
})

describe('composeFanUnits', () => {
  it('returns a centered diamond nest', () => {
    const u = composeFanUnits(3)
    expect(u).toHaveLength(3)
    expect(u.reduce((s, p) => s + p.dx, 0)).toBeCloseTo(0, 5)
  })
})
