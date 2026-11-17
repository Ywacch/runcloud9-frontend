import { useMemo } from 'react'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { isExpandToggleEligible } from '../compose/expandEligibility'
import { useDragLiveEpoch, useSessionLayoutEpoch } from '../hooks/useEdgeRenderModel'
import { getDragLive } from '../store/dragLiveStore'
import { displayWorldPosition } from '../../lib/sessionLayoutStore'
import { presentWorld } from '../math/projection'
import { useProjectionT } from '../store/projectionStore'
import { useExpanded } from '../store/expandStore'
import type { SvgNode } from '../store/svgTypes'
import {
  nodeChromeAnchors,
  provisionedSublabelForNode,
  replicaBadgeText,
  shouldShowProvisionedSublabel,
  statusDotColor,
} from '../fx/nodeChrome'
import {
  buildJobsPanelModel,
  jobBadgeLabelsForNode,
} from '../../lib/engines/jobsPanelModel'
import { templateHasJobsPanel } from '../../lib/engines/templateJobCatalog'

type NodeLabelChromeProps = {
  nodes: SvgNode[]
  /** Walkthrough dimming keyed by node id. */
  opacityById?: Map<string, number>
}

type NodeChromeRowProps = {
  node: SvgNode
  opacity: number
  showSublabel: boolean
  canvasNode: ReturnType<typeof useCanvasStore.getState>['nodes'][string]
  jobLabels: string[]
}

function NodeChromeRow({
  node,
  opacity,
  showSublabel,
  canvasNode,
  jobLabels,
}: NodeChromeRowProps) {
  const drag = getDragLive()
  const projectionT = useProjectionT()
  const expanded = useExpanded(node)
  const expandEligible = isExpandToggleEligible(node)
  const placedPos = presentWorld(displayWorldPosition(node, drag), projectionT)
  const placed = { ...node, x: placedPos.x, y: placedPos.y }
  const anchors = nodeChromeAnchors(placed)
  const badge = replicaBadgeText(node)
  const sublabel =
    showSublabel && canvasNode ? provisionedSublabelForNode(canvasNode) : null
  const status = canvasNode?.status
  const badgeEndX =
    anchors.labelX + (badge ? Math.min(48, node.label.length * 3.5) + 8 : 0)

  return (
    <g opacity={opacity} data-node-chrome={node.id}>
      <text
        x={anchors.labelX}
        y={anchors.labelY}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={12}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
        fill="#ffffff"
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.8)',
          strokeWidth: 2.5,
        }}
      >
        {node.label}
      </text>
      {badge ? (
        <text
          x={anchors.labelX + Math.min(48, node.label.length * 3.5) + 8}
          y={anchors.labelY}
          textAnchor="start"
          dominantBaseline="auto"
          fontSize={10}
          fontWeight={700}
          fontFamily="system-ui, sans-serif"
          fill="#fbbf24"
        >
          {badge}
        </text>
      ) : null}
      {expandEligible ? (
        <text
          x={badgeEndX + (badge ? 6 : 0)}
          y={anchors.labelY}
          textAnchor="start"
          dominantBaseline="auto"
          fontSize={9}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          fill="#94a3b8"
          aria-hidden
        >
          {expanded ? '▾' : '▸'}
        </text>
      ) : null}
      {sublabel ? (
        <text
          x={anchors.labelX}
          y={anchors.sublabelY}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={9}
          fontFamily="system-ui, sans-serif"
          fill="#9ca3af"
          style={{
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.7)',
            strokeWidth: 2,
          }}
        >
          {sublabel}
        </text>
      ) : null}
      {jobLabels.length > 0 ? (
        <text
          x={anchors.labelX}
          y={anchors.sublabelY + (sublabel ? 12 : 0)}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={8}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          fill="#c4b5fd"
          style={{
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.7)',
            strokeWidth: 2,
          }}
        >
          {jobLabels.join(' · ')}
        </text>
      ) : null}
      <circle
        cx={anchors.statusX}
        cy={anchors.statusY}
        r={5}
        fill={statusDotColor(status)}
      />
    </g>
  )
}

/**
 * Name labels, provisioned sublabels (design/simulate), replica badges, status dots.
 * Reads canvasStore for mode + node status / provisioned config.
 * Subscribes to drag-live so labels follow dragged nodes without parent re-render.
 */
export function NodeLabelChrome({
  nodes,
  opacityById,
}: NodeLabelChromeProps) {
  useDragLiveEpoch()
  useSessionLayoutEpoch()
  const mode = useCanvasStore((s) => s.mode)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const jobBindings = useCanvasStore((s) => s.jobBindings)
  const showSublabel = shouldShowProvisionedSublabel(mode)

  const jobLabelsByNodeId = useMemo(() => {
    if (!templateHasJobsPanel(snapshotTemplateId)) return new Map<string, string[]>()
    const snap = useCanvasStore.getState().exportJSON()
    const rows = buildJobsPanelModel(snap, null)
    const map = new Map<string, string[]>()
    for (const node of nodes) {
      map.set(node.id, jobBadgeLabelsForNode(node.id, rows))
    }
    return map
  }, [nodes, snapshotTemplateId, canvasNodes, jobBindings])

  return (
    <g data-node-label-chrome style={{ pointerEvents: 'none' }}>
      {nodes.map((node) => (
        <NodeChromeRow
          key={node.id}
          node={node}
          opacity={opacityById?.get(node.id) ?? 1}
          showSublabel={showSublabel}
          canvasNode={canvasNodes[node.id]}
          jobLabels={jobLabelsByNodeId.get(node.id) ?? []}
        />
      ))}
    </g>
  )
}
