import type { EventVisibility } from '../domain/eventVisibility'
import type { WorkloadEventKind, WsEvent } from '../stores/metricsStore'

export interface WsComponentMetrics {
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
  evictionsPerSec?: number
  evictionsLast9m?: number
  expirationsLast9m?: number
  expirationsPerSec?: number
  cpuUsage?: number
  memoryUsage?: number
  memoryBytes?: number
  requestRate?: number
  errorRate?: number
  totalRequests?: number
  totalErrors9m?: number
  p50Latency?: number
  p95Latency?: number
  p99Latency?: number
  p50Latency9m?: number
  p95Latency9m?: number
  p99Latency9m?: number
  avgLatency?: number
  cacheHits?: number
  cacheMisses?: number
  cacheHitsLast9m?: number
  cacheMissesLast9m?: number
  timelineKeyCount?: number
  feedRequestRatePush?: number
  feedRequestRatePull?: number
  timelineRelationBytes?: number
  timelineDeadTuples?: number
  dbQueryRate?: number
  dbQuerySource?: string
  dbActiveConnections?: number
  maxConnections?: number
  dbQueryLatency?: number
  dbTotalQueries?: number
  cpuLimit?: number
  memoryLimit?: number
  cpuIsEstimated?: boolean
  memIsEstimated?: boolean
  cpuSource?: string
  memSource?: string
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
  runtimeHealth?: unknown
  layers?: unknown[]
  /** Per-signal-group freshness (throughput, containerCpu, …). */
  freshness?: unknown
  /** Observer probe counters when read replicas are deployed. */
  consistency?: unknown
  scale?: { desired?: number; ready?: number }
}

export interface WsEventPayload {
  timestamp?: string
  type?: string
  source?: string
  kind?: WorkloadEventKind
  detail?: Record<string, string>
  visibility?: EventVisibility
  /** @deprecated Legacy field; normalized to visibility on ingest. */
  audience?: string
  component?: string
  rule?: string
  ruleId?: string
  title?: string
  description?: string
  narrative?: string
  suggestion?: string
  related?: string[]
  crashContext?: unknown
}

export interface WsDeploymentMetrics {
  timestamp?: string
  namespace?: string
  runRole?: string
  comparisonId?: string
  snapshotAgeMs?: number
  collectPending?: boolean
  phenomena?: unknown
  timeline?: {
    engine?: string
    appendRate?: number
    appendP99Ms?: number
    rangeP99Ms?: number
    errorRate?: number
  }
  components?: Record<string, WsComponentMetrics>
  templateMetrics?: Record<string, number>
  events?: WsEventPayload[]
  loadgen?: {
    active?: boolean
    stale?: boolean
    targetRps?: number
    currentRps?: number
    actualRps?: number
    intervalActualRps?: number
    intervalP99Ms?: number
    recentIntervals?: unknown
    recentLatenciesMs?: unknown
    meanLatency?: number
    p99Latency?: number
    totalRequests?: number
    successRate?: number
    durationSeconds?: number
    statusCodes?: Record<string, number>
    scheduleId?: string
    currentPhase?: string
    phaseIndex?: number
    distribution?: Record<string, number>
    identityCount?: number
    identitiesSeen?: number
    scaleLagErrors?: number
    vu?: {
      behaviors?: Record<
        string,
        { vus?: number; requests?: number; errors?: number }
      >
      observer?: { threadReads?: number; violations?: number; errors?: number }
    }
  }
}

export interface BufferedSample {
  receivedAt: number
  serverTimestamp: number
  payload: WsDeploymentMetrics
  /** Buffered for F3 playhead-gated timeline. */
  events: WsEvent[]
}
