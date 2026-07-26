import { describe, expect, it } from 'vitest'
import {
  boundedFloorExportViewBox,
  designExportViewBox,
  resolveExportViewBox,
  viewBoxAttr,
} from './exportViewBox'

describe('exportViewBox', () => {
  it('bounded frame covers the fixed slab and ignores node cluster size', () => {
    const vb = boundedFloorExportViewBox()
    expect(vb.w).toBeGreaterThan(800)
    expect(vb.h).toBeGreaterThan(600)
    // Single node near origin still gets the full slab frame.
    const resolved = resolveExportViewBox({
      gridMode: 'bounded',
      nodes: [{ x: 0, y: 0 }],
    })
    expect(resolved).toEqual(vb)
  })

  it('infinite / off frames the design with padding', () => {
    const vb = designExportViewBox([
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    ])
    expect(vb.x).toBeLessThan(0)
    expect(vb.y).toBeLessThan(0)
    expect(vb.x + vb.w).toBeGreaterThan(200)
    expect(vb.y + vb.h).toBeGreaterThan(100)
    expect(viewBoxAttr(vb)).toMatch(/^-?\d/)

    expect(
      resolveExportViewBox({
        gridMode: 'infinite',
        nodes: [
          { x: 0, y: 0 },
          { x: 200, y: 100 },
        ],
      }).w,
    ).toBe(vb.w)

    expect(
      resolveExportViewBox({
        gridMode: 'off',
        nodes: [
          { x: 0, y: 0 },
          { x: 200, y: 100 },
        ],
      }).w,
    ).toBe(vb.w)
  })

  it('empty design still returns a usable frame', () => {
    const vb = designExportViewBox([])
    expect(vb.w).toBeGreaterThan(0)
    expect(vb.h).toBeGreaterThan(0)
  })
})
