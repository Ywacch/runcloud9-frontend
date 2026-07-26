import type { SvgNode } from '../store/svgTypes'
import {
  walkthroughGlyphArtBox,
  type GlyphArtBox,
} from '../fx/walkthroughChrome'

export function pointInGlyphArtBox(
  worldX: number,
  worldY: number,
  box: GlyphArtBox,
): boolean {
  return (
    worldX >= box.x &&
    worldX <= box.x + box.w &&
    worldY >= box.y &&
    worldY <= box.y + box.h
  )
}

/**
 * Hit-test SVG nodes for context menu: prefer art-box containment (topmost by
 * paint order), else nearest tip whose art box still reaches the point radius.
 */
export function findSvgNodeIdAtWorldPoint(
  nodes: readonly SvgNode[],
  worldX: number,
  worldY: number,
): string | null {
  if (nodes.length === 0) return null

  // Paint order: higher y last — reverse so topmost wins on overlap.
  const paintOrder = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)
  for (let i = paintOrder.length - 1; i >= 0; i--) {
    const n = paintOrder[i]
    const box = walkthroughGlyphArtBox(n)
    if (pointInGlyphArtBox(worldX, worldY, box)) return n.id
  }

  let bestId: string | null = null
  let bestDist = Infinity
  for (const n of nodes) {
    const box = walkthroughGlyphArtBox(n)
    // Tip is inside the padded art box; allow nearest tip within box half-diagonal.
    const maxR = Math.hypot(box.w, box.h) / 2
    const d = Math.hypot(worldX - n.x, worldY - n.y)
    if (d <= maxR && d < bestDist) {
      bestDist = d
      bestId = n.id
    }
  }
  return bestId
}
