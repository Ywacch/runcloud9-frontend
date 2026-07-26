import { normalizedHealthRimVerts } from '../../canvas/config/spriteHealthRim'
import {
  CC_HALF_H,
  CC_HALF_W,
  CC_REDIS_SIDE_H,
  CC_REDIS_STACK_STEP,
} from '../compose/cloudcraftRedisBrand'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'
import type { WorldPoint } from '../math/iso'

/**
 * Tip-local health-rim silhouettes for the SVG host.
 *
 * Matches the Pixi path: the rim traces each archetype's outer iso stroke
 * (hex / cylinder / tube), not a floor diamond or AABB. Vertices are the same
 * normalized fractions as `canvas/config/spriteHealthRim.ts`, scaled into the
 * SVG glyph's tip-local display box (`SPRITE_METRICS`).
 */

const FRAME_BY_KIND: Record<SpriteKind, string> = {
  'app-server': 'server_base',
  cache: 'cache_base',
  database: 'database_base',
  worker: 'worker_base',
  'load-balancer': 'loadbalancer_base',
  'message-queue': 'queue_base',
}

/** Outer silhouette of one sprite unit in tip-local space. */
export function glyphHealthRimPoints(kind: SpriteKind): WorldPoint[] {
  const m = SPRITE_METRICS[kind]
  const verts = normalizedHealthRimVerts(FRAME_BY_KIND[kind])
  if (!verts) {
    // Fallback: AABB corners (should never hit — every SpriteKind has a frame).
    return [
      { x: -m.tipX, y: -m.tipY },
      { x: -m.tipX + m.w, y: -m.tipY },
      { x: -m.tipX + m.w, y: -m.tipY + m.h },
      { x: -m.tipX, y: -m.tipY + m.h },
    ]
  }
  return verts.map((v) => ({
    x: -m.tipX + v.nx * m.w,
    y: -m.tipY + v.ny * m.h,
  }))
}

/**
 * Outer hex of the Redis 3-slab brand mark (tip-local).
 * Left tip of the bottom slab's top face is the glyph anchor (0,0).
 */
export function redisBrandHealthRimPoints(): WorldPoint[] {
  const hw = CC_HALF_W
  const hh = CC_HALF_H
  const side = CC_REDIS_SIDE_H
  const topDy = -2 * CC_REDIS_STACK_STEP
  return [
    { x: 0, y: topDy }, // left tip of top slab
    { x: hw, y: topDy - hh }, // top tip
    { x: 2 * hw, y: topDy }, // right tip of top slab
    { x: 2 * hw, y: side }, // right bottom of base
    { x: hw, y: hh + side }, // bottom tip
    { x: 0, y: side }, // left bottom of base
  ]
}

/** Push each vertex radially out from the centroid (matches Pixi `inflatePoly`). */
export function inflatePoints(points: WorldPoint[], amount: number): WorldPoint[] {
  if (points.length === 0) return []
  let cx = 0
  let cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  cx /= points.length
  cy /= points.length
  return points.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount }
  })
}

/** SVG `points` attribute for a polygon. */
export function pointsToAttr(points: WorldPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}
