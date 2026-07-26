import {
  protocolBadgeFill,
  protocolLabel,
} from '../../canvas/utils/connectionEdgeStyle'
import { midpointAlongWaypoints } from '../../canvas/utils/connectionRoute'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import type { SvgEdge } from '../store/svgTypes'

/** Approximate HTTP/TCP pill size for SVG (Pixi measures Text). */
export function protocolBadgeLayout(
  protocol: 'http' | 'tcp',
  topologyIssue?: string,
): {
  text: string
  fill: string
  width: number
  height: number
} {
  const text = `${protocolLabel(protocol)}${topologyIssue ? ' !' : ''}`
  const padX = 6
  const padY = 2
  // Monospace-ish estimate at 10px: ~6.2px per char
  const width = Math.max(36, text.length * 6.2 + padX * 2)
  const height = 10 + padY * 2
  return {
    text,
    fill: walkthroughCssColor(protocolBadgeFill(topologyIssue)),
    width,
    height,
  }
}

export function protocolBadgeMidpoint(
  edge: Pick<SvgEdge, 'waypoints'>,
): { x: number; y: number } | null {
  if (edge.waypoints.length < 2) return null
  return midpointAlongWaypoints(edge.waypoints)
}
