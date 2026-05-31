import { useEffect, useRef } from 'react'
import { connectMetricsWS, getDeployment } from '../../lib/api'
import { idleClientLoadgenBucket } from '../../lib/clientMetrics'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../../lib/sessionCapture'
import { CLIENT_LOADGEN_ID } from '../../lib/spawnClientNode'
import { saveWsEventsJson } from '../../lib/wsEventsPersist'
import { chaosOverlayFromWsEvent } from '../../lib/chaos'
import { backendComponentToCanvasType } from '../../lib/typeMapping'
import {
  parseBackendReplicas,
  parseLoadgenIntervals,
  parsePodReplicas,
  parseStorageIo,
  sampleFromWsPayload,
} from '../domain/metricsUiContract'
import { useChaosStore } from '../stores/chaosStore'
import { useCanvasStore, type CanvasNode } from '../stores/canvasStore'
import {
  useMetricsStore,
  type MetricsBucket,
  type WsEvent,
} from '../stores/metricsStore'

interface WsComponentMetrics {
  component?: string
  cacheStrategy?: string
  cacheMetricMode?: string
  cacheReadOperation?: string
  cacheWriteOperation?: string
  redisOpsPerSec?: number
  redisRejectedRate?: number
  redisKeyspaceHits?: number
  redisKeyspaceMisses?: number
  redisAvgLatency?: number
  redisConnectedClients?: number
  cpuUsage?: number
  memoryUsage?: number
  memoryBytes?: number
  requestRate?: number
  errorRate?: number
  totalRequests?: number
  p50Latency?: number
  p95Latency?: number
  p99Latency?: number
  avgLatency?: number
  cacheHits?: number
  cacheMisses?: number
  cacheHitsLast9m?: number
  cacheMissesLast9m?: number
  dbQueryRate?: number
  dbActiveConnections?: number
  maxConnections?: number
  /** Go backend: seconds */
  dbQueryLatency?: number
  dbTotalQueries?: number
  cpuLimit?: number
  memoryLimit?: number
  cpuIsEstimated?: boolean
  memIsEstimated?: boolean
  activeConnections?: number
  queueDepth?: number
  produceRate?: number
  consumeRate?: number
  messagesReady?: number
  messagesUnacked?: number
  lbAlgorithm?: string
  lbBackends?: string[]
  perBackendRps?: Record<string, number>
  replicas?: unknown[]
  backendPods?: unknown[]
  backendReplicas?: { desired?: number; ready?: number }
  lbConnectionLimit?: number
  redisMaxClients?: number
  mqMemoryUsed?: number
  mqMemoryLimit?: number
  mqSaturationRatio?: number
  workerSaturation?: number
  storageEngine?: string
  storageRole?: string
  storageIo?: unknown
}

interface WsEventPayload {
  timestamp?: string
  type?: string
  source?: string
  component?: string
  rule?: string
  title?: string
  description?: string
  narrative?: string
  suggestion?: string
  related?: string[]
}

interface WsDeploymentMetrics {
  timestamp?: string
  namespace?: string
  components?: Record<string, WsComponentMetrics>
  templateMetrics?: Record<string, number>
  events?: WsEventPayload[]
  loadgen?: {
    active?: boolean
    targetRps?: number
    currentRps?: number
    actualRps?: number
    intervalActualRps?: number
    intervalP99Ms?: number
    recentIntervals?: unknown
    totalRequests?: number
    successRate?: number
    /** Go LoadStats: elapsed run time (seconds) */
    durationSeconds?: number
  }
}

function nodeIdsForBackendKey(
  nodes: Record<string, CanvasNode>,
  backendKey: string
): string[] {
  const canvasType = backendComponentToCanvasType[backendKey]
  if (!canvasType) return []
  return Object.values(nodes)
    .filter((n) => n.type === canvasType)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => n.id)
}

