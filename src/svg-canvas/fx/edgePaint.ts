import type { WorldPoint } from '../math/iso'
import type { Archetype } from '../store/svgTypes'

/**
 * Edge paint — Cloudcraft connector recipe (line connects / Serverless /
 * Streaming extracts): stroke 2 round, symmetric notched chevron tip.
 */
/** Tip → wing depth (Cloudcraft vertical stub ~14; keep slightly larger). */
export const EDGE_ARROW_LENGTH = 16
/** Tip → notch / shaft-meet (Cloudcraft ~10–14). */
export const EDGE_ARROW_NOTCH = 11
/** Half-width at the wings (Cloudcraft ~7–11). */
export const EDGE_ARROW_HALF_W = 9
/** Tip outline (Cloudcraft polygon stroke-width 1). */
export const EDGE_ARROW_OUTLINE = 1
/** Shaft meets the chevron notch. */
export const EDGE_ARROW_SHAFT_INSET = EDGE_ARROW_NOTCH
export const EDGE_ARROW_INSET = EDGE_ARROW_SHAFT_INSET
/** Fallback: tiny tuck outside the attach port toward the wire. */
export const EDGE_NODE_CLEARANCE = 4
export const EDGE_JUNCTION_R = 3
export const EDGE_HIT_STROKE = 10
/** Cloudcraft shaft weight. */
export const EDGE_STROKE_WIDTH = 2
/** Optional Wire dash. */
export const EDGE_SCHEMATIC_DASH = '2 4'
/**
 * Pull the visible source stub back under the glyph. Segments paint under
 * nodes, so this closes floating gaps without changing route waypoints.
 */
export const EDGE_SOURCE_UNDERLAP = 16

/** Move `from` away from `to` by `dist` (bury under a glyph). */
export function extendBehind(
  from: WorldPoint,
  to: WorldPoint,
  dist: number,
): WorldPoint {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: from.x - (dx / len) * dist, y: from.y - (dy / len) * dist }
}

/**
 * How far the tip sits outside the attach port toward the wire when no face
 * rim is supplied (fallback). Prefer `glyphRimExtents` + face center.
 */
export function clearanceForArchetype(
  archetype?: Archetype | string | null,
): number {
  switch (archetype) {
    case 'database':
      return 10
    case 'message-queue':
      return 8
    case 'cache':
      return 8
    case 'load-balancer':
      return 6
    case 'worker':
      return 5
    case 'app-server':
      return 4
    default:
      return EDGE_NODE_CLEARANCE
  }
}

/**
 * Elliptical world-space radius extents (rx, ry) from face center to visible silhouette rim.
 */
export function glyphRimExtents(
  archetype?: Archetype | string | null,
): { rx: number; ry: number } {
  switch (archetype) {
    case 'database':
      return { rx: 45, ry: 38 }
    case 'message-queue':
      return { rx: 76, ry: 30 }
    case 'cache':
      return { rx: 58, ry: 28 }
    case 'load-balancer':
      return { rx: 56, ry: 44 }
    case 'worker':
      return { rx: 54, ry: 28 }
    case 'app-server':
      return { rx: 50, ry: 24 }
    default:
      return { rx: 48, ry: 28 }
  }
}

/**
 * World-space radius from face center to the visible silhouette edge along an
 * approach. Tip sits on this rim so it kisses the outside (terminals paint
 * above glyphs, so anything inside the radius looks buried).
 */
export function glyphRimRadius(
  archetype?: Archetype | string | null,
): number {
  const { rx, ry } = glyphRimExtents(archetype)
  return Math.max(rx, ry)
}

/**
 * Cloudcraft chevron: tip → left wing → notch → right wing (asymmetric kite).
 * `base` is the notch (shaft meet). `tip` is the point.
 */
export function arrowCloudcraftPolygon(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  halfW = EDGE_ARROW_HALF_W,
): string {
  const dx = tipX - baseX
  const dy = tipY - baseY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux

  const leftX = tipX - ux * EDGE_ARROW_LENGTH + px * halfW
  const leftY = tipY - uy * EDGE_ARROW_LENGTH + py * halfW
  const rightX = tipX - ux * EDGE_ARROW_LENGTH - px * halfW
  const rightY = tipY - uy * EDGE_ARROW_LENGTH - py * halfW

  const notchDepth = EDGE_ARROW_LENGTH * 0.4
  const notchX = tipX - ux * notchDepth
  const notchY = tipY - uy * notchDepth

  return `${tipX},${tipY} ${leftX},${leftY} ${notchX},${notchY} ${rightX},${rightY}`
}

