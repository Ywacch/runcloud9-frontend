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

export interface ReplicaInspectorRow extends ReplicaMetrics {
  podName: string
  ready: boolean
  memoryBytes: number
  memPercent: number
}

/** Map live WS per-pod rows to inspector replica tabs (simulation shape). */
export function replicaBreakdownFromPods(
  pods: PodReplicaMetrics[],
  cpuLimitCores: number,
  memoryLimitBytes: number,
): ReplicaInspectorRow[] {
  return pods.map((p, i) => {
    const cpuPercent =
      cpuLimitCores > 0
        ? Math.min(100, (p.cpuUsage / cpuLimitCores) * 100)
        : Math.min(100, p.cpuUsage * 100)
    const memoryGb =
      p.memoryBytes > 0 ? p.memoryBytes / (1024 * 1024 * 1024) : 0
    const memPercent =
      p.memoryBytes > 0 && memoryLimitBytes > 0
        ? Math.min(100, (p.memoryBytes / memoryLimitBytes) * 100)
        : 0
    const util = cpuPercent / 100
    return {
      podName: p.name,
      ready: p.ready,
      label: shortPodLabel(p.name, i),
      qps: p.requestRate,
      cpuPercent,
      memoryGb,
      memoryBytes: p.memoryBytes,
      latencyMs: p.p99LatencyMs,
      errorRate: p.errorRate,
      utilizationPct: util,
      memPercent,
    }
  })
}

/** Simulation rows already carry memory; normalize for shared UI. */
export function replicaRowFromSimulation(r: ReplicaMetrics): ReplicaInspectorRow {
  return {
    ...r,
    podName: r.label,
    ready: true,
    memoryBytes: r.memoryGb > 0 ? r.memoryGb * 1024 * 1024 * 1024 : 0,
    memPercent: 0,
  }
}
