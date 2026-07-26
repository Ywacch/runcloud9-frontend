import type { WorldPoint } from '../math/iso'
import type { Archetype } from '../store/svgTypes'

/**
 * RunCloud9 edge paint constants — tuned to our glyphs / dark floor.
 * Technique follows common iso-diagram practice; sizes are ours, not a clone.
 */
export const EDGE_ARROW_LENGTH = 18
export const EDGE_ARROW_HALF_W = 5.5
/** Pull the stroke back so it meets the arrow base. */
export const EDGE_ARROW_INSET = EDGE_ARROW_LENGTH
/** Default body clearance when archetype is unknown. */
export const EDGE_NODE_CLEARANCE = 58
export const EDGE_JUNCTION_R = 3
export const EDGE_HIT_STROKE = 10

/** How far the tip sits outside the attach point, by glyph body. */
export function clearanceForArchetype(
  archetype?: Archetype | string | null,
): number {
  switch (archetype) {
    case 'database':
      return 92
    case 'message-queue':
      return 82
    case 'cache':
      return 76
    case 'load-balancer':
      return 72
    case 'worker':
      return 64
    case 'app-server':
      return 66
    default:
      return EDGE_NODE_CLEARANCE
  }
}

export function arrowPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  length = EDGE_ARROW_LENGTH,
  halfW = EDGE_ARROW_HALF_W,
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const bx = x2 - ux * length
  const by = y2 - uy * length
  const px = -uy
  const py = ux
  return `${x2},${y2} ${bx + px * halfW},${by + py * halfW} ${bx - px * halfW},${by - py * halfW}`
}

/** Move `from` toward `to` by `dist` (clamped to a fraction of the segment). */
export function insetAlong(
  from: WorldPoint,
  to: WorldPoint,
  dist: number,
  maxFraction = 0.45,
): WorldPoint {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const t = Math.min(dist, len * maxFraction) / len
  return { x: from.x + dx * t, y: from.y + dy * t }
}

/**
 * Tip sits outside the node, still aiming at the attach point along the
 * incoming segment.
 */
export function approachTip(
  attach: WorldPoint,
  from: WorldPoint,
  clearance = EDGE_NODE_CLEARANCE,
): WorldPoint {
  // Terminal segments are often short because the last lattice elbow is near
  // the node. Allow most of that segment to be used for body clearance.
  return insetAlong(attach, from, clearance, 0.88)
}

/**
 * Segment endpoints for painting: optional node clearance + arrow-base inset.
 */
export function paintedSegmentEnds(
  a: WorldPoint,
  b: WorldPoint,
  opts: {
    insetStart: boolean
    insetEnd: boolean
    nodeClearanceStart?: boolean
    nodeClearanceEnd?: boolean
    arrowInset?: number
    nodeClearance?: number
    clearanceStart?: number
    clearanceEnd?: number
  },
): { a: WorldPoint; b: WorldPoint } {
  const arrowInset = opts.arrowInset ?? EDGE_ARROW_INSET
  const clearStart =
    opts.clearanceStart ?? opts.nodeClearance ?? EDGE_NODE_CLEARANCE
  const clearEnd =
    opts.clearanceEnd ?? opts.nodeClearance ?? EDGE_NODE_CLEARANCE

  let start = a
  let end = b

  if (opts.nodeClearanceStart) {
    start = approachTip(a, b, clearStart)
  }
  if (opts.nodeClearanceEnd) {
    end = approachTip(b, a, clearEnd)
  }

  return {
    a: opts.insetStart ? insetAlong(start, end, arrowInset) : start,
    b: opts.insetEnd ? insetAlong(end, start, arrowInset) : end,
  }
}

/** Interior elbows (not terminals) — candidates for junction dots. */
export function junctionPoints(waypoints: WorldPoint[]): WorldPoint[] {
  if (waypoints.length < 3) return []
  return waypoints.slice(1, -1)
}
