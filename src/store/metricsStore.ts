import { create } from 'zustand'
import { loadWsEventsJson } from '../lib/wsEventsPersist'
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
  /** K8s CPU limit in cores (denominator). */
  cpuLimit: number
  /** K8s / Redis maxmemory limit in bytes. */
  memoryLimit: number

  // Traffic (RED)
  requestRate: number
  errorRate: number
  totalRequests: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
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
  dbActiveConnections: number
  /** Postgres max_connections when known (from metrics). */
  maxConnections: number

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

  // Meta
  podCount: number
  lastUpdated: number

  /** Rounded requestRate for compact UI readouts. */
  qps: number
}

import type { LoadgenIntervalBucket } from '../lib/metricsUiContract'

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

  updateMetrics: (nodeId: string, data: MetricsBucket) => void
  setLoadgen: (data: LiveLoadgenState | null) => void
  pushSystemSample: (sample: SystemMetricsSample) => void
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
    return set({
      metrics: {},
      history: {},
      loadgen: null,
      systemSeries: [],
      events: [],
      templateMetrics: {},
      cascadeToast: null,
      streamWarning: null,
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
