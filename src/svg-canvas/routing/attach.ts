import { HALF_H, HALF_W, type WorldPoint } from '../math/iso'
import type { Archetype } from '../store/svgTypes'

/** Center of the top diamond face (glyph anchor = left tip). */
export function faceCenter(node: { x: number; y: number }): WorldPoint {
  return { x: node.x + HALF_W, y: node.y }
}

/** Top-face attach ellipse half-extents by archetype (world units). */
export function attachExtents(archetype?: Archetype | string): {
  hw: number
  hh: number
  /** Extra push past the face rim so stubs clear extruded bodies. */
  outset: number
} {
  switch (archetype) {
    case 'message-queue':
      // Wide tube — ports fan along the long axis, sit further out.
      return { hw: HALF_W * 0.92, hh: HALF_H * 0.42, outset: 18 }
    case 'database':
      return { hw: HALF_W * 0.48, hh: HALF_H * 0.42, outset: 22 }
    case 'cache':
      return { hw: HALF_W * 0.5, hh: HALF_H * 0.48, outset: 16 }
    case 'load-balancer':
      return { hw: HALF_W * 0.58, hh: HALF_H * 0.55, outset: 14 }
    default:
      return { hw: HALF_W * 0.55, hh: HALF_H * 0.55, outset: 10 }
  }
}

export type AttachOpts = {
  archetype?: Archetype | string
  /** 0-based index among edges sharing this node as an endpoint. */
  slot?: number
  /** Total edges sharing this node as an endpoint (≥1). */
  slotCount?: number
}

/**
 * Port outside the top-face rim toward `toward`. Optional slot fan keeps
 * multiple stubs from stacking on the same approach angle.
 */
export function attachPoint(
  node: { x: number; y: number },
  toward?: WorldPoint | null,
  opts: AttachOpts = {},
): WorldPoint {
  const center = faceCenter(node)
  if (!toward) return center

  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return center

  let angle = Math.atan2(dy, dx)
  const slotCount = Math.max(1, opts.slotCount ?? 1)
  const slot = opts.slot ?? 0
  if (slotCount > 1) {
    // ~18° between siblings so MQ in/out don't share one squeezed approach.
    const spread = (slot - (slotCount - 1) / 2) * ((Math.PI / 180) * 18)
    angle += spread
  }

  const { hw, hh, outset } = attachExtents(opts.archetype)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  return {
    x: center.x + ux * (hw + outset),
    y: center.y + uy * (hh + outset),
  }
}

/** Source→target attach pair (each port faces its peer). */
export function attachPair(
  source: { x: number; y: number; archetype?: Archetype | string },
  target: { x: number; y: number; archetype?: Archetype | string },
  opts?: {
    sourceSlot?: number
    sourceSlotCount?: number
    targetSlot?: number
    targetSlotCount?: number
  },
): { source: WorldPoint; target: WorldPoint } {
  const sc = faceCenter(source)
  const tc = faceCenter(target)
  return {
    source: attachPoint(source, tc, {
      archetype: source.archetype,
      slot: opts?.sourceSlot,
      slotCount: opts?.sourceSlotCount,
    }),
    target: attachPoint(target, sc, {
      archetype: target.archetype,
      slot: opts?.targetSlot,
      slotCount: opts?.targetSlotCount,
    }),
  }
}
