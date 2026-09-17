import { idleClientLoadgenBucket } from '../../lib/clientMetrics'
import { utilizationPercent } from '../../lib/format'
import {
  chaosHealFromWsEvent,
  chaosOverlayFromWsEvent,
} from '../../lib/chaos'
import { parseComponentFreshness } from '../../lib/metricsFreshness'
import { parseDbQuerySource } from '../../lib/storageIoDisplay'
import { CLIENT_LOADGEN_ID } from '../../lib/spawnClientNode'
import { backendComponentToCanvasType } from '../../lib/typeMapping'
import {
  parseBackendReplicas,
  parseCrashContext,
  parseComponentLayers,
  parseDbConsistency,
  parseLoadgenIntervals,
  parsePodReplicas,
  parseRecentLatenciesMs,
  parseStatusCodes,
  parseResourceUsageSource,
  parseRuntimeHealth,
  parseStorageIo,
  sampleFromWsPayload,
} from '../domain/metricsUiContract'
import { nodeStatusFromMetrics } from '../domain/healthThresholds'
import { useChaosStore } from '../stores/chaosStore'
import { useCanvasStore, type CanvasNode } from '../stores/canvasStore'
import {
  useMetricsStore,
  type MetricsBucket,
  type WsEvent,
} from '../stores/metricsStore'
import type { WsComponentMetrics, WsDeploymentMetrics, WsEventPayload } from './wsMetricsTypes'

function parseLoadgenDistribution(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) out[key] = Math.round(n)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function nodeIdsForBackendKey(
  nodes: Record<string, CanvasNode>,
  backendKey: string,
): string[] {
  const canvasType = backendComponentToCanvasType[backendKey]
  if (!canvasType) return []
  return Object.values(nodes)
    .filter((n) => n.type === canvasType)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => n.id)
}

function pctFromLimit(usage: number, limit: number): number {
  return utilizationPercent(usage, limit)
}

