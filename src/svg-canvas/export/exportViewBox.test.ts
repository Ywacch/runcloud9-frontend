import { describe, expect, it } from 'vitest'
import { computeExportViewBox, viewBoxAttr } from './exportViewBox'

describe('exportViewBox', () => {
  it('returns a centered default when there are no nodes', () => {
    const vb = computeExportViewBox([], 16 / 9)
    expect(vb.w / vb.h).toBeCloseTo(16 / 9, 5)
    expect(vb.x + vb.w / 2).toBeCloseTo(0, 5)
    expect(vb.y + vb.h / 2).toBeCloseTo(0, 5)
  })

  it('fits around node tips with padding', () => {
    const vb = computeExportViewBox(
      [
        { x: 0, y: 0 },
        { x: 200, y: 100 },
      ],
      16 / 9,
    )
    expect(vb.x).toBeLessThan(0)
    expect(vb.y).toBeLessThan(0)
    expect(vb.x + vb.w).toBeGreaterThan(200)
    expect(vb.y + vb.h).toBeGreaterThan(100)
    expect(viewBoxAttr(vb)).toMatch(/^-?\d/)
  })
})
