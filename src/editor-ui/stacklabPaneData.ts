import { isCpuUtilWarn, isMemUtilWarn } from '../editor-core/domain/healthThresholds'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import {
  bucketLatencyHistorySeries,
  bucketSessionQuantileAvailable,
} from '../lib/latencyQuantile'
import type { LatencyQuantile } from '../lib/latencyQuantile'
import { fmtErrorRate, fmtLatencyCell, fmtMemMB } from '../lib/format'
import {
  redHeadlines,
  replicaListRows,
  replicaThroughputTableCell,
  type MetricsTimeframe,
} from '../lib/metricTimeframe'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import type { SelectedInstanceId } from '../lib/dbInstanceScope'
import { rollup, samplesFromCompute } from '../lib/instanceRollup'

export function historySeries(history: MetricsBucket[], key: keyof MetricsBucket): number[] {
  return history.map((h) => Number(h[key] ?? 0))
}

export function scopedPod(
  m: MetricsBucket,
  instanceId: SelectedInstanceId | null | undefined,
): PodReplicaMetrics | undefined {
  if (!instanceId || instanceId === 'cluster') return undefined
  return m.podReplicas.find((p) => p.name === instanceId)
}

export function effectiveRedBucket(
  m: MetricsBucket,
  instanceId: SelectedInstanceId | null | undefined,
): MetricsBucket {
  const pod = scopedPod(m, instanceId)
  if (!pod) return m
  return {
    ...m,
    requestRate: pod.requestRate,
    errorRate: pod.errorRate,
    p50Latency: pod.p50LatencyMs ?? m.p50Latency,
    p95Latency: pod.p95LatencyMs ?? m.p95Latency,
    p99Latency: pod.p99LatencyMs ?? m.p99Latency,
    p50Latency9m: pod.p50Latency9mMs ?? m.p50Latency9m,
    p95Latency9m: pod.p95Latency9mMs ?? m.p95Latency9m,
    p99Latency9m: pod.p99Latency9mMs ?? m.p99Latency9m,
    totalRequests: pod.totalRequests,
    totalErrors9m: pod.totalErrors9m ?? m.totalErrors9m,
    cpuPercent: pod.cpuUsage > 0 && m.cpuLimit > 0 ? (pod.cpuUsage / m.cpuLimit) * 100 : m.cpuPercent,
    memPercent:
      pod.memoryBytes > 0 && m.memoryLimit > 0
        ? (pod.memoryBytes / m.memoryLimit) * 100
        : m.memPercent,
  }
}

export function latencyTriple(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  clusterP99?: number,
): { p50: number; p95: number; p99: number } {
  if (timeframe === 'session') {
    return {
      p50: m.p50Latency9m > 0 ? m.p50Latency9m : m.p50Latency,
      p95: m.p95Latency9m > 0 ? m.p95Latency9m : m.p95Latency,
      p99: m.p99Latency9m > 0 ? m.p99Latency9m : clusterP99 ?? m.p99Latency,
    }
  }
  return { p50: m.p50Latency, p95: m.p95Latency, p99: clusterP99 ?? m.p99Latency }
}

export function selectedLatencyMs(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  quantile: LatencyQuantile,
  clusterP99?: number,
): number {
  const triple = latencyTriple(m, timeframe, clusterP99)
  if (quantile === 'p50') return triple.p50
  if (quantile === 'p95') return triple.p95
  return triple.p99
}

export function computeClusterP99(m: MetricsBucket): number {
  const rollupP99 = rollup(samplesFromCompute(m)).p99
  if (rollupP99 != null && rollupP99 > 0) return rollupP99 * 1000
  return m.p99Latency
}

export function redPaneFields(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  quantile: LatencyQuantile,
) {
  return redHeadlines(m, timeframe, fmtErrorRate, quantile)
}

export function cacheHitRatePct(m: MetricsBucket, timeframe: MetricsTimeframe): number | null {
  const hits = timeframe === 'session' ? m.cacheHitsLast9m : m.cacheHits
  const misses = timeframe === 'session' ? m.cacheMissesLast9m : m.cacheMisses
  const total = hits + misses
  if (total <= 0) return null
  return (hits / total) * 100
}

