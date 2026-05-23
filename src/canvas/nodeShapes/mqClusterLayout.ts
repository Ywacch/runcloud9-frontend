/**
 * Honeycomb layout for message-queue tube clusters (shared by shape + health rim).
 */

export function getMqHoneycombUnitOffsets(): Array<[number, number]> {
  const sqrt3 = Math.sqrt(3)
  return [
    [0, 0],
    [sqrt3 / 2, 1.5],
    [-sqrt3 / 2, 1.5],
    [-sqrt3 / 2, -1.5],
    [sqrt3 / 2, -1.5],
  ]
}

export function getMqClusterOffsets(
  tubeCount: number,
  tubeR: number,
): Array<[number, number]> {
  const base = getMqHoneycombUnitOffsets().slice(
    0,
    Math.min(5, Math.max(1, tubeCount)),
  )
  return base.map(([u, v]) => [u * tubeR, v * tubeR])
}
