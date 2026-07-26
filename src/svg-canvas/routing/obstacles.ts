import { composeGlyph } from '../compose/composeGlyph'
import {
  CC_HALF_W,
} from '../compose/cloudcraftRedisBrand'
import { SPRITE_METRICS, type SpriteKind } from '../glyphs/spriteMetrics'
import {
  HALF_W,
  screenToIso,
  snapIso,
  type IsoPoint,
} from '../math/iso'
import type { SvgNode, SvgZone } from '../store/svgTypes'

/**
 * How far a unit extends past its left tip along the +i lattice axis
 * (top-face width). Tip is already the left edge — do not pad −i the same amount.
 */
function unitHalfPad(node: SvgNode, brandBody: 'redis' | null): number {
  if (brandBody === 'redis') {
    return CC_HALF_W / HALF_W
  }
  if (node.archetype in SPRITE_METRICS) {
    const metric = SPRITE_METRICS[node.archetype as SpriteKind]
    return metric.w / (2 * HALF_W)
  }
  return 0.85
}

function cellKey(i: number, j: number): string {
  return `${i},${j}`
}

/**
 * Lattice cells occupied by a node's composed units.
 * Body extends mainly +i / ±j from the left tip (same model as zones).
 */
export function nodeObstacleCells(node: SvgNode): IsoPoint[] {
  const composed = composeGlyph(node)
  const pad = unitHalfPad(node, composed.brandBody)
  const ri = Math.max(1, Math.ceil(pad))
  const rj = Math.max(1, Math.ceil(pad * 0.55))
  const out: IsoPoint[] = []
  const seen = new Set<string>()

  for (const u of composed.units) {
    const tip = screenToIso(node.x + u.dx, node.y + u.dy)
    const c = snapIso(tip.i, tip.j)
    for (let di = 0; di <= ri; di++) {
      for (let dj = -rj; dj <= rj; dj++) {
        const p = { i: c.i + di, j: c.j + dj }
        const k = cellKey(p.i, p.j)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(p)
      }
    }
  }
  return out
}

/** Lattice cells covered by a zone diamond (inclusive half-cell grid). */
export function zoneObstacleCells(zone: SvgZone): IsoPoint[] {
  const out: IsoPoint[] = []
  const i0 = Math.floor(zone.originI)
  const j0 = Math.floor(zone.originJ)
  const i1 = Math.ceil(zone.originI + zone.cols)
  const j1 = Math.ceil(zone.originJ + zone.rows)
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      out.push({ i, j })
    }
  }
  return out
}

/**
 * Blocked lattice cells for routing: every other node's footprint, plus
 * their fan zones when present. Start/goal stay walkable via the caller.
 */
export function collectObstacleCells(
  nodes: SvgNode[],
  zones: SvgZone[],
  ignoreNodeIds: Set<string>,
): IsoPoint[] {
  const out: IsoPoint[] = []
  for (const n of nodes) {
    if (ignoreNodeIds.has(n.id)) continue
    out.push(...nodeObstacleCells(n))
  }
  for (const z of zones) {
    if (ignoreNodeIds.has(z.ownerNodeId)) continue
    out.push(...zoneObstacleCells(z))
  }
  return out
}
