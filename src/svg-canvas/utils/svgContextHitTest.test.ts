import { describe, expect, it } from 'vitest'
import type { SvgNode } from '../store/svgTypes'
import { defaultTopology, emptyConfig } from '../store/svgTypes'
import { walkthroughGlyphArtBox } from '../fx/walkthroughChrome'
import {
  findSvgNodeIdAtWorldPoint,
  pointInGlyphArtBox,
} from './svgContextHitTest'

function node(partial: Partial<SvgNode> & Pick<SvgNode, 'id' | 'archetype'>): SvgNode {
  return {
    engine: 'generic',
    x: 100,
    y: 200,
    label: 'N',
    config: emptyConfig(),
    topology: defaultTopology(),
    ...partial,
  }
}

describe('svgContextHitTest', () => {
  it('pointInGlyphArtBox detects containment', () => {
    const box = { x: 0, y: 0, w: 40, h: 20 }
    expect(pointInGlyphArtBox(10, 10, box)).toBe(true)
    expect(pointInGlyphArtBox(50, 10, box)).toBe(false)
  })

  it('finds node when world point is inside glyph art box', () => {
    const db = node({ id: 'db', archetype: 'database', x: 100, y: 200 })
    const box = walkthroughGlyphArtBox(db)
    const hit = findSvgNodeIdAtWorldPoint(
      [db],
      box.x + box.w / 2,
      box.y + box.h / 2,
    )
    expect(hit).toBe('db')
  })

  it('prefers topmost overlapping art box by paint order', () => {
    const back = node({ id: 'back', archetype: 'app-server', x: 100, y: 100 })
    const front = node({ id: 'front', archetype: 'app-server', x: 100, y: 140 })
    const frontBox = walkthroughGlyphArtBox(front)
    const hit = findSvgNodeIdAtWorldPoint(
      [back, front],
      frontBox.x + frontBox.w / 2,
      frontBox.y + frontBox.h / 2,
    )
    expect(hit).toBe('front')
  })

  it('returns null when far from all tips', () => {
    const db = node({ id: 'db', archetype: 'database', x: 0, y: 0 })
    expect(findSvgNodeIdAtWorldPoint([db], 5000, 5000)).toBeNull()
  })
})
