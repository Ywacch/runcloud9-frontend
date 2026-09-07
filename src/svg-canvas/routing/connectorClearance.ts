import { faceCenter } from './attach'
import { glyphRimExtents } from '../fx/edgePaint'
import type { SvgNode } from '../store/svgTypes'
import type { WorldPoint } from '../math/iso'

export type GlyphHitbox = {
  id: string
  c: WorldPoint
  rx: number
  ry: number
}

export function glyphHitbox(node: SvgNode): GlyphHitbox {
  const { rx, ry } = glyphRimExtents(node.archetype)
  return {
    id: node.id,
    c: faceCenter(node, node.archetype),
    rx: rx * 1.08,
    ry: ry * 1.08,
  }
}

function pointInEllipse(
  p: WorldPoint,
  box: GlyphHitbox,
): boolean {
  const dx = (p.x - box.c.x) / box.rx
  const dy = (p.y - box.c.y) / box.ry
  return dx * dx + dy * dy <= 1
}

/** Interior of the segment (not the ports) vs a glyph ellipse. */
export function segmentHitsGlyph(
  a: WorldPoint,
  b: WorldPoint,
  box: GlyphHitbox,
): boolean {
  const samples = 14
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    if (
      pointInEllipse(
        { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        box,
      )
    ) {
      return true
    }
  }
  return false
}

export function pathHitsBystanders(
  path: WorldPoint[],
  bystanders: GlyphHitbox[],
): boolean {
  if (path.length < 2 || bystanders.length === 0) return false
  for (let i = 1; i < path.length; i++) {
    for (const box of bystanders) {
      if (segmentHitsGlyph(path[i - 1], path[i], box)) return true
    }
  }
  return false
}

function orient(p: WorldPoint, q: WorldPoint, r: WorldPoint): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
}

function onSegment(p: WorldPoint, q: WorldPoint, r: WorldPoint): boolean {
  return (
    Math.min(p.x, r.x) - 0.5 <= q.x &&
    q.x <= Math.max(p.x, r.x) + 0.5 &&
    Math.min(p.y, r.y) - 0.5 <= q.y &&
    q.y <= Math.max(p.y, r.y) + 0.5
  )
}

function nearlyEqual(a: WorldPoint, b: WorldPoint): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1
}

/** Proper segment intersection. Shared endpoints do not count. */
export function segmentsCross(
  p1: WorldPoint,
  p2: WorldPoint,
  q1: WorldPoint,
  q2: WorldPoint,
): boolean {
  if (
    nearlyEqual(p1, q1) ||
    nearlyEqual(p1, q2) ||
    nearlyEqual(p2, q1) ||
    nearlyEqual(p2, q2)
  ) {
    return false
  }
  const o1 = orient(p1, p2, q1)
  const o2 = orient(p1, p2, q2)
  const o3 = orient(q1, q2, p1)
  const o4 = orient(q1, q2, p2)
  if (o1 === 0 && onSegment(p1, q1, p2)) return true
  if (o2 === 0 && onSegment(p1, q2, p2)) return true
  if (o3 === 0 && onSegment(q1, p1, q2)) return true
  if (o4 === 0 && onSegment(q1, p2, q2)) return true
  return o1 * o2 < 0 && o3 * o4 < 0
}

export function pathsCross(a: WorldPoint[], b: WorldPoint[]): boolean {
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true
    }
  }
  return false
}

export function edgesShareNode(
  a: { sourceId: string; targetId: string },
  b: { sourceId: string; targetId: string },
): boolean {
  return (
    a.sourceId === b.sourceId ||
    a.sourceId === b.targetId ||
    a.targetId === b.sourceId ||
    a.targetId === b.targetId
  )
}
