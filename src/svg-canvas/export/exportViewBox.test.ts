import { describe, expect, it } from 'vitest'
import {
  TOPOLOGY_PREVIEW_ASPECT,
  topologyPreviewViewBox,
} from './exportViewBox'

describe('topologyPreviewViewBox', () => {
  it('uses a ~2.5:1 aspect ratio for cluster framing', () => {
    const vb = topologyPreviewViewBox([
      { x: 0, y: 0 },
      { x: 400, y: 200 },
      { x: -120, y: 80 },
    ])
    expect(vb.w / vb.h).toBeCloseTo(TOPOLOGY_PREVIEW_ASPECT, 5)
    expect(vb.x).toBeLessThan(-120)
    expect(vb.x + vb.w).toBeGreaterThan(400)
    expect(vb.y).toBeLessThan(0)
    expect(vb.y + vb.h).toBeGreaterThan(200)
  })

  it('returns the card default when there are no points', () => {
    const vb = topologyPreviewViewBox([])
    expect(vb).toEqual({ x: 0, y: 0, w: 250, h: 100 })
  })
})
