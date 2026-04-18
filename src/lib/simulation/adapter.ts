import type { CanvasNode } from '../../store/canvasStore'
import type { MetricsBucket } from '../../store/metricsStore'
import type { SimulationState } from './types'

export interface MetricsAdapterOpts {
  /** Cumulative totals for RED-style counters. */
  totalRequests?: number
  cacheHits?: number
  cacheMisses?: number
  cacheHitsLast9m?: number
  cacheMissesLast9m?: number
  /** Actual instance / replica / pod count for this node. */
  podCount?: number
  /** Node memory limit used for percentage denominator. */
  memoryLimitGb?: number
}

export function simulationStateToMetricsBucket(
  state: SimulationState,
  nodeType: CanvasNode['type'],
  opts: MetricsAdapterOpts = {}
): MetricsBucket {
  const t = Date.now()
  const lat = state.latencyMs
  const memoryLimitGb = Math.max(0.128, Number(opts.memoryLimitGb ?? 0.5))
  const memoryLimitBytes = Math.round(memoryLimitGb * 1024 * 1024 * 1024)
  return {
    cpuUsage: state.cpuUsagePercent / 100,
    cpuPercent: Math.round(state.cpuUsagePercent),
    memoryBytes: Math.round(state.memoryUsageGb * 1024 * 1024 * 1024),
    memPercent: Math.min(
      100,
      Math.round((state.memoryUsageGb / memoryLimitGb) * 100) || 0
    ),
    cpuIsEstimated: true,
    memIsEstimated: true,
    cpuLimit: 2,
    memoryLimit: memoryLimitBytes,
    requestRate: state.throughputQps,
    errorRate: state.errorRate,
    totalRequests: Math.round(opts.totalRequests ?? 0),
    p50Latency: lat * 0.7,
    p95Latency: lat * 1.3,
    p99Latency: lat * 1.8,
    avgLatency: lat,
    cacheHits: opts.cacheHits ?? 0,
    cacheMisses: opts.cacheMisses ?? 0,
    cacheHitsLast9m: opts.cacheHitsLast9m ?? opts.cacheHits ?? 0,
    cacheMissesLast9m: opts.cacheMissesLast9m ?? opts.cacheMisses ?? 0,
    dbQueryRate: nodeType === 'database' ? state.throughputQps : 0,
    dbActiveConnections: state.currentConnections,
    podCount: opts.podCount ?? 1,
    lastUpdated: t,
    qps: Math.round(state.throughputQps),
  }
}
