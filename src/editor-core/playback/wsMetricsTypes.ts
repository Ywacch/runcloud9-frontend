import type { WsEvent } from '../stores/metricsStore'

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
  p99Latency9m?: number
  avgLatency?: number
  cacheHits?: number
  cacheMisses?: number
  cacheHitsLast9m?: number
  cacheMissesLast9m?: number
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

export interface WsEventPayload {
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

export interface WsDeploymentMetrics {
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
    recentLatenciesMs?: unknown
    meanLatency?: number
    p99Latency?: number
    totalRequests?: number
    successRate?: number
    durationSeconds?: number
  }
}

export interface BufferedSample {
  receivedAt: number
  serverTimestamp: number
  payload: WsDeploymentMetrics
  /** Buffered for F3 playhead-gated timeline. */
  events: WsEvent[]
}