function pctFromLimit(usage: number, limit: number): number {
  if (limit <= 0 || !Number.isFinite(limit)) return 0
  return Math.min(100, Math.round((usage / limit) * 100))
}

function componentToBucket(cm: WsComponentMetrics): MetricsBucket {
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
      : Math.min(100, Math.round(cpu * 100))
  const memPercent =
    memLimit > 0
      ? pctFromLimit(mem, memLimit)
      : Math.min(100, Math.round((mem / (512 * 1024 * 1024)) * 100))

  return {
    cpuUsage: cpu,
    cpuPercent,
    memoryBytes: mem,
    memPercent,
    cpuIsEstimated: Boolean(cm.cpuIsEstimated),
    memIsEstimated: Boolean(cm.memIsEstimated),
    cpuLimit: cm.cpuLimit ?? 0,
    memoryLimit: cm.memoryLimit ?? 0,
    requestRate,
    errorRate: cm.errorRate ?? 0,
    totalRequests: Math.round(cm.totalRequests ?? 0),
    p50Latency: cm.p50Latency ?? 0,
    p95Latency: cm.p95Latency ?? 0,
    p99Latency: p99Sec * 1000,
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
    cacheHits: Math.round(cm.cacheHits ?? 0),
    cacheMisses: Math.round(cm.cacheMisses ?? 0),
    cacheHitsLast9m: Math.round(cm.cacheHitsLast9m ?? 0),
    cacheMissesLast9m: Math.round(cm.cacheMissesLast9m ?? 0),
    dbQueryRate: cm.dbQueryRate ?? 0,
    dbQueryLatency: dbLatSec,
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
    backendReplicas: null,
    podCount: 1,
    lastUpdated: Date.now(),
    qps: Math.round(requestRate),
  }
}

function normalizeWsEvents(raw: WsEventPayload[] | undefined): WsEvent[] {
  if (!raw?.length) return []
  const out: WsEvent[] = []
  for (const e of raw) {
    const title =
      (e?.title && String(e.title).trim()) ||
      (e?.description && String(e.description).trim()) ||
      ''
    if (!title) continue
    const rule =
      typeof e.rule === 'string' && e.rule.trim() ? e.rule.trim() : undefined
    out.push({
      timestamp: e.timestamp ?? new Date().toISOString(),
      type: e.type ?? 'action',
      source: e.source ?? 'unknown',
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
    })
  }
  return out
}

function actualRpsFromLoadgen(lg: NonNullable<WsDeploymentMetrics['loadgen']>): number {
  const actual = Number(lg.actualRps ?? 0)
  if (actual > 0) return actual
  return Number(lg.currentRps ?? lg.targetRps ?? 0)
}

