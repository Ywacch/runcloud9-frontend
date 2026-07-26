import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMemo } from 'react'
import {
  isWalkthroughRunning,
  walkthroughEdgeStyle,
} from '../../canvas/utils/walkthroughVisual'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { getCacheTopologyEdgeIssues } from '../../lib/cacheTopologyStrategy'
import {
  protocolBadgeLayout,
  protocolBadgeMidpoint,
} from '../fx/edgeProtocolBadge'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import type { SvgEdge } from '../store/svgTypes'

const TOPOLOGY_STROKE = '#b91c1c'

type EdgeLayerProps = {
  edges: SvgEdge[]
  selectedEdgeIds: string[]
  onEdgePointerDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void
}

function arrowPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  length = 14,
  halfW = 6,
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const bx = x2 - ux * length
  const by = y2 - uy * length
  const px = -uy
  const py = ux
  const p1 = `${x2},${y2}`
  const p2 = `${bx + px * halfW},${by + py * halfW}`
  const p3 = `${bx - px * halfW},${by - py * halfW}`
  return `${p1} ${p2} ${p3}`
}

export function EdgeLayer({
  edges,
  selectedEdgeIds,
  onEdgePointerDown,
}: EdgeLayerProps) {
  const selected = new Set(selectedEdgeIds)
  useCanvasStore((s) => s.mode)
  useCanvasStore((s) => s.walkthroughActiveNodeId)
  useCanvasStore((s) => s.walkthroughVisitedNodeIds)
  useCanvasStore((s) => s.walkthroughHighlightedEdgeIds)
  useCanvasStore((s) => s.walkthroughParticipatingNodeIds)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const canvas = useCanvasStore.getState()
  const walkthrough = isWalkthroughRunning(canvas)
  const topologyIssues = useMemo(
    () => getCacheTopologyEdgeIssues(canvasNodes, canvasEdges),
    [canvasNodes, canvasEdges],
  )

  return (
    <g data-edge-layer>
      {edges.map((edge) => {
        const pts = edge.waypoints
        if (pts.length < 2) return null
        const isSel = selected.has(edge.id)
        const topologyIssue = topologyIssues[edge.id]

        let color = isSel ? '#3b82f6' : edge.style.color
        let width = isSel ? edge.style.width + 1 : edge.style.width
        let opacity = 1
        let highlighted = false
        if (walkthrough && !isSel) {
          const wt = walkthroughEdgeStyle(
            edge.id,
            edge.sourceNodeId,
            edge.targetNodeId,
            { animated: edge.trafficEnabled === true },
            canvas,
          )
          color = walkthroughCssColor(wt.color)
          width = wt.width
          opacity = wt.alpha
          highlighted = wt.highlighted
        } else if (topologyIssue && !isSel) {
          color = TOPOLOGY_STROKE
          width = Math.max(width, 4)
        }

        const dash =
          edge.style.dash === 'none' ? undefined : edge.style.dash
        const protocol = edge.protocol ?? 'http'
        const mid = protocolBadgeMidpoint(edge)
        const badge = mid
          ? protocolBadgeLayout(protocol, topologyIssue)
          : null

        return (
          <g key={edge.id} data-edge-id={edge.id} opacity={opacity}>
            {pts.slice(0, -1).map((a, i) => {
              const b = pts[i + 1]
              return (
                <g key={`${edge.id}-${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={10}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerDown={(e) => onEdgePointerDown(edge.id, e)}
                  />
                  {highlighted ? (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={color}
                      strokeWidth={width + 4}
                      strokeLinecap="round"
                      opacity={0.25}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : null}
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeDasharray={dash}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}
            {edge.style.endStyle === 'arrow' ? (
              <polygon
                points={arrowPolygon(
                  pts[pts.length - 2].x,
                  pts[pts.length - 2].y,
                  pts[pts.length - 1].x,
                  pts[pts.length - 1].y,
                )}
                fill={color}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            {edge.style.startStyle === 'arrow' ? (
              <polygon
                points={arrowPolygon(
                  pts[1].x,
                  pts[1].y,
                  pts[0].x,
                  pts[0].y,
                )}
                fill={color}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            {badge && mid ? (
              <g
                transform={`translate(${mid.x} ${mid.y})`}
                style={{ pointerEvents: 'none' }}
                data-protocol-badge
              >
                <rect
                  x={-badge.width / 2}
                  y={-badge.height / 2}
                  width={badge.width}
                  height={badge.height}
                  rx={3}
                  ry={3}
                  fill={badge.fill}
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                  fill="#ffffff"
                >
                  {badge.text}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
