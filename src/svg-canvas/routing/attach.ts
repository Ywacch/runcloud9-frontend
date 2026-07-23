import { HALF_W, type WorldPoint } from '../math/iso'

/** Center of the top diamond face (glyph anchor = left tip). */
export function attachPoint(node: { x: number; y: number }): WorldPoint {
  return { x: node.x + HALF_W, y: node.y }
}
