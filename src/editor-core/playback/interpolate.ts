import type { ComponentLayerMetrics, PodReplicaMetrics, StorageIoMetrics } from '../domain/metricsUiContract'
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
    readTotal9m: lerpRound(a.readTotal9m ?? 0, b.readTotal9m ?? 0, t) || undefined,
    writeTotal9m: lerpRound(a.writeTotal9m ?? 0, b.writeTotal9m ?? 0, t) || undefined,
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

function resolveResourceSource(
  a: MetricsBucket['cpuSource'],
  b: MetricsBucket['cpuSource'],
  t: number,
): MetricsBucket['cpuSource'] {
  if (!a && b) return t >= 0.5 ? b : a
  if (a && !b) return t >= 0.5 ? b : a
  if (!a && !b) return undefined
  return snapStr(a ?? '', b ?? '', t) as MetricsBucket['cpuSource']
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

function lerpPodReplicas(
  a: PodReplicaMetrics[],
  b: PodReplicaMetrics[],
  t: number,
): PodReplicaMetrics[] {
  const names = [...new Set([...a.map((p) => p.name), ...b.map((p) => p.name)])].sort()
  const out: PodReplicaMetrics[] = []
  for (const name of names) {
    const pa = a.find((p) => p.name === name)
    const pb = b.find((p) => p.name === name)
    if (pa && pb) {
      const p50 = lerpNum(pa.p50LatencyMs ?? 0, pb.p50LatencyMs ?? 0, t)
      const p95 = lerpNum(pa.p95LatencyMs ?? 0, pb.p95LatencyMs ?? 0, t)
      const p50Session = lerpNum(pa.p50Latency9mMs ?? 0, pb.p50Latency9mMs ?? 0, t)
      const p95Session = lerpNum(pa.p95Latency9mMs ?? 0, pb.p95Latency9mMs ?? 0, t)
      const p99Session = lerpNum(pa.p99Latency9mMs ?? 0, pb.p99Latency9mMs ?? 0, t)
      const totalErrors = lerpRound(pa.totalErrors9m ?? 0, pb.totalErrors9m ?? 0, t)
      out.push({
        name,
        ready: snapBool(pa.ready, pb.ready, t),
        requestRate: lerpNum(pa.requestRate, pb.requestRate, t),
        p99LatencyMs: lerpNum(pa.p99LatencyMs, pb.p99LatencyMs, t),
        p50LatencyMs: p50 > 0 ? p50 : undefined,
        p95LatencyMs: p95 > 0 ? p95 : undefined,
        p50Latency9mMs: p50Session > 0 ? p50Session : undefined,
        p95Latency9mMs: p95Session > 0 ? p95Session : undefined,
        p99Latency9mMs: p99Session > 0 ? p99Session : undefined,
        totalRequests: lerpRound(pa.totalRequests, pb.totalRequests, t),
        totalErrors9m: totalErrors > 0 ? totalErrors : undefined,
        cpuUsage: lerpNum(pa.cpuUsage, pb.cpuUsage, t),
        errorRate: lerpNum(pa.errorRate, pb.errorRate, t),
        memoryBytes: lerpRound(pa.memoryBytes, pb.memoryBytes, t),
      })
      continue
    }
    const chosen = t >= 0.5 ? pb ?? pa : pa ?? pb
    if (chosen) out.push({ ...chosen })
  }
  return out
}

function lerpComponentLayers(
  a: ComponentLayerMetrics[],
  b: ComponentLayerMetrics[],
  t: number,
): ComponentLayerMetrics[] {
  const ids = [...new Set([...a.map((l) => l.id), ...b.map((l) => l.id)])].sort()
  const out: ComponentLayerMetrics[] = []
  for (const id of ids) {
    const la = a.find((l) => l.id === id)
    const lb = b.find((l) => l.id === id)
    if (la && lb) {
      out.push({
        ...la,
        id,
        role: snapStr(la.role, lb.role, t),
        engine: snapStr(la.engine, lb.engine, t),
        cpuUsage: lerpNum(la.cpuUsage, lb.cpuUsage, t),
        memoryBytes: lerpRound(la.memoryBytes, lb.memoryBytes, t),
        cpuLimit: lerpNum(la.cpuLimit, lb.cpuLimit, t),
        memoryLimit: lerpRound(la.memoryLimit, lb.memoryLimit, t),
        cpuIsEstimated: snapBool(la.cpuIsEstimated, lb.cpuIsEstimated, t),
        memIsEstimated: snapBool(la.memIsEstimated, lb.memIsEstimated, t),
        requestRate: lerpNum(la.requestRate ?? 0, lb.requestRate ?? 0, t) || undefined,
        totalRequests: lerpRound(la.totalRequests ?? 0, lb.totalRequests ?? 0, t) || undefined,
        dbQueryRate: lerpNum(la.dbQueryRate ?? 0, lb.dbQueryRate ?? 0, t) || undefined,
        dbTotalQueries: lerpRound(la.dbTotalQueries ?? 0, lb.dbTotalQueries ?? 0, t) || undefined,
        p50LatencyMs: lerpNum(la.p50LatencyMs ?? 0, lb.p50LatencyMs ?? 0, t) || undefined,
        p95LatencyMs: lerpNum(la.p95LatencyMs ?? 0, lb.p95LatencyMs ?? 0, t) || undefined,
        p99LatencyMs: lerpNum(la.p99LatencyMs ?? 0, lb.p99LatencyMs ?? 0, t) || undefined,
        p50Latency9mMs: lerpNum(la.p50Latency9mMs ?? 0, lb.p50Latency9mMs ?? 0, t) || undefined,
        p95Latency9mMs: lerpNum(la.p95Latency9mMs ?? 0, lb.p95Latency9mMs ?? 0, t) || undefined,
        p99Latency9mMs: lerpNum(la.p99Latency9mMs ?? 0, lb.p99Latency9mMs ?? 0, t) || undefined,
        dbActiveConnections:
          lerpRound(la.dbActiveConnections ?? 0, lb.dbActiveConnections ?? 0, t) || undefined,
        replicationLagSeconds:
          la.replicationLagSeconds != null || lb.replicationLagSeconds != null
            ? lerpNum(la.replicationLagSeconds ?? 0, lb.replicationLagSeconds ?? 0, t)
            : undefined,
        storageIo: lerpStorageIo(la.storageIo ?? null, lb.storageIo ?? null, t),
        freshness: t >= 0.5 ? lb.freshness : la.freshness,
      })
      continue
    }
    const chosen = t >= 0.5 ? lb ?? la : la ?? lb
    if (chosen) out.push({ ...chosen })
  }
  return out
}

/** Linear blend of two per-node metric buckets (field registry in F2 handoff). */
export function lerpMetricsBucket(
  a: MetricsBucket,
  b: MetricsBucket,
  t: number,
  playheadMs: number,
): MetricsBucket {
  const dbQuerySource = resolveDbQuerySource(a.dbQuerySource, b.dbQuerySource, t)
  const cpuSource = resolveResourceSource(a.cpuSource, b.cpuSource, t)
  const memSource = resolveResourceSource(a.memSource, b.memSource, t)

  return {
    cpuUsage: lerpNum(a.cpuUsage, b.cpuUsage, t),
    cpuPercent: lerpNum(a.cpuPercent, b.cpuPercent, t),
    memoryBytes: lerpRound(a.memoryBytes, b.memoryBytes, t),
    memPercent: lerpNum(a.memPercent, b.memPercent, t),
    cpuIsEstimated: snapBool(a.cpuIsEstimated, b.cpuIsEstimated, t),
    memIsEstimated: snapBool(a.memIsEstimated, b.memIsEstimated, t),
    cpuSource,
    memSource,
    cpuLimit: lerpNum(a.cpuLimit, b.cpuLimit, t),
    memoryLimit: lerpNum(a.memoryLimit, b.memoryLimit, t),
    requestRate: lerpNum(a.requestRate, b.requestRate, t),
    errorRate: lerpNum(a.errorRate, b.errorRate, t),
    totalRequests: lerpRound(a.totalRequests, b.totalRequests, t),
    totalErrors9m: lerpRound(a.totalErrors9m, b.totalErrors9m, t),
    p50Latency: lerpNum(a.p50Latency, b.p50Latency, t),
    p95Latency: lerpNum(a.p95Latency, b.p95Latency, t),
    p99Latency: lerpNum(a.p99Latency, b.p99Latency, t),
    p50Latency9m: lerpNum(a.p50Latency9m, b.p50Latency9m, t),
    p95Latency9m: lerpNum(a.p95Latency9m, b.p95Latency9m, t),
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
    evictionsPerSec: lerpNum(a.evictionsPerSec ?? 0, b.evictionsPerSec ?? 0, t),
    expirationsPerSec: lerpNum(
      a.expirationsPerSec ?? 0,
      b.expirationsPerSec ?? 0,
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
    podReplicas: lerpPodReplicas(a.podReplicas, b.podReplicas, t),
    backendPods: lerpPodReplicas(a.backendPods, b.backendPods, t),
    backendReplicas: t >= 0.5 ? (b.backendReplicas ? { ...b.backendReplicas } : null) : (a.backendReplicas ? { ...a.backendReplicas } : null),
    runtimeHealth:
      t >= 0.5
        ? b.runtimeHealth
          ? { ...b.runtimeHealth, pods: b.runtimeHealth.pods.map((p) => ({ ...p })) }
          : null
        : a.runtimeHealth
          ? { ...a.runtimeHealth, pods: a.runtimeHealth.pods.map((p) => ({ ...p })) }
          : null,
    layers: lerpComponentLayers(a.layers, b.layers, t),
    freshness:
      t >= 0.5
        ? b.freshness
          ? { ...b.freshness }
          : undefined
        : a.freshness
          ? { ...a.freshness }
          : undefined,
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
