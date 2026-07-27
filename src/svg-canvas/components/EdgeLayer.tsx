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
  EDGE_ARROW_OUTLINE,
  EDGE_HIT_STROKE,
  EDGE_JUNCTION_R,
  EDGE_SOURCE_UNDERLAP,
  arrowCloudcraftPolygon,
  clearanceForArchetype,
  extendBehind,
  glyphRimRadius,
  junctionPoints,
  paintedSegmentEnds,
  terminalArrowGeometry,
} from '../fx/edgePaint'
import {
  resolveEdgePaint,
  type EdgeStylePresetId,
} from '../fx/edgePresets'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import { faceCenter } from '../routing/attach'
import { useSvgCanvasStore } from '../store/svgCanvasStore'
import type { FloorThemeId } from '../theme/floorTheme'
import type { SvgEdge } from '../store/svgTypes'

const TOPOLOGY_STROKE = '#b91c1c'

type EdgeLayerProps = {
  edges: SvgEdge[]
  selectedEdgeIds: string[]
  edgeStylePreset: EdgeStylePresetId
  floorTheme: FloorThemeId
  paint?: 'all' | 'segments' | 'terminals'
  onEdgePointerDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void
}

export function EdgeLayer({
  edges,
  selectedEdgeIds,
  edgeStylePreset,
  floorTheme,
  paint = 'all',
  onEdgePointerDown,
}: EdgeLayerProps) {
  const renderSegments = paint !== 'terminals'
  const renderTerminals = paint !== 'segments'
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
  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof svgNodes)[number]>()
    for (const n of svgNodes) map.set(n.id, n)
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
        const targetNode = nodeById.get(edge.targetNodeId)
        const sourceNode = nodeById.get(edge.sourceNodeId)
        const endArrow = hasEndArrow
          ? terminalArrowGeometry(
              pts[pts.length - 1],
              pts[pts.length - 2],
              clearEnd,
              undefined,
                  targetNode
                ? {
                    face: faceCenter(targetNode, targetNode.archetype),
                    rimRadius: glyphRimRadius(targetNode.archetype),
                  }
                : undefined,
            )
          : null
        const startArrow = hasStartArrow
          ? terminalArrowGeometry(
              pts[0],
              pts[1],
              clearStart,
              undefined,
                  sourceNode
                ? {
                    face: faceCenter(sourceNode, sourceNode.archetype),
                    rimRadius: glyphRimRadius(sourceNode.archetype),
                  }
                : undefined,
            )
          : null

        return (
          <g key={edge.id} data-edge-id={edge.id} opacity={opacity}>
            {renderSegments ? pts.slice(0, -1).map((a, i) => {
              const b = pts[i + 1]
              const isFirst = i === 0
              const isLast = i === lastSeg
              const painted = paintedSegmentEnds(a, b, {
                insetStart: false,
                insetEnd: false,
                // Attach ports already sit outside the glyph rim — extra
                // source clearance left a floating gap (Domenech shafts meet
                // the node). Only pull the target back when there is no tip.
                nodeClearanceStart: false,
                nodeClearanceEnd: isLast && !hasEndArrow,
                clearanceStart: clearStart,
                clearanceEnd: clearEnd,
              })
              const paintedA = isFirst
                ? startArrow
                  ? startArrow.base
                  : extendBehind(painted.a, painted.b, EDGE_SOURCE_UNDERLAP)
                : painted.a
              const paintedB =
                isLast && endArrow ? endArrow.base : painted.b
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
                      x1={paintedA.x}
                      y1={paintedA.y}
                      x2={paintedB.x}
                      y2={paintedB.y}
                      stroke={color}
                      strokeWidth={width + 4}
                      strokeLinecap="round"
                      opacity={0.25}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : null}
                  <line
                    x1={paintedA.x}
                    y1={paintedA.y}
                    x2={paintedB.x}
                    y2={paintedB.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeDasharray={dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            }) : null}
            {renderTerminals ? elbows.map((p, i) => (
              <circle
                key={`${edge.id}-j-${i}`}
                cx={p.x}
                cy={p.y}
                r={EDGE_JUNCTION_R}
                fill={color}
                style={{ pointerEvents: 'none' }}
              />
            )) : null}
            {renderTerminals && endArrow ? (
              <g style={{ pointerEvents: 'none' }} data-edge-arrow="end">
                <polygon
                  points={arrowCloudcraftPolygon(
                    endArrow.base.x,
                    endArrow.base.y,
                    endArrow.tip.x,
                    endArrow.tip.y,
                  )}
                  fill={color}
                  stroke={color}
                  strokeWidth={EDGE_ARROW_OUTLINE}
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
            {renderTerminals && startArrow ? (
              <g style={{ pointerEvents: 'none' }} data-edge-arrow="start">
                <polygon
                  points={arrowCloudcraftPolygon(
                    startArrow.base.x,
                    startArrow.base.y,
                    startArrow.tip.x,
                    startArrow.tip.y,
                  )}
                  fill={color}
                  stroke={color}
                  strokeWidth={EDGE_ARROW_OUTLINE}
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
            {renderSegments && badge && mid ? (
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
