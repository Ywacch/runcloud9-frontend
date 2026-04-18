import { create } from 'zustand'

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

interface MetricsState {
  metrics: Record<string, MetricsBucket>
  history: Record<string, MetricsBucket[]>
  loadgen: LiveLoadgenState | null
  updateMetrics: (nodeId: string, data: MetricsBucket) => void
  setLoadgen: (data: LiveLoadgenState | null) => void
  clearMetrics: () => void
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: {},
  history: {},
  loadgen: null,
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
  clearMetrics: () => set({ metrics: {}, history: {}, loadgen: null }),
}))
