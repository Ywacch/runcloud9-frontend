import type { StorageIoMetrics } from '../domain/metricsUiContract'
import type { MetricsBucket, SystemMetricsSample } from '../stores/metricsStore'
import { useCanvasStore } from '../stores/canvasStore'
import { nodeBucketsFromPayload } from './wsMetricsFrame'
import type { BufferedSample } from './wsMetricsTypes'
import { sampleFromWsPayload } from '../domain/metricsUiContract'

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpRound(a: number, b: number, t: number): number {
  return Math.round(lerpNum(a, b, t))
}

function snapStr(a: string, b: string, t: number): string {
  return t >= 0.5 ? b : a
}

function snapBool(a: boolean, b: boolean, t: number): boolean {
  return t >= 0.5 ? b : a
}

function lerpStorageIo(
  a: StorageIoMetrics | null,
  b: StorageIoMetrics | null,
  t: number,
): StorageIoMetrics | null {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  const later = t >= 0.5 ? b : a
  return {
    readRate: lerpNum(a.readRate, b.readRate, t),
    writeRate: lerpNum(a.writeRate, b.writeRate, t),
    readLatency: lerpNum(a.readLatency, b.readLatency, t),
    writeLatency: lerpNum(a.writeLatency, b.writeLatency, t),
    errorRate: lerpNum(a.errorRate, b.errorRate, t),
    bytesUsed: lerpRound(a.bytesUsed, b.bytesUsed, t),
    bytesLimit: lerpRound(a.bytesLimit, b.bytesLimit, t),
    unit: later.unit,
    readLabel: later.readLabel,
    writeLabel: later.writeLabel,
    scope: later.scope,
    footnote: later.footnote,
    pattern: later.pattern,
    patternNote: later.patternNote,
    source: later.source,
  }
}

function resolveDbQuerySource(
  a: MetricsBucket['dbQuerySource'],
  b: MetricsBucket['dbQuerySource'],
  t: number,
): MetricsBucket['dbQuerySource'] {
  if (a === 'none' || b === 'none') return t >= 0.5 ? b : a
  if (!a && b) return t >= 0.5 ? b : a
  if (a && !b) return t >= 0.5 ? b : a
  return snapStr(a, b, t) as MetricsBucket['dbQuerySource']
}

function resolveDbQueryRate(
  a: MetricsBucket,
  b: MetricsBucket,
  t: number,
  source: MetricsBucket['dbQuerySource'],
): number {
  if (source === 'none') return 0
  return lerpNum(a.dbQueryRate, b.dbQueryRate, t)
}

