import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
  nodeSupportsInstanceScope,
} from './dbInstanceScope'

/** Stable instance ids aligned with canvas unit paint order (index i → ids[i]). */
export function sortedCanvasInstanceIds(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  unitCount: number,
): string[] {
  if (!metrics || unitCount <= 1 || !nodeSupportsInstanceScope(node)) return []

  if (node.type === 'compute') {
    const ids = [...metrics.podReplicas]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pod) => pod.name)
    return ids.length === unitCount ? ids : []
  }

  if (node.type === 'database') {
    const primary = metrics.layers.find(
      (layer) =>
        layer.id === DB_LAYER_ID_POSTGRES_PRIMARY || layer.role === 'primary',
    )
    const replicas = metrics.layers
      .filter((layer) => layer.role === 'replica')
      .sort((a, b) => a.id.localeCompare(b.id))
    const ids = [
      ...(primary ? [primary.id] : []),
      ...replicas.map((layer) => layer.id),
    ]
    return ids.length === unitCount ? ids : []
  }

  return []
}

export function instanceIdForUnitIndex(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  unitIndex: number,
  unitCount: number,
): string | null {
  const ids = sortedCanvasInstanceIds(node, metrics, unitCount)
  return ids[unitIndex] ?? null
}

export function canvasUnitPickEnabled(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  unitCount: number,
): boolean {
  return sortedCanvasInstanceIds(node, metrics, unitCount).length === unitCount
}

/** Unit hit-testing only when the glyph is fanned and metrics align with units. */
export function unitPickEnabledForDisplay(
  displayExpanded: boolean,
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  unitCount: number,
): boolean {
  return displayExpanded && canvasUnitPickEnabled(node, metrics, unitCount)
}
