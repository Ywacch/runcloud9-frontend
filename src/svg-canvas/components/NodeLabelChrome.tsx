import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { isExpandToggleEligible } from '../compose/expandEligibility'
import { useDragLiveEpoch } from '../hooks/useEdgeRenderModel'
import { getDragLive } from '../store/dragLiveStore'
import { useExpanded } from '../store/expandStore'
import type { SvgNode } from '../store/svgTypes'
import {
  nodeChromeAnchors,
  provisionedSublabelForNode,
  replicaBadgeText,
  shouldShowProvisionedSublabel,
  statusDotColor,
} from '../fx/nodeChrome'

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
}

function NodeChromeRow({
  node,
  opacity,
  showSublabel,
  canvasNode,
}: NodeChromeRowProps) {
  const drag = getDragLive()
  const expanded = useExpanded(node)
  const expandEligible = isExpandToggleEligible(node)
  const o = drag?.idSet.has(node.id) ? drag.origins[node.id] : null
  const placed = o ? { ...node, x: o.x + drag!.dx, y: o.y + drag!.dy } : node
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
  const mode = useCanvasStore((s) => s.mode)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const showSublabel = shouldShowProvisionedSublabel(mode)

  return (
    <g data-node-label-chrome style={{ pointerEvents: 'none' }}>
      {nodes.map((node) => (
        <NodeChromeRow
          key={node.id}
          node={node}
          opacity={opacityById?.get(node.id) ?? 1}
          showSublabel={showSublabel}
          canvasNode={canvasNodes[node.id]}
        />
      ))}
    </g>
  )
}
