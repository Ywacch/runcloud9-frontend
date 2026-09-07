import type { FloorThemeId } from '../theme/floorTheme'
import type { SvgEdgeStyle } from '../store/svgTypes'
import { EDGE_STROKE_WIDTH } from './edgePaint'

/** Scene-level edge look. Flow is the product default; schematic is optional. */
export type EdgeStylePresetId = 'flow' | 'schematic'

export type ResolvedEdgePaint = {
  color: string
  width: number
  dash: string | undefined
  showJunctions: boolean
}

/** Legacy / light-floor flow stroke (also the projected default). */
export const FLOW_COLOR_LIGHT = '#54626f'
/** Brighter slate so Flow stays readable on the dark floor. */
export const FLOW_COLOR_DARK = '#b4bcc8'

function isThemeableFlowColor(color: string): boolean {
  return (
    !color ||
    color === FLOW_COLOR_LIGHT ||
    color === FLOW_COLOR_DARK ||
    color === '#54626f'
  )
}

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
      width: Math.max(EDGE_STROKE_WIDTH, style.width),
      dash: style.dash === 'none' ? undefined : style.dash,
      showJunctions: false,
    }
  }

  const color = isThemeableFlowColor(style.color)
    ? floorTheme === 'dark'
      ? FLOW_COLOR_DARK
      : FLOW_COLOR_LIGHT
    : style.color

  return {
    color,
    width: Math.max(EDGE_STROKE_WIDTH, style.width),
    dash: style.dash === 'none' ? undefined : style.dash,
    showJunctions: false,
  }
}

export function defaultEdgeStyleForPreset(
  preset: EdgeStylePresetId,
  floorTheme: FloorThemeId = 'dark',
): SvgEdgeStyle {
  if (preset === 'schematic') {
    return {
      color: floorTheme === 'dark' ? '#e8e8ea' : '#0a0a0a',
      width: EDGE_STROKE_WIDTH,
      dash: 'none',
      startStyle: 'none',
      endStyle: 'arrow',
      preset: 'schematic',
    }
  }
  return {
    color: floorTheme === 'dark' ? FLOW_COLOR_DARK : FLOW_COLOR_LIGHT,
    width: EDGE_STROKE_WIDTH,
    dash: 'none',
    startStyle: 'none',
    endStyle: 'arrow',
    preset: 'flow',
  }
}
