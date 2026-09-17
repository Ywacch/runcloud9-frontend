import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import {
  DB_LAYER_ID_POSTGRES_PRIMARY,
  nodeSupportsInstanceScope,
  usesPodReplicaScope,
} from './dbInstanceScope'

/** Stable instance ids aligned with canvas unit paint order (index i → ids[i]). */
export function sortedCanvasInstanceIds(
  node: CanvasNode,
  metrics: MetricsBucket | undefined,
  unitCount: number,
): string[] {
  if (!metrics || unitCount <= 1 || !nodeSupportsInstanceScope(node)) return []

  if (usesPodReplicaScope(node)) {
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

/**
 * Map a painted motion-unit id back to the compose/index used by
 * `instanceIdForUnitIndex`. Layer ids (`postgres`, pod names) are not `uN`.
 */
export function unitIndexFromMotionId(
  units: ReadonlyArray<{ id: string }>,
  id: string,
): number {
  const fromUnits = units.findIndex((unit) => unit.id === id)
  if (fromUnits >= 0) return fromUnits
  const n = Number(id.replace(/^u/, ''))
  return Number.isFinite(n) ? n : 0
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

/** Stable key for canvas unit-pick reactivity when pod/layer counts change. */
export function metricsInstancePickKey(
  metrics: Record<string, MetricsBucket | undefined>,
  nodes: Record<string, CanvasNode>,
): string {
  const parts: string[] = []
  for (const node of Object.values(nodes)) {
    if (!nodeSupportsInstanceScope(node)) continue
    const m = metrics[node.id]
    parts.push(
      `${node.id}:${m?.podReplicas?.length ?? 0}:${m?.layers?.length ?? 0}`,
    )
  }
  return parts.sort().join('|')
}

/** When SVG routing / db fan must reproject (overlayLiveDbUnitCount + instance pick). */
export function metricsSvgProjectPickKey(
  metrics: Record<string, MetricsBucket | undefined>,
  nodes: Record<string, CanvasNode>,
): string {
  const parts: string[] = []
  for (const node of Object.values(nodes)) {
    const m = metrics[node.id]
    if (node.type === 'database') {
      parts.push(`db:${node.id}:${m?.layers?.length ?? 0}`)
      continue
    }
    if (!nodeSupportsInstanceScope(node)) continue
    parts.push(
      `pod:${node.id}:${m?.podReplicas?.length ?? 0}:${m?.layers?.length ?? 0}`,
    )
  }
  return parts.sort().join('|')
}
