import type { FloorThemeId } from '../theme/floorTheme'
import type { SvgEdgeStyle } from '../store/svgTypes'

/** Scene-level edge look. Flow is the product default; schematic is optional. */
export type EdgeStylePresetId = 'flow' | 'schematic'

export type ResolvedEdgePaint = {
  color: string
  width: number
  dash: string | undefined
  showJunctions: boolean
}

const FLOW_DEFAULT_COLOR = '#54626f'

/**
 * Resolve paint for an edge given the scene preset and floor theme.
 * Walkthrough / selection / topology callers may still override after this.
 */
export function resolveEdgePaint(
  style: SvgEdgeStyle,
  preset: EdgeStylePresetId,
  floorTheme: FloorThemeId,
): ResolvedEdgePaint {
  if (preset === 'schematic') {
    return {
      color: floorTheme === 'dark' ? '#e8e8ea' : '#0a0a0a',
      width: Math.max(2, style.width),
      dash: style.dash === 'none' ? undefined : style.dash,
      showJunctions: true,
    }
  }

  return {
    color: style.color || FLOW_DEFAULT_COLOR,
    width: style.width,
    dash: style.dash === 'none' ? undefined : style.dash,
    showJunctions: true,
  }
}

export function defaultEdgeStyleForPreset(
  preset: EdgeStylePresetId,
  floorTheme: FloorThemeId = 'dark',
): SvgEdgeStyle {
  if (preset === 'schematic') {
    return {
      color: floorTheme === 'dark' ? '#e8e8ea' : '#0a0a0a',
      width: 2,
      dash: 'none',
      startStyle: 'none',
      endStyle: 'arrow',
      preset: 'schematic',
    }
  }
  return {
    color: FLOW_DEFAULT_COLOR,
    width: 2,
    dash: 'none',
    startStyle: 'none',
    endStyle: 'arrow',
    preset: 'flow',
  }
}
