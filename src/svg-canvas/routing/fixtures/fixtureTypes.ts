import type { WorldPoint } from '../../math/iso'

export type FixtureSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type RoutingFixture = {
  source: string
  description: string
  segments: FixtureSegment[]
  sharedVertices: WorldPoint[]
  arrowAtEndOnly: boolean
}

export function segmentEndpoints(seg: FixtureSegment): [WorldPoint, WorldPoint] {
  return [
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
  ]
}
