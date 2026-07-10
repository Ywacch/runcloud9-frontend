import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'

export function isLayeredCache(m: MetricsBucket): boolean {
  return m.cacheMetricMode === 'layered' || (m.layers?.length ?? 0) > 0
}

export function cacheLayerSectionLabels(layer: ComponentLayerMetrics): {
  title: string
  subtitle: string
} {
  if (layer.id === 'redis-internal' || layer.role === 'backing-store') {
    return {
      title: 'Redis backing store',
      subtitle: 'Persists keys; serves proxy read/write-through',
    }
  }
  if (layer.id === 'cache-proxy' || layer.role === 'sidecar') {
    return {
      title: 'Cache proxy',
      subtitle: 'App talks here first (write-through / read-through path)',
    }
  }
  return {
    title: layer.id,
    subtitle: layer.engine || layer.role,
  }
}

/** Layer ids rendered in the cache inspector (empty when not layered). */
export function cacheInspectorLayerIds(m: MetricsBucket): string[] {
  if (!isLayeredCache(m)) return []
  return m.layers.map((layer) => layer.id)
}

export function isBackingCacheLayer(layer: ComponentLayerMetrics): boolean {
  return layer.role === 'backing-store' || layer.id === 'redis-internal'
}
