import { create } from 'zustand'
import { clearPlaybackSession } from '../playback/playbackLoop'
import { clearTierCWarmupSession } from '../../lib/tierCWarmupSession'
import { loadWsEventsJson } from '../../lib/wsEventsPersist'
import { useChaosStore } from './chaosStore'
import { useCanvasStore } from './canvasStore'

/** Event from backend metrics stream (threshold, cascade, loadgen actions). */
export interface WsEvent {
  timestamp: string
  type: string
  source: string
  component?: string
  /** Rule id from backend (matches narrativeContext keys / event title). */
  rule?: string
  title: string
  description: string
  narrative?: string
  suggestion?: string
  related?: string[]
}

/** How container CPU/memory usage was resolved on the backend. */
export type ResourceUsageSource = 'cadvisor' | 'metrics_api' | 'requests'

/** Per-node metrics snapshot (full WS component payload mapped for UI). */
export interface MetricsBucket {
  // Resource (USE)
  cpuUsage: number
  cpuPercent: number
  memoryBytes: number
  memPercent: number
  /** True when backend filled usage from kube requests (no real-time series). */
  cpuIsEstimated: boolean
  memIsEstimated: boolean
  cpuSource?: ResourceUsageSource
  memSource?: ResourceUsageSource
  /** K8s CPU limit in cores (denominator). */
  cpuLimit: number
  /** K8s / Redis maxmemory limit in bytes. */
  memoryLimit: number

  // Traffic (RED)
  requestRate: number
  errorRate: number
  totalRequests: number
  /** Rolling 9m 5xx count. */
  totalErrors9m: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  /** Rolling 9m p99 in milliseconds (WS sends seconds). */
  p99Latency9m: number
  avgLatency: number

  // Cache-specific
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
  cacheHits: number
  cacheMisses: number
  cacheHitsLast9m: number
  cacheMissesLast9m: number

  // DB-specific
  dbQueryRate: number
  /** Rolling 9m app query count. */
  dbTotalQueries: number
  /** App-reported query latency (seconds on WS). */
  dbQueryLatency: number
  /** `"app"` = trust dbQueryRate; `"none"` = no app instrumentation. */
  dbQuerySource: '' | 'app' | 'none'
  dbActiveConnections: number
  /** Postgres max_connections when known (from metrics). */
  maxConnections: number

  /** Persistence engine from design (WS); e.g. postgresql, redis. */
  storageEngine: string
  storageRole: string
  /** Engine-native I/O when component is a store (`db`, cache-as-store). */
  storageIo: StorageIoMetrics | null

  // MQ / worker / LB (live deploy)
  activeConnections: number
  lbConnectionLimit: number
  queueDepth: number
  produceRate: number
  consumeRate: number
  messagesReady: number
  messagesUnacked: number
  mqMemoryUsed: number
  mqMemoryLimit: number
  mqSaturationRatio: number
  workerSaturation: number
  redisMaxClients: number
  perBackendRps: Record<string, number>
  lbAlgorithm: string
  lbBackends: string[]
  /** Live per-pod metrics (`app-server.replicas` on compute). */
  podReplicas: PodReplicaMetrics[]
  /** Live backend pods (`lb.backendPods`). */
  backendPods: PodReplicaMetrics[]
  /** K8s deployment replica status from LB tick. */
  backendReplicas: BackendReplicaStatus | null

  // Meta
  podCount: number
  lastUpdated: number

  /** Rounded requestRate for compact UI readouts. */
  qps: number
}

import type {
  BackendReplicaStatus,
  LoadgenIntervalBucket,
  PodReplicaMetrics,
  StorageIoMetrics,
} from '../domain/metricsUiContract'

/** Subset of backend `loadgen` for the live overlay (metrics-ui-contract). */
export interface LiveLoadgenState {
  active: boolean
  /** Configured target RPS (`targetRps`; `currentRps` is a legacy alias on the wire). */
  targetRps: number
  /** @deprecated Use targetRps — kept for older payloads. */
  currentRps: number
  /** Vegeta cumulative achieved RPS (`actualRps`). */
  actualRps: number
  intervalActualRps: number
  intervalP99Ms: number
  recentIntervals: LoadgenIntervalBucket[]
  /** Client-path latency samples (ms), oldest first — not tweened. */
  recentLatenciesMs: number[]
  totalRequests: number
  successRate: number
  durationSeconds: number
  elapsedSeconds: number
}

/** Buffered WS ticks for system teaching charts (~2s cadence). */
export interface SystemMetricsSample {
  t: number
  appP99Ms: number
  appRps: number
  dbQueryRate: number
  cacheHits: number
  cacheMisses: number
}

const MAX_SYSTEM_SAMPLES = 90

const MAX_EVENTS = 100

function parsePersistedWsEvents(raw: string): WsEvent[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: WsEvent[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const title =
      (typeof r.title === 'string' && r.title.trim()) ||
      (typeof r.description === 'string' && r.description.trim()) ||
      ''
    if (!title) continue
    out.push({
      timestamp:
        typeof r.timestamp === 'string' && r.timestamp.trim()
          ? r.timestamp
          : new Date().toISOString(),
      type: typeof r.type === 'string' ? r.type : 'action',
      source: typeof r.source === 'string' ? r.source : 'unknown',
      component: typeof r.component === 'string' ? r.component : undefined,
      title,
      description: typeof r.description === 'string' ? r.description : '',
      narrative:
        typeof r.narrative === 'string' && r.narrative.trim()
          ? r.narrative
          : undefined,
      suggestion:
        typeof r.suggestion === 'string' && r.suggestion.trim()
          ? r.suggestion
          : undefined,
      related: Array.isArray(r.related)
        ? r.related.map((x) => String(x)).filter(Boolean)
        : undefined,
    })
  }
  return out
}

