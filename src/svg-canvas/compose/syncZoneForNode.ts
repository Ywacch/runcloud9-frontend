import {
  CC_HALF_W,
} from './cloudcraftRedisBrand'
import { composeGlyph, type ComposedGlyph } from './composeGlyph'
import { HALF_W, screenToIso } from '../math/iso'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'
import type { SvgNode, SvgZone } from '../store/svgTypes'

/**
 * How far a unit extends past its left tip along the +i lattice axis
 * (top-face width). Tip is already the left edge â€” do not pad âˆ’i the same amount.
 */
function unitHalfPad(node: SvgNode, brandBody: 'redis' | null): number {
  if (brandBody === 'redis') {
    return CC_HALF_W / HALF_W // â‰ˆ 0.98
  }
  if (node.archetype in SPRITE_METRICS) {
    const metric = SPRITE_METRICS[node.archetype as SpriteKind]
    return metric.w / (2 * HALF_W)
  }
  // Client / unknown procedural â€” compact pad.
  return 0.85
}

/**
 * Group boundary (Zone) when units are laid out in-plane (`packing: 'fan'`):
 * Redis multi-replica marks, DB shard nests, or MQ parallel shards.
 * Collapsed vertical `stack` = no zone.
 *
 * Sized from unit *tip* lattice positions + a compact per-unit pad â€” not a
 * screen AABB (which balloons diamond nests into huge iso diamonds).
 * `cols` / `rows` are half-cell counts (same units as originI / originJ).
 */
export type ZoneGlyphOverride = ComposedGlyph & { units: { dx: number; dy: number }[] }

export function syncZoneForNode(
  node: SvgNode,
  override?: ZoneGlyphOverride,
): SvgZone | null {
  const composed = override ?? composeGlyph(node)
  if (composed.units.length <= 1) return null
  if (composed.packing !== 'fan') return null

  const tips = composed.units.map((u) =>
    screenToIso(node.x + u.dx, node.y + u.dy),
  )
  const pad = unitHalfPad(node, composed.brandBody)
  const edge = 0.15

  // Left tip â†’ body extends mainly +i / Â±j, not âˆ’i.
  let minI = Math.min(...tips.map((t) => t.i)) - edge
  let maxI = Math.max(...tips.map((t) => t.i)) + pad + edge
  let minJ = Math.min(...tips.map((t) => t.j)) - pad * 0.55 - edge
  let maxJ = Math.max(...tips.map((t) => t.j)) + pad * 0.55 + edge

  // Snap rim to half-cell lattice so the diamond edges match the floor grid.
  minI = Math.floor(minI * 2) / 2
  maxI = Math.ceil(maxI * 2) / 2
  minJ = Math.floor(minJ * 2) / 2
  maxJ = Math.ceil(maxJ * 2) / 2

  const cols = Math.max(2, maxI - minI)
  const rows = Math.max(2, maxJ - minJ)

  const count =
    node.archetype === 'message-queue' || node.archetype === 'database'
      ? composed.tubeCount
      : node.topology.replicas

  return {
    id: `zone-${node.id}`,
    ownerNodeId: node.id,
    kind: 'replicas',
    originI: minI,
    originJ: minJ,
    cols,
    rows,
    label: `×${count}`,
  }
}

/** Obstacle anchors for a node: each composed unit tip. */
export function unitObstacleAnchors(node: SvgNode): {
  x: number
  y: number
}[] {
  return composeGlyph(node).units.map((u) => ({
    x: node.x + u.dx,
    y: node.y + u.dy,
  }))
}
