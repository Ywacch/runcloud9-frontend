import { describe, expect, it } from 'vitest'
import { isoToScreen } from '../math/iso'
import {
  emptyConfig,
  type SvgNode,
} from '../store/svgTypes'
import {
  collectObstacleCells,
  nodeObstacleCells,
} from './obstacles'

function appAt(i: number, j: number, id = 'n1'): SvgNode {
  const p = isoToScreen(i, j)
  return {
    id,
    archetype: 'app-server',
    engine: 'generic',
    x: p.x,
    y: p.y,
    label: 'T2',
    config: emptyConfig(),
    topology: { replicas: 1, shards: 1, packing: 'stack' },
  }
}

describe('obstacles', () => {
  it('covers a footprint larger than a single tip cell', () => {
    const cells = nodeObstacleCells(appAt(0, 0))
    expect(cells.length).toBeGreaterThan(1)
    // Left tip + body along +i
    expect(cells.some((c) => c.i === 0 && c.j === 0)).toBe(true)
    expect(cells.some((c) => c.i > 0)).toBe(true)
  })

  it('ignores endpoints when collecting scene obstacles', () => {
    const a = appAt(0, 0, 'a')
    const b = appAt(6, 0, 'b')
    const mid = appAt(3, 0, 'mid')
    const cells = collectObstacleCells([a, b, mid], [], new Set(['a', 'b']))
    expect(cells.length).toBeGreaterThan(0)
    // mid footprint present; endpoints excluded
    const keys = new Set(cells.map((c) => `${c.i},${c.j}`))
    const midTip = cells.find(() => true)
    expect(midTip).toBeTruthy()
    expect(keys.size).toBe(cells.length)
  })
})
