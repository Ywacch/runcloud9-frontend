import { composeGlyph } from './composeGlyph'
import type { UnitOffset } from './composeAppServer'
import { screenToIso, snapIso, type WorldPoint } from '../math/iso'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'
import type { SvgNode, SvgZone } from '../store/svgTypes'

/** Fallback footprint for non-sprite marks (Redis brand body). */
const DEFAULT_UNIT_W = 128
const DEFAULT_UNIT_H = 111

/** Real sprite art footprint per archetype, so zones hug the actual units. */
function footprintFor(archetype: SvgNode['archetype']): {
  w: number
  h: number
  tipY: number
} {
  const kind = archetype as SpriteKind
  const metric = SPRITE_METRICS[kind]
  if (metric) return { w: metric.w, h: metric.h, tipY: metric.tipY }
  return { w: DEFAULT_UNIT_W, h: DEFAULT_UNIT_H, tipY: 37 }
}

function unitBounds(
  anchor: WorldPoint,
  u: UnitOffset,
  footprint: { w: number; h: number; tipY: number },
) {
  const x = anchor.x + u.dx
  const y = anchor.y + u.dy
  return {
    minX: x,
    maxX: x + footprint.w,
    minY: y - footprint.tipY,
    maxY: y + footprint.h - footprint.tipY,
  }
}

/**
 * Group boundary (Zone) when units are laid out in-plane (`packing: 'fan'`):
 * Redis multi-replica marks, or MQ parallel shards. Collapsed vertical `stack` = no zone.
 */
export function syncZoneForNode(node: SvgNode): SvgZone | null {
  const composed = composeGlyph(node)
  if (composed.units.length <= 1) return null
  if (composed.packing !== 'fan') return null

  const { units } = composed
  // MQ / DB nests sit tight; Redis diamond wants a little more room.
  const pad =
    node.archetype === 'message-queue' || node.archetype === 'database'
      ? 8
      : 24
  const footprint = footprintFor(node.archetype)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const u of units) {
    const b = unitBounds({ x: node.x, y: node.y }, u, footprint)
    minX = Math.min(minX, b.minX)
    maxX = Math.max(maxX, b.maxX)
    minY = Math.min(minY, b.minY)
    maxY = Math.max(maxY, b.maxY)
  }
  minX -= pad
  maxX += pad
  minY -= pad
  maxY += pad

  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const isos = corners.map((p) =>
    snapIso(screenToIso(p.x, p.y).i, screenToIso(p.x, p.y).j),
  )
  const minI = Math.min(...isos.map((p) => p.i)) - 0.5
  const maxI = Math.max(...isos.map((p) => p.i)) + 0.5
  const minJ = Math.min(...isos.map((p) => p.j)) - 0.5
  const maxJ = Math.max(...isos.map((p) => p.j)) + 0.5

  const halfCols = Math.max(2, Math.ceil(maxI - minI))
  const halfRows = Math.max(2, Math.ceil(maxJ - minJ))
  const cols = Math.max(1, Math.ceil(halfCols / 2))
  const rows = Math.max(1, Math.ceil(halfRows / 2))

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
export function unitObstacleAnchors(node: SvgNode): WorldPoint[] {
  return composeGlyph(node).units.map((u) => ({
    x: node.x + u.dx,
    y: node.y + u.dy,
  }))
}
