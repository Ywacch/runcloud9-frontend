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
import {
  EDGE_HIT_STROKE,
  EDGE_JUNCTION_R,
  approachTip,
  arrowPolygon,
  junctionPoints,
  paintedSegmentEnds,
} from '../fx/edgePaint'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import type { SvgEdge } from '../store/svgTypes'

const TOPOLOGY_STROKE = '#b91c1c'

type EdgeLayerProps = {
  edges: SvgEdge[]
  selectedEdgeIds: string[]
  onEdgePointerDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void
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
        const hasStartArrow = edge.style.startStyle === 'arrow'
        const hasEndArrow = edge.style.endStyle === 'arrow'
        const protocol = edge.protocol ?? 'http'
        const mid = protocolBadgeMidpoint(edge)
        const badge = mid
          ? protocolBadgeLayout(protocol, topologyIssue)
          : null
        const elbows = junctionPoints(pts)
        const lastSeg = pts.length - 2
        const endTip = hasEndArrow
          ? approachTip(pts[pts.length - 1], pts[pts.length - 2])
          : null
        const startTip = hasStartArrow
          ? approachTip(pts[0], pts[1])
          : null

        return (
          <g key={edge.id} data-edge-id={edge.id} opacity={opacity}>
            {pts.slice(0, -1).map((a, i) => {
              const b = pts[i + 1]
              const isFirst = i === 0
              const isLast = i === lastSeg
              const painted = paintedSegmentEnds(a, b, {
                insetStart: isFirst && hasStartArrow,
                insetEnd: isLast && hasEndArrow,
                // Always clear the glyph at terminals; arrows sit outside
                // and point in. Lines without arrows also stop short.
                nodeClearanceStart: isFirst,
                nodeClearanceEnd: isLast,
              })
              return (
                <g key={`${edge.id}-${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={EDGE_HIT_STROKE}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerDown={(e) => onEdgePointerDown(edge.id, e)}
                  />
                  {highlighted ? (
                    <line
                      x1={painted.a.x}
                      y1={painted.a.y}
                      x2={painted.b.x}
                      y2={painted.b.y}
                      stroke={color}
                      strokeWidth={width + 4}
                      strokeLinecap="round"
                      opacity={0.25}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : null}
                  <line
                    x1={painted.a.x}
                    y1={painted.a.y}
                    x2={painted.b.x}
                    y2={painted.b.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeDasharray={dash}
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}
            {elbows.map((p, i) => (
              <circle
                key={`${edge.id}-j-${i}`}
                cx={p.x}
                cy={p.y}
                r={EDGE_JUNCTION_R}
                fill={color}
                style={{ pointerEvents: 'none' }}
              />
            ))}
            {endTip ? (
              <polygon
                points={arrowPolygon(
                  pts[pts.length - 2].x,
                  pts[pts.length - 2].y,
                  endTip.x,
                  endTip.y,
                )}
                fill={color}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            {startTip ? (
              <polygon
                points={arrowPolygon(
                  pts[1].x,
                  pts[1].y,
                  startTip.x,
                  startTip.y,
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
