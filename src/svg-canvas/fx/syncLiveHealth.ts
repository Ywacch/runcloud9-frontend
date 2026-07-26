import {
  isChaosActiveForNode,
  resolveHealthVisual,
  type HealthVisualState,
} from '../../canvas/utils/healthVisual'
import {
  isMetricsViewportMode,
  type CanvasMode,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../../editor-core/stores/metricsStore'
import type { ChaosTargetComponent } from '../../lib/chaos'
import type { SvgNode } from '../store/svgTypes'

/**
 * Resolve healthVisual for one SVG node.
 * Live/simulate: metrics + chaos (Pixi ComponentLayer parity).
 * Design: keep demo / local health unless leaving a metrics mode (then off).
 */
export function nextHealthVisualForSvgNode(options: {
  canvasNode: CanvasNode | undefined
  mode: CanvasMode
  metrics: MetricsBucket | undefined
  isTargetActive: (target: ChaosTargetComponent) => boolean
  prevHealth: HealthVisualState | undefined
  leftMetricsMode: boolean
}): HealthVisualState | undefined {
  const {
    canvasNode,
    mode,
    metrics,
    isTargetActive,
    prevHealth,
    leftMetricsMode,
  } = options

  if (canvasNode && isMetricsViewportMode(mode)) {
    return resolveHealthVisual(
      canvasNode,
      metrics,
      mode,
      isChaosActiveForNode(canvasNode, isTargetActive),
    )
  }

  if (leftMetricsMode) return 'off'
  return prevHealth
}

export function mapSvgNodesWithLiveHealth(
  nodes: SvgNode[],
  canvasNodes: Record<string, CanvasNode>,
  mode: CanvasMode,
  metricsById: Record<string, MetricsBucket>,
  isTargetActive: (target: ChaosTargetComponent) => boolean,
  prevHealthById: Map<string, HealthVisualState | undefined>,
  leftMetricsMode: boolean,
): SvgNode[] {
  return nodes.map((n) => {
    const next = nextHealthVisualForSvgNode({
      canvasNode: canvasNodes[n.id],
      mode,
      metrics: metricsById[n.id],
      isTargetActive,
      prevHealth: prevHealthById.get(n.id),
      leftMetricsMode,
    })
    if (next === n.healthVisual) return n
    if (next === undefined && n.healthVisual === undefined) return n
    return { ...n, healthVisual: next }
  })
}
