import {
  buildPathRoute,
  positionOnPath,
  type PathRoute,
} from '../../canvas/utils/connectionRoute'
import type { WorldPoint } from '../math/iso'

export type { PathRoute }

export function routeFromWaypoints(waypoints: WorldPoint[]): PathRoute {
  return buildPathRoute(waypoints)
}

export function pointOnRoute(route: PathRoute, t: number): WorldPoint {
  return positionOnPath(route, t)
}

/** Match Pixi TrafficLayer end-fade: min(p*8, 1, (1-p)*8). */
export function particleFade(progress: number): number {
  const p = Math.max(0, Math.min(1, progress))
  return Math.min(p * 8, 1, (1 - p) * 8)
}

export function wrapProgress(progress: number): number {
  let p = progress
  while (p >= 1) p -= 1
  while (p < 0) p += 1
  return p
}
