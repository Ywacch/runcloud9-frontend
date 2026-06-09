import type { ConnectionPort } from './connectionPoint'

export interface Point2D {
  x: number
  y: number
}

export interface PathSegment {
  p1: Point2D
  p2: Point2D
  length: number
}

export interface PathRoute {
  waypoints: Point2D[]
  segments: PathSegment[]
  totalLength: number
}

function segmentLength(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.hypot(dx, dy)
}

function dedupeWaypoints(waypoints: Point2D[]): Point2D[] {
  return waypoints.filter((pt, i, arr) => {
    if (i === 0) return true
    const prev = arr[i - 1]
    return Math.abs(pt.x - prev.x) > 1 || Math.abs(pt.y - prev.y) > 1
  })
}

/**
 * Cloudcraft-style isometric manhattan routing.
 *
 * Routes connections directly between component ports along the two iso grid
 * axes (slopes ±0.5 in screen space) with a single L-bend.
 *
 * Path shape:  source port → iso-bend → target port  (3 waypoints, 2 segments)
 *
 * The bend point is the intersection of:
 *   Line A through (sx, sy) with slope +0.5  (iso-right axis)
 *   Line B through (tx, ty) with slope -0.5  (iso-left axis)
 *
 * We compute both possible L-bend orientations and pick whichever keeps the
 * bend point closer to the midpoint of source and target.
 */
export function getIsoManhattanWaypoints(sp: ConnectionPort, tp: ConnectionPort): Point2D[] {
  // Route directly between port positions — no vertical drops to floor.
  const sx = sp.x
  const sy = sp.y
  const tx = tp.x
  const ty = tp.y

  // Option A: source follows iso-right (+0.5), target follows iso-left (-0.5)
  const axA = (sx + tx) / 2 + (ty - sy)
  const ayA = sy + 0.5 * (axA - sx)

  // Option B: source follows iso-left (-0.5), target follows iso-right (+0.5)
  const axB = (sx + tx) / 2 - (ty - sy)
  const ayB = sy - 0.5 * (axB - sx)

  // Pick whichever bend point is closer to the center of source/target
  const cx = (sx + tx) / 2
  const cy = (sy + ty) / 2
  const distA = (axA - cx) ** 2 + (ayA - cy) ** 2
  const distB = (axB - cx) ** 2 + (ayB - cy) ** 2
  const bendX = distA <= distB ? axA : axB
  const bendY = distA <= distB ? ayA : ayB

  return dedupeWaypoints([
    { x: sp.x, y: sp.y },       // source port (on sprite body)
    { x: bendX, y: bendY },     // iso-axis bend point
    { x: tp.x, y: tp.y },       // target port (on sprite body)
  ])
}

export function buildPathRoute(waypoints: Point2D[]): PathRoute {
  const segments: PathSegment[] = []
  let totalLength = 0
  for (let i = 1; i < waypoints.length; i++) {
    const p1 = waypoints[i - 1]
    const p2 = waypoints[i]
    const length = segmentLength(p1, p2)
    segments.push({ p1, p2, length })
    totalLength += length
  }
  return { waypoints, segments, totalLength }
}

export function computeConnectionPath(sp: ConnectionPort, tp: ConnectionPort): PathRoute {
  return buildPathRoute(getIsoManhattanWaypoints(sp, tp))
}

/** Parametric position along the full routed path (t in 0..1). */
export function positionOnPath(route: PathRoute, t: number): Point2D {
  if (route.waypoints.length === 0) return { x: 0, y: 0 }
  if (route.totalLength === 0) return route.waypoints[0]

  const targetDist = Math.max(0, Math.min(1, t)) * route.totalLength
  let currentDist = 0

  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i]
    if (targetDist <= currentDist + seg.length || i === route.segments.length - 1) {
      const segT = seg.length > 0 ? (targetDist - currentDist) / seg.length : 0
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * segT,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * segT,
      }
    }
    currentDist += seg.length
  }

  return route.waypoints[route.waypoints.length - 1]
}
