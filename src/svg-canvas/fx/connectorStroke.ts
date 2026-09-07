import type { SvgEdge } from '../store/svgTypes'
import type { FloorThemeId } from '../theme/floorTheme'
import { EDGE_STROKE_WIDTH } from './edgePaint'
import type { EdgeStylePresetId } from './edgePresets'

/** Stroke recipe from line-1.svg / line2.svg (Inkscape 2.4 → canvas 2). */
export const CONNECTOR_SHAFT_WIDTH = 2
/** Dashed variant from line2.svg / connection-ex exports (8,6 on canvas). */
export const CONNECTOR_DASH_PATTERN = '8 6'

export const CONNECTOR_HTTP_COLOR = '#4286c5'
export const CONNECTOR_TCP_COLOR = '#ff5722'

export type ConnectorStroke = {
  color: string
  width: number
  dash: string | undefined
}

export function connectorStrokeForProtocol(
  protocol: SvgEdge['protocol'] | undefined,
  preset: EdgeStylePresetId,
  floorTheme: FloorThemeId,
): ConnectorStroke | null {
  if (preset === 'schematic') return null
  const width = Math.max(CONNECTOR_SHAFT_WIDTH, EDGE_STROKE_WIDTH)
  if (protocol === 'tcp') {
    return {
      color: CONNECTOR_TCP_COLOR,
      width,
      dash: CONNECTOR_DASH_PATTERN,
    }
  }
  if (protocol === 'http') {
    return {
      color: CONNECTOR_HTTP_COLOR,
      width,
      dash: undefined,
    }
  }
  if (floorTheme === 'dark') {
    return { color: '#b4bcc8', width, dash: undefined }
  }
  return { color: '#54626f', width, dash: undefined }
}
