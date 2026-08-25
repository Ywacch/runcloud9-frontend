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
  'Kubernetes Metrics API samples can step for the first minute on Autopilot. Use query rate and storage execution above for live DB pressure.'

export const THROUGHPUT_HELP =
  'Request throughput through this component (rolling view from the metrics stream).'
export const LATENCY_HELP =
  'Latency percentiles for this hop (from the metrics stream).'
export const LATENCY_P99_SPARK_HELP =
  'p99 latency over the last 10 seconds (from the metrics stream).'

export const SESSION_TIMEFRAME_LABEL = 'Session'

export const SESSION_TIMEFRAME_FOOTER =
  'Cluster totals cover this deployment from provision until now, including loadgen. They reset if the metrics API restarts. Per-replica rows count since that pod started and reset on kill. Cache, storage, and p99 still use shorter windows.'

export const SESSION_REPLICA_BREAKDOWN_HINT =
  'Cluster totals above include every replica for this deployment. Rows here are per pod since it started and reset on kill.'

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
