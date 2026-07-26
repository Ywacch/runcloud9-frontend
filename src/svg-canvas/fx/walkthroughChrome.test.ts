import { describe, expect, it } from 'vitest'
import {
  walkthroughCssColor,
  walkthroughGlyphArtBox,
} from './walkthroughChrome'
import type { SvgNode } from '../store/svgTypes'
import { defaultTopology, emptyConfig } from '../store/svgTypes'
import { SPRITE_METRICS } from '../glyphs/spriteMetrics'

function node(partial: Partial<SvgNode> & Pick<SvgNode, 'archetype'>): SvgNode {
  return {
    id: 'n1',
    engine: 'generic',
    x: 100,
    y: 200,
    label: 'N',
    config: emptyConfig(),
    topology: defaultTopology(),
    ...partial,
  }
}

describe('walkthroughChrome', () => {
  it('formats Pixi hex colors as CSS', () => {
    expect(walkthroughCssColor(0x22d3ee)).toBe('#22d3ee')
    expect(walkthroughCssColor(0x00aeef)).toBe('#00aeef')
  })

  it('pads sprite art boxes from tip-local metrics', () => {
    const db = node({ archetype: 'database' })
    const spec = SPRITE_METRICS.database
    const box = walkthroughGlyphArtBox(db, 8)
    expect(box.x).toBe(db.x - spec.tipX - 8)
    expect(box.y).toBe(db.y - spec.tipY - 8)
    expect(box.w).toBe(spec.w + 16)
    expect(box.h).toBe(spec.h + 16)
  })

  it('bounds redis brand and client glyphs', () => {
    const redis = walkthroughGlyphArtBox(
      node({ archetype: 'cache', engine: 'redis', x: 0, y: 0 }),
    )
    expect(redis.w).toBeGreaterThan(100)
    expect(redis.h).toBeGreaterThan(50)

    const client = walkthroughGlyphArtBox(
      node({ archetype: 'client', x: 0, y: 0 }),
    )
    expect(client.w).toBe(128 + 16)
    expect(client.h).toBeGreaterThan(80)
  })
})
