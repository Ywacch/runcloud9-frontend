import { useCanvasStore } from '../../editor-core/stores/canvasStore'
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
  liveById?: Map<string, { x: number; y: number }>
  /** Walkthrough dimming keyed by node id. */
  opacityById?: Map<string, number>
}

/**
 * Name labels, provisioned sublabels (design/simulate), replica badges, status dots.
 * Reads canvasStore for mode + node status / provisioned config.
 */
export function NodeLabelChrome({
  nodes,
  liveById,
  opacityById,
}: NodeLabelChromeProps) {
  const mode = useCanvasStore((s) => s.mode)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const showSublabel = shouldShowProvisionedSublabel(mode)

  return (
    <g data-node-label-chrome style={{ pointerEvents: 'none' }}>
      {nodes.map((node) => {
        const live = liveById?.get(node.id)
        const placed = live ? { ...node, x: live.x, y: live.y } : node
        const anchors = nodeChromeAnchors(placed)
        const canvasNode = canvasNodes[node.id]
        const opacity = opacityById?.get(node.id) ?? 1
        const badge = replicaBadgeText(node)
        const sublabel =
          showSublabel && canvasNode
            ? provisionedSublabelForNode(canvasNode)
            : null
        const status = canvasNode?.status

        return (
          <g key={node.id} opacity={opacity} data-node-chrome={node.id}>
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
      })}
    </g>
  )
}
