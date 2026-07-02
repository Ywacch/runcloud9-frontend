import type { CanvasNode } from '../editor-core/stores/canvasStore'

export const CPU_UTIL_HELP =
  'CPU utilization vs pod limit. Sustained high values mean pressure.'
export const MEM_UTIL_HELP =
  'Memory utilization vs pod limit. Watch for pressure before OOM risk.'
export const CPU_ALLOC_HELP =
  'Static CPU request/limit for this pod — not live utilization. Real % appears once metrics collection starts.'
export const MEM_ALLOC_HELP =
  'Static memory request/limit for this pod — not live utilization. Real % appears once metrics collection starts.'
export const METRICS_API_FRESHNESS_HELP =
  'Container usage from the Kubernetes Metrics API (same source as kubectl top). Updates about every 15–60 seconds.'

export const THROUGHPUT_HELP =
  'Request throughput through this component (rolling view from the metrics stream).'
export const LATENCY_HELP =
  'Latency percentiles for this hop (from the metrics stream).'
export const LATENCY_P99_SPARK_HELP =
  'p99 latency over the last 30 seconds (from the metrics stream).'

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
