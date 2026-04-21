import { create } from 'zustand'

/** Event from backend metrics stream (threshold, cascade, loadgen actions). */
export interface WsEvent {
  timestamp: string
  type: string
  source: string
  component?: string
  title: string
  description: string
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

/** Subset of backend `loadgen` for the live overlay. */
export interface LiveLoadgenState {
  active: boolean
  currentRps: number
  targetRps: number
  totalRequests: number
  successRate: number
  durationSeconds: number
  elapsedSeconds: number
}

const MAX_EVENTS = 100

interface MetricsState {
  metrics: Record<string, MetricsBucket>
  history: Record<string, MetricsBucket[]>
  loadgen: LiveLoadgenState | null
  /** Rolling timeline of WS events (capped). */
  events: WsEvent[]
  /** Latest template-scoped counters/gauges from backend (dot keys). */
  templateMetrics: Record<string, number>
  /** Latest cascade event for a short toast; cleared on dismiss or clearMetrics. */
  cascadeToast: WsEvent | null

  updateMetrics: (nodeId: string, data: MetricsBucket) => void
  setLoadgen: (data: LiveLoadgenState | null) => void
  pushEvents: (incoming: WsEvent[]) => void
  setTemplateMetrics: (m: Record<string, number> | undefined) => void
  dismissCascadeToast: () => void
  clearMetrics: () => void
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: {},
  history: {},
  loadgen: null,
  events: [],
  templateMetrics: {},
  cascadeToast: null,

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

  clearMetrics: () =>
    set({
      metrics: {},
      history: {},
      loadgen: null,
      events: [],
      templateMetrics: {},
      cascadeToast: null,
    }),
}))
