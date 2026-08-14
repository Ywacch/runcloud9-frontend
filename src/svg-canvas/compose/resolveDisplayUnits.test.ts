import { describe, expect, it } from 'vitest'
import { resolveDisplayUnits, defaultExpanded } from './resolveDisplayUnits'
import type { SvgNode } from '../store/svgTypes'

function node(
  archetype: SvgNode['archetype'],
  replicas = 1,
  shards = 1,
  packing: 'stack' | 'fan' = 'stack',
  engine = 'generic',
): SvgNode {
  return {
    id: 'n1',
    archetype,
    engine,
    x: 0,
    y: 0,
    label: 'Test',
    config: {},
    topology: { replicas, shards, packing },
  }
}

describe('resolveDisplayUnits', () => {
  it('stack collapsed uses shelf', () => {
    const n = node('app-server', 3, 1, 'stack')
    const r = resolveDisplayUnits(n, false)
    expect(r.units.length).toBe(3)
    expect(r.units[1].dy).toBeLessThan(0)
  })

  it('stack expanded fans in plane', () => {
    const n = node('app-server', 3, 1, 'stack')
    const r = resolveDisplayUnits(n, true)
    expect(r.units.length).toBe(3)
    expect(r.units[1].dx).not.toBe(0)
  })

  it('fan collapsed is single unit', () => {
    const n = node('cache', 3, 1, 'fan', 'redis')
    expect(defaultExpanded(n)).toBe(true)
    const r = resolveDisplayUnits(n, false)
    expect(r.units).toEqual([{ dx: 0, dy: 0 }])
  })
})
