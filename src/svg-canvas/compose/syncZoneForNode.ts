import { composeAppServerUnits, type UnitOffset } from './composeAppServer'
import { screenToIso, snapIso, type WorldPoint } from '../math/iso'
import type { SvgNode, SvgZone } from '../store/svgTypes'

/** Approx screen footprint of one compute cube from its anchor. */
const UNIT_W = 128
const UNIT_H = 111

function unitBounds(anchor: WorldPoint, u: UnitOffset) {
  const x = anchor.x + u.dx
  const y = anchor.y + u.dy
  return {
    minX: x,
    maxX: x + UNIT_W,
    minY: y - 37,
    maxY: y + UNIT_H - 37,
  }
}

/**
 * Group boundary (Zone) only when replicas are laid out in-plane (`packing: 'fan'`),
 * e.g. Redis N full marks beside each other. Collapsed vertical `stack` = no zone
 * (architecture §3.5 / clone-prompt Group boundary).
 */
export function syncZoneForNode(node: SvgNode): SvgZone | null {
  const replicas = node.topology.replicas
  if (replicas <= 1) return null
  if (node.topology.packing !== 'fan') return null

  const units = composeAppServerUnits(replicas)
  const pad = 32
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const u of units) {
    const b = unitBounds({ x: node.x, y: node.y }, u)
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
  const isos = corners.map((p) => snapIso(screenToIso(p.x, p.y).i, screenToIso(p.x, p.y).j))
  const minI = Math.min(...isos.map((p) => p.i)) - 0.5
  const maxI = Math.max(...isos.map((p) => p.i)) + 0.5
  const minJ = Math.min(...isos.map((p) => p.j)) - 0.5
  const maxJ = Math.max(...isos.map((p) => p.j)) + 0.5

  const halfCols = Math.max(2, Math.ceil(maxI - minI))
  const halfRows = Math.max(2, Math.ceil(maxJ - minJ))
  const cols = Math.max(1, Math.ceil(halfCols / 2))
  const rows = Math.max(1, Math.ceil(halfRows / 2))

  return {
    id: `zone-${node.id}`,
    ownerNodeId: node.id,
    kind: 'replicas',
    originI: minI,
    originJ: minJ,
    cols,
    rows,
    label: `×${replicas}`,
  }
}

/** Obstacle anchors for a node: each stacked unit tip. */
export function unitObstacleAnchors(node: SvgNode): WorldPoint[] {
  return composeAppServerUnits(node.topology.replicas).map((u) => ({
    x: node.x + u.dx,
    y: node.y + u.dy,
  }))
}
