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
  clearanceForArchetype,
  junctionPoints,
  paintedSegmentEnds,
} from '../fx/edgePaint'
import {
  resolveEdgePaint,
  type EdgeStylePresetId,
} from '../fx/edgePresets'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import { useSvgCanvasStore } from '../store/svgCanvasStore'
import type { FloorThemeId } from '../theme/floorTheme'
import type { SvgEdge } from '../store/svgTypes'

const TOPOLOGY_STROKE = '#b91c1c'

type EdgeLayerProps = {
  edges: SvgEdge[]
  selectedEdgeIds: string[]
  edgeStylePreset: EdgeStylePresetId
  floorTheme: FloorThemeId
  onEdgePointerDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void
}

export function EdgeLayer({
  edges,
  selectedEdgeIds,
  edgeStylePreset,
  floorTheme,
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
  const svgNodes = useSvgCanvasStore((s) => s.nodes)
  const canvas = useCanvasStore.getState()
  const walkthrough = isWalkthroughRunning(canvas)
  const topologyIssues = useMemo(
    () => getCacheTopologyEdgeIssues(canvasNodes, canvasEdges),
    [canvasNodes, canvasEdges],
  )
  const archetypeById = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of svgNodes) map.set(n.id, n.archetype)
    return map
  }, [svgNodes])

  return (
    <g data-edge-layer>
      {edges.map((edge) => {
        const pts = edge.waypoints
        if (pts.length < 2) return null
        const isSel = selected.has(edge.id)
        const topologyIssue = topologyIssues[edge.id]
        const preset = edge.style.preset ?? edgeStylePreset
        const base = resolveEdgePaint(edge.style, preset, floorTheme)

        let color = isSel ? '#3b82f6' : base.color
        let width = isSel ? base.width + 1 : base.width
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

        const dash = base.dash
        const hasStartArrow = edge.style.startStyle === 'arrow'
        const hasEndArrow = edge.style.endStyle === 'arrow'
        const protocol = edge.protocol ?? 'http'
        const mid = protocolBadgeMidpoint(edge)
        const badge = mid
          ? protocolBadgeLayout(protocol, topologyIssue)
          : null
        const elbows = base.showJunctions ? junctionPoints(pts) : []
        const lastSeg = pts.length - 2
        const clearStart = clearanceForArchetype(
          archetypeById.get(edge.sourceNodeId),
        )
        const clearEnd = clearanceForArchetype(
          archetypeById.get(edge.targetNodeId),
        )
        const endTip = hasEndArrow
          ? approachTip(pts[pts.length - 1], pts[pts.length - 2], clearEnd)
          : null
        const startTip = hasStartArrow
          ? approachTip(pts[0], pts[1], clearStart)
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
                nodeClearanceStart: isFirst,
                nodeClearanceEnd: isLast,
                clearanceStart: clearStart,
                clearanceEnd: clearEnd,
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
