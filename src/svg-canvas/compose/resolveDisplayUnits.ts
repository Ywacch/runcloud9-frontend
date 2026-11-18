import { composeGlyph } from './composeGlyph'
import { composeExpandedFanUnits } from './expandedSlots'
import type { UnitOffset } from './composeAppServer'
import { clampProjection } from '../math/projection'
import type { ReplicaPacking, SvgNode } from '../store/svgTypes'

export type ResolvedGlyph = {
  units: UnitOffset[]
  packing: ReplicaPacking
  brandBody: 'redis' | null
  tubeCount: number
}

export function defaultExpanded(node: SvgNode): boolean {
  return node.topology.packing === 'fan'
}

export function resolveDisplayUnits(
  node: SvgNode,
  expanded: boolean,
  projectionT = 0,
): ResolvedGlyph {
  const composed = composeGlyph(node)
  const packing = composed.packing
  const flatCollapsed = clampProjection(projectionT) >= 1

  if (packing === 'stack') {
    if (!expanded) {
      return {
        units: flatCollapsed ? [{ dx: 0, dy: 0 }] : composed.units,
        packing: composed.packing,
        brandBody: composed.brandBody,
        tubeCount: composed.tubeCount,
      }
    }
    const n = composed.units.length
    return {
      units: composeExpandedFanUnits(n, projectionT),
      packing: composed.packing,
      brandBody: composed.brandBody,
      tubeCount: composed.tubeCount,
    }
  }

  if (!expanded) {
    return {
      units: [{ dx: 0, dy: 0 }],
      packing: composed.packing,
      brandBody: composed.brandBody,
      tubeCount: composed.tubeCount,
    }
  }

  return {
    units: composed.units,
    packing: composed.packing,
    brandBody: composed.brandBody,
    tubeCount: composed.tubeCount,
  }
}
