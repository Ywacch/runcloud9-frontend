export function manhattanWaypoints(
  source: [number, number, number],
  target: [number, number, number]
): [number, number, number][] {
  const [sx, sy, sz] = source
  const [tx, ty, tz] = target

  if (sx === tx) return [source, target]
  if (sz === tz) return [source, target]

  const midX = (sx + tx) / 2
  return [
    [sx, sy, sz],
    [midX, sy, sz],
    [midX, ty, tz],
    [tx, ty, tz],
  ]
}

/** World-space point for a protocol label along the polyline. */
export function midpointAlongWaypoints(
  waypoints: [number, number, number][]
): [number, number, number] {
  if (waypoints.length < 2) return waypoints[0] ?? [0, 0, 0]
  const midSeg = Math.floor((waypoints.length - 1) / 2)
  const a = waypoints[midSeg]
  const b = waypoints[midSeg + 1]
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}
