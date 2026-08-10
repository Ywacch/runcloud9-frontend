import { describe, expect, it } from 'vitest'
import {
  layoutTopologyPreview,
  PREVIEW_VB_H,
  PREVIEW_VB_W,
} from './MiniTopologyPreview'

describe('layoutTopologyPreview', () => {
  it('uses one scale so a wide layout is not stretched square', () => {
    const laid = layoutTopologyPreview([
      { id: 'a', type: 'compute', position: [0, 0, 0] },
      { id: 'b', type: 'database', position: [10, 0, 0] },
      { id: 'c', type: 'cache', position: [0, 0, 2] },
    ])
    const a = laid.get('a')
    const b = laid.get('b')
    const c = laid.get('c')
    if (!a || !b || !c) throw new Error('missing nodes')
    const dx = b.x - a.x
    const dz = c.y - a.y
    expect(dx / 10).toBeCloseTo(dz / 2, 5)
    expect(b.x).toBeLessThan(PREVIEW_VB_W)
    expect(c.y).toBeLessThan(PREVIEW_VB_H)
  })
})
