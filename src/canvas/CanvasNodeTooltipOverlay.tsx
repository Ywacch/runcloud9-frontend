import { useEffect, useState } from 'react'
import { TILE_H, TILE_W, isoToScreen } from './constants'
import { nodeToIso } from './utils/positionAdapter'
import {
  subscribeCanvasViewportScreenRefresh,
  viewportLocalToScreen,
} from './utils/canvasViewportBridge'
import { computeHealthState } from '../editor-core/domain/healthThresholds'
import {
  isMetricsViewportMode,
  useCanvasStore,
} from '../editor-core/stores/canvasStore'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { NodeTooltip } from '../editor-ui/NodeTooltip'

const TOOLTIP_ANCHOR_X = TILE_W / 2
const TOOLTIP_ANCHOR_Y = -TILE_H / 2 - 10

export function CanvasNodeTooltipOverlay() {
  const mode = useCanvasStore((s) => s.mode)
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const metrics = useMetricsStore((s) => s.metrics)
  const [, refresh] = useState(0)

  const tooltipEnabled =
    (mode === 'design' || isMetricsViewportMode(mode)) && Boolean(hoveredNodeId)

  useEffect(() => {
    if (!tooltipEnabled) return
    return subscribeCanvasViewportScreenRefresh(() => {
      refresh((n) => n + 1)
    })
  }, [tooltipEnabled])

  if (!tooltipEnabled || !hoveredNodeId) return null

  const node = nodes[hoveredNodeId]
  if (!node) return null

  const { col, row } = nodeToIso(node.position)
  const anchor = isoToScreen(col, row)
  const screen = viewportLocalToScreen(
    anchor.x + TOOLTIP_ANCHOR_X,
    anchor.y + TOOLTIP_ANCHOR_Y,
  )
  if (!screen) return null

  const bucket = metrics[hoveredNodeId]
  const health = computeHealthState(bucket, node.status)
  const align = node.position[0] > 0 ? 'left' : 'right'
  const showLiveMetrics = isMetricsViewportMode(mode)

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ transform: `translate(${screen.x}px, ${screen.y}px)` }}
    >
      <NodeTooltip
        node={node}
        metrics={bucket}
        health={health}
        align={align}
        showLiveMetrics={showLiveMetrics}
      />
    </div>
  )
}
