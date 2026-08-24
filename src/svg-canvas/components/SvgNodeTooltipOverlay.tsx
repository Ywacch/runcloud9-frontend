import { useEffect, useState } from 'react'
import { computeHealthState } from '../../editor-core/domain/healthThresholds'
import {
  useCanvasStore,
} from '../../editor-core/stores/canvasStore'
import { isInstanceScopeViewportMode } from '../../lib/devInstanceScopePreview'
import { useMetricsStore } from '../../editor-core/stores/metricsStore'
import { NodeTooltip } from '../../editor-ui/NodeTooltip'
import { HALF_H, HALF_W } from '../math/iso'
import { useSvgCanvasStore } from '../store/svgCanvasStore'
import {
  subscribeSvgViewportScreenRefresh,
  svgWorldToHost,
} from '../utils/svgViewportBridge'

/** Tip-local offset toward face center / above the glyph (matches Pixi tile bias). */
const TOOLTIP_ANCHOR_DX = HALF_W
const TOOLTIP_ANCHOR_DY = -HALF_H - 10

export function SvgNodeTooltipOverlay() {
  const mode = useCanvasStore((s) => s.mode)
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId)
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const svgNodes = useSvgCanvasStore((s) => s.nodes)
  const metrics = useMetricsStore((s) => s.metrics)
  const [, refresh] = useState(0)

  useEffect(() => {
    if (!isInstanceScopeViewportMode(mode) || !hoveredNodeId) return
    return subscribeSvgViewportScreenRefresh(() => {
      refresh((n) => n + 1)
    })
  }, [mode, hoveredNodeId])

  if (!isInstanceScopeViewportMode(mode) || !hoveredNodeId) return null

  const node = canvasNodes[hoveredNodeId]
  if (!node) return null

  const svgNode = svgNodes.find((n) => n.id === hoveredNodeId)
  if (!svgNode) return null

  const screen = svgWorldToHost(
    svgNode.x + TOOLTIP_ANCHOR_DX,
    svgNode.y + TOOLTIP_ANCHOR_DY,
  )
  if (!screen) return null

  const bucket = metrics[hoveredNodeId]
  const health = computeHealthState(bucket, node.status)
  const align = node.position[0] > 0 ? 'left' : 'right'

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ transform: `translate(${screen.x}px, ${screen.y}px)` }}
      data-svg-node-tooltip
    >
      <NodeTooltip node={node} metrics={bucket} health={health} align={align} />
    </div>
  )
}
