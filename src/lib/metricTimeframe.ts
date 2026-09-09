import type { ComponentLayerMetrics, PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { bucketLatencyField, podLatencyMs, type LatencyQuantile } from './latencyQuantile'
import { fmtInt, fmtPct } from './format'
import {
  SESSION_CACHE_HIT_RATE_LABEL,
  SESSION_CACHE_QUERIES_LABEL,
  SESSION_CACHE_THROUGHPUT_LABEL,
} from './metricHelp'

export type MetricsTimeframe = 'live' | 'session'

export interface RedHeadlineFields {
  throughputLabel: string
  throughputDisplay: string
  errorLabel: string
  errorDisplay: string
  latencyLabel: string
  latencyMs: number
}

export interface CacheHeadlineFields {
  hitRateLabel: string
  hitRatePct: number | null
  throughputLabel: string
  throughputDisplay: string
}

export interface DbQueryHeadlineFields {
  label: string
  /** Live: rate (/s display). Session: total count. */
  liveRate: number
  sessionTotal: number
}

export interface ReplicaListRow {
  name: string
  primaryText: string
  latencyMs: number
  latencyQuantile: LatencyQuantile
  cpuPct?: number
  memPct?: number
  warn?: boolean
  hot?: boolean
}

export interface FeedPushHeadlineFields {
  label: string
  display: string
}

export interface StorageIoTileFields {
  readLabel: string
  readValue: string
  writeLabel: string
  writeValue: string
}

export function redHeadlines(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  formatErrorRate: (n: number) => string,
  quantile: LatencyQuantile = 'p99',
): RedHeadlineFields {
  if (timeframe === 'session') {
    return {
      throughputLabel: 'Total requests',
      throughputDisplay: fmtInt(m.totalRequests),
      errorLabel: 'Errors',
      errorDisplay: fmtInt(m.totalErrors9m),
      latencyLabel: `Latency ${quantile}`,
      latencyMs: bucketLatencyField(m, quantile, timeframe),
    }
  }
  return {
    throughputLabel: 'Request rate',
    throughputDisplay: `${fmtInt(m.requestRate)} rps`,
    errorLabel: 'Error rate',
    errorDisplay: formatErrorRate(m.errorRate),
    latencyLabel: `Latency (${quantile})`,
    latencyMs: bucketLatencyField(m, quantile, timeframe),
  }
}

export function cacheHeadlines(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  formatRate: (n: number) => string,
): CacheHeadlineFields {
  if (timeframe === 'session') {
    const hits = m.cacheHitsLast9m
    const misses = m.cacheMissesLast9m
    const total = hits + misses
    return {
      hitRateLabel: SESSION_CACHE_HIT_RATE_LABEL,
      hitRatePct: total > 0 ? (hits / total) * 100 : null,
      throughputLabel: SESSION_CACHE_THROUGHPUT_LABEL,
      throughputDisplay: `${fmtInt(hits)} hits · ${fmtInt(misses)} misses`,
    }
  }
  const hits = m.cacheHits
  const misses = m.cacheMisses
  const total = hits + misses
  return {
    hitRateLabel: 'Hit rate (10s)',
    hitRatePct: total > 0 ? (hits / total) * 100 : null,
    throughputLabel: 'Throughput',
    throughputDisplay: `${formatRate(hits)}/s hits · ${formatRate(misses)}/s misses`,
  }
}

export function cacheHitRateDisplay(hitRatePct: number | null): string {
  return hitRatePct != null ? fmtPct(hitRatePct) : '—'
}

export function dbQueryHeadline(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
): DbQueryHeadlineFields {
  return {
    label: timeframe === 'session' ? 'Total queries' : 'Query rate',
    liveRate: m.dbQueryRate,
    sessionTotal: m.dbTotalQueries,
  }
}

export interface DbLayerXactHeadlineFields {
  label: string
  liveRate: number
  sessionTotal: number
}

/** Postgres layer xact rate vs session total (engine RED). */
export function dbLayerXactHeadline(
  layer: ComponentLayerMetrics,
  timeframe: MetricsTimeframe,
): DbLayerXactHeadlineFields {
  return {
    label: timeframe === 'session' ? 'Total transactions' : 'Transaction rate',
    liveRate: layer.requestRate ?? 0,
    sessionTotal: layer.totalRequests ?? 0,
  }
}

/** App SQL query rate vs session total for a DB instance layer (histogram target). */
export function dbLayerAppSqlHeadline(
  layer: ComponentLayerMetrics,
  timeframe: MetricsTimeframe,
): DbQueryHeadlineFields {
  return {
    label: timeframe === 'session' ? 'Total queries' : 'Query rate',
    liveRate: layer.dbQueryRate ?? 0,
    sessionTotal: layer.dbTotalQueries ?? 0,
  }
}

/** Per-pod metric series from inspector history for instance graphs. */
export function podHistorySeries(
  history: MetricsBucket[],
  podName: string,
  pick: (pod: PodReplicaMetrics) => number,
): number[] {
  return history.map((h) => {
    const pod = h.podReplicas.find((p) => p.name === podName)
    return pod ? pick(pod) : 0
  })
}

/** Per-layer metric series from inspector history for DB instance graphs. */
export function dbLayerHistorySeries(
  history: MetricsBucket[],
  layerId: string,
  pick: (layer: ComponentLayerMetrics) => number,
): number[] {
  return history.map((h) => {
    const layer = h.layers.find((l) => l.id === layerId)
    return layer ? pick(layer) : 0
  })
}

/** App-level cache query totals for timeline / push feed inspector (session). */
export function cacheQueryTotal9m(m: MetricsBucket): number {
  return m.cacheHitsLast9m + m.cacheMissesLast9m
}

export function feedPushHeadline(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  livePushRate: number,
  formatRate: (n: number) => string,
): FeedPushHeadlineFields {
  if (timeframe === 'session') {
    return {
      label: SESSION_CACHE_QUERIES_LABEL,
      display: fmtInt(cacheQueryTotal9m(m)),
    }
  }
  if (Number.isFinite(livePushRate) && livePushRate > 0) {
    return {
      label: 'Feed reads (push)',
      display: `${formatRate(livePushRate)}/s`,
    }
  }
  const liveQueries = m.cacheHits + m.cacheMisses
  return {
    label: 'Feed reads (push)',
    display: liveQueries > 0 ? `${formatRate(liveQueries)}/s` : '—',
  }
}

/** Redis / storageIo command tiles — session totals when available on the wire. */
export function storageIoThroughputFields(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  readLabel: string,
  writeLabel: string,
  formatRate: (n: number) => string,
): StorageIoTileFields {
  const io = m.storageIo
  if (!io) {
    return { readLabel, readValue: '—', writeLabel, writeValue: '—' }
  }
  if (timeframe === 'session') {
    const readTotal = io.readTotal9m ?? cacheQueryTotal9m(m)
    const writeTotal = io.writeTotal9m
    return {
      readLabel,
      readValue: fmtInt(readTotal),
      writeLabel,
      writeValue: writeTotal != null && writeTotal > 0 ? fmtInt(writeTotal) : '—',
    }
  }
  return {
    readLabel,
    readValue: `${formatRate(io.readRate)}/s`,
    writeLabel,
    writeValue: `${formatRate(io.writeRate)}/s`,
  }
}

export function replicaSharePct(podTotal: number, sumTotals: number): number | null {
  if (sumTotals <= 0 || podTotal <= 0) return null
  return (podTotal / sumTotals) * 100
}

/** CPU % for a pod row — cpuUsage is cores in use (metrics-ui-contract). */
export function podCpuPercent(cpuUsage: number, cpuLimitCores: number): number | undefined {
  if (!(cpuUsage > 0)) return undefined
  if (cpuLimitCores > 0) {
    return Math.min(100, (cpuUsage / cpuLimitCores) * 100)
  }
  return Math.min(100, cpuUsage * 100)
}

export function podMemPercent(
  memoryBytes: number,
  memoryLimitBytes: number,
): number | undefined {
  if (!(memoryBytes > 0) || !(memoryLimitBytes > 0)) return undefined
  return Math.min(100, (memoryBytes / memoryLimitBytes) * 100)
}

/** Build per-pod list rows for compute replicas or LB backend pods. */
export function replicaListRows(
  pods: PodReplicaMetrics[],
  timeframe: MetricsTimeframe,
  options: {
    clusterRps?: number
    maxRate?: number
    skewed?: boolean
    quantile?: LatencyQuantile
    /** Parent component CPU limit (cores) for per-pod CPU %. */
    cpuLimitCores?: number
    /** Parent component memory limit (bytes) for per-pod memory %. */
    memoryLimitBytes?: number
  } = {},
): ReplicaListRow[] {
  const quantile = options.quantile ?? 'p99'
  const sumTotals = pods.reduce((s, p) => s + (p.totalRequests ?? 0), 0)
  const maxRate = options.maxRate ?? Math.max(0, ...pods.map((p) => p.requestRate))
  const cpuLimit = options.cpuLimitCores ?? 0
  const memLimit = options.memoryLimitBytes ?? 0
  const cpuLimitPerPod = cpuLimit > 0 && pods.length > 0 ? cpuLimit / pods.length : 0
  const memLimitPerPod = memLimit > 0 && pods.length > 0 ? memLimit / pods.length : 0

  return pods.map((pod) => {
    const latencyMs = podLatencyMs(pod, quantile, timeframe)
    const cpuPct = podCpuPercent(pod.cpuUsage, cpuLimitPerPod)
    const memPct = podMemPercent(pod.memoryBytes, memLimitPerPod)
    if (timeframe === 'session') {
      const total = pod.totalRequests ?? 0
      const pct = replicaSharePct(total, sumTotals)
      const primaryText =
        pct != null
          ? `${fmtInt(total)} total (${Math.round(pct)}%)`
          : `${fmtInt(total)} total`
      return {
        name: pod.name,
        primaryText,
        latencyMs,
        latencyQuantile: quantile,
        cpuPct,
        memPct,
        warn: options.skewed && total < sumTotals * 0.15,
        hot: options.skewed && pct != null && pct >= 45,
      }
    }

    const rps = pod.requestRate
    const clusterRps = options.clusterRps ?? 0
    return {
      name: pod.name,
      primaryText: `${Math.round(rps)} rps`,
      latencyMs,
      latencyQuantile: quantile,
      cpuPct,
      memPct,
      warn: options.skewed && rps < maxRate * 0.5,
      hot: options.skewed && rps >= maxRate * 0.9 && clusterRps > 0 && rps < clusterRps * 0.1,
    }
  })
}
