import type { MetricsBucket } from '../store/metricsStore'

/** Placeholder bucket so metrics UI never sees a missing client row before WS loadgen data. */
export function idleClientLoadgenBucket(): MetricsBucket {
  const t = Date.now()
  return {
    cpuUsage: 0,
    cpuPercent: 0,
    memoryBytes: 0,
    memPercent: 0,
    cpuIsEstimated: false,
    memIsEstimated: false,
    cpuLimit: 0,
    memoryLimit: 0,
    requestRate: 0,
    errorRate: 0,
    totalRequests: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    avgLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitsLast9m: 0,
    cacheMissesLast9m: 0,
    dbQueryRate: 0,
    dbActiveConnections: 0,
    podCount: 1,
    lastUpdated: t,
    qps: 0,
  }
}