export function componentToBucket(cm: WsComponentMetrics): MetricsBucket {
  const cpu = cm.cpuUsage ?? 0
  const mem = cm.memoryBytes ?? cm.memoryUsage ?? 0
  const cpuLimit = cm.cpuLimit ?? 0
  const memLimit = cm.memoryLimit ?? 0
  const requestRate = cm.requestRate ?? 0
  const p99Sec = cm.p99Latency ?? 0
  const dbLatSec = cm.dbQueryLatency ?? 0
  const avgFromDbMs = dbLatSec * 1000
  const avgLatency =
    (cm.avgLatency ?? 0) > 0 ? (cm.avgLatency as number) : avgFromDbMs

  const cpuPercent =
    cpuLimit > 0
      ? pctFromLimit(cpu, cpuLimit)
      : utilizationPercent(cpu, 0, 1)
  const memPercent =
    memLimit > 0
      ? pctFromLimit(mem, memLimit)
      : utilizationPercent(mem, 0, 512 * 1024 * 1024)

  return {
    cpuUsage: cpu,
    cpuPercent,
    memoryBytes: mem,
    memPercent,
    cpuIsEstimated: Boolean(cm.cpuIsEstimated),
    memIsEstimated: Boolean(cm.memIsEstimated),
    cpuSource: parseResourceUsageSource(cm.cpuSource),
    memSource: parseResourceUsageSource(cm.memSource),
    cpuLimit: cm.cpuLimit ?? 0,
    memoryLimit: cm.memoryLimit ?? 0,
    requestRate,
    errorRate: cm.errorRate ?? 0,
    totalRequests: Math.round(cm.totalRequests ?? 0),
    totalErrors9m: Math.round(cm.totalErrors9m ?? 0),
    p50Latency: cm.p50Latency ?? 0,
    p95Latency: cm.p95Latency ?? 0,
    p99Latency: p99Sec * 1000,
    p50Latency9m: (cm.p50Latency9m ?? 0) * 1000,
    p95Latency9m: (cm.p95Latency9m ?? 0) * 1000,
    p99Latency9m: (cm.p99Latency9m ?? 0) * 1000,
    avgLatency,
    cacheStrategy: cm.cacheStrategy ?? '',
    cacheMetricMode: cm.cacheMetricMode ?? '',
    cacheReadOperation: cm.cacheReadOperation ?? '',
    cacheWriteOperation: cm.cacheWriteOperation ?? '',
    redisOpsPerSec: cm.redisOpsPerSec ?? 0,
    redisRejectedRate: cm.redisRejectedRate ?? 0,
    redisKeyspaceHits: cm.redisKeyspaceHits ?? 0,
    redisKeyspaceMisses: cm.redisKeyspaceMisses ?? 0,
    redisAvgLatency: cm.redisAvgLatency ?? 0,
    redisConnectedClients: cm.redisConnectedClients ?? 0,
    evictionsPerSec: cm.evictionsPerSec ?? 0,
    expirationsPerSec: cm.expirationsPerSec ?? 0,
    cacheHits: Math.round(cm.cacheHits ?? 0),
    cacheMisses: Math.round(cm.cacheMisses ?? 0),
    cacheHitsLast9m: Math.round(cm.cacheHitsLast9m ?? 0),
    cacheMissesLast9m: Math.round(cm.cacheMissesLast9m ?? 0),
    dbQueryRate: cm.dbQueryRate ?? 0,
    dbTotalQueries: Math.round(cm.dbTotalQueries ?? 0),
    dbQueryLatency: dbLatSec,
    dbQuerySource: parseDbQuerySource(cm.dbQuerySource),
    dbActiveConnections: Math.round(cm.dbActiveConnections ?? 0),
    maxConnections: Math.round(cm.maxConnections ?? 0),
    storageEngine: cm.storageEngine ?? '',
    storageRole: cm.storageRole ?? '',
    storageIo: parseStorageIo(cm.storageIo),
    activeConnections: cm.activeConnections ?? 0,
    lbConnectionLimit: cm.lbConnectionLimit ?? 0,
    queueDepth: cm.queueDepth ?? 0,
    produceRate: cm.produceRate ?? 0,
    consumeRate: cm.consumeRate ?? 0,
    messagesReady: cm.messagesReady ?? 0,
    messagesUnacked: cm.messagesUnacked ?? 0,
    mqMemoryUsed: cm.mqMemoryUsed ?? 0,
    mqMemoryLimit: cm.mqMemoryLimit ?? 0,
    mqSaturationRatio: cm.mqSaturationRatio ?? 0,
    workerSaturation: cm.workerSaturation ?? 0,
    redisMaxClients: cm.redisMaxClients ?? 0,
    perBackendRps:
      cm.perBackendRps && typeof cm.perBackendRps === 'object'
        ? { ...cm.perBackendRps }
        : {},
    lbAlgorithm: cm.lbAlgorithm ?? '',
    lbBackends: Array.isArray(cm.lbBackends) ? [...cm.lbBackends] : [],
    podReplicas: [],
    backendPods: [],
    backendReplicas: parseBackendReplicas(cm.backendReplicas),
    runtimeHealth: parseRuntimeHealth(cm.runtimeHealth),
    layers: parseComponentLayers(cm.layers),
    freshness: parseComponentFreshness(cm.freshness),
    consistency: parseDbConsistency(cm.consistency),
    podCount: 1,
    lastUpdated: Date.now(),
    qps: Math.round(requestRate),
  }
}