export function podTableRows(
  m: MetricsBucket,
  timeframe: MetricsTimeframe,
  quantile: LatencyQuantile,
  selectedName?: string | null,
  onSelect?: (name: string) => void,
) {
  const pods = m.podReplicas
  const sumSessionTotals = pods.reduce((s, p) => s + (p.totalRequests ?? 0), 0)
  const rows = replicaListRows(pods, timeframe, {
    clusterRps: m.requestRate,
    cpuLimitCores: m.cpuLimit,
    memoryLimitBytes: m.memoryLimit,
    quantile,
  })
  return rows.map((row, i) => ({
    name: compactPodName(row.name) || row.name,
    rps: replicaThroughputTableCell(pods[i]!, timeframe, sumSessionTotals),
    latency: row.latencyMs != null && row.latencyMs > 0 ? fmtLatencyCell(row.latencyMs) : '—',
    cpu: row.cpuPct != null ? `${Math.round(row.cpuPct)}%` : '—',
    mem: row.memPct != null ? `${Math.round(row.memPct)}%` : '—',
    cpuTone:
      row.hot || (row.cpuPct != null && isCpuUtilWarn(row.cpuPct)) ? ('am' as const) : undefined,
    memTone: row.memPct != null && isMemUtilWarn(row.memPct) ? ('am' as const) : undefined,
    selected: selectedName === row.name,
    onSelect: onSelect ? () => onSelect(row.name) : undefined,
  }))
}

export function podStatusLine(m: MetricsBucket) {
  const pods = m.podReplicas
  if (pods.length === 0) return null
  const ready = pods.filter((p) => p.ready)
  const unready = pods.filter((p) => !p.ready)
  const restartCount = m.runtimeHealth?.pods.reduce((n, p) => n + p.restartCount, 0) ?? 0
  return {
    ready: `${compactPodName(ready[0]?.name ?? pods[0].name)} ready`,
    bad: unready.length > 0 ? `${compactPodName(unready[0].name)} not ready` : undefined,
    warn: restartCount > 0 ? `${restartCount} restarts` : undefined,
  }
}

/** Pod readiness from replica metrics or live runtimeHealth (e.g. RabbitMQ broker pods). */
export function brokerPodStatusLine(m: MetricsBucket) {
  const fromReplicas = podStatusLine(m)
  if (fromReplicas) return fromReplicas
  const pods = m.runtimeHealth?.pods ?? []
  if (pods.length === 0) return null
  const ready = pods.filter((p) => p.ready)
  const unready = pods.filter((p) => !p.ready)
  const restartCount = pods.reduce((n, p) => n + p.restartCount, 0)
  return {
    ready: `${compactPodName(ready[0]?.name ?? pods[0].name)} ready`,
    bad: unready.length > 0 ? `${compactPodName(unready[0].name)} not ready` : undefined,
    warn: restartCount > 0 ? `${restartCount} restarts` : undefined,
  }
}

export function utilHelpCpu(m: MetricsBucket): string {
  const limit = m.cpuLimit > 0 ? `${m.cpuLimit.toFixed(1)} vCPU` : 'limit n/a'
  return `limit ${limit} · peak ${Math.round(m.cpuPercent)}%`
}

export function utilHelpMem(m: MetricsBucket): string {
  const limit = m.memoryLimit > 0 ? fmtMemMB(m.memoryLimit) : 'limit n/a'
  const used = m.memoryBytes > 0 ? fmtMemMB(m.memoryBytes) : 'n/a'
  return `limit ${limit} · used ${used}`
}

export function sessionAvailable(m: MetricsBucket, q: LatencyQuantile): boolean {
  return bucketSessionQuantileAvailable(m, q)
}

export function latencyHistory(
  history: MetricsBucket[],
  quantile: LatencyQuantile,
): number[] {
  return bucketLatencyHistorySeries(history, quantile)
}
