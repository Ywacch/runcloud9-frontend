import { HALF_H, HALF_W, type WorldPoint } from '../math/iso'

/** Center of the top diamond face (glyph anchor = left tip). */
export function faceCenter(node: { x: number; y: number }): WorldPoint {
  return { x: node.x + HALF_W, y: node.y }
}

/**
 * Port on the top-face rim toward `toward`. Edges leave/enter the nearest
 * side of the glyph instead of always stabbing the face center.
 */
export function attachPoint(
  node: { x: number; y: number },
  toward?: WorldPoint | null,
): WorldPoint {
  const center = faceCenter(node)
  if (!toward) return center

  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return center

  // Rim of an ellipse inscribed in the top face (~55% of half extents).
  const ux = dx / len
  const uy = dy / len
  return {
    x: center.x + ux * HALF_W * 0.55,
    y: center.y + uy * HALF_H * 0.55,
  }
}

/** Source→target attach pair (each port faces its peer). */
export function attachPair(
  source: { x: number; y: number },
  target: { x: number; y: number },
): { source: WorldPoint; target: WorldPoint } {
  const sc = faceCenter(source)
  const tc = faceCenter(target)
  return {
    source: attachPoint(source, tc),
    target: attachPoint(target, sc),
  }
}
