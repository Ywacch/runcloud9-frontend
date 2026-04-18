/**
 * Per-tick component state (SysCrack-compatible shape).
 */
export interface SimulationState {
  cpuUsagePercent: number
  memoryUsageGb: number
  latencyMs: number
  errorRate: number
  isHealthy: boolean
  currentConnections: number
  throughputQps: number
}

export function defaultState(): SimulationState {
  return {
    cpuUsagePercent: 0,
    memoryUsageGb: 0,
    latencyMs: 0,
    errorRate: 0,
    isHealthy: true,
    currentConnections: 0,
    throughputQps: 0,
  }
}

/** Serializable snapshot for worker → main thread. */
export type NodeMetricsMap = Record<string, SimulationState>

/** Per-replica breakdown emitted by models that support horizontal scaling. */
export interface ReplicaMetrics {
  label: string
  qps: number
  cpuPercent: number
  memoryGb: number
  latencyMs: number
  errorRate: number
  utilizationPct: number
}

export interface ReplicaBreakdownContext {
  tick: number
  /** Upstream LB algorithm for compute nodes behind a load balancer. */
  lbAlgo?: string
  /** Previous tick utilization per replica (0-1+). */
  prevReplicaUtils?: number[]
  /** Previous tick latency per replica (ms). */
  prevReplicaLatencies?: number[]
  /** Previous tick throughput per replica (qps). */
  prevReplicaQps?: number[]
  /** Read fraction from workload profile for DB primary/read-replica routing. */
  readFraction?: number
}

export interface SimCacheEntry {
  key: string
  ttlRemaining?: number
  hitCount: number
  isHotKey: boolean
  evictionCandidate: boolean
  sizeBytes?: number
}

export interface SimDbQuerySample {
  label: string
  boundParams: string[]
  latencyMs: number
  rowsReturned?: number
}

export interface SimMqMessage {
  topic: string
  payload: string
  ageMs: number
  deliveryAttempt: number
}

export interface SimWorkerJob {
  label: string
  processingTimeMs: number
  status: 'processing' | 'completed' | 'failed'
}

/** Simulation-only detail for inspector / docs (not merged into live MetricsBucket). */
export interface SimNodeInspector {
  /** Inbound request rate accumulated for this node this tick. */
  ingressQps?: number
  /** Served throughput at this component (from model). */
  servedQps?: number
  /** Load balancer: approximate per-backend share of LB output this tick. */
  backendSplit?: { nodeId: string; qps: number }[]
  /** Cache: hit/miss rates this tick. */
  cacheHitsQps?: number
  cacheMissesQps?: number
  cacheKeySamples?: string[]
  cacheEntries?: SimCacheEntry[]
  /** Database: workload-derived query mix (approximate). */
  databaseBreakdown?: { label: string; qps: number }[]
  dbQuerySamples?: SimDbQuerySample[]
  /** Message queue: ingress, drain, backlog. */
  mqIngressQps?: number
  mqDrainQps?: number
  mqQueueDepth?: number
  mqMessages?: SimMqMessage[]
  workerCapacityQps?: number
  workerJobs?: SimWorkerJob[]
  /** Declared max throughput (RPS) for utilization display; from model when set. */
  capacityRps?: number
  /** ingressQps / capacityRps when capacity is known. */
  utilizationPct?: number
  /** Per-replica breakdown for horizontally scaled components. */
  replicaBreakdown?: ReplicaMetrics[]
}

export interface SimulationTickResult {
  tick: number
  metrics: NodeMetricsMap
  /** Rolling cache hits/misses this second (for MetricsBucket). */
  cacheHitsDelta: number
  cacheMissesDelta: number
  /** Approximate MQ backlog for tests / overlay. */
  mqQueueDepth: Record<string, number>
  /** Per-node simulation detail for inspector. */
  inspector: Record<string, SimNodeInspector>
  /** Human-readable warnings for this tick. */
  diagnostics: string[]
  /** Per-connection edge QPS this tick (connection id → qps). */
  edgeFlows: Record<string, number>
}