export function normalizeWsEvents(raw: WsEventPayload[] | undefined): WsEvent[] {
  if (!raw?.length) return []
  const out: WsEvent[] = []
  for (const e of raw) {
    const title =
      (e?.title && String(e.title).trim()) ||
      (e?.description && String(e.description).trim()) ||
      ''
    if (!title) continue
    const rule =
      (typeof e.ruleId === 'string' && e.ruleId.trim() ? e.ruleId.trim() : undefined) ||
      (typeof e.rule === 'string' && e.rule.trim() ? e.rule.trim() : undefined)
    const crashContext = parseCrashContext(e.crashContext) ?? undefined
    const kind =
      e.kind === 'loadgen_start' ||
      e.kind === 'loadgen_stop' ||
      e.kind === 'loadgen_rate' ||
      e.kind === 'loadgen_mix' ||
      e.kind === 'chaos_inject' ||
      e.kind === 'chaos_heal' ||
      e.kind === 'standby_reclone'
        ? e.kind
        : undefined
    const detail =
      e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail)
        ? Object.fromEntries(
            Object.entries(e.detail).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : undefined
    const audience =
      e.audience === 'user' || e.audience === 'ai' || e.audience === 'both'
        ? e.audience
        : undefined
    out.push({
      timestamp: e.timestamp ?? new Date().toISOString(),
      type: e.type ?? 'action',
      source: e.source ?? 'unknown',
      kind,
      detail,
      audience,
      component: e.component,
      rule,
      title,
      description: e.description ?? '',
      narrative:
        typeof e.narrative === 'string' && e.narrative.trim() ? e.narrative : undefined,
      suggestion:
        typeof e.suggestion === 'string' && e.suggestion.trim()
          ? e.suggestion
          : undefined,
      related: Array.isArray(e.related)
        ? e.related.map((x) => String(x)).filter(Boolean)
        : undefined,
      crashContext,
    })
  }
  return out
}

function actualRpsFromLoadgen(lg: NonNullable<WsDeploymentMetrics['loadgen']>): number {
  const actual = Number(lg.actualRps ?? 0)
  if (actual > 0) return actual
  return Number(lg.currentRps ?? lg.targetRps ?? 0)
}

/** Map WS payload ? per-canvas-node buckets (shared by live apply + interpolation). */
export function nodeBucketsFromPayload(
  payload: WsDeploymentMetrics,
  nodes: Record<string, CanvasNode>,
): Record<string, MetricsBucket> {
  const out: Record<string, MetricsBucket> = {}
  const components = payload.components ?? {}

  for (const [backendKey, cm] of Object.entries(components)) {
    if (!cm) continue
    const ids = nodeIdsForBackendKey(nodes, backendKey)
    let bucket = componentToBucket(cm)

    if (backendKey === 'app-server' || backendKey === 'worker') {
      const pods = parsePodReplicas(cm.replicas)
      if (pods.length > 0) {
        bucket = { ...bucket, podReplicas: pods, podCount: pods.length }
      }
    }

    if (backendKey === 'lb') {
      const pods = parsePodReplicas(cm.backendPods)
      const backendReplicas = parseBackendReplicas(cm.backendReplicas)
      bucket = {
        ...bucket,
        backendPods: pods,
        backendReplicas,
        podCount:
          backendReplicas?.desired && backendReplicas.desired > 0
            ? backendReplicas.desired
            : pods.length > 0
              ? pods.length
              : bucket.podCount,
      }
    }

    for (const id of ids) {
      out[id] = bucket
    }
  }

  const lg = payload.loadgen
  if (lg && nodes[CLIENT_LOADGEN_ID]) {
    const rps = lg.active ? actualRpsFromLoadgen(lg) : 0
    out[CLIENT_LOADGEN_ID] = {
      ...idleClientLoadgenBucket(),
      requestRate: rps,
      totalRequests: Math.round(lg.totalRequests ?? 0),
      qps: Math.round(rps),
    }
  }

  return out
}

export function registerChaosFromEvents(ev: WsEvent[]): void {
  const chaosState = useChaosStore.getState()
  let active = chaosState.active
  for (const e of ev) {
    if (chaosHealFromWsEvent(e)) {
      if (active?.stateful) {
        chaosState.clear()
        active = null
      }
      continue
    }
    const overlay = chaosOverlayFromWsEvent(e)
    if (!overlay) continue
    if (
      active &&
      active.targetComponent === overlay.targetComponent &&
      active.scenario === overlay.scenario
    ) {
      continue
    }
    chaosState.register(
      overlay.scenario,
      overlay.targetComponent,
      overlay.startedAt,
    )
    active = chaosState.active
    break
  }
}

export interface ApplyWsFrameOptions {
  /** Append to chart history / system series (default true). */
  appendCharts?: boolean
  /** Push to timeline immediately (false when playback buffer owns event timing). */
  pushEvents?: boolean
}

