import { describe, expect, it } from 'vitest'
import {
  computeExportViewBox,
  parseViewBoxAttr,
  resolveExportViewBox,
  viewBoxAttr,
} from './exportViewBox'

describe('exportViewBox', () => {
  it('parses a viewBox attribute', () => {
    expect(parseViewBoxAttr('-10 20 800 450')).toEqual({
      x: -10,
      y: 20,
      w: 800,
      h: 450,
    })
    expect(parseViewBoxAttr('bad')).toBeNull()
  })

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

  it('defaults to the live viewport for full-canvas export', () => {
    const live = { x: -100, y: -50, w: 1600, h: 900 }
    const vb = resolveExportViewBox({
      liveViewBox: live,
      nodes: [{ x: 0, y: 0 }],
    })
    expect(vb).toEqual(live)
  })

  it('uses content framing when requested', () => {
    const live = { x: -100, y: -50, w: 1600, h: 900 }
    const vb = resolveExportViewBox({
      frame: 'content',
      liveViewBox: live,
      nodes: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      aspect: 16 / 9,
    })
    expect(vb.w).toBeLessThan(live.w)
    expect(vb.x + vb.w).toBeGreaterThan(100)
  })
})
