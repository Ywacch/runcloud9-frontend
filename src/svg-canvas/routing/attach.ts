import {
  HALF_H,
  HALF_W,
  isoToScreen,
  screenToIso,
  snapIso,
  type WorldPoint,
} from '../math/iso'
import {
  SPRITE_METRICS,
  type SpriteKind,
} from '../glyphs/spriteMetrics'
import type { Archetype } from '../store/svgTypes'

const SPRITE_BY_ARCHETYPE: Partial<Record<string, SpriteKind>> = {
  'app-server': 'app-server',
  database: 'database',
  cache: 'cache',
  'load-balancer': 'load-balancer',
  'message-queue': 'message-queue',
  worker: 'worker',
}

/** Center of the top face (glyph anchor = left tip). Uses sprite seat when known. */
export function faceCenter(
  node: { x: number; y: number; archetype?: Archetype | string },
  archetype?: Archetype | string,
): WorldPoint {
  const kind =
    SPRITE_BY_ARCHETYPE[archetype ?? node.archetype ?? ''] ?? null
  if (kind) {
    const seat = SPRITE_METRICS[kind].faceLogo
    return { x: node.x + seat.cx, y: node.y + seat.cy }
  }
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
      return { hw: HALF_W * 0.92, hh: HALF_H * 0.42, outset: 14 }
    case 'database': {
      const rim = 70
      return { hw: rim, hh: rim, outset: 2 }
    }
    case 'cache':
      return { hw: HALF_W * 0.55, hh: HALF_H * 0.55, outset: 10 }
    case 'load-balancer':
      return { hw: HALF_W * 0.6, hh: HALF_H * 0.58, outset: 10 }
    default:
      // App / worker — tight to the cube so shafts don't float.
      return { hw: HALF_W * 0.5, hh: HALF_H * 0.5, outset: 4 }
  }
}

export type AttachOpts = {
  archetype?: Archetype | string
  /** 0-based index among edges sharing this node as an endpoint. */
  slot?: number
  /** Total edges sharing this node as an endpoint (≥1). */
  slotCount?: number
}

/** Cloudcraft approach axes: 4 iso + screen H/V (unit vectors in world). */
const CLOUDCRAFT_DIRS: WorldPoint[] = [
  { x: HALF_W, y: HALF_H }, // i+
  { x: -HALF_W, y: -HALF_H }, // i-
  { x: -HALF_W, y: HALF_H }, // j+
  { x: HALF_W, y: -HALF_H }, // j-
  { x: 1, y: 0 }, // screen H
  { x: -1, y: 0 },
  { x: 0, y: 1 }, // screen V
  { x: 0, y: -1 },
].map((d) => {
  const len = Math.hypot(d.x, d.y) || 1
  return { x: d.x / len, y: d.y / len }
})

function nearestCloudcraftDir(ux: number, uy: number): WorldPoint {
  let best = CLOUDCRAFT_DIRS[0]
  let bestDot = -Infinity
  for (const d of CLOUDCRAFT_DIRS) {
    const dot = d.x * ux + d.y * uy
    if (dot > bestDot) {
      bestDot = dot
      best = d
    }
  }
  return best
}

function snapToHalfCell(p: WorldPoint): WorldPoint {
  const c = snapIso(screenToIso(p.x, p.y).i, screenToIso(p.x, p.y).j)
  return isoToScreen(c.i, c.j)
}

/**
 * Port outside the top-face rim toward `toward`, snapped onto a Cloudcraft
 * approach axis + half-cell lattice so stubs leave on clean H/V/iso runs
 * that match the router (no fine-grid diagonal leftovers).
 */
export function attachPoint(
  node: { x: number; y: number; archetype?: Archetype | string },
  toward?: WorldPoint | null,
  opts: AttachOpts = {},
): WorldPoint {
  const arch = opts.archetype ?? node.archetype
  const center = faceCenter(node, arch)
  if (!toward) return center

  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return center

  let ux = dx / len
  let uy = dy / len
  const slotCount = Math.max(1, opts.slotCount ?? 1)
  const slot = opts.slot ?? 0
  if (slotCount > 1) {
    // Fan siblings in Cloudcraft axis steps (~45°) so MQ in/out don't stack.
    const spread = (slot - (slotCount - 1) / 2) * (Math.PI / 4)
    const c = Math.cos(spread)
    const s = Math.sin(spread)
    const rx = ux * c - uy * s
    const ry = ux * s + uy * c
    ux = rx
    uy = ry
  }

  const dir = nearestCloudcraftDir(ux, uy)
  const { hw, hh, outset } = attachExtents(arch)
  // Radial distance: average ellipse extent + outset along the chosen axis.
  const radius = Math.abs(dir.x) * hw + Math.abs(dir.y) * hh + outset
  return snapToHalfCell({
    x: center.x + dir.x * radius,
    y: center.y + dir.y * radius,
  })
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