/**
 * Apply latest raw WS frame: headlines, loadgen, status, chaos.
 * Chart history appends when appendCharts is true (live inspector path).
 */
export function applyWsFrameToStore(
  payload: WsDeploymentMetrics,
  options: ApplyWsFrameOptions = {},
): WsEvent[] {
  const { appendCharts = true, pushEvents = true } = options
  const nodes = useCanvasStore.getState().nodes
  const applyMetricsBuckets = useMetricsStore.getState().applyMetricsBuckets
  const updateNodeStatuses = useCanvasStore.getState().updateNodeStatuses
  const pushEventsFn = useMetricsStore.getState().pushEvents
  const setTemplateMetrics = useMetricsStore.getState().setTemplateMetrics

  if (payload.templateMetrics && Object.keys(payload.templateMetrics).length > 0) {
    setTemplateMetrics(payload.templateMetrics)
  }

  const ev = normalizeWsEvents(payload.events)
  if (ev.length && pushEvents) {
    pushEventsFn(ev)
    registerChaosFromEvents(ev)
  }

  const nodeBuckets = nodeBucketsFromPayload(payload, nodes)
  const components = payload.components ?? {}
  const metricsPatch: Record<string, MetricsBucket> = {}
  const statusPatch: Record<string, CanvasNode['status']> = {}

  for (const [backendKey, cm] of Object.entries(components)) {
    if (!cm) continue
    const ids = nodeIdsForBackendKey(nodes, backendKey)
    for (const id of ids) {
      const bucket = nodeBuckets[id]
      if (!bucket) continue
      metricsPatch[id] = bucket
      statusPatch[id] = nodeStatusFromMetrics(bucket)
    }
  }

  const clientBucket = nodeBuckets[CLIENT_LOADGEN_ID]
  if (clientBucket) {
    metricsPatch[CLIENT_LOADGEN_ID] = clientBucket
  }

  if (Object.keys(metricsPatch).length > 0) {
    applyMetricsBuckets(metricsPatch, { appendHistory: appendCharts })
  }
  if (Object.keys(statusPatch).length > 0) {
    updateNodeStatuses(statusPatch)
  }

  const lg = payload.loadgen
  if (lg) {
    const prev = useMetricsStore.getState().loadgen
    const frameActive = Boolean(lg.active)
    const isStale = Boolean(lg.stale)
    let active = frameActive
    if (isStale && !frameActive && prev?.active) {
      active = true
    }
    const targetRps = Number(lg.targetRps ?? lg.currentRps ?? 0)
    const actualRps = Number(lg.actualRps ?? lg.currentRps ?? 0)
    useMetricsStore.getState().setLoadgen({
      active,
      stale: isStale,
      targetRps,
      currentRps: targetRps,
      actualRps,
      intervalActualRps: Number(lg.intervalActualRps ?? 0),
      intervalP99Ms: Number(lg.intervalP99Ms ?? 0),
      recentIntervals: parseLoadgenIntervals(lg.recentIntervals),
      recentLatenciesMs: parseRecentLatenciesMs(lg.recentLatenciesMs),
      totalRequests: Number(lg.totalRequests ?? 0),
      successRate: Number(lg.successRate ?? 0),
      durationSeconds: 0,
      elapsedSeconds: Number(lg.durationSeconds ?? 0),
      statusCodes: parseStatusCodes(lg.statusCodes),
      scheduleId: typeof lg.scheduleId === 'string' ? lg.scheduleId : undefined,
      currentPhase: typeof lg.currentPhase === 'string' ? lg.currentPhase : undefined,
      phaseIndex: Number.isFinite(Number(lg.phaseIndex)) ? Number(lg.phaseIndex) : undefined,
      distribution: parseLoadgenDistribution(lg.distribution),
    })
  }

  if (appendCharts) {
    const systemSample = sampleFromWsPayload(payload.timestamp, components)
    if (systemSample) {
      useMetricsStore.getState().pushSystemSample(systemSample)
    }
  }

  return ev
}

export function parseServerTimestamp(payload: WsDeploymentMetrics): number {
  const raw = payload.timestamp
  if (raw) {
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now()
}
