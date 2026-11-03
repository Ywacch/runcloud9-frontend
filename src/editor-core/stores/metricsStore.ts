import { create } from 'zustand'
import { clearPlaybackSession } from '../playback/playbackLoop'
import { clearTierCWarmupSession } from '../../lib/tierCWarmupSession'
import { capWsEvents } from '../../lib/chaos'
import { loadWsEventsJson } from '../../lib/wsEventsPersist'
import type { EventVisibility } from '../domain/eventVisibility'
import { parseEventVisibility } from '../domain/eventVisibility'
import { useChaosStore } from './chaosStore'
import { useCanvasStore } from './canvasStore'
import {
  type ConversationLaneVU,
  conversationLaneFingerprint,
} from '../../lib/conversationsToggle'
import type { PhenomenonEntry } from '../../lib/phenomena/types'
import { clearLedgerCache } from '../../lib/phenomena/ledgerCache'
import type { TimelineOpsSnapshot } from '../../lib/timelineOpsDisplay'
import type { ScaleStatus } from '../../lib/scaleStatus'

export type WorkloadEventKind =
  | 'loadgen_start'
  | 'loadgen_stop'
  | 'loadgen_rate'
  | 'loadgen_mix'
  | 'vu_gap_warning'
  | 'chaos_inject'
  | 'chaos_heal'
  | 'standby_reclone'
  | 'scale'
export type { EventVisibility } from '../domain/eventVisibility'

/** Event from backend metrics stream (threshold, cascade, workload/runtime actions). */
export interface WsEvent {
  timestamp: string
  type: string
  source: string
  /** Workload anchor. Runtime actions such as pod restarts intentionally omit this. */
  kind?: WorkloadEventKind
  /** Workload parameters supplied by the backend. */
  detail?: Record<string, string>
  /** Missing means `all`. Legacy `audience` from older backends is normalized on ingest. */
  visibility?: EventVisibility
  component?: string
  /** Rule id from backend (matches narrativeContext keys / event title). */
  rule?: string
  title: string
  description: string
  narrative?: string
  suggestion?: string
  related?: string[]
  /** Metric snapshot at pod restart/OOM detection time. */
  crashContext?: import('../domain/metricsUiContract').CrashContext
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
  /** Session quantiles in milliseconds (WS sends seconds). */
  p50Latency9m: number
  p95Latency9m: number
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
  /** Engine-agnostic cache store rates (Redis fills them today). */
  evictionsPerSec?: number
  expirationsPerSec?: number
  evictionsLast9m?: number
  expirationsLast9m?: number
  cacheHits: number
  cacheMisses: number
  cacheHitsLast9m: number
  cacheMissesLast9m: number
  /** Lookups the app could not complete. Out of the hit rate. */
  cacheErrors?: number
  cacheErrorsLast9m?: number
  /** social-feed: count of timeline:* keys in Redis */
  timelineKeyCount?: number
  /** social-feed: rate(social_feed_request_total) by mode */
  feedRequestRatePush?: number
  feedRequestRatePull?: number
  /** Postgres timelines table stats (exporter c9_timeline). */
  timelineRelationBytes?: number
  timelineDeadTuples?: number

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
  /** HPA desired vs ready when CPU autoscaling targets this component. */
  scale?: ScaleStatus | null
  /** Live pod readiness/restart state from K8s API. */
  runtimeHealth: RuntimeHealthSummary | null
  /** Per-process cache layers when proxy mode is active. */
  layers: ComponentLayerMetrics[]
  /** Per-signal-group freshness from the metrics WS (optional). */
  freshness?: import('../../lib/metricsFreshness').ComponentFreshness
  /** Observer probe status when read replicas are deployed (optional). */
  consistency?: DbConsistencyStatus | null

  // Meta
  podCount: number
  lastUpdated: number

  /** Rounded requestRate for compact UI readouts. */
  qps: number
}

