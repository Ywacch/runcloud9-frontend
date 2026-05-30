import type { PodReplicaMetrics } from '../editor-core/domain/metricsUiContract'
import type { ReplicaMetrics } from '../editor-core/domain/simulation/types'

export function shortPodLabel(name: string, index: number): string {
  const trimmed = name.trim()
  if (!trimmed) return `pod ${index + 1}`
  const parts = trimmed.split('-')
  if (parts.length >= 2) {
    return parts.slice(-2).join('-')
  }
  return trimmed.length > 22 ? `${trimmed.slice(0, 20)}…` : trimmed
}

/** Map live WS per-pod rows to inspector replica tabs (simulation shape). */
export function replicaBreakdownFromPods(
  pods: PodReplicaMetrics[],
  cpuLimitCores: number,
): ReplicaMetrics[] {
  return pods.map((p, i) => {
    const util =
      cpuLimitCores > 0
        ? Math.min(150, (p.cpuUsage / cpuLimitCores) * 100)
        : Math.min(100, p.cpuUsage * 100)
    return {
      label: p.ready ? shortPodLabel(p.name, i) : `${shortPodLabel(p.name, i)} (not ready)`,
      qps: p.requestRate,
      cpuPercent: util,
      memoryGb: 0,
      latencyMs: p.p99LatencyMs,
      errorRate: p.errorRate,
      utilizationPct: util,
    }
  })
}
