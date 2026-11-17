import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMemo } from 'react'
import {
  isWalkthroughRunning,
  walkthroughEdgeStyle,
} from '../../canvas/utils/walkthroughVisual'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../../editor-core/stores/templateRegistryStore'
import { getCacheTopologyEdgeIssues } from '../../lib/cacheTopologyStrategy'
import { classifyAllCanvasEdges } from '../../lib/connectionSemantics'
import { paintForSemanticClass } from '../../lib/edgeSemanticPaint'
import type { EdgeRenderModel } from '../hooks/useEdgeRenderModel'
import {
  CONNECTOR_CHEVRON_D,
  CONNECTOR_CHEVRON_SHAFT_INSET,
  connectorChevronTransform,
} from '../fx/connectorChevron'
import { connectorStrokeForProtocol } from '../fx/connectorStroke'
import {
  EDGE_ARROW_OUTLINE,
  EDGE_HIT_STROKE,
  EDGE_SOURCE_UNDERLAP,
  clearanceForArchetype,
  extendBehind,
  glyphRimExtents,
  paintedSegmentEnds,
  terminalArrowGeometry,
} from '../fx/edgePaint'
import {
  resolveEdgePaint,
  type EdgeStylePresetId,
} from '../fx/edgePresets'
import { walkthroughCssColor } from '../fx/walkthroughChrome'
import { presentWorld } from '../math/projection'
import { useProjectionT } from '../store/projectionStore'
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
  hoveredEdgeId?: string | null
  /** Precomputed once in parent — avoids duplicate classify work across mounts. */
  model?: EdgeRenderModel
  onEdgePointerDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void
  onEdgePointerEnter?: (edgeId: string) => void
  onEdgePointerLeave?: (edgeId: string) => void
}