function applyMessage(payload: WsDeploymentMetrics): void {
  const nodes = useCanvasStore.getState().nodes
  const updateMetrics = useMetricsStore.getState().updateMetrics
  const updateNodeStatus = useCanvasStore.getState().updateNodeStatus
  const pushEvents = useMetricsStore.getState().pushEvents
  const setTemplateMetrics = useMetricsStore.getState().setTemplateMetrics

  if (payload.templateMetrics && Object.keys(payload.templateMetrics).length > 0) {
    setTemplateMetrics(payload.templateMetrics)
  }

  const ev = normalizeWsEvents(payload.events)
  if (ev.length) {
    pushEvents(ev)
    const chaosState = useChaosStore.getState()
    const active = chaosState.active
    for (const e of ev) {
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
      break
    }
  }

  const components = payload.components ?? {}
  for (const [backendKey, cm] of Object.entries(components)) {
    if (!cm) continue
    const ids = nodeIdsForBackendKey(nodes, backendKey)
    let bucket = componentToBucket(cm)

    if (backendKey === 'app-server') {
      const pods = parsePodReplicas(cm.replicas)
      if (pods.length > 0) {
        bucket = {
          ...bucket,
          podReplicas: pods,
          podCount: pods.length,
        }
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

    const err = cm.errorRate ?? 0
    const degraded = err > 0.25
    const status = degraded ? 'degraded' : 'healthy'
    for (const id of ids) {
      updateMetrics(id, bucket)
      updateNodeStatus(id, status)
    }
  }

  const lg = payload.loadgen
  if (lg) {
    const targetRps = Number(lg.targetRps ?? lg.currentRps ?? 0)
    const actualRps = Number(lg.actualRps ?? lg.currentRps ?? 0)
    useMetricsStore.getState().setLoadgen({
      active: Boolean(lg.active),
      targetRps,
      currentRps: targetRps,
      actualRps,
      intervalActualRps: Number(lg.intervalActualRps ?? 0),
      intervalP99Ms: Number(lg.intervalP99Ms ?? 0),
      recentIntervals: parseLoadgenIntervals(lg.recentIntervals),
      totalRequests: Number(lg.totalRequests ?? 0),
      successRate: Number(lg.successRate ?? 0),
      durationSeconds: 0,
      elapsedSeconds: Number(lg.durationSeconds ?? 0),
    })
  }

  const systemSample = sampleFromWsPayload(payload.timestamp, components)
  if (systemSample) {
    useMetricsStore.getState().pushSystemSample(systemSample)
  }

  if (lg && nodes[CLIENT_LOADGEN_ID]) {
    const rps = lg.active ? actualRpsFromLoadgen(lg) : 0
    const clientBucket: MetricsBucket = {
      ...idleClientLoadgenBucket(),
      requestRate: rps,
      totalRequests: Math.round(lg.totalRequests ?? 0),
      qps: Math.round(rps),
    }
    updateMetrics(CLIENT_LOADGEN_ID, clientBucket)
  }
}

export function useMetricsSync(deploymentId: string | null): void {
  const retryRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    retryRef.current = 0

    const clearPersistTimer = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const closeWs = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.onmessage = null
        wsRef.current.close()
        wsRef.current = null
      }
    }

    if (!deploymentId) {
      clearTimer()
      clearPersistTimer()
      closeWs()
      useMetricsStore.getState().setStreamWarning(null)
      return
    }

    const schedulePersistWsEvents = () => {
      clearPersistTimer()
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        const evs = useMetricsStore.getState().events
        saveWsEventsJson(deploymentId, JSON.stringify(evs))
      }, 350)
    }

    const connect = () => {
      clearTimer()
      closeWs()

      const ws = connectMetricsWS(deploymentId)
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        const m = useMetricsStore.getState()
        if (m.events.length === 0) m.restorePersistedWsEvents(deploymentId)
      }

      ws.onmessage = (ev) => {
        retryRef.current = 0
        useMetricsStore.getState().setStreamWarning(null)
        try {
          const data = JSON.parse(ev.data as string) as WsDeploymentMetrics
          applyMessage(data)
          schedulePersistWsEvents()
        } catch {
          /* ignore bad frame */
        }
      }

      ws.onerror = () => {
        /* onclose will handle reconnect */
      }

      ws.onclose = () => {
        wsRef.current = null
        const st = useCanvasStore.getState()
        if (st.deploymentId !== deploymentId) return
        const maxRetries = 5
        if (retryRef.current >= maxRetries) {
          useMetricsStore
            .getState()
            .setStreamWarning('Live metrics connection dropped. Reconnecting...')
          void getDeployment(deploymentId)
            .then((dep) => {
              if (isTerminalDeploymentStatus(dep.status)) {
                exitLiveSessionDueToRemoteEnd()
                return
              }
              retryRef.current = 0
              timerRef.current = setTimeout(connect, 2000)
            })
            .catch(() => {
              retryRef.current = 0
              timerRef.current = setTimeout(connect, 2000)
            })
          return
        }
        const delay = Math.min(30_000, 1000 * Math.pow(2, retryRef.current))
        retryRef.current += 1
        timerRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      clearTimer()
      clearPersistTimer()
      closeWs()
    }
  }, [deploymentId])
}