interface MetricsState {
  metrics: Record<string, MetricsBucket>
  history: Record<string, MetricsBucket[]>
  loadgen: LiveLoadgenState | null
  /** Rolling server-side series from WS `components` (app-server + db). */
  systemSeries: SystemMetricsSample[]
  /** Rolling timeline of WS events (capped). */
  events: WsEvent[]
  /** Latest template-scoped counters/gauges from backend (dot keys). */
  templateMetrics: Record<string, number>
  /** Latest cascade event for a short toast; cleared on dismiss or clearMetrics. */
  cascadeToast: WsEvent | null
  /** Non-fatal transport/polling issue while live session remains active. */
  streamWarning: string | null
  /** True when playback buffer has insufficient samples ahead of playhead. */
  chartFrozen: boolean
  /** True after WS reconnect until the buffer refills. */
  playbackCatchingUp: boolean

  /** Latest raw WS bucket (headlines / tooltips). Does not append chart history. */
  setLatestMetrics: (nodeId: string, data: MetricsBucket) => void
  updateMetrics: (nodeId: string, data: MetricsBucket) => void
  setLoadgen: (data: LiveLoadgenState | null) => void
  pushSystemSample: (sample: SystemMetricsSample) => void
  /** Playhead-interpolated chart point (replaces tail when commitKey matches). */
  pushPlaybackChartPoint: (
    nodeId: string,
    data: MetricsBucket,
    commitKey: number,
  ) => void
  pushPlaybackSystemSample: (sample: SystemMetricsSample, commitKey: number) => void
  setChartFrozen: (frozen: boolean) => void
  setPlaybackCatchingUp: (catchingUp: boolean) => void
  pushEvents: (incoming: WsEvent[]) => void
  setTemplateMetrics: (m: Record<string, number> | undefined) => void
  dismissCascadeToast: () => void
  setStreamWarning: (msg: string | null) => void
  clearMetrics: () => void
  /** Hydrate timeline from sessionStorage (same-tab refresh / rejoin). */
  restorePersistedWsEvents: (deploymentId: string) => void
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: {},
  history: {},
  loadgen: null,
  systemSeries: [],
  events: [],
  templateMetrics: {},
  cascadeToast: null,
  streamWarning: null,
  chartFrozen: false,
  playbackCatchingUp: false,

  setLatestMetrics: (nodeId, data) =>
    set((s) => ({
      metrics: { ...s.metrics, [nodeId]: data },
    })),

  updateMetrics: (nodeId, data) =>
    set((s) => {
      const prev = s.history[nodeId] ?? []
      const updated = [...prev.slice(-29), data]
      return {
        metrics: { ...s.metrics, [nodeId]: data },
        history: { ...s.history, [nodeId]: updated },
      }
    }),

  setLoadgen: (loadgen) => set({ loadgen }),

  pushSystemSample: (sample) =>
    set((s) => ({
      systemSeries: [...s.systemSeries.slice(-(MAX_SYSTEM_SAMPLES - 1)), sample],
    })),

  pushPlaybackChartPoint: (nodeId, data, commitKey) =>
    set((s) => {
      const prev = s.history[nodeId] ?? []
      const last = prev[prev.length - 1]
      const point = { ...data, lastUpdated: commitKey }
      const next =
        last && last.lastUpdated === commitKey
          ? [...prev.slice(0, -1), point]
          : [...prev.slice(-29), point]
      return {
        history: { ...s.history, [nodeId]: next },
      }
    }),

  pushPlaybackSystemSample: (sample, commitKey) =>
    set((s) => {
      const prev = s.systemSeries
      const last = prev[prev.length - 1]
      const point = { ...sample, t: commitKey }
      const next =
        last && last.t === commitKey
          ? [...prev.slice(0, -1), point]
          : [...prev.slice(-(MAX_SYSTEM_SAMPLES - 1)), point]
      return { systemSeries: next }
    }),

  setChartFrozen: (chartFrozen) => set({ chartFrozen }),

  setPlaybackCatchingUp: (playbackCatchingUp) => set({ playbackCatchingUp }),

  pushEvents: (incoming) =>
    set((s) => {
      if (!incoming?.length) return s
      const merged = [...s.events, ...incoming].slice(-MAX_EVENTS)
      let cascadeToast = s.cascadeToast
      for (const e of incoming) {
        if (e.type === 'cascade') cascadeToast = e
      }
      return { events: merged, cascadeToast }
    }),

  setTemplateMetrics: (m) =>
    set({ templateMetrics: m && Object.keys(m).length ? { ...m } : {} }),

  dismissCascadeToast: () => set({ cascadeToast: null }),

  setStreamWarning: (streamWarning) => set({ streamWarning }),

  clearMetrics: () => {
    useCanvasStore.getState().setNarrativeHighlightNodeIds([])
    useChaosStore.getState().clear()
    clearPlaybackSession()
    clearTierCWarmupSession()
    return set({
      metrics: {},
      history: {},
      loadgen: null,
      systemSeries: [],
      events: [],
      templateMetrics: {},
      cascadeToast: null,
      streamWarning: null,
      chartFrozen: false,
      playbackCatchingUp: false,
    })
  },

  restorePersistedWsEvents: (deploymentId) =>
    set((s) => {
      const json = loadWsEventsJson(deploymentId)
      if (!json) return s
      const events = parsePersistedWsEvents(json)
      if (!events.length) return s
      return { events: events.slice(-MAX_EVENTS) }
    }),
}))
