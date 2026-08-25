import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { fmtInt, fmtPct } from './format'

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
  p99Ms: number
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
): RedHeadlineFields {
  if (timeframe === 'session') {
    return {
      throughputLabel: 'Total requests (9m)',
      throughputDisplay: fmtInt(m.totalRequests),
      errorLabel: 'Errors (9m)',
      errorDisplay: fmtInt(m.totalErrors9m),
      latencyLabel: 'Latency p99 (9m)',
      latencyMs: m.p99Latency9m > 0 ? m.p99Latency9m : m.p99Latency,
    }
  }
  return {
    throughputLabel: 'Request rate',
    throughputDisplay: `${fmtInt(m.requestRate)} rps`,
    errorLabel: 'Error rate',
    errorDisplay: formatErrorRate(m.errorRate),
    latencyLabel: 'Latency (p99)',
    latencyMs: m.p99Latency,
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
      hitRateLabel: 'Hit rate (9m)',
      hitRatePct: total > 0 ? (hits / total) * 100 : null,
      throughputLabel: 'Totals (9m)',
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
      label: 'Cache queries (9m)',
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
      readLabel: `${readLabel} (9m total)`,
      readValue: fmtInt(readTotal),
      writeLabel: `${writeLabel} (9m total)`,
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
    /** Parent component CPU limit (cores) for per-pod CPU %. */
    cpuLimitCores?: number
    /** Parent component memory limit (bytes) for per-pod memory %. */
    memoryLimitBytes?: number
  } = {},
): ReplicaListRow[] {
  const sumTotals = pods.reduce((s, p) => s + (p.totalRequests ?? 0), 0)
  const maxRate = options.maxRate ?? Math.max(0, ...pods.map((p) => p.requestRate))
  const cpuLimit = options.cpuLimitCores ?? 0
  const memLimit = options.memoryLimitBytes ?? 0

  return pods.map((pod) => {
    const p99Ms = pod.p99LatencyMs
    const cpuPct = podCpuPercent(pod.cpuUsage, cpuLimit)
    const memPct = podMemPercent(pod.memoryBytes, memLimit)
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
        p99Ms,
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
      p99Ms,
      cpuPct,
      memPct,
      warn: options.skewed && rps < maxRate * 0.5,
      hot: options.skewed && rps >= maxRate * 0.9 && clusterRps > 0 && rps < clusterRps * 0.1,
    }
  })
}
