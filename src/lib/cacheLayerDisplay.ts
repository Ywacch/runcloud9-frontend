import type {
  ComponentLayerMetrics,
  PodRuntimeHealth,
  RuntimeHealthSummary,
} from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { compactPodName } from './replicaMetricsDisplay'

export type CacheInspectorMode = 'layered' | 'timeline' | 'single'

export function isLayeredCache(m: MetricsBucket): boolean {
  return m.cacheMetricMode === 'layered' || (m.layers?.length ?? 0) > 0
}

export function resolveCacheInspectorMode(
  m: MetricsBucket,
  strategy: string,
): CacheInspectorMode {
  const s = strategy.trim().toLowerCase()
  if (s === 'timeline-store') return 'timeline'
  if (isLayeredCache(m)) return 'layered'
  return 'single'
}

export function cacheStrategyBanner(strategy: string): {
  title: string
  subtitle: string
} {
  const s = strategy.trim().toLowerCase()
  switch (s) {
    case 'write-through':
      return {
        title: 'Cache strategy: Write-through',
        subtitle: 'App writes to proxy; proxy updates Redis and Postgres.',
      }
    case 'write-behind':
      return {
        title: 'Cache strategy: Write-behind',
        subtitle: 'App writes to proxy; Redis and DB flush asynchronously.',
      }
    case 'read-through':
      // Legacy — canonicalized to write-through; same banner copy.
      return {
        title: 'Cache strategy: Write-through',
        subtitle: 'App writes to proxy; proxy updates Redis and Postgres.',
      }
    case 'timeline-store':
      return {
        title: 'Cache strategy: Timeline store',
        subtitle: 'Optimized for social feeds and sorted-set delivery.',
      }
    case 'cache-aside':
    default:
      return {
        title: 'Cache strategy: Cache-aside',
        subtitle: 'App talks to Redis directly; cache misses hit the database.',
      }
  }
}

export function cacheLayerCardTitle(layer: ComponentLayerMetrics): string {
  if (layer.id === 'redis-internal' || layer.role === 'backing-store') {
    return 'Redis engine (backing store)'
  }
  if (layer.id === 'cache-proxy' || layer.role === 'sidecar') {
    return 'Cache proxy (sidecar)'
  }
  return layer.id
}

/** @deprecated Use cacheLayerCardTitle for UX cards */
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
      subtitle: 'App talks here first (write-through / write-behind path)',
    }
  }
  return {
    title: layer.id,
    subtitle: layer.engine || layer.role,
  }
}

export function isBackingCacheLayer(layer: ComponentLayerMetrics): boolean {
  return layer.role === 'backing-store' || layer.id === 'redis-internal'
}

export function podsForLayer(
  layer: ComponentLayerMetrics,
  runtimeHealth: RuntimeHealthSummary | null | undefined,
): PodRuntimeHealth[] {
  if (!runtimeHealth?.pods.length) return []
  return runtimeHealth.pods.filter(
    (p) => p.name.startsWith(layer.id) || p.name.includes(`${layer.id}-`),
  )
}

export function podsForComponent(
  runtimeHealth: RuntimeHealthSummary | null | undefined,
): PodRuntimeHealth[] {
  return runtimeHealth?.pods ?? []
}

export function displayPodChip(pod: PodRuntimeHealth): string {
  const compact = compactPodName(pod.name)
  return compact || pod.name
}

export interface PodHealthSummary {
  readyCount: number
  total: number
  pillLabel: string
  detailLine: string
  hasIssue: boolean
}

export function summarizePodHealth(pods: PodRuntimeHealth[]): PodHealthSummary {
  if (pods.length === 0) {
    return {
      readyCount: 0,
      total: 0,
      pillLabel: 'No pods',
      detailLine: '',
      hasIssue: false,
    }
  }
  const readyCount = pods.filter((p) => p.ready).length
  const total = pods.length
  const issuePod = pods.find(
    (p) =>
      !p.ready ||
      p.waitingReason ||
      p.lastTerminationReason ||
      (p.restartCount ?? 0) > 0,
  )
  const pillLabel = `Ready ${readyCount}/${total}`
  let detailLine = 'Ready'
  let hasIssue = readyCount < total

  if (issuePod) {
    if (issuePod.lastTerminationReason) {
      detailLine = `Restarting · ${issuePod.lastTerminationReason}`
      hasIssue = true
    } else if (issuePod.waitingReason) {
      detailLine = `Waiting · ${issuePod.waitingReason}`
      hasIssue = true
    } else if (!issuePod.ready) {
      detailLine = 'Not ready'
      hasIssue = true
    } else if ((issuePod.restartCount ?? 0) > 0) {
      detailLine = `${issuePod.restartCount} restarts`
    }
  }

  const maxRestarts = Math.max(...pods.map((p) => p.restartCount ?? 0))
  if (!hasIssue && maxRestarts > 0) {
    detailLine = `${maxRestarts} restarts`
  }

  return { readyCount, total, pillLabel, detailLine, hasIssue }
}

export function cacheHasAppTraffic(
  m: MetricsBucket,
  cacheHits: number,
  cacheMisses: number,
): boolean {
  if ((m.requestRate ?? 0) > 0) return true
  if (cacheHits + cacheMisses > 0) return true
  return false
}

/** Layer ids rendered in the cache inspector (empty when not layered). */
export function cacheInspectorLayerIds(m: MetricsBucket): string[] {
  if (!isLayeredCache(m)) return []
  return m.layers.map((layer) => layer.id)
}
