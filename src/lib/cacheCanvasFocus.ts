import {
  computeHealthState,
  ERROR_RATE_THRESHOLD,
  runtimeHealthIsCritical,
  WARNING_CPU,
  WARNING_MEM,
  type HealthState,
} from '../editor-core/domain/healthThresholds'
import type { ComponentLayerMetrics } from '../editor-core/domain/metricsUiContract'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { clampPercent } from './format'
import { isBackingCacheLayer, podsForLayer } from './cacheLayerDisplay'

export type CacheFocusLayer = 'proxy' | 'redis'

export interface CacheCanvasFocus {
  layer: CacheFocusLayer
  layerMetrics: ComponentLayerMetrics
  /** Set when a warn or error should open this inspector crumb. */
  metricGroup: 'engine' | 'proxy' | null
  severity: HealthState
  cpuPct: number
  memPct: number
}

type Cause = {
  layer: CacheFocusLayer
  group: 'engine' | 'proxy'
  severity: 'warning' | 'error'
  score: number
}

function isProxyLayer(layer: ComponentLayerMetrics): boolean {
  return layer.id === 'cache-proxy' || layer.role === 'sidecar'
}

function utilPct(usage: number, limit: number, estimated: boolean): number {
  if (estimated || limit <= 0 || usage <= 0) return 0
  return clampPercent((usage / limit) * 100)
}

function podIsDown(pod: {
  ready: boolean
  waitingReason?: string
  lastTerminationReason?: string
}): boolean {
  return !pod.ready || Boolean(pod.waitingReason) || Boolean(pod.lastTerminationReason)
}

function layerPodsCritical(layer: ComponentLayerMetrics, m: MetricsBucket): boolean {
  const pods = podsForLayer(layer, m.runtimeHealth)
  const matched = pods.length > 0 ? pods : (m.runtimeHealth?.pods ?? []).filter((pod) => pod.name.includes(layer.id))
  return matched.some((pod) => podIsDown(pod))
}

function causesForLayer(
  kind: CacheFocusLayer,
  layer: ComponentLayerMetrics,
  m: MetricsBucket,
): Cause[] {
  const group = kind === 'proxy' ? 'proxy' : 'engine'
  const out: Cause[] = []
  if (layerPodsCritical(layer, m)) {
    out.push({ layer: kind, group, severity: 'error', score: 100 })
  }
  const cpu = utilPct(layer.cpuUsage, layer.cpuLimit, layer.cpuIsEstimated)
  const mem = utilPct(layer.memoryBytes, layer.memoryLimit, layer.memIsEstimated)
  if (!layer.cpuIsEstimated && cpu >= WARNING_CPU) {
    out.push({ layer: kind, group, severity: 'warning', score: cpu - WARNING_CPU })
  }
  if (!layer.memIsEstimated && mem >= WARNING_MEM) {
    out.push({ layer: kind, group, severity: 'warning', score: mem - WARNING_MEM })
  }
  if (kind === 'redis') {
    const rejected = layer.redisRejectedRate ?? m.redisRejectedRate ?? 0
    if (rejected > 0) {
      out.push({ layer: kind, group, severity: 'warning', score: 5 })
    }
    const maxClients = m.redisMaxClients ?? 0
    const clients = m.redisConnectedClients ?? 0
    if (maxClients > 0 && clients / maxClients >= WARNING_CPU / 100) {
      out.push({
        layer: kind,
        group,
        severity: 'warning',
        score: (clients / maxClients) * 100 - WARNING_CPU,
      })
    }
    const evictions = layer.evictionsPerSec ?? m.evictionsPerSec ?? 0
    if (evictions > 0) {
      out.push({ layer: kind, group, severity: 'warning', score: 4 })
    }
  }
  return out
}

function prefer(a: Cause, b: Cause): Cause {
  if (a.severity !== b.severity) return a.severity === 'error' ? a : b
  if (a.score !== b.score) return a.score > b.score ? a : b
  return a.layer === 'proxy' ? a : b
}

/** Proxy-cache canvas focus. Null when the bucket is not a layered cache. */
export function resolveCacheCanvasFocus(m: MetricsBucket | undefined): CacheCanvasFocus | null {
  if (!m) return null
  const proxy = m.layers.find(isProxyLayer)
  const redis = m.layers.find(isBackingCacheLayer)
  if (!proxy || !redis) return null

  const causes = [
    ...causesForLayer('proxy', proxy, m),
    ...causesForLayer('redis', redis, m),
  ]
  const winner = causes.reduce<Cause | null>(
    (best, cause) => (best ? prefer(best, cause) : cause),
    null,
  )
  const kind: CacheFocusLayer = winner?.layer ?? 'proxy'
  const layer = kind === 'proxy' ? proxy : redis
  const cpuPct = utilPct(layer.cpuUsage, layer.cpuLimit, layer.cpuIsEstimated)
  const memPct = utilPct(layer.memoryBytes, layer.memoryLimit, layer.memIsEstimated)
  const measured =
    (!layer.cpuIsEstimated && layer.cpuLimit > 0) ||
    (!layer.memIsEstimated && layer.memoryLimit > 0) ||
    (!proxy.cpuIsEstimated && proxy.cpuLimit > 0) ||
    (!redis.cpuIsEstimated && redis.cpuLimit > 0)

  let severity: HealthState = 'idle'
  if (winner?.severity === 'error') severity = 'error'
  else if (winner?.severity === 'warning') severity = 'warning'
  else if (measured) severity = 'healthy'

  return {
    layer: kind,
    layerMetrics: layer,
    metricGroup: winner ? winner.group : null,
    severity,
    cpuPct,
    memPct,
  }
}

/**
 * Canvas rim and tooltip health. Layered caches score Redis and the proxy
 * separately so a hot sidecar is not averaged away against a quiet store.
 */
export function canvasHealthState(
  m: MetricsBucket | undefined,
  nodeStatus: CanvasNode['status'],
): HealthState {
  const focus = resolveCacheCanvasFocus(m)
  if (!focus) return computeHealthState(m, nodeStatus)
  if (nodeStatus === 'degraded') return 'error'
  if (m && runtimeHealthIsCritical(m.runtimeHealth)) return 'error'
  if (m && (m.errorRate ?? 0) > ERROR_RATE_THRESHOLD) return 'error'
  return focus.severity
}
