import type { CanvasNode } from '../editor-core/stores/canvasStore'

export const CPU_UTIL_HELP =
  'CPU utilization vs pod limit. Sustained high values mean pressure.'
export const MEM_UTIL_HELP =
  'Memory utilization vs pod limit. Watch for pressure before OOM risk.'
export const CPU_ALLOC_HELP =
  'Static CPU request/limit for this pod, not live utilization. Real % appears once metrics collection starts.'
export const MEM_ALLOC_HELP =
  'Static memory request/limit for this pod, not live utilization. Real % appears once metrics collection starts.'
export const METRICS_API_FRESHNESS_HELP =
  'Delayed ~15–60s. Container usage from the Kubernetes Metrics API (same source as kubectl top).'
export const ALLOCATED_NOT_MEASURED_HELP =
  'Allocated, not measured. Kube request/limit placeholder, not a live observation.'
export const TIER_C_WARMUP_HELP =
  'CPU and memory can look high for about a minute after the database starts.'

export const THROUGHPUT_HELP =
  'Request throughput through this component (rolling view from the metrics stream).'
export const WORKER_THROUGHPUT_HELP =
  'Jobs consumed from the message queue (worker processed counter), not HTTP request throughput.'
export const LATENCY_HELP =
  'Latency percentiles for this hop (from the metrics stream).'
export const LATENCY_P99_SPARK_HELP =
  'p99 latency over the last 10 seconds (from the metrics stream).'

export const SESSION_TIMEFRAME_LABEL = 'Session'

export const SESSION_TIMEFRAME_FOOTER =
  'Cluster totals cover this deployment from provision until now, including loadgen. They reset if the metrics API restarts. Per-replica rows count since that pod started and reset on kill. Session p99 latency grows with elapsed deployment time; after a pod restart, only live pods contribute.'

export const SESSION_LATENCY_P99_HELP =
  'p99 latency since session start (from the metrics stream). After an app-server pod restart, only live pods contribute.'

export const SESSION_REPLICA_BREAKDOWN_HINT =
  'Cluster totals above include every replica for this deployment. Rows here are per pod since it started and reset on kill.'

export const SESSION_CACHE_HIT_RATE_LABEL = 'Hit rate'

export const SESSION_CACHE_THROUGHPUT_LABEL = 'Session totals'

export const SESSION_CACHE_QUERIES_LABEL = 'Cache queries'

export const SESSION_CACHE_TOTALS_HINT =
  'Session hit and miss totals cover this deployment from provision until now. Live hit rate above uses a shorter window. They reset if the metrics API restarts.'

export const SESSION_CACHE_TOTALS_DISCLOSURE_HINT =
  'Deployment lifetime totals from provision until now; reset if the metrics API restarts.'

export const SESSION_STORAGE_ENGINE_HINT =
  'Redis or Postgres engine commands and rows from the exporter, including scrapes. Not app logical cache hits or playground GET counts.'

export const CACHE_KEYSPACE_HITS_HELP =
  'Redis counted a string-key lookup that found data (usually GET). This is a speed per second, not how many keys sit in memory.'

export const CACHE_KEYSPACE_MISSES_HELP =
  'Redis counted a string-key lookup that found nothing (usually GET on a missing key). Compare with app misses above when you use cache-aside GET/SET.'

export const CACHE_TIMELINES_COUNT_HELP =
  'How many user timelines Redis holds right now (timeline:* keys). Feed read speed is on the push and pull tiles above.'

export const POD_RATE_DISCLAIMER =
  'RPS/QPS may be slightly off because Prometheus queries run against individual pods.'

const POD_SCOPED_TYPES = new Set<CanvasNode['type']>([
  'load_balancer',
  'cache',
  'database',
  'worker',
])

export function withPodRateDisclaimer(
  base: string,
  nodeType: CanvasNode['type'],
): string {
  if (!POD_SCOPED_TYPES.has(nodeType)) return base
  return `${base} ${POD_RATE_DISCLAIMER}`
}