import type {
  BackendReplicaStatus,
  ComponentLayerMetrics,
  DbConsistencyStatus,
  LoadgenIntervalBucket,
  PodReplicaMetrics,
  RuntimeHealthSummary,
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
  /** HTTP status code → count for the run (e.g. "200", "499", "500"). */
  statusCodes: Record<string, number>
  /** True when GetStats timed out but last-known stats were returned. */
  stale?: boolean
  scheduleId?: string
  currentPhase?: string
  phaseIndex?: number
  /** Effective endpoint weights from the running loadgen (METHOD path → weight). */
  distribution?: Record<string, number>
  /** Closed-loop VU lane stats when conversations are running. */
  vu?: ConversationLaneVU
  /** Distinct identity values the pressure lane can send (from metrics). */
  identityCount?: number
  /** Distinct client ids sent on the pressure lane since start. */
  identitiesSeen?: number
  /** Non-2xx loadgen responses during app-server HPA scale-up lag. */
  scaleLagErrors?: number
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

function loadgenPayloadEqual(
  a: LiveLoadgenState | null,
  b: LiveLoadgenState | null,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    a.active === b.active &&
    a.targetRps === b.targetRps &&
    a.currentRps === b.currentRps &&
    a.actualRps === b.actualRps &&
    a.intervalActualRps === b.intervalActualRps &&
    a.intervalP99Ms === b.intervalP99Ms &&
    a.totalRequests === b.totalRequests &&
    a.successRate === b.successRate &&
    a.durationSeconds === b.durationSeconds &&
    a.elapsedSeconds === b.elapsedSeconds &&
    a.scheduleId === b.scheduleId &&
    a.currentPhase === b.currentPhase &&
    a.phaseIndex === b.phaseIndex &&
    a.recentIntervals === b.recentIntervals &&
    a.recentLatenciesMs === b.recentLatenciesMs &&
    a.distribution === b.distribution &&
    a.statusCodes === b.statusCodes &&
    a.stale === b.stale &&
    a.identityCount === b.identityCount &&
    a.identitiesSeen === b.identitiesSeen &&
    a.scaleLagErrors === b.scaleLagErrors &&
    conversationLaneFingerprint(a.vu) === conversationLaneFingerprint(b.vu)
  )
}

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
      kind:
        r.kind === 'loadgen_start' ||
        r.kind === 'loadgen_stop' ||
        r.kind === 'loadgen_rate' ||
        r.kind === 'scale' ||
        r.kind === 'loadgen_mix' ||
        r.kind === 'chaos_inject' ||
        r.kind === 'chaos_heal' ||
        r.kind === 'standby_reclone'
          ? r.kind
          : undefined,
      detail:
        r.detail && typeof r.detail === 'object' && !Array.isArray(r.detail)
          ? Object.fromEntries(
              Object.entries(r.detail as Record<string, unknown>).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : undefined,
      visibility: parseEventVisibility(r.visibility, r.audience),
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
  /** Deployment-level timeline job op metrics (append/range). */
  timelineOps: TimelineOpsSnapshot | null
  /** Phenomenon ledger entries from the latest WS frame. */
  phenomena: PhenomenonEntry[]
  /** Namespace used for ledger sessionStorage (WS `namespace` or deployment id). */
  ledgerNamespace: string | null
  /** Latest cascade event for a short toast; cleared on dismiss or clearMetrics. */
  cascadeToast: WsEvent | null
  invariantToast: WsEvent | null
  /** Non-fatal transport/polling issue while live session remains active. */
  streamWarning: string | null
  /** Cached metrics snapshot is aging but the WS transport is still alive. */
  metricsDegraded: boolean
  /** True when playback cannot bracket the playhead (underrun / stale / reconnect). */
  chartFrozen: boolean
  /** True after WS reconnect until the buffer refills. */
  playbackCatchingUp: boolean

  /** Latest raw WS bucket (headlines / tooltips). Does not append chart history. */
  setLatestMetrics: (nodeId: string, data: MetricsBucket) => void
  updateMetrics: (nodeId: string, data: MetricsBucket) => void
  /** One set() for many buckets (WS frame batching). */
  applyMetricsBuckets: (
    next: Record<string, MetricsBucket>,
    opts: { appendHistory: boolean },
  ) => void
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
  setPhenomena: (
    entries: PhenomenonEntry[],
    ledgerNamespace: string | null,
    timelineOps?: TimelineOpsSnapshot | null,
  ) => void
  dismissCascadeToast: () => void
  dismissInvariantToast: () => void
  setStreamWarning: (msg: string | null) => void
  setMetricsDegraded: (degraded: boolean) => void
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
  timelineOps: null,
  phenomena: [],
  ledgerNamespace: null,
  cascadeToast: null,
  invariantToast: null,
  streamWarning: null,
  metricsDegraded: false,
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

  applyMetricsBuckets: (next, { appendHistory }) =>
    set((s) => {
      if (Object.keys(next).length === 0) return s
      const metrics = { ...s.metrics, ...next }
      if (!appendHistory) return { metrics }
      const history = { ...s.history }
      for (const [id, bucket] of Object.entries(next)) {
        const prev = s.history[id] ?? []
        history[id] = [...prev.slice(-29), bucket]
      }
      return { metrics, history }
    }),

  setLoadgen: (loadgen) =>
    set((s) => {
      if (loadgenPayloadEqual(s.loadgen, loadgen)) return s
      return { loadgen }
    }),

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
      const merged = capWsEvents([...s.events, ...incoming], MAX_EVENTS)
      let cascadeToast = s.cascadeToast
      let invariantToast = s.invariantToast
      for (const e of incoming) {
        if (e.type === 'cascade') cascadeToast = e
        if (e.type === 'invariant') invariantToast = e
      }
      return { events: merged, cascadeToast, invariantToast }
    }),

  setTemplateMetrics: (m) =>
    set({ templateMetrics: m && Object.keys(m).length ? { ...m } : {} }),

  setPhenomena: (phenomena, ledgerNamespace, timelineOps) =>
    set({
      phenomena: [...phenomena],
      ledgerNamespace,
      ...(timelineOps !== undefined ? { timelineOps } : {}),
    }),

  dismissCascadeToast: () => set({ cascadeToast: null }),

  dismissInvariantToast: () => set({ invariantToast: null }),

  setStreamWarning: (streamWarning) => set({ streamWarning }),

  setMetricsDegraded: (metricsDegraded) => set({ metricsDegraded }),

  clearMetrics: () => {
    const ledgerNs = useMetricsStore.getState().ledgerNamespace
    if (ledgerNs && typeof sessionStorage !== 'undefined') {
      clearLedgerCache(sessionStorage, ledgerNs)
    }
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
      timelineOps: null,
      phenomena: [],
      ledgerNamespace: null,
      cascadeToast: null,
      invariantToast: null,
      streamWarning: null,
      metricsDegraded: false,
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
      return { events: capWsEvents(events, MAX_EVENTS) }
    }),
}))