export function EdgeLayer({
  edges,
  selectedEdgeIds,
  edgeStylePreset,
  floorTheme,
  paint = 'all',
  hoveredEdgeId = null,
  model: modelProp,
  onEdgePointerDown,
  onEdgePointerEnter,
  onEdgePointerLeave,
}: EdgeLayerProps) {
  const renderSegments = paint !== 'terminals'
  const renderTerminals = paint !== 'segments'
  const selected = new Set(selectedEdgeIds)
  const canvasMode = useCanvasStore((s) => s.mode)
  useCanvasStore((s) => s.walkthroughActiveNodeId)
  useCanvasStore((s) => s.walkthroughVisitedNodeIds)
  useCanvasStore((s) => s.walkthroughHighlightedEdgeIds)
  useCanvasStore((s) => s.walkthroughParticipatingNodeIds)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const supportsWorker = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.supportsWorker !== false : true,
  )
  const svgNodes = useSvgCanvasStore((s) => s.nodes)
  const canvas = useCanvasStore.getState()
  const walkthroughFallback = isWalkthroughRunning(canvas)
  const showSemanticPaint =
    (canvasMode === 'design' || canvasMode === 'simulate') && !walkthroughFallback
  const fallbackSemantics = useMemo(
    () =>
      modelProp
        ? null
        : showSemanticPaint
          ? classifyAllCanvasEdges(canvasNodes, canvasEdges, supportsWorker)
          : {},
    [modelProp, showSemanticPaint, canvasNodes, canvasEdges, supportsWorker],
  )
  const fallbackTopology = useMemo(
    () =>
      modelProp ? null : getCacheTopologyEdgeIssues(canvasNodes, canvasEdges),
    [modelProp, canvasNodes, canvasEdges],
  )
  const fallbackArchetype = useMemo(() => {
    if (modelProp) return null
    const map = new Map<string, string>()
    for (const n of svgNodes) map.set(n.id, n.archetype)
    return map
  }, [modelProp, svgNodes])
  const fallbackNodeById = useMemo(() => {
    if (modelProp) return null
    const map = new Map<string, (typeof svgNodes)[number]>()
    for (const n of svgNodes) map.set(n.id, n)
    return map
  }, [modelProp, svgNodes])

  const edgeSemantics = modelProp?.edgeSemantics ?? fallbackSemantics ?? {}
  const topologyIssues = modelProp?.topologyIssues ?? fallbackTopology ?? {}
  const archetypeById = modelProp?.archetypeById ?? fallbackArchetype ?? new Map()
  const nodeById = modelProp?.nodeById ?? fallbackNodeById ?? new Map()
  const walkthrough = modelProp?.walkthrough ?? walkthroughFallback
  const projectionT = useProjectionT()

  return (
    <g data-edge-layer>
      {edges.map((edge) => {
        const pts = edge.waypoints.map((p) => presentWorld(p, projectionT))
        if (pts.length >= 2 && projectionT > 0) {
          const pull = (nodeId: string, index: number) => {
            const node = nodeById.get(nodeId)
            if (!node) return
            const at = presentWorld(node, projectionT)
            const face = faceCenter({ ...node, x: at.x, y: at.y }, node.archetype)
            const p = pts[index]
            pts[index] = {
              x: p.x + (face.x - p.x) * projectionT,
              y: p.y + (face.y - p.y) * projectionT,
            }
          }
          pull(edge.sourceNodeId, 0)
          pull(edge.targetNodeId, pts.length - 1)
        }
        if (pts.length < 2) return null
        const isSel = selected.has(edge.id)
        const isHovered = hoveredEdgeId === edge.id
        const topologyIssue = topologyIssues[edge.id]
        const semantic = edgeSemantics[edge.id]
        const preset = edge.style.preset ?? edgeStylePreset
        const base = resolveEdgePaint(edge.style, preset, floorTheme)
        const protocol = edge.protocol ?? 'http'
        const connectorStroke = connectorStrokeForProtocol(
          protocol,
          preset,
          floorTheme,
        )

        let color = connectorStroke?.color ?? base.color
        let width = connectorStroke?.width ?? base.width
        let opacity = 1
        let highlighted = false
        let dash = connectorStroke?.dash ?? base.dash
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
        } else if (!isSel && semantic) {
          const semanticPaint = paintForSemanticClass(semantic.class)
          if (semanticPaint) {
            color = semanticPaint.color
            if (semanticPaint.dash) dash = semanticPaint.dash
            if (semanticPaint.widthBoost) width = Math.max(width, base.width + semanticPaint.widthBoost)
            if (semanticPaint.opacity != null) opacity = semanticPaint.opacity
          }
        }
        if (isHovered && !isSel && semantic && semantic.class !== 'active') {
          width += 0.5
        }
        if (isSel) {
          color = '#3b82f6'
          width = Math.max(width, base.width + 1)
        }

        const hasEndArrow = edge.style.endStyle === 'arrow'
        const lastSeg = pts.length - 2
        const clearEnd = clearanceForArchetype(
          archetypeById.get(edge.targetNodeId),
        )
        const targetNode = nodeById.get(edge.targetNodeId)
        const endArrow = hasEndArrow
          ? terminalArrowGeometry(
              pts[pts.length - 1],
              pts[pts.length - 2],
              clearEnd,
              CONNECTOR_CHEVRON_SHAFT_INSET,
              targetNode
                ? {
                    face: faceCenter(
                      {
                        ...targetNode,
                        ...presentWorld(targetNode, projectionT),
                      },
                      targetNode.archetype,
                    ),
                    rimExtents: glyphRimExtents(targetNode.archetype),
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
                clearanceEnd: clearEnd,
              })
              const paintedA = isFirst
                ? extendBehind(painted.a, painted.b, EDGE_SOURCE_UNDERLAP)
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
                    onPointerEnter={() => onEdgePointerEnter?.(edge.id)}
                    onPointerLeave={() => onEdgePointerLeave?.(edge.id)}
                    aria-label={semantic?.message}
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
            {renderTerminals && endArrow ? (
              <g style={{ pointerEvents: 'none' }} data-edge-arrow="end">
                <path
                  d={CONNECTOR_CHEVRON_D}
                  transform={connectorChevronTransform(
                    endArrow.tip,
                    pts[pts.length - 2],
                  )}
                  fill={color}
                  stroke={color}
                  strokeWidth={EDGE_ARROW_OUTLINE}
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
