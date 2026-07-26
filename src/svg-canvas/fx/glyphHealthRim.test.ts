import { describe, expect, it } from 'vitest'
import { normalizedHealthRimVerts } from '../../canvas/config/spriteHealthRim'
import {
  CC_HALF_H,
  CC_HALF_W,
  CC_REDIS_SIDE_H,
  CC_REDIS_STACK_STEP,
} from '../compose/cloudcraftRedisBrand'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'
import {
  glyphHealthRimPoints,
  inflatePoints,
  pointsToAttr,
  redisBrandHealthRimPoints,
} from './glyphHealthRim'

const KINDS = Object.keys(SPRITE_METRICS) as SpriteKind[]

describe('glyphHealthRimPoints', () => {
  it('returns a hex (6 verts) for slab / disc / prism kinds', () => {
    for (const kind of [
      'app-server',
      'cache',
      'database',
      'worker',
      'load-balancer',
    ] as SpriteKind[]) {
      expect(glyphHealthRimPoints(kind)).toHaveLength(6)
    }
  })

  it('returns the 8-vert tube outline for message-queue', () => {
    expect(glyphHealthRimPoints('message-queue')).toHaveLength(8)
  })

  it('maps normalized Pixi verts into the tip-local sprite box', () => {
    for (const kind of KINDS) {
      const m = SPRITE_METRICS[kind]
      const pts = glyphHealthRimPoints(kind)
      const frame =
        kind === 'app-server'
          ? 'server_base'
          : kind === 'load-balancer'
            ? 'loadbalancer_base'
            : kind === 'message-queue'
              ? 'queue_base'
              : `${kind}_base`
      const verts = normalizedHealthRimVerts(frame)!
      expect(pts[0].x).toBeCloseTo(-m.tipX + verts[0].nx * m.w, 5)
      expect(pts[0].y).toBeCloseTo(-m.tipY + verts[0].ny * m.h, 5)
      // Top tip of the iso silhouette sits near the top of the art box.
      const topY = Math.min(...pts.map((p) => p.y))
      expect(topY).toBeCloseTo(-m.tipY, 0)
      const bottomY = Math.max(...pts.map((p) => p.y))
      expect(bottomY).toBeCloseTo(-m.tipY + m.h, 0)
    }
  })
})

describe('redisBrandHealthRimPoints', () => {
  it('traces the full 3-slab outer hex, not a floor diamond', () => {
    const pts = redisBrandHealthRimPoints()
    expect(pts).toHaveLength(6)
    const topDy = -2 * CC_REDIS_STACK_STEP
    expect(pts[0]).toEqual({ x: 0, y: topDy })
    expect(pts[1]).toEqual({ x: CC_HALF_W, y: topDy - CC_HALF_H })
    expect(pts[4]).toEqual({
      x: CC_HALF_W,
      y: CC_HALF_H + CC_REDIS_SIDE_H,
    })
  })
})

describe('inflatePoints', () => {
  it('pushes verts radially out from the centroid', () => {
    const base = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]
    const out = inflatePoints(base, 2)
    // Centroid ≈ (5, 3.333); each point moves away from it.
    for (let i = 0; i < base.length; i++) {
      const before = Math.hypot(base[i].x - 5, base[i].y - 10 / 3)
      const after = Math.hypot(out[i].x - 5, out[i].y - 10 / 3)
      expect(after).toBeGreaterThan(before)
    }
  })
})

describe('pointsToAttr', () => {
  it('serializes points to an SVG polygon attribute', () => {
    expect(
      pointsToAttr([
        { x: 0, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toBe('0,0 1,2')
  })
})
