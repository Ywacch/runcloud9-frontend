import { composeGlyph } from './composeGlyph'
import type { SvgNode } from '../store/svgTypes'

export function isExpandToggleEligible(node: SvgNode): boolean {
  const composed = composeGlyph(node)
  if (composed.packing === 'stack') {
    return node.topology.replicas > 1
  }
  return composed.tubeCount > 1
}