/** Linear blend of two per-node metric buckets (field registry in F2 handoff). */
export function lerpMetricsBucket(
  a: MetricsBucket,
  b: MetricsBucket,
  t: number,
  playheadMs: number,
): MetricsBucket {
  const dbQuerySource = resolveDbQuerySource(a.dbQuerySource, b.dbQuerySource, t)

  return {
    cpuUsage: lerpNum(a.cpuUsage, b.cpuUsage, t),
    cpuPercent: lerpNum(a.cpuPercent, b.cpuPercent, t),
    memoryBytes: lerpRound(a.memoryBytes, b.memoryBytes, t),
    memPercent: lerpNum(a.memPercent, b.memPercent, t),
    cpuIsEstimated: snapBool(a.cpuIsEstimated, b.cpuIsEstimated, t),
    memIsEstimated: snapBool(a.memIsEstimated, b.memIsEstimated, t),
    cpuLimit: lerpNum(a.cpuLimit, b.cpuLimit, t),
    memoryLimit: lerpNum(a.memoryLimit, b.memoryLimit, t),
    requestRate: lerpNum(a.requestRate, b.requestRate, t),
    errorRate: lerpNum(a.errorRate, b.errorRate, t),
    totalRequests: lerpRound(a.totalRequests, b.totalRequests, t),
    totalErrors9m: lerpRound(a.totalErrors9m, b.totalErrors9m, t),
    p50Latency: lerpNum(a.p50Latency, b.p50Latency, t),
    p95Latency: lerpNum(a.p95Latency, b.p95Latency, t),
    p99Latency: lerpNum(a.p99Latency, b.p99Latency, t),
    p99Latency9m: lerpNum(a.p99Latency9m, b.p99Latency9m, t),
    avgLatency: lerpNum(a.avgLatency, b.avgLatency, t),
    cacheStrategy: snapStr(a.cacheStrategy ?? '', b.cacheStrategy ?? '', t),
    cacheMetricMode: snapStr(a.cacheMetricMode ?? '', b.cacheMetricMode ?? '', t),
    cacheReadOperation: snapStr(a.cacheReadOperation ?? '', b.cacheReadOperation ?? '', t),
    cacheWriteOperation: snapStr(a.cacheWriteOperation ?? '', b.cacheWriteOperation ?? '', t),
    redisOpsPerSec: lerpNum(a.redisOpsPerSec ?? 0, b.redisOpsPerSec ?? 0, t),
    redisRejectedRate: lerpNum(a.redisRejectedRate ?? 0, b.redisRejectedRate ?? 0, t),
    redisKeyspaceHits: lerpNum(a.redisKeyspaceHits ?? 0, b.redisKeyspaceHits ?? 0, t),
    redisKeyspaceMisses: lerpNum(a.redisKeyspaceMisses ?? 0, b.redisKeyspaceMisses ?? 0, t),
    redisAvgLatency: lerpNum(a.redisAvgLatency ?? 0, b.redisAvgLatency ?? 0, t),
    redisConnectedClients: lerpNum(
      a.redisConnectedClients ?? 0,
      b.redisConnectedClients ?? 0,
      t,
    ),
    cacheHits: lerpNum(a.cacheHits, b.cacheHits, t),
    cacheMisses: lerpNum(a.cacheMisses, b.cacheMisses, t),
    cacheHitsLast9m: lerpRound(a.cacheHitsLast9m, b.cacheHitsLast9m, t),
    cacheMissesLast9m: lerpRound(a.cacheMissesLast9m, b.cacheMissesLast9m, t),
    dbQueryRate: resolveDbQueryRate(a, b, t, dbQuerySource),
    dbTotalQueries: lerpRound(a.dbTotalQueries, b.dbTotalQueries, t),
    dbQueryLatency: lerpNum(a.dbQueryLatency, b.dbQueryLatency, t),
    dbQuerySource,
    dbActiveConnections: lerpRound(a.dbActiveConnections, b.dbActiveConnections, t),
    maxConnections: lerpRound(a.maxConnections, b.maxConnections, t),
    storageEngine: snapStr(a.storageEngine, b.storageEngine, t),
    storageRole: snapStr(a.storageRole, b.storageRole, t),
    storageIo: lerpStorageIo(a.storageIo, b.storageIo, t),
    activeConnections: lerpNum(a.activeConnections, b.activeConnections, t),
    lbConnectionLimit: lerpNum(a.lbConnectionLimit, b.lbConnectionLimit, t),
    queueDepth: lerpNum(a.queueDepth, b.queueDepth, t),
    produceRate: lerpNum(a.produceRate, b.produceRate, t),
    consumeRate: lerpNum(a.consumeRate, b.consumeRate, t),
    messagesReady: lerpRound(a.messagesReady, b.messagesReady, t),
    messagesUnacked: lerpRound(a.messagesUnacked, b.messagesUnacked, t),
    mqMemoryUsed: lerpRound(a.mqMemoryUsed, b.mqMemoryUsed, t),
    mqMemoryLimit: lerpRound(a.mqMemoryLimit, b.mqMemoryLimit, t),
    mqSaturationRatio: lerpNum(a.mqSaturationRatio, b.mqSaturationRatio, t),
    workerSaturation: lerpNum(a.workerSaturation, b.workerSaturation, t),
    redisMaxClients: lerpNum(a.redisMaxClients, b.redisMaxClients, t),
    perBackendRps: t >= 0.5 ? { ...b.perBackendRps } : { ...a.perBackendRps },
    lbAlgorithm: snapStr(a.lbAlgorithm, b.lbAlgorithm, t),
    lbBackends: t >= 0.5 ? [...b.lbBackends] : [...a.lbBackends],
    podReplicas: t >= 0.5 ? b.podReplicas.map((p) => ({ ...p })) : a.podReplicas.map((p) => ({ ...p })),
    backendPods: t >= 0.5 ? b.backendPods.map((p) => ({ ...p })) : a.backendPods.map((p) => ({ ...p })),
    backendReplicas: t >= 0.5 ? (b.backendReplicas ? { ...b.backendReplicas } : null) : (a.backendReplicas ? { ...a.backendReplicas } : null),
    podCount: lerpRound(a.podCount, b.podCount, t),
    lastUpdated: playheadMs,
    qps: Math.round(lerpNum(a.requestRate, b.requestRate, t)),
  }
}

export function lerpSystemMetricsSample(
  a: SystemMetricsSample,
  b: SystemMetricsSample,
  t: number,
  playheadMs: number,
): SystemMetricsSample {
  return {
    t: playheadMs,
    appP99Ms: lerpNum(a.appP99Ms, b.appP99Ms, t),
    appRps: lerpNum(a.appRps, b.appRps, t),
    dbQueryRate: lerpNum(a.dbQueryRate, b.dbQueryRate, t),
    cacheHits: lerpNum(a.cacheHits, b.cacheHits, t),
    cacheMisses: lerpNum(a.cacheMisses, b.cacheMisses, t),
  }
}

function systemSampleFromBuffered(sample: BufferedSample): SystemMetricsSample | null {
  const raw = sampleFromWsPayload(
    new Date(sample.serverTimestamp).toISOString(),
    sample.payload.components,
  )
  if (!raw) return null
  return { ...raw, t: sample.serverTimestamp }
}

/** Interpolate all node buckets at playhead between two buffered WS frames. */
export function interpolateNodeBuckets(
  bracket: { before: BufferedSample; after: BufferedSample; t: number },
  playheadMs: number,
): Record<string, MetricsBucket> {
  const nodes = useCanvasStore.getState().nodes
  const beforeBuckets = nodeBucketsFromPayload(bracket.before.payload, nodes)
  const afterBuckets = nodeBucketsFromPayload(bracket.after.payload, nodes)
  const out: Record<string, MetricsBucket> = {}

  const ids = new Set([...Object.keys(beforeBuckets), ...Object.keys(afterBuckets)])
  for (const id of ids) {
    const a = beforeBuckets[id]
    const b = afterBuckets[id]
    if (a && b) {
      out[id] = lerpMetricsBucket(a, b, bracket.t, playheadMs)
    } else if (a) {
      out[id] = { ...a, lastUpdated: playheadMs }
    } else if (b) {
      out[id] = { ...b, lastUpdated: playheadMs }
    }
  }
  return out
}

export function interpolateSystemSample(
  bracket: { before: BufferedSample; after: BufferedSample; t: number },
  playheadMs: number,
): SystemMetricsSample | null {
  const a = systemSampleFromBuffered(bracket.before)
  const b = systemSampleFromBuffered(bracket.after)
  if (!a || !b) return null
  return lerpSystemMetricsSample(a, b, bracket.t, playheadMs)
}