/** @deprecated Alias — Cloudcraft chevron. */
export function arrowDomenechPolygon(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  halfW = EDGE_ARROW_HALF_W,
): string {
  return arrowCloudcraftPolygon(baseX, baseY, tipX, tipY, halfW)
}

/** @deprecated Alias */
export function arrowChevronPolygon(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  halfW = EDGE_ARROW_HALF_W,
): string {
  return arrowCloudcraftPolygon(baseX, baseY, tipX, tipY, halfW)
}

/** @deprecated Alias */
export function arrowPolygon(
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  _length?: number,
  halfW = EDGE_ARROW_HALF_W,
): string {
  return arrowCloudcraftPolygon(baseX, baseY, tipX, tipY, halfW)
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
  return insetAlong(attach, from, clearance, 0.88)
}

export type TerminalArrowGeometry = {
  tip: WorldPoint
  base: WorldPoint
}

/**
 * Wire-side rim parameter on line P(t)=from+t·u for ellipse ((P.x-face.x)/rx)^2 + ((P.y-face.y)/ry)^2 = 1.
 * Wire-side means (P-face)·u ≤ 0 — outside the node along the approach.
 * Returns the hit closest to the node (largest such t).
 */
function rimWireSideT(
  from: WorldPoint,
  ux: number,
  uy: number,
  face: WorldPoint,
  rx: number,
  ry: number,
): number | null {
  const fx = from.x - face.x
  const fy = from.y - face.y
  const rx2 = rx * rx
  const ry2 = ry * ry
  const a = (ux * ux) / rx2 + (uy * uy) / ry2
  const b = 2 * ((fx * ux) / rx2 + (fy * uy) / ry2)
  const c = (fx * fx) / rx2 + (fy * fy) / ry2 - 1
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const sqrt = Math.sqrt(disc)
  const t1 = (-b - sqrt) / (2 * a)
  const t2 = (-b + sqrt) / (2 * a)
  const wireSide = [t1, t2].filter((t) => {
    const hx = fx + t * ux
    const hy = fy + t * uy
    return hx * ux + hy * uy <= 1e-6
  })
  if (!wireSide.length) return null
  return Math.max(...wireSide)
}

/**
 * Tip on the last-stub ray at the glyph rim. Aligned with the painted segment;
 * tip at most kisses the outside — never past the rim into the silhouette.
 */
export function terminalArrowGeometry(
  attach: WorldPoint,
  from: WorldPoint,
  clearance: number,
  shaftInset = EDGE_ARROW_SHAFT_INSET,
  opts?: {
    face?: WorldPoint
    rimRadius?: number
    rimExtents?: { rx: number; ry: number }
  },
): TerminalArrowGeometry {
  const dx = attach.x - from.x
  const dy = attach.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len

  const extents =
    opts?.rimExtents ??
    (opts?.rimRadius != null
      ? { rx: opts.rimRadius, ry: opts.rimRadius }
      : null)

  if (opts?.face && extents && extents.rx > 0 && extents.ry > 0) {
    const { rx, ry } = extents
    const face = opts.face
    let t = rimWireSideT(from, ux, uy, face, rx, ry)
    if (t == null) {
      const raw = { x: face.x - ux * rx, y: face.y - uy * ry }
      t = (raw.x - from.x) * ux + (raw.y - from.y) * uy
    }
    // Tip may sit slightly past the attach port when the port is outside the
    // rim — that's the kiss point. Never place it on the far side of the face.
    const tip = { x: from.x + t * ux, y: from.y + t * uy }
    const towardFace = (tip.x - face.x) * ux + (tip.y - face.y) * uy
    const placed =
      towardFace > 1e-3
        ? { x: face.x - ux * rx, y: face.y - uy * ry }
        : tip

    return {
      tip: placed,
      base: {
        x: placed.x - ux * shaftInset,
        y: placed.y - uy * shaftInset,
      },
    }
  }

  let tipDist = Math.max(0, clearance)
  let shaft = shaftInset
  if (tipDist + shaft > len) {
    const overflow = tipDist + shaft - len
    const shaftCut = Math.min(overflow, Math.max(0, shaft - 6))
    shaft -= shaftCut
    tipDist = Math.min(tipDist, Math.max(0, len - shaft))
  }
  const tip = {
    x: attach.x - ux * tipDist,
    y: attach.y - uy * tipDist,
  }
  return {
    tip,
    base: {
      x: tip.x - ux * shaft,
      y: tip.y - uy * shaft,
    },
  }
}

/**
 * Segment endpoints for painting: optional node clearance + arrow-base inset.
 * Source clearance is usually off — attach ports already sit outside the rim.
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
